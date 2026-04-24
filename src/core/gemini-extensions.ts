import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import type { InstalledSkill } from './installed.js';

export interface GeminiScanOpts {
  home?: string;
  cwd?: string;
}

interface ExtensionManifest {
  name?: string;
  description?: string;
}

interface EnablementEntry {
  overrides?: string[];
}

interface EnablementFile {
  [extName: string]: EnablementEntry | undefined;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

export function matchesGlob(pattern: string, target: string): boolean {
  const re = new RegExp(
    '^' +
      pattern
        .split('*')
        .map((seg) => seg.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      '$',
  );
  return re.test(target);
}

function readEnablement(home: string): EnablementFile {
  const path = join(home, '.gemini', 'extensions', 'extension-enablement.json');
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as EnablementFile;
  } catch {
    return {};
  }
}

function isEnabledForCwd(entry: EnablementEntry | undefined, cwd: string): boolean {
  if (!entry) return true;
  const overrides = entry.overrides ?? [];
  if (overrides.length === 0) return true;
  const positives = overrides.filter((g) => !g.startsWith('!'));
  const negatives = overrides.filter((g) => g.startsWith('!')).map((g) => g.slice(1));
  if (negatives.some((g) => matchesGlob(g, cwd))) return false;
  if (positives.length === 0) return true;
  return positives.some((g) => matchesGlob(g, cwd));
}

function readManifest(extDir: string): ExtensionManifest {
  const path = join(extDir, 'gemini-extension.json');
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ExtensionManifest;
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

export function listGeminiExtensionSkills(opts: GeminiScanOpts = {}): InstalledSkill[] {
  const home = opts.home ?? homedir();
  const cwd = opts.cwd ?? process.cwd();
  const extensionsDir = join(home, '.gemini', 'extensions');
  if (!existsSync(extensionsDir)) return [];

  const enablement = readEnablement(home);

  let entries: string[];
  try {
    entries = readdirSync(extensionsDir);
  } catch {
    return [];
  }

  const results: InstalledSkill[] = [];
  for (const entry of entries) {
    if (entry === 'extension-enablement.json' || entry.startsWith('.')) continue;
    const extDir = join(extensionsDir, entry);
    try {
      if (!statSync(extDir).isDirectory()) continue;
    } catch {
      continue;
    }
    if (!isEnabledForCwd(enablement[entry], cwd)) continue;

    const manifest = readManifest(extDir);
    const extShort = manifest.name ?? entry;
    const skillsDir = join(extDir, 'skills');
    let skillEntries: string[];
    try {
      skillEntries = readdirSync(skillsDir);
    } catch {
      continue;
    }

    for (const skillEntry of skillEntries) {
      const skillDir = join(skillsDir, skillEntry);
      try {
        if (!statSync(skillDir).isDirectory()) continue;
      } catch {
        continue;
      }
      const fm = readSkillFrontmatter(skillDir);
      if (!fm.name) continue;
      results.push({
        name: `${extShort}:${fm.name}`,
        description: fm.description ?? '',
        scope: 'extension-gemini',
        agents: ['gemini-cli'],
        path: skillDir,
      });
    }
  }
  return results;
}
