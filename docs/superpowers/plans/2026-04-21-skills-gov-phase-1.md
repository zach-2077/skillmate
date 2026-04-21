# skills-gov Phase 1: Read-only walking skeleton

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a runnable `skills-gov` TUI that shows the user's installed skills for a chosen agent, lets them `[tab]` to switch agents, and quit cleanly. No mutations, no search, no detail screen. End of Phase 1 is a working binary you can `npx` and use.

**Architecture:** Three layers — `core/` (pure TS, no Ink, all I/O), `store.ts` (reducer + context), `screens/` (Ink components, props-driven). `core/skills-cli.ts` shells out to upstream `skills` CLI for `list --json`; `core/installed.ts` parses YAML frontmatter from each `SKILL.md` path returned by the list. Phase 1 keeps the store tiny: `{installedByAgent, currentAgent, screen}`.

**Tech Stack:** TypeScript, Ink 5 (React for the terminal), `yaml` for frontmatter parsing, `tsup` for build, `vitest` + `ink-testing-library` for tests, `pnpm` for package management. Node 20+.

**Spec:** `docs/superpowers/specs/2026-04-21-skills-gov-tui-design.md`

**Phase 1 deliverable:** running `pnpm dev` opens the TUI; it lists installed skills for the auto-detected first available agent; `[tab]` cycles agents; `q` quits.

---

## Task 1: Initialize project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.prettierrc.json`

- [ ] **Step 1: Initialize git**

Run from `/Users/zach.zhou/codes/personal/skills_gov`:
```bash
git init
git branch -M main
```

Expected: `Initialized empty Git repository in .../skills_gov/.git/` and branch renamed.

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
dist/
.cache/
coverage/
*.log
.DS_Store
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "skills-gov",
  "version": "0.0.1",
  "description": "Full-screen TUI for managing agent skills",
  "type": "module",
  "bin": {
    "skills-gov": "./dist/cli.js"
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "type-check": "tsc --noEmit",
    "format": "prettier --write \"src/**/*.{ts,tsx}\" \"tests/**/*.{ts,tsx}\""
  },
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "ink": "^5.0.1",
    "react": "^18.3.1",
    "skills": "^1.5.1",
    "yaml": "^2.6.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^18.3.12",
    "ink-testing-library": "^4.0.0",
    "prettier": "^3.3.3",
    "tsup": "^8.3.5",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  },
  "packageManager": "pnpm@9.12.0"
}
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "jsx": "react",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 5: Create `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
  splitting: false,
  sourcemap: true,
});
```

- [ ] **Step 6: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
```

- [ ] **Step 7: Create `.prettierrc.json`**

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 8: Install dependencies**

Run:
```bash
pnpm install
```

Expected: lockfile created, `node_modules/` populated, no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: initialize skills-gov project"
```

---

## Task 2: Project entry skeleton

**Files:**
- Create: `src/cli.ts`
- Create: `src/app.tsx`

- [ ] **Step 1: Create `src/cli.ts`**

```ts
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';

render(React.createElement(App));
```

- [ ] **Step 2: Create `src/app.tsx`**

```tsx
import React from 'react';
import { Box, Text } from 'ink';

export function App(): React.ReactElement {
  return (
    <Box>
      <Text>skills-gov starting…</Text>
    </Box>
  );
}
```

- [ ] **Step 3: Run dev to verify**

Run:
```bash
pnpm dev
```

Expected: terminal prints `skills-gov starting…` and exits (no input loop yet — that's fine for now).

- [ ] **Step 4: Verify type-check passes**

Run:
```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: bootstrap ink app skeleton"
```

---

## Task 3: `core/agents.ts` — known-agent map

**Files:**
- Create: `src/core/agents.ts`
- Create: `tests/core/agents.test.ts`

The agent map is the single source of truth for which directory belongs to which agent and how it's displayed. Phase 1 ships a small list (claude, cursor, codex, opencode); upstream supports 45+ — we add more as they become relevant.

- [ ] **Step 1: Write the failing test**

`tests/core/agents.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { agents, displayNameToId, knownAgentIds } from '../../src/core/agents.js';

describe('agents map', () => {
  it('exposes claude with the right directory', () => {
    expect(agents.claude).toEqual({ id: 'claude', displayName: 'Claude Code', dirName: '.claude' });
  });

  it('exposes a list of known agent ids', () => {
    expect(knownAgentIds).toContain('claude');
    expect(knownAgentIds).toContain('cursor');
    expect(knownAgentIds.length).toBeGreaterThan(2);
  });

  it('reverse-maps display name to id', () => {
    expect(displayNameToId('Claude Code')).toBe('claude');
    expect(displayNameToId('Cursor')).toBe('cursor');
  });

  it('returns undefined for unknown display names', () => {
    expect(displayNameToId('NotARealAgent')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test tests/core/agents.test.ts
```

Expected: FAIL with `Cannot find module '../../src/core/agents.js'`.

- [ ] **Step 3: Implement `src/core/agents.ts`**

```ts
export type AgentId = string;

export interface Agent {
  id: AgentId;
  displayName: string;
  dirName: string;
}

export const agents: Record<string, Agent> = {
  claude: { id: 'claude', displayName: 'Claude Code', dirName: '.claude' },
  cursor: { id: 'cursor', displayName: 'Cursor', dirName: '.cursor' },
  codex: { id: 'codex', displayName: 'Codex', dirName: '.codex' },
  opencode: { id: 'opencode', displayName: 'OpenCode', dirName: '.opencode' },
};

export const knownAgentIds: AgentId[] = Object.keys(agents);

const displayNameIndex: Record<string, AgentId> = Object.fromEntries(
  Object.values(agents).map((a) => [a.displayName, a.id]),
);

export function displayNameToId(name: string): AgentId | undefined {
  return displayNameIndex[name];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test tests/core/agents.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add known-agent map"
```

---

## Task 4: `core/skills-cli.ts` — subprocess wrapper

**Files:**
- Create: `src/core/skills-cli.ts`
- Create: `tests/core/skills-cli.test.ts`

This wraps `child_process.spawn` so callers get `{exitCode, stdout, stderr}` and can pass an `AbortSignal`. Tests use `node:test`-friendly child-process mocking via `vi.mock`.

- [ ] **Step 1: Write the failing test**

`tests/core/skills-cli.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

const spawnMock = vi.fn();
vi.mock('child_process', () => ({ spawn: (...args: unknown[]) => spawnMock(...args) }));

import { runSkillsCli } from '../../src/core/skills-cli.js';

function fakeChild(opts: { stdout?: string; stderr?: string; exitCode?: number }) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: Readable;
    stderr: Readable;
    kill: (signal?: string) => void;
  };
  child.stdout = Readable.from([opts.stdout ?? '']);
  child.stderr = Readable.from([opts.stderr ?? '']);
  child.kill = vi.fn();
  setImmediate(() => child.emit('close', opts.exitCode ?? 0));
  return child;
}

describe('runSkillsCli', () => {
  beforeEach(() => spawnMock.mockReset());

  it('captures stdout, stderr, and exit code', async () => {
    spawnMock.mockReturnValue(fakeChild({ stdout: 'hello', stderr: 'warn', exitCode: 0 }));
    const result = await runSkillsCli(['list', '--json']);
    expect(result).toEqual({ exitCode: 0, stdout: 'hello', stderr: 'warn' });
    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringMatching(/(skills|npx)/),
      expect.arrayContaining(['list', '--json']),
      expect.any(Object),
    );
  });

  it('propagates non-zero exit code', async () => {
    spawnMock.mockReturnValue(fakeChild({ stderr: 'boom', exitCode: 2 }));
    const result = await runSkillsCli(['add', 'foo']);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe('boom');
  });

  it('aborts via signal', async () => {
    const controller = new AbortController();
    const child = fakeChild({});
    spawnMock.mockReturnValue(child);
    const promise = runSkillsCli(['add', 'foo'], { signal: controller.signal });
    controller.abort();
    await promise;
    expect(child.kill).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test tests/core/skills-cli.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `src/core/skills-cli.ts`**

```ts
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  signal?: AbortSignal;
  cwd?: string;
}

function resolveBin(): { cmd: string; prefix: string[] } {
  const local = join(process.cwd(), 'node_modules', '.bin', 'skills');
  if (existsSync(local)) return { cmd: local, prefix: [] };
  return { cmd: 'npx', prefix: ['skills'] };
}

export async function runSkillsCli(args: string[], opts: RunOptions = {}): Promise<RunResult> {
  const { cmd, prefix } = resolveBin();
  return new Promise((resolve) => {
    const child = spawn(cmd, [...prefix, ...args], {
      cwd: opts.cwd ?? process.cwd(),
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));

    const onAbort = () => child.kill('SIGINT');
    if (opts.signal) opts.signal.addEventListener('abort', onAbort, { once: true });

    child.on('close', (code) => {
      if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test tests/core/skills-cli.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add skills cli subprocess wrapper"
```

---

## Task 5: `core/installed.ts` — list parser

**Files:**
- Create: `src/core/installed.ts`
- Create: `tests/core/installed.test.ts`

Combines: parsing `npx skills list --json` output, parsing SKILL.md frontmatter for the description, and merging project + global lists.

- [ ] **Step 1: Write the failing test**

`tests/core/installed.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const runMock = vi.fn();
vi.mock('../../src/core/skills-cli.js', () => ({ runSkillsCli: (...a: unknown[]) => runMock(...a) }));

import {
  parseFrontmatterDescription,
  mergeInstalledLists,
  refreshInstalled,
  type RawListEntry,
} from '../../src/core/installed.js';

function tmpSkill(description: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'skill-'));
  const fm = description === null ? '---\nname: x\n---\n' : `---\nname: x\ndescription: ${description}\n---\n`;
  const path = join(dir, 'SKILL.md');
  writeFileSync(path, fm + '# body\n');
  return path;
}

describe('parseFrontmatterDescription', () => {
  it('returns description when present', () => {
    expect(parseFrontmatterDescription(tmpSkill('hello world'))).toBe('hello world');
  });

  it('returns empty string when missing', () => {
    expect(parseFrontmatterDescription(tmpSkill(null))).toBe('');
  });

  it('returns empty string when file unreadable', () => {
    expect(parseFrontmatterDescription('/no/such/path/SKILL.md')).toBe('');
  });
});

describe('mergeInstalledLists', () => {
  it('dedupes by (name, scope)', () => {
    const a: RawListEntry[] = [
      { name: 'x', path: '/p/x/SKILL.md', scope: 'project', agents: ['Claude Code'] },
    ];
    const b: RawListEntry[] = [
      { name: 'x', path: '/g/x/SKILL.md', scope: 'global', agents: ['Cursor'] },
    ];
    const merged = mergeInstalledLists(a, b);
    expect(merged).toHaveLength(2);
    expect(merged.map((e) => e.scope).sort()).toEqual(['global', 'project']);
  });
});

describe('refreshInstalled', () => {
  beforeEach(() => runMock.mockReset());

  it('combines project and global outputs and parses descriptions', async () => {
    const path = tmpSkill('a great skill');
    runMock
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify([{ name: 'demo', path, scope: 'project', agents: ['Claude Code'] }]),
        stderr: '',
      })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '[]', stderr: '' });

    const skills = await refreshInstalled();
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: 'demo',
      description: 'a great skill',
      scope: 'project',
      agents: ['claude'],
    });
  });

  it('throws on non-zero exit', async () => {
    runMock.mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'kaboom' });
    await expect(refreshInstalled()).rejects.toThrow(/kaboom/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test tests/core/installed.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `src/core/installed.ts`**

```ts
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { runSkillsCli } from './skills-cli.js';
import { displayNameToId, type AgentId } from './agents.js';

export interface RawListEntry {
  name: string;
  path: string;
  scope: 'project' | 'global';
  agents: string[];
}

export interface InstalledSkill {
  name: string;
  description: string;
  scope: 'project' | 'global';
  agents: AgentId[];
  path: string;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

export function parseFrontmatterDescription(skillMdPath: string): string {
  let raw: string;
  try {
    raw = readFileSync(skillMdPath, 'utf8');
  } catch {
    return '';
  }
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return '';
  try {
    const data = parseYaml(match[1]!) as Record<string, unknown> | null;
    const desc = data?.description;
    return typeof desc === 'string' ? desc : '';
  } catch {
    return '';
  }
}

export function mergeInstalledLists(
  project: RawListEntry[],
  global: RawListEntry[],
): RawListEntry[] {
  const seen = new Set<string>();
  const out: RawListEntry[] = [];
  for (const entry of [...project, ...global]) {
    const key = `${entry.scope}:${entry.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

async function listScope(global: boolean): Promise<RawListEntry[]> {
  const args = ['list', '--json'];
  if (global) args.push('-g');
  const result = await runSkillsCli(args);
  if (result.exitCode !== 0) {
    throw new Error(`skills list failed: ${result.stderr.trim() || 'unknown error'}`);
  }
  return JSON.parse(result.stdout) as RawListEntry[];
}

export async function refreshInstalled(): Promise<InstalledSkill[]> {
  const [project, global] = await Promise.all([listScope(false), listScope(true)]);
  const merged = mergeInstalledLists(project, global);
  return merged.map((entry) => ({
    name: entry.name,
    description: parseFrontmatterDescription(entry.path),
    scope: entry.scope,
    agents: entry.agents.map((displayName) => displayNameToId(displayName)).filter((id): id is AgentId => Boolean(id)),
    path: entry.path,
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm test tests/core/installed.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add installed list refresh and parsing"
```

---

## Task 6: `store.ts` — minimal reducer

**Files:**
- Create: `src/store.ts`
- Create: `tests/store.test.ts`

Phase 1 store keeps only what the installed screen needs: a list of installed skills, the currently focused agent, and the current screen. Built as a reducer + React context to make screen tests trivial.

- [ ] **Step 1: Write the failing test**

`tests/store.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { reducer, initialState, type Action } from '../src/store.js';

describe('reducer', () => {
  it('sets installed skills', () => {
    const action: Action = {
      type: 'installed/loaded',
      payload: [
        { name: 'a', description: '', scope: 'global', agents: ['claude'], path: '/p/a' },
      ],
    };
    const next = reducer(initialState, action);
    expect(next.installed).toHaveLength(1);
    expect(next.loadingInstalled).toBe(false);
  });

  it('marks installed as loading', () => {
    const next = reducer(initialState, { type: 'installed/loading' });
    expect(next.loadingInstalled).toBe(true);
  });

  it('switches current agent', () => {
    const next = reducer(initialState, { type: 'agent/select', payload: 'cursor' });
    expect(next.currentAgent).toBe('cursor');
  });

  it('switches screen', () => {
    const next = reducer(initialState, { type: 'screen/show', payload: 'installed' });
    expect(next.screen).toBe('installed');
  });

  it('records load error', () => {
    const next = reducer(initialState, { type: 'installed/error', payload: 'boom' });
    expect(next.installedError).toBe('boom');
    expect(next.loadingInstalled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test tests/store.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `src/store.ts`**

```ts
import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { InstalledSkill } from './core/installed.js';
import type { AgentId } from './core/agents.js';

export type Screen = 'installed';

export interface State {
  screen: Screen;
  currentAgent: AgentId;
  installed: InstalledSkill[];
  loadingInstalled: boolean;
  installedError: string | null;
}

export type Action =
  | { type: 'installed/loading' }
  | { type: 'installed/loaded'; payload: InstalledSkill[] }
  | { type: 'installed/error'; payload: string }
  | { type: 'agent/select'; payload: AgentId }
  | { type: 'screen/show'; payload: Screen };

export const initialState: State = {
  screen: 'installed',
  currentAgent: 'claude',
  installed: [],
  loadingInstalled: false,
  installedError: null,
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

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test tests/store.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add reducer-based store with React context"
```

---

## Task 7: `components/Footer.tsx` and `components/Header.tsx`

**Files:**
- Create: `src/components/Header.tsx`
- Create: `src/components/Footer.tsx`

These are dumb presentational components with no logic. No tests at this stage — they'll be exercised through screen tests.

- [ ] **Step 1: Create `src/components/Header.tsx`**

```tsx
import React from 'react';
import { Box, Text } from 'ink';

export function Header({ agent }: { agent: string }): React.ReactElement {
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Text bold>skills-gov</Text>
      <Text dimColor>agent: {agent}</Text>
    </Box>
  );
}
```

- [ ] **Step 2: Create `src/components/Footer.tsx`**

```tsx
import React from 'react';
import { Box, Text } from 'ink';

export function Footer({ keys }: { keys: ReadonlyArray<[string, string]> }): React.ReactElement {
  return (
    <Box paddingX={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
      <Text dimColor>
        {keys.map(([k, label], i) => (
          <Text key={k}>
            {i > 0 ? '  ' : ''}[{k}] {label}
          </Text>
        ))}
      </Text>
    </Box>
  );
}
```

- [ ] **Step 3: Verify type-check passes**

Run:
```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add Header and Footer components"
```

---

## Task 8: `screens/Installed.tsx`

**Files:**
- Create: `src/screens/Installed.tsx`
- Create: `tests/screens/Installed.test.tsx`

The screen reads from the store, filters skills by `currentAgent`, and renders a vertical list with up/down selection. `[tab]` cycles through `knownAgentIds`. No actions wired yet — Phase 2 adds `[i]`/`[d]`/`[u]`.

- [ ] **Step 1: Write the failing test**

`tests/screens/Installed.test.tsx`:
```tsx
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';
import { Installed } from '../../src/screens/Installed.js';
import { StoreProvider } from '../../src/store.js';

const sample = [
  { name: 'react', description: 'react helper', scope: 'global' as const, agents: ['claude'], path: '/p/r' },
  { name: 'pdf', description: 'pdf helper', scope: 'global' as const, agents: ['cursor'], path: '/p/p' },
];

function withStore(override = {}) {
  return render(
    <StoreProvider override={override}>
      <Installed />
    </StoreProvider>,
  );
}

describe('Installed screen', () => {
  it('renders only skills for current agent', () => {
    const { lastFrame } = withStore({ installed: sample, currentAgent: 'claude' });
    expect(lastFrame()).toContain('react');
    expect(lastFrame()).not.toContain('pdf');
  });

  it('shows empty state when no skills for agent', () => {
    const { lastFrame } = withStore({ installed: sample, currentAgent: 'codex' });
    expect(lastFrame()).toMatch(/no skills installed/i);
  });

  it('shows loading message', () => {
    const { lastFrame } = withStore({ loadingInstalled: true });
    expect(lastFrame()).toMatch(/loading/i);
  });

  it('shows error message', () => {
    const { lastFrame } = withStore({ installedError: 'boom' });
    expect(lastFrame()).toContain('boom');
  });

  it('cycles current agent on tab', () => {
    const { lastFrame, stdin } = render(
      <StoreProvider override={{ installed: sample, currentAgent: 'claude' }}>
        <Installed />
      </StoreProvider>,
    );
    expect(lastFrame()).toContain('Claude Code');
    stdin.write('\t');
    expect(lastFrame()).toContain('Cursor');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test tests/screens/Installed.test.tsx
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `src/screens/Installed.tsx`**

```tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useStore } from '../store.js';
import { knownAgentIds, agents } from '../core/agents.js';
import { Header } from '../components/Header.js';
import { Footer } from '../components/Footer.js';

const FOOTER_KEYS: ReadonlyArray<[string, string]> = [
  ['↑↓', 'move'],
  ['tab', 'switch agent'],
  ['q', 'quit'],
];

export function Installed(): React.ReactElement {
  const { state, dispatch } = useStore();
  const [cursor, setCursor] = useState(0);

  const filtered = state.installed.filter((s) => s.agents.includes(state.currentAgent));

  useInput((input, key) => {
    if (key.tab) {
      const idx = knownAgentIds.indexOf(state.currentAgent);
      const next = knownAgentIds[(idx + 1) % knownAgentIds.length]!;
      dispatch({ type: 'agent/select', payload: next });
      setCursor(0);
    } else if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor((c) => Math.min(filtered.length - 1, c + 1));
    } else if (input === 'q') {
      process.exit(0);
    }
  });

  return (
    <Box flexDirection="column">
      <Header agent={agents[state.currentAgent]?.displayName ?? state.currentAgent} />
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {state.loadingInstalled && <Text dimColor>loading installed skills…</Text>}
        {state.installedError && <Text color="red">{state.installedError}</Text>}
        {!state.loadingInstalled && !state.installedError && filtered.length === 0 && (
          <Text dimColor>no skills installed for this agent. press [tab] to switch.</Text>
        )}
        {filtered.map((skill, i) => (
          <Box key={`${skill.scope}:${skill.name}`}>
            <Text color={i === cursor ? 'cyan' : undefined}>{i === cursor ? '▸ ' : '  '}</Text>
            <Box width={32}>
              <Text bold={i === cursor}>{skill.name}</Text>
            </Box>
            <Text dimColor>{skill.description}</Text>
          </Box>
        ))}
      </Box>
      <Footer keys={FOOTER_KEYS} />
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test tests/screens/Installed.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): add Installed screen with agent cycling"
```

---

## Task 9: Wire `App` to load installed and route to screen

**Files:**
- Modify: `src/app.tsx`
- Create: `tests/app.test.tsx`

The `App` component bootstraps the store, kicks off the initial `refreshInstalled()` call, and renders the current screen. Phase 1 has only one screen (`installed`), but the routing exists from day 1.

- [ ] **Step 1: Write the failing test**

`tests/app.test.tsx`:
```tsx
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

vi.mock('../src/core/installed.js', () => ({
  refreshInstalled: vi.fn().mockResolvedValue([
    { name: 'demo', description: 'd', scope: 'global', agents: ['claude'], path: '/p/d' },
  ]),
}));

import { App } from '../src/app.js';

describe('App', () => {
  it('renders the installed screen and loads skills', async () => {
    const { lastFrame } = render(<App />);
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain('skills-gov');
    expect(lastFrame()).toContain('demo');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test tests/app.test.tsx
```

Expected: FAIL — current `App` renders `skills-gov starting…`, not the screen.

- [ ] **Step 3: Replace `src/app.tsx`**

```tsx
import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './store.js';
import { Installed } from './screens/Installed.js';
import { refreshInstalled } from './core/installed.js';

function Router(): React.ReactElement {
  const { state, dispatch } = useStore();

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'installed/loading' });
    refreshInstalled()
      .then((skills) => {
        if (!cancelled) dispatch({ type: 'installed/loaded', payload: skills });
      })
      .catch((err: Error) => {
        if (!cancelled) dispatch({ type: 'installed/error', payload: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  switch (state.screen) {
    case 'installed':
      return <Installed />;
  }
}

export function App(): React.ReactElement {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test tests/app.test.tsx
```

Expected: 1 test passes.

- [ ] **Step 5: Run the full suite**

Run:
```bash
pnpm test
```

Expected: all tests pass (agents, skills-cli, installed, store, Installed, app).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire App to load installed and route to screen"
```

---

## Task 10: Build and run

**Files:**
- Modify: `package.json` (verify scripts work)

- [ ] **Step 1: Build**

Run:
```bash
pnpm build
```

Expected: `dist/cli.js` produced with shebang.

- [ ] **Step 2: Verify the bin runs**

Run:
```bash
node dist/cli.js
```

Expected: TUI opens, shows `skills-gov` header, lists your installed Claude Code skills (or empty-state), accepts `[tab]` to cycle agents, `q` quits cleanly.

If you have no skills installed for any agent, the empty state should appear and `[tab]` should still cycle through agent names in the header.

- [ ] **Step 3: Verify `pnpm dev` also works**

Run:
```bash
pnpm dev
```

Expected: same behavior as built version, but via `tsx` (no build step).

- [ ] **Step 4: Commit**

If anything was tweaked in `package.json`:
```bash
git add -A
git commit -m "chore: verify build and dev produce a working TUI"
```

If no changes were needed, skip the commit. Phase 1 is done.

---

## Phase 1 acceptance

- `pnpm test` → all green (≥ 19 assertions across 6 files).
- `pnpm type-check` → no errors.
- `pnpm dev` → TUI launches, shows installed skills for the current agent, `[tab]` cycles, `q` quits.
- `pnpm build && node dist/cli.js` → same behavior from the compiled binary.

## What Phase 2 adds (preview, not part of this plan)

- `core/registry.ts`: `/api/search`, popular-list scrape, GitHub raw fetch with ETag cache.
- `screens/Search.tsx`: debounced input, results list, install prompt.
- `screens/Detail.tsx`: SKILL.md preview (raw fetch when from search; on-disk read when from installed).
- Install action: `[i]` from search → spawn `npx skills add` → toast → refresh.
- `Toast` component and ops state in the store.

## What Phase 3 adds (preview, not part of this plan)

- `core/config.ts`: XDG config read/write.
- `screens/Settings.tsx`: agent selection, default scope, behavior toggles.
- First-run detection flow.
- Remove and update actions.
- Fatal startup error screen (no Node/npx detected).
- Integration tests against a real `npx skills` in tmpdir.
- Distribution: `tsup` polish, README, CI, `npm publish` prep.
