/**
 * Supabase Edge Function: delete the caller's own account (App Store and
 * Google Play require in-app account deletion; GDPR art. 17).
 *
 * Called from the app with the user's session JWT (JWT verification ON).
 * Database cleanup is done by foreign keys: telemetry, zones, alerts, push
 * tokens and household links cascade; owned collars are reset to
 * "provisioned" so they can be claimed again. Photos are removed here.
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return json(401, { error: "unauthorized" });
  const userId = data.user.id;

  // Photos live under <user_id>/ in the private cat-photos bucket.
  const { data: files } = await admin.storage.from("cat-photos").list(userId, { limit: 1000 });
  if (files?.length) {
    await admin.storage.from("cat-photos").remove(files.map((f) => `${userId}/${f.name}`));
  }

  const { error: delError } = await admin.auth.admin.deleteUser(userId);
  if (delError) return json(500, { error: delError.message });

  console.log(JSON.stringify({ msg: "account deleted", user: userId }));
  return json(200, { status: "deleted" });
});
