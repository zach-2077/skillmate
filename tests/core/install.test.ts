import { describe, expect, it, vi, beforeEach } from 'vitest';

const runMock = vi.fn();
vi.mock('../../src/core/skills-cli.js', () => ({ runSkillsCli: (...a: unknown[]) => runMock(...a) }));

import { buildAddArgs, installSkill } from '../../src/core/install.js';

describe('buildAddArgs', () => {
  it('builds args with multiple agents and global scope', () => {
    expect(buildAddArgs({ id: 'a/b/c', agents: ['claude-code', 'cursor'], scope: 'global' })).toEqual([
      'add', 'a/b/c', '-a', 'claude-code', '-a', 'cursor', '-g', '-y',
    ]);
  });

  it('omits -g for project scope', () => {
    expect(buildAddArgs({ id: 'a/b/c', agents: ['claude-code'], scope: 'project' })).toEqual([
      'add', 'a/b/c', '-a', 'claude-code', '-y',
    ]);
  });
});

describe('installSkill', () => {
  beforeEach(() => { runMock.mockReset(); });

  it('resolves on exit 0', async () => {
    runMock.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' });
    await expect(
      installSkill({ id: 'a/b/c', agents: ['claude-code'], scope: 'global' }),
    ).resolves.toBeUndefined();
  });

  it('rejects on non-zero exit with stderr', async () => {
    runMock.mockResolvedValue({ exitCode: 2, stdout: '', stderr: 'no such repo' });
    await expect(
      installSkill({ id: 'x/y/z', agents: ['claude-code'], scope: 'global' }),
    ).rejects.toThrow(/no such repo/);
  });
});
