import { useEffect, useMemo, useState } from 'react';
import { useLakes } from './hooks/useLakes';
import type { Lang } from './i18n';
import { getLocale, t } from './i18n';
import { DashboardHeader } from './components/DashboardHeader';
import { DaySelector } from './components/DaySelector';
import { LakeCard } from './components/LakeCard';
import { LakeMap } from './components/LakeMap';
import { StatsBar } from './components/StatsBar';
import { BestFeedingSection } from './components/BestFeedingSection';
import { HowItWorks } from './components/HowItWorks';
import { getLocalDateKey } from './lib/date';
import { createLakeCodeMap } from './lib/lakeLinks';
import { SocialSignalsPage } from './pages/SocialSignalsPage';
import { AddLakePage } from './pages/AddLakePage';

type Tab    = 'list' | 'map';
type Filter = 'all' | 'excellent' | 'improving';
type AreaMode = 'county' | 'distance';
type UserLocation = { lat: number; lon: number };

function distanceBetweenKm(from: UserLocation, to: UserLocation) {
  const earthRadiusKm = 6371;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function App() {
  if (window.location.pathname.startsWith('/social')) {
    return <SocialSignalsPage />;
  }
  if (window.location.pathname.startsWith('/suggest-lake') || window.location.pathname.startsWith('/add-lake')) {
    return <AddLakePage />;
  }

  return <DashboardApp />;
}

function DashboardApp() {
  const [lang, setLang] = useState<Lang>('ro');
  const tr = t[lang];
  const locale = getLocale(lang);

  const {
    lakes, loading, error, lastUpdated, refreshing,
    availableDays, selectedDay, setSelectedDay, refresh,
  } = useLakes();

  const [tab, setTab]       = useState<Tab>('list');
  const [filter, setFilter] = useState<Filter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [areaMode, setAreaMode] = useState<AreaMode>('county');
  const [selectedCounty, setSelectedCounty] = useState('all');
  const [maxDistanceKm, setMaxDistanceKm] = useState(75);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'denied'>('idle');

  const today   = getLocalDateKey();
  const isToday = selectedDay === today;
  const linkedLakeParam = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('l') ?? params.get('lake');
  }, []);
  const lakeCodes = useMemo(() => createLakeCodeMap(lakes), [lakes]);

  const counties = useMemo(() => {
    return Array.from(new Set(lakes.map((lake) => lake.county).filter(Boolean))).sort((a, b) => (
      a.localeCompare(b, locale)
    ));
  }, [lakes, locale]);

  const filtered = lakes.filter((lake) => {
    const query = searchQuery.trim().toLowerCase();
    if (query && !`${lake.name} ${lake.county}`.toLowerCase().includes(query)) return false;

    if (areaMode === 'county' && selectedCounty !== 'all' && lake.county !== selectedCounty) return false;

    if (areaMode === 'distance') {
      if (!userLocation) return false;
      const distance = distanceBetweenKm(userLocation, { lat: lake.lat, lon: lake.lon });
      if (distance > maxDistanceKm) return false;
    }

    if (filter === 'excellent') return lake.score >= 55;
    if (filter === 'improving') return (lake.pressure_delta ?? 0) < -0.5 || (lake.temperature_delta ?? 0) < -0.2;
    return true;
  });

  const visibleLakes = useMemo(() => {
    if (!linkedLakeParam) return filtered;
    const linkedLake = filtered.find((lake) => (
      lake.lake_id === linkedLakeParam ||
      lake.id === linkedLakeParam ||
      lakeCodes.get(lake.lake_id) === linkedLakeParam
    ));
    if (!linkedLake) return filtered;
    return [linkedLake, ...filtered.filter((lake) => lake.lake_id !== linkedLake.lake_id)];
  }, [filtered, lakeCodes, linkedLakeParam]);

  useEffect(() => {
    if (!linkedLakeParam || loading) return;
    const timeout = window.setTimeout(() => {
      const selector = `[data-lake-code="${linkedLakeParam}"], #lake-${linkedLakeParam}`;
      document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [linkedLakeParam, loading]);

  const forecastDateLabel = (() => {
    if (!selectedDay) return '';
    const [y, m, d] = selectedDay.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  })();

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }

    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setLocationStatus('idle');
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  return (
    <div className="min-h-screen bg-mud-900 text-white font-body">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-lake-900/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-lake-800/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <DashboardHeader
          lastUpdated={lastUpdated}
          refreshing={refreshing}
          onRefresh={refresh}
          lakeCount={lakes.length}
          isToday={isToday}
          lang={lang}
          onLangChange={setLang}
        />

        <main className="max-w-2xl mx-auto px-4 py-5 space-y-5">
          {/* Error */}
          {error && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm font-body px-4 py-4 flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <span>{tr.errorLoad}</span>
            </div>
          )}

          {/* Day selector */}
          {availableDays.length > 0 && (
            <DaySelector
              days={availableDays}
              selected={selectedDay}
              lang={lang}
              onSelect={(day) => { setSelectedDay(day); setFilter('all'); }}
            />
          )}

          {/* How it works */}
          <HowItWorks lang={lang} />

          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-56 rounded-3xl bg-white/[0.03] border border-white/5 animate-pulse"
                  style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <StatsBar lakes={lakes} lang={lang} />

              <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 space-y-3">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    🔎
                  </span>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={tr.searchPlaceholder}
                    className="w-full rounded-xl border border-white/10 bg-mud-950/55 py-3 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 outline-none transition-all focus:border-lake-400/60 focus:bg-mud-950/75"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'county', label: tr.areaByCounty },
                    { key: 'distance', label: tr.areaByDistance },
                  ] as { key: AreaMode; label: string }[]).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setAreaMode(key)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                        areaMode === key
                          ? 'border-lake-500/50 bg-lake-600/25 text-white'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {areaMode === 'county' ? (
                  <select
                    value={selectedCounty}
                    onChange={(event) => setSelectedCounty(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-mud-950/70 px-3 py-3 text-sm text-white outline-none focus:border-lake-400/60"
                  >
                    <option value="all">{tr.allCounties}</option>
                    {counties.map((county) => (
                      <option key={county} value={county}>{county}</option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      {[25, 50, 75, 100].map((distance) => (
                        <button
                          key={distance}
                          onClick={() => setMaxDistanceKm(distance)}
                          className={`rounded-xl border px-2 py-2 text-sm font-semibold transition-all ${
                            maxDistanceKm === distance
                              ? 'border-lake-500/50 bg-lake-600/25 text-white'
                              : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
                          }`}
                        >
                          {distance} km
                        </button>
                      ))}
                    </div>

                    {!userLocation && (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-mud-950/45 px-3 py-3">
                        <span className="text-sm text-slate-300">
                          {locationStatus === 'denied' ? tr.locationDenied : tr.locationNeeded}
                        </span>
                        <button
                          onClick={requestLocation}
                          disabled={locationStatus === 'loading'}
                          className="shrink-0 rounded-xl border border-lake-500/40 bg-lake-600/25 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-lake-600/40 disabled:opacity-60"
                        >
                          {locationStatus === 'loading' ? '...' : tr.useMyLocation}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Tabs */}
              <div className="flex gap-1.5 bg-white/[0.03] rounded-2xl p-1.5 border border-white/8">
                {(['list', 'map'] as Tab[]).map((t_) => (
                  <button
                    key={t_}
                    onClick={() => setTab(t_)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-body font-semibold transition-all ${
                      tab === t_
                        ? 'bg-lake-600 text-white shadow-lg'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t_ === 'list' ? tr.tabLakes : tr.tabMap}
                  </button>
                ))}
              </div>

              {tab === 'map' ? (
                <LakeMap lakes={visibleLakes} />
              ) : (
                <>
                  {/* Filter chips */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {([
                      { key: 'all',       label: tr.filterAll },
                      { key: 'excellent', label: tr.filterExcellent },
                      { key: 'improving', label: tr.filterImproving },
                    ] as { key: Filter; label: string }[]).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`shrink-0 text-sm font-body font-medium px-4 py-2 rounded-2xl border transition-all ${
                          filter === key
                            ? 'bg-lake-600/30 border-lake-500/50 text-white'
                            : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Section title */}
                  <h2 className="font-display text-xl text-white tracking-wide flex items-center gap-2">
                    <span>{isToday ? '🏆' : '📅'}</span>
                    <span className="capitalize flex-1">
                      {isToday ? tr.topLakesToday : `${tr.forecastTitle} ${forecastDateLabel}`}
                    </span>
                    <span className="text-xs font-body font-normal text-slate-500">
                      {visibleLakes.length}/{lakes.length}
                    </span>
                  </h2>

                  {/* Lake cards */}
                  <div className="space-y-4">
                    {visibleLakes.length > 0 ? (
                      visibleLakes.map((lake, i) => {
                        const shareCode = lakeCodes.get(lake.lake_id);
                        const isLinkedLake = linkedLakeParam === lake.lake_id || linkedLakeParam === lake.id || linkedLakeParam === shareCode;
                        return (
                          <LakeCard
                            key={lake.id}
                            lake={lake}
                            rank={i + 1}
                            lang={lang}
                            userLocation={userLocation}
                            highlighted={isLinkedLake}
                            shareCode={shareCode}
                          />
                        );
                      })
                    ) : (
                      <div className="text-center py-16 text-slate-500 font-body">
                        <p className="text-4xl mb-4">🎣</p>
                        <p className="text-lg">{tr.noLakes}</p>
                      </div>
                    )}
                  </div>

                  {/* Best feeding windows */}
                  <BestFeedingSection lakes={visibleLakes} lang={lang} />
                </>
              )}

              <footer className="text-center py-8 text-xs text-slate-700 font-body">
                Baltozaur · baltozaur.ro ·{' '}
                <a href="/suggest-lake" className="text-slate-500 hover:text-slate-300">
                  Sugereaza o balta
                </a>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
