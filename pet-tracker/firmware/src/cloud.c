/*
 * MQTT 3.1.1 over TLS 1.2 to the IoT broker.
 *
 * Security properties
 *  - Mutual TLS: CA, client certificate and private key live in the modem's
 *    protected credential storage under CONFIG_TRACKER_SEC_TAG; the key is
 *    generated inside the modem and never leaves it.
 *  - Server certificate and hostname are always verified.
 *  - TLS session resumption cuts a reconnect from a ~4 kB full handshake to
 *    a ~0.3 kB abbreviated one: important for both battery and the 1NCE
 *    500 MB / 10 year data allowance.
 *  - Downlink payloads are size-checked and parsed with a typed, heap-free
 *    JSON parser; unknown topics are ignored.
 *
 * Single-threaded by design: all MQTT I/O runs in the caller's thread via
 * process_until(), so there are no races between the state machine and the
 * MQTT event handler.
 */
#include <stdio.h>
#include <string.h>
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/net/mqtt.h>
#include <zephyr/net/socket.h>
#include <zephyr/data/json.h>
#include <net/nrf_cloud_agnss.h>

#include "cloud.h"

LOG_MODULE_REGISTER(cloud, CONFIG_TRACKER_LOG_LEVEL);

#define TOPIC_PREFIX "pt/v1/"
#define TOPIC_LEN    64

/* A full GPS A-GNSS set (ephemerides + almanac + UTC + iono + time) is
 * ~3.5 kB; anything larger than this buffer is discarded.
 */
#define DOWNLINK_MAX_LEN 4096

static struct mqtt_client client;
static struct net_sockaddr_storage broker;
static bool broker_resolved;

static uint8_t rx_buf[512];
static uint8_t tx_buf[512];
static uint8_t payload_buf[DOWNLINK_MAX_LEN + 1];

static char client_id[TRACKER_DEVICE_ID_LEN];
static char topic_telemetry[TOPIC_LEN];
static char topic_agnss_req[TOPIC_LEN];
static char topic_down_filter[TOPIC_LEN];
static char topic_down_agnss[TOPIC_LEN];
static char topic_down_config[TOPIC_LEN];
static char topic_down_fota[TOPIC_LEN];

static const struct cloud_handlers *app_handlers;

static sec_tag_t sec_tags[] = { CONFIG_TRACKER_SEC_TAG };

#if defined(CONFIG_TRACKER_TLS_ECDSA_ONLY)
static const int ciphers[] = {
	0xC02B, /* TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256 */
	0xC023, /* TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256 */
};
#endif

/* Session state, only touched from the caller's thread. */
static bool connected;
static bool connack_received;
static int connack_result;
static bool session_present;
static bool suback_received;
static bool puback_received;
static uint16_t puback_expected_id;
static bool agnss_received;
static uint8_t agnss_parts_expected;
static uint8_t agnss_parts_received;
static uint16_t next_message_id = 1;

static uint16_t message_id_next(void)
{
	if (next_message_id == 0) {
		next_message_id = 1; /* 0 is not a valid packet identifier */
	}
	return next_message_id++;
}

/* ------------------------------------------------------------------------- */
/* Downlink handling                                                         */
/* ------------------------------------------------------------------------- */

struct config_msg {
	int32_t interval_s;
	bool lost_mode;
};

static const struct json_obj_descr config_descr[] = {
	JSON_OBJ_DESCR_PRIM(struct config_msg, interval_s, JSON_TOK_NUMBER),
	JSON_OBJ_DESCR_PRIM(struct config_msg, lost_mode, JSON_TOK_TRUE),
};

struct fota_msg {
	const char *host;
	const char *path;
};

static const struct json_obj_descr fota_descr[] = {
	JSON_OBJ_DESCR_PRIM(struct fota_msg, host, JSON_TOK_STRING),
	JSON_OBJ_DESCR_PRIM(struct fota_msg, path, JSON_TOK_STRING),
};

static void on_config(char *json, size_t len)
{
	struct config_msg msg = { 0 };
	struct tracker_config cfg = { 0 };
	int64_t fields = json_obj_parse(json, len, config_descr, ARRAY_SIZE(config_descr), &msg);

	if (fields < 0 || !(fields & BIT(0))) {
		LOG_WRN("Rejected malformed config (%lld)", (long long)fields);
		return;
	}

	if (msg.interval_s < 60 || msg.interval_s > 86400) {
		LOG_WRN("Rejected out-of-range interval %d", msg.interval_s);
		return;
	}

	cfg.moving_interval_s = (uint32_t)msg.interval_s;
	cfg.lost_mode = (fields & BIT(1)) ? msg.lost_mode : false;

	if (app_handlers && app_handlers->config) {
		app_handlers->config(&cfg);
	}
}

static void on_fota(char *json, size_t len)
{
	struct fota_msg msg = { 0 };
	int64_t fields = json_obj_parse(json, len, fota_descr, ARRAY_SIZE(fota_descr), &msg);

	if (fields != (BIT(0) | BIT(1)) || msg.host == NULL || msg.path == NULL) {
		LOG_WRN("Rejected malformed FOTA job");
		return;
	}

	/* Image authenticity is enforced by MCUboot's signature check, not by
	 * trusting this message; the download itself also runs over TLS.
	 */
	if (app_handlers && app_handlers->fota) {
		app_handlers->fota(msg.host, msg.path);
	}
}

static bool topic_is(const struct mqtt_utf8 *topic, const char *expected)
{
	return topic->size == strlen(expected) &&
	       memcmp(topic->utf8, expected, topic->size) == 0;
}

static void on_publish(struct mqtt_client *const c, const struct mqtt_publish_param *p)
{
	const struct mqtt_utf8 *topic = &p->message.topic.topic;
	size_t len = p->message.payload.len;
	int err;

	if (len > DOWNLINK_MAX_LEN) {
		/* Drain and drop: never let a peer overflow our buffers. */
		LOG_WRN("Dropping oversized downlink (%u bytes)", (unsigned int)len);
		while (len > 0) {
			size_t chunk = MIN(len, DOWNLINK_MAX_LEN);

			if (mqtt_readall_publish_payload(c, payload_buf, chunk)) {
				return;
			}
			len -= chunk;
		}
		goto ack;
	}

	err = mqtt_readall_publish_payload(c, payload_buf, len);
	if (err) {
		LOG_ERR("Failed to read payload: %d", err);
		return;
	}
	payload_buf[len] = '\0';

	if (topic_is(topic, topic_down_agnss)) {
		err = nrf_cloud_agnss_process((const char *)payload_buf, len);
		LOG_INF("A-GNSS part injected (%u bytes): %d", (unsigned int)len, err);
		agnss_parts_received++;
		agnss_received = agnss_parts_received >= agnss_parts_expected;
	} else if (topic_is(topic, topic_down_config)) {
		on_config((char *)payload_buf, len);
	} else if (topic_is(topic, topic_down_fota)) {
		on_fota((char *)payload_buf, len);
	} else {
		LOG_WRN("Ignoring downlink on unexpected topic");
	}

ack:
	if (p->message.topic.qos == MQTT_QOS_1_AT_LEAST_ONCE) {
		const struct mqtt_puback_param ack = { .message_id = p->message_id };

		mqtt_publish_qos1_ack(c, &ack);
	}
}

static void mqtt_evt_handler(struct mqtt_client *const c, const struct mqtt_evt *evt)
{
	switch (evt->type) {
	case MQTT_EVT_CONNACK:
		connack_result = evt->result;
		session_present = evt->param.connack.session_present_flag;
		connack_received = true;
		connected = (evt->result == 0);
		break;
	case MQTT_EVT_DISCONNECT:
		connected = false;
		break;
	case MQTT_EVT_PUBACK:
		if (evt->param.puback.message_id == puback_expected_id) {
			puback_received = true;
		}
		break;
	case MQTT_EVT_SUBACK:
		suback_received = true;
		break;
	case MQTT_EVT_PUBLISH:
		on_publish(c, &evt->param.publish);
		break;
	default:
		break;
	}
}

/* ------------------------------------------------------------------------- */
/* Transport                                                                 */
/* ------------------------------------------------------------------------- */

/* Run the MQTT state machine until *flag becomes true or the time is up. */
static int process_until(const bool *flag, int timeout_ms)
{
	int64_t deadline = k_uptime_get() + timeout_ms;

	while (flag == NULL || !*flag) {
		struct zsock_pollfd fds = {
			.fd = client.transport.tls.sock,
			.events = ZSOCK_POLLIN,
		};
		int64_t remaining = deadline - k_uptime_get();
		int ret;

		if (remaining <= 0) {
			return flag ? -ETIMEDOUT : 0;
		}

		ret = zsock_poll(&fds, 1, (int)MIN(remaining, mqtt_keepalive_time_left(&client)));
		if (ret < 0) {
			return -errno;
		}

		if (ret == 0) {
			mqtt_live(&client);
			continue;
		}

		if (fds.revents & ZSOCK_POLLIN) {
			ret = mqtt_input(&client);
			if (ret) {
				return ret;
			}
		}

		if (fds.revents & (ZSOCK_POLLERR | ZSOCK_POLLHUP | ZSOCK_POLLNVAL)) {
			connected = false;
			return -ENOTCONN;
		}

		if (!connected && connack_received) {
			return -ENOTCONN;
		}
	}

	return 0;
}

static int broker_resolve(void)
{
	struct zsock_addrinfo hints = {
		.ai_family = NET_AF_INET,
		.ai_socktype = NET_SOCK_STREAM,
	};
	struct zsock_addrinfo *res;
	int err;

	err = zsock_getaddrinfo(CONFIG_TRACKER_MQTT_BROKER_HOSTNAME, NULL, &hints, &res);
	if (err) {
		LOG_ERR("DNS lookup failed: %d", err);
		return -EHOSTUNREACH;
	}

	struct net_sockaddr_in *b4 = (struct net_sockaddr_in *)&broker;

	b4->sin_family = NET_AF_INET;
	b4->sin_port = net_htons(CONFIG_TRACKER_MQTT_BROKER_PORT);
	b4->sin_addr = ((struct net_sockaddr_in *)res->ai_addr)->sin_addr;
	zsock_freeaddrinfo(res);

	broker_resolved = true;
	return 0;
}

static void client_setup(void)
{
	struct mqtt_sec_config *tls = &client.transport.tls.config;

	mqtt_client_init(&client);

	client.broker = &broker;
	client.evt_cb = mqtt_evt_handler;
	client.client_id.utf8 = (const uint8_t *)client_id;
	client.client_id.size = strlen(client_id);
	client.protocol_version = MQTT_VERSION_3_1_1;
	/* Persistent session: QoS 1 downlinks published while the device is
	 * in PSM are queued by the broker and delivered on the next connect.
	 */
	client.clean_session = 0;
	client.keepalive = CONFIG_TRACKER_MQTT_KEEPALIVE_S;
	client.rx_buf = rx_buf;
	client.rx_buf_size = sizeof(rx_buf);
	client.tx_buf = tx_buf;
	client.tx_buf_size = sizeof(tx_buf);

	client.transport.type = MQTT_TRANSPORT_SECURE;
	tls->peer_verify = ZSOCK_TLS_PEER_VERIFY_REQUIRED;
	tls->sec_tag_list = sec_tags;
	tls->sec_tag_count = ARRAY_SIZE(sec_tags);
	tls->hostname = CONFIG_TRACKER_MQTT_BROKER_HOSTNAME;
	tls->session_cache = ZSOCK_TLS_SESSION_CACHE_ENABLED;
#if defined(CONFIG_TRACKER_TLS_ECDSA_ONLY)
	tls->cipher_list = ciphers;
	tls->cipher_count = ARRAY_SIZE(ciphers);
#endif
}

static int subscribe(void)
{
	struct mqtt_topic topic = {
		.topic = {
			.utf8 = (const uint8_t *)topic_down_filter,
			.size = strlen(topic_down_filter),
		},
		.qos = MQTT_QOS_1_AT_LEAST_ONCE,
	};
	const struct mqtt_subscription_list list = {
		.list = &topic,
		.list_count = 1,
		.message_id = message_id_next(),
	};
	int err;

	suback_received = false;
	err = mqtt_subscribe(&client, &list);
	if (err) {
		return err;
	}

	return process_until(&suback_received, 10 * MSEC_PER_SEC);
}

/* ------------------------------------------------------------------------- */
/* Public API                                                                */
/* ------------------------------------------------------------------------- */

int cloud_init(const char *device_id, const struct cloud_handlers *handlers)
{
	app_handlers = handlers;

	snprintf(client_id, sizeof(client_id), "%s", device_id);
	snprintf(topic_telemetry, TOPIC_LEN, TOPIC_PREFIX "%s/telemetry", device_id);
	snprintf(topic_agnss_req, TOPIC_LEN, TOPIC_PREFIX "%s/agnss/req", device_id);
	snprintf(topic_down_filter, TOPIC_LEN, TOPIC_PREFIX "%s/down/+", device_id);
	snprintf(topic_down_agnss, TOPIC_LEN, TOPIC_PREFIX "%s/down/agnss", device_id);
	snprintf(topic_down_config, TOPIC_LEN, TOPIC_PREFIX "%s/down/config", device_id);
	snprintf(topic_down_fota, TOPIC_LEN, TOPIC_PREFIX "%s/down/fota", device_id);

	return 0;
}

int cloud_connect(void)
{
	int err;

	if (connected) {
		return 0;
	}

	if (!broker_resolved) {
		err = broker_resolve();
		if (err) {
			return err;
		}
	}

	client_setup();
	connack_received = false;

	err = mqtt_connect(&client);
	if (err) {
		LOG_ERR("mqtt_connect failed: %d", err);
		broker_resolved = false; /* re-resolve next time (IP may have moved) */
		return err;
	}

	err = process_until(&connack_received, 30 * MSEC_PER_SEC);
	if (err || connack_result != 0) {
		LOG_ERR("CONNACK failed: %d / %d", err, connack_result);
		mqtt_abort(&client);
		connected = false;
		return err ? err : -ECONNREFUSED;
	}

	LOG_INF("MQTT connected (session present: %d)", session_present);

	/* The broker remembers subscriptions of a persistent session. */
	if (!session_present) {
		err = subscribe();
		if (err) {
			LOG_WRN("Subscribe failed: %d", err);
		}
	}

	return 0;
}

int cloud_publish_fix(const struct tracker_fix *fix)
{
	char json[192];
	int len;
	int err;

	len = snprintf(json, sizeof(json),
		       "{\"device_id\":\"%s\",\"lat\":%.6f,\"lng\":%.6f,\"batt\":%u,"
		       "\"accuracy\":%.1f,\"ts\":%lld,\"seq\":%u}",
		       client_id, fix->lat, fix->lng, fix->batt_pct,
		       (double)fix->accuracy_m, (long long)fix->ts, fix->seq);
	if (len < 0 || len >= (int)sizeof(json)) {
		return -ENOMEM;
	}

	const struct mqtt_publish_param param = {
		.message = {
			.topic = {
				.topic = {
					.utf8 = (const uint8_t *)topic_telemetry,
					.size = strlen(topic_telemetry),
				},
				.qos = MQTT_QOS_1_AT_LEAST_ONCE,
			},
			.payload = {
				.data = (uint8_t *)json,
				.len = len,
			},
		},
		.message_id = message_id_next(),
	};

	puback_received = false;
	puback_expected_id = param.message_id;

	err = mqtt_publish(&client, &param);
	if (err) {
		return err;
	}

	return process_until(&puback_received, 15 * MSEC_PER_SEC);
}

int cloud_agnss_fetch(const struct nrf_modem_gnss_agnss_data_frame *need,
		      const struct modem_cell_info *cell)
{
	char json[160];
	char types[40] = "";
	size_t n = 0;
	int len;
	int err;

	/* Map the modem's request onto nRF Cloud A-GNSS type ids, which the
	 * backend forwards to the assistance-data service. Contract with the
	 * backend: ephemerides (type 2) come back as their own message, all
	 * other types together in a second one.
	 */
#define ADD_TYPE(id) (n += snprintf(&types[n], sizeof(types) - n, "%s%d", n ? "," : "", (id)))
	if (need->data_flags & NRF_MODEM_GNSS_AGNSS_GPS_UTC_REQUEST) {
		ADD_TYPE(1);
	}
	if (need->system_count > 0 && need->system[0].sv_mask_ephe) {
		ADD_TYPE(2);
	}
	if (need->system_count > 0 && need->system[0].sv_mask_alm) {
		ADD_TYPE(3);
	}
	if (need->data_flags & NRF_MODEM_GNSS_AGNSS_KLOBUCHAR_REQUEST) {
		ADD_TYPE(4);
	}
	if (need->data_flags & NRF_MODEM_GNSS_AGNSS_NEQUICK_REQUEST) {
		ADD_TYPE(5);
	}
	if (need->data_flags & NRF_MODEM_GNSS_AGNSS_GPS_SYS_TIME_AND_SV_TOW_REQUEST) {
		ADD_TYPE(6);
		ADD_TYPE(7);
	}
	if (need->data_flags & NRF_MODEM_GNSS_AGNSS_POSITION_REQUEST) {
		ADD_TYPE(8);
	}
	if (need->data_flags & NRF_MODEM_GNSS_AGNSS_INTEGRITY_REQUEST) {
		ADD_TYPE(9);
	}
#undef ADD_TYPE

	if (n == 0) {
		return 0; /* nothing the service can help with */
	}

	{
		bool ephe = need->system_count > 0 && need->system[0].sv_mask_ephe;

		agnss_parts_expected = (ephe ? 1 : 0) + ((strcmp(types, "2") != 0) ? 1 : 0);
		agnss_parts_received = 0;
	}

	len = snprintf(json, sizeof(json),
		       "{\"types\":[%s],\"mcc\":%u,\"mnc\":%u,\"tac\":%u,\"eci\":%u}",
		       types, cell->mcc, cell->mnc, cell->tac, cell->eci);
	if (len < 0 || len >= (int)sizeof(json)) {
		return -ENOMEM;
	}

	err = cloud_connect();
	if (err) {
		return err;
	}

	const struct mqtt_publish_param param = {
		.message = {
			.topic = {
				.topic = {
					.utf8 = (const uint8_t *)topic_agnss_req,
					.size = strlen(topic_agnss_req),
				},
				.qos = MQTT_QOS_0_AT_MOST_ONCE,
			},
			.payload = {
				.data = (uint8_t *)json,
				.len = len,
			},
		},
		.message_id = message_id_next(),
	};

	agnss_received = false;
	err = mqtt_publish(&client, &param);
	if (err) {
		return err;
	}

	return process_until(&agnss_received, CONFIG_TRACKER_AGNSS_WAIT_S * MSEC_PER_SEC);
}

int cloud_poll(int timeout_ms)
{
	if (!connected) {
		return -ENOTCONN;
	}

	return process_until(NULL, timeout_ms);
}

void cloud_radio_release(void)
{
	int rai = RAI_NO_DATA;

	if (!connected) {
		return;
	}

	/* Release Assistance Indication: skip the network's RRC inactivity
	 * timer (typically 5-20 s at ~5-10 mA) and drop to idle/PSM now.
	 */
	if (zsock_setsockopt(client.transport.tls.sock, ZSOCK_SOL_SOCKET, SO_RAI,
			     &rai, sizeof(rai))) {
		LOG_DBG("SO_RAI not applied: %d", errno);
	}
}

void cloud_disconnect(void)
{
	int rai = RAI_LAST;

	if (!connected) {
		return;
	}

	/* The DISCONNECT packet is the last thing we send this cycle. */
	(void)zsock_setsockopt(client.transport.tls.sock, ZSOCK_SOL_SOCKET, SO_RAI,
			       &rai, sizeof(rai));
	(void)mqtt_disconnect(&client, NULL);
	connected = false;
}
