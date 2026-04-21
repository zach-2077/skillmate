# skills-gov Phase 3: Settings, management, polish, distribution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v1 management surface (Settings screen, first-run flow, Remove and Update actions), add resilience (fatal startup screen, help overlay), close the test pyramid with one real-`npx skills` integration test, and prepare the package for `npm publish`.

**Architecture:** New `core/config.ts` owns XDG config persistence. New `core/detect-agents.ts` runs filesystem checks to find which agents the user has. `Settings` screen reads/writes config; `App` runs first-run logic before initial render. `Installed` screen wires `[d]` and `[u]` to existing `runSkillsCli`. A single integration test against a real installed `npx skills` proves the wrapping contract end-to-end.

**Tech Stack additions:** `xdg-basedir` for XDG paths (matches upstream's dep set).

**Spec:** `docs/superpowers/specs/2026-04-21-skills-gov-tui-design.md`
**Depends on:** Phase 2 complete and shipped on `main`.

**Phase 3 deliverable:** First launch detects agents, drops user into Settings to confirm; subsequent launches skip straight to Installed using the saved config. `[d]` removes a skill (with optional confirmation), `[u]` updates it. `?` shows a help overlay. Missing Node/npx shows a fatal screen with setup instructions. Integration test installs and removes a real skill in a tmpdir. `pnpm pack && npm publish --dry-run` produces a publishable tarball.

---

## Task 1: `core/config.ts` — XDG read/write

**Files:**
- Create: `src/core/config.ts`
- Create: `tests/core/config.test.ts`

- [ ] **Step 1: Add `xdg-basedir`**

```bash
pnpm add xdg-basedir
```

- [ ] **Step 2: Write the failing test**

`tests/core/config.test.ts`:
```ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig, saveConfig, defaultConfig, type Config } from '../../src/core/config.js';

describe('config', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sg-config-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null when no config file exists', () => {
    expect(loadConfig({ dir })).toBeNull();
  });

  it('round-trips a saved config', () => {
    const cfg: Config = {
      defaultAgents: ['claude', 'cursor'],
      defaultScope: 'global',
      confirmRemove: true,
      autoUpdate: false,
      currentAgent: 'claude',
    };
    saveConfig(cfg, { dir });
    expect(loadConfig({ dir })).toEqual(cfg);
  });

  it('overlays partial saved config on defaults', () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ confirmRemove: false }));
    const loaded = loadConfig({ dir });
    expect(loaded).not.toBeNull();
    expect(loaded!.confirmRemove).toBe(false);
    expect(loaded!.defaultScope).toBe(defaultConfig.defaultScope);
  });

  it('returns null on corrupt JSON', () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), '{not json');
    expect(loadConfig({ dir })).toBeNull();
  });

  it('creates the directory on save', () => {
    saveConfig(defaultConfig, { dir });
    expect(existsSync(join(dir, 'config.json'))).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test tests/core/config.test.ts
```

Expected: module not found.

- [ ] **Step 4: Implement `src/core/config.ts`**

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { xdgConfig } from 'xdg-basedir';
import type { AgentId } from './agents.js';

export interface Config {
  defaultAgents: AgentId[];
  defaultScope: 'global' | 'project';
  confirmRemove: boolean;
  autoUpdate: boolean;
  currentAgent: AgentId;
}

export const defaultConfig: Config = {
  defaultAgents: [],
  defaultScope: 'global',
  confirmRemove: true,
  autoUpdate: false,
  currentAgent: 'claude',
};

export const DEFAULT_CONFIG_DIR = join(xdgConfig ?? join(process.env.HOME ?? '.', '.config'), 'skills-gov');

export interface IoOpts { dir?: string }

function configPath(opts?: IoOpts): string {
  return join(opts?.dir ?? DEFAULT_CONFIG_DIR, 'config.json');
}

export function loadConfig(opts?: IoOpts): Config | null {
  const path = configPath(opts);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as Partial<Config>;
    return { ...defaultConfig, ...parsed };
  } catch {
    return null;
  }
}

export function saveConfig(cfg: Config, opts?: IoOpts): void {
  const dir = opts?.dir ?? DEFAULT_CONFIG_DIR;
  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath(opts), JSON.stringify(cfg, null, 2));
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm test tests/core/config.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): add XDG config read/write"
```

---

## Task 2: `core/detect-agents.ts` — first-run agent detection

**Files:**
- Create: `src/core/detect-agents.ts`
- Create: `tests/core/detect-agents.test.ts`

Detect installed agents by checking for the agent's directory under `~/`. Cheap and good enough for v1.

- [ ] **Step 1: Write the failing test**

`tests/core/detect-agents.test.ts`:
```ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { detectAgents } from '../../src/core/detect-agents.js';

describe('detectAgents', () => {
  let home: string;
  beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'sg-home-')); });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it('returns empty when no agent dirs exist', () => {
    expect(detectAgents({ home })).toEqual([]);
  });

  it('detects claude when ~/.claude exists', () => {
    mkdirSync(join(home, '.claude'));
    expect(detectAgents({ home })).toContain('claude');
  });

  it('detects multiple agents', () => {
    mkdirSync(join(home, '.claude'));
    mkdirSync(join(home, '.cursor'));
    expect(detectAgents({ home }).sort()).toEqual(['claude', 'cursor']);
  });
});
```

- [ ] **Step 2: Implement `src/core/detect-agents.ts`**

```ts
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { agents, knownAgentIds, type AgentId } from './agents.js';

export interface DetectOpts { home?: string }

export function detectAgents(opts?: DetectOpts): AgentId[] {
  const home = opts?.home ?? homedir();
  return knownAgentIds.filter((id) => existsSync(join(home, agents[id]!.dirName)));
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm test tests/core/detect-agents.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(core): add agent detection from home directory"
```

---

## Task 3: Extend store with config

**Files:**
- Modify: `src/store.ts`
- Modify: `tests/store.test.ts`

Add `config` to state and a `config/load` action. Settings screen also dispatches `config/save`.

- [ ] **Step 1: Add tests**

Append to `tests/store.test.ts`:
```ts
import type { Config } from '../src/core/config.js';

describe('reducer (Phase 3)', () => {
  it('loads config', () => {
    const cfg: Config = { defaultAgents: ['claude'], defaultScope: 'global', confirmRemove: false, autoUpdate: true, currentAgent: 'cursor' };
    const next = reducer(initialState, { type: 'config/load', payload: cfg });
    expect(next.config).toEqual(cfg);
    expect(next.currentAgent).toBe('cursor');
  });

  it('switches screen to settings', () => {
    expect(reducer(initialState, { type: 'screen/show', payload: 'settings' }).screen).toBe('settings');
  });
});
```

- [ ] **Step 2: Update `src/store.ts`**

Modify the relevant types/cases:
```ts
import type { Config } from './core/config.js';

export type Screen = 'installed' | 'search' | 'detail' | 'settings';

export interface State {
  // ... existing fields ...
  config: Config | null;
}

export type Action =
  | { type: 'config/load'; payload: Config }
  // ... existing actions ...

export const initialState: State = {
  // ... existing ...
  config: null,
};

// In reducer:
case 'config/load':
  return { ...state, config: action.payload, currentAgent: action.payload.currentAgent };
```

- [ ] **Step 3: Run tests**

```bash
pnpm test tests/store.test.ts
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(store): add config state and settings screen route"
```

---

## Task 4: `screens/Settings.tsx`

**Files:**
- Create: `src/screens/Settings.tsx`
- Create: `tests/screens/Settings.test.tsx`

Renders the config form. `[space]` toggles checkboxes/radios; `[enter]` saves and exits to installed; `[esc]` reverts and exits.

- [ ] **Step 1: Write the failing test**

`tests/screens/Settings.test.tsx`:
```tsx
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Settings } from '../../src/screens/Settings.js';
import { StoreProvider } from '../../src/store.js';

vi.mock('../../src/core/config.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/core/config.js')>('../../src/core/config.js');
  return { ...actual, saveConfig: vi.fn() };
});
vi.mock('../../src/core/detect-agents.js', () => ({
  detectAgents: vi.fn().mockReturnValue(['claude', 'cursor']),
}));

describe('Settings screen', () => {
  it('renders detected agents as toggleable rows', () => {
    const { lastFrame } = render(
      <StoreProvider override={{ screen: 'settings', config: null }}>
        <Settings />
      </StoreProvider>,
    );
    expect(lastFrame()).toContain('Claude Code');
    expect(lastFrame()).toContain('Cursor');
  });

  it('shows scope radios', () => {
    const { lastFrame } = render(
      <StoreProvider override={{ screen: 'settings', config: null }}>
        <Settings />
      </StoreProvider>,
    );
    expect(lastFrame()).toMatch(/global/);
    expect(lastFrame()).toMatch(/project/);
  });

  it('toggles agent on space', () => {
    const { lastFrame, stdin } = render(
      <StoreProvider override={{ screen: 'settings', config: null }}>
        <Settings />
      </StoreProvider>,
    );
    stdin.write(' ');
    expect(lastFrame()).toMatch(/\[ \] Claude Code|\[x\] Claude Code/);
  });

  it('saves and exits on enter', async () => {
    const { saveConfig } = await import('../../src/core/config.js');
    const { stdin } = render(
      <StoreProvider override={{ screen: 'settings', config: null }}>
        <Settings />
      </StoreProvider>,
    );
    stdin.write('\r');
    expect(saveConfig).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement `src/screens/Settings.tsx`**

```tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useStore } from '../store.js';
import { agents, knownAgentIds, type AgentId } from '../core/agents.js';
import { detectAgents } from '../core/detect-agents.js';
import { saveConfig, defaultConfig, type Config } from '../core/config.js';
import { Header } from '../components/Header.js';
import { Footer } from '../components/Footer.js';

const FOOTER_KEYS: ReadonlyArray<[string, string]> = [
  ['↑↓', 'move'],
  ['space', 'toggle'],
  ['enter', 'save'],
  ['esc', 'cancel'],
];

interface Row {
  kind: 'agent' | 'scope-global' | 'scope-project' | 'confirm-remove' | 'auto-update';
  label: string;
  agentId?: AgentId;
}

function buildRows(detected: AgentId[]): Row[] {
  return [
    ...detected.map<Row>((id) => ({ kind: 'agent', label: agents[id]!.displayName, agentId: id })),
    { kind: 'scope-global', label: 'global (~/<agent>/skills)' },
    { kind: 'scope-project', label: 'project (./<agent>/skills)' },
    { kind: 'confirm-remove', label: 'Confirm before remove' },
    { kind: 'auto-update', label: 'Auto-update on launch' },
  ];
}

export function Settings(): React.ReactElement {
  const { state, dispatch } = useStore();
  const detected = detectAgents();

  const initial: Config = state.config ?? {
    ...defaultConfig,
    defaultAgents: detected,
    currentAgent: detected[0] ?? 'claude',
  };
  const [draft, setDraft] = useState<Config>(initial);
  const [cursor, setCursor] = useState(0);

  const rows = buildRows(detected);

  useInput((input, key) => {
    if (key.upArrow) return setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) return setCursor((c) => Math.min(rows.length - 1, c + 1));
    if (key.escape) return dispatch({ type: 'screen/show', payload: 'installed' });
    if (key.return) {
      saveConfig(draft);
      dispatch({ type: 'config/load', payload: draft });
      dispatch({ type: 'screen/show', payload: 'installed' });
      return;
    }
    if (input === ' ') {
      const row = rows[cursor];
      if (!row) return;
      setDraft((d) => {
        switch (row.kind) {
          case 'agent': {
            const set = new Set(d.defaultAgents);
            if (set.has(row.agentId!)) set.delete(row.agentId!);
            else set.add(row.agentId!);
            return { ...d, defaultAgents: [...set] };
          }
          case 'scope-global': return { ...d, defaultScope: 'global' };
          case 'scope-project': return { ...d, defaultScope: 'project' };
          case 'confirm-remove': return { ...d, confirmRemove: !d.confirmRemove };
          case 'auto-update': return { ...d, autoUpdate: !d.autoUpdate };
        }
      });
    }
  });

  function checked(row: Row): string {
    switch (row.kind) {
      case 'agent': return draft.defaultAgents.includes(row.agentId!) ? '[x]' : '[ ]';
      case 'scope-global': return draft.defaultScope === 'global' ? '(•)' : '( )';
      case 'scope-project': return draft.defaultScope === 'project' ? '(•)' : '( )';
      case 'confirm-remove': return draft.confirmRemove ? '[x]' : '[ ]';
      case 'auto-update': return draft.autoUpdate ? '[x]' : '[ ]';
    }
  }

  return (
    <Box flexDirection="column">
      <Header agent={agents[state.currentAgent]?.displayName ?? state.currentAgent} />
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {rows.map((row, i) => (
          <Text key={i} color={i === cursor ? 'cyan' : undefined}>
            {i === cursor ? '▸ ' : '  '}{checked(row)} {row.label}
          </Text>
        ))}
      </Box>
      <Footer keys={FOOTER_KEYS} />
    </Box>
  );
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm test tests/screens/Settings.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add Settings screen"
```

---

## Task 5: First-run flow + config-aware app

**Files:**
- Modify: `src/app.tsx`
- Create: `tests/app-first-run.test.tsx`

On launch, load config. If absent → route to Settings (first-run). If present → route to Installed.

- [ ] **Step 1: Write the failing test**

`tests/app-first-run.test.tsx`:
```tsx
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

vi.mock('../src/core/config.js', () => ({
  loadConfig: vi.fn().mockReturnValue(null),
  saveConfig: vi.fn(),
  defaultConfig: { defaultAgents: [], defaultScope: 'global', confirmRemove: true, autoUpdate: false, currentAgent: 'claude' },
  DEFAULT_CONFIG_DIR: '/tmp/sg',
}));
vi.mock('../src/core/detect-agents.js', () => ({ detectAgents: vi.fn().mockReturnValue(['claude']) }));
vi.mock('../src/core/installed.js', () => ({ refreshInstalled: vi.fn().mockResolvedValue([]) }));
vi.mock('../src/core/registry.js', () => ({
  fetchPopular: vi.fn().mockResolvedValue([]),
  searchSkills: vi.fn().mockResolvedValue([]),
  fetchSkillMd: vi.fn().mockResolvedValue(null),
  DEFAULT_CACHE_DIR: '/tmp/cache',
}));

import { App } from '../src/app.js';

describe('App first-run', () => {
  it('lands on settings when no config exists', async () => {
    const { lastFrame } = render(<App />);
    await new Promise((r) => setTimeout(r, 30));
    expect(lastFrame()).toMatch(/global|project|Confirm/);
  });
});
```

- [ ] **Step 2: Add another test for the configured-user flow**

Append to the same file:
```tsx
describe('App configured', () => {
  it('skips settings when config exists', async () => {
    const { loadConfig } = await import('../src/core/config.js');
    (loadConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      defaultAgents: ['claude'], defaultScope: 'global', confirmRemove: true, autoUpdate: false, currentAgent: 'claude',
    });
    const { lastFrame } = render(<App />);
    await new Promise((r) => setTimeout(r, 30));
    expect(lastFrame()).toContain('skills-gov');
    expect(lastFrame()).not.toMatch(/Confirm before remove/);
  });
});
```

- [ ] **Step 3: Update `src/app.tsx` Router**

Replace the existing first `useEffect` block:
```tsx
useEffect(() => {
  let cancelled = false;
  const cfg = loadConfig();
  if (cfg) {
    dispatch({ type: 'config/load', payload: cfg });
  } else {
    dispatch({ type: 'screen/show', payload: 'settings' });
  }
  dispatch({ type: 'installed/loading' });
  refreshInstalled()
    .then((skills) => !cancelled && dispatch({ type: 'installed/loaded', payload: skills }))
    .catch((err: Error) => !cancelled && dispatch({ type: 'installed/error', payload: err.message }));
  fetchPopular({ cacheDir: DEFAULT_CACHE_DIR })
    .then((p) => !cancelled && dispatch({ type: 'popular/loaded', payload: p }))
    .catch(() => {});
  return () => { cancelled = true; };
}, [dispatch]);
```

Add imports:
```tsx
import { loadConfig } from './core/config.js';
import { Settings } from './screens/Settings.js';
```

Update screen switch:
```tsx
{state.screen === 'installed' && <Installed />}
{state.screen === 'search' && <Search />}
{state.screen === 'detail' && <Detail />}
{state.screen === 'settings' && <Settings />}
```

Add `[s]` to the global keys handler:
```tsx
if (input === 's' && state.screen !== 'settings') {
  dispatch({ type: 'screen/show', payload: 'settings' });
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: first-run flow + settings routing"
```

---

## Task 6: Remove action

**Files:**
- Create: `src/core/remove.ts`
- Create: `tests/core/remove.test.ts`
- Modify: `src/screens/Installed.tsx`

`[d]` on a row → optional confirmation (per `confirmRemove` setting) → spawn `npx skills remove` → toast → refresh.

- [ ] **Step 1: Write the failing core test**

`tests/core/remove.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
const runMock = vi.fn();
vi.mock('../../src/core/skills-cli.js', () => ({ runSkillsCli: (...a: unknown[]) => runMock(...a) }));
import { buildRemoveArgs, removeSkill } from '../../src/core/remove.js';

describe('buildRemoveArgs', () => {
  it('builds with agent and global flag', () => {
    expect(buildRemoveArgs({ name: 'pdf', agent: 'claude', scope: 'global' })).toEqual([
      'remove', 'pdf', '-a', 'claude', '-g', '-y',
    ]);
  });
  it('omits -g for project', () => {
    expect(buildRemoveArgs({ name: 'pdf', agent: 'claude', scope: 'project' })).toEqual([
      'remove', 'pdf', '-a', 'claude', '-y',
    ]);
  });
});

describe('removeSkill', () => {
  beforeEach(() => runMock.mockReset());
  it('resolves on exit 0', async () => {
    runMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
    await expect(removeSkill({ name: 'pdf', agent: 'claude', scope: 'global' })).resolves.toBeUndefined();
  });
  it('rejects on non-zero', async () => {
    runMock.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'nope' });
    await expect(removeSkill({ name: 'pdf', agent: 'claude', scope: 'global' })).rejects.toThrow(/nope/);
  });
});
```

- [ ] **Step 2: Implement `src/core/remove.ts`**

```ts
import { runSkillsCli } from './skills-cli.js';
import type { AgentId } from './agents.js';

export interface RemoveOpts {
  name: string;
  agent: AgentId;
  scope: 'global' | 'project';
}

export function buildRemoveArgs(opts: RemoveOpts): string[] {
  const args = ['remove', opts.name, '-a', opts.agent];
  if (opts.scope === 'global') args.push('-g');
  args.push('-y');
  return args;
}

export async function removeSkill(opts: RemoveOpts, signal?: AbortSignal): Promise<void> {
  const result = await runSkillsCli(buildRemoveArgs(opts), { signal });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.split('\n')[0] || `skills remove failed (${result.exitCode})`);
  }
}
```

- [ ] **Step 3: Run core tests**

```bash
pnpm test tests/core/remove.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 4: Wire `[d]` in `src/screens/Installed.tsx`**

Add imports:
```tsx
import { removeSkill } from '../core/remove.js';
import { refreshInstalled } from '../core/installed.js';
```

Add a `pendingRemove` state and prompt block. In `useInput`:
```tsx
const [pendingRemove, setPendingRemove] = useState<{ name: string; scope: 'global' | 'project' } | null>(null);

useInput((input, key) => {
  if (pendingRemove) {
    if (key.escape) return setPendingRemove(null);
    if (input === 'y' || key.return) {
      const target = pendingRemove;
      const opId = `${target.scope}:${target.name}:${state.currentAgent}`;
      setPendingRemove(null);
      dispatch({ type: 'op/start', payload: { id: opId, kind: 'remove' } });
      void (async () => {
        try {
          await removeSkill({ name: target.name, agent: state.currentAgent, scope: target.scope });
          dispatch({ type: 'op/done', payload: { id: opId } });
          dispatch({ type: 'toast/push', payload: { id: `t-${Date.now()}`, kind: 'success', text: `removed ${target.name}` } });
          const fresh = await refreshInstalled();
          dispatch({ type: 'installed/loaded', payload: fresh });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          dispatch({ type: 'op/error', payload: { id: opId, message: msg } });
          dispatch({ type: 'toast/push', payload: { id: `t-${Date.now()}`, kind: 'error', text: msg } });
        }
      })();
    }
    return;
  }

  // ... existing key handlers ...

  if (input === 'd') {
    const skill = filtered[cursor];
    if (skill) {
      const confirm = state.config?.confirmRemove ?? true;
      if (confirm) setPendingRemove({ name: skill.name, scope: skill.scope });
      else {
        // direct remove path
        removeSkill({ name: skill.name, agent: state.currentAgent, scope: skill.scope })
          .then(() => refreshInstalled().then((s) => dispatch({ type: 'installed/loaded', payload: s })))
          .catch((err: Error) => dispatch({ type: 'toast/push', payload: { id: `t-${Date.now()}`, kind: 'error', text: err.message } }));
      }
    }
  }
});
```

Render the prompt before `<ToastList />`:
```tsx
{pendingRemove && (
  <Box flexDirection="column" borderStyle="single" paddingX={1} marginX={1}>
    <Text>Remove {pendingRemove.name} ({pendingRemove.scope})?</Text>
    <Text dimColor>[y/enter] confirm   [esc] cancel</Text>
  </Box>
)}
```

Update footer keys to include `d`:
```tsx
const FOOTER_KEYS: ReadonlyArray<[string, string]> = [
  ['↑↓', 'move'],
  ['enter', 'detail'],
  ['tab', 'switch agent'],
  ['d', 'remove'],
  ['u', 'update'],
  ['q', 'quit'],
];
```

- [ ] **Step 5: Add a test for the remove prompt**

Append to `tests/screens/Installed.test.tsx`:
```tsx
it('opens remove prompt on [d]', () => {
  const { lastFrame, stdin } = render(
    <StoreProvider override={{
      installed: [{ name: 'pdf', description: '', scope: 'global', agents: ['claude'], path: '/p' }],
      currentAgent: 'claude',
      config: { defaultAgents: ['claude'], defaultScope: 'global', confirmRemove: true, autoUpdate: false, currentAgent: 'claude' },
    }}>
      <Installed />
    </StoreProvider>,
  );
  stdin.write('d');
  expect(lastFrame()).toMatch(/Remove pdf/);
});
```

- [ ] **Step 6: Run all tests**

```bash
pnpm test
```

Expected: green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add remove action with confirmation prompt"
```

---

## Task 7: Update action

**Files:**
- Create: `src/core/update.ts`
- Create: `tests/core/update.test.ts`
- Modify: `src/screens/Installed.tsx`

`[u]` on a row → spawn `npx skills update <name> -y` → toast → refresh. No confirmation prompt.

- [ ] **Step 1: Write the failing core test**

`tests/core/update.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
const runMock = vi.fn();
vi.mock('../../src/core/skills-cli.js', () => ({ runSkillsCli: (...a: unknown[]) => runMock(...a) }));
import { updateSkill } from '../../src/core/update.js';

describe('updateSkill', () => {
  beforeEach(() => runMock.mockReset());
  it('calls update with -y', async () => {
    runMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
    await updateSkill('pdf');
    expect(runMock).toHaveBeenCalledWith(['update', 'pdf', '-y'], expect.any(Object));
  });
  it('rejects on failure', async () => {
    runMock.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'oops' });
    await expect(updateSkill('pdf')).rejects.toThrow(/oops/);
  });
});
```

- [ ] **Step 2: Implement `src/core/update.ts`**

```ts
import { runSkillsCli } from './skills-cli.js';

export async function updateSkill(name: string, signal?: AbortSignal): Promise<void> {
  const result = await runSkillsCli(['update', name, '-y'], { signal });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.split('\n')[0] || `skills update failed (${result.exitCode})`);
  }
}
```

- [ ] **Step 3: Wire `[u]` in `src/screens/Installed.tsx`**

Add import:
```tsx
import { updateSkill } from '../core/update.js';
```

In `useInput` (after the `[d]` block):
```tsx
if (input === 'u') {
  const skill = filtered[cursor];
  if (skill) {
    const opId = `update:${skill.name}`;
    dispatch({ type: 'op/start', payload: { id: opId, kind: 'update' } });
    void (async () => {
      try {
        await updateSkill(skill.name);
        dispatch({ type: 'op/done', payload: { id: opId } });
        dispatch({ type: 'toast/push', payload: { id: `t-${Date.now()}`, kind: 'success', text: `updated ${skill.name}` } });
        const fresh = await refreshInstalled();
        dispatch({ type: 'installed/loaded', payload: fresh });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        dispatch({ type: 'op/error', payload: { id: opId, message: msg } });
        dispatch({ type: 'toast/push', payload: { id: `t-${Date.now()}`, kind: 'error', text: msg } });
      }
    })();
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add update action wired to [u]"
```

---

## Task 8: Fatal startup screen + help overlay

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/app.tsx`
- Create: `src/components/Help.tsx`

If `npx skills --version` fails on launch, render a fatal screen with setup instructions and exit. `?` toggles a help overlay listing all keybinds.

- [ ] **Step 1: Pre-flight check in `src/cli.ts`**

Replace `src/cli.ts`:
```ts
#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';
import { runSkillsCli } from './core/skills-cli.js';

async function preflight(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const result = await runSkillsCli(['--version']);
    if (result.exitCode !== 0) return { ok: false, reason: result.stderr.trim() || 'skills cli exited non-zero' };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

const check = await preflight();
if (!check.ok) {
  console.error('skills-gov: cannot find a working `skills` CLI');
  console.error(`reason: ${check.reason}`);
  console.error('install with: npm i -g skills');
  process.exit(1);
}

render(React.createElement(App));
```

- [ ] **Step 2: Create `src/components/Help.tsx`**

```tsx
import React from 'react';
import { Box, Text } from 'ink';

export function Help(): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold>skills-gov keybinds</Text>
      <Text>[1] installed   [2] search   [s] settings</Text>
      <Text>[/] focus search   [tab] switch agent   [esc] back</Text>
      <Text>installed:  [d] remove   [u] update   [enter] detail</Text>
      <Text>search:  [i] install   [enter] detail</Text>
      <Text>detail:  [↑↓] scroll   [i] install</Text>
      <Text>[?] toggle this help   [q] quit</Text>
    </Box>
  );
}
```

- [ ] **Step 3: Wire help toggle in `src/app.tsx`**

Add to the store state (in `src/store.ts`):
```ts
helpOpen: boolean;
```
And to `initialState`: `helpOpen: false`.

Action:
```ts
| { type: 'help/toggle' }
```

Reducer:
```ts
case 'help/toggle':
  return { ...state, helpOpen: !state.helpOpen };
```

In `src/app.tsx`'s `GlobalKeys`:
```tsx
if (input === '?') dispatch({ type: 'help/toggle' });
```

In Router, render Help on top:
```tsx
return (
  <>
    <GlobalKeys />
    {state.screen === 'installed' && <Installed />}
    {state.screen === 'search' && <Search />}
    {state.screen === 'detail' && <Detail />}
    {state.screen === 'settings' && <Settings />}
    {state.helpOpen && <Help />}
  </>
);
```

Add import in `src/app.tsx`:
```tsx
import { Help } from './components/Help.js';
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: green.

- [ ] **Step 5: Manual smoke**

```bash
pnpm dev
```

Press `?` — help overlay appears. Press `?` again — it disappears.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add fatal preflight + help overlay"
```

---

## Task 9: Integration test against real `npx skills`

**Files:**
- Create: `tests/integration/skills-cli.test.ts`
- Modify: `package.json` (add `test:integration` script)

This test runs against the real `skills` binary in a tmpdir. Slow (~10–20 s). Gated behind a separate script and tagged so unit `pnpm test` skips it.

- [ ] **Step 1: Add integration script**

In `package.json`, add:
```json
"test:integration": "vitest run --testPathPattern tests/integration"
```

And ensure `vitest.config.ts` `include` covers it (it already does via `tests/**/*.test.ts`).

Update the default `test` script to skip integration:
```json
"test": "vitest run --exclude tests/integration"
```

- [ ] **Step 2: Write the integration test**

`tests/integration/skills-cli.test.ts`:
```ts
import { describe, expect, it, beforeAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runSkillsCli } from '../../src/core/skills-cli.js';

describe('integration: real skills cli', () => {
  let tmp: string;
  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'sg-int-'));
    mkdirSync(join(tmp, '.claude'), { recursive: true });
  });

  it('runs --version', async () => {
    const result = await runSkillsCli(['--version'], { cwd: tmp });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('returns valid JSON for list', async () => {
    const result = await runSkillsCli(['list', '--json'], { cwd: tmp });
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(Array.isArray(parsed)).toBe(true);
  });
});
```

- [ ] **Step 3: Add `cwd` support to `runSkillsCli` if missing**

Already added in Phase 1 Task 4. Verify `RunOptions.cwd` is honored.

- [ ] **Step 4: Run integration**

```bash
pnpm test:integration
```

Expected: 2 tests pass (assuming `skills` is installed via `pnpm install`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: add integration tests against real skills cli"
```

---

## Task 10: README + CI + publish prep

**Files:**
- Create: `README.md`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`

- [ ] **Step 1: Create `README.md`**

```markdown
# skills-gov

Full-screen TUI for managing agent skills.

Wraps [skills](https://github.com/vercel-labs/skills) for write operations and reads installed state directly so the UI stays snappy. Targets the same skill ecosystem and registry ([skills.sh](https://skills.sh/)) as the upstream CLI.

## Install

```bash
npm i -g skills-gov
# or run without installing
npx skills-gov
```

Requires Node 20+.

## Use

- `[1]` Installed   `[2]` Search   `[s]` Settings
- `[tab]` switch agent (in Installed)
- `[/]` focus search input
- `[i]` install   `[d]` remove   `[u]` update
- `[?]` keybinds   `[q]` quit

First run drops you into Settings to confirm which agents and scope to use.

## Develop

```bash
pnpm install
pnpm dev          # run via tsx
pnpm test         # unit + tui tests
pnpm test:integration  # against real `skills` cli (slow)
pnpm build        # produce dist/cli.js
```
```

- [ ] **Step 2: Create CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }}, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm type-check
      - run: pnpm test
      - run: pnpm test:integration
      - run: pnpm build
```

- [ ] **Step 3: Verify the package builds and packs**

```bash
pnpm build
npm pack --dry-run
```

Expected: tarball lists `dist/`, `README.md`, `package.json`, no test files or sources.

- [ ] **Step 4: Smoke the published shape**

```bash
node dist/cli.js
```

Expected: full TUI launches and behaves as in dev.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add README, CI workflow, publish prep"
```

---

## Phase 3 acceptance

- `pnpm test` and `pnpm test:integration` both green.
- `pnpm dev` first-run lands in Settings; second run lands in Installed.
- `[d]` removes (with confirmation when configured); `[u]` updates; toasts confirm both.
- `?` toggles help overlay.
- Missing `skills` CLI shows a clear setup error and exits.
- `npm pack --dry-run` produces a clean tarball ready for `npm publish`.

## Done

This is v1. Items deliberately deferred:
- Skill creation (`init`)
- Lockfile workflows (`experimental_install`, `experimental_sync`)
- Plugin grouping in the Installed list
- GitHub OAuth for higher rate limits
- Mouse support / theming
- Telemetry
- Dim/light theme toggle
