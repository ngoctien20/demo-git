// TIEN404 AI — V12 R1 staging-only Owner JWT read-only verification.
// This function never writes database rows, sends Zalo messages or accesses service_role.
// Supabase Edge gateway must verify JWT, then Auth.getUser() revalidates the session.
// No CORS: browser exposure not approved. No raw token, chat ID or user ID in responses/logs.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedShops = new Set([
  "qa-staging-shop-a-20261110",
  "qa-staging-shop-b-20261110",
]);

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function findPublishableKey(): string {
  const modern = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (modern) {
    try {
      const keys = JSON.parse(modern);
      const name = keys.default;
      if (typeof name === "string" && /^[A-Z][A-Z0-9_]+$/.test(name)) {
        const value = Deno.env.get(name);
        if (value && value.startsWith("sb_publishable_")) return value;
      }
    } catch {
      // Legacy fallback, never expose or log environment values.
    }
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return reply(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(authHeader);
  if (!match || match[1].length > 4096) {
    return reply(401, { ok: false, error: "AUTH_REQUIRED" });
  }

  const raw = await request.text();
  if (raw.length > 256) {
    return reply(413, { ok: false, error: "INVALID_REQUEST" });
  }
  let slug = "";
  try {
    const data = JSON.parse(raw);
    slug = typeof data?.shop_slug === "string" ? data.shop_slug : "";
  } catch {
    return reply(400, { ok: false, error: "INVALID_JSON" });
  }
  if (!allowedShops.has(slug)) {
    return reply(422, { ok: false, error: "INVALID_QA_SCOPE" });
  }

  const apiUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = findPublishableKey();
  if (!apiUrl || !publishableKey) {
    return reply(503, { ok: false, error: "AUTH_NOT_CONFIGURED" });
  }
  const supabase = createClient(apiUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  // Always verify with Supabase Auth. Do not trust decoded JWT claims alone.
  const { data: authData, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !authData.user?.id) {
    return reply(401, { ok: false, error: "INVALID_SESSION" });
  }

  // Both queries run with the caller's signed user JWT and RLS.
  // This function performs no write, and a shop cannot be inferred from user input alone.
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (tenantError) {
    return reply(503, { ok: false, error: "TENANT_CHECK_UNAVAILABLE" });
  }
  if (!tenant) {
    return reply(403, { ok: false, error: "OWNER_NOT_AUTHORIZED" });
  }
  const { data: memberships, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("role,active")
    .eq("tenant_id", tenant.id)
    .eq("user_id", authData.user.id)
    .eq("role", "owner")
    .eq("active", true)
    .limit(1);
  if (membershipError) {
    return reply(503, { ok: false, error: "MEMBERSHIP_CHECK_UNAVAILABLE" });
  }
  if (memberships?.length !== 1) {
    return reply(403, { ok: false, error: "OWNER_NOT_AUTHORIZED" });
  }

  return reply(200, {
    ok: true,
    owner_verified: true,
    shop_slug: slug,
    environment: "STAGING",
    capability: "OWNER_PREFLIGHT_READ_ONLY",
    real_order_writes: false,
    sandbox_order_writes: false,
    outbound_messaging: false,
  });
});
