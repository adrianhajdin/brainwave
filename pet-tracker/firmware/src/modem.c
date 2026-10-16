/*
 * LTE-M / NB-IoT link management.
 *
 * PSM, eDRX, RAI and the APN are configured through Kconfig (prj.conf) and
 * applied by the lte_lc library when the modem initialises. This module only
 * starts the attach, tracks registration and exposes cell information.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <modem/lte_lc.h>
#include <modem/nrf_modem_lib.h>
#include <nrf_modem_at.h>

#include "modem.h"

LOG_MODULE_REGISTER(modem, CONFIG_TRACKER_LOG_LEVEL);

static K_SEM_DEFINE(registered_sem, 0, 1);
static atomic_t registered;
static atomic_t cell_tac;
static atomic_t cell_id;

static void lte_evt_handler(const struct lte_lc_evt *const evt)
{
	switch (evt->type) {
	case LTE_LC_EVT_NW_REG_STATUS:
		if (evt->nw_reg_status == LTE_LC_NW_REG_REGISTERED_HOME ||
		    evt->nw_reg_status == LTE_LC_NW_REG_REGISTERED_ROAMING) {
			LOG_INF("Registered (%s)",
				evt->nw_reg_status == LTE_LC_NW_REG_REGISTERED_HOME ?
				"home" : "roaming");
			atomic_set(&registered, 1);
			k_sem_give(&registered_sem);
		} else {
			atomic_set(&registered, 0);
		}
		break;
	case LTE_LC_EVT_PSM_UPDATE:
		/* active_time == -1 means the network rejected PSM: the battery
		 * budget no longer holds, so make it visible in the logs.
		 */
		if (evt->psm_cfg.active_time < 0) {
			LOG_WRN("Network did not grant PSM");
		} else {
			LOG_INF("PSM granted: periodic TAU %d s, active time %d s",
				evt->psm_cfg.tau, evt->psm_cfg.active_time);
		}
		break;
	case LTE_LC_EVT_EDRX_UPDATE:
		LOG_INF("eDRX: cycle %.2f s, PTW %.2f s",
			(double)evt->edrx_cfg.edrx, (double)evt->edrx_cfg.ptw);
		break;
	case LTE_LC_EVT_RRC_UPDATE:
		LOG_DBG("RRC %s", evt->rrc_mode == LTE_LC_RRC_MODE_CONNECTED ?
			"connected" : "idle");
		break;
	case LTE_LC_EVT_CELL_UPDATE:
		atomic_set(&cell_tac, (atomic_val_t)evt->cell.tac);
		atomic_set(&cell_id, (atomic_val_t)evt->cell.id);
		break;
	case LTE_LC_EVT_MODEM_SLEEP_ENTER:
		if (evt->modem_sleep.type == LTE_LC_MODEM_SLEEP_PSM) {
			LOG_DBG("Modem entered PSM");
		}
		break;
	default:
		break;
	}
}

int modem_init(void)
{
	int err;

	err = nrf_modem_lib_init();
	if (err) {
		LOG_ERR("nrf_modem_lib_init failed: %d", err);
		return err;
	}

	/* Non-blocking: GNSS can work while the first attach is in progress,
	 * and the modem keeps searching autonomously if coverage is lost.
	 */
	err = lte_lc_connect_async(lte_evt_handler);
	if (err) {
		LOG_ERR("lte_lc_connect_async failed: %d", err);
	}

	return err;
}

int modem_wait_registered(k_timeout_t timeout)
{
	if (atomic_get(&registered)) {
		return 0;
	}

	k_sem_reset(&registered_sem);
	if (atomic_get(&registered)) {
		return 0;
	}

	return k_sem_take(&registered_sem, timeout) == 0 ? 0 : -ETIMEDOUT;
}

bool modem_is_registered(void)
{
	return atomic_get(&registered);
}

int modem_imei_get(char *buf, size_t len)
{
	char imei[16];
	int ret;

	ret = nrf_modem_at_scanf("AT+CGSN", "%15[0-9]", imei);
	if (ret != 1) {
		return -EIO;
	}

	return snprintf(buf, len, "%s", imei) < (int)len ? 0 : -ENOMEM;
}

int modem_cell_info_get(struct modem_cell_info *info)
{
	char plmn[7] = {0};
	int ret;

	/* +COPS: <mode>,<format>,"<numeric PLMN>",<AcT> */
	ret = nrf_modem_at_scanf("AT+COPS?", "+COPS: %*d,%*d,\"%6[0-9]\"", plmn);
	if (ret != 1 || strlen(plmn) < 5) {
		return -ENOTCONN;
	}

	info->mnc = (uint16_t)atoi(&plmn[3]);
	plmn[3] = '\0';
	info->mcc = (uint16_t)atoi(plmn);
	info->tac = (uint32_t)atomic_get(&cell_tac);
	info->eci = (uint32_t)atomic_get(&cell_id);

	return 0;
}

int modem_lost_mode_set(bool enable)
{
	int err;

	if (enable) {
		err = lte_lc_psm_req(false);
		if (!err) {
			err = lte_lc_edrx_req(true);
		}
	} else {
		err = lte_lc_edrx_req(false);
		if (!err) {
			err = lte_lc_psm_req(true);
		}
	}

	LOG_INF("Lost mode %s (%d)", enable ? "on" : "off", err);
	return err;
}
