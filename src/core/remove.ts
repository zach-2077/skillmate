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
