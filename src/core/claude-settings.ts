import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export type EnablementLayer = 'user' | 'project';

export interface EnablementDecision {
  enabled: boolean;
  layer: EnablementLayer;
}

export interface ResolveOpts {
  home?: string;
  cwd?: string;
}

interface ClaudeSettings {
  enabledPlugins?: Record<string, boolean>;
  [key: string]: unknown;
}

function readSettingsFile(path: string): ClaudeSettings | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ClaudeSettings;
  } catch {
    return null;
  }
}

export function setPluginEnabled(
  pluginKey: string,
  enabled: boolean,
  layer: EnablementLayer,
  opts: ResolveOpts = {},
): void {
  const home = opts.home ?? homedir();
  const cwd = opts.cwd ?? process.cwd();
  const base = layer === 'user' ? home : cwd;
  const dir = join(base, '.claude');
  const file = join(dir, 'settings.json');
  const existing = readSettingsFile(file) ?? {};
  const enabledPlugins = { ...(existing.enabledPlugins ?? {}), [pluginKey]: enabled };
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify({ ...existing, enabledPlugins }, null, 2));
}

/**
 * Reads the four Claude Code settings files (user, user-local, project, project-local)
 * and resolves each plugin's effective enablement + which layer produced the final value.
 * Later layers win (project-local > project > user-local > user).
 */
export function resolveEnabledPlugins(opts: ResolveOpts = {}): Record<string, EnablementDecision> {
  const home = opts.home ?? homedir();
  const cwd = opts.cwd ?? process.cwd();

  const layers: Array<{ path: string; layer: EnablementLayer }> = [
    { path: join(home, '.claude', 'settings.json'), layer: 'user' },
    { path: join(home, '.claude', 'settings.local.json'), layer: 'user' },
    { path: join(cwd, '.claude', 'settings.json'), layer: 'project' },
    { path: join(cwd, '.claude', 'settings.local.json'), layer: 'project' },
  ];

  const result: Record<string, EnablementDecision> = {};
  for (const { path, layer } of layers) {
    const settings = readSettingsFile(path);
    const plugins = settings?.enabledPlugins;
    if (!plugins) continue;
    for (const [name, enabled] of Object.entries(plugins)) {
      if (typeof enabled !== 'boolean') continue;
      result[name] = { enabled, layer };
    }
  }
  return result;
}
