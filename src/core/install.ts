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
  const args = buildAddArgs(opts);
  const result = await runSkillsCli(args, { signal });
  if (result.exitCode !== 0) {
    const detail =
      result.stderr.trim().split('\n').pop() ||
      result.stdout.trim().split('\n').pop() ||
      `exit ${result.exitCode}`;
    throw new Error(`skills ${args.join(' ')} → ${detail}`);
  }
}
