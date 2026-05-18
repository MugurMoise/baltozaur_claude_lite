import type { LakeScore } from '../types/lake';

const STOP_WORDS = new Set(['balta', 'lacul', 'lac', 'iazul', 'iaz', 'din', 'de', 'la', 'si']);

function normalizeWord(word: string) {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function baseCode(name: string) {
  const words = name.split(/\s+/).map(normalizeWord).filter(Boolean);
  const meaningful = words.filter((word) => !STOP_WORDS.has(word));
  const source = meaningful.length > 0 ? meaningful : words;

  if (source.length === 0) return 'lake';
  if (source.length === 1 && words.length === 1) return source[0].slice(0, 8).padEnd(4, 'x');

  const tail = source[source.length - 1];
  const tailIndex = words.lastIndexOf(tail);
  const prefixWords = tailIndex > 0 ? words.slice(0, tailIndex) : words.slice(0, -1);
  const prefix = prefixWords.map((word) => word[0]).join('').slice(0, 3);
  const tailPart = tail.slice(0, 8 - prefix.length);
  return `${prefix}${tailPart}`.slice(0, 8).padEnd(4, 'x');
}

export function createLakeCodeMap(lakes: LakeScore[]) {
  const used = new Set<string>();
  const sorted = [...lakes].sort((a, b) => a.name.localeCompare(b.name));
  const codes = new Map<string, string>();

  sorted.forEach((lake) => {
    const base = baseCode(lake.name);
    let code = base;
    let counter = 2;

    while (used.has(code)) {
      const suffix = String(counter);
      code = `${base.slice(0, 8 - suffix.length)}${suffix}`;
      counter += 1;
    }

    used.add(code);
    codes.set(lake.lake_id, code);
  });

  return codes;
}
