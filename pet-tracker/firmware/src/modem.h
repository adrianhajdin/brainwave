#ifndef MODEM_H_
#define MODEM_H_

#include <stddef.h>
#include <stdint.h>
#include <zephyr/kernel.h>

struct modem_cell_info {
	uint16_t mcc;
	uint16_t mnc;
	uint32_t tac;
	uint32_t eci; /* E-UTRAN cell id */
};

/* Initialise nrf_modem_lib and start the (asynchronous) LTE attach. */
int modem_init(void);

/* Block until registered (home or roaming - 1NCE is always roaming). */
int modem_wait_registered(k_timeout_t timeout);

bool modem_is_registered(void);

int modem_imei_get(char *buf, size_t len);

int modem_cell_info_get(struct modem_cell_info *info);

/*
 * Lost mode trades battery for reachability: PSM off, eDRX on, so cloud
 * commands arrive within one eDRX cycle instead of at the next report.
 */
int modem_lost_mode_set(bool enable);

#endif /* MODEM_H_ */
