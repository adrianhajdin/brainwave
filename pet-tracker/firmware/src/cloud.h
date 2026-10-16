#ifndef CLOUD_H_
#define CLOUD_H_

#include <nrf_modem_gnss.h>

#include "modem.h"
#include "tracker.h"

struct cloud_handlers {
	void (*config)(const struct tracker_config *cfg);
	void (*fota)(const char *host, const char *path);
};

int cloud_init(const char *device_id, const struct cloud_handlers *handlers);

/* MQTT CONNECT over TLS 1.2 (mutual auth, session resumption). Idempotent. */
int cloud_connect(void);

/* QoS 1 publish of one fix; returns after PUBACK. */
int cloud_publish_fix(const struct tracker_fix *fix);

/* Ask the backend for A-GNSS data and inject the answer into the modem. */
int cloud_agnss_fetch(const struct nrf_modem_gnss_agnss_data_frame *need,
		      const struct modem_cell_info *cell);

/* Drain queued downlinks (config, FOTA) for up to timeout_ms. */
int cloud_poll(int timeout_ms);

/* Tell the network no more data is coming so RRC is released immediately. */
void cloud_radio_release(void);

void cloud_disconnect(void);

#endif /* CLOUD_H_ */
