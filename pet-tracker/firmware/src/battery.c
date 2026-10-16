/*
 * Battery state of charge from the modem's supply measurement (%XVBAT).
 *
 * This assumes the SiP is supplied straight from the cell (nRF9160 VDD range
 * 3.0-5.5 V). For production, use a PMIC with a fuel gauge (nPM1300 +
 * nrf_fuel_gauge) - voltage-based SoC is +-10 % at best on LiPo.
 */
#include <zephyr/kernel.h>
#include <modem/modem_battery.h>

#include "battery.h"

/* Typical 1C-rated LiPo open-circuit curve at room temperature. */
static const struct {
	int mv;
	int pct;
} lipo_curve[] = {
	{ 4180, 100 }, { 4100, 92 }, { 4000, 80 }, { 3900, 66 }, { 3800, 50 },
	{ 3750, 40 },  { 3700, 28 }, { 3650, 18 }, { 3600, 10 }, { 3500, 5 },
	{ 3300, 0 },
};

int battery_percent_get(void)
{
	int mv;
	int err = modem_battery_voltage_get(&mv);

	if (err) {
		return err;
	}

	if (mv >= lipo_curve[0].mv) {
		return 100;
	}

	for (size_t i = 1; i < ARRAY_SIZE(lipo_curve); i++) {
		if (mv >= lipo_curve[i].mv) {
			int dmv = lipo_curve[i - 1].mv - lipo_curve[i].mv;
			int dpct = lipo_curve[i - 1].pct - lipo_curve[i].pct;

			return lipo_curve[i].pct + (mv - lipo_curve[i].mv) * dpct / dmv;
		}
	}

	return 0;
}
