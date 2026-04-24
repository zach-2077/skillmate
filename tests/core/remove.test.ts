import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const runMock = vi.fn();
vi.mock('../../src/core/skills-cli.js', () => ({ runSkillsCli: (...a: unknown[]) => runMock(...a) }));

import { buildRemoveArgs, removeCanonicalSkill, disablePlugin, disableCodexPlugin, disableGeminiExtension } from '../../src/core/remove.js';
import { setPluginEnabled } from '../../src/core/claude-settings.js';
import { parse as parseToml } from 'smol-toml';

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

  it('omits -a when allAgents is true', () => {
    expect(buildRemoveArgs({ name: 'pdf', agent: 'claude-code', scope: 'global', allAgents: true })).toEqual([
      'remove', 'pdf', '-g', '-y',
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

  it('falls back to stdout when stderr is empty', async () => {
    runMock.mockResolvedValue({ exitCode: 1, stdout: 'no such skill', stderr: '' });
    await expect(
      removeCanonicalSkill({ name: 'pdf', agent: 'claude-code', scope: 'global' }),
    ).rejects.toThrow(/no such skill/);
  });

  it('includes the failing command in the error', async () => {
    runMock.mockResolvedValue({ exitCode: 1, stdout: '', stderr: '' });
    await expect(
      removeCanonicalSkill({ name: 'pdf', agent: 'claude-code', scope: 'global' }),
    ).rejects.toThrow(/skills remove pdf -a claude-code -g -y/);
  });
});

describe('disableCodexPlugin', () => {
  let home: string;
  beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'sm-codex-rm-')); });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it('sets enabled = false and preserves other sections', () => {
    mkdirSync(join(home, '.codex'), { recursive: true });
    writeFileSync(
      join(home, '.codex', 'config.toml'),
      'model = "gpt-5"\n[plugins."sp@oc"]\nenabled = true\n[plugins."ot@oc"]\nenabled = true\n',
    );
    disableCodexPlugin('sp@oc', { home });
    const cfg = parseToml(readFileSync(join(home, '.codex', 'config.toml'), 'utf8')) as {
      model?: string;
      plugins?: Record<string, { enabled?: boolean }>;
    };
    expect(cfg.model).toBe('gpt-5');
    expect(cfg.plugins?.['sp@oc']?.enabled).toBe(false);
    expect(cfg.plugins?.['ot@oc']?.enabled).toBe(true);
  });

  it('creates the section when missing', () => {
    mkdirSync(join(home, '.codex'), { recursive: true });
    writeFileSync(join(home, '.codex', 'config.toml'), '');
    disableCodexPlugin('sp@oc', { home });
    const cfg = parseToml(readFileSync(join(home, '.codex', 'config.toml'), 'utf8')) as {
      plugins?: Record<string, { enabled?: boolean }>;
    };
    expect(cfg.plugins?.['sp@oc']?.enabled).toBe(false);
  });
});

describe('disableGeminiExtension', () => {
  let home: string;
  beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'sm-gem-rm-')); });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it('writes negated overrides for cwd and leaves other extensions untouched', () => {
    mkdirSync(join(home, '.gemini', 'extensions'), { recursive: true });
    writeFileSync(
      join(home, '.gemini', 'extensions', 'extension-enablement.json'),
      JSON.stringify({
        sp: { overrides: ['/Users/x/*'] },
        cv: { overrides: ['/Users/x/*'] },
      }),
    );
    disableGeminiExtension('sp', { home, cwd: '/Users/me' });
    const data = JSON.parse(
      readFileSync(join(home, '.gemini', 'extensions', 'extension-enablement.json'), 'utf8'),
    );
    expect(data.sp.overrides).toEqual(['!/Users/me/*', '!/Users/me']);
    expect(data.cv.overrides).toEqual(['/Users/x/*']);
  });

  it('creates the file when missing', () => {
    disableGeminiExtension('sp', { home, cwd: '/Users/me' });
    const data = JSON.parse(
      readFileSync(join(home, '.gemini', 'extensions', 'extension-enablement.json'), 'utf8'),
    );
    expect(data.sp.overrides).toEqual(['!/Users/me/*', '!/Users/me']);
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
