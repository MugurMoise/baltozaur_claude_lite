import { getScoreBg, getScoreLabel } from '../types/lake';
import type { Lang } from '../i18n';

interface Props {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  lang: Lang;
}

export function ScoreBadge({ score, size = 'md', lang }: Props) {
  const colorClass = getScoreBg(score);
  const label = getScoreLabel(score, lang);
  const sizeClass = size === 'lg' ? 'text-base px-3 py-1' : size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-body font-medium ${colorClass} ${sizeClass}`}>
      <span className="font-mono font-semibold">{Math.round(score)}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}
