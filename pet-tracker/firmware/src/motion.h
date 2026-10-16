#ifndef MOTION_H_
#define MOTION_H_

#include <stdbool.h>

/* Called from the sensor driver's work context. */
typedef void (*motion_handler_t)(bool moving);

/*
 * Arm activity / inactivity detection on the accelerometer.
 * Returns -ENODEV on boards without a supported sensor; the application then
 * falls back to fixed-interval reporting.
 */
int motion_init(motion_handler_t handler);

#endif /* MOTION_H_ */
