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
  notes?: string | null;
};

function clean(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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
  const isDev = payload.appEnv === "dev";
  const name = clean(payload.name) ?? "Sugestie fără nume";

  const table = isDev ? "dev_lake_suggestions" : "lake_suggestions";

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
      notes: clean(payload.notes),
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

  return new Response(JSON.stringify({
    success: true,
    id: data.id,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
