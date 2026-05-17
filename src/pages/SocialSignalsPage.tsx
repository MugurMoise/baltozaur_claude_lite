import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createSocialPostWithAnalysis, fetchSocialLakeOptions, fetchSocialPosts, isDevEnvironment } from '../lib/supabase';
import type { SocialLakeOption, SocialPostWithAnalysis } from '../types/social';

const eventLabels: Record<string, string> = {
  captura_confirmata: 'Captura confirmata',
  captura_mare: 'Captura mare',
  popularitate_ridicata: 'Popular',
  partida_ratata: 'Partida ratata',
  conditii_proaste: 'Conditii proaste',
  informatie_balta: 'Info balta',
  irelevant: 'Irelevant',
};

const eventStyles: Record<string, string> = {
  captura_confirmata: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  captura_mare: 'bg-lake-500/15 text-lake-200 border-lake-500/30',
  popularitate_ridicata: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  partida_ratata: 'bg-red-500/15 text-red-300 border-red-500/30',
  conditii_proaste: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  informatie_balta: 'bg-white/10 text-slate-300 border-white/10',
  irelevant: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

function parseCount(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/\s/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function compactNumber(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('ro-RO', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function SocialSignalsPage() {
  const [lakeOptions, setLakeOptions] = useState<SocialLakeOption[]>([]);
  const [posts, setPosts] = useState<SocialPostWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [lakeId, setLakeId] = useState('');
  const [author, setAuthor] = useState('');
  const [caption, setCaption] = useState('');
  const [views, setViews] = useState('');
  const [likes, setLikes] = useState('');

  const selectedLake = useMemo(
    () => lakeOptions.find((lake) => lake.id === lakeId) ?? null,
    [lakeOptions, lakeId]
  );

  const loadData = async () => {
    setLoading(true);
    const [lakes, socialPosts] = await Promise.all([
      fetchSocialLakeOptions(),
      fetchSocialPosts(),
    ]);
    setLakeOptions(lakes);
    setPosts(socialPosts);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError('Adauga linkul TikTok.');
      return;
    }

    setSaving(true);
    const result = await createSocialPostWithAnalysis({
      source_url: url.trim(),
      lake_id: lakeId || null,
      author_handle: author.trim() || null,
      caption: caption.trim() || null,
      view_count: parseCount(views),
      like_count: parseCount(likes),
    }, selectedLake?.name ?? null);

    if (!result.ok) {
      setError(result.error ?? 'Nu am putut salva postarea.');
      setSaving(false);
      return;
    }

    setUrl('');
    setAuthor('');
    setCaption('');
    setViews('');
    setLikes('');
    await loadData();
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-mud-900 text-white font-body">
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-mud-900/85 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <a href="/" className="text-xs text-slate-500 hover:text-white transition-colors">← Baltozaur</a>
            <h1 className="font-display text-3xl tracking-wide mt-1">Social Signals</h1>
          </div>
          <div className="rounded-full border border-lake-500/30 bg-lake-500/10 px-3 py-1 text-xs font-semibold text-lake-200">
            {isDevEnvironment ? 'DEV' : 'PROD'}
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="font-display text-xl tracking-wide">Adauga postare TikTok</h2>
              <p className="text-sm text-slate-400 mt-1">
                MVP local: salvam linkul si rulam o clasificare rapida pe text/metrici. Integrarea AI reala vine peste acelasi tabel.
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Link TikTok</span>
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://www.tiktok.com/@user/video/..."
                  className="w-full rounded-xl border border-white/10 bg-mud-950/60 px-3 py-3 text-sm text-white outline-none focus:border-lake-500/60"
                />
              </label>

              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Balta</span>
                <select
                  value={lakeId}
                  onChange={(event) => setLakeId(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-mud-950/60 px-3 py-3 text-sm text-white outline-none focus:border-lake-500/60"
                >
                  <option value="">Necunoscuta</option>
                  {lakeOptions.map((lake) => (
                    <option key={lake.id} value={lake.id}>{lake.name} · {lake.county}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Autor</span>
                <input
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="@cont"
                  className="w-full rounded-xl border border-white/10 bg-mud-950/60 px-3 py-3 text-sm text-white outline-none focus:border-lake-500/60"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Views</span>
                <input
                  value={views}
                  onChange={(event) => setViews(event.target.value)}
                  inputMode="numeric"
                  placeholder="12000"
                  className="w-full rounded-xl border border-white/10 bg-mud-950/60 px-3 py-3 text-sm text-white outline-none focus:border-lake-500/60"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Likes</span>
                <input
                  value={likes}
                  onChange={(event) => setLikes(event.target.value)}
                  inputMode="numeric"
                  placeholder="800"
                  className="w-full rounded-xl border border-white/10 bg-mud-950/60 px-3 py-3 text-sm text-white outline-none focus:border-lake-500/60"
                />
              </label>
            </div>

            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Descriere / observatii</span>
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={4}
                placeholder="Ex: crap 14 kg la Moara Vlasiei, ploaie toata ziua, fara trasaturi..."
                className="w-full rounded-xl border border-white/10 bg-mud-950/60 px-3 py-3 text-sm text-white outline-none focus:border-lake-500/60"
              />
            </label>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-lake-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-lake-500 disabled:opacity-60"
            >
              {saving ? 'Se analizeaza...' : 'Salveaza si analizeaza'}
            </button>
          </form>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl tracking-wide">Postari analizate</h2>
            <button
              onClick={loadData}
              disabled={loading}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:text-white disabled:opacity-60"
            >
              Actualizeaza
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-slate-400">Se incarca...</div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-slate-400">
              Nu exista postari inca.
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => {
                const analysis = post.analysis;
                const eventType = analysis?.event_type ?? 'irelevant';
                return (
                  <article key={post.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <a
                          href={post.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-sm font-semibold text-white hover:text-lake-200"
                        >
                          {post.source_url}
                        </a>
                        <p className="text-xs text-slate-500 mt-1">
                          {post.lake_name ?? analysis?.lake_guess ?? 'Balta necunoscuta'} · {post.author_handle ?? 'autor necunoscut'}
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${eventStyles[eventType] ?? eventStyles.irelevant}`}>
                        {eventLabels[eventType] ?? eventType}
                      </span>
                    </div>

                    {post.caption && (
                      <p className="mt-3 text-sm text-slate-300 line-clamp-3">{post.caption}</p>
                    )}

                    <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-4">
                      <div className="rounded-xl bg-mud-950/50 px-3 py-2">Views <span className="block text-white">{compactNumber(post.view_count)}</span></div>
                      <div className="rounded-xl bg-mud-950/50 px-3 py-2">Likes <span className="block text-white">{compactNumber(post.like_count)}</span></div>
                      <div className="rounded-xl bg-mud-950/50 px-3 py-2">Confidence <span className="block text-white">{analysis ? `${Math.round(analysis.confidence * 100)}%` : '—'}</span></div>
                      <div className="rounded-xl bg-mud-950/50 px-3 py-2">Popularitate <span className="block text-white">{analysis?.popularity_score ?? '—'}</span></div>
                    </div>

                    {analysis?.summary && (
                      <p className="mt-3 text-sm text-slate-300">{analysis.summary}</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
