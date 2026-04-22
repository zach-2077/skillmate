import { runSkillsCli } from './skills-cli.js';
import type { AgentId } from './agents.js';

export interface InstallOpts {
  id: string;
  agents: AgentId[];
  scope: 'global' | 'project';
}

export function buildAddArgs(opts: InstallOpts): string[] {
  const args = ['add', opts.id];
  for (const a of opts.agents) args.push('-a', a);
  if (opts.scope === 'global') args.push('-g');
  args.push('-y');
  return args;
}

export async function installSkill(opts: InstallOpts, signal?: AbortSignal): Promise<void> {
  const result = await runSkillsCli(buildAddArgs(opts), { signal });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.split('\n')[0] || `skills add failed (${result.exitCode})`);
  }
}
