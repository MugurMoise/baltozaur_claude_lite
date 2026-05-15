import { useState, useEffect } from 'react';
import { subscribeToPush, unsubscribeFromPush, getSubscriptionState } from '../../lib/push';

const COUNTIES = [
  'Ilfov', 'Giurgiu', 'Dâmbovița', 'Prahova', 'Ialomița', 'Călărași',
  'Argeș', 'Teleorman', 'Buzău', 'Brăila', 'Galați', 'Constanța',
  'București',
].sort();

const DISTANCE_OPTIONS = [
  { label: 'Sub 30 km',   value: 30 },
  { label: '30 – 60 km',  value: 60 },
  { label: '60 – 100 km', value: 100 },
  { label: 'Orice distanță', value: null },
];

interface Props {
  onClose: () => void;
}

export function NotificationSetup({ onClose }: Props) {
  const [step, setStep]                   = useState<'prefs' | 'loading' | 'success' | 'error'>('prefs');
  const [selectedCounties, setCounties]   = useState<string[]>([]);
  const [maxDistance, setMaxDistance]     = useState<number | null>(60);
  const [errorMsg, setErrorMsg]           = useState('');
  const [isSubscribed, setIsSubscribed]   = useState(false);
  const [checking, setChecking]           = useState(true);

  useEffect(() => {
    getSubscriptionState().then(({ subscribed, preferences }) => {
      setIsSubscribed(subscribed);
      if (preferences) {
        setCounties(preferences.counties ?? []);
        setMaxDistance(preferences.max_distance_km);
      }
      setChecking(false);
    });
  }, []);

  const toggleCounty = (county: string) => {
    setCounties(prev =>
      prev.includes(county) ? prev.filter(c => c !== county) : [...prev, county]
    );
  };

  const hasPrefs = selectedCounties.length > 0 || maxDistance !== null;

  const handleSubscribe = async () => {
    if (!hasPrefs) return;
    setStep('loading');
    const result = await subscribeToPush({ counties: selectedCounties, max_distance_km: maxDistance });
    if (result.success) {
      setStep('success');
      setIsSubscribed(true);
    } else {
      setErrorMsg(result.error ?? 'Eroare necunoscută');
      setStep('error');
    }
  };

  const handleUnsubscribe = async () => {
    setStep('loading');
    await unsubscribeFromPush();
    setIsSubscribed(false);
    setCounties([]);
    setMaxDistance(60);
    setStep('prefs');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-mud-800 border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🔔</span>
            <div>
              <h2 className="font-display text-xl text-white tracking-wide">Notificări</h2>
              <p className="text-xs text-slate-400 font-body">Prognoză seara pentru ziua următoare</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors text-lg">×</button>
        </div>

        <div className="px-5 py-5 max-h-[70vh] overflow-y-auto">
          {checking ? (
            <div className="flex items-center justify-center py-8">
              <svg className="w-6 h-6 animate-spin text-lake-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : step === 'success' ? (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="font-display text-xl text-white tracking-wide mb-2">Activat!</h3>
              <p className="text-sm text-slate-400 font-body">
                Vei primi o notificare în fiecare seară la <strong className="text-white">20:00</strong> cu prognoza pentru ziua următoare.
              </p>
              <button onClick={onClose} className="mt-6 w-full bg-lake-600 hover:bg-lake-500 text-white rounded-2xl py-3 font-body font-semibold transition-all">
                Gata!
              </button>
            </div>
          ) : step === 'error' ? (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">❌</div>
              <p className="text-sm text-red-400 font-body mb-4">{errorMsg}</p>
              <button onClick={() => setStep('prefs')} className="w-full bg-white/5 border border-white/10 text-slate-300 rounded-2xl py-3 font-body font-semibold transition-all hover:bg-white/10">
                Încearcă din nou
              </button>
            </div>
          ) : step === 'loading' ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <svg className="w-8 h-8 animate-spin text-lake-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-slate-400 font-body">Se configurează...</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Already subscribed banner */}
              {isSubscribed && (
                <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm text-emerald-300 font-body">Notificări active</span>
                  </div>
                  <button
                    onClick={handleUnsubscribe}
                    className="text-xs text-red-400 hover:text-red-300 font-body underline"
                  >
                    Dezactivează
                  </button>
                </div>
              )}

              {/* When */}
              <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-body mb-2">Când</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🌙</span>
                  <div>
                    <p className="text-sm text-white font-body font-medium">În fiecare seară la 20:00</p>
                    <p className="text-xs text-slate-500 font-body">Prognoza completă pentru ziua următoare</p>
                  </div>
                </div>
              </div>

              {/* County selection */}
              <div>
                <p className="text-sm font-body font-medium text-slate-300 mb-2.5 flex items-center gap-1.5">
                  <span>🗺️</span> Județe urmărite
                  <span className="text-xs text-slate-500">(opțional)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {COUNTIES.map(county => (
                    <button
                      key={county}
                      type="button"
                      onClick={() => toggleCounty(county)}
                      className={`text-sm px-3 py-1.5 rounded-xl border font-body transition-all ${
                        selectedCounties.includes(county)
                          ? 'bg-lake-600/40 border-lake-500/60 text-white'
                          : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {county}
                    </button>
                  ))}
                </div>
              </div>

              {/* Distance selection */}
              <div>
                <p className="text-sm font-body font-medium text-slate-300 mb-2.5 flex items-center gap-1.5">
                  <span>📏</span> Distanță față de București
                  <span className="text-xs text-slate-500">(opțional)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {DISTANCE_OPTIONS.map(({ label, value }) => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => setMaxDistance(value)}
                      className={`text-sm px-3 py-2.5 rounded-xl border font-body transition-all ${
                        maxDistance === value
                          ? 'bg-lake-600/40 border-lake-500/60 text-white'
                          : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {!hasPrefs && (
                <p className="text-xs text-amber-400 font-body text-center">
                  ⚠️ Selectează cel puțin un județ sau o distanță
                </p>
              )}

              {/* Subscribe button */}
              <button
                onClick={handleSubscribe}
                disabled={!hasPrefs}
                className={`w-full py-4 rounded-2xl font-body font-bold text-base flex items-center justify-center gap-2 transition-all ${
                  hasPrefs
                    ? 'bg-lake-600 hover:bg-lake-500 text-white shadow-lg'
                    : 'bg-white/5 text-slate-600 cursor-not-allowed'
                }`}
              >
                <span className="text-xl">🔔</span>
                {isSubscribed ? 'Actualizează preferințele' : 'Activează notificările'}
              </button>

              <p className="text-xs text-center text-slate-600 font-body">
                Poți dezactiva oricând din browser → Setări → Notificări
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
