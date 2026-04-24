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
});
