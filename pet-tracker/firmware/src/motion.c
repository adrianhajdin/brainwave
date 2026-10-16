/*
 * Motion detection with the ADXL362 (or any sensor with the same triggers).
 *
 * The sensor runs in linked + referenced mode (see prj.conf): it raises ONE
 * interrupt when activity starts and ONE when the animal has been still for
 * CONFIG_ADXL362_INACTIVITY_TIME samples, then autosleeps. The nRF9160 stays
 * in System ON idle in between - no polling.
 */
#include <errno.h>
#include <zephyr/device.h>
#include <zephyr/drivers/sensor.h>
#include <zephyr/logging/log.h>

#include "motion.h"

LOG_MODULE_REGISTER(motion, CONFIG_TRACKER_LOG_LEVEL);

#if DT_HAS_COMPAT_STATUS_OKAY(adi_adxl362)

static const struct device *const accel = DEVICE_DT_GET_ONE(adi_adxl362);
static motion_handler_t motion_handler;

static void activity_trigger(const struct device *dev, const struct sensor_trigger *trig)
{
	ARG_UNUSED(dev);

	if (motion_handler) {
		motion_handler(trig->type == SENSOR_TRIG_MOTION);
	}
}

int motion_init(motion_handler_t handler)
{
	static const struct sensor_trigger trig_motion = {
		.type = SENSOR_TRIG_MOTION,
		.chan = SENSOR_CHAN_ACCEL_XYZ,
	};
	static const struct sensor_trigger trig_still = {
		.type = SENSOR_TRIG_STATIONARY,
		.chan = SENSOR_CHAN_ACCEL_XYZ,
	};
	int err;

	if (!device_is_ready(accel)) {
		LOG_ERR("Accelerometer not ready");
		return -ENODEV;
	}

	motion_handler = handler;

	err = sensor_trigger_set(accel, &trig_motion, activity_trigger);
	if (!err) {
		err = sensor_trigger_set(accel, &trig_still, activity_trigger);
	}
	if (err) {
		LOG_ERR("Failed to arm motion triggers: %d", err);
	}

	return err;
}

#else /* no supported accelerometer on this board */

int motion_init(motion_handler_t handler)
{
	ARG_UNUSED(handler);
	return -ENODEV;
}

#endif
