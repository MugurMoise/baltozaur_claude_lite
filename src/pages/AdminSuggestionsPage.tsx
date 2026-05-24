import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { appEnv, isDevEnvironment, supabase, tables } from '../lib/supabase';

interface LakeSuggestion {
  id: string;
  name: string;
  county: string | null;
  lat: number | null;
  lon: number | null;
  website_url: string | null;
  facebook_url: string | null;
  phone: string | null;
  submitter_email: string | null;
  submitter_ip: string | null;
  user_agent: string | null;
  confirmation_sent_at: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected' | string;
  created_at: string;
}

interface ScoreSettings {
  baseScore: number;
  idealTempMin: number;
  idealTempMax: number;
  idealTempBonus: number;
  coolTempBonus: number;
  hotTempBonus: number;
  coldTempPenalty: number;
  extremeHeatPenalty: number;
  idealPressureMin: number;
  idealPressureMax: number;
  idealPressureBonus: number;
  moderatePressureBonus: number;
  lowPressureBonus: number;
  highPressurePenalty: number;
  fallingPressureBonus: number;
  stablePressureBonus: number;
  risingPressurePenalty: number;
  hardRisingPressurePenalty: number;
  goodWindMin: number;
  goodWindMax: number;
  goodWindBonus: number;
  calmWindBonus: number;
  hardWindPenalty: number;
  veryHardWindPenalty: number;
  cloudBonus: number;
  lightRainPenalty: number;
  longRainPenalty: number;
  rainyWindPenalty: number;
}

interface QuickLakeForm {
  name: string;
  county: string;
  country: string;
  region: string;
  distance_km: string;
  lat: string;
  lon: string;
  lake_type: string;
  description: string;
  website_url: string;
  facebook_url: string;
  phone: string;
  rules: string;
  price: string;
}

type Tab = 'refresh' | 'settings' | 'quick-add' | 'suggestions';
type Filter = 'pending' | 'all';

const SETTINGS_ID = 'default';

const DEFAULT_SCORE_SETTINGS: ScoreSettings = {
  baseScore: 55,
  idealTempMin: 18,
  idealTempMax: 26,
  idealTempBonus: 22,
  coolTempBonus: 12,
  hotTempBonus: 8,
  coldTempPenalty: 18,
  extremeHeatPenalty: 18,
  idealPressureMin: 1000,
  idealPressureMax: 1012,
  idealPressureBonus: 16,
  moderatePressureBonus: 8,
  lowPressureBonus: 6,
  highPressurePenalty: 12,
  fallingPressureBonus: 14,
  stablePressureBonus: 6,
  risingPressurePenalty: 8,
  hardRisingPressurePenalty: 18,
  goodWindMin: 4,
  goodWindMax: 14,
  goodWindBonus: 12,
  calmWindBonus: 2,
  hardWindPenalty: 8,
  veryHardWindPenalty: 18,
  cloudBonus: 8,
  lightRainPenalty: 16,
  longRainPenalty: 50,
  rainyWindPenalty: 70,
};

const initialQuickLake: QuickLakeForm = {
  name: '',
  county: '',
  country: 'RO',
  region: '',
  distance_km: '',
  lat: '',
  lon: '',
  lake_type: 'commercial',
  description: '',
  website_url: '',
  facebook_url: '',
  phone: '',
  rules: '',
  price: '',
};

const settingGroups: { title: string; fields: { key: keyof ScoreSettings; label: string }[] }[] = [
  {
    title: 'Temperatura',
    fields: [
      { key: 'baseScore', label: 'Scor de baza' },
      { key: 'idealTempMin', label: 'Temp. ideala min' },
      { key: 'idealTempMax', label: 'Temp. ideala max' },
      { key: 'idealTempBonus', label: 'Bonus temp. ideala' },
      { key: 'coolTempBonus', label: 'Bonus temp. rece' },
      { key: 'hotTempBonus', label: 'Bonus temp. calda' },
      { key: 'coldTempPenalty', label: 'Penalizare frig' },
      { key: 'extremeHeatPenalty', label: 'Penalizare canicula' },
    ],
  },
  {
    title: 'Presiune',
    fields: [
      { key: 'idealPressureMin', label: 'Presiune ideala min' },
      { key: 'idealPressureMax', label: 'Presiune ideala max' },
      { key: 'idealPressureBonus', label: 'Bonus presiune ideala' },
      { key: 'moderatePressureBonus', label: 'Bonus presiune moderata' },
      { key: 'lowPressureBonus', label: 'Bonus presiune joasa' },
      { key: 'highPressurePenalty', label: 'Penalizare presiune mare' },
      { key: 'fallingPressureBonus', label: 'Bonus presiune in scadere' },
      { key: 'stablePressureBonus', label: 'Bonus presiune stabila' },
      { key: 'risingPressurePenalty', label: 'Penalizare crestere' },
      { key: 'hardRisingPressurePenalty', label: 'Penalizare crestere dura' },
    ],
  },
  {
    title: 'Vant si ploaie',
    fields: [
      { key: 'goodWindMin', label: 'Vant bun min' },
      { key: 'goodWindMax', label: 'Vant bun max' },
      { key: 'goodWindBonus', label: 'Bonus vant bun' },
      { key: 'calmWindBonus', label: 'Bonus calm' },
      { key: 'hardWindPenalty', label: 'Penalizare vant tare' },
      { key: 'veryHardWindPenalty', label: 'Penalizare vant foarte tare' },
      { key: 'cloudBonus', label: 'Bonus nori' },
      { key: 'lightRainPenalty', label: 'Penalizare ploaie usoara' },
      { key: 'longRainPenalty', label: 'Penalizare ploaie lunga' },
      { key: 'rainyWindPenalty', label: 'Penalizare ploaie + vant' },
    ],
  },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function shortUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, '') + url.pathname.replace(/\/$/, '');
  } catch {
    return value;
  }
}

function cleanText(value: string) {
  return value.trim() || null;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function mergeSettings(raw: unknown): ScoreSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SCORE_SETTINGS;
  const next = { ...DEFAULT_SCORE_SETTINGS };
  for (const key of Object.keys(DEFAULT_SCORE_SETTINGS) as (keyof ScoreSettings)[]) {
    const value = (raw as Partial<ScoreSettings>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) next[key] = value;
  }
  return next;
}

export function AdminSuggestionsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [loginState, setLoginState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<LakeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('pending');
  const [tab, setTab] = useState<Tab>('refresh');
  const [refreshingScores, setRefreshingScores] = useState(false);
  const [refreshLimit, setRefreshLimit] = useState('10');
  const [settings, setSettings] = useState<ScoreSettings>(DEFAULT_SCORE_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [quickLake, setQuickLake] = useState<QuickLakeForm>(initialQuickLake);
  const [addingLake, setAddingLake] = useState(false);
  const [refreshNewLake, setRefreshNewLake] = useState(true);

  const visibleSuggestions = useMemo(() => {
    if (filter === 'all') return suggestions;
    return suggestions.filter((suggestion) => suggestion.status === 'pending');
  }, [filter, suggestions]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    void loadSuggestions();
    void loadSettings();
  }, [session]);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setMessage('Supabase nu este configurat.');
      return;
    }

    setLoginState('sending');
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/admin/suggestions`,
      },
    });

    if (error) {
      setLoginState('idle');
      setMessage(error.message);
      return;
    }

    setLoginState('sent');
    setMessage('Ti-am trimis linkul de autentificare pe email.');
  }

  async function logout() {
    await supabase?.auth.signOut();
    setSuggestions([]);
  }

  async function loadSuggestions() {
    if (!supabase) return;

    setLoading(true);
    setMessage(null);
    const { data, error } = await supabase
      .from(tables.lakeSuggestions)
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);

    if (error) {
      setMessage(`${error.message}. Daca esti logat, lipseste probabil policy-ul admin pentru sugestii.`);
      return;
    }

    setSuggestions((data ?? []) as LakeSuggestion[]);
  }

  async function loadSettings() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('admin_score_settings')
      .select('settings')
      .eq('id', SETTINGS_ID)
      .maybeSingle();

    if (error) {
      setMessage(`${error.message}. Ruleaza migratia pentru admin_score_settings daca lipseste tabelul.`);
      return;
    }

    setSettings(mergeSettings(data?.settings));
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected' | 'pending') {
    if (!supabase) return;

    const previous = suggestions;
    setSuggestions((current) => current.map((suggestion) => (
      suggestion.id === id ? { ...suggestion, status } : suggestion
    )));

    const { error } = await supabase
      .from(tables.lakeSuggestions)
      .update({ status })
      .eq('id', id);

    if (error) {
      setSuggestions(previous);
      setMessage(error.message);
    }
  }

  async function refreshScores(lakeId?: string) {
    if (!supabase) return;

    setRefreshingScores(true);
    setMessage(null);
    const limit = Number(refreshLimit);
    const { data, error } = await supabase.functions.invoke('calculate-scores', {
      body: {
        env: appEnv,
        limit: lakeId ? null : (Number.isFinite(limit) && limit > 0 ? limit : null),
        lake_id: lakeId ?? null,
      },
    });
    setRefreshingScores(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const processed = data && typeof data === 'object' && 'processed' in data ? String(data.processed) : '0';
    const failed = data && typeof data === 'object' && Array.isArray((data as any).results)
      ? (data as any).results.filter((row: { error?: string }) => row.error).length
      : 0;
    setMessage(`Refresh terminat pentru ${processed} balti${failed ? `, cu ${failed} erori` : ''}.`);
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    setSavingSettings(true);
    setMessage(null);
    const { error } = await supabase
      .from('admin_score_settings')
      .upsert({
        id: SETTINGS_ID,
        settings,
        updated_by: session?.user.id ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    setSavingSettings(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Setarile ecuatiei au fost salvate. Da refresh la scoruri ca sa se aplice.');
  }

  async function addQuickLake(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    const lat = Number(quickLake.lat);
    const lon = Number(quickLake.lon);
    const distance = parseOptionalNumber(quickLake.distance_km);

    if (!quickLake.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      setMessage('Completeaza numele, latitudinea si longitudinea cu valori valide.');
      return;
    }
    if (Number.isNaN(distance)) {
      setMessage('Distanta trebuie sa fie numar sau goala.');
      return;
    }

    const payload = {
      name: quickLake.name.trim(),
      county: quickLake.county.trim() || 'Necunoscut',
      country: quickLake.country.trim().toUpperCase() || 'RO',
      region: cleanText(quickLake.region),
      distance_km: distance,
      lat,
      lon,
      lake_type: quickLake.lake_type.trim() || 'commercial',
      description: cleanText(quickLake.description),
      website_url: cleanText(quickLake.website_url),
      facebook_url: cleanText(quickLake.facebook_url),
      phone: cleanText(quickLake.phone),
      rules: cleanText(quickLake.rules),
      price: cleanText(quickLake.price),
    };

    setAddingLake(true);
    setMessage(null);
    const { data, error } = await supabase
      .from(tables.lakes)
      .insert(payload)
      .select('id, name')
      .single();

    if (error) {
      setAddingLake(false);
      setMessage(error.message);
      return;
    }

    if (refreshNewLake && data?.id) {
      await refreshScores(data.id);
    } else {
      setMessage(`Balta "${data?.name ?? payload.name}" a fost adaugata.`);
    }

    setAddingLake(false);
    setQuickLake(initialQuickLake);
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-mud-900 text-white font-body px-4 py-6">
        <section className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center">
          <a href="/" className="mb-6 text-sm text-slate-500 hover:text-white">← Baltozaur</a>
          <h1 className="font-display text-4xl">Admin</h1>
          <p className="mt-2 text-sm text-slate-400">
            Autentificare sigura cu link pe email. Accesul este controlat din Supabase.
          </p>

          <form onSubmit={login} className="mt-6 space-y-3">
            <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">Email admin</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@baltozaur.ro"
              className="h-12 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-base outline-none transition focus:border-lime-300"
              required
            />
            <button
              type="submit"
              disabled={loginState === 'sending'}
              className="h-11 w-full rounded-lg bg-lime-300 font-semibold text-mud-900 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loginState === 'sending' ? 'Se trimite...' : 'Trimite link de login'}
            </button>
          </form>

          {message && (
            <p className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-300">{message}</p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-mud-900 text-white font-body">
      <section className="mx-auto max-w-6xl px-4 py-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <a href="/" className="text-sm text-slate-500 hover:text-white">← Baltozaur</a>
            <h1 className="mt-2 font-display text-4xl">Admin Baltozaur</h1>
            <p className="mt-1 text-sm text-slate-400">
              {session.user.email} · {isDevEnvironment ? 'dev' : 'prod'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {([
              ['refresh', 'Refresh'],
              ['settings', 'Ecuatie'],
              ['quick-add', 'Adauga balta'],
              ['suggestions', 'Sugestii'],
            ] as [Tab, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`h-10 rounded-lg px-4 text-sm transition ${tab === value ? 'bg-lime-300 text-mud-900' : 'border border-white/10 text-slate-200 hover:bg-white/5'}`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void logout()}
              className="h-10 rounded-lg bg-white/10 px-4 text-sm text-white hover:bg-white/15"
            >
              Logout
            </button>
          </div>
        </header>

        {message && (
          <p className="mt-4 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">{message}</p>
        )}

        {tab === 'refresh' && (
          <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-xl font-semibold">Refresh vreme si scoruri</h2>
              <p className="mt-2 text-sm text-slate-400">
                Ruleaza functia Supabase `calculate-scores` pentru mediul curent. Pentru refresh complet lasa limita goala.
              </p>

              <div className="mt-5 grid max-w-sm gap-2">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-500">Limita balti</label>
                <input
                  value={refreshLimit}
                  onChange={(event) => setRefreshLimit(event.target.value)}
                  inputMode="numeric"
                  placeholder="gol = toate"
                  className="h-11 rounded-lg border border-white/10 bg-mud-950/70 px-3 text-sm outline-none focus:border-lime-300"
                />
              </div>

              <button
                type="button"
                onClick={() => void refreshScores()}
                disabled={refreshingScores}
                className="mt-5 h-11 rounded-lg bg-lime-300 px-5 text-sm font-semibold text-mud-900 hover:bg-lime-200 disabled:opacity-60"
              >
                {refreshingScores ? 'Se actualizeaza...' : 'Actualizeaza vremea si scorurile'}
              </button>
            </div>

            <aside className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <h3 className="font-semibold">Flux recomandat</h3>
              <ol className="mt-3 space-y-2 text-sm text-slate-400">
                <li>1. Ajusteaza ecuatia daca e nevoie.</li>
                <li>2. Salveaza setarile.</li>
                <li>3. Ruleaza refresh scoruri.</li>
                <li>4. Verifica lista publica.</li>
              </ol>
            </aside>
          </section>
        )}

        {tab === 'settings' && (
          <form onSubmit={saveSettings} className="mt-5 space-y-4">
            {settingGroups.map((group) => (
              <section key={group.title} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                <h2 className="text-lg font-semibold">{group.title}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {group.fields.map((field) => (
                    <label key={field.key} className="grid gap-1 text-sm text-slate-300">
                      <span className="text-xs text-slate-500">{field.label}</span>
                      <input
                        type="number"
                        step="0.1"
                        value={settings[field.key]}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setSettings((current) => ({
                            ...current,
                            [field.key]: Number.isFinite(value) ? value : current[field.key],
                          }));
                        }}
                        className="h-10 rounded-lg border border-white/10 bg-mud-950/70 px-3 text-sm outline-none focus:border-lime-300"
                      />
                    </label>
                  ))}
                </div>
              </section>
            ))}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="h-11 rounded-lg bg-lime-300 px-5 text-sm font-semibold text-mud-900 hover:bg-lime-200 disabled:opacity-60"
              >
                {savingSettings ? 'Se salveaza...' : 'Salveaza ecuatia'}
              </button>
              <button
                type="button"
                onClick={() => setSettings(DEFAULT_SCORE_SETTINGS)}
                className="h-11 rounded-lg border border-white/10 px-5 text-sm text-slate-200 hover:bg-white/5"
              >
                Reset default
              </button>
            </div>
          </form>
        )}

        {tab === 'quick-add' && (
          <form onSubmit={addQuickLake} className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-semibold">Adaugare rapida balta</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <AdminInput label="Nume balta" value={quickLake.name} required onChange={(value) => setQuickLake((current) => ({ ...current, name: value }))} />
              <AdminInput label="Judet / zona" value={quickLake.county} onChange={(value) => setQuickLake((current) => ({ ...current, county: value }))} />
              <AdminInput label="Latitudine" value={quickLake.lat} required inputMode="decimal" onChange={(value) => setQuickLake((current) => ({ ...current, lat: value }))} />
              <AdminInput label="Longitudine" value={quickLake.lon} required inputMode="decimal" onChange={(value) => setQuickLake((current) => ({ ...current, lon: value }))} />
              <AdminInput label="Tara" value={quickLake.country} onChange={(value) => setQuickLake((current) => ({ ...current, country: value }))} />
              <AdminInput label="Regiune" value={quickLake.region} onChange={(value) => setQuickLake((current) => ({ ...current, region: value }))} />
              <AdminInput label="Distanta km" value={quickLake.distance_km} inputMode="decimal" onChange={(value) => setQuickLake((current) => ({ ...current, distance_km: value }))} />
              <AdminInput label="Tip balta" value={quickLake.lake_type} onChange={(value) => setQuickLake((current) => ({ ...current, lake_type: value }))} />
              <AdminInput label="Site" value={quickLake.website_url} onChange={(value) => setQuickLake((current) => ({ ...current, website_url: value }))} />
              <AdminInput label="Facebook" value={quickLake.facebook_url} onChange={(value) => setQuickLake((current) => ({ ...current, facebook_url: value }))} />
              <AdminInput label="Telefon" value={quickLake.phone} onChange={(value) => setQuickLake((current) => ({ ...current, phone: value }))} />
              <AdminInput label="Pret" value={quickLake.price} onChange={(value) => setQuickLake((current) => ({ ...current, price: value }))} />
              <AdminInput label="Descriere" value={quickLake.description} textarea onChange={(value) => setQuickLake((current) => ({ ...current, description: value }))} />
              <AdminInput label="Regulament" value={quickLake.rules} textarea onChange={(value) => setQuickLake((current) => ({ ...current, rules: value }))} />
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={refreshNewLake}
                onChange={(event) => setRefreshNewLake(event.target.checked)}
                className="h-4 w-4 accent-lime-300"
              />
              Calculeaza imediat vremea si scorurile pentru balta noua
            </label>

            <button
              type="submit"
              disabled={addingLake || refreshingScores}
              className="mt-5 h-11 rounded-lg bg-lime-300 px-5 text-sm font-semibold text-mud-900 hover:bg-lime-200 disabled:opacity-60"
            >
              {addingLake || refreshingScores ? 'Se adauga...' : 'Adauga balta'}
            </button>
          </form>
        )}

        {tab === 'suggestions' && (
          <section className="mt-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')}
                className="h-10 rounded-lg border border-white/10 px-4 text-sm text-slate-200 hover:bg-white/5"
              >
                {filter === 'pending' ? 'Pending' : 'Toate'}
              </button>
              <button
                type="button"
                onClick={() => void loadSuggestions()}
                className="h-10 rounded-lg border border-white/10 px-4 text-sm text-slate-200 hover:bg-white/5"
              >
                Refresh sugestii
              </button>
            </div>

            <div className="grid gap-3">
              {loading && <p className="text-sm text-slate-400">Se incarca...</p>}
              {!loading && visibleSuggestions.length === 0 && (
                <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                  Nu exista sugestii pentru filtrul curent.
                </p>
              )}

              {visibleSuggestions.map((suggestion) => (
                <article key={suggestion.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{suggestion.name}</h2>
                        <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-slate-300">{suggestion.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {[suggestion.county, suggestion.lat && suggestion.lon ? `${suggestion.lat}, ${suggestion.lon}` : null, formatDate(suggestion.created_at)].filter(Boolean).join(' · ')}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button type="button" onClick={() => void updateStatus(suggestion.id, 'approved')} className="h-9 rounded-lg bg-lime-300 px-3 text-sm font-semibold text-mud-900">Aproba</button>
                      <button type="button" onClick={() => void updateStatus(suggestion.id, 'rejected')} className="h-9 rounded-lg border border-white/10 px-3 text-sm text-slate-200 hover:bg-white/5">Respinge</button>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    {suggestion.phone && <div><dt className="text-slate-500">Telefon</dt><dd>{suggestion.phone}</dd></div>}
                    {suggestion.submitter_email && <div><dt className="text-slate-500">Email</dt><dd>{suggestion.submitter_email}</dd></div>}
                    {suggestion.submitter_ip && <div><dt className="text-slate-500">IP</dt><dd>{suggestion.submitter_ip}</dd></div>}
                    {suggestion.confirmation_sent_at && <div><dt className="text-slate-500">Confirmare</dt><dd>{formatDate(suggestion.confirmation_sent_at)}</dd></div>}
                    {suggestion.website_url && <div><dt className="text-slate-500">Site</dt><dd><a className="text-lime-200 hover:text-lime-100" href={suggestion.website_url} target="_blank" rel="noreferrer">{shortUrl(suggestion.website_url)}</a></dd></div>}
                    {suggestion.facebook_url && <div><dt className="text-slate-500">Facebook</dt><dd><a className="text-lime-200 hover:text-lime-100" href={suggestion.facebook_url} target="_blank" rel="noreferrer">{shortUrl(suggestion.facebook_url)}</a></dd></div>}
                    {suggestion.user_agent && <div className="sm:col-span-2"><dt className="text-slate-500">Browser</dt><dd className="break-words text-xs">{suggestion.user_agent}</dd></div>}
                    {suggestion.notes && <div className="sm:col-span-2"><dt className="text-slate-500">Observatii</dt><dd className="whitespace-pre-wrap">{suggestion.notes}</dd></div>}
                  </dl>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function AdminInput(props: {
  label: string;
  value: string;
  required?: boolean;
  textarea?: boolean;
  inputMode?: 'text' | 'decimal' | 'numeric';
  onChange: (value: string) => void;
}) {
  const className = 'w-full rounded-lg border border-white/10 bg-mud-950/70 px-3 py-2 text-sm text-white outline-none focus:border-lime-300';

  return (
    <label className="grid gap-1 text-sm text-slate-300">
      <span className="text-xs text-slate-500">{props.label}{props.required ? ' *' : ''}</span>
      {props.textarea ? (
        <textarea
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          rows={3}
          className={className}
        />
      ) : (
        <input
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          required={props.required}
          inputMode={props.inputMode}
          className={`h-10 ${className}`}
        />
      )}
    </label>
  );
}
