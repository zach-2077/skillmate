import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { searchSkills, type SearchResult, popularFromHtml, fetchPopular, FALLBACK_POPULAR, fetchSkillMd } from '../../src/core/registry.js';

function fakeJson(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  } as unknown as Response;
}

describe('searchSkills', () => {
  beforeEach(() => { fetchMock.mockReset(); });

  it('hits skills.sh with the query', async () => {
    fetchMock.mockResolvedValue(fakeJson({ query: 'react', searchType: 'fuzzy', skills: [] }));
    await searchSkills('react');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://skills.sh/api/search?q=react',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('parses results into SearchResult shape', async () => {
    fetchMock.mockResolvedValue(
      fakeJson({
        query: 'react',
        searchType: 'fuzzy',
        skills: [{ id: 'a/b/c', skillId: 'c', name: 'c', source: 'a/b', installs: 42 }],
      }),
    );
    const results: SearchResult[] = await searchSkills('react');
    expect(results).toEqual([{ id: 'a/b/c', skillId: 'c', name: 'c', source: 'a/b', installs: 42 }]);
  });

  it('returns empty array on <2 char query without hitting network', async () => {
    const results = await searchSkills('a');
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on non-2xx', async () => {
    fetchMock.mockResolvedValue(fakeJson({ error: 'bad' }, false, 500));
    await expect(searchSkills('react')).rejects.toThrow();
  });

  it('passes through abort signal', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation((_url: string, opts: RequestInit) => {
      expect(opts.signal).toBe(controller.signal);
      return Promise.resolve(fakeJson({ query: 'react', searchType: 'fuzzy', skills: [] }));
    });
    await searchSkills('react', controller.signal);
  });
});

describe('popularFromHtml', () => {
  it('extracts owner/repo/skill paths and dedupes static chunks', () => {
    const html = readFileSync(join(__dirname, '../fixtures/skills-sh-home.html'), 'utf8');
    const parsed = popularFromHtml(html);
    expect(parsed.map((p) => p.id)).toEqual([
      'anthropics/skills/pdf',
      'anthropics/skills/docx',
      'vercel-labs/agent-skills/react-best-practices',
      'anthropics/skills/xlsx',
    ]);
  });

  it('caps at 10', () => {
    const lines = Array.from({ length: 15 }, (_, i) => `<a href="/o/r/s${i}">s${i}</a>`).join('\n');
    expect(popularFromHtml(lines)).toHaveLength(10);
  });
});

describe('FALLBACK_POPULAR', () => {
  it('contains some known-good entries', () => {
    expect(FALLBACK_POPULAR.length).toBeGreaterThan(0);
    expect(FALLBACK_POPULAR[0]).toHaveProperty('source');
  });
});

describe('fetchPopular', () => {
  let cacheDir: string;
  beforeEach(() => {
    fetchMock.mockReset();
    cacheDir = mkdtempSync(join(tmpdir(), 'skills-gov-cache-'));
  });
  afterEach(() => rmSync(cacheDir, { recursive: true, force: true }));

  it('returns cached value if fresh', async () => {
    mkdirSync(cacheDir, { recursive: true });
    const cached = [{ id: 'cached/x/y', skillId: 'y', name: 'y', source: 'cached/x', installs: 0 }];
    writeFileSync(join(cacheDir, 'popular.json'), JSON.stringify({ ts: Date.now(), data: cached }));
    const result = await fetchPopular({ cacheDir });
    expect(result).toEqual(cached);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('scrapes when cache is stale and writes new cache', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => readFileSync(join(__dirname, '../fixtures/skills-sh-home.html'), 'utf8'),
    } as Response);
    const result = await fetchPopular({ cacheDir });
    expect(result.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith('https://skills.sh/', expect.any(Object));
  });

  it('falls back to bundled list on scrape failure', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const result = await fetchPopular({ cacheDir });
    expect(result).toEqual(FALLBACK_POPULAR);
  });
});

describe('fetchSkillMd', () => {
  let cacheDir: string;
  beforeEach(() => {
    fetchMock.mockReset();
    cacheDir = mkdtempSync(join(tmpdir(), 'skills-gov-skillmd-'));
  });
  afterEach(() => rmSync(cacheDir, { recursive: true, force: true }));

  it('fetches main first', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '# hello' } as Response);
    const body = await fetchSkillMd('a/b/c', { cacheDir });
    expect(body).toBe('# hello');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/a/b/main/c/SKILL.md',
      expect.any(Object),
    );
  });

  it('falls back to master on 404', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: true, text: async () => '# from master' } as Response);
    const body = await fetchSkillMd('a/b/c', { cacheDir });
    expect(body).toBe('# from master');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://raw.githubusercontent.com/a/b/master/c/SKILL.md',
      expect.any(Object),
    );
  });

  it('returns null when both branches 404', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 } as Response);
    const body = await fetchSkillMd('a/b/c', { cacheDir });
    expect(body).toBeNull();
  });

  it('uses cache on second call within TTL', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '# cached' } as Response);
    await fetchSkillMd('a/b/c', { cacheDir });
    fetchMock.mockClear();
    const body = await fetchSkillMd('a/b/c', { cacheDir });
    expect(body).toBe('# cached');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes when force=true', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '# v1' } as Response);
    await fetchSkillMd('a/b/c', { cacheDir });
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '# v2' } as Response);
    const body = await fetchSkillMd('a/b/c', { cacheDir, force: true });
    expect(body).toBe('# v2');
  });
});
