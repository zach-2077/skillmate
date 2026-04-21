# skills-gov: A TUI for managing agent skills

**Date:** 2026-04-21
**Status:** Design — pending implementation plan
**Owner:** zach.zhou

## Goal

Build `skills-gov`, a standalone full-screen terminal UI for browsing, searching, installing, and managing agent skills. The tool wraps `npx skills` (the [vercel-labs/skills](https://github.com/vercel-labs/skills) CLI) for write operations and reads installed state directly so the UI stays snappy. Targets the same skill ecosystem and registry ([skills.sh](https://skills.sh/)) as the upstream CLI.

## Non-goals

- Not an upstream contribution — too large for a single PR against an active repo with 271 open issues.
- Not a reimplementation of the install/remove logic — we lease that to upstream.
- No skill authoring (`init`), no lockfile workflows, no plugin grouping in v1.
- No telemetry, no GitHub OAuth, no mouse support, no theming in v1.

## Stack

- **Language:** TypeScript
- **TUI:** [Ink](https://github.com/vadimdemedes/ink) (React for the terminal)
- **Build:** `tsup` → ESM with shebang
- **Tests:** `vitest` + `ink-testing-library`
- **Package manager:** `pnpm`
- **Node:** 20+

Rationale: the user's tool wraps `npx skills`, so Node is already a runtime dependency. Going TS+Ink keeps the install path consistent (`npx skills-gov`), allows us to declare upstream as a normal `dependencies` entry, and avoids a separate Node-installation step that a Go binary would force on users.

## Architecture

Three layers with clean seams:

```
src/
├── cli.ts              # arg parsing, launches Ink app
├── app.tsx             # Ink root, owns global state + screen routing
├── screens/
│   ├── installed.tsx   # browse installed skills (per agent)
│   ├── search.tsx      # query skills.sh
│   ├── detail.tsx      # SKILL.md preview + actions
│   └── settings.tsx    # default agents, scope, behavior
├── components/         # reusable Ink widgets (List, Pane, Spinner, Toast)
├── core/
│   ├── installed.ts    # `npx skills list --json` + parse SKILL.md from path
│   ├── registry.ts     # skills.sh API client + GitHub raw fetch + popular scrape
│   ├── skills-cli.ts   # subprocess wrapper for `npx skills add/remove/update`
│   ├── agents.ts       # known agent → directory map (mirrored from upstream)
│   └── config.ts       # XDG config read/write
└── store.ts            # event store (reducer + context)

tests/
├── unit/               # core/ pure functions, mocked I/O
├── integration/        # core/skills-cli.ts against real `npx skills` in tmpdir
└── tui/                # screen smoke tests via ink-testing-library
```

### Layer responsibilities

1. **Data layer (`core/`)** — pure TS, no Ink. Each module independently testable with mocked `fs`/`fetch`/`spawn`.
2. **State layer (`store.ts`)** — single source of truth: current screen, selected skill, installed list, search results, in-flight ops, toast queue, settings.
3. **View layer (`screens/`, `components/`)** — Ink components, props-driven, no I/O. Dispatches actions to the store; never calls `core/` directly.

### Data flow (typical install)

```
user presses [i] in search screen
  → screen dispatches install({ skillId, agents, scope })
  → store sets ops[skillId] = 'installing'
  → core/skills-cli.ts spawns `npx skills add <id> -a <agent> [-g] -y`
  → on exit 0: store invalidates installed cache
  → core/installed.ts re-runs `list --json` (project + global)
  → store updates installed list
  → installed screen re-renders with new entry
```

## TUI design

Four screens, full-window swap. Persistent footer shows the keybinds for the current screen. Top tab strip with `[1] [2] [s]` direct nav.

### Installed screen (default on launch, per-agent)

```
 skills-gov           [1]Installed  [2]Search  [s]Settings        agent: claude ▾
 ──────────────────────────────────────────────────────────────────────────────
 ▸ react-best-practices              Performance and architecture for React/...
   git-commit                         Conventional commits with scope detection
   pdf                                Comprehensive PDF manipulation toolkit
   ...
 ──────────────────────────────────────────────────────────────────────────────
 [↑↓] move  [enter] detail  [tab] switch agent  [u] update  [d] remove  [q] quit
```

- `[tab]` cycles through detected agents (`claude → cursor → codex → ...`); current agent shown top-right.
- Right column shows description from SKILL.md frontmatter; truncated with ellipsis.
- Source (`owner/repo`) is intentionally not shown to avoid the cost of source inference; the small risk that two skills with the same name from different repos collide is accepted for v1.
- Empty state: "no skills installed for `claude`. Press `[2]` to search, or `[tab]` to switch agent."

### Search screen

```
 skills-gov           [1]Installed  [2]Search  [s]Settings   search: react test_
 ──────────────────────────────────────────────────────────────────────────────
 ▸ react-testing-library            github/awesome-copilot     12.4K
   playwright-react                  microsoft/playwright-mcp   8.1K
   react-best-practices              vercel-labs/agent-skills   185K ✓
   ...
 ──────────────────────────────────────────────────────────────────────────────
 [↑↓] move  [enter] detail  [i] install  [esc] back  ✓ = installed
```

- `[/]` from any screen focuses the search input.
- Empty / `<2 char` query: shows the top-10 popular list (see registry section).
- Live search debounced 250ms; in-flight requests cancelled on next keystroke via `AbortController`.
- `[i]` opens the install prompt inline below the list (not modal):

  ```
  ┌─ Install react-best-practices ────────────────────────────┐
  │ Target agents: [x] claude  [x] cursor  [ ] codex          │
  │ Scope:         (•) global    ( ) project                  │
  │                                                            │
  │ [enter] confirm   [esc] cancel                            │
  └────────────────────────────────────────────────────────────┘
  ```

  Defaults pre-filled from settings; user tweaks per-install.

### Detail screen

Header content depends on entry point — owner/repo and install count are only available when reached from the search screen.

From **search**:
```
 react-best-practices · vercel-labs/agent-skills                   185K
```

From **installed**:
```
 react-best-practices · installed [global · claude, cursor]
```

Body is the same in both cases:
```
 ──────────────────────────────────────────────────────────────────────────────
 ---
 name: react-best-practices
 description: Performance and architecture for React/Next.js apps...
 ---

 # React Best Practices
 [scrollable SKILL.md preview]
 ──────────────────────────────────────────────────────────────────────────────
 [↑↓] scroll  [i] install  [d] remove  [a] pick agents  [esc] back
```

- Frontmatter renders as a small dimmed pill at the top, not raw YAML.
- Body rendered through `marked-terminal` or `cli-markdown` (ANSI for headings/lists/code/links).
- Body source:
  - From search → fetch from GitHub raw (see registry section).
  - From installed → read directly from the on-disk `path` returned by `npx skills list --json`.
- `[r]` force-refreshes the cached SKILL.md (search-entry only).
- If GitHub raw fetch returns both `main` and `master` 404, show "preview unavailable" plus the `npx skills add ...` command to copy.

### Settings screen

```
 skills-gov           [1]Installed  [2]Search  [s]Settings
 ──────────────────────────────────────────────────────────────────────────────
 Default install targets
   [x] claude       (detected)
   [x] cursor       (detected)
   [ ] codex        (detected)
   [ ] opencode     (detected, not configured below)

 Default install scope
   (•) global       install to ~/<agent>/skills
   ( ) project      install to ./<agent>/skills

 Behavior
   [x] Confirm before remove
   [ ] Auto-update on launch

 ──────────────────────────────────────────────────────────────────────────────
 [↑↓] move  [space] toggle  [enter] save  [esc] revert
```

### Global behavior

- Min terminal: 80x20. Below that, render `terminal too small` placeholder.
- Above that, content adapts via Ink's `useStdoutDimensions`.
- Toasts render in a fixed region above the keybind footer; auto-dismiss after 3s.
- Loading states render inline (`▸ installing...` next to the row), not modal — terminal stays usable.
- `q` / `ctrl+c` quit. `?` help overlay. `esc` back / cancel input.

### First-run flow

1. No config file at `~/.config/skills-gov/config.json`.
2. Auto-detect installed agents (mirror upstream's detection — read `~/.claude/`, `~/.cursor/`, etc.).
3. Drop user into Settings screen with detected agents pre-checked.
4. User confirms with `[enter]` → config written → land on Installed screen.

## Configuration

Persisted to `~/.config/skills-gov/config.json` (XDG-friendly).

```json
{
  "defaultAgents": ["claude", "cursor"],
  "defaultScope": "global",
  "confirmRemove": true,
  "autoUpdate": false,
  "currentAgent": "claude"
}
```

`currentAgent` (which agent the installed screen opens to) is auto-saved when the user `[tab]`s.

## Wrapping `npx skills`

### Read side — `core/installed.ts`

```ts
async function refresh(): Promise<InstalledSkill[]> {
  const [project, global] = await Promise.all([
    runSkillsCli(['list', '--json']),
    runSkillsCli(['list', '--json', '-g']),
  ]);
  // Each entry: { name, path, scope, agents }
  // Parse SKILL.md at `path` for description (frontmatter only)
  // Merge project+global, dedupe on (name, scope)
  return merged;
}
```

- Two subprocess calls per refresh (~200–400ms total). Refresh fires only on initial load and after a successful write — no flicker during browsing.
- `agents` array in the JSON is upstream's display name (e.g. "Claude Code"); map back to short id for the `[tab]` switcher via `core/agents.ts`.
- Parse SKILL.md frontmatter only with the `yaml` package (matches upstream's dependency). Body is fetched on-demand by the detail screen, not at list time.

### Write side — `core/skills-cli.ts`

```ts
async function runSkillsCli(args: string[], opts?: { signal?: AbortSignal }): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}>
```

Three callers:
- `install(skillId, agents[], scope)` → `npx skills add <id> -a <agent> [-a <agent>...] [-g] -y`
- `remove(skillId, agent, scope)` → `npx skills remove <id> -a <agent> [-g] -y`
- `update(skillId)` → `npx skills update <id> -y`

`-y` always passed (TUI already collected confirmation).

### Process resolution

- Declare upstream package as a regular `dependencies` entry. At runtime, prefer `node_modules/.bin/skills` over `npx skills` — avoids 1–2s `npx` cold start per action and pins us to the version we tested against.
- Fallback to `npx skills` only if the local bin is missing (defensive).

### Error handling

| Failure | Behavior |
|---|---|
| Non-zero exit | Toast with first line of stderr; `op` stays in error state until user dismisses. |
| Spawn fails (no Node/npx) | Fatal startup error; render setup-help screen and exit. |
| Long-running install | Spawn returns immediately, store sets `ops[skillId]='installing'`, row shows `▸ installing...` with elapsed seconds. User keeps navigating. `[ctrl+c]` on the row sends `SIGINT` to child via `AbortSignal`. |

### Concurrency

Queue write ops per `(skillId, agent)` — no parallel mutations on the same target. Reads are always allowed.

## skills.sh integration — `core/registry.ts`

### Search

```
GET https://skills.sh/api/search?q=<query>
→ 200 { query, searchType, skills: [{ id, skillId, name, installs, source }] }
→ 400 if query.length < 2
```

- Live as user types, debounced 250ms.
- Results cached in-memory (LRU, ~50 entries) keyed by query.
- In-flight requests cancelled via `AbortController` on next keystroke.
- Network failure: toast `search unavailable, showing cached results`; fall back to last successful response or bundled fallback list.

### Popular list (empty/short query)

No public `/api/popular` exists. Strategy:

1. Try cached `~/.cache/skills-gov/popular.json` (TTL: 6h).
2. Else fetch `https://skills.sh/` HTML, regex out the first 10 skill IDs from the leaderboard region.
3. Cache and return.
4. On any failure, fall back to a tiny bundled list (~5 known-good skills from `vercel-labs/agent-skills` and `anthropics/skills`) shipped in the package.

Brittleness mitigation: regex is narrow, fallback keeps the empty state alive. If skills.sh ships `/api/popular`, swap implementations in this one module.

### SKILL.md preview (detail screen)

```
https://raw.githubusercontent.com/<source>/main/<skillId>/SKILL.md
```

- Try `main` first; fall back to `master` on 404.
- Cache fetched bodies under `~/.cache/skills-gov/skill-md/<source>/<skillId>.md` keyed by ETag (TTL 24h, force-refresh via `[r]`).
- If both branches 404 → "preview unavailable" + copyable install command.

### Rate limits

- skills.sh — no documented limit; debounce + cache keep us polite.
- `raw.githubusercontent.com` — no auth needed, generous limits for public repos.

### Offline mode

- First network failure at startup → search screen shows bundled popular list with `(offline)` badge.
- Detail screen shows "preview unavailable, install command:" view.
- Installed and Settings screens work fully (all local).

## Testing

Three tiers, matched to layer:

### 1. Unit (`vitest`, `tests/unit/`)

Pure functions in `core/`:
- `parseSkillMd(text)` — frontmatter extraction edge cases
- `mergeInstalledLists(project, global)` — dedupe across scopes
- `buildAddArgs({skillId, agents, scope})` — correct CLI args produced
- `popularFromHtml(html)` — scrape regex against captured fixtures
- `parseSearchResponse(json)` — registry response shape

Mocked `fs`, `fetch`, `child_process.spawn`. Fast, deterministic. Written test-first (TDD).

### 2. Integration (`tests/integration/`)

`core/skills-cli.ts` against a real `npx skills` in a tmpdir:
- Spawn install → verify `list --json` returns the skill → spawn remove → verify gone.
- Slow (~5–15s each), gated behind `pnpm test:integration`. Run in CI on PR but not on every local change.

One real network test against `skills.sh/api/search?q=react` — sanity check, allowed to skip on offline.

### 3. TUI smoke (`ink-testing-library`, `tests/tui/`)

Render screens with seeded store, assert visible text and dispatched actions on key events.
- One test per screen: "renders empty state," "renders list of N skills," "pressing `i` opens install prompt."
- No real I/O — store seeded with mocks. Catches keybinding and rendering regressions; ignores layout/colors.

Written tests-after — TUI iteration is hard to spec ahead.

## Distribution

- **Package:** `skills-gov` on npm
- **Bin:** `bin: { "skills-gov": "./dist/cli.js" }`
- **Build:** `tsup` → ESM + shebang
- **Install paths:**
  - `npx skills-gov` (zero-install, mirrors `npx skills` UX)
  - `npm i -g skills-gov` (PATH install)
- **Dependencies:** `skills` (the upstream npm package, confirmed) declared as a regular `dependencies` entry, not peerDep. Pin a known-good version range; bump deliberately.
- **Node:** require 20+ for Ink 5. Upstream `skills` requires 18+, so 20+ is the binding constraint.
- **Repo:** GitHub `zachzhou/skills-gov` (confirm before publish), MIT.
- **CI:** GitHub Actions running `pnpm lint && pnpm test && pnpm test:integration` on Node 20 + 22, macOS + Linux.
- **Versioning:** semver, `0.x` until UX settles. `npm publish --tag next` for early releases until v1.

## Out of scope (parked for later)

- Skill creation (`init`)
- Lockfile workflows (`experimental_install`, `experimental_sync`)
- Plugin grouping (upstream's `lockEntry?.pluginName` structure)
- GitHub OAuth for higher rate limits
- Mouse support
- Theming
- Telemetry (upstream already has it; users opting into our wrapper shouldn't get a second layer without explicit consent)
