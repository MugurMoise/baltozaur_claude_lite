interface VisitorContext {
  country: string | null;
  region: string | null;
  city: string | null;
  excluded: boolean;
  ip_hash: string | null;
}

function cleanHeader(value: string | null, maxLength: number) {
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim().slice(0, maxLength) || null;
  } catch {
    return value.trim().slice(0, maxLength) || null;
  }
}

function requestIp(request: Request) {
  const forwarded = request.headers.get('x-vercel-forwarded-for')
    ?? request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim().toLowerCase() || null;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function isExcludedIp(ipHash: string | null) {
  if (!ipHash) return false;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const rpcName = process.env.VITE_APP_ENV === 'dev'
    ? 'is_dev_analytics_ip_excluded'
    : 'is_analytics_ip_excluded';
  if (!supabaseUrl || !supabaseAnonKey) return false;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ip_hash: ipHash }),
    });

    if (!response.ok) return true;
    return await response.json() === true;
  } catch {
    return true;
  }
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') {
      return new Response(null, {
        status: 405,
        headers: { Allow: 'GET' },
      });
    }

    const ip = requestIp(request);
    const ipHash = ip ? await sha256(ip) : null;
    const excluded = await isExcludedIp(ipHash);
    const context: VisitorContext = {
      country: excluded ? null : cleanHeader(request.headers.get('x-vercel-ip-country'), 2)?.toUpperCase() ?? null,
      region: excluded ? null : cleanHeader(request.headers.get('x-vercel-ip-country-region'), 80),
      city: excluded ? null : cleanHeader(request.headers.get('x-vercel-ip-city'), 120),
      excluded,
      ip_hash: ipHash,
    };

    return Response.json(context, {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  },
};
