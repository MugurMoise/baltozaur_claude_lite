import { useState } from 'react';
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

type Tab    = 'list' | 'map';
type Filter = 'all' | 'excellent' | 'improving';

export default function App() {
  const [lang, setLang] = useState<Lang>('ro');
  const tr = t[lang];
  const locale = getLocale(lang);

  const {
    lakes, loading, error, lastUpdated, refreshing,
    availableDays, selectedDay, setSelectedDay, refresh,
  } = useLakes();

  const [tab, setTab]       = useState<Tab>('list');
  const [filter, setFilter] = useState<Filter>('all');

  const today   = new Date().toISOString().slice(0, 10);
  const isToday = selectedDay === today;

  const filtered = lakes.filter((l) => {
    if (filter === 'excellent') return l.score >= 55;
    if (filter === 'improving') return (l.pressure_delta ?? 0) < -0.5 || (l.temperature_delta ?? 0) < -0.2;
    return true;
  });

  const forecastDateLabel = (() => {
    if (!selectedDay) return '';
    const [y, m, d] = selectedDay.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  })();

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
                <LakeMap lakes={lakes} />
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
                    <span className="capitalize">
                      {isToday ? tr.topLakesToday : `${tr.forecastTitle} ${forecastDateLabel}`}
                    </span>
                  </h2>

                  {/* Lake cards */}
                  <div className="space-y-4">
                    {filtered.length > 0 ? (
                      filtered.map((lake, i) => (
                        <LakeCard key={lake.id} lake={lake} rank={i + 1} lang={lang} />
                      ))
                    ) : (
                      <div className="text-center py-16 text-slate-500 font-body">
                        <p className="text-4xl mb-4">🎣</p>
                        <p className="text-lg">{tr.noLakes}</p>
                      </div>
                    )}
                  </div>

                  {/* Best feeding windows */}
                  <BestFeedingSection lakes={lakes} lang={lang} />
                </>
              )}

              <footer className="text-center py-8 text-xs text-slate-700 font-body">
                Baltozaur · baltozaur.ro
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
