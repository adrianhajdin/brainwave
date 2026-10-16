/*
 * GNSS single-shot fixes with A-GNSS.
 *
 * The nRF9160 shares one radio between LTE and GNSS: GNSS only runs while
 * LTE is idle (PSM / eDRX sleep / RRC idle). The report cycle therefore runs
 * GNSS while the modem sleeps and only then opens the LTE data session.
 */
#include <string.h>
#include <time.h>
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/sys/timeutil.h>
#include <nrf_modem_gnss.h>

#include "location.h"

LOG_MODULE_REGISTER(location, CONFIG_TRACKER_LOG_LEVEL);

/* Event bits, set from the GNSS callback (interrupt context). */
#define EVT_FIX     BIT(0)
#define EVT_TIMEOUT BIT(1)
#define EVT_AGNSS   BIT(2)

static K_EVENT_DEFINE(gnss_events);

static struct nrf_modem_gnss_pvt_data_frame last_fix;
static struct nrf_modem_gnss_agnss_data_frame agnss_need;

static void gnss_event_handler(int event)
{
	/* Runs in IRQ context: copy out and signal, nothing else. */
	static struct nrf_modem_gnss_pvt_data_frame pvt;

	switch (event) {
	case NRF_MODEM_GNSS_EVT_PVT:
		if (nrf_modem_gnss_read(&pvt, sizeof(pvt), NRF_MODEM_GNSS_DATA_PVT) == 0 &&
		    (pvt.flags & NRF_MODEM_GNSS_PVT_FLAG_FIX_VALID)) {
			last_fix = pvt;
			k_event_post(&gnss_events, EVT_FIX);
		}
		break;
	case NRF_MODEM_GNSS_EVT_SLEEP_AFTER_TIMEOUT:
		k_event_post(&gnss_events, EVT_TIMEOUT);
		break;
	case NRF_MODEM_GNSS_EVT_AGNSS_REQ:
		if (nrf_modem_gnss_read(&agnss_need, sizeof(agnss_need),
					NRF_MODEM_GNSS_DATA_AGNSS_REQ) == 0) {
			k_event_post(&gnss_events, EVT_AGNSS);
		}
		break;
	default:
		break;
	}
}

int location_init(void)
{
	int err = nrf_modem_gnss_event_handler_set(gnss_event_handler);

	if (err) {
		LOG_ERR("Failed to set GNSS handler: %d", err);
	}

	return err;
}

int location_fix_start(uint16_t timeout_s)
{
	int err;

	k_event_clear(&gnss_events, EVT_FIX | EVT_TIMEOUT | EVT_AGNSS);

	/* fix_interval 0 == single fix; the receiver sleeps after the fix or
	 * after fix_retry seconds, whichever comes first.
	 */
	err = nrf_modem_gnss_fix_interval_set(0);
	err = err ? err : nrf_modem_gnss_fix_retry_set(timeout_s);
	/* MULTIPLE_HOT_START: keep ephemerides fresh between fixes.
	 * LOW_ACCURACY: accept a fix from fewer satellites (3 + reference
	 * altitude) - tens of metres is ample for a pet, and saves seconds.
	 */
	err = err ? err : nrf_modem_gnss_use_case_set(NRF_MODEM_GNSS_USE_CASE_MULTIPLE_HOT_START |
						      NRF_MODEM_GNSS_USE_CASE_LOW_ACCURACY);
	err = err ? err : nrf_modem_gnss_nmea_mask_set(0);
	err = err ? err : nrf_modem_gnss_start();

	if (err) {
		LOG_ERR("GNSS start failed: %d", err);
	}

	return err;
}

int location_stop(void)
{
	return nrf_modem_gnss_stop();
}

enum location_evt location_wait(k_timeout_t timeout)
{
	uint32_t evts = k_event_wait(&gnss_events, EVT_FIX | EVT_TIMEOUT | EVT_AGNSS,
				     false, timeout);

	/* Consume one event per call, highest priority first. */
	if (evts & EVT_FIX) {
		k_event_clear(&gnss_events, EVT_FIX);
		return LOCATION_EVT_FIX;
	}
	if (evts & EVT_AGNSS) {
		k_event_clear(&gnss_events, EVT_AGNSS);
		return LOCATION_EVT_AGNSS_NEEDED;
	}
	if (evts & EVT_TIMEOUT) {
		k_event_clear(&gnss_events, EVT_TIMEOUT);
		return LOCATION_EVT_TIMEOUT;
	}

	return LOCATION_EVT_NONE;
}

void location_fix_get(struct tracker_fix *fix)
{
	const struct nrf_modem_gnss_datetime *dt = &last_fix.datetime;
	struct tm tm = {
		.tm_year = dt->year - 1900,
		.tm_mon = dt->month - 1,
		.tm_mday = dt->day,
		.tm_hour = dt->hour,
		.tm_min = dt->minute,
		.tm_sec = dt->seconds,
	};

	fix->lat = last_fix.latitude;
	fix->lng = last_fix.longitude;
	fix->accuracy_m = last_fix.accuracy;
	fix->ts = timeutil_timegm64(&tm);

	LOG_INF("Fix: %.6f, %.6f (±%.0f m) in %u ms", fix->lat, fix->lng,
		(double)fix->accuracy_m, last_fix.execution_time);
}

const struct nrf_modem_gnss_agnss_data_frame *location_agnss_request(void)
{
	return &agnss_need;
}
