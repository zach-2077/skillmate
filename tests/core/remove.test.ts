import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const runMock = vi.fn();
vi.mock('../../src/core/skills-cli.js', () => ({ runSkillsCli: (...a: unknown[]) => runMock(...a) }));

import { buildRemoveArgs, removeCanonicalSkill, disablePlugin } from '../../src/core/remove.js';
import { setPluginEnabled } from '../../src/core/claude-settings.js';

describe('buildRemoveArgs', () => {
  it('builds args with -g for global', () => {
    expect(buildRemoveArgs({ name: 'pdf', agent: 'claude-code', scope: 'global' })).toEqual([
      'remove', 'pdf', '-a', 'claude-code', '-g', '-y',
    ]);
  });

  it('omits -g for project', () => {
    expect(buildRemoveArgs({ name: 'pdf', agent: 'claude-code', scope: 'project' })).toEqual([
      'remove', 'pdf', '-a', 'claude-code', '-y',
    ]);
  });
});

describe('removeCanonicalSkill', () => {
  beforeEach(() => { runMock.mockReset(); });

  it('resolves on exit 0', async () => {
    runMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
    await expect(
      removeCanonicalSkill({ name: 'pdf', agent: 'claude-code', scope: 'global' }),
    ).resolves.toBeUndefined();
  });

  it('rejects on non-zero', async () => {
    runMock.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'nope' });
    await expect(
      removeCanonicalSkill({ name: 'pdf', agent: 'claude-code', scope: 'global' }),
    ).rejects.toThrow(/nope/);
  });
});

describe('setPluginEnabled', () => {
  let home: string;
  let cwd: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'sg-home-'));
    cwd = mkdtempSync(join(tmpdir(), 'sg-cwd-'));
  });
  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });

  it('writes user-level settings.json when layer is user', () => {
    setPluginEnabled('foo@bar', false, 'user', { home, cwd });
    const file = join(home, '.claude', 'settings.json');
    expect(existsSync(file)).toBe(true);
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    expect(parsed.enabledPlugins['foo@bar']).toBe(false);
  });

  it('writes project-level settings.json when layer is project', () => {
    setPluginEnabled('foo@bar', false, 'project', { home, cwd });
    const file = join(cwd, '.claude', 'settings.json');
    expect(existsSync(file)).toBe(true);
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    expect(parsed.enabledPlugins['foo@bar']).toBe(false);
  });

  it('preserves other fields in the settings file', () => {
    mkdirSync(join(home, '.claude'), { recursive: true });
    writeFileSync(
      join(home, '.claude', 'settings.json'),
      JSON.stringify({ theme: 'dark', enabledPlugins: { 'other@mp': true } }),
    );
    setPluginEnabled('foo@bar', false, 'user', { home, cwd });
    const parsed = JSON.parse(readFileSync(join(home, '.claude', 'settings.json'), 'utf8'));
    expect(parsed.theme).toBe('dark');
    expect(parsed.enabledPlugins['other@mp']).toBe(true);
    expect(parsed.enabledPlugins['foo@bar']).toBe(false);
  });
});
