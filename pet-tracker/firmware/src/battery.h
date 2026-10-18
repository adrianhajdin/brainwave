#ifndef BATTERY_H_
#define BATTERY_H_

#include <stdint.h>

/* State of charge in percent (0-100), or a negative errno. */
int battery_percent_get(void);

#endif /* BATTERY_H_ */
