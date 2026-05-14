# 🦕 Baltozaur

**Live carp fishing conditions for lakes around Bucharest, Romania.**

## Quick Start

```bash
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://ecgscjtczbtvkqrdogoo.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

> ⚠️ Never commit `.env` to git. The `.env.example` is safe to commit.

## Supabase Table

The app reads from `latest_lake_scores` view/table with these columns:

| Column | Type | Description |
|---|---|---|
| id | uuid/text | Primary key |
| name | text | Lake name |
| county | text | Romanian county |
| distance_km | float | Distance from Bucharest |
| lat / lon | float | Coordinates |
| score | float | 0–100 fishing score |
| temperature | float | Water/air temp °C |
| temperature_delta | float | Change since last calc |
| pressure | float | Atmospheric pressure hPa |
| pressure_delta | float | Change since last calc |
| wind_speed | float | km/h |
| feeding_windows | text[] / jsonb | Array of time strings |
| calculated_at | timestamptz | Last calculation time |

## Score System

- 🟢 **70–100** — Excellent conditions
- 🟡 **40–70** — Fair conditions  
- 🔴 **0–40** — Poor conditions

## Fishing Logic

- **Falling pressure** (pressure_delta < 0) → positive for carp feeding
- **Rising pressure** (pressure_delta > 0) → negative
- **Stable/cooling temp** → positive
- **Rising temp** → negative

## Deploy to Vercel

```bash
npm run build
vercel deploy
```

Set environment variables in Vercel dashboard under Project Settings → Environment Variables.

## Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Supabase JS client
- Leaflet + react-leaflet
- Auto-refresh every 60 seconds
