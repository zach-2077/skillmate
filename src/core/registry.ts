import type { SearchResult as StoreSearchResult } from '../store.js';

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
