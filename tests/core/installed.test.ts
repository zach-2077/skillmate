import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const runMock = vi.fn();
vi.mock('../../src/core/skills-cli.js', () => ({ runSkillsCli: (...a: unknown[]) => runMock(...a) }));
vi.mock('../../src/core/claude-plugins.js', () => ({ listPluginSkills: () => [] }));
vi.mock('../../src/core/codex-plugins.js', () => ({ listCodexPluginSkills: () => [] }));
vi.mock('../../src/core/gemini-extensions.js', () => ({ listGeminiExtensionSkills: () => [] }));

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

  it('accepts a directory path and reads SKILL.md inside it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skill-dir-'));
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: x\ndescription: dir path works\n---\n# body\n');
    expect(parseFrontmatterDescription(dir)).toBe('dir path works');
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
    // Upstream's `skills list --json` returns `path` as a DIRECTORY (canonicalPath),
    // not a SKILL.md file. Match that contract here.
    const dir = mkdtempSync(join(tmpdir(), 'skill-real-'));
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: demo\ndescription: a great skill\n---\n# body\n');
    runMock
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify([{ name: 'demo', path: dir, scope: 'project', agents: ['Claude Code'] }]),
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

  it('fans out universal-dir skills to all universal agents', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'skill-universal-'));
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: find-skills\ndescription: it helps\n---\n# body\n');
    // Upstream reports the skill under ~/.agents/skills/... with only Claude Code attributed.
    // Simulate that shape using a path that contains `.agents/skills/`.
    const universalPath = join(dir, '.agents', 'skills', 'find-skills');
    // We need the path to actually exist for parseFrontmatterDescription to read it,
    // so mirror the SKILL.md in the universal subtree too.
    const { mkdirSync, writeFileSync: wf } = await import('fs');
    mkdirSync(universalPath, { recursive: true });
    wf(join(universalPath, 'SKILL.md'), '---\nname: find-skills\ndescription: it helps\n---\n# body\n');

    runMock
      .mockResolvedValueOnce({ exitCode: 0, stdout: '[]', stderr: '' })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify([
          { name: 'find-skills', path: universalPath, scope: 'global', agents: ['Claude Code'] },
        ]),
        stderr: '',
      });

    const skills = await refreshInstalled();
    expect(skills).toHaveLength(1);
    const skill = skills[0]!;
    expect(skill.agents).toContain('claude-code');   // explicit attribution preserved
    expect(skill.agents).toContain('gemini-cli');     // fanned-out
    expect(skill.agents).toContain('cursor');         // fanned-out
    expect(skill.agents).toContain('github-copilot'); // fanned-out
    // Non-universal agents are NOT added.
    expect(skill.agents).not.toContain('continue');
    expect(skill.agents).not.toContain('windsurf');
    expect(skill.agents).not.toContain('roo');
  });

  it('sorts canonical skills before plugin skills', async () => {
    const canonicalDir = mkdtempSync(join(tmpdir(), 'skill-canon-'));
    writeFileSync(join(canonicalDir, 'SKILL.md'), '---\nname: canon\ndescription: c\n---\n# body\n');

    runMock
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify([
          { name: 'canon', path: canonicalDir, scope: 'global', agents: ['Claude Code'] },
        ]),
        stderr: '',
      })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '[]', stderr: '' });

    // Override the listPluginSkills mock for just this test
    const mod = await import('../../src/core/claude-plugins.js');
    const spy = vi.spyOn(mod, 'listPluginSkills').mockReturnValue([
      { name: 'plug:alpha', description: '', scope: 'plugin-user', agents: ['claude-code'], path: '/p/a' },
    ]);

    const skills = await refreshInstalled();
    expect(skills.map((s) => s.scope)).toEqual(['global', 'plugin-user']);
    expect(skills.map((s) => s.name)).toEqual(['canon', 'plug:alpha']);

    spy.mockRestore();
  });

  it('includes codex and gemini scanner output and sorts after claude plugins', async () => {
    runMock
      .mockResolvedValueOnce({ exitCode: 0, stdout: '[]', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '[]', stderr: '' });

    const claude = await import('../../src/core/claude-plugins.js');
    const codex = await import('../../src/core/codex-plugins.js');
    const gemini = await import('../../src/core/gemini-extensions.js');

    const claudeSpy = vi.spyOn(claude, 'listPluginSkills').mockReturnValue([
      { name: 'cl:a', description: '', scope: 'plugin-user', agents: ['claude-code'], path: '/p/cl' },
    ]);
    const codexSpy = vi.spyOn(codex, 'listCodexPluginSkills').mockReturnValue([
      { name: 'co:a', description: '', scope: 'plugin-codex', agents: ['codex'], path: '/p/co' },
    ]);
    const geminiSpy = vi.spyOn(gemini, 'listGeminiExtensionSkills').mockReturnValue([
      { name: 'ge:a', description: '', scope: 'extension-gemini', agents: ['gemini-cli'], path: '/p/ge' },
    ]);

    const skills = await refreshInstalled();
    expect(skills.map((s) => s.scope)).toEqual(['plugin-user', 'plugin-codex', 'extension-gemini']);

    claudeSpy.mockRestore();
    codexSpy.mockRestore();
    geminiSpy.mockRestore();
  });

  it('skips all plugin scanners when showPluginSkills is false', async () => {
    runMock
      .mockResolvedValueOnce({ exitCode: 0, stdout: '[]', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '[]', stderr: '' });

    const claude = await import('../../src/core/claude-plugins.js');
    const codex = await import('../../src/core/codex-plugins.js');
    const gemini = await import('../../src/core/gemini-extensions.js');

    const claudeSpy = vi.spyOn(claude, 'listPluginSkills');
    const codexSpy = vi.spyOn(codex, 'listCodexPluginSkills');
    const geminiSpy = vi.spyOn(gemini, 'listGeminiExtensionSkills');

    const skills = await refreshInstalled({ showPluginSkills: false });
    expect(skills).toEqual([]);
    expect(claudeSpy).not.toHaveBeenCalled();
    expect(codexSpy).not.toHaveBeenCalled();
    expect(geminiSpy).not.toHaveBeenCalled();

    claudeSpy.mockRestore();
    codexSpy.mockRestore();
    geminiSpy.mockRestore();
  });
});
