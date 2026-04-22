import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { listPluginSkills } from '../../src/core/claude-plugins.js';

function writeSettings(dir: string, file: string, contents: object) {
  const target = join(dir, '.claude');
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, file), JSON.stringify(contents));
}

function writeInstalledPlugins(home: string, contents: object) {
  const target = join(home, '.claude', 'plugins');
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'installed_plugins.json'), JSON.stringify(contents));
}

function writePluginSkill(installPath: string, skillName: string, description: string) {
  const skillDir = join(installPath, 'skills', skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${skillName}\ndescription: ${description}\n---\n# body\n`,
  );
}

describe('listPluginSkills', () => {
  let home: string;
  let cwd: string;
  let installPath: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'sg-home-'));
    cwd = mkdtempSync(join(tmpdir(), 'sg-cwd-'));
    installPath = join(home, '.claude', 'plugins', 'cache', 'mp', 'plug', '1.0.0');
    mkdirSync(installPath, { recursive: true });
  });
  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });

  it('returns empty when no settings or installs', () => {
    expect(listPluginSkills({ home, cwd })).toEqual([]);
  });

  it('includes enabled plugin skills with namespace prefix', () => {
    writeSettings(home, 'settings.json', { enabledPlugins: { 'plug@mp': true } });
    writeInstalledPlugins(home, {
      version: 2,
      plugins: { 'plug@mp': [{ scope: 'user', installPath, version: '1.0.0' }] },
    });
    writePluginSkill(installPath, 'alpha', 'alpha desc');
    writePluginSkill(installPath, 'beta', 'beta desc');

    const skills = listPluginSkills({ home, cwd });
    expect(skills).toHaveLength(2);
    expect(skills.find((s) => s.name === 'plug:alpha')).toMatchObject({
      description: 'alpha desc',
      scope: 'plugin-user',
      agents: ['claude-code'],
    });
    expect(skills.find((s) => s.name === 'plug:beta')).toBeDefined();
  });

  it('omits disabled plugins', () => {
    writeSettings(home, 'settings.json', { enabledPlugins: { 'plug@mp': false } });
    writeInstalledPlugins(home, {
      version: 2,
      plugins: { 'plug@mp': [{ scope: 'user', installPath, version: '1.0.0' }] },
    });
    writePluginSkill(installPath, 'alpha', 'a');

    expect(listPluginSkills({ home, cwd })).toEqual([]);
  });

  it('marks project scope when project settings enable the plugin', () => {
    writeSettings(home, 'settings.json', { enabledPlugins: { 'plug@mp': false } });
    writeSettings(cwd, 'settings.json', { enabledPlugins: { 'plug@mp': true } });
    writeInstalledPlugins(home, {
      version: 2,
      plugins: { 'plug@mp': [{ scope: 'user', installPath, version: '1.0.0' }] },
    });
    writePluginSkill(installPath, 'alpha', 'a');

    const skills = listPluginSkills({ home, cwd });
    expect(skills).toHaveLength(1);
    expect(skills[0]!.scope).toBe('plugin-project');
  });

  it('skips plugin when installPath is missing from installed_plugins.json', () => {
    writeSettings(home, 'settings.json', { enabledPlugins: { 'ghost@mp': true } });
    writeInstalledPlugins(home, { version: 2, plugins: {} });
    expect(listPluginSkills({ home, cwd })).toEqual([]);
  });

  it('skips plugin when installPath directory has no skills/ subdir', () => {
    writeSettings(home, 'settings.json', { enabledPlugins: { 'plug@mp': true } });
    writeInstalledPlugins(home, {
      version: 2,
      plugins: { 'plug@mp': [{ scope: 'user', installPath, version: '1.0.0' }] },
    });
    // no skills/ dir created
    expect(listPluginSkills({ home, cwd })).toEqual([]);
  });

  it('skips entries without a valid SKILL.md name', () => {
    writeSettings(home, 'settings.json', { enabledPlugins: { 'plug@mp': true } });
    writeInstalledPlugins(home, {
      version: 2,
      plugins: { 'plug@mp': [{ scope: 'user', installPath, version: '1.0.0' }] },
    });
    const badDir = join(installPath, 'skills', 'broken');
    mkdirSync(badDir, { recursive: true });
    writeFileSync(join(badDir, 'SKILL.md'), 'no frontmatter here');

    expect(listPluginSkills({ home, cwd })).toEqual([]);
  });
});
