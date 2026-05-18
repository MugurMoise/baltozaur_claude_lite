import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, tables } from '../lib/supabase';

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

type Filter = 'pending' | 'all';

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

export function AdminSuggestionsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [loginState, setLoginState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<LakeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('pending');

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

  if (!session) {
    return (
      <main className="min-h-screen bg-mud-900 text-white font-body px-4 py-6">
        <section className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center">
          <a href="/" className="mb-6 text-sm text-slate-500 hover:text-white">← Baltozaur</a>
          <h1 className="font-display text-4xl">Admin</h1>
          <p className="mt-2 text-sm text-slate-400">
            Autentificare sigura cu link pe email. Accesul la sugestii este controlat din Supabase.
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
      <section className="mx-auto max-w-5xl px-4 py-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <a href="/" className="text-sm text-slate-500 hover:text-white">← Baltozaur</a>
            <h1 className="mt-2 font-display text-4xl">Sugestii balti</h1>
            <p className="mt-1 text-sm text-slate-400">{session.user.email}</p>
          </div>

          <div className="flex items-center gap-2">
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
              Refresh
            </button>
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

        <div className="mt-5 grid gap-3">
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
    </main>
  );
}
