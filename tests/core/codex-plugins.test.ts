import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { listCodexPluginSkills } from '../../src/core/codex-plugins.js';

function writeConfigToml(home: string, body: string): void {
  mkdirSync(join(home, '.codex'), { recursive: true });
  writeFileSync(join(home, '.codex', 'config.toml'), body);
}

function writePluginSkill(
  home: string,
  source: string,
  name: string,
  sha: string,
  skillName: string,
  description: string,
): string {
  const installPath = join(home, '.codex', 'plugins', 'cache', source, name, sha);
  const skillDir = join(installPath, 'skills', skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${skillName}\ndescription: ${description}\n---\n# body\n`,
  );
  mkdirSync(join(installPath, '.codex-plugin'), { recursive: true });
  writeFileSync(
    join(installPath, '.codex-plugin', 'plugin.json'),
    JSON.stringify({ name, version: '1.0.0', description: `${name} desc` }),
  );
  return installPath;
}

describe('listCodexPluginSkills', () => {
  let home: string;
  beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'sm-codex-')); });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it('returns empty when ~/.codex/config.toml is missing', () => {
    expect(listCodexPluginSkills({ home })).toEqual([]);
  });

  it('returns empty when toml has no plugins sections', () => {
    writeConfigToml(home, 'model = "gpt-5"\n');
    expect(listCodexPluginSkills({ home })).toEqual([]);
  });

  it('returns empty on TOML parse error', () => {
    writeConfigToml(home, 'this is = not = valid toml ===\n');
    expect(listCodexPluginSkills({ home })).toEqual([]);
  });

  it('emits skills for an enabled plugin with bundled skills', () => {
    writeConfigToml(home, '[plugins."superpowers@openai-curated"]\nenabled = true\n');
    writePluginSkill(home, 'openai-curated', 'superpowers', 'sha1', 'brainstorming', 'creative work');
    writePluginSkill(home, 'openai-curated', 'superpowers', 'sha1', 'tdd', 'red-green-refactor');

    const skills = listCodexPluginSkills({ home });
    expect(skills).toHaveLength(2);
    const brainstorm = skills.find((s) => s.name === 'superpowers:brainstorming');
    expect(brainstorm).toMatchObject({
      description: 'creative work',
      scope: 'plugin-codex',
      agents: ['codex'],
    });
    expect(brainstorm?.path).toMatch(/sha1\/skills\/brainstorming$/);
  });

  it('treats sections without `enabled` as enabled', () => {
    writeConfigToml(home, '[plugins."superpowers@openai-curated"]\n');
    writePluginSkill(home, 'openai-curated', 'superpowers', 'sha1', 'brainstorming', 'x');
    expect(listCodexPluginSkills({ home })).toHaveLength(1);
  });

  it('skips plugins with enabled = false', () => {
    writeConfigToml(home, '[plugins."superpowers@openai-curated"]\nenabled = false\n');
    writePluginSkill(home, 'openai-curated', 'superpowers', 'sha1', 'brainstorming', 'x');
    expect(listCodexPluginSkills({ home })).toEqual([]);
  });

  it('skips plugins whose cache directory is missing', () => {
    writeConfigToml(home, '[plugins."ghost@openai-curated"]\nenabled = true\n');
    expect(listCodexPluginSkills({ home })).toEqual([]);
  });

  it('skips skills without SKILL.md', () => {
    writeConfigToml(home, '[plugins."p@s"]\nenabled = true\n');
    const installPath = join(home, '.codex', 'plugins', 'cache', 's', 'p', 'sha1');
    mkdirSync(join(installPath, 'skills', 'no-skill-md'), { recursive: true });
    mkdirSync(join(installPath, '.codex-plugin'), { recursive: true });
    writeFileSync(join(installPath, '.codex-plugin', 'plugin.json'), '{"name":"p"}');
    expect(listCodexPluginSkills({ home })).toEqual([]);
  });

  it('picks the most-recently-modified sha when multiple exist', () => {
    writeConfigToml(home, '[plugins."p@s"]\nenabled = true\n');
    writePluginSkill(home, 's', 'p', 'old', 'a', 'old desc');
    writePluginSkill(home, 's', 'p', 'new', 'a', 'new desc');
    const oldDir = join(home, '.codex', 'plugins', 'cache', 's', 'p', 'old');
    utimesSync(oldDir, new Date(2000, 0, 1), new Date(2000, 0, 1));

    const skills = listCodexPluginSkills({ home });
    expect(skills).toHaveLength(1);
    expect(skills[0]?.description).toBe('new desc');
  });

  it('never lists skills under ~/.codex/skills/.system/', () => {
    writeConfigToml(home, '');
    const sys = join(home, '.codex', 'skills', '.system', 'plugin-creator');
    mkdirSync(sys, { recursive: true });
    writeFileSync(
      join(sys, 'SKILL.md'),
      '---\nname: plugin-creator\ndescription: built-in\n---\n# body\n',
    );
    expect(listCodexPluginSkills({ home })).toEqual([]);
  });
});
