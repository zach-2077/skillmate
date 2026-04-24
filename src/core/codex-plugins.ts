import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { parse as parseToml } from 'smol-toml';
import type { InstalledSkill } from './installed.js';

export interface CodexScanOpts {
  home?: string;
}

interface PluginsConfig {
  plugins?: Record<string, { enabled?: boolean } | undefined>;
}

function readConfig(home: string): PluginsConfig {
  const path = join(home, '.codex', 'config.toml');
  if (!existsSync(path)) return {};
  try {
    return parseToml(readFileSync(path, 'utf8')) as PluginsConfig;
  } catch {
    return {};
  }
}

export function listCodexPluginSkills(opts: CodexScanOpts = {}): InstalledSkill[] {
  const home = opts.home ?? homedir();
  const cfg = readConfig(home);
  const plugins = cfg.plugins ?? {};
  const results: InstalledSkill[] = [];
  for (const [key, section] of Object.entries(plugins)) {
    if (section?.enabled === false) continue;
    void key;
  }
  return results;
}
