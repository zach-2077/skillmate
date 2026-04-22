# skillmate

A full-screen TUI for managing [agent skills](https://skills.sh) across Claude Code, Cursor, Codex, OpenCode, Gemini CLI, GitHub Copilot, and more.

Think of it as a k9s-style front end for the `skills` CLI: browse what's installed, search the directory at skills.sh, read the README inline, and install or remove with a single key.

## Install

```sh
npm i -g skillmate
sm
```

Requires Node 20+. The [`skills`](https://github.com/vercel-labs/skills) CLI ships as a bundled dependency; no separate install needed.

## Keybinds

| Scope | Keys |
| --- | --- |
| Global | `left`/`right` cycle tabs, `?` help, `q` quit |
| Installed | `/` filter, `up`/`down` move, `tab` switch agent, `d` remove, `u` update |
| Discover | `/` search, `enter` detail, `i` install |
| Detail | `up`/`down` scroll, `esc` back |
| Settings | `up`/`down` move, `space` toggle, `enter` save, `esc` cancel |

Press `?` inside the app for the full list.

## What it does

- Lists skills that are actually installed for each supported agent, including universal skills under `~/.agents/skills` that the upstream CLI underreports.
- Searches the public directory at skills.sh with a cached popular list as a fallback.
- Installs skills globally (`~/.agents`) or per-project, to one or more agents at once.
- Surfaces Claude Code plugins and settings alongside skills.

Config lives at `$XDG_CONFIG_HOME/skillmate/config.json`. Skill cache lives at `~/.cache/skillmate`.

## Development

```sh
pnpm install
pnpm dev          # run from source with tsx
pnpm test         # vitest
pnpm type-check
pnpm build        # tsup -> dist/
```

The UI is [Ink](https://github.com/vadimdemedes/ink) (React for the terminal). State is a plain reducer in `src/store.ts`. Anything that touches the filesystem or the `skills` CLI is in `src/core/`.

## Credits

Built on top of [`vercel-labs/skills`](https://github.com/vercel-labs/skills) and the directory at [skills.sh](https://skills.sh). skillmate just wraps that CLI with a keyboard-driven UI; the skill ecosystem and protocol are theirs.

## License

MIT. Same as `vercel-labs/skills`, which keeps things frictionless for anyone who wants to fork, vendor, or ship this alongside the upstream CLI.
