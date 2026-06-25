import type { Lang } from '../i18n';
import { getLocale, LANGUAGES, langMeta, t } from '../i18n';

type ViewMode = 'auto' | 'mobile' | 'desktop';
type EffectiveView = 'mobile' | 'desktop';

interface Props {
  lastUpdated: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
  lakeCount: number;
  isToday: boolean;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  viewMode: ViewMode;
  effectiveView: EffectiveView;
  onViewModeChange: (mode: ViewMode) => void;
}

export function DashboardHeader({
  lastUpdated,
  refreshing,
  onRefresh,
  lakeCount,
  isToday,
  lang,
  onLangChange,
  viewMode,
  effectiveView,
  onViewModeChange,
}: Props) {
  const tr = t[lang];
  const locale = getLocale(lang);
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-mud-900/85 border-b border-white/5">
      <div
        className={`${effectiveView === 'desktop' ? 'max-w-7xl' : 'max-w-2xl'} mx-auto px-3 pb-3 sm:px-4 sm:pb-4`}
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="relative">
              <img
                src="/baltozaur-mark.png"
                alt="Baltozaur"
                className="h-9 w-10 object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)] sm:h-14 sm:w-16"
              />
              {isToday && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-mud-900">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl text-white tracking-wider leading-none sm:text-3xl">BALTOZAUR</h1>
              <p className="hidden text-xs text-slate-500 font-body mt-0.5 sm:block">{tr.appSubtitle}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <select
              value={viewMode}
              onChange={(event) => onViewModeChange(event.target.value as ViewMode)}
              aria-label={tr.viewMode}
              title={tr.viewMode}
              className="h-9 max-w-[68px] rounded-2xl bg-white/5 border border-white/10 pl-2 pr-5 text-[11px] font-body font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all outline-none sm:h-10 sm:max-w-none sm:pl-3 sm:pr-8 sm:text-xs"
            >
              <option value="auto">{tr.viewAuto}</option>
              <option value="mobile">{tr.viewMobile}</option>
              <option value="desktop">{tr.viewDesktop}</option>
            </select>
            <select
              value={lang}
              onChange={(event) => onLangChange(event.target.value as Lang)}
              aria-label="Language"
              className="h-9 max-w-[64px] rounded-2xl bg-white/5 border border-white/10 pl-2 pr-5 text-[11px] font-body font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all outline-none sm:h-10 sm:max-w-none sm:pl-3 sm:pr-8 sm:text-xs"
            >
              {LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {langMeta[code].flag} {code.toUpperCase()}
                </option>
              ))}
            </select>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="h-9 w-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40 sm:h-10 sm:w-10"
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
