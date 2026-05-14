import type { LakeScore } from '../types/lake';
import { getScoreColor } from '../types/lake';
import type { Lang } from '../i18n';
import { t } from '../i18n';

interface Props { lakes: LakeScore[]; lang: Lang; }

export function BestFeedingSection({ lakes, lang }: Props) {
  const tr = t[lang];
  const withWindows = lakes
    .filter((l) => l.feeding_windows && l.feeding_windows.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (withWindows.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-xl text-white tracking-wider mb-3">
        {tr.bestWindows}
      </h2>
      <div className="space-y-2">
        {withWindows.map((lake) => {
          const color = getScoreColor(lake.score);
          return (
            <div key={lake.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/8 rounded-2xl px-4 py-3">
              <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-body font-semibold text-white truncate">{lake.name}</span>
                  <span className="font-mono text-sm font-bold shrink-0" style={{ color }}>{Math.round(lake.score)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {lake.feeding_windows!.map((w, i) => (
                    <span key={i} className="text-sm font-mono bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded-xl px-3 py-1">
                      🕐 {w}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
