# 5. Reverse engineering a tracking app with REA → cat tracker

## Tool and target

* **Tool:** [REA, Reverse Engineer Anything](https://github.com/morluto/rea) v6.5.0 (MIT), the official `morluto/rea` repository and the `rea-agents` npm package. Its README warns that look-alike forks are not official.
* **Target:** [Traccar](https://github.com/traccar/traccar-web), the web app of the open-source GPS tracking platform, Apache-2.0, commit `d24ac16`.

**Why Traccar and not a commercial pet tracker.** REA's own disclaimer excludes "copying proprietary software or reproducing its protected code and assets". Cloning a commercial pet-tracker app (Tractive, Weenect, …) would also infringe its copyright and terms of service. Traccar is a mature, widely deployed tracking product whose licence explicitly allows reuse. We studied its **behaviour and feature design**; no Traccar code was copied into this app.

## What was run

```bash
npx rea-agents@6.5.0 analyze-javascript-application traccar-web/src --json > traccar-evidence.json   # 100 MB
rea inspect-analysis-view  # summary projection (~10 KB)
```

REA parsed 186 JavaScript files and 89,262 AST nodes, producing 4,379 findings and 49 network-request relations. The analysis was static: no Traccar code was executed. Building Traccar's own bundle was deliberately skipped, because this environment does not run third-party build scripts.

REA's request, timer and event relations pointed to the files that implement the tracking UX:

| REA evidence (file:line) | Behaviour | How the cat tracker implements it |
|---|---|---|
| `SocketController.jsx:93` WebSocket `/api/socket` | Live push of `devices`, `positions`, `events` | Supabase **Realtime** `postgres_changes` on `devices` + `geofence_events` (RLS-filtered) |
| `SocketController.jsx:105–125` fetch `/api/devices`, `/api/positions` on close | REST snapshot when the live channel drops, so no gaps | `listCats()` snapshot before subscribing (AppProvider) |
| `SocketController.jsx:40` reconnect timer (60 s) | Automatic reconnect | Handled by supabase-js Realtime; tokens refreshed on app foreground |
| `SocketController.jsx:175` fetch `/api/events/{id}` | Event details for push notifications | `geofence_events` + zone name join |
| `other/ReplayPage.jsx:121–129` `setInterval(…, 500)` | Route replay: step one point every 500 ms, stop at end | Cat screen → **Replay** (same 500 ms cadence, step/pause/close) |
| `other/EmulatorPage.jsx:98` POST `id, lat, lon` | A client reports a position *as* a device | **"This phone is the cat's tracker"**: `report_phone_location()` |
| `main/DeviceList.jsx`, `MainMap.jsx` (module graph) | Device list beside the live map, status dot, last update | Home screen: map + cat list with live dot, battery, accuracy |
| `main/EventsDrawer.jsx` + sound on events | Alarm / geofence event feed | Red/green alert banner + per-cat alert list |
| `@turf/circle` dependency | Circle geofences drawn from centre + radius | `create_circle_geofence()` (PostGIS `ST_Buffer`), 50/100/250 m presets |

## What changed for cats

* **Multiple cats per household**, each with a name, a colour and a cat-ear avatar on the map. Species defaults to `cat`.
* **Geofencing is accuracy-aware.** A fix whose uncertainty circle straddles the fence does not flip state, so phones and collars don't spam enter/exit alerts at the garden edge. A new zone records the cat's current side immediately, so the first exit alerts.
* **Two tracker kinds behind one ingest path:** `collar` (nRF9160, mTLS/MQTT) and `phone` (app session). That lets you test the whole product before hardware exists.
* **Privacy:** a new owner never sees a previous owner's track, deleting the account erases everything, and history is purged after 180 days. Traccar's admin and multi-tenant server features were left out.
