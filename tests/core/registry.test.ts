import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { searchSkills, type SearchResult } from '../../src/core/registry.js';

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
