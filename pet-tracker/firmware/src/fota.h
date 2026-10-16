#ifndef FOTA_H_
#define FOTA_H_

#include <stdbool.h>

/* Marks the running image as good once it has proven it can reach the cloud. */
int fota_init(void);

/* Confirm the image (call after the first successful publish post-update). */
void fota_confirm_image(void);

/* Start downloading a signed (and encrypted) MCUboot image over HTTPS. */
int fota_start(const char *host, const char *path);

bool fota_in_progress(void);

#endif /* FOTA_H_ */
