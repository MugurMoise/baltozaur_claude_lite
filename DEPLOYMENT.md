# Dev and Production Workflow

Baltozaur uses two Git branches and one Supabase project.

Because Supabase Branching and extra projects are not available, development and production share the same canonical lake catalog and score tables. Auxiliary dev data can still live in separate `dev_*` tables inside the same Supabase project.

| Environment | Git branch | Vercel target | Supabase tables |
| --- | --- | --- | --- |
| Development | `dev` | Preview / `dev.baltozaur.ro` | `lakes`, `lake_scores`, `latest_lake_scores` |
| Production | `main` | Production / `baltozaur.ro` | `lakes`, `lake_scores`, `latest_lake_scores` |

## Environment Switch

The frontend chooses tables with `VITE_APP_ENV`:

```env
VITE_APP_ENV=dev
```

When `VITE_APP_ENV=dev`, the app still reads lakes and scores from the common `lakes`, `lake_scores`, and `latest_lake_scores` tables. Auxiliary tables such as suggestions, social posts, and push subscriptions keep their `dev_*` prefix. Any other value, or an unset value, uses production table names everywhere.

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

It creates legacy dev mirror tables:

- `dev_lakes`
- `dev_lake_scores`
- `dev_latest_lake_scores`
- `dev_push_subscriptions`

It also inserts a tiny seed dataset. The current app uses the common lake and score tables instead of these mirror tables.

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

The `calculate-scores` Edge Function now writes to the common `lakes` and `lake_scores` tables. The `env` query parameter is kept for compatibility:

```text
/functions/v1/calculate-scores?env=dev
```

For production, call the function without the query parameter:

```text
/functions/v1/calculate-scores
```

Manual/dev runs and production cron runs refresh the same canonical score rows.

## Scheduled Score Refresh

The database migration `20260521171021_schedule_calculate_scores_cron.sql` registers a Supabase cron job named `calculate-scores-every-3-hours`.

It calls the production `calculate-scores` Edge Function at minute 0 every 3 hours. A production run refreshes weather-backed scores for today and the next 6 forecast days in the common score table.

## Release Flow

1. Work on `dev`.
2. Test the Vercel preview with `VITE_APP_ENV=dev`.
3. From Admin > Backup, press **Backup acum** and wait for the `Database backup` workflow to succeed.
4. Test Edge Function changes with small limits, for example `calculate-scores?limit=1`.
5. Merge `dev` into `main`.
6. Vercel deploys `main` to `baltozaur.ro` with `VITE_APP_ENV=prod`.

## Immutable Database Backups

`.github/workflows/database-backup.yml` checks daily and creates a backup when the latest
successful copy is at least 30 days old. A manual run, including **Admin > Backup > Backup
acum**, bypasses that age check. Each backup contains roles, schema, and data, is checksummed,
and is uploaded without overwriting older copies.

The backup bucket is `baltozaur-db-backups-20260727-9f4c2e` in `eu-north-1`, with
**Versioning**, **Object Lock**, and a default 90-day Compliance retention enabled.
GitHub Actions authenticates to AWS through OIDC using the narrowly scoped
`BaltozaurDatabaseBackup` IAM role; no permanent AWS keys are used.

The workflow reuses the existing `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and
`SUPABASE_PROJECT_REF` repository secrets already configured for the Supabase deployment
pipeline. No additional database secret is required.

Configure these Supabase Edge Function secrets for the admin button:

| Secret | Value |
| --- | --- |
| `GITHUB_BACKUP_REPOSITORY` | Repository in `owner/repository` format |
| `GITHUB_BACKUP_TOKEN` | Fine-grained GitHub token restricted to this repository, with Actions write access |

Deploy `trigger-database-backup` through the normal `main` Supabase pipeline. Never expose
these values as `VITE_*` variables. Run the workflow once manually and perform a test restore
before relying on it for releases.

## Secrets

Never commit real `.env` files, service role keys, VAPID private keys, or personal access tokens. Store production secrets only in Vercel/Supabase dashboards.
