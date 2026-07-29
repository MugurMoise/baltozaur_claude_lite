import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(() => new Response(
  JSON.stringify({ success: false, error: "Push notifications have been retired" }),
  {
    status: 410,
    headers: { "Content-Type": "application/json" },
  }
));
