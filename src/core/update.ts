import { runSkillsCli } from './skills-cli.js';

export async function updateSkill(name: string, signal?: AbortSignal): Promise<void> {
  const result = await runSkillsCli(['update', name, '-y'], { signal });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.split('\n')[0] || `skills update failed (${result.exitCode})`);
  }
}
