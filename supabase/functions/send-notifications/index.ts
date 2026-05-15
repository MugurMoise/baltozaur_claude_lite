import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Web Push via VAPID — using the web-push compatible approach with Deno
const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT     = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@baltozaur.ro";

// ── Base64url helpers ─────────────────────────────────────────────────────────
function base64urlToUint8(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const b = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + padding);
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

function uint8ToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ── Generate VAPID JWT ────────────────────────────────────────────────────────
async function generateVapidJWT(audience: string): Promise<string> {
  const header  = { alg: "ES256", typ: "JWT" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  };

  const encode = (obj: object) =>
    uint8ToBase64url(new TextEncoder().encode(JSON.stringify(obj)));

  const signingInput = `${encode(header)}.${encode(payload)}`;

  const privateKeyBytes = base64urlToUint8(VAPID_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${uint8ToBase64url(new Uint8Array(sig))}`;
}

// ── Send a single push notification ──────────────────────────────────────────
async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const url      = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt      = await generateVapidJWT(audience);

    const response = await fetch(subscription.endpoint, {
      method:  "POST",
      headers: {
        "Authorization":  `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
        "Content-Type":   "application/json",
        "TTL":            "86400",
      },
      body: JSON.stringify(payload),
    });

    return { ok: response.ok, status: response.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Score emoji helper ────────────────────────────────────────────────────────
function scoreEmoji(score: number): string {
  if (score >= 70) return "🟢";
  if (score >= 40) return "🟡";
  return "🔴";
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!
  );

  // Tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().slice(0, 10);
  const tomorrowStart = `${tomorrowDate}T00:00:00`;
  const tomorrowEnd   = `${tomorrowDate}T23:59:59`;

  // Fetch tomorrow's lake scores joined with lake info
  const { data: scores, error: scoresError } = await supabase
    .from("lake_scores")
    .select(`
      score,
      lakes (
        name,
        county,
        distance_km
      )
    `)
    .gte("calculated_at", tomorrowStart)
    .lte("calculated_at", tomorrowEnd)
    .order("score", { ascending: false });

  if (scoresError || !scores?.length) {
    return new Response(
      JSON.stringify({ success: false, error: "No forecast data for tomorrow" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Fetch all active subscriptions
  const { data: subscriptions, error: subError } = await supabase
    .from("push_subscriptions")
    .select("*");

  if (subError || !subscriptions?.length) {
    return new Response(
      JSON.stringify({ success: false, error: "No subscriptions" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const results = [];
  const expiredEndpoints: string[] = [];

  for (const sub of subscriptions) {
    // Filter lakes by this subscriber's preferences
    const counties: string[]    = sub.counties ?? [];
    const maxDist: number | null = sub.max_distance_km;

    const relevantLakes = scores.filter((s: any) => {
      const lake = s.lakes;
      if (!lake) return false;
      const countyMatch   = counties.length === 0 || counties.includes(lake.county);
      const distanceMatch = maxDist === null || lake.distance_km <= maxDist;
      return countyMatch && distanceMatch;
    });

    if (relevantLakes.length === 0) continue;

    // Build notification message
    const topLakes = relevantLakes.slice(0, 3);
    const dayName  = tomorrow.toLocaleDateString("ro-RO", { weekday: "long" });
    const dayLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1);

    const lakeLines = topLakes
      .map((s: any) => `${scoreEmoji(s.score)} ${s.lakes.name} — ${Math.round(s.score)}pts`)
      .join("\n");

    const hasGood   = topLakes.some((s: any) => s.score >= 70);
    const bodyText  = `${lakeLines}\n\n${hasGood ? "🎣 Condiții bune mâine!" : "Condiții moderate mâine."}`;

    const payload = {
      title: `🦕 Baltozaur — Prognoză ${dayLabel}`,
      body:  bodyText,
      tag:   "baltozaur-daily",
      url:   "/",
      icon:  "/fish-icon.png",
    };

    const result = await sendPush(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      payload
    );

    // Clean up expired/invalid subscriptions (410 Gone)
    if (result.status === 410 || result.status === 404) {
      expiredEndpoints.push(sub.endpoint);
    }

    results.push({ endpoint: sub.endpoint.slice(-20), ...result });
  }

  // Remove expired subscriptions
  if (expiredEndpoints.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expiredEndpoints);
  }

  return new Response(
    JSON.stringify({ success: true, sent: results.length, results }),
    { headers: { "Content-Type": "application/json" } }
  );
});
