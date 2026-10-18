-- =============================================================================
-- GDPR storage limitation (art. 5(1)(e)): automatic purge of location history.
-- Document the retention period in the privacy notice and DPIA.
-- =============================================================================
create extension if not exists pg_cron;

select cron.schedule(
  'pet-tracker-telemetry-retention',
  '17 3 * * *',  -- daily 03:17 UTC, off the top of the hour
  $$
    delete from public.telemetry       where recorded_at < now() - interval '180 days';
    delete from public.geofence_events where occurred_at < now() - interval '180 days';
  $$
);
