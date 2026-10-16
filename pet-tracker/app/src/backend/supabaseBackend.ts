/**
 * Real backend: Supabase Auth + PostgREST RPCs + Realtime + Storage.
 * All access is enforced server-side by RLS and the security-definer functions
 * in cloud/supabase/migrations - this client holds only the public key.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import type {
  ActivityDay,
  Backend,
  Cat,
  CatEvent,
  HeatCell,
  HomeZone,
  HouseholdPerson,
  LiveHandlers,
  NightWatch,
  PhoneFix,
  ReportResult,
  TrackPoint,
} from './types';

interface DeviceRow {
  id: string;
  display_name: string | null;
  color: string;
  kind: 'collar' | 'phone';
  owner_id: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_accuracy_m: number | null;
  last_battery_pct: number | null;
  last_fix_at: string | null;
  lost_mode: boolean;
  lost_mode_since: string | null;
  night_mode: boolean;
  night_start_min: number;
  night_end_min: number;
  night_interval_s: number;
  photo_path: string | null;
}

const DEVICE_COLUMNS =
  'id, display_name, color, kind, owner_id, last_lat, last_lng, last_accuracy_m, last_battery_pct, last_fix_at, ' +
  'lost_mode, lost_mode_since, night_mode, night_start_min, night_end_min, night_interval_s, photo_path';

const PHOTO_BUCKET = 'cat-photos';
const SIGNED_URL_TTL_S = 3600;

function toCat(r: DeviceRow): Cat {
  return {
    id: r.id,
    name: r.display_name ?? 'Unnamed cat',
    color: r.color,
    kind: r.kind,
    ownerId: r.owner_id,
    lastLat: r.last_lat,
    lastLng: r.last_lng,
    lastAccuracyM: r.last_accuracy_m,
    lastBatteryPct: r.last_battery_pct,
    lastFixAt: r.last_fix_at,
    lostMode: r.lost_mode ?? false,
    lostModeSince: r.lost_mode_since ?? null,
    night: {
      enabled: r.night_mode ?? false,
      startMin: r.night_start_min ?? 1260,
      endMin: r.night_end_min ?? 420,
      intervalS: r.night_interval_s ?? 300,
    },
    photoPath: r.photo_path ?? null,
  };
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const;
  readonly userId: string;
  readonly userLabel: string;
  readonly #db: SupabaseClient;
  readonly #photoUrls = new Map<string, { url: string; expires: number }>();

  constructor(db: SupabaseClient, userId: string, email: string | undefined) {
    this.#db = db;
    this.userId = userId;
    this.userLabel = email ?? 'Signed in';
  }

  async listCats(): Promise<Cat[]> {
    const { data, error } = await this.#db
      .from('devices')
      .select(DEVICE_COLUMNS)
      .order('created_at', { ascending: true });
    fail(error);
    return (data as unknown as DeviceRow[]).map(toCat);
  }

  subscribe(handlers: LiveHandlers): () => void {
    // RLS is applied per subscriber: users only receive their household's rows.
    const channel: RealtimeChannel = this.#db
      .channel(`cats-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<DeviceRow>).id;
          if (id) handlers.onCatRemoved?.(id);
          return;
        }
        const row = payload.new as DeviceRow;
        if (row.owner_id === null) {
          handlers.onCatRemoved?.(row.id);
          return;
        }
        handlers.onCat(toCat(row));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'geofence_events' }, async (payload) => {
        const ev = payload.new as { id: number; device_id: string; geofence_id: string; transition: 'enter' | 'exit'; occurred_at: string; notify: boolean };
        if (!ev.notify) return;
        const { data } = await this.#db.from('geofences').select('name').eq('id', ev.geofence_id).maybeSingle();
        handlers.onEvent?.({
          id: String(ev.id), catId: ev.device_id, transition: ev.transition,
          zoneName: (data as { name: string } | null)?.name ?? 'zone', at: ev.occurred_at,
        });
      })
      .subscribe();

    return () => {
      void this.#db.removeChannel(channel);
    };
  }

  async addPhoneCat(name: string, color: string): Promise<string> {
    const { data, error } = await this.#db.rpc('create_phone_tracker', { p_name: name, p_color: color });
    fail(error);
    return data as string;
  }

  async claimCollar(deviceUid: string, claimCode: string): Promise<string> {
    const { data, error } = await this.#db.rpc('claim_device', {
      p_device_uid: deviceUid.trim(),
      p_claim_code: claimCode.trim(),
    });
    fail(error);
    return data as string;
  }

  async updateCat(id: string, changes: { name?: string; color?: string }): Promise<void> {
    const patch: Record<string, string> = {};
    if (changes.name !== undefined) patch.display_name = changes.name.trim();
    if (changes.color !== undefined) patch.color = changes.color;
    const { error } = await this.#db.from('devices').update(patch).eq('id', id);
    fail(error);
  }

  async removeCat(id: string): Promise<void> {
    const { error } = await this.#db.rpc('release_device', { p_device_id: id });
    fail(error);
  }

  async setPhoto(catId: string, localUri: string): Promise<void> {
    const body = await (await fetch(localUri)).arrayBuffer();
    const path = `${this.userId}/${catId}-${Date.now()}.jpg`;
    const { error } = await this.#db.storage.from(PHOTO_BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false });
    fail(error);

    const { data: before } = await this.#db.from('devices').select('photo_path').eq('id', catId).maybeSingle();
    const { error: updError } = await this.#db.from('devices').update({ photo_path: path }).eq('id', catId);
    if (updError) {
      await this.#db.storage.from(PHOTO_BUCKET).remove([path]);
      fail(updError);
    }
    const old = (before as { photo_path: string | null } | null)?.photo_path;
    if (old) await this.#db.storage.from(PHOTO_BUCKET).remove([old]);
  }

  async removePhoto(catId: string): Promise<void> {
    const { data: before } = await this.#db.from('devices').select('photo_path').eq('id', catId).maybeSingle();
    const { error } = await this.#db.from('devices').update({ photo_path: null }).eq('id', catId);
    fail(error);
    const old = (before as { photo_path: string | null } | null)?.photo_path;
    if (old) await this.#db.storage.from(PHOTO_BUCKET).remove([old]);
  }

  async photoUrl(path: string): Promise<string | null> {
    const cached = this.#photoUrls.get(path);
    if (cached && cached.expires > Date.now() + 60_000) return cached.url;
    const { data, error } = await this.#db.storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_S);
    if (error || !data) return null;
    this.#photoUrls.set(path, { url: data.signedUrl, expires: Date.now() + SIGNED_URL_TTL_S * 1000 });
    return data.signedUrl;
  }

  async setLostMode(catId: string, on: boolean): Promise<void> {
    const { error } = await this.#db.rpc('set_lost_mode', { p_device_id: catId, p_on: on });
    fail(error);
  }

  async setNightWatch(catId: string, night: NightWatch, timezone: string): Promise<void> {
    const { error } = await this.#db
      .from('devices')
      .update({
        night_mode: night.enabled,
        night_start_min: night.startMin,
        night_end_min: night.endMin,
        night_interval_s: night.intervalS,
        timezone,
      })
      .eq('id', catId);
    fail(error);
  }

  async reportLocation(catId: string, fix: PhoneFix): Promise<ReportResult> {
    const { data, error } = await this.#db.rpc('report_phone_location', {
      p_device_id: catId,
      p_lat: fix.lat,
      p_lng: fix.lng,
      p_accuracy_m: fix.accuracyM,
      p_battery_pct: fix.batteryPct,
      p_recorded_at: fix.at,
    });
    fail(error);
    const status = (data as { status?: string } | null)?.status;
    return status === 'ok' || status === 'duplicate' || status === 'rate_limited' ? status : 'rejected';
  }

  async getTrack(catId: string, sinceIso: string): Promise<TrackPoint[]> {
    const { data, error } = await this.#db.rpc('get_pet_track', { p_device_id: catId, p_since: sinceIso });
    fail(error);
    return (data as Array<{ recorded_at: string; lat: number; lng: number; accuracy_m: number; battery_pct: number }>).map(
      (r) => ({ at: r.recorded_at, lat: r.lat, lng: r.lng, accuracyM: r.accuracy_m, batteryPct: r.battery_pct }),
    );
  }

  async getHeatmap(catId: string, sinceIso: string): Promise<HeatCell[]> {
    const { data, error } = await this.#db.rpc('get_pet_heatmap', { p_device_id: catId, p_since: sinceIso, p_cell_m: 25 });
    fail(error);
    return (data as Array<{ lat: number; lng: number; weight_s: number }>).map((r) => ({ lat: r.lat, lng: r.lng, weightS: r.weight_s }));
  }

  async getActivity(catId: string, days: number): Promise<ActivityDay[]> {
    const { data, error } = await this.#db.rpc('get_pet_activity', { p_device_id: catId, p_days: days });
    fail(error);
    return (data as Array<{ day: string; distance_m: number; active_minutes: number; roam_radius_m: number | null; night_share: number | null; fixes: number }>).map(
      (r) => ({
        day: r.day, distanceM: r.distance_m, activeMinutes: r.active_minutes,
        roamRadiusM: r.roam_radius_m, nightShare: r.night_share, fixes: r.fixes,
      }),
    );
  }

  async getZones(catId: string): Promise<HomeZone[]> {
    const { data, error } = await this.#db.rpc('get_pet_geofences', { p_device_id: catId });
    fail(error);
    return (data as Array<{ id: string; name: string; center_lat: number; center_lng: number; radius_m: number; all_cats: boolean }>).map(
      (r) => ({ id: r.id, name: r.name, lat: r.center_lat, lng: r.center_lng, radiusM: r.radius_m, allCats: r.all_cats }),
    );
  }

  async addZone(catId: string | null, name: string, lat: number, lng: number, radiusM: number): Promise<void> {
    const { error } = await this.#db.rpc('create_circle_geofence', {
      p_device_id: catId, p_name: name.trim() || 'Home', p_lat: lat, p_lng: lng, p_radius_m: radiusM, p_alert_on_enter: true,
    });
    fail(error);
  }

  async removeZone(zoneId: string): Promise<void> {
    const { error } = await this.#db.from('geofences').delete().eq('id', zoneId);
    fail(error);
  }

  async getEvents(catId: string): Promise<CatEvent[]> {
    const { data, error } = await this.#db
      .from('geofence_events')
      .select('id, device_id, transition, occurred_at, geofences(name)')
      .eq('device_id', catId)
      .order('occurred_at', { ascending: false })
      .limit(50);
    fail(error);
    return (data as unknown as Array<{ id: number; device_id: string; transition: 'enter' | 'exit'; occurred_at: string; geofences: { name: string } | null }>).map(
      (r) => ({ id: String(r.id), catId: r.device_id, transition: r.transition, zoneName: r.geofences?.name ?? 'zone', at: r.occurred_at }),
    );
  }

  async createInvite(): Promise<string> {
    const { data, error } = await this.#db.rpc('create_household_invite');
    fail(error);
    return data as string;
  }

  async acceptInvite(code: string): Promise<void> {
    const { error } = await this.#db.rpc('accept_household_invite', { p_code: code });
    fail(error);
  }

  async listHousehold(): Promise<HouseholdPerson[]> {
    const { data, error } = await this.#db.rpc('list_household');
    fail(error);
    return (data as Array<{ owner_id: string; member_id: string; email: string; role: 'owner' | 'member' }>).map((r) => ({
      userId: r.role === 'owner' ? r.owner_id : r.member_id,
      email: r.email,
      role: r.role,
    }));
  }

  async removeMember(userId: string): Promise<void> {
    const { error } = await this.#db.rpc('remove_household_member', { p_member_id: userId });
    fail(error);
  }

  async leaveHousehold(ownerId: string): Promise<void> {
    const { error } = await this.#db.rpc('leave_household', { p_owner_id: ownerId });
    fail(error);
  }

  async registerPushToken(token: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
    const { error } = await this.#db.rpc('register_push_token', { p_token: token, p_platform: platform });
    fail(error);
  }

  async unregisterPushToken(token: string): Promise<void> {
    const { error } = await this.#db.rpc('unregister_push_token', { p_token: token });
    fail(error);
  }

  async deleteAccount(): Promise<void> {
    const { error } = await this.#db.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw new Error(error.message);
    await this.#db.removeAllChannels();
    await this.#db.auth.signOut({ scope: 'local' });
  }

  async signOut(): Promise<void> {
    await this.#db.removeAllChannels();
    await this.#db.auth.signOut();
  }
}
