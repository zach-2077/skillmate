import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { runSkillsCli } from './skills-cli.js';
import { setPluginEnabled } from './claude-settings.js';
import type { AgentId } from './agents.js';
import type { SkillScope } from './installed.js';

export interface CanonicalRemoveOpts {
  name: string;
  agent: AgentId;
  scope: 'project' | 'global';
}

export function buildRemoveArgs(opts: CanonicalRemoveOpts): string[] {
  const args = ['remove', opts.name, '-a', opts.agent];
  if (opts.scope === 'global') args.push('-g');
  args.push('-y');
  return args;
}

export async function removeCanonicalSkill(
  opts: CanonicalRemoveOpts,
  signal?: AbortSignal,
): Promise<void> {
  const result = await runSkillsCli(buildRemoveArgs(opts), { signal });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.split('\n')[0] || `skills remove failed (${result.exitCode})`);
  }
}

export async function disablePlugin(
  pluginKey: string,
  scope: Extract<SkillScope, 'plugin-user' | 'plugin-project'>,
): Promise<void> {
  const layer = scope === 'plugin-user' ? 'user' : 'project';
  setPluginEnabled(pluginKey, false, layer);
}

export interface DisableOpts {
  home?: string;
}

export function disableCodexPlugin(key: string, opts: DisableOpts = {}): void {
  const home = opts.home ?? homedir();
  const path = join(home, '.codex', 'config.toml');
  let cfg: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      cfg = parseToml(readFileSync(path, 'utf8')) as Record<string, unknown>;
    } catch {
      cfg = {};
    }
  }
  const plugins = (cfg.plugins as Record<string, Record<string, unknown>> | undefined) ?? {};
  const section = (plugins[key] as Record<string, unknown> | undefined) ?? {};
  section.enabled = false;
  plugins[key] = section;
  cfg.plugins = plugins;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifyToml(cfg));
}

export interface GeminiDisableOpts extends DisableOpts {
  cwd?: string;
}

export function disableGeminiExtension(name: string, opts: GeminiDisableOpts = {}): void {
  const home = opts.home ?? homedir();
  const cwd = opts.cwd ?? process.cwd();
  const dir = join(home, '.gemini', 'extensions');
  const path = join(dir, 'extension-enablement.json');
  let data: Record<string, { overrides?: string[] }> = {};
  if (existsSync(path)) {
    try {
      data = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      data = {};
    }
  }
  data[name] = { overrides: [`!${cwd}/*`, `!${cwd}`] };
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}
