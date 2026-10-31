interface AnalyticsCount {
  metric: string;
  bucket: string;
  count: number;
}

interface ActivityEntry {
  visitor_id: string;
  event_name: string;
  page_path: string;
  details: Record<string, string | number | boolean | null>;
}

const ALLOWED_METRICS = new Set([
  'page_view',
  'source',
  'platform',
  'action',
  'lake_interest',
]);

function countryFromRequest(request: Request) {
  const country = request.headers.get('x-vercel-ip-country')?.trim().toUpperCase();
  return country && /^[A-Z]{2}$/.test(country) ? country : null;
}

function validCount(value: unknown): value is AnalyticsCount {
  if (!value || typeof value !== 'object') return false;
  const count = value as Partial<AnalyticsCount>;
  return typeof count.metric === 'string'
    && ALLOWED_METRICS.has(count.metric)
    && typeof count.bucket === 'string'
    && count.bucket.length >= 1
    && count.bucket.length <= 120
    && !/[\u0000-\u001f\u007f]/.test(count.bucket)
    && Number.isInteger(count.count)
    && (count.count ?? 0) >= 1
    && (count.count ?? 0) <= 1000;
}

function validActivity(value: unknown): value is ActivityEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<ActivityEntry>;
  const isUuid = typeof entry.visitor_id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.visitor_id);
  const hasDetails = entry.details != null && typeof entry.details === 'object' && !Array.isArray(entry.details)
    && Object.entries(entry.details).every(([key, detail]) => key.length <= 64
      && (typeof detail === 'number' || typeof detail === 'boolean' || detail === null
        || (typeof detail === 'string' && detail.length <= 120)));
  return isUuid
    && typeof entry.event_name === 'string'
    && entry.event_name.length >= 1
    && entry.event_name.length <= 64
    && typeof entry.page_path === 'string'
    && entry.page_path.startsWith('/')
    && entry.page_path.length <= 200
    && hasDetails;
}

function mergeCounts(counts: AnalyticsCount[]) {
  const merged = new Map<string, AnalyticsCount>();
  for (const count of counts) {
    const key = `${count.metric}\u0000${count.bucket}`;
    const current = merged.get(key);
    if (current) {
      current.count = Math.min(1000, current.count + count.count);
    } else {
      merged.set(key, { ...count });
    }
  }
  return Array.from(merged.values());
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return new Response(null, {
        status: 405,
        headers: { Allow: 'POST' },
      });
    }

    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 16_384) {
      return Response.json({ error: 'Payload too large' }, { status: 413 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const body = raw as { counts?: unknown; activities?: unknown };
    const counts = Array.isArray(body?.counts) ? body.counts : [];
    const activities = Array.isArray(body?.activities) ? body.activities : [];
    if ((counts.length === 0 && activities.length === 0)
      || counts.length > 47
      || activities.length > 40
      || !counts.every(validCount)
      || !activities.every(validActivity)) {
      return Response.json({ error: 'Invalid analytics batch' }, { status: 400 });
    }

    const mergedCounts = mergeCounts(counts);
    const pageViews = mergedCounts.find(
      (count) => count.metric === 'page_view' && count.bucket === 'all'
    )?.count ?? 0;
    const country = countryFromRequest(request);
    if (country && pageViews > 0) {
      mergedCounts.push({ metric: 'country', bucket: country, count: pageViews });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return Response.json({ error: 'Analytics is not configured' }, { status: 503 });
    }

    const isDev = process.env.VITE_APP_ENV === 'dev';
    const rpcName = isDev ? 'increment_dev_analytics_counts' : 'record_analytics_batch';
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(isDev
        ? { p_counts: mergedCounts }
        : { p_counts: mergedCounts, p_activities: activities }),
    });

    if (!response.ok) {
      return Response.json({ error: 'Analytics write failed' }, { status: 502 });
    }

    return Response.json({ ok: true }, {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  },
};
