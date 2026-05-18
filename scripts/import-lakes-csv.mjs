import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

function usage() {
  console.log(`
Usage:
  npm run import:lakes -- <csv-file> [--env=dev|prod] [--scores] [--dry-run] [--batch-size=10]

Examples:
  npm run import:lakes -- data/additional_commercial_lakes_2026-05-18.csv --env=dev --dry-run
  npm run import:lakes -- data/additional_commercial_lakes_2026-05-18.csv --env=dev --scores
  npm run import:lakes -- data/lakes.csv --env=prod
`);
}

function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

const fileArg = args.find((arg) => !arg.startsWith('--'));
if (hasFlag('help')) {
  usage();
  process.exit(0);
}

if (!fileArg) {
  usage();
  process.exit(1);
}

const appEnv = getArg('env', 'dev');
if (!['dev', 'prod'].includes(appEnv)) {
  throw new Error('--env must be dev or prod');
}

const shouldCalculateScores = hasFlag('scores');
const dryRun = hasFlag('dry-run');
const batchSize = Number(getArg('batch-size', '10'));
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10) {
  throw new Error('--batch-size must be an integer between 1 and 10');
}

function loadDotEnv() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(value);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
}

function normaliseHeader(header) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function nullable(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function keyFor(row) {
  const lat = row.lat == null ? '' : Number(row.lat).toFixed(6);
  const lon = row.lon == null ? '' : Number(row.lon).toFixed(6);
  return `${row.name}|${row.county}|${lat}|${lon}`.toLowerCase();
}

function toLake(row) {
  const sourceParts = [
    row.source_url ? `Sursa: ${row.source_url}` : null,
    row.locality ? `localitate: ${row.locality}` : null,
    row.source_date ? `verificat/extras la ${row.source_date}` : null,
  ].filter(Boolean);

  return {
    name: nullable(row.name),
    county: nullable(row.county) ?? 'Necunoscut',
    distance_km: numberOrNull(row.distance_km),
    lat: numberOrNull(row.lat),
    lon: numberOrNull(row.lon),
    lake_type: nullable(row.lake_type) ?? 'commercial',
    description: nullable(row.description) ?? (sourceParts.length ? sourceParts.join('; ') : null),
    website_url: nullable(row.website_url),
    facebook_url: nullable(row.facebook_url),
    phone: nullable(row.phone),
    rules: nullable(row.rules),
    price: nullable(row.price),
  };
}

async function supabaseFetch(pathname, options = {}) {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env.');
  }

  const response = await fetch(`${url}${pathname}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${pathname} failed (${response.status}): ${await response.text()}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function importLakes(lakes) {
  const table = appEnv === 'dev' ? 'dev_lakes' : 'lakes';
  if (dryRun) {
    console.log(`Dry run: would import ${lakes.length} lakes into ${table}.`);
    return { table, inserted: 0 };
  }

  const existing = await supabaseFetch(`/rest/v1/${table}?select=name,county,lat,lon`);
  const existingKeys = new Set((existing ?? []).map(keyFor));
  const newLakes = lakes.filter((lake) => !existingKeys.has(keyFor(lake)));

  if (newLakes.length === 0) {
    console.log(`No new lakes to insert into ${table}.`);
    return { table, inserted: 0 };
  }

  await supabaseFetch(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(newLakes),
  });

  console.log(`Inserted ${newLakes.length} lakes into ${table}.`);
  return { table, inserted: newLakes.length };
}

async function calculateScores() {
  const count = await supabaseFetch(`/rest/v1/${appEnv === 'dev' ? 'dev_lakes' : 'lakes'}?select=id`, {
    headers: { Prefer: 'count=exact' },
  });
  const total = Array.isArray(count) ? count.length : 0;

  for (let offset = 0; offset < total; offset += batchSize) {
    const result = await supabaseFetch(
      `/functions/v1/calculate-scores?env=${appEnv}&limit=${batchSize}&offset=${offset}`,
      { method: 'POST' },
    );
    console.log(`Scores ${appEnv} offset=${offset}: processed ${result.processed}`);
  }
}

loadDotEnv();

const csvPath = path.resolve(fileArg);
const parsed = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const headers = parsed[0].map(normaliseHeader);
const rows = parsed.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
const lakes = rows.map(toLake).filter((lake) => lake.name && lake.lat != null && lake.lon != null);

if (lakes.length === 0) {
  throw new Error(`No valid lake rows found in ${fileArg}. Required columns: name, county, lat, lon.`);
}

console.log(`Parsed ${lakes.length} valid lakes from ${fileArg}.`);
await importLakes(lakes);

if (shouldCalculateScores) {
  if (dryRun) {
    console.log(`Dry run: would calculate ${appEnv} scores in batches of ${batchSize}.`);
    process.exit(0);
  }
  await calculateScores();
}
