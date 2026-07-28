import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ?? Deno.env.get("SERVICE_ROLE_KEY");
  const githubToken = Deno.env.get("GITHUB_BACKUP_TOKEN");
  const githubRepository = Deno.env.get("GITHUB_BACKUP_REPOSITORY");

  if (!supabaseUrl || !serviceRoleKey || !githubToken || !githubRepository) {
    return json({ error: "Backup service is not configured" }, 503);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Authentication required" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const jwt = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await adminClient.auth.getUser(jwt);
  if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

  const { data: admin, error: adminError } = await adminClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (adminError || !admin) return json({ error: "Admin access required" }, 403);

  const [owner, repo, extra] = githubRepository.split("/");
  if (!owner || !repo || extra) return json({ error: "Invalid backup repository configuration" }, 503);

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/database-backup.yml/dispatches`,
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { force: "true", source: "admin-before-release" },
      }),
    },
  );

  if (!response.ok) {
    console.error("GitHub workflow dispatch failed", response.status, await response.text());
    return json({ error: "Backup workflow could not be started" }, 502);
  }

  return json({
    accepted: true,
    workflow_url: `https://github.com/${owner}/${repo}/actions/workflows/database-backup.yml`,
  }, 202);
});
