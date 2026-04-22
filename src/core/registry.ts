import type { SearchResult as StoreSearchResult } from '../store.js';
import { readFileSync as readSyncFs, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

export type SearchResult = StoreSearchResult;

interface SkillsSearchResponse {
  query: string;
  searchType: string;
  skills: SearchResult[];
}

export async function searchSkills(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  if (query.length < 2) return [];
  const url = `https://skills.sh/api/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal: signal ?? new AbortController().signal });
  if (!res.ok) {
    throw new Error(`search failed: ${res.status}`);
  }
  const body = (await res.json()) as SkillsSearchResponse;
  return body.skills;
}

const _require = createRequire(import.meta.url);
export const FALLBACK_POPULAR: SearchResult[] = _require('../data/popular-fallback.json') as SearchResult[];

const POPULAR_TTL_MS = 6 * 60 * 60 * 1000;
const HREF_RE = /href="\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)"/g;
const SKIPPED_OWNERS = new Set(['_next']);

export function popularFromHtml(html: string): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const match of html.matchAll(HREF_RE)) {
    const [, owner, repo, skillId] = match;
    if (!owner || !repo || !skillId) continue;
    if (SKIPPED_OWNERS.has(owner)) continue;
    const id = `${owner}/${repo}/${skillId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, skillId, name: skillId, source: `${owner}/${repo}`, installs: 0 });
    if (out.length >= 10) break;
  }
  return out;
}

export async function fetchPopular(opts: { cacheDir: string; signal?: AbortSignal }): Promise<SearchResult[]> {
  const cachePath = join(opts.cacheDir, 'popular.json');
  if (existsSync(cachePath)) {
    try {
      const raw = readSyncFs(cachePath, 'utf8');
      const parsed = JSON.parse(raw) as { ts: number; data: SearchResult[] };
      if (Date.now() - parsed.ts < POPULAR_TTL_MS) return parsed.data;
    } catch {
      // fall through to fetch
    }
  }
  try {
    const res = await fetch('https://skills.sh/', { signal: opts.signal });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const html = await res.text();
    const parsed = popularFromHtml(html);
    if (parsed.length === 0) return FALLBACK_POPULAR;
    mkdirSync(opts.cacheDir, { recursive: true });
    writeFileSync(cachePath, JSON.stringify({ ts: Date.now(), data: parsed }));
    return parsed;
  } catch {
    return FALLBACK_POPULAR;
  }
}
