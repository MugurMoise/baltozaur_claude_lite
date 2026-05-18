import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SuggestionPayload = {
  appEnv?: "dev" | "prod";
  name?: string;
  county?: string;
  lat?: number | null;
  lon?: number | null;
  website_url?: string | null;
  facebook_url?: string | null;
  phone?: string | null;
  notes?: string | null;
  submitter_email?: string | null;
};

function clean(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function clientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  return req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-real-ip")
    ?? null;
}

async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Baltozaur <noreply@baltozaur.ro>";
  if (!apiKey) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
    }),
  });

  if (!response.ok) {
    console.warn("Resend failed", response.status, await response.text());
    return false;
  }

  return true;
}

function suggestionHtml(payload: SuggestionPayload) {
  const rows = [
    ["Nume", payload.name],
    ["Judet", payload.county],
    ["Coordonate", payload.lat != null && payload.lon != null ? `${payload.lat}, ${payload.lon}` : null],
    ["Site", payload.website_url],
    ["Facebook", payload.facebook_url],
    ["Telefon", payload.phone],
    ["Observatii", payload.notes],
  ].filter(([, value]) => value);

  return `
    <h1>Sugestie noua Baltozaur</h1>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="font-weight:bold;border-bottom:1px solid #ddd">${label}</td>
          <td style="border-bottom:1px solid #ddd">${String(value)}</td>
        </tr>
      `).join("")}
    </table>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")
    ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(JSON.stringify({ success: false, error: "Missing Supabase service configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = await req.json() as SuggestionPayload;
  const name = clean(payload.name);
  if (!name) {
    return new Response(JSON.stringify({ success: false, error: "Numele baltii este obligatoriu" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const table = payload.appEnv === "dev" ? "dev_lake_suggestions" : "lake_suggestions";
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent");
  const submitterEmail = clean(payload.submitter_email);
  const adminEmail = Deno.env.get("SUGGESTION_ADMIN_EMAIL");

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from(table)
    .insert({
      name,
      county: clean(payload.county),
      lat: payload.lat ?? null,
      lon: payload.lon ?? null,
      website_url: clean(payload.website_url),
      facebook_url: clean(payload.facebook_url),
      phone: clean(payload.phone),
      notes: clean(payload.notes),
      submitter_email: submitterEmail,
      submitter_ip: ip,
      user_agent: userAgent,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminEmailSent = adminEmail
    ? await sendEmail({
      to: adminEmail,
      subject: `Sugestie noua: ${name}`,
      html: suggestionHtml(payload),
    })
    : false;

  const confirmationSent = submitterEmail
    ? await sendEmail({
      to: submitterEmail,
      subject: "Am primit sugestia ta pentru Baltozaur",
      html: `
        <h1>Multumim pentru sugestie</h1>
        <p>Am primit propunerea pentru <strong>${name}</strong>. O verificam inainte sa o publicam.</p>
      `,
    })
    : false;

  if (confirmationSent) {
    await supabase
      .from(table)
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", data.id);
  }

  return new Response(JSON.stringify({
    success: true,
    id: data.id,
    adminEmailSent,
    confirmationSent,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
