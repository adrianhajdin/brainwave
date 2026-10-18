/*
 * Pet tracker - application state machine.
 *
 *            motion start                       still for N min
 *  STATIONARY ------------> MOVING ---------------------------> STATIONARY
 *  (6 h heartbeat)          (report every 15 min)
 *
 * Every report runs the same low-power sequence:
 *   1. GNSS single fix while LTE sleeps in PSM. If the modem asks for
 *      assistance data, a short MQTT exchange fetches A-GNSS first and RAI
 *      hands the radio straight back to GNSS.
 *   2. One MQTT/TLS session: flush the store-and-forward backlog (QoS 1),
 *      pick up queued downlinks (config, FOTA) from the persistent session.
 *   3. RAI + DISCONNECT: modem returns to PSM (~3 uA), application core to
 *      System ON idle; nothing runs until a timer or the accelerometer fires.
 */
#include <stdio.h>
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/sys/reboot.h>
#include <zephyr/task_wdt/task_wdt.h>

#include "battery.h"
#include "cloud.h"
#include "fota.h"
#include "location.h"
#include "modem.h"
#include "motion.h"
#include "tracker.h"

LOG_MODULE_REGISTER(tracker, CONFIG_TRACKER_LOG_LEVEL);

#define LOST_MODE_INTERVAL_S      60
#define NIGHT_STATIONARY_INTERVAL_S 3600
#define MIN_REPORT_SPACING_MS     (2 * MSEC_PER_SEC * 60)
#define NETWORK_WAIT              K_SECONDS(60)
#define DOWNLINK_DRAIN_MS         1000

enum app_state {
	STATE_STATIONARY,
	STATE_MOVING,
};

enum app_evt {
	EVT_REPORT_DUE,
	EVT_MOTION_START,
	EVT_MOTION_STOP,
};

K_MSGQ_DEFINE(app_msgq, sizeof(enum app_evt), 8, 4);

static enum app_state state = STATE_MOVING;
static struct tracker_config config = {
	.moving_interval_s = CONFIG_TRACKER_MOVING_INTERVAL_S,
	.lost_mode = false,
	.night_mode = false,
	.night_start_utc_min = 19 * 60,
	.night_end_utc_min = 5 * 60,
	.night_interval_s = 300,
};
static char device_id[TRACKER_DEVICE_ID_LEN];
static int wdt_channel = -1;
static int64_t last_report_ms = INT64_MIN / 2;
static uint32_t fix_seq;

/* --------------------------------------------------------------------------
 * Store-and-forward backlog (RAM ring buffer; oldest entry dropped when full)
 * -------------------------------------------------------------------------- */
static struct tracker_fix backlog[CONFIG_TRACKER_BACKLOG_SIZE];
static size_t backlog_head;
static size_t backlog_count;

static void backlog_push(const struct tracker_fix *fix)
{
	size_t tail = (backlog_head + backlog_count) % ARRAY_SIZE(backlog);

	if (backlog_count == ARRAY_SIZE(backlog)) {
		backlog_head = (backlog_head + 1) % ARRAY_SIZE(backlog);
		backlog_count--;
	}

	backlog[tail] = *fix;
	backlog_count++;
}

static const struct tracker_fix *backlog_peek(void)
{
	return backlog_count ? &backlog[backlog_head] : NULL;
}

static void backlog_pop(void)
{
	backlog_head = (backlog_head + 1) % ARRAY_SIZE(backlog);
	backlog_count--;
}

/* --------------------------------------------------------------------------
 * Event sources
 * -------------------------------------------------------------------------- */
static void post(enum app_evt evt)
{
	if (k_msgq_put(&app_msgq, &evt, K_NO_WAIT)) {
		LOG_WRN("Event queue full, dropping %d", evt);
	}
}

static void report_timer_handler(struct k_timer *timer)
{
	ARG_UNUSED(timer);
	post(EVT_REPORT_DUE);
}

K_TIMER_DEFINE(report_timer, report_timer_handler, NULL);

static void motion_handler(bool moving)
{
	post(moving ? EVT_MOTION_START : EVT_MOTION_STOP);
}

/* UTC clock derived from the last GNSS fix (the app core has no RTC sync). */
static int64_t utc_base_s = -1;
static int64_t utc_base_uptime_ms;

static void utc_sync(int64_t utc_s)
{
	utc_base_s = utc_s;
	utc_base_uptime_ms = k_uptime_get();
}

static bool night_watch_active(void)
{
	int64_t now_s;
	uint16_t minute;

	if (!config.night_mode || utc_base_s < 0) {
		return false;
	}

	now_s = utc_base_s + (k_uptime_get() - utc_base_uptime_ms) / MSEC_PER_SEC;
	minute = (uint16_t)((now_s / 60) % 1440);

	if (config.night_start_utc_min > config.night_end_utc_min) {
		/* window wraps midnight, e.g. 19:00-05:00 UTC */
		return minute >= config.night_start_utc_min || minute < config.night_end_utc_min;
	}
	return minute >= config.night_start_utc_min && minute < config.night_end_utc_min;
}

/* Seconds until the night window opens or closes (UINT32_MAX if unknown). */
static uint32_t seconds_to_night_edge(void)
{
	int64_t now_s;
	uint32_t minute, edge, delta_min;

	if (!config.night_mode || utc_base_s < 0) {
		return UINT32_MAX;
	}

	now_s = utc_base_s + (k_uptime_get() - utc_base_uptime_ms) / MSEC_PER_SEC;
	minute = (uint32_t)((now_s / 60) % 1440);
	edge = night_watch_active() ? config.night_end_utc_min : config.night_start_utc_min;
	delta_min = (edge + 1440 - minute) % 1440;

	return MAX(delta_min, 1U) * 60U;
}

static bool scheduled_night;

static void reschedule(void)
{
	uint32_t period_s;
	uint32_t first_s;
	bool night = night_watch_active();

	scheduled_night = night;

	if (config.lost_mode) {
		period_s = LOST_MODE_INTERVAL_S;
	} else if (state == STATE_MOVING) {
		period_s = night ? MIN(config.night_interval_s, config.moving_interval_s)
				 : config.moving_interval_s;
	} else {
		/* Asleep at night: hourly heartbeat instead of every 6 h. */
		period_s = night ? MIN(NIGHT_STATIONARY_INTERVAL_S, CONFIG_TRACKER_STATIONARY_INTERVAL_S)
				 : CONFIG_TRACKER_STATIONARY_INTERVAL_S;
	}

	/* Wake up at the night-window edge even during a long sleep interval. */
	first_s = MIN(period_s, seconds_to_night_edge());
	k_timer_start(&report_timer, K_SECONDS(first_s), K_SECONDS(period_s));
	LOG_INF("Next report in %u s, then every %u s%s", first_s, period_s, night ? " (night watch)" : "");
}

/* --------------------------------------------------------------------------
 * Cloud downlinks (invoked from within cloud_* calls, i.e. this thread)
 * -------------------------------------------------------------------------- */
static void config_handler(const struct tracker_config *cfg)
{
	if (cfg->lost_mode != config.lost_mode) {
		(void)modem_lost_mode_set(cfg->lost_mode);
	}

	config = *cfg;
	reschedule();
}

static void fota_handler(const char *host, const char *path)
{
	(void)fota_start(host, path);
}

static const struct cloud_handlers cloud_handlers = {
	.config = config_handler,
	.fota = fota_handler,
};

/* --------------------------------------------------------------------------
 * Report cycle
 * -------------------------------------------------------------------------- */
static void acquire_fix(void)
{
	/* Hard upper bound in case the modem never reports back. */
	const int64_t deadline = k_uptime_get() +
		(CONFIG_TRACKER_GNSS_TIMEOUT_S + CONFIG_TRACKER_AGNSS_WAIT_S + 30) * MSEC_PER_SEC;
	struct tracker_fix fix = { 0 };

	if (location_fix_start(CONFIG_TRACKER_GNSS_TIMEOUT_S)) {
		return;
	}

	while (true) {
		int64_t remaining = deadline - k_uptime_get();
		enum location_evt evt = location_wait(K_MSEC(MAX(remaining, 0)));

		switch (evt) {
		case LOCATION_EVT_FIX: {
			int batt = battery_percent_get();

			location_fix_get(&fix);
			utc_sync(fix.ts);
			fix.seq = fix_seq++;
			fix.batt_pct = batt < 0 ? 0 : (uint8_t)batt;
			backlog_push(&fix);
			(void)location_stop();
			return;
		}
		case LOCATION_EVT_AGNSS_NEEDED:
			/* Ephemerides are valid ~4 h, so this happens rarely when
			 * moving and roughly once per heartbeat when stationary.
			 */
			if (modem_is_registered()) {
				struct modem_cell_info cell = { 0 };

				(void)modem_cell_info_get(&cell);
				if (cloud_agnss_fetch(location_agnss_request(), &cell)) {
					LOG_WRN("A-GNSS fetch failed, continuing unassisted");
				}
				/* Free the shared radio for GNSS immediately. */
				cloud_radio_release();
			}
			break;
		case LOCATION_EVT_TIMEOUT:
		case LOCATION_EVT_NONE:
		default:
			LOG_WRN("No GNSS fix this cycle");
			(void)location_stop();
			return;
		}
	}
}

static void cloud_session(void)
{
	bool published = false;
	int err;

	if (modem_wait_registered(NETWORK_WAIT)) {
		LOG_WRN("No LTE coverage, %u fix(es) buffered", (unsigned int)backlog_count);
		return;
	}

	err = cloud_connect();
	if (err) {
		LOG_WRN("Cloud unreachable (%d), %u fix(es) buffered", err,
			(unsigned int)backlog_count);
		return;
	}

	for (const struct tracker_fix *fix = backlog_peek(); fix; fix = backlog_peek()) {
		err = cloud_publish_fix(fix);
		if (err) {
			LOG_WRN("Publish failed: %d", err);
			break;
		}
		backlog_pop();
		published = true;
	}

	if (published) {
		/* A fresh image has proven it can boot, attach and talk TLS. */
		fota_confirm_image();
	}

	/* Queued downlinks from the persistent session arrive right after
	 * CONNACK; give stragglers a moment, then hang up.
	 */
	(void)cloud_poll(DOWNLINK_DRAIN_MS);
	cloud_disconnect();
}

static void report(void)
{
	if (fota_in_progress()) {
		return; /* the download owns the radio until it reboots */
	}

	last_report_ms = k_uptime_get();
	acquire_fix();
	task_wdt_feed(wdt_channel);
	cloud_session();

	/* Entering or leaving the night window changes the cadence. */
	if (night_watch_active() != scheduled_night) {
		reschedule();
	}
}

/* --------------------------------------------------------------------------
 * Main
 * -------------------------------------------------------------------------- */
static void watchdog_init(void)
{
	const struct device *hw_wdt = DEVICE_DT_GET_OR_NULL(DT_ALIAS(watchdog0));

	if (task_wdt_init(device_is_ready(hw_wdt) ? hw_wdt : NULL)) {
		LOG_ERR("Task watchdog init failed");
		return;
	}

	/* No callback: an expired channel resets the SoC. */
	wdt_channel = task_wdt_add(CONFIG_TRACKER_WDT_TIMEOUT_S * MSEC_PER_SEC, NULL, NULL);
}

int main(void)
{
	char imei[16];
	int err;

	watchdog_init();

	err = modem_init();
	if (err) {
		LOG_ERR("Modem init failed (%d), rebooting in 60 s", err);
		k_sleep(K_SECONDS(60));
		sys_reboot(SYS_REBOOT_COLD);
	}

	if (modem_imei_get(imei, sizeof(imei)) == 0) {
		snprintf(device_id, sizeof(device_id), "pt-%s", imei);
	}
	LOG_INF("Device %s", device_id);

	(void)location_init();
	(void)fota_init();
	(void)cloud_init(device_id, &cloud_handlers);

	if (motion_init(motion_handler) == -ENODEV) {
		LOG_WRN("No accelerometer: fixed-interval reporting only");
	}

	/* First fix right after boot, then on schedule. */
	post(EVT_REPORT_DUE);
	reschedule();

	while (true) {
		enum app_evt evt;

		/* Wake at least twice per watchdog period to prove liveness. */
		if (k_msgq_get(&app_msgq, &evt,
			       K_SECONDS(CONFIG_TRACKER_WDT_TIMEOUT_S / 2)) == 0) {
			switch (evt) {
			case EVT_MOTION_START:
				if (state == STATE_STATIONARY) {
					LOG_INF("Moving");
					state = STATE_MOVING;
					reschedule();
					/* Owner sees the departure promptly, but
					 * jitter (a dog turning over) is rate-limited.
					 */
					if (k_uptime_get() - last_report_ms > MIN_REPORT_SPACING_MS) {
						report();
					}
				}
				break;
			case EVT_MOTION_STOP:
				if (state == STATE_MOVING) {
					LOG_INF("Stationary");
					state = STATE_STATIONARY;
					report(); /* resting position */
					reschedule();
				}
				break;
			case EVT_REPORT_DUE:
				report();
				break;
			}
		}

		task_wdt_feed(wdt_channel);
	}

	return 0;
}
