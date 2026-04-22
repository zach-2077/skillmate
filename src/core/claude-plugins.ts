import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { resolveEnabledPlugins, type ResolveOpts } from './claude-settings.js';
import type { InstalledSkill } from './installed.js';

interface InstalledPluginRecord {
  installPath?: string;
  scope?: string;
  version?: string;
}

interface InstalledPluginsJson {
  version?: number;
  plugins?: Record<string, InstalledPluginRecord[]>;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function readInstalledPluginsJson(home: string): InstalledPluginsJson {
  const path = join(home, '.claude', 'plugins', 'installed_plugins.json');
  if (!existsSync(path)) return { plugins: {} };
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as InstalledPluginsJson;
  } catch {
    return { plugins: {} };
  }
}

function pluginShortName(key: string): string {
  const at = key.indexOf('@');
  return at === -1 ? key : key.slice(0, at);
}

function readSkillFrontmatter(skillDir: string): { name?: string; description?: string } {
  const skillMd = join(skillDir, 'SKILL.md');
  if (!existsSync(skillMd)) return {};
  try {
    const raw = readFileSync(skillMd, 'utf8');
    const match = FRONTMATTER_RE.exec(raw);
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

/**
 * Scan all enabled Claude Code plugins and return the skills they bundle,
 * shaped as InstalledSkill entries with scope 'plugin-user' or 'plugin-project'.
 * The scope reflects which settings layer's final decision enabled the plugin.
 */
export function listPluginSkills(opts: ResolveOpts = {}): InstalledSkill[] {
  const home = opts.home ?? homedir();
  const decisions = resolveEnabledPlugins(opts);
  const installed = readInstalledPluginsJson(home);
  const installs = installed.plugins ?? {};

  const results: InstalledSkill[] = [];
  for (const [key, decision] of Object.entries(decisions)) {
    if (!decision.enabled) continue;
    const record = installs[key]?.[0];
    if (!record?.installPath) continue;
    const skillsDir = join(record.installPath, 'skills');
    if (!existsSync(skillsDir)) continue;

    let entries: string[];
    try {
      entries = readdirSync(skillsDir);
    } catch {
      continue;
    }

    const plugin = pluginShortName(key);
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
        name: `${plugin}:${fm.name}`,
        description: fm.description ?? '',
        scope: decision.layer === 'user' ? 'plugin-user' : 'plugin-project',
        agents: ['claude-code'],
        path: skillDir,
      });
    }
  }
  return results;
}
