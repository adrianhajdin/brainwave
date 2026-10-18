#!/usr/bin/env bash
# Runs the migrations + behavioural tests against a throwaway database on a
# local PostgreSQL 15+ with PostGIS installed (pg_cron migration is skipped).
#   PGHOST=/var/run/postgresql PGPORT=5432 ./run.sh
set -euo pipefail
cd "$(dirname "$0")"

DB=pet_tracker_test_$$
psql -q -v ON_ERROR_STOP=1 -d postgres -c "create database $DB"
trap 'psql -q -d postgres -c "drop database if exists $DB" >/dev/null' EXIT

psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase_stub.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f ../supabase/migrations/20261016000100_tracker_core.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f ../supabase/migrations/20261016000300_cats_and_phone_trackers.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f ../supabase/migrations/20261016000400_household_alerts_insights.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tracker_test.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f cats_test.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f household_test.sql
# Households v2 migrates the data the tests above leave behind.
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f ../supabase/migrations/20261018000500_households_and_sitters.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f sharing_test.sql
