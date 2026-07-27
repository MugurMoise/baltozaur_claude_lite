import { FormEvent, useEffect, useState } from 'react';
import { supabase, tables } from '../lib/supabase';

interface NamedMetric {
  name: string;
  sessions?: number;
  page_views?: number;
  events: number;
}

interface DailyMetric {
  day: string;
  sessions: number;
  page_views: number;
  events: number;
}

interface AnalyticsEventRow {
  occurred_at: string;
  event_name: string;
  session_id: string;
  source: string;
  platform: string;
  device_type: string;
  metadata: Record<string, unknown> | null;
}

interface LocationMetric {
  name: string;
  country: string | null;
  region: string | null;
  city: string | null;
  sessions: number;
  events: number;
}

interface RecentActivity {
  occurred_at: string;
  event_name: string;
  session_label: string;
  source: string;
  platform: string;
  device_type: string;
  location: string | null;
  lake_name: string | null;
}

interface AnalyticsDetails {
  located_sessions: number;
  locations: LocationMetric[];
  recent_activity: RecentActivity[];
}

interface AnalyticsExclusion {
  ip_hash: string;
  label: string | null;
  created_at: string;
}

interface CurrentVisitorContext {
  ip_hash: string | null;
}

interface AnalyticsSummary {
  totals: {
    sessions: number;
    page_views: number;
    events: number;
    engaged_sessions: number;
  };
  sources: NamedMetric[];
  platforms: NamedMetric[];
  events: NamedMetric[];
  campaigns: NamedMetric[];
  top_lakes: NamedMetric[];
  daily: DailyMetric[];
}

const emptySummary: AnalyticsSummary = {
  totals: { sessions: 0, page_views: 0, events: 0, engaged_sessions: 0 },
  sources: [],
  platforms: [],
  events: [],
  campaigns: [],
  top_lakes: [],
  daily: [],
};

const emptyDetails: AnalyticsDetails = {
  located_sessions: 0,
  locations: [],
  recent_activity: [],
};

const eventLabels: Record<string, string> = {
  page_view: 'Vizualizare pagină',
  lake_details_opened: 'Detalii baltă deschise',
  shared_lake_opened: 'Link de baltă deschis',
  navigation_clicked: 'Navigare pornită',
  share_link_copied: 'Link copiat',
  website_clicked: 'Site baltă deschis',
  phone_clicked: 'Telefon apăsat',
  search_used: 'Căutare folosită',
  filter_changed: 'Filtru schimbat',
  map_opened: 'Hartă deschisă',
  location_requested: 'Locație solicitată',
  location_granted: 'Locație acceptată',
  location_denied: 'Locație refuzată',
  data_refreshed: 'Date actualizate',
  forecast_day_selected: 'Zi de prognoză selectată',
  language_changed: 'Limbă schimbată',
  list_opened: 'Listă deschisă',
  view_mode_changed: 'Mod de afișare schimbat',
};

const sourceLabels: Record<string, string> = {
  direct: 'Acces direct',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  instagram: 'Instagram',
  google: 'Google',
  youtube: 'YouTube',
};

const platformLabels: Record<string, string> = {
  web: 'Web',
  ios_app: 'Aplicație iOS',
  android_app: 'Aplicație Android',
};

function number(value: number | undefined) {
  return new Intl.NumberFormat('ro-RO').format(value ?? 0);
}

function percentage(value: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function labelFor(name: string, labels: Record<string, string>) {
  return labels[name] ?? name.replace(/_/g, ' ');
}

function metadataText(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildAnalyticsDetails(rows: AnalyticsEventRow[]): AnalyticsDetails {
  const locations = new Map<string, {
    country: string | null;
    region: string | null;
    city: string | null;
    sessions: Set<string>;
    events: number;
  }>();
  const locatedSessions = new Set<string>();

  for (const row of rows) {
    const country = metadataText(row.metadata, 'geo_country');
    const region = metadataText(row.metadata, 'geo_region');
    const city = metadataText(row.metadata, 'geo_city');
    if (!country && !region && !city) continue;

    locatedSessions.add(row.session_id);
    const key = [country, region, city].join('|');
    const current = locations.get(key) ?? {
      country,
      region,
      city,
      sessions: new Set<string>(),
      events: 0,
    };
    current.sessions.add(row.session_id);
    current.events += 1;
    locations.set(key, current);
  }

  return {
    located_sessions: locatedSessions.size,
    locations: Array.from(locations.values())
      .map((location) => ({
        name: [location.city, location.region, location.country].filter(Boolean).join(' · '),
        country: location.country,
        region: location.region,
        city: location.city,
        sessions: location.sessions.size,
        events: location.events,
      }))
      .sort((a, b) => b.sessions - a.sessions || b.events - a.events)
      .slice(0, 20),
    recent_activity: rows.slice(0, 40).map((row) => {
      const country = metadataText(row.metadata, 'geo_country');
      const region = metadataText(row.metadata, 'geo_region');
      const city = metadataText(row.metadata, 'geo_city');
      return {
        occurred_at: row.occurred_at,
        event_name: row.event_name,
        session_label: row.session_id.slice(0, 8),
        source: row.source,
        platform: row.platform,
        device_type: row.device_type,
        location: [city, region, country].filter(Boolean).join(' · ') || null,
        lake_name: metadataText(row.metadata, 'lake_name'),
      };
    }),
  };
}

function activityDate(value: string) {
  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function normaliseIp(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return trimmed.slice(1, -1);
  return trimmed;
}

function isValidIp(value: string) {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return value.split('.').every((part) => Number(part) >= 0 && Number(part) <= 255);
  }
  return value.includes(':') && /^[0-9a-f:.]+$/.test(value);
}

async function hashIp(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function MetricList({
  rows,
  labels = {},
  total,
  valueKey = 'events',
  emptyText,
}: {
  rows: NamedMetric[];
  labels?: Record<string, string>;
  total: number;
  valueKey?: 'sessions' | 'page_views' | 'events';
  emptyText: string;
}) {
  if (rows.length === 0) return <p className="mt-4 text-sm text-slate-500">{emptyText}</p>;

  return (
    <div className="mt-4 space-y-3">
      {rows.map((row) => {
        const value = row[valueKey] ?? 0;
        return (
          <div key={row.name}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-slate-200">{labelFor(row.name, labels)}</span>
              <span className="shrink-0 text-slate-400">{number(value)} · {percentage(value, total)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-lime-300"
                style={{ width: `${Math.max(2, total ? (value / total) * 100 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AdminAnalyticsPanel({ environment }: { environment: string }) {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<AnalyticsSummary>(emptySummary);
  const [details, setDetails] = useState<AnalyticsDetails>(emptyDetails);
  const [exclusions, setExclusions] = useState<AnalyticsExclusion[]>([]);
  const [excludedIp, setExcludedIp] = useState('');
  const [exclusionLabel, setExclusionLabel] = useState('');
  const [exclusionMessage, setExclusionMessage] = useState<string | null>(null);
  const [savingExclusion, setSavingExclusion] = useState(false);
  const [savingOwnIp, setSavingOwnIp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAnalytics() {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const [summaryResult, eventsResult, exclusionsResult] = await Promise.all([
      supabase.rpc('get_analytics_summary', {
        p_days: days,
        p_environment: environment,
      }),
      supabase
        .from('analytics_events')
        .select('occurred_at, event_name, session_id, source, platform, device_type, metadata')
        .eq('app_environment', environment)
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: false })
        .limit(2000),
      supabase
        .from(tables.analyticsExcludedIps)
        .select('ip_hash, label, created_at')
        .order('created_at', { ascending: false }),
    ]);

    setLoading(false);
    if (summaryResult.error) {
      setError(summaryResult.error.message === 'Admin access required'
        ? 'Contul autentificat nu are acces în public.admin_users.'
        : `${summaryResult.error.message}. Verifică dacă migrația de analytics a fost aplicată în Supabase.`);
      return;
    }

    if (eventsResult.error) {
      setError(`Sumarul este disponibil, dar activitatea detaliată nu poate fi încărcată: ${eventsResult.error.message}`);
      setDetails(emptyDetails);
    } else {
      setDetails(buildAnalyticsDetails((eventsResult.data ?? []) as AnalyticsEventRow[]));
    }

    if (exclusionsResult.error) {
      setExclusionMessage(`Lista IP-urilor excluse nu este disponibilă: ${exclusionsResult.error.message}`);
    } else {
      setExclusions((exclusionsResult.data ?? []) as AnalyticsExclusion[]);
    }

    setSummary((summaryResult.data as AnalyticsSummary | null) ?? emptySummary);
  }

  useEffect(() => {
    void loadAnalytics();
  }, [days, environment]);

  const engagementRate = percentage(summary.totals.engaged_sessions, summary.totals.sessions);
  const maxDailySessions = Math.max(1, ...summary.daily.map((row) => row.sessions));
  const locationCoverage = percentage(details.located_sessions, summary.totals.sessions);

  async function saveExclusion(ipHash: string, label: string | null) {
    if (!supabase) return;
    const { data, error: insertError } = await supabase
      .from(tables.analyticsExcludedIps)
      .insert({
        ip_hash: ipHash,
        label,
      })
      .select('ip_hash, label, created_at')
      .single();

    if (insertError) {
      setExclusionMessage(insertError.code === '23505'
        ? 'Acest IP este deja exclus.'
        : insertError.message);
      return;
    }

    setExclusions((current) => [data as AnalyticsExclusion, ...current]);
    setExclusionMessage('IP-ul a fost exclus. Evenimentele deja înregistrate rămân în sumar.');
  }

  async function addExclusion(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    const normalised = normaliseIp(excludedIp);
    if (!isValidIp(normalised)) {
      setExclusionMessage('Introdu o adresă IPv4 sau IPv6 validă.');
      return;
    }

    setSavingExclusion(true);
    setExclusionMessage(null);
    const ipHash = await hashIp(normalised);
    await saveExclusion(ipHash, exclusionLabel.trim() || null);
    setSavingExclusion(false);
    setExcludedIp('');
    setExclusionLabel('');
  }

  async function excludeOwnIp() {
    setSavingOwnIp(true);
    setExclusionMessage(null);

    try {
      const response = await fetch('/api/visitor-context', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('IP-ul curent nu a putut fi identificat.');

      const context = await response.json() as CurrentVisitorContext;
      if (!context.ip_hash || !/^[0-9a-f]{64}$/.test(context.ip_hash)) {
        throw new Error('IP-ul curent nu este disponibil în acest mediu.');
      }

      await saveExclusion(context.ip_hash, 'IP-ul meu');
    } catch (ownIpError) {
      setExclusionMessage(ownIpError instanceof Error
        ? ownIpError.message
        : 'IP-ul curent nu a putut fi exclus.');
    } finally {
      setSavingOwnIp(false);
    }
  }

  async function deleteExclusion(ipHash: string) {
    if (!supabase) return;
    setExclusionMessage(null);
    const { error: deleteError } = await supabase
      .from(tables.analyticsExcludedIps)
      .delete()
      .eq('ip_hash', ipHash);

    if (deleteError) {
      setExclusionMessage(deleteError.message);
      return;
    }

    setExclusions((current) => current.filter((exclusion) => exclusion.ip_hash !== ipHash));
    setExclusionMessage('Excluderea a fost eliminată.');
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Utilizare și surse de trafic</h2>
          <p className="mt-1 text-sm text-slate-400">
            Sesiuni anonime, fără IP, adresă completă de referință sau textul căutărilor.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="h-10 rounded-lg border border-white/10 bg-mud-950/70 px-3 text-sm outline-none focus:border-lime-300"
          >
            <option value={7}>Ultimele 7 zile</option>
            <option value={30}>Ultimele 30 zile</option>
            <option value={90}>Ultimele 90 zile</option>
          </select>
          <button
            type="button"
            onClick={() => void loadAnalytics()}
            disabled={loading}
            className="h-10 rounded-lg border border-white/10 px-4 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-60"
          >
            {loading ? 'Se încarcă...' : 'Actualizează'}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>
      )}

      <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div>
          <h3 className="font-semibold">IP-uri excluse din statistici</h3>
          <p className="mt-1 text-xs text-slate-500">
            IP-ul este transformat SHA-256 în browser. În baza de date se salvează numai amprenta,
            iar evenimentele noi de la acel IP sunt ignorate.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void excludeOwnIp()}
            disabled={savingOwnIp || savingExclusion}
            className="h-10 rounded-lg bg-lime-300 px-4 text-sm font-semibold text-mud-900 hover:bg-lime-200 disabled:opacity-60"
          >
            {savingOwnIp ? 'Se identifică...' : 'Exclude IP-ul meu'}
          </button>
          <span className="text-xs text-slate-500">
            IP-ul este identificat pe server și nu este afișat sau salvat în clar.
          </span>
        </div>

        <form onSubmit={addExclusion} className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
          <input
            value={excludedIp}
            onChange={(event) => setExcludedIp(event.target.value)}
            placeholder="IPv4 sau IPv6"
            aria-label="IP de exclus"
            required
            className="h-10 rounded-lg border border-white/10 bg-mud-950/70 px-3 text-sm outline-none focus:border-lime-300"
          />
          <input
            value={exclusionLabel}
            onChange={(event) => setExclusionLabel(event.target.value)}
            placeholder="Etichetă opțională, ex. Birou"
            aria-label="Etichetă IP"
            maxLength={120}
            className="h-10 rounded-lg border border-white/10 bg-mud-950/70 px-3 text-sm outline-none focus:border-lime-300"
          />
          <button
            type="submit"
            disabled={savingExclusion}
            className="h-10 rounded-lg bg-lime-300 px-4 text-sm font-semibold text-mud-900 hover:bg-lime-200 disabled:opacity-60"
          >
            {savingExclusion ? 'Se salvează...' : 'Exclude IP'}
          </button>
        </form>

        {exclusionMessage && (
          <p className="mt-3 text-sm text-amber-100">{exclusionMessage}</p>
        )}

        {exclusions.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {exclusions.map((exclusion) => (
              <div
                key={exclusion.ip_hash}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-mud-950/45 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-200">{exclusion.label || 'IP fără etichetă'}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                    hash {exclusion.ip_hash.slice(0, 12)}… · {activityDate(exclusion.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteExclusion(exclusion.ip_hash)}
                  className="shrink-0 rounded-lg border border-red-300/20 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-500/10"
                >
                  Elimină
                </button>
              </div>
            ))}
          </div>
        )}
      </article>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Sesiuni', number(summary.totals.sessions), 'Vizite anonime'],
          ['Vizualizări', number(summary.totals.page_views), 'Pagini încărcate'],
          ['Interacțiuni', number(Math.max(0, summary.totals.events - summary.totals.page_views)), 'Acțiuni în aplicație'],
          ['Sesiuni implicate', engagementRate, `${number(summary.totals.engaged_sessions)} sesiuni cu acțiuni`],
        ].map(([title, value, subtitle]) => (
          <article key={title} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{title}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Localizarea vizitatorilor</h3>
              <p className="mt-1 text-xs text-slate-500">
                Oraș și regiune aproximative, fără IP sau coordonate GPS.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-lime-300/10 px-2.5 py-1 text-xs text-lime-200">
              {locationCoverage} acoperire
            </span>
          </div>

          {details.locations.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Localizarea va apărea pentru evenimentele înregistrate după activarea noii versiuni.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="pb-2 font-medium">Locație</th>
                    <th className="px-3 pb-2 text-right font-medium">Sesiuni</th>
                    <th className="pb-2 text-right font-medium">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {details.locations.map((location) => (
                    <tr key={`${location.country}-${location.region}-${location.city}`}>
                      <td className="py-2.5 pr-3 text-slate-200">{location.name}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{number(location.sessions)}</td>
                      <td className="py-2.5 text-right text-slate-500">{number(location.events)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-semibold">Activitate recentă</h3>
          <p className="mt-1 text-xs text-slate-500">
            Flux anonim de vizite și acțiuni, ordonat de la cea mai recentă.
          </p>

          {details.recent_activity.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nu există activitate pentru perioada selectată.</p>
          ) : (
            <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {details.recent_activity.map((activity, index) => (
                <div
                  key={`${activity.occurred_at}-${activity.session_label}-${activity.event_name}-${index}`}
                  className="rounded-lg border border-white/[0.07] bg-mud-950/45 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">
                        {labelFor(activity.event_name, eventLabels)}
                        {activity.lake_name ? ` · ${activity.lake_name}` : ''}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        Sesiune {activity.session_label} · {labelFor(activity.source, sourceLabels)}
                        {' · '}{labelFor(activity.platform, platformLabels)} / {activity.device_type}
                      </p>
                      {activity.location && (
                        <p className="mt-1 truncate text-xs text-lime-200/70">⌖ {activity.location}</p>
                      )}
                    </div>
                    <time className="shrink-0 text-xs text-slate-500" dateTime={activity.occurred_at}>
                      {activityDate(activity.occurred_at)}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-semibold">Surse de accesare</h3>
          <p className="mt-1 text-xs text-slate-500">UTM, TikTok/Facebook/Google click ID și domeniul de referință.</p>
          <MetricList
            rows={summary.sources}
            labels={sourceLabels}
            total={summary.totals.sessions}
            valueKey="sessions"
            emptyText="Datele vor apărea după primele accesări."
          />
        </article>

        <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-semibold">Platforme</h3>
          <p className="mt-1 text-xs text-slate-500">Web, aplicația iOS sau aplicația Android.</p>
          <MetricList
            rows={summary.platforms}
            labels={platformLabels}
            total={summary.totals.sessions}
            valueKey="sessions"
            emptyText="Nu există încă date despre platforme."
          />
        </article>

        <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-semibold">Acțiuni populare</h3>
          <MetricList
            rows={summary.events}
            labels={eventLabels}
            total={Math.max(1, summary.totals.events - summary.totals.page_views)}
            emptyText="Nu există încă interacțiuni."
          />
        </article>

        <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-semibold">Bălți cu interes</h3>
          <p className="mt-1 text-xs text-slate-500">Detalii, navigare, distribuire și contact.</p>
          <MetricList
            rows={summary.top_lakes}
            total={summary.top_lakes.reduce((sum, row) => sum + row.events, 0)}
            emptyText="Interesul pentru bălți va apărea după primele acțiuni."
          />
        </article>
      </div>

      <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <h3 className="font-semibold">Evoluția sesiunilor</h3>
        {summary.daily.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nu există date pentru perioada selectată.</p>
        ) : (
          <div className="mt-5 flex h-44 items-end gap-1.5 overflow-x-auto border-b border-white/10 pb-1">
            {summary.daily.map((row) => (
              <div key={row.day} className="group flex h-full min-w-5 flex-1 items-end" title={`${row.day}: ${row.sessions} sesiuni`}>
                <div
                  className="w-full rounded-t bg-lime-300/75 transition group-hover:bg-lime-200"
                  style={{ height: `${Math.max(3, (row.sessions / maxDailySessions) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        )}
      </article>

      {summary.campaigns.length > 0 && (
        <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-semibold">Campanii UTM</h3>
          <MetricList
            rows={summary.campaigns}
            total={summary.campaigns.reduce((sum, row) => sum + (row.sessions ?? 0), 0)}
            valueKey="sessions"
            emptyText="Nu există campanii UTM în perioada selectată."
          />
        </article>
      )}
    </section>
  );
}
