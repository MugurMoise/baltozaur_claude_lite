# Dev and Production Workflow

Baltozaur uses two Git branches and one Supabase project.

Because Supabase Branching and extra projects are not available, development data lives in separate `dev_*` tables inside the same Supabase project.

| Environment | Git branch | Vercel target | Supabase tables |
| --- | --- | --- | --- |
| Development | `dev` | Preview / `dev.baltozaur.ro` | `dev_lakes`, `dev_lake_scores`, `dev_latest_lake_scores` |
| Production | `main` | Production / `baltozaur.ro` | `lakes`, `lake_scores`, `latest_lake_scores` |

## Environment Switch

The frontend chooses tables with `VITE_APP_ENV`:

```env
VITE_APP_ENV=dev
```

When `VITE_APP_ENV=dev`, the app reads from `dev_*` tables. Any other value, or an unset value, uses production table names.

## Local Development

1. Copy `.env.example` to `.env`.
2. Set:

```env
VITE_APP_ENV=dev
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Run:

```bash
npm install
npm run dev
```

Local `.env` files are ignored by Git.

## Vercel Environment Variables

Use the same Supabase URL/key in both environments, but change `VITE_APP_ENV`:

| Variable | Preview / Development | Production |
| --- | --- | --- |
| `VITE_APP_ENV` | `dev` | `prod` |
| `VITE_SUPABASE_URL` | Supabase project URL | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Supabase anon key |
| `VITE_VAPID_PUBLIC_KEY` | dev/test key if used | prod key if used |

Use `main` as the production branch in Vercel. Pushes to `dev` should create preview deployments.

## Supabase Migration

Apply the migration in `supabase/migrations/20260516000100_dev_environment_tables.sql`.

It creates:

- `dev_lakes`
- `dev_lake_scores`
- `dev_latest_lake_scores`
- `dev_push_subscriptions`

It also inserts a tiny seed dataset so dev has data before the weather job runs.

## Supabase Pipeline

GitHub Actions deploys Supabase changes from `.github/workflows/supabase.yml`.

Add these repository secrets in GitHub:

| Secret | Value |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase personal access token |
| `SUPABASE_DB_PASSWORD` | Database password for the existing Supabase project |
| `SUPABASE_PROJECT_REF` | Project ref, for example the `ecg...` part of `https://ecg....supabase.co` |

Pipeline behavior:

- Pushes to `dev` apply database migrations only after checking that changed migrations target `dev_*` tables/views and do not write production tables.
- Pushes to `main` apply database migrations and deploy Edge Functions.
- Manual runs are available from the GitHub Actions tab.

Because dev and prod share one Supabase project, the `dev` guard is intentionally conservative. Production table migrations should go through `main`.

## Edge Function Dev Mode

The `calculate-scores` Edge Function chooses tables with a query parameter:

```text
/functions/v1/calculate-scores?env=dev
```

For production, call the function without the query parameter:

```text
/functions/v1/calculate-scores
```

This keeps the production cron path unchanged while letting manual/dev runs write to `dev_*` tables.

## Release Flow

1. Work on `dev`.
2. Test the Vercel preview with `VITE_APP_ENV=dev`.
3. Test Edge Function changes against `dev_*` tables using `calculate-scores?env=dev`.
4. Merge `dev` into `main`.
5. Vercel deploys `main` to `baltozaur.ro` with `VITE_APP_ENV=prod`.

## Secrets

Never commit real `.env` files, service role keys, VAPID private keys, or personal access tokens. Store production secrets only in Vercel/Supabase dashboards.
