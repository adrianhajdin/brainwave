# Cat Tracker app (Expo / React Native)

Track several cats on one map, with live positions, route replay and home-zone alerts. Until the collars exist, **a phone can stand in as a cat's tracker**: it sends its own GPS as that cat, over the phone's internet connection.

Runs in **Expo Go (SDK 58)** on iOS and Android, so there's nothing to compile.

## 1. Quickest test: demo mode (2 minutes, no account)

```bash
cd pet-tracker/app
npm install
npx expo start            # same Wi-Fi as the phone
# or: npx expo start --tunnel   (phone on mobile data / different network)
```

1. Install **Expo Go** from the App Store or Play Store and scan the QR code from the terminal.
2. Tap **Start demo**. Two simulated cats (Tijger, Pluis) wander around you.
3. **Add a cat** → name it → **This phone (test)** → keep "Start tracking with this phone now" on → **Add cat**. Allow location access.
4. The cat now follows your phone's GPS. Tap **Set home zone here (100 m)**, walk about 150 m away, and you get a **"Minoes left Home"** alert. Walk back for "back in Home".
5. **Replay** on any cat plays back its route.

Demo data lives only in memory on the phone and resets when the app restarts.

## 2. Real backend: Supabase (about 15 minutes)

This syncs between phones (one phone carries "the cat", another watches) and survives restarts.

1. Create a Supabase project in an **EU region** (Frankfurt).
2. Run the migrations from [`../cloud/supabase/migrations`](../cloud/supabase/migrations) in order, using `supabase db push` or the SQL editor:
   - `…0100_tracker_core.sql`: devices, telemetry, geofences, RLS, ingest
   - `…0200_retention.sql`: 180-day purge (first enable `pg_cron` under Database → Extensions)
   - `…0300_cats_and_phone_trackers.sql`: cats, phone trackers, circle zones, read helpers
3. **Authentication → Providers → Email**: enabled. For quick testing, turn **"Confirm email" off**, or confirm through the e-mail link.
4. Copy **Project URL** and **anon / publishable key** (Project Settings → API) into `app/.env`:
   ```bash
   cp .env.example .env   # then fill in both values
   ```
5. Restart `npx expo start`, then **Create account** in the app.
6. Add a cat with **This phone (test)**, then sign in with the same account on a second phone or in the browser (`npm run web`). The cat moves live on the second device through Supabase Realtime.

The anon key is safe to ship. Row-level security (46 database tests in `../cloud/db-tests`) ensures users only ever see their own cats. A phone can only report positions for its owner's *phone* trackers, and is rate-limited to one fix per 5 s.

## What a phone tracker does

* Uses `expo-location`'s `watchPositionAsync` with high accuracy, sending one fix every **15 s / 1 min / 15 min** (the 15 min option matches the collar firmware's moving interval).
* Reports through the `report_phone_location()` RPC, which feeds the same `ingest_telemetry()` path as the real collars. Geofences, history, de-duplication and GDPR deletion all behave identically.
* Includes battery % (`expo-battery`) and GPS accuracy. A device clock that runs ahead is clamped server-side.
* **Foreground only.** Expo Go cannot run background location tasks, so the screen is kept awake while tracking. For background tracking, create a development build (`npx expo prebuild` + `expo-task-manager` background location). That build needs the "Always" location permission and, on iOS, App Store review justification.

## Structure

```
app/                       expo-router screens
  index.tsx                map + cat list (+ zone alerts, tracker status)
  add-cat.tsx              new cat: phone tracker or claim a collar
  cat/[id].tsx             live status, phone-as-tracker, route replay, home zone, alerts
  login.tsx                demo mode / Supabase e-mail login
src/
  backend/types.ts         Backend interface (demo + Supabase implement it)
  backend/demoBackend.ts   on-device simulation, same zone hysteresis as the DB
  backend/supabaseBackend.ts  RPCs + Realtime (RLS enforced server-side)
  tracking/usePhoneTracker.ts "this phone is the cat's collar"
  components/CatMap.tsx    react-native-maps (iOS/Android)
  components/CatMap.web.tsx   dependency-free radar for the web preview
```

## Verified

* `npm run typecheck`, `npm test` (geo + zone hysteresis)
* `npx expo export` for **web, Android and iOS** (Hermes bytecode): all bundle cleanly
* Headless Chromium walkthrough of the web build with a simulated GPS: start demo → add a phone-tracked cat → first fix sent → set a 100 m home zone → move about 850 m → **"Left Home" alert** → route replay. Run in both light and dark mode.

Not verified here: the app inside Expo Go on a physical phone (native maps, iOS/Android permission dialogs), and against a hosted Supabase project.
