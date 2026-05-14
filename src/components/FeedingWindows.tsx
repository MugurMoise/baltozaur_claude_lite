import type { Lang } from '../i18n';
import { t } from '../i18n';

interface Props {
  windows: string[] | null;
  lang: Lang;
}

export function FeedingWindows({ windows, lang }: Props) {
  const tr = t[lang];

  if (!windows || windows.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-body">
        <span>🎣</span>
        <span>{tr.noWindows}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-slate-500 font-body">{tr.feedingWindows}</span>
      <div className="flex flex-wrap gap-1.5">
        {windows.map((w, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 rounded-md px-2 py-0.5 text-xs font-mono"
          >
            🕐 {w}
          </span>
        ))}
      </div>
    </div>
  );
}
