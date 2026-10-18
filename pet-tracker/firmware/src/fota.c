/*
 * Firmware over-the-air updates.
 *
 * Chain of trust: immutable MCUboot (keys pinned at build time) verifies the
 * ECDSA-P256 signature of every image before it is booted, decrypts it
 * (ECIES-P256 / AES-128) during the swap, and refuses older images via the
 * hardware security counter stored in OTP. A new image runs in "test" mode;
 * if it never confirms itself (e.g. cannot reach the cloud and reboots via
 * the watchdog), MCUboot reverts to the previous image.
 */
#include <stdio.h>
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/dfu/mcuboot.h>
#include <zephyr/sys/reboot.h>
#include <net/fota_download.h>

#include "fota.h"

LOG_MODULE_REGISTER(fota, CONFIG_TRACKER_LOG_LEVEL);

/* fota_download keeps pointers to host/path until the download completes. */
static char fota_host[128];
static char fota_path[128];
static atomic_t in_progress;

static void fota_evt_handler(const struct fota_download_evt *evt)
{
	switch (evt->id) {
	case FOTA_DOWNLOAD_EVT_FINISHED:
		LOG_INF("Image downloaded and marked for test boot, rebooting");
		sys_reboot(SYS_REBOOT_WARM);
		break;
	case FOTA_DOWNLOAD_EVT_ERROR:
	case FOTA_DOWNLOAD_EVT_CANCELLED:
		LOG_ERR("FOTA failed (%d)", evt->id);
		atomic_set(&in_progress, 0);
		break;
	default:
		break;
	}
}

int fota_init(void)
{
	return fota_download_init(fota_evt_handler);
}

void fota_confirm_image(void)
{
	if (!boot_is_img_confirmed()) {
		int err = boot_write_img_confirmed();

		LOG_INF("New firmware confirmed: %d", err);
	}
}

int fota_start(const char *host, const char *path)
{
	int err;

	if (!atomic_cas(&in_progress, 0, 1)) {
		return -EALREADY;
	}

	snprintf(fota_host, sizeof(fota_host), "%s", host);
	snprintf(fota_path, sizeof(fota_path), "%s", path);

	/* Same CA / sec tag as MQTT: firmware is fetched over mutually
	 * authenticated HTTPS from our own update server.
	 */
	err = fota_download_start(fota_host, fota_path, CONFIG_TRACKER_SEC_TAG, 0, 0);
	if (err) {
		LOG_ERR("fota_download_start failed: %d", err);
		atomic_set(&in_progress, 0);
	}

	return err;
}

bool fota_in_progress(void)
{
	return atomic_get(&in_progress);
}
