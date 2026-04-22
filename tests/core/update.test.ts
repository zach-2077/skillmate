import { describe, expect, it, vi, beforeEach } from 'vitest';

const runMock = vi.fn();
vi.mock('../../src/core/skills-cli.js', () => ({ runSkillsCli: (...a: unknown[]) => runMock(...a) }));

import { updateSkill } from '../../src/core/update.js';

describe('updateSkill', () => {
  beforeEach(() => { runMock.mockReset(); });

  it('calls update with -y', async () => {
    runMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
    await updateSkill('pdf');
    expect(runMock).toHaveBeenCalledWith(['update', 'pdf', '-y'], expect.any(Object));
  });

  it('rejects on failure', async () => {
    runMock.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'oops' });
    await expect(updateSkill('pdf')).rejects.toThrow(/oops/);
  });
});
