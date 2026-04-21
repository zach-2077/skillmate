# skills-gov Phase 2: Discovery + install

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `Search` and `Detail` screens, the skills.sh registry client, and the install action. End of Phase 2 the user can browse popular skills, type to search, open a detail screen with the SKILL.md preview, and install with `[i]` — all wired through the existing wrapper layer from Phase 1.

**Architecture:** New `core/registry.ts` module owns all skills.sh + GitHub raw I/O. Store gains search-related state and an `ops` map for in-flight installs. New screens (`Search`, `Detail`) added; existing `Installed` screen unchanged. Markdown rendering uses `marked-terminal` to produce ANSI strings rendered inside an Ink `<Text>` block.

**Tech Stack additions:** `marked` + `marked-terminal` (markdown → ANSI), `node-fetch` is not needed (Node 20 has `fetch`).

**Spec:** `docs/superpowers/specs/2026-04-21-skills-gov-tui-design.md`
**Depends on:** Phase 1 complete and shipped on `main`.

**Phase 2 deliverable:** `pnpm dev` launches; press `/` or `[2]` to open Search; type a query; results appear from skills.sh; Enter on a row opens Detail with the SKILL.md preview; `[i]` opens install prompt; confirm to install; toast confirms and the new skill shows up in `Installed`.

---

## Task 1: Extend the store

**Files:**
- Modify: `src/store.ts`
- Modify: `tests/store.test.ts`

Add screens (`search`, `detail`), search state, popular list state, ops map, and toasts.

- [ ] **Step 1: Update `tests/store.test.ts` with new test cases**

Append:
```ts
import type { State } from '../src/store.js';

describe('reducer (Phase 2)', () => {
  it('updates search query', () => {
    const next = reducer(initialState, { type: 'search/query', payload: 'react' });
    expect(next.searchQuery).toBe('react');
  });

  it('stores search results', () => {
    const next = reducer(initialState, {
      type: 'search/results',
      payload: { query: 'react', results: [{ id: 'a/b/c', skillId: 'c', name: 'c', source: 'a/b', installs: 1 }] },
    });
    expect(next.searchResults).toHaveLength(1);
    expect(next.searching).toBe(false);
  });

  it('stores popular list', () => {
    const next = reducer(initialState, {
      type: 'popular/loaded',
      payload: [{ id: 'a/b/c', skillId: 'c', name: 'c', source: 'a/b', installs: 0 }],
    });
    expect(next.popular).toHaveLength(1);
  });

  it('selects skill for detail', () => {
    const next = reducer(initialState, {
      type: 'detail/select',
      payload: { id: 'a/b/c', skillId: 'c', name: 'c', source: 'a/b', installs: 1 },
    });
    expect(next.detail?.id).toBe('a/b/c');
  });

  it('records and clears ops', () => {
    const start = reducer(initialState, { type: 'op/start', payload: { id: 'a/b/c', kind: 'install' } });
    expect(start.ops['a/b/c']).toMatchObject({ kind: 'install', state: 'running' });
    const done = reducer(start, { type: 'op/done', payload: { id: 'a/b/c' } });
    expect(done.ops['a/b/c']).toBeUndefined();
  });

  it('records op error', () => {
    const start = reducer(initialState, { type: 'op/start', payload: { id: 'a/b/c', kind: 'install' } });
    const err = reducer(start, { type: 'op/error', payload: { id: 'a/b/c', message: 'boom' } });
    expect(err.ops['a/b/c']).toMatchObject({ state: 'error', message: 'boom' });
  });

  it('pushes and dismisses toasts', () => {
    const pushed = reducer(initialState, { type: 'toast/push', payload: { id: 't1', kind: 'info', text: 'hi' } });
    expect(pushed.toasts).toHaveLength(1);
    const dismissed = reducer(pushed, { type: 'toast/dismiss', payload: 't1' });
    expect(dismissed.toasts).toHaveLength(0);
  });

  it('switches screen to search and detail', () => {
    expect(reducer(initialState, { type: 'screen/show', payload: 'search' }).screen).toBe('search');
    expect(reducer(initialState, { type: 'screen/show', payload: 'detail' }).screen).toBe('detail');
  });
});
```

- [ ] **Step 2: Run tests to confirm failures**

Run:
```bash
pnpm test tests/store.test.ts
```

Expected: failures mentioning `search/query`, `search/results`, etc. unhandled by reducer (or type errors on `State` shape).

- [ ] **Step 3: Replace `src/store.ts`**

```ts
import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { InstalledSkill } from './core/installed.js';
import type { AgentId } from './core/agents.js';

export type Screen = 'installed' | 'search' | 'detail';

export interface SearchResult {
  id: string;        // "owner/repo/skillId"
  skillId: string;
  name: string;
  source: string;    // "owner/repo"
  installs: number;
}

export interface OpState {
  kind: 'install' | 'remove' | 'update';
  state: 'running' | 'error';
  message?: string;
}

export interface Toast {
  id: string;
  kind: 'info' | 'error' | 'success';
  text: string;
}

export interface State {
  screen: Screen;
  currentAgent: AgentId;
  installed: InstalledSkill[];
  loadingInstalled: boolean;
  installedError: string | null;
  searchQuery: string;
  searching: boolean;
  searchError: string | null;
  searchResults: SearchResult[];
  popular: SearchResult[];
  detail: SearchResult | null;
  ops: Record<string, OpState>;
  toasts: Toast[];
}

export type Action =
  | { type: 'installed/loading' }
  | { type: 'installed/loaded'; payload: InstalledSkill[] }
  | { type: 'installed/error'; payload: string }
  | { type: 'agent/select'; payload: AgentId }
  | { type: 'screen/show'; payload: Screen }
  | { type: 'search/query'; payload: string }
  | { type: 'search/loading' }
  | { type: 'search/results'; payload: { query: string; results: SearchResult[] } }
  | { type: 'search/error'; payload: string }
  | { type: 'popular/loaded'; payload: SearchResult[] }
  | { type: 'detail/select'; payload: SearchResult }
  | { type: 'op/start'; payload: { id: string; kind: OpState['kind'] } }
  | { type: 'op/done'; payload: { id: string } }
  | { type: 'op/error'; payload: { id: string; message: string } }
  | { type: 'toast/push'; payload: Toast }
  | { type: 'toast/dismiss'; payload: string };

export const initialState: State = {
  screen: 'installed',
  currentAgent: 'claude',
  installed: [],
  loadingInstalled: false,
  installedError: null,
  searchQuery: '',
  searching: false,
  searchError: null,
  searchResults: [],
  popular: [],
  detail: null,
  ops: {},
  toasts: [],
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'installed/loading':
      return { ...state, loadingInstalled: true, installedError: null };
    case 'installed/loaded':
      return { ...state, installed: action.payload, loadingInstalled: false };
    case 'installed/error':
      return { ...state, installedError: action.payload, loadingInstalled: false };
    case 'agent/select':
      return { ...state, currentAgent: action.payload };
    case 'screen/show':
      return { ...state, screen: action.payload };
    case 'search/query':
      return { ...state, searchQuery: action.payload };
    case 'search/loading':
      return { ...state, searching: true, searchError: null };
    case 'search/results':
      return state.searchQuery === action.payload.query
        ? { ...state, searching: false, searchResults: action.payload.results }
        : state;
    case 'search/error':
      return { ...state, searching: false, searchError: action.payload };
    case 'popular/loaded':
      return { ...state, popular: action.payload };
    case 'detail/select':
      return { ...state, detail: action.payload };
    case 'op/start':
      return {
        ...state,
        ops: { ...state.ops, [action.payload.id]: { kind: action.payload.kind, state: 'running' } },
      };
    case 'op/done': {
      const { [action.payload.id]: _, ...rest } = state.ops;
      return { ...state, ops: rest };
    }
    case 'op/error':
      return {
        ...state,
        ops: {
          ...state.ops,
          [action.payload.id]: {
            kind: state.ops[action.payload.id]?.kind ?? 'install',
            state: 'error',
            message: action.payload.message,
          },
        },
      };
    case 'toast/push':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'toast/dismiss':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };
    default:
      return state;
  }
}

const StoreContext = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function StoreProvider({ children, override }: { children: ReactNode; override?: Partial<State> }) {
  const [state, dispatch] = useReducer(reducer, { ...initialState, ...override });
  return React.createElement(StoreContext.Provider, { value: { state, dispatch } }, children);
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be inside StoreProvider');
  return ctx;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm test tests/store.test.ts
```

Expected: all assertions (Phase 1 + Phase 2) pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(store): extend with search, detail, ops, toasts"
```

---

## Task 2: `core/registry.ts` — search API client

**Files:**
- Create: `src/core/registry.ts`
- Create: `tests/core/registry.test.ts`

Phase 2 builds the registry module across three tasks (search, popular, raw fetch). This task ships search only.

- [ ] **Step 1: Write the failing test**

`tests/core/registry.test.ts`:
```ts
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
  beforeEach(() => fetchMock.mockReset());

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
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test tests/core/registry.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement `src/core/registry.ts` (search portion only)**

```ts
export interface SearchResult {
  id: string;
  skillId: string;
  name: string;
  source: string;
  installs: number;
}

interface SkillsSearchResponse {
  query: string;
  searchType: string;
  skills: SearchResult[];
}

export async function searchSkills(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  if (query.length < 2) return [];
  const url = `https://skills.sh/api/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`search failed: ${res.status}`);
  }
  const body = (await res.json()) as SkillsSearchResponse;
  return body.skills;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test tests/core/registry.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add skills.sh search client"
```

---

## Task 3: `core/registry.ts` — popular list

**Files:**
- Modify: `src/core/registry.ts`
- Modify: `tests/core/registry.test.ts`
- Create: `src/data/popular-fallback.json`
- Create: `tests/fixtures/skills-sh-home.html` (a small captured snippet)

Popular list strategy: 6h cache → scrape `https://skills.sh/` HTML → bundled fallback.

- [ ] **Step 1: Create fixture file**

`tests/fixtures/skills-sh-home.html`:
```html
<html><body>
<a href="/anthropics/skills/pdf">pdf</a>
<a href="/anthropics/skills/docx">docx</a>
<a href="/vercel-labs/agent-skills/react-best-practices">react-best-practices</a>
<a href="/_next/static/chunks/foo.js">ignore</a>
<a href="/anthropics/skills/xlsx">xlsx</a>
</body></html>
```

- [ ] **Step 2: Create bundled fallback**

`src/data/popular-fallback.json`:
```json
[
  { "id": "anthropics/skills/pdf", "skillId": "pdf", "name": "pdf", "source": "anthropics/skills", "installs": 0 },
  { "id": "anthropics/skills/docx", "skillId": "docx", "name": "docx", "source": "anthropics/skills", "installs": 0 },
  { "id": "vercel-labs/agent-skills/react-best-practices", "skillId": "react-best-practices", "name": "react-best-practices", "source": "vercel-labs/agent-skills", "installs": 0 }
]
```

- [ ] **Step 3: Add tests**

Append to `tests/core/registry.test.ts`:
```ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { popularFromHtml, fetchPopular, FALLBACK_POPULAR } from '../../src/core/registry.js';

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
```

- [ ] **Step 4: Implement popular logic in `src/core/registry.ts`**

Append:
```ts
import { readFileSync as readSyncFs, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import fallback from '../data/popular-fallback.json' with { type: 'json' };

export const FALLBACK_POPULAR: SearchResult[] = fallback as SearchResult[];

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
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
pnpm test tests/core/registry.test.ts
```

Expected: 9 tests pass (5 search + 2 popularFromHtml + 1 FALLBACK + 3 fetchPopular = 11; adjust if count differs).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): add popular list scrape + cache + fallback"
```

---

## Task 4: `core/registry.ts` — SKILL.md raw fetch

**Files:**
- Modify: `src/core/registry.ts`
- Modify: `tests/core/registry.test.ts`

Fetches `SKILL.md` body from `raw.githubusercontent.com`, with `main` → `master` fallback and on-disk cache.

- [ ] **Step 1: Add tests**

Append:
```ts
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
```

- [ ] **Step 2: Implement SKILL.md fetch in `src/core/registry.ts`**

Append:
```ts
const SKILL_MD_TTL_MS = 24 * 60 * 60 * 1000;

export interface FetchSkillMdOpts {
  cacheDir: string;
  signal?: AbortSignal;
  force?: boolean;
}

export async function fetchSkillMd(id: string, opts: FetchSkillMdOpts): Promise<string | null> {
  const [owner, repo, ...rest] = id.split('/');
  if (!owner || !repo || rest.length === 0) return null;
  const skillPath = rest.join('/');
  const cachePath = join(opts.cacheDir, owner, repo, `${skillPath}.md`);

  if (!opts.force && existsSync(cachePath)) {
    try {
      const stat = readSyncFs(cachePath, 'utf8');
      // simple TTL via mtime would require fs.statSync; embed ts at top
      const newlineIdx = stat.indexOf('\n');
      const ts = Number.parseInt(stat.slice(0, newlineIdx), 10);
      if (!Number.isNaN(ts) && Date.now() - ts < SKILL_MD_TTL_MS) {
        return stat.slice(newlineIdx + 1);
      }
    } catch {
      // fall through
    }
  }

  for (const branch of ['main', 'master'] as const) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${skillPath}/SKILL.md`;
    const res = await fetch(url, { signal: opts.signal });
    if (res.ok) {
      const body = await res.text();
      mkdirSync(join(opts.cacheDir, owner, repo), { recursive: true });
      writeFileSync(cachePath, `${Date.now()}\n${body}`);
      return body;
    }
    if (res.status !== 404) {
      // network error or rate limit — fail soft
      return null;
    }
  }
  return null;
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run:
```bash
pnpm test tests/core/registry.test.ts
```

Expected: all registry tests green (~16 tests total).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(core): add SKILL.md raw fetch with cache + branch fallback"
```

---

## Task 5: `components/Toast.tsx`

**Files:**
- Create: `src/components/Toast.tsx`

A small fixed-region toast list rendered above the footer. Auto-dismiss handled in screen-level effect, not in this component.

- [ ] **Step 1: Create `src/components/Toast.tsx`**

```tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { Toast as ToastType } from '../store.js';

const COLOR_BY_KIND: Record<ToastType['kind'], string> = {
  info: 'blue',
  success: 'green',
  error: 'red',
};

export function ToastList({ toasts }: { toasts: ToastType[] }): React.ReactElement | null {
  if (toasts.length === 0) return null;
  return (
    <Box flexDirection="column" paddingX={1}>
      {toasts.map((t) => (
        <Text key={t.id} color={COLOR_BY_KIND[t.kind]}>
          {t.kind === 'error' ? '✗' : '•'} {t.text}
        </Text>
      ))}
    </Box>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

Run:
```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ui): add ToastList component"
```

---

## Task 6: `screens/Search.tsx` — render + debounced input + popular fallback

**Files:**
- Create: `src/screens/Search.tsx`
- Create: `tests/screens/Search.test.tsx`
- Modify: `src/app.tsx` (kick off `fetchPopular` on mount; route to search screen)

This task delivers the search screen with results list and popular fallback. Install prompt is added in Task 7.

- [ ] **Step 1: Add cache-dir helper**

Modify `src/core/registry.ts` — add at top of file:
```ts
import { homedir } from 'os';
export const DEFAULT_CACHE_DIR = join(homedir(), '.cache', 'skills-gov');
```

- [ ] **Step 2: Write the failing test**

`tests/screens/Search.test.tsx`:
```tsx
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Search } from '../../src/screens/Search.js';
import { StoreProvider } from '../../src/store.js';

vi.mock('../../src/core/registry.js', () => ({
  searchSkills: vi.fn().mockResolvedValue([
    { id: 'a/b/c', skillId: 'c', name: 'react-magic', source: 'a/b', installs: 999 },
  ]),
  fetchPopular: vi.fn().mockResolvedValue([]),
  fetchSkillMd: vi.fn(),
  DEFAULT_CACHE_DIR: '/tmp/skills-gov-test',
}));

describe('Search screen', () => {
  it('shows popular list when query is empty', () => {
    const popular = [{ id: 'p/q/r', skillId: 'r', name: 'popular-skill', source: 'p/q', installs: 1 }];
    const { lastFrame } = render(
      <StoreProvider override={{ screen: 'search', popular }}>
        <Search />
      </StoreProvider>,
    );
    expect(lastFrame()).toContain('popular-skill');
    expect(lastFrame()).toMatch(/popular/i);
  });

  it('shows search results when query has 2+ chars', () => {
    const results = [{ id: 'a/b/c', skillId: 'c', name: 'react-magic', source: 'a/b', installs: 999 }];
    const { lastFrame } = render(
      <StoreProvider override={{ screen: 'search', searchQuery: 'rea', searchResults: results }}>
        <Search />
      </StoreProvider>,
    );
    expect(lastFrame()).toContain('react-magic');
  });

  it('shows searching indicator', () => {
    const { lastFrame } = render(
      <StoreProvider override={{ screen: 'search', searchQuery: 'rea', searching: true }}>
        <Search />
      </StoreProvider>,
    );
    expect(lastFrame()).toMatch(/searching/i);
  });

  it('shows error when search fails', () => {
    const { lastFrame } = render(
      <StoreProvider override={{ screen: 'search', searchQuery: 'rea', searchError: 'offline' }}>
        <Search />
      </StoreProvider>,
    );
    expect(lastFrame()).toContain('offline');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:
```bash
pnpm test tests/screens/Search.test.tsx
```

Expected: module not found.

- [ ] **Step 4: Implement `src/screens/Search.tsx`**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useStore, type SearchResult } from '../store.js';
import { searchSkills, DEFAULT_CACHE_DIR } from '../core/registry.js';
import { Header } from '../components/Header.js';
import { Footer } from '../components/Footer.js';
import { agents } from '../core/agents.js';

const FOOTER_KEYS: ReadonlyArray<[string, string]> = [
  ['↑↓', 'move'],
  ['enter', 'detail'],
  ['esc', 'back'],
  ['q', 'quit'],
];

const DEBOUNCE_MS = 250;

export function Search(): React.ReactElement {
  const { state, dispatch } = useStore();
  const [cursor, setCursor] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (state.searchQuery.length < 2) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      dispatch({ type: 'search/loading' });
      searchSkills(state.searchQuery, ctl.signal)
        .then((results) =>
          dispatch({ type: 'search/results', payload: { query: state.searchQuery, results } }),
        )
        .catch((err: Error) => {
          if (err.name !== 'AbortError') dispatch({ type: 'search/error', payload: err.message });
        });
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.searchQuery, dispatch]);

  useInput((input, key) => {
    if (key.escape) {
      dispatch({ type: 'screen/show', payload: 'installed' });
      return;
    }
    if (key.upArrow) return setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) {
      const list = currentList(state);
      return setCursor((c) => Math.min(list.length - 1, c + 1));
    }
    if (key.return) {
      const list = currentList(state);
      const selected = list[cursor];
      if (selected) {
        dispatch({ type: 'detail/select', payload: selected });
        dispatch({ type: 'screen/show', payload: 'detail' });
      }
      return;
    }
    if (input === 'q') process.exit(0);
    if (key.backspace || key.delete) {
      dispatch({ type: 'search/query', payload: state.searchQuery.slice(0, -1) });
      return;
    }
    if (input && input.length === 1 && !key.ctrl && !key.meta) {
      dispatch({ type: 'search/query', payload: state.searchQuery + input });
    }
  });

  const list = currentList(state);
  const showingPopular = state.searchQuery.length < 2;

  return (
    <Box flexDirection="column">
      <Header agent={agents[state.currentAgent]?.displayName ?? state.currentAgent} />
      <Box paddingX={1}>
        <Text>search: </Text>
        <Text>{state.searchQuery}</Text>
        <Text inverse> </Text>
      </Box>
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {showingPopular && <Text dimColor>popular skills</Text>}
        {state.searching && <Text dimColor>searching…</Text>}
        {state.searchError && <Text color="red">{state.searchError}</Text>}
        {list.map((r, i) => (
          <Box key={r.id}>
            <Text color={i === cursor ? 'cyan' : undefined}>{i === cursor ? '▸ ' : '  '}</Text>
            <Box width={32}><Text bold={i === cursor}>{r.name}</Text></Box>
            <Box width={28}><Text dimColor>{r.source}</Text></Box>
            <Text dimColor>{r.installs > 0 ? `${r.installs}` : ''}</Text>
          </Box>
        ))}
      </Box>
      <Footer keys={FOOTER_KEYS} />
    </Box>
  );
}

function currentList(state: ReturnType<typeof useStore>['state']): SearchResult[] {
  return state.searchQuery.length < 2 ? state.popular : state.searchResults;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
pnpm test tests/screens/Search.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 6: Wire popular load + screen routing in `src/app.tsx`**

Replace `src/app.tsx`:
```tsx
import React, { useEffect } from 'react';
import { useInput } from 'ink';
import { StoreProvider, useStore } from './store.js';
import { Installed } from './screens/Installed.js';
import { Search } from './screens/Search.js';
import { refreshInstalled } from './core/installed.js';
import { fetchPopular, DEFAULT_CACHE_DIR } from './core/registry.js';

function GlobalKeys(): null {
  const { state, dispatch } = useStore();
  useInput((input, key) => {
    if (input === '/' && state.screen !== 'search') {
      dispatch({ type: 'screen/show', payload: 'search' });
    }
    if (input === '2' && state.screen !== 'search') {
      dispatch({ type: 'screen/show', payload: 'search' });
    }
    if (input === '1' && state.screen !== 'installed') {
      dispatch({ type: 'screen/show', payload: 'installed' });
    }
  });
  return null;
}

function Router(): React.ReactElement {
  const { state, dispatch } = useStore();

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'installed/loading' });
    refreshInstalled()
      .then((skills) => !cancelled && dispatch({ type: 'installed/loaded', payload: skills }))
      .catch((err: Error) => !cancelled && dispatch({ type: 'installed/error', payload: err.message }));
    fetchPopular({ cacheDir: DEFAULT_CACHE_DIR })
      .then((p) => !cancelled && dispatch({ type: 'popular/loaded', payload: p }))
      .catch(() => {/* fallback baked in */});
    return () => { cancelled = true; };
  }, [dispatch]);

  return (
    <>
      <GlobalKeys />
      {state.screen === 'installed' && <Installed />}
      {state.screen === 'search' && <Search />}
      {state.screen === 'detail' && <Search />}
    </>
  );
}

export function App(): React.ReactElement {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  );
}
```

(Note: `detail` temporarily routes to `Search` until Task 9 lands the `Detail` screen.)

- [ ] **Step 7: Run all tests**

Run:
```bash
pnpm test
```

Expected: green.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): add Search screen, popular fallback, global routing"
```

---

## Task 7: Install action + inline prompt

**Files:**
- Modify: `src/screens/Search.tsx`
- Modify: `tests/screens/Search.test.tsx`
- Create: `src/core/install.ts`
- Create: `tests/core/install.test.ts`

The `[i]` keybind opens an inline prompt. Confirming dispatches `op/start`, spawns `npx skills add`, then refreshes installed and toasts.

- [ ] **Step 1: Write `src/core/install.ts` test first**

`tests/core/install.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const runMock = vi.fn();
vi.mock('../../src/core/skills-cli.js', () => ({ runSkillsCli: (...a: unknown[]) => runMock(...a) }));

import { buildAddArgs, installSkill } from '../../src/core/install.js';

describe('buildAddArgs', () => {
  it('builds args with multiple agents and global scope', () => {
    expect(buildAddArgs({ id: 'a/b/c', agents: ['claude', 'cursor'], scope: 'global' })).toEqual([
      'add', 'a/b/c', '-a', 'claude', '-a', 'cursor', '-g', '-y',
    ]);
  });

  it('omits -g for project scope', () => {
    expect(buildAddArgs({ id: 'a/b/c', agents: ['claude'], scope: 'project' })).toEqual([
      'add', 'a/b/c', '-a', 'claude', '-y',
    ]);
  });
});

describe('installSkill', () => {
  beforeEach(() => runMock.mockReset());

  it('resolves on exit 0', async () => {
    runMock.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' });
    await expect(installSkill({ id: 'a/b/c', agents: ['claude'], scope: 'global' })).resolves.toBeUndefined();
  });

  it('rejects on non-zero exit with stderr', async () => {
    runMock.mockResolvedValue({ exitCode: 2, stdout: '', stderr: 'no such repo' });
    await expect(installSkill({ id: 'x/y/z', agents: ['claude'], scope: 'global' })).rejects.toThrow(/no such repo/);
  });
});
```

- [ ] **Step 2: Implement `src/core/install.ts`**

```ts
import { runSkillsCli } from './skills-cli.js';
import type { AgentId } from './agents.js';

export interface InstallOpts {
  id: string;
  agents: AgentId[];
  scope: 'global' | 'project';
}

export function buildAddArgs(opts: InstallOpts): string[] {
  const args = ['add', opts.id];
  for (const a of opts.agents) args.push('-a', a);
  if (opts.scope === 'global') args.push('-g');
  args.push('-y');
  return args;
}

export async function installSkill(opts: InstallOpts, signal?: AbortSignal): Promise<void> {
  const result = await runSkillsCli(buildAddArgs(opts), { signal });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.split('\n')[0] || `skills add failed (${result.exitCode})`);
  }
}
```

- [ ] **Step 3: Run install tests**

```bash
pnpm test tests/core/install.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 4: Add install-prompt UI to `src/screens/Search.tsx`**

Replace the `useInput` and bottom region of `Search.tsx`:

Add at top of file:
```tsx
import { installSkill } from '../core/install.js';
import { refreshInstalled } from '../core/installed.js';
import { knownAgentIds } from '../core/agents.js';
```

Replace the existing `useInput` block:
```tsx
const [prompt, setPrompt] = useState<{
  result: SearchResult;
  agents: Set<string>;
  scope: 'global' | 'project';
} | null>(null);

useInput((input, key) => {
  if (prompt) {
    if (key.escape) return setPrompt(null);
    if (key.return) {
      const opts = { id: prompt.result.id, agents: [...prompt.agents], scope: prompt.scope };
      const opId = prompt.result.id;
      dispatch({ type: 'op/start', payload: { id: opId, kind: 'install' } });
      setPrompt(null);
      void (async () => {
        try {
          await installSkill(opts);
          dispatch({ type: 'op/done', payload: { id: opId } });
          dispatch({
            type: 'toast/push',
            payload: { id: `t-${Date.now()}`, kind: 'success', text: `installed ${opts.id}` },
          });
          const fresh = await refreshInstalled();
          dispatch({ type: 'installed/loaded', payload: fresh });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          dispatch({ type: 'op/error', payload: { id: opId, message: msg } });
          dispatch({
            type: 'toast/push',
            payload: { id: `t-${Date.now()}`, kind: 'error', text: msg },
          });
        }
      })();
      return;
    }
    if (input === ' ') {
      // toggle nothing yet — Phase 2 keeps default agents; per-agent toggles in Phase 3 settings
      return;
    }
    return;
  }

  if (key.escape) return dispatch({ type: 'screen/show', payload: 'installed' });
  if (key.upArrow) return setCursor((c) => Math.max(0, c - 1));
  if (key.downArrow) {
    const list = currentList(state);
    return setCursor((c) => Math.min(list.length - 1, c + 1));
  }
  if (key.return) {
    const list = currentList(state);
    const selected = list[cursor];
    if (selected) {
      dispatch({ type: 'detail/select', payload: selected });
      dispatch({ type: 'screen/show', payload: 'detail' });
    }
    return;
  }
  if (input === 'i') {
    const list = currentList(state);
    const selected = list[cursor];
    if (selected) {
      setPrompt({
        result: selected,
        agents: new Set([state.currentAgent]),
        scope: 'global',
      });
    }
    return;
  }
  if (input === 'q') process.exit(0);
  if (key.backspace || key.delete) {
    return dispatch({ type: 'search/query', payload: state.searchQuery.slice(0, -1) });
  }
  if (input && input.length === 1 && !key.ctrl && !key.meta) {
    dispatch({ type: 'search/query', payload: state.searchQuery + input });
  }
});
```

Add the prompt UI just before `<Footer />`:
```tsx
{prompt && (
  <Box flexDirection="column" borderStyle="single" paddingX={1} marginX={1}>
    <Text>Install {prompt.result.id}</Text>
    <Text dimColor>Targets: {[...prompt.agents].join(', ')}</Text>
    <Text dimColor>Scope: {prompt.scope}</Text>
    <Text dimColor>[enter] confirm   [esc] cancel</Text>
  </Box>
)}
```

(Phase 3 expands the prompt into a real agent picker; Phase 2 ships it minimal.)

- [ ] **Step 5: Add a test for the prompt opening**

Append to `tests/screens/Search.test.tsx`:
```tsx
import { vi } from 'vitest';

it('opens install prompt on [i]', () => {
  const popular = [{ id: 'p/q/r', skillId: 'r', name: 'popular-skill', source: 'p/q', installs: 1 }];
  const { lastFrame, stdin } = render(
    <StoreProvider override={{ screen: 'search', popular, currentAgent: 'claude' }}>
      <Search />
    </StoreProvider>,
  );
  stdin.write('i');
  expect(lastFrame()).toMatch(/Install p\/q\/r/);
});
```

- [ ] **Step 6: Run tests**

```bash
pnpm test
```

Expected: green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): add install action with inline prompt"
```

---

## Task 8: `screens/Detail.tsx` — markdown preview

**Files:**
- Create: `src/screens/Detail.tsx`
- Create: `tests/screens/Detail.test.tsx`
- Modify: `src/app.tsx` (route `detail` to `Detail`)
- Modify: `package.json` (add `marked`, `marked-terminal`)

- [ ] **Step 1: Add markdown deps**

```bash
pnpm add marked marked-terminal
pnpm add -D @types/marked-terminal
```

- [ ] **Step 2: Write the failing test**

`tests/screens/Detail.test.tsx`:
```tsx
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Detail } from '../../src/screens/Detail.js';
import { StoreProvider } from '../../src/store.js';

vi.mock('../../src/core/registry.js', () => ({
  fetchSkillMd: vi.fn().mockResolvedValue('---\nname: x\n---\n# Hello\n\nbody.'),
  DEFAULT_CACHE_DIR: '/tmp/skills-gov-detail',
}));

describe('Detail screen', () => {
  it('shows search-entry header with source + installs', async () => {
    const detail = { id: 'a/b/c', skillId: 'c', name: 'c', source: 'a/b', installs: 99 };
    const { lastFrame } = render(
      <StoreProvider override={{ screen: 'detail', detail }}>
        <Detail />
      </StoreProvider>,
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(lastFrame()).toContain('a/b');
    expect(lastFrame()).toContain('99');
  });

  it('shows preview-unavailable when fetch returns null', async () => {
    const detail = { id: 'x/y/z', skillId: 'z', name: 'z', source: 'x/y', installs: 0 };
    const { fetchSkillMd } = await import('../../src/core/registry.js');
    (fetchSkillMd as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const { lastFrame } = render(
      <StoreProvider override={{ screen: 'detail', detail }}>
        <Detail />
      </StoreProvider>,
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(lastFrame()).toMatch(/preview unavailable/i);
    expect(lastFrame()).toContain('npx skills add x/y/z');
  });
});
```

- [ ] **Step 3: Implement `src/screens/Detail.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { useStore } from '../store.js';
import { fetchSkillMd, DEFAULT_CACHE_DIR } from '../core/registry.js';
import { Footer } from '../components/Footer.js';

marked.setOptions({ renderer: new TerminalRenderer() as never });

const FOOTER_KEYS: ReadonlyArray<[string, string]> = [
  ['↑↓', 'scroll'],
  ['i', 'install'],
  ['esc', 'back'],
  ['q', 'quit'],
];

export function Detail(): React.ReactElement {
  const { state, dispatch } = useStore();
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!state.detail) return;
    let cancelled = false;
    setLoading(true);
    fetchSkillMd(state.detail.id, { cacheDir: DEFAULT_CACHE_DIR })
      .then((text) => { if (!cancelled) { setBody(text); setLoading(false); } })
      .catch(() => { if (!cancelled) { setBody(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [state.detail?.id]);

  useInput((input, key) => {
    if (key.escape) dispatch({ type: 'screen/show', payload: 'search' });
    if (input === 'q') process.exit(0);
  });

  const detail = state.detail;
  if (!detail) return <Text>no skill selected</Text>;

  const rendered = body ? marked.parse(body) as string : null;

  return (
    <Box flexDirection="column">
      <Box paddingX={1} justifyContent="space-between">
        <Text bold>{detail.name} · {detail.source}</Text>
        <Text dimColor>{detail.installs > 0 ? `${detail.installs}` : ''}</Text>
      </Box>
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {loading && <Text dimColor>loading preview…</Text>}
        {!loading && body === null && (
          <>
            <Text dimColor>preview unavailable</Text>
            <Text>npx skills add {detail.id}</Text>
          </>
        )}
        {!loading && rendered && <Text>{rendered}</Text>}
      </Box>
      <Footer keys={FOOTER_KEYS} />
    </Box>
  );
}
```

- [ ] **Step 4: Update `src/app.tsx` Router**

Replace the screen switch in `Router`:
```tsx
{state.screen === 'installed' && <Installed />}
{state.screen === 'search' && <Search />}
{state.screen === 'detail' && <Detail />}
```

Add import:
```tsx
import { Detail } from './screens/Detail.js';
```

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): add Detail screen with markdown preview"
```

---

## Task 9: Toast auto-dismiss + render in screens

**Files:**
- Modify: `src/app.tsx`
- Modify: `src/screens/Installed.tsx`
- Modify: `src/screens/Search.tsx`

Toasts dismiss after 3s via a single global timer effect. Render them between the body and the footer in each screen.

- [ ] **Step 1: Add toast dismiss effect to `src/app.tsx`**

In `Router`, after the existing `useEffect`:
```tsx
useEffect(() => {
  if (state.toasts.length === 0) return;
  const timers = state.toasts.map((t) =>
    setTimeout(() => dispatch({ type: 'toast/dismiss', payload: t.id }), 3000),
  );
  return () => timers.forEach(clearTimeout);
}, [state.toasts, dispatch]);
```

- [ ] **Step 2: Render `<ToastList />` in screens**

In `src/screens/Installed.tsx`, add import:
```tsx
import { ToastList } from '../components/Toast.js';
```

Just before `<Footer />`:
```tsx
<ToastList toasts={state.toasts} />
```

Same for `src/screens/Search.tsx` and `src/screens/Detail.tsx`.

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: green (existing tests still pass; toast rendering is additive and doesn't break frame matching).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): render toast list in screens with auto-dismiss"
```

---

## Task 10: End-to-end smoke

**Files:**
- Create: `tests/e2e/phase2.test.ts` (mock-only, in-process)

Validates the user flow: open search → query → install → installed list refreshes.

- [ ] **Step 1: Write the smoke test**

`tests/e2e/phase2.test.ts`:
```ts
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

vi.mock('../../src/core/installed.js', () => ({
  refreshInstalled: vi.fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ name: 'react-magic', description: '', scope: 'global', agents: ['claude'], path: '/p' }]),
}));
vi.mock('../../src/core/registry.js', () => ({
  searchSkills: vi.fn().mockResolvedValue([{ id: 'a/b/react-magic', skillId: 'react-magic', name: 'react-magic', source: 'a/b', installs: 5 }]),
  fetchPopular: vi.fn().mockResolvedValue([]),
  fetchSkillMd: vi.fn().mockResolvedValue('# react-magic'),
  DEFAULT_CACHE_DIR: '/tmp/x',
}));
vi.mock('../../src/core/install.js', () => ({
  installSkill: vi.fn().mockResolvedValue(undefined),
  buildAddArgs: vi.fn(),
}));

import { App } from '../../src/app.js';

describe('Phase 2 smoke', () => {
  it('search → install → installed refresh', async () => {
    const { lastFrame, stdin } = render(<App />);
    await new Promise((r) => setTimeout(r, 40));
    stdin.write('/');
    await new Promise((r) => setTimeout(r, 10));
    'react'.split('').forEach((c) => stdin.write(c));
    await new Promise((r) => setTimeout(r, 350));
    expect(lastFrame()).toContain('react-magic');
    stdin.write('i');
    await new Promise((r) => setTimeout(r, 10));
    expect(lastFrame()).toMatch(/Install a\/b\/react-magic/);
    stdin.write('\r');
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toMatch(/installed a\/b\/react-magic/);
  });
});
```

- [ ] **Step 2: Run the smoke test**

```bash
pnpm test tests/e2e/phase2.test.ts
```

Expected: 1 test passes.

- [ ] **Step 3: Run the full suite**

```bash
pnpm test
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: add Phase 2 end-to-end smoke"
```

---

## Phase 2 acceptance

- `pnpm test` → all green.
- `pnpm dev` → can press `/` to enter search, type a query, see results from skills.sh, press Enter to open Detail (markdown rendered), press `i` to install, see toast and the new skill in `Installed`.
- Detail screen falls back to "preview unavailable" gracefully when both `main` and `master` 404.
- Empty state shows popular skills loaded from skills.sh (or bundled fallback when offline).

## What Phase 3 adds (preview)

- `core/config.ts`, `screens/Settings.tsx`, first-run flow.
- Remove (`[d]`) and Update (`[u]`) actions in Installed.
- Confirmation prompt when `confirmRemove` setting is on.
- Fatal startup error screen (no Node/npx).
- Help overlay (`?`).
- Integration tests against real `npx skills` in tmpdir.
- Distribution: README, CI, npm publish prep.
