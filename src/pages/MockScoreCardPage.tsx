import { computeFishingScoreV2Mock, computeLegacyCarpScoreMock } from '../lib/fishingScoreV2Mock';

const mockScore = computeFishingScoreV2Mock({
  pressureMslHpa: 1009.8,
  pressureMsl3hAgoHpa: 1011.1,
  airTempC: 21.4,
  windSpeedMs: 3.6,
  precipRateMmH: 0.1,
  precip12hMm: 1.4,
  moonIllumination01: 0.86,
  hourLocal: 19,
  month: 8,
  baitMatch01: 0.63,
  baitConfidence01: 0.8,
});

const mockLakeDetails = {
  lat: 44.318,
  lon: 25.986,
  website_url: 'https://varlaam.ro',
  facebook_url: 'https://facebook.com/varlaamlake',
  phone: '0722 123 456',
  price: '150 lei / 12h',
  rules: 'C&R recomandat',
};

const scoreColor = mockScore.score0100 >= 70 ? '#22c55e' : mockScore.score0100 >= 45 ? '#eab308' : '#ef4444';
const comparisonRows = [
  { name: 'Varlaam Lake', pressure: 1009.8, dp: -1.3, wind: 13, temp: 21.4, tempDelta: 0.8, cloud: 62, rain: 1.4, rainHours: 1, rainyWindHours: 0, hour: 19, moon: 0.86, user: undefined },
  { name: 'Hermes Peris', pressure: 1014.4, dp: 0.2, wind: 8, temp: 20.2, tempDelta: 0.4, cloud: 48, rain: 0, rainHours: 0, rainyWindHours: 0, hour: 7, moon: 0.62, user: 0.72 },
  { name: 'Lacul Peris', pressure: 1024.8, dp: 4.6, wind: 4, temp: 24.8, tempDelta: 1.1, cloud: 20, rain: 0, rainHours: 0, rainyWindHours: 0, hour: 13, moon: 0.41, user: undefined },
  { name: 'Balta Gruiu', pressure: 1007.2, dp: -3.8, wind: 22, temp: 18.6, tempDelta: -0.2, cloud: 88, rain: 2.8, rainHours: 3, rainyWindHours: 1, hour: 18, moon: 0.94, user: 0.54 },
  { name: 'Piteasca 2', pressure: 1010.5, dp: -0.6, wind: 2, temp: 16.8, tempDelta: -0.5, cloud: 35, rain: 0, rainHours: 0, rainyWindHours: 0, hour: 6, moon: 0.2, user: undefined },
  { name: 'Cozieni', pressure: 1003.4, dp: -2.2, wind: 15, temp: 23.1, tempDelta: 2.0, cloud: 74, rain: 0.2, rainHours: 1, rainyWindHours: 0, hour: 20, moon: 0.78, user: 0.81 },
  { name: 'Pasarea Tunari', pressure: 1017.1, dp: 1.8, wind: 11, temp: 27.4, tempDelta: 2.7, cloud: 55, rain: 0, rainHours: 0, rainyWindHours: 0, hour: 12, moon: 0.51, user: undefined },
  { name: 'Delta Gruiu', pressure: 996.9, dp: -7.1, wind: 19, temp: 19.7, tempDelta: -1.2, cloud: 92, rain: 4.5, rainHours: 4, rainyWindHours: 0, hour: 22, moon: 0.97, user: 0.44 },
  { name: 'Corata', pressure: 1011.6, dp: 0.0, wind: 1, temp: 13.5, tempDelta: -0.1, cloud: 8, rain: 0, rainHours: 0, rainyWindHours: 0, hour: 5, moon: 0.35, user: undefined },
  { name: 'Balta din Vale', pressure: 1020.2, dp: 3.2, wind: 29, temp: 31.4, tempDelta: 4.3, cloud: 16, rain: 0.6, rainHours: 2, rainyWindHours: 1, hour: 16, moon: 0.69, user: 0.31 },
].map((lake) => {
  const legacy = computeLegacyCarpScoreMock({
    pressure: lake.pressure,
    pressureDelta: lake.dp,
    windSpeedKmh: lake.wind,
    temperature: lake.temp,
    temperatureDelta: lake.tempDelta,
    cloudCover: lake.cloud,
    precipitation: lake.rain,
    rainHours: lake.rainHours,
    rainyWindHours: lake.rainyWindHours,
  });
  const v2 = computeFishingScoreV2Mock({
    pressureMslHpa: lake.pressure,
    pressureMsl3hAgoHpa: lake.pressure - lake.dp,
    airTempC: lake.temp,
    windSpeedMs: lake.wind / 3.6,
    precipRateMmH: lake.rainHours > 0 ? lake.rain / lake.rainHours : 0,
    precip12hMm: lake.rain,
    moonIllumination01: lake.moon,
    hourLocal: lake.hour,
    month: 8,
    baitMatch01: 0.56,
    baitConfidence01: 0.5,
    userActivity01: lake.user,
    userActivityReliability01: lake.user == null ? 0 : 0.45,
  });

  return {
    name: lake.name,
    legacy,
    v2: v2.score0100,
    confidence: v2.confidence0100,
    delta: v2.score0100 - legacy,
  };
});

function confidenceColor(confidence: number) {
  if (confidence >= 70) return 'bg-emerald-400';
  if (confidence >= 45) return 'bg-yellow-400';
  return 'bg-red-400';
}

export function MockScoreCardPage() {
  return (
    <div className="min-h-screen bg-mud-900 px-4 py-5 text-white font-body">
      <main className="mx-auto max-w-sm space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Preview local</p>
          <h1 className="font-display text-2xl tracking-wide">Card compact scoring v2</h1>
        </div>

        <article className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/24 to-cyan-700/10 shadow-xl">
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, transparent, ${scoreColor}, transparent)` }} />

          <div className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div
                className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border-2"
                style={{ borderColor: scoreColor, background: `${scoreColor}18` }}
              >
                <span className="font-mono text-lg font-bold leading-none" style={{ color: scoreColor }}>
                  {mockScore.score0100}
                </span>
                <span className="mt-0.5 text-[9px] uppercase tracking-widest" style={{ color: scoreColor }}>
                  scor
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-display text-lg leading-tight tracking-wide text-white">
                    Balta Varlaam
                  </h2>
                  <span className="shrink-0 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                    v2
                  </span>
                </div>
                <p className="truncate text-xs text-slate-400">Giurgiu · 45 km de tine</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-200">Conditii foarte bune</span>
                  <span className="h-1 w-1 rounded-full bg-slate-600" />
                  <span className="text-xs text-slate-400">baza {mockScore.baseScore0100}</span>
                </div>
              </div>
            </div>

            <div className="mb-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-sm font-semibold text-emerald-200">Merge azi</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="truncate text-[11px] text-slate-300">incredere model</span>
                    <span className="font-mono text-[11px] text-slate-300">{mockScore.confidence0100}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full ${confidenceColor(mockScore.confidence0100)}`} style={{ width: `${mockScore.confidence0100}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <span className="min-w-0 truncate text-[10px] uppercase tracking-wider text-slate-500">
                  Perioada recomandata
                </span>
                <span className="shrink-0 font-mono text-xs font-semibold text-white">18:00-00:00</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
                  <span className="block truncate text-[10px] uppercase tracking-wider text-slate-500">Vant</span>
                  <div className="mt-0.5 flex items-baseline justify-between gap-2">
                    <span className="truncate text-[11px] text-slate-300">moderat</span>
                    <span className="shrink-0 font-mono text-xs font-semibold text-white">13 km/h</span>
                  </div>
                </div>

                <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
                  <span className="block truncate text-[10px] uppercase tracking-wider text-slate-500">Temperatura</span>
                  <div className="mt-0.5 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] text-slate-300">aer</span>
                      <span className="font-mono text-xs font-semibold text-white">21°C</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] text-slate-300">apa</span>
                      <span className="font-mono text-xs font-semibold text-cyan-100">19°C</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${mockLakeDetails.lat},${mockLakeDetails.lon}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 transition-all hover:bg-white/[0.07]"
              >
                <span className="block truncate text-[10px] uppercase tracking-wider text-slate-500">Locatie</span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-slate-200">Harta</span>
              </a>
              <a
                href={`tel:${mockLakeDetails.phone.replace(/[^\d+]/g, '')}`}
                className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 transition-all hover:bg-white/[0.07]"
              >
                <span className="block truncate text-[10px] uppercase tracking-wider text-slate-500">Telefon</span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-slate-200">{mockLakeDetails.phone}</span>
              </a>
              <a
                href={mockLakeDetails.website_url ?? mockLakeDetails.facebook_url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 transition-all hover:bg-white/[0.07]"
              >
                <span className="block truncate text-[10px] uppercase tracking-wider text-slate-500">Site</span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-slate-200">varlaam.ro</span>
              </a>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${mockLakeDetails.lat},${mockLakeDetails.lon}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lake-500/40 bg-lake-600/30 text-sm font-bold text-white transition-all hover:bg-lake-600/50"
                title="Navigheaza"
              >
                ↗
              </a>
                <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-slate-300">18:00-00:00 · recomandat</span>
                  <span className="font-mono text-xs text-emerald-300">
                    {mockScore.baitModifierPoints >= 0 ? '+' : ''}{mockScore.baitModifierPoints}
                  </span>
                  </div>
                </div>
              </div>
          </div>
        </article>

        <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg tracking-wide">Legacy vs v2</h2>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">scor final 0-100</span>
          </div>

          <div className="space-y-1.5">
            {comparisonRows.map((row, index) => (
              <div key={row.name} className="grid grid-cols-[minmax(0,1fr)_42px_42px_46px] items-center gap-2 rounded-xl border border-white/8 bg-mud-950/35 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-200">{index + 1}. {row.name}</p>
                  <p className="text-[10px] text-slate-500">conf {row.confidence}%</p>
                </div>
                <div className="text-right">
                  <span className="block text-[9px] uppercase tracking-wider text-slate-600">actual</span>
                  <span className="font-mono text-xs font-semibold text-slate-200">{row.legacy}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[9px] uppercase tracking-wider text-slate-600">v2</span>
                  <span className="font-mono text-xs font-semibold text-emerald-200">{row.v2}</span>
                </div>
                <span className={`text-right font-mono text-xs font-semibold ${row.delta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {row.delta >= 0 ? '+' : ''}{row.delta}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
