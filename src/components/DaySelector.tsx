import { formatDay } from '../types/lake';
import type { Lang } from '../i18n';
import { t } from '../i18n';

interface Props {
  days: string[];
  selected: string;
  onSelect: (day: string) => void;
  lang: Lang;
}

export function DaySelector({ days, selected, onSelect, lang }: Props) {
  if (days.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-400 font-body px-1">{t[lang].forecastDays}:</p>
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
        {days.map((day) => {
          const { label, sub } = formatDay(day, lang);
          const isSelected = day === selected;
          const isToday    = day === today;
          const isPast     = day < today;

          return (
            <button
              key={day}
              onClick={() => onSelect(day)}
              className={`
                shrink-0 flex flex-col items-center justify-center
                rounded-2xl border px-4 py-3 min-w-[80px]
                transition-all duration-200 active:scale-95
                ${isSelected
                  ? 'bg-lake-600/50 border-lake-400/60 shadow-lg shadow-lake-900/40'
                  : isPast
                  ? 'bg-white/[0.02] border-white/5 opacity-40'
                  : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                }
              `}
            >
              <span className={`font-body font-bold text-sm leading-tight text-center ${
                isSelected ? 'text-white' : isPast ? 'text-slate-600' : 'text-slate-200'
              }`}>
                {label}
              </span>
              <span className={`font-body text-[11px] mt-1 ${
                isSelected ? 'text-lake-200' : 'text-slate-500'
              }`}>
                {sub}
              </span>
              {isToday && (
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
