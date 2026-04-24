import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';
import type { InstalledSkill } from './installed.js';

export interface CodexScanOpts {
  home?: string;
}

interface PluginsConfig {
  plugins?: Record<string, { enabled?: boolean } | undefined>;
}

interface PluginManifest {
  name?: string;
  description?: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function readConfig(home: string): PluginsConfig {
  const path = join(home, '.codex', 'config.toml');
  if (!existsSync(path)) return {};
  try {
    return parseToml(readFileSync(path, 'utf8')) as PluginsConfig;
  } catch {
    return {};
  }
}

function parseKey(key: string): { name: string; source: string } | null {
  const at = key.indexOf('@');
  if (at <= 0 || at === key.length - 1) return null;
  return { name: key.slice(0, at), source: key.slice(at + 1) };
}

function pickActiveSha(cacheDir: string): string | null {
  let entries: string[];
  try {
    entries = readdirSync(cacheDir);
  } catch {
    return null;
  }
  let best: { sha: string; mtimeMs: number } | null = null;
  for (const sha of entries) {
    try {
      const st = statSync(join(cacheDir, sha));
      if (!st.isDirectory()) continue;
      if (!best || st.mtimeMs > best.mtimeMs) best = { sha, mtimeMs: st.mtimeMs };
    } catch {
      continue;
    }
  }
  return best?.sha ?? null;
}

function readManifest(installPath: string): PluginManifest {
  const path = join(installPath, '.codex-plugin', 'plugin.json');
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PluginManifest;
  } catch {
    return {};
  }
}

function readSkillFrontmatter(skillDir: string): { name?: string; description?: string } {
  const path = join(skillDir, 'SKILL.md');
  if (!existsSync(path)) return {};
  try {
    const match = FRONTMATTER_RE.exec(readFileSync(path, 'utf8'));
    if (!match) return {};
    const data = parseYaml(match[1]!) as Record<string, unknown> | null;
    return {
      name: typeof data?.name === 'string' ? data.name : undefined,
      description: typeof data?.description === 'string' ? data.description : undefined,
    };
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
    const parsed = parseKey(key);
    if (!parsed) continue;

    const cacheDir = join(home, '.codex', 'plugins', 'cache', parsed.source, parsed.name);
    const sha = pickActiveSha(cacheDir);
    if (!sha) continue;

    const installPath = join(cacheDir, sha);
    const manifest = readManifest(installPath);
    const pluginShort = manifest.name ?? parsed.name;

    const skillsDir = join(installPath, 'skills');
    let entries: string[];
    try {
      entries = readdirSync(skillsDir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const skillDir = join(skillsDir, entry);
      try {
        if (!statSync(skillDir).isDirectory()) continue;
      } catch {
        continue;
      }
      const fm = readSkillFrontmatter(skillDir);
      if (!fm.name) continue;
      results.push({
        name: `${pluginShort}:${fm.name}`,
        description: fm.description ?? '',
        scope: 'plugin-codex',
        agents: ['codex'],
        path: skillDir,
      });
    }
  }
  return results;
}
