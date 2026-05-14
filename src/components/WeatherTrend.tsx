interface Props {
  label: string;
  value: number;
  unit: string;
  delta: number;
  deltaUnit?: string;
}

export function WeatherTrend({ label, value, unit, delta, deltaUnit = '' }: Props) {
  const absD = Math.abs(delta);
  const isNeutral = absD < 0.2;
  const isGood = isNeutral ? null : delta < 0;

  const trendColor = isNeutral ? 'text-slate-500' : isGood ? 'text-emerald-400' : 'text-red-400';
  const arrow = isNeutral ? '–' : delta > 0 ? '↑' : '↓';

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-slate-500 font-body">{label}</span>
      <div className="flex items-baseline gap-1 flex-wrap">
        <span className="text-white font-mono text-sm font-medium">{value}{unit}</span>
        <span className={`text-[11px] font-mono ${trendColor}`}>
          {arrow}{absD > 0.05 ? `${absD.toFixed(1)}${deltaUnit}` : ''}
        </span>
      </div>
    </div>
  );
}
