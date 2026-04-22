import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { runSkillsCli } from './skills-cli.js';
import { displayNameToId, type AgentId } from './agents.js';

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
