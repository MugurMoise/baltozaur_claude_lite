import type { LakeScore } from '../types/lake';
import type { Lang } from '../i18n';
import { t } from '../i18n';
import { getScoreColor } from '../types/lake';

interface Props { lakes: LakeScore[]; lang: Lang; }

export function StatsBar({ lakes, lang }: Props) {
  if (lakes.length === 0) return null;
  const tr = t[lang];

  const recommended  = lakes.filter((l) => l.score >= 55).length;
  const withWindows  = lakes.filter((l) => l.feeding_windows && l.feeding_windows.length > 0).length;
  const best         = lakes.reduce((a, b) => a.score > b.score ? a : b);

  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-3xl p-4">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-mono font-bold" style={{ color: getScoreColor(best.score) }}>
            {Math.round(best.score)}
          </div>
          <div className="text-xs text-slate-500 font-body mt-1">{tr.bestScore}</div>
          <div className="text-xs text-slate-400 font-body truncate">{best.name}</div>
        </div>
        <div className="border-x border-white/10">
          <div className="text-2xl font-mono font-bold text-white">{recommended}</div>
          <div className="text-xs text-slate-500 font-body mt-1">{tr.activeLakes}</div>
          <div className="text-xs text-slate-600 font-body">din {lakes.length}</div>
        </div>
        <div>
          <div className="text-2xl font-mono font-bold text-cyan-400">{withWindows}</div>
          <div className="text-xs text-slate-500 font-body mt-1">{tr.withWindows}</div>
          <div className="text-xs text-slate-600 font-body">lacuri</div>
        </div>
      </div>
    </div>
  );
}
