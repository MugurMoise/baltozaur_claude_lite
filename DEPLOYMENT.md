# Dev and Production Workflow

Baltozaur uses two Git branches and two Supabase branches:

| Environment | Git branch | Vercel target | Supabase branch |
| --- | --- | --- | --- |
| Development | `dev` | Preview / `dev.baltozaur.ro` | `dev` |
| Production | `main` | Production / `baltozaur.ro` | production |

## Local Development

Use the Supabase `dev` branch locally.

1. Copy `.env.example` to `.env`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase `dev` branch API settings.
3. Run:

```bash
npm install
npm run dev
```

Local `.env` files are ignored by Git.

## Vercel Environment Variables

In Vercel Project Settings, configure the same variable names for different targets:

| Variable | Preview / Development | Production |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase `dev` branch URL | Supabase production URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase `dev` branch anon key | Supabase production anon key |
| `VITE_VAPID_PUBLIC_KEY` | dev VAPID public key | prod VAPID public key |

Use `main` as the production branch in Vercel. Pushes to `dev` should create preview deployments.

## Supabase Branching

In Supabase:

1. Enable Branching for the production project.
2. Create or connect a branch named `dev`.
3. Connect the Supabase `dev` branch to the GitHub `dev` branch if using the Supabase GitHub integration.
4. Keep database schema changes in `supabase/migrations`.
5. Test migrations and Edge Functions on `dev` before merging to `main`.

Preview branches do not automatically copy production data. Add safe seed/test data to the dev branch for testing.

## Release Flow

1. Work on `dev`.
2. Test against the Supabase `dev` branch and Vercel preview.
3. Merge `dev` into `main`.
4. Vercel deploys `main` to `baltozaur.ro`.
5. Supabase production receives approved migrations/functions through the configured workflow.

## Secrets

Never commit real `.env` files, service role keys, VAPID private keys, or personal access tokens. Store production secrets only in Vercel/Supabase dashboards.
