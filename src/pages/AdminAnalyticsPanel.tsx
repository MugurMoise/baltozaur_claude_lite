import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAnalytics() {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('get_analytics_summary', {
      p_days: days,
      p_environment: environment,
    });

    setLoading(false);
    if (rpcError) {
      setError(`${rpcError.message}. Verifică dacă migrația de analytics a fost aplicată în Supabase.`);
      return;
    }

    setSummary((data as AnalyticsSummary | null) ?? emptySummary);
  }

  useEffect(() => {
    void loadAnalytics();
  }, [days, environment]);

  const engagementRate = percentage(summary.totals.engaged_sessions, summary.totals.sessions);
  const maxDailySessions = Math.max(1, ...summary.daily.map((row) => row.sessions));

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
