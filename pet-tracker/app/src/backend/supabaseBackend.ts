/**
 * Real backend: Supabase Auth + PostgREST RPCs + Realtime.
 * All access is enforced server-side by RLS and the security-definer functions
 * in cloud/supabase/migrations - this client holds only the public anon key.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import type {
  Backend,
  Cat,
  CatEvent,
  HomeZone,
  LiveHandlers,
  PhoneFix,
  ReportResult,
  TrackPoint,
} from './types';

interface DeviceRow {
  id: string;
  display_name: string | null;
  color: string;
  kind: 'collar' | 'phone';
  last_lat: number | null;
  last_lng: number | null;
  last_accuracy_m: number | null;
  last_battery_pct: number | null;
  last_fix_at: string | null;
}

const DEVICE_COLUMNS =
  'id, display_name, color, kind, last_lat, last_lng, last_accuracy_m, last_battery_pct, last_fix_at';

function toCat(r: DeviceRow): Cat {
  return {
    id: r.id,
    name: r.display_name ?? 'Unnamed cat',
    color: r.color,
    kind: r.kind,
    lastLat: r.last_lat,
    lastLng: r.last_lng,
    lastAccuracyM: r.last_accuracy_m,
    lastBatteryPct: r.last_battery_pct,
    lastFixAt: r.last_fix_at,
  };
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const;
  readonly userLabel: string;

  constructor(private readonly db: SupabaseClient, email: string | undefined) {
    this.userLabel = email ?? 'Signed in';
  }

  async listCats(): Promise<Cat[]> {
    const { data, error } = await this.db
      .from('devices')
      .select(DEVICE_COLUMNS)
      .order('created_at', { ascending: true });
    fail(error);
    return (data as DeviceRow[]).map(toCat);
  }

  subscribe(handlers: LiveHandlers): () => void {
    // RLS is applied per subscriber: users only receive their own rows.
    const channel: RealtimeChannel = this.db
      .channel(`cats-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<DeviceRow>).id;
          if (id) handlers.onCatRemoved?.(id);
          return;
        }
        const row = payload.new as DeviceRow;
        // A released device loses its owner and leaves our list.
        if ((payload.new as { owner_id?: string | null }).owner_id === null) {
          handlers.onCatRemoved?.(row.id);
          return;
        }
        handlers.onCat(toCat(row));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'geofence_events' }, async (payload) => {
        const ev = payload.new as { id: number; device_id: string; geofence_id: string; transition: 'enter' | 'exit'; occurred_at: string; notify: boolean };
        if (!ev.notify) return;
        const { data } = await this.db.from('geofences').select('name').eq('id', ev.geofence_id).maybeSingle();
        handlers.onEvent?.({
          id: String(ev.id), catId: ev.device_id, transition: ev.transition,
          zoneName: (data as { name: string } | null)?.name ?? 'zone', at: ev.occurred_at,
        });
      })
      .subscribe();

    return () => {
      void this.db.removeChannel(channel);
    };
  }

  async addPhoneCat(name: string, color: string): Promise<string> {
    const { data, error } = await this.db.rpc('create_phone_tracker', { p_name: name, p_color: color });
    fail(error);
    return data as string;
  }

  async claimCollar(deviceUid: string, claimCode: string): Promise<string> {
    const { data, error } = await this.db.rpc('claim_device', {
      p_device_uid: deviceUid.trim(),
      p_claim_code: claimCode.trim(),
    });
    fail(error);
    return data as string;
  }

  async renameCat(id: string, name: string, color: string): Promise<void> {
    const { error } = await this.db.from('devices').update({ display_name: name.trim(), color }).eq('id', id);
    fail(error);
  }

  async removeCat(id: string): Promise<void> {
    const { error } = await this.db.rpc('release_device', { p_device_id: id });
    fail(error);
  }

  async reportLocation(catId: string, fix: PhoneFix): Promise<ReportResult> {
    const { data, error } = await this.db.rpc('report_phone_location', {
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
    const { data, error } = await this.db.rpc('get_pet_track', { p_device_id: catId, p_since: sinceIso });
    fail(error);
    return (data as Array<{ recorded_at: string; lat: number; lng: number; accuracy_m: number; battery_pct: number }>).map(
      (r) => ({ at: r.recorded_at, lat: r.lat, lng: r.lng, accuracyM: r.accuracy_m, batteryPct: r.battery_pct }),
    );
  }

  async getZones(catId: string): Promise<HomeZone[]> {
    const { data, error } = await this.db.rpc('get_pet_geofences', { p_device_id: catId });
    fail(error);
    return (data as Array<{ id: string; name: string; center_lat: number; center_lng: number; radius_m: number }>).map(
      (r) => ({ id: r.id, name: r.name, lat: r.center_lat, lng: r.center_lng, radiusM: r.radius_m }),
    );
  }

  async addZone(catId: string, name: string, lat: number, lng: number, radiusM: number): Promise<void> {
    const { error } = await this.db.rpc('create_circle_geofence', {
      p_device_id: catId, p_name: name, p_lat: lat, p_lng: lng, p_radius_m: radiusM, p_alert_on_enter: true,
    });
    fail(error);
  }

  async removeZone(zoneId: string): Promise<void> {
    const { error } = await this.db.from('geofences').delete().eq('id', zoneId);
    fail(error);
  }

  async getEvents(catId: string): Promise<CatEvent[]> {
    const { data, error } = await this.db
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

  async signOut(): Promise<void> {
    await this.db.removeAllChannels();
    await this.db.auth.signOut();
  }
}
