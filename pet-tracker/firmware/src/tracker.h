/*
 * Shared types for the pet tracker application.
 */
#ifndef TRACKER_H_
#define TRACKER_H_

#include <stdbool.h>
#include <stdint.h>

/* "pt-" + 15-digit IMEI. Equals MQTT client id and certificate CN. */
#define TRACKER_DEVICE_ID_LEN sizeof("pt-123456789012345")

struct tracker_fix {
	double lat;
	double lng;
	float accuracy_m;  /* horizontal, 68 % confidence */
	int64_t ts;        /* GNSS UTC time, seconds since the Unix epoch */
	uint32_t seq;      /* monotonically increasing per boot, for ordering */
	uint8_t batt_pct;
};

/* Remote configuration delivered on pt/v1/<id>/down/config (QoS 1). */
struct tracker_config {
	uint32_t moving_interval_s;
	bool lost_mode;
};

#endif /* TRACKER_H_ */
