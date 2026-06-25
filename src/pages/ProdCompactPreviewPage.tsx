import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getLocalDateKey } from '../lib/date';

type ProdPreviewRow = {
  id: string;
  lake_id: string;
  score: number;
  pressure: number | null;
  wind_speed: number | null;
  temperature: number | null;
  precipitation: number | null;
  rain_hours: number | null;
  pressure_delta: number | null;
  temperature_delta: number | null;
  feeding_windows: string[] | null;
  calculated_at: string;
  lakes: {
    name: string | null;
    county: string | null;
    region: string | null;
    country: string | null;
    lat: number | null;
    lon: number | null;
    website_url: string | null;
    facebook_url: string | null;
    phone: string | null;
    price: string | null;
    rules: string | null;
  } | null;
};

function scoreColor(score: number) {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

function scoreLabel(score: number) {
  if (score >= 85) return 'Excelent';
  if (score >= 70) return 'Foarte bun';
  if (score >= 55) return 'Conditii bune';
  if (score >= 40) return 'Acceptabil';
  if (score >= 25) return 'Slab';
  return 'Evita azi';
}

function windLabel(speedKmh: number | null) {
  if (speedKmh == null) return 'necunoscut';
  if (speedKmh < 4) return 'slab';
  if (speedKmh <= 18) return 'moderat';
  if (speedKmh <= 25) return 'tare';
  return 'foarte tare';
}

function waterEstimate(airTemp: number | null) {
  if (airTemp == null) return null;
  return Math.round((airTemp - 2.2) * 10) / 10;
}

function bucketFromFeedingWindows(windows: string[] | null) {
  const fallback = '18:00-00:00';
  if (!windows?.length) return fallback;
  const candidate = windows.find((window) => /bun|excelent/i.test(window)) ?? windows[0];
  const match = candidate.match(/(\d{1,2})(?::\d{2})?/);
  const start = match ? Number(match[1]) : 18;
  if (start < 6) return '00:00-06:00';
  if (start < 12) return '06:00-12:00';
  if (start < 18) return '12:00-18:00';
  return '18:00-00:00';
}

function formatSite(url: string | null) {
  if (!url) return null;
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

function uniqueLatestByLake(rows: ProdPreviewRow[]) {
  const byLake = new Map<string, ProdPreviewRow>();
  for (const row of rows) {
    if (!byLake.has(row.lake_id)) byLake.set(row.lake_id, row);
  }
  return Array.from(byLake.values());
}

async function fetchProdRows() {
  if (!supabase) return [];
  const today = getLocalDateKey();
  const startOf = `${today}T00:00:00`;
  const endOf = `${today}T23:59:59`;
  const selection = `
    id,
    lake_id,
    score,
    pressure,
    wind_speed,
    temperature,
    precipitation,
    rain_hours,
    pressure_delta,
    temperature_delta,
    feeding_windows,
    calculated_at,
    lakes (
      name,
      county,
      region,
      country,
      lat,
      lon,
      website_url,
      facebook_url,
      phone,
      price,
      rules
    )
  `;

  const todayResult = await supabase
    .from('lake_scores')
    .select(selection)
    .gte('calculated_at', startOf)
    .lte('calculated_at', endOf)
    .order('score', { ascending: false })
    .limit(24);

  if (todayResult.error) throw todayResult.error;
  if (todayResult.data?.length) return todayResult.data as unknown as ProdPreviewRow[];

  const latestResult = await supabase
    .from('lake_scores')
    .select(selection)
    .order('calculated_at', { ascending: false })
    .limit(200);

  if (latestResult.error) throw latestResult.error;
  return uniqueLatestByLake((latestResult.data ?? []) as unknown as ProdPreviewRow[])
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);
}

function ProdCompactCard({ row }: { row: ProdPreviewRow }) {
  const lake = row.lakes;
  const color = scoreColor(row.score);
  const period = bucketFromFeedingWindows(row.feeding_windows);
  const siteUrl = lake?.website_url ?? lake?.facebook_url ?? null;
  const siteLabel = formatSite(siteUrl) ?? 'indisponibil';
  const phone = lake?.phone?.split(/[,/]/)[0]?.trim() ?? null;
  const lat = lake?.lat ?? 0;
  const lon = lake?.lon ?? 0;
  const waterTemp = waterEstimate(row.temperature);
  const rainLabel = (row.precipitation ?? 0) > 0
    ? `${row.precipitation} mm`
    : 'fara ploaie';

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-cyan-700/10 shadow-xl">
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border-2"
            style={{ borderColor: color, background: `${color}18` }}
          >
            <span className="font-mono text-lg font-bold leading-none" style={{ color }}>
              {Math.round(row.score)}
            </span>
            <span className="mt-0.5 text-[9px] uppercase tracking-widest" style={{ color }}>
              scor
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg leading-tight tracking-wide text-white">
              {lake?.name ?? 'Balta fara nume'}
            </h2>
            <p className="truncate text-xs text-slate-400">
              {lake?.region ?? lake?.county ?? lake?.country ?? 'Locatie necunoscuta'}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-200">{scoreLabel(row.score)}</span>
              <span className="h-1 w-1 rounded-full bg-slate-600" />
              <span className="text-xs text-slate-400">{rainLabel}</span>
            </div>
          </div>
        </div>

        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <span className="min-w-0 truncate text-[10px] uppercase tracking-wider text-slate-500">
              Perioada recomandata
            </span>
            <span className="shrink-0 font-mono text-xs font-semibold text-white">{period}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
              <span className="block truncate text-[10px] uppercase tracking-wider text-slate-500">Vant</span>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-[11px] text-slate-300">{windLabel(row.wind_speed)}</span>
                <span className="shrink-0 font-mono text-xs font-semibold text-white">
                  {row.wind_speed == null ? '-' : `${Math.round(row.wind_speed)} km/h`}
                </span>
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
              <span className="block truncate text-[10px] uppercase tracking-wider text-slate-500">Temperatura</span>
              <div className="mt-0.5 space-y-0.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] text-slate-300">aer</span>
                  <span className="font-mono text-xs font-semibold text-white">
                    {row.temperature == null ? '-' : `${Math.round(row.temperature)}°C`}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] text-slate-300">apa est.</span>
                  <span className="font-mono text-xs font-semibold text-cyan-100">
                    {waterTemp == null ? '-' : `${waterTemp}°C`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 transition-all hover:bg-white/[0.07]"
          >
            <span className="block truncate text-[10px] uppercase tracking-wider text-slate-500">Locatie</span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-slate-200">Harta</span>
          </a>
          <a
            href={phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : undefined}
            className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 transition-all hover:bg-white/[0.07]"
          >
            <span className="block truncate text-[10px] uppercase tracking-wider text-slate-500">Telefon</span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-slate-200">{phone ?? 'indisponibil'}</span>
          </a>
          <a
            href={siteUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 transition-all hover:bg-white/[0.07]"
          >
            <span className="block truncate text-[10px] uppercase tracking-wider text-slate-500">Site</span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-slate-200">{siteLabel}</span>
          </a>
        </div>
      </div>
    </article>
  );
}

export function ProdCompactPreviewPage() {
  const [rows, setRows] = useState<ProdPreviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchProdRows()
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Nu s-au putut incarca datele prod.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const latestDate = useMemo(() => rows[0]?.calculated_at?.slice(0, 10) ?? getLocalDateKey(), [rows]);

  return (
    <div className="min-h-screen bg-mud-900 px-4 py-5 text-white font-body">
      <main className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Preview local cu prod</p>
            <h1 className="font-display text-2xl tracking-wide">Card compact pe lacuri reale</h1>
          </div>
          <p className="text-xs text-slate-500">{latestDate} · tabele prod</p>
        </div>

        {loading && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
            Se incarca lacurile din prod...
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((row) => (
              <ProdCompactCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
