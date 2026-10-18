#
# Pet tracker firmware - nRF Connect SDK v3.4.x (Zephyr 4.4)
#
cmake_minimum_required(VERSION 3.20.0)

find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(pet_tracker)

target_sources(app PRIVATE
  src/main.c
  src/modem.c
  src/location.c
  src/cloud.c
  src/battery.c
  src/motion.c
  src/fota.c
)
