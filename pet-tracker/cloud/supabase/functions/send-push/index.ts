/**
 * Supabase Edge Function: deliver queued alerts as push notifications.
 *
 * Trigger: Database Webhook on INSERT into public.notification_outbox
 * (Dashboard -> Database -> Webhooks -> "Supabase Edge Functions" -> send-push).
 * The webhook calls this function with the service-role JWT, so keep JWT
 * verification ON (default).
 *
 * Each run also retries earlier undelivered rows, so a temporary Expo/FCM/APNs
 * outage heals on the next alert. Tokens that Expo reports as
 * DeviceNotRegistered are removed.
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_ATTEMPTS = 5;

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

interface OutboxRow {
  id: number;
  owner_id: string;
  device_id: string | null;
  kind: "zone_exit" | "zone_enter" | "low_battery" | "lost_mode";
  title: string;
  body: string;
  attempts: number;
}

interface ExpoTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function deliver(row: OutboxRow): Promise<{ sent: number; error?: string }> {
  // Owner, everyone in the cat's household and its current cat sitters.
  const { data: recipients, error } = await db.rpc("push_recipients", {
    p_owner_id: row.owner_id,
    p_device_id: row.device_id,
  });
  if (error) return { sent: 0, error: error.message };

  const tokens = [...new Set((recipients as Array<{ token: string }>).map((r) => r.token))];
  if (tokens.length === 0) return { sent: 0 };

  const urgent = row.kind === "zone_exit" || row.kind === "lost_mode";
  const messages = tokens.map((to) => ({
    to,
    title: row.title,
    body: row.body,
    sound: "default",
    priority: urgent ? "high" : "default",
    channelId: urgent ? "urgent" : "default",
    data: { kind: row.kind, catId: row.device_id },
  }));

  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN"); // only if "enhanced push security" is on
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;

  const res = await fetch(EXPO_PUSH_URL, { method: "POST", headers, body: JSON.stringify(messages) });
  if (!res.ok) return { sent: 0, error: `Expo push HTTP ${res.status}` };

  const { data: tickets } = (await res.json()) as { data: ExpoTicket[] };
  const dead = tickets
    .map((t, i) => (t.status === "error" && t.details?.error === "DeviceNotRegistered" ? tokens[i] : null))
    .filter((t): t is string => t !== null);
  if (dead.length) await db.from("push_tokens").delete().in("token", dead);

  const sent = tickets.filter((t) => t.status === "ok").length;
  const firstError = tickets.find((t) => t.status === "error" && t.details?.error !== "DeviceNotRegistered");
  return { sent, error: sent === 0 && firstError ? firstError.message : undefined };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const payload = await req.json().catch(() => null) as { table?: string; record?: OutboxRow } | null;
  if (payload?.table && payload.table !== "notification_outbox") {
    return json(400, { error: "unexpected table" });
  }

  // The new row plus anything still pending from earlier runs.
  const { data: pending, error } = await db
    .from("notification_outbox")
    .select("id, owner_id, device_id, kind, title, body, attempts")
    .is("sent_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at")
    .limit(50);
  if (error) return json(503, { error: error.message });

  const results = [];
  for (const row of pending as OutboxRow[]) {
    const r = await deliver(row);
    await db
      .from("notification_outbox")
      .update(r.error ? { attempts: row.attempts + 1, last_error: r.error } : { sent_at: new Date().toISOString(), last_error: null })
      .eq("id", row.id);
    results.push({ id: row.id, ...r });
  }

  return json(200, { processed: results.length, results });
});
