import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const runMock = vi.fn();
vi.mock('../../src/core/skills-cli.js', () => ({ runSkillsCli: (...a: unknown[]) => runMock(...a) }));

import {
  parseFrontmatterDescription,
  mergeInstalledLists,
  refreshInstalled,
  type RawListEntry,
} from '../../src/core/installed.js';

function tmpSkill(description: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'skill-'));
  const fm = description === null ? '---\nname: x\n---\n' : `---\nname: x\ndescription: ${description}\n---\n`;
  const path = join(dir, 'SKILL.md');
  writeFileSync(path, fm + '# body\n');
  return path;
}

describe('parseFrontmatterDescription', () => {
  it('returns description when present', () => {
    expect(parseFrontmatterDescription(tmpSkill('hello world'))).toBe('hello world');
  });

  it('returns empty string when missing', () => {
    expect(parseFrontmatterDescription(tmpSkill(null))).toBe('');
  });

  it('returns empty string when file unreadable', () => {
    expect(parseFrontmatterDescription('/no/such/path/SKILL.md')).toBe('');
  });

  it('handles CRLF line endings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skill-crlf-'));
    const path = join(dir, 'SKILL.md');
    writeFileSync(path, '---\r\nname: x\r\ndescription: hello crlf\r\n---\r\n# body\r\n');
    expect(parseFrontmatterDescription(path)).toBe('hello crlf');
  });
});

describe('mergeInstalledLists', () => {
  it('dedupes by (name, scope)', () => {
    const a: RawListEntry[] = [
      { name: 'x', path: '/p/x/SKILL.md', scope: 'project', agents: ['Claude Code'] },
    ];
    const b: RawListEntry[] = [
      { name: 'x', path: '/g/x/SKILL.md', scope: 'global', agents: ['Cursor'] },
    ];
    const merged = mergeInstalledLists(a, b);
    expect(merged).toHaveLength(2);
    expect(merged.map((e) => e.scope).sort()).toEqual(['global', 'project']);
  });
});

describe('refreshInstalled', () => {
  beforeEach(() => runMock.mockReset());

  it('combines project and global outputs and parses descriptions', async () => {
    const path = tmpSkill('a great skill');
    runMock
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify([{ name: 'demo', path, scope: 'project', agents: ['Claude Code'] }]),
        stderr: '',
      })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '[]', stderr: '' });

    const skills = await refreshInstalled();
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: 'demo',
      description: 'a great skill',
      scope: 'project',
      agents: ['claude-code'],
    });
  });

  it('throws on non-zero exit', async () => {
    runMock.mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'kaboom' });
    await expect(refreshInstalled()).rejects.toThrow(/kaboom/);
  });
});
