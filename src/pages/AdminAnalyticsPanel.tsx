import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface NamedMetric {
  name: string;
  events: number;
}

interface DailyMetric {
  day: string;
  page_views: number;
  interactions: number;
}

interface AnalyticsSummary {
  totals: {
    page_views: number;
    interactions: number;
  };
  sources: NamedMetric[];
  platforms: NamedMetric[];
  countries: NamedMetric[];
  events: NamedMetric[];
  top_lakes: NamedMetric[];
  daily: DailyMetric[];
}

const emptySummary: AnalyticsSummary = {
  totals: { page_views: 0, interactions: 0 },
  sources: [],
  platforms: [],
  countries: [],
  events: [],
  top_lakes: [],
  daily: [],
};

const eventLabels: Record<string, string> = {
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
  bing: 'Bing',
  other: 'Altă sursă',
};

const platformLabels: Record<string, string> = {
  web: 'Web',
  ios_app: 'Aplicație iOS',
  android_app: 'Aplicație Android',
};

const regionNames = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['ro'], { type: 'region' })
  : null;

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

function countryLabel(countryCode: string) {
  try {
    return regionNames?.of(countryCode) ?? countryCode;
  } catch {
    return countryCode;
  }
}

function MetricList({
  rows,
  labels = {},
  total,
  emptyText,
}: {
  rows: NamedMetric[];
  labels?: Record<string, string>;
  total: number;
  emptyText: string;
}) {
  if (rows.length === 0) return <p className="mt-4 text-sm text-slate-500">{emptyText}</p>;

  return (
    <div className="mt-4 space-y-3">
      {rows.map((row) => (
        <div key={row.name}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-slate-200">{labelFor(row.name, labels)}</span>
            <span className="shrink-0 text-slate-400">
              {number(row.events)} · {percentage(row.events, total)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-lime-300"
              style={{ width: `${Math.max(2, total ? (row.events / total) * 100 : 0)}%` }}
            />
          </div>
        </div>
      ))}
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

    const { data, error: loadError } = await supabase.rpc('get_dev_aggregate_analytics', {
      p_days: days,
    });

    setLoading(false);
    if (loadError) {
      setError(loadError.message === 'Admin access required'
        ? 'Contul autentificat nu are acces în public.admin_users.'
        : `${loadError.message}. Verifică dacă migrația de analytics agregat a fost aplicată în Supabase.`);
      return;
    }

    setSummary((data as AnalyticsSummary | null) ?? emptySummary);
  }

  useEffect(() => {
    void loadAnalytics();
  }, [days, environment]);

  const maxDailyTotal = Math.max(
    1,
    ...summary.daily.map((row) => row.page_views + row.interactions)
  );
  const totalLakeInterest = summary.top_lakes.reduce((sum, row) => sum + row.events, 0);

  return (
    <section className="mt-5 space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Utilizare și surse de trafic</h2>
          <p className="mt-1 text-sm text-slate-400">
            Statistici zilnice agregate, fără IP, identificator de utilizator, sesiune sau activitate individuală.
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

      <article className="rounded-lg border border-lime-300/20 bg-lime-300/[0.06] p-4">
        <p className="text-sm text-lime-100">
          Browserul grupează acțiunile timp de 8 secunde. Un lot produce un singur apel către baza de date,
          indiferent câte acțiuni duplicate conține. Panoul Admin se încarcă printr-un singur RPC.
        </p>
      </article>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Vizualizări', number(summary.totals.page_views), 'Pagini încărcate'],
          ['Interacțiuni', number(summary.totals.interactions), 'Acțiuni în aplicație'],
          ['Model de date', 'Agregat', 'Numai contoare zilnice'],
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
          <p className="mt-1 text-xs text-slate-500">
            Categorii fixe din UTM, click ID sau referrer; domeniul și campania nu sunt salvate.
          </p>
          <MetricList
            rows={summary.sources}
            labels={sourceLabels}
            total={summary.totals.page_views}
            emptyText="Datele vor apărea după primele accesări."
          />
        </article>

        <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-semibold">Platforme</h3>
          <p className="mt-1 text-xs text-slate-500">Web, aplicația iOS sau aplicația Android.</p>
          <MetricList
            rows={summary.platforms}
            labels={platformLabels}
            total={summary.totals.page_views}
            emptyText="Nu există încă date despre platforme."
          />
        </article>

        <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-semibold">Țările vizitatorilor</h3>
          <p className="mt-1 text-xs text-slate-500">
            Numai țara aproximativă; o țară apare după minimum 10 vizualizări în perioada selectată.
          </p>
          <MetricList
            rows={summary.countries.map((row) => ({ ...row, name: countryLabel(row.name) }))}
            total={summary.totals.page_views}
            emptyText="Nu există încă suficiente vizualizări pentru afișarea țărilor."
          />
        </article>

        <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-semibold">Acțiuni populare</h3>
          <MetricList
            rows={summary.events}
            labels={eventLabels}
            total={summary.totals.interactions}
            emptyText="Nu există încă interacțiuni."
          />
        </article>

        <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5 lg:col-span-2">
          <h3 className="font-semibold">Bălți cu interes</h3>
          <p className="mt-1 text-xs text-slate-500">
            Total agregat pentru detalii, navigare, distribuire și contact.
          </p>
          <MetricList
            rows={summary.top_lakes}
            total={totalLakeInterest}
            emptyText="Interesul pentru bălți va apărea după primele acțiuni."
          />
        </article>
      </div>

      <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <h3 className="font-semibold">Evoluție zilnică</h3>
        <p className="mt-1 text-xs text-slate-500">Vizualizări și interacțiuni, cumulate pe zi.</p>
        {summary.daily.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nu există date pentru perioada selectată.</p>
        ) : (
          <div className="mt-5 flex h-44 items-end gap-1.5 overflow-x-auto border-b border-white/10 pb-1">
            {summary.daily.map((row) => {
              const total = row.page_views + row.interactions;
              return (
                <div
                  key={row.day}
                  className="group flex h-full min-w-5 flex-1 items-end"
                  title={`${row.day}: ${row.page_views} vizualizări, ${row.interactions} interacțiuni`}
                >
                  <div
                    className="w-full rounded-t bg-lime-300/75 transition group-hover:bg-lime-200"
                    style={{ height: `${Math.max(3, (total / maxDailyTotal) * 100)}%` }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
