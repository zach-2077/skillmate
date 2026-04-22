import { readFileSync, statSync } from 'fs';
import { homedir } from 'os';
import { join, sep } from 'path';
import { parse as parseYaml } from 'yaml';
import { runSkillsCli } from './skills-cli.js';
import { displayNameToId, universalAgentIds, type AgentId } from './agents.js';
import { listPluginSkills } from './claude-plugins.js';

export interface RawListEntry {
  name: string;
  path: string;
  scope: 'project' | 'global';
  agents: string[];
}

export type SkillScope = 'project' | 'global' | 'plugin-user' | 'plugin-project';

export interface InstalledSkill {
  name: string;
  description: string;
  scope: SkillScope;
  agents: AgentId[];
  path: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

export function parseFrontmatterDescription(pathOrDir: string): string {
  let raw: string;
  try {
    const target = statSync(pathOrDir).isDirectory() ? join(pathOrDir, 'SKILL.md') : pathOrDir;
    raw = readFileSync(target, 'utf8');
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

const SCOPE_ORDER: Record<SkillScope, number> = {
  project: 0,
  global: 1,
  'plugin-user': 2,
  'plugin-project': 3,
};

/**
 * Skills living in the universal canonical dir (`~/.agents/skills/<name>` or
 * `<cwd>/.agents/skills/<name>`) are read at runtime by every agent that uses
 * `.agents/skills` as its skillsDir — but upstream `skills list --json` only
 * attributes a skill to an agent when a matching symlink/path exists in that
 * agent's OWN dir. So a skill in `~/.agents/skills/` with no symlinks comes
 * back with an empty agents list, hiding it from universal-agent views.
 * Compensate by fanning out to all universal agents when we detect a universal
 * path.
 */
export function isUniversalPath(skillPath: string, home: string = homedir()): boolean {
  const homeUniversal = join(home, '.agents', 'skills') + sep;
  if (skillPath.startsWith(homeUniversal)) return true;
  const needle = `${sep}.agents${sep}skills${sep}`;
  return skillPath.includes(needle);
}

export async function refreshInstalled(): Promise<InstalledSkill[]> {
  const [project, global] = await Promise.all([listScope(false), listScope(true)]);
  const merged = mergeInstalledLists(project, global);
  const canonical: InstalledSkill[] = merged.map((entry) => {
    const explicit = entry.agents
      .map((displayName) => displayNameToId(displayName))
      .filter((id): id is AgentId => Boolean(id));
    const agentSet = new Set<AgentId>(explicit);
    if (isUniversalPath(entry.path)) {
      for (const id of universalAgentIds) agentSet.add(id);
    }
    return {
      name: entry.name,
      description: parseFrontmatterDescription(entry.path),
      scope: entry.scope,
      agents: [...agentSet],
      path: entry.path,
    };
  });
  const plugins = listPluginSkills();
  return [...canonical, ...plugins].sort((a, b) => {
    const d = SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope];
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });
}
