import type { Lang } from '../i18n';
import { getLocale, langMeta, t } from '../i18n';
import { NotificationBell } from './notifications/NotificationBell';

interface Props {
  lastUpdated: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
  lakeCount: number;
  isToday: boolean;
  lang: Lang;
  onLangToggle: () => void;
}

export function DashboardHeader({ lastUpdated, refreshing, onRefresh, lakeCount, isToday, lang, onLangToggle }: Props) {
  const tr = t[lang];
  const locale = getLocale(lang);
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-mud-900/85 border-b border-white/5">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="text-3xl">🦕</span>
              {isToday && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-mud-900">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                </span>
              )}
            </div>
            <div>
              <h1 className="font-display text-3xl text-white tracking-wider leading-none">BALTOZAUR</h1>
              <p className="text-xs text-slate-500 font-body mt-0.5">{tr.appSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={onLangToggle}
              className="h-10 px-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-1.5 text-slate-300 hover:text-white hover:bg-white/10 transition-all"
            >
              <span className="text-base">{langMeta[lang].flag}</span>
              <span className="text-xs font-body font-semibold">{lang.toUpperCase()}</span>
            </button>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
              title={tr.refreshTitle}
            >
              <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Status strip */}
        <div className="mt-3 flex items-center gap-2 text-xs font-body">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isToday ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-emerald-400 animate-pulse' : 'bg-sky-400'}`} />
            {isToday ? tr.live : tr.forecast}
          </div>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">{lakeCount} {tr.lakes}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">{tr.updated} <span className="text-slate-300">{timeStr}</span></span>
        </div>
      </div>
    </header>
  );
}
