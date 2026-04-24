import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  listGeminiExtensionSkills,
  matchesGlob,
} from '../../src/core/gemini-extensions.js';

function writeEnablement(home: string, body: object): void {
  const dir = join(home, '.gemini', 'extensions');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'extension-enablement.json'), JSON.stringify(body));
}

function writeExtension(home: string, name: string, manifest: object | null): string {
  const dir = join(home, '.gemini', 'extensions', name);
  mkdirSync(dir, { recursive: true });
  if (manifest) {
    writeFileSync(join(dir, 'gemini-extension.json'), JSON.stringify(manifest));
  }
  return dir;
}

function writeExtSkill(extDir: string, skillName: string, description: string): void {
  const skillDir = join(extDir, 'skills', skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${skillName}\ndescription: ${description}\n---\n# body\n`,
  );
}

describe('matchesGlob', () => {
  it('matches an exact path', () => {
    expect(matchesGlob('/Users/x', '/Users/x')).toBe(true);
  });
  it('matches a prefix wildcard', () => {
    expect(matchesGlob('/Users/x/*', '/Users/x/abc')).toBe(true);
    expect(matchesGlob('/Users/x/*', '/Users/x/a/b/c')).toBe(true);
  });
  it('rejects paths outside the prefix', () => {
    expect(matchesGlob('/Users/x/*', '/Users/y/abc')).toBe(false);
  });
  it('matches mid-segment wildcards', () => {
    expect(matchesGlob('/Users/*/codes', '/Users/zach/codes')).toBe(true);
  });
});

describe('listGeminiExtensionSkills', () => {
  let home: string;
  let cwd: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'sm-gemini-'));
    cwd = '/Users/me/work';
  });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it('returns empty when extensions dir is missing', () => {
    expect(listGeminiExtensionSkills({ home, cwd })).toEqual([]);
  });

  it('treats an extension with no enablement entry as enabled', () => {
    const ext = writeExtension(home, 'caveman', {
      name: 'caveman',
      description: 'compressed',
    });
    writeExtSkill(ext, 'compress', 'shrink output');

    const skills = listGeminiExtensionSkills({ home, cwd });
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: 'caveman:compress',
      description: 'shrink output',
      scope: 'extension-gemini',
      agents: ['gemini-cli'],
    });
  });

  it('honors a matching override glob', () => {
    const ext = writeExtension(home, 'sp', { name: 'sp' });
    writeExtSkill(ext, 'tdd', 'tdd desc');
    writeEnablement(home, { sp: { overrides: ['/Users/me/*'] } });
    expect(listGeminiExtensionSkills({ home, cwd })).toHaveLength(1);
  });

  it('skips extensions with non-matching overrides', () => {
    const ext = writeExtension(home, 'sp', { name: 'sp' });
    writeExtSkill(ext, 'tdd', 'tdd desc');
    writeEnablement(home, { sp: { overrides: ['/Users/other/*'] } });
    expect(listGeminiExtensionSkills({ home, cwd })).toEqual([]);
  });

  it('treats empty overrides as enabled everywhere', () => {
    const ext = writeExtension(home, 'sp', { name: 'sp' });
    writeExtSkill(ext, 'tdd', 'tdd desc');
    writeEnablement(home, { sp: { overrides: [] } });
    expect(listGeminiExtensionSkills({ home, cwd })).toHaveLength(1);
  });

  it('honors a negated override that matches cwd as disabled', () => {
    const ext = writeExtension(home, 'sp', { name: 'sp' });
    writeExtSkill(ext, 'tdd', 'tdd desc');
    writeEnablement(home, { sp: { overrides: ['!/Users/me/*'] } });
    expect(listGeminiExtensionSkills({ home, cwd })).toEqual([]);
  });

  it('treats a non-matching negated override as enabled', () => {
    const ext = writeExtension(home, 'sp', { name: 'sp' });
    writeExtSkill(ext, 'tdd', 'tdd desc');
    writeEnablement(home, { sp: { overrides: ['!/Users/other/*'] } });
    expect(listGeminiExtensionSkills({ home, cwd })).toHaveLength(1);
  });

  it('negative overrides win over positive ones', () => {
    const ext = writeExtension(home, 'sp', { name: 'sp' });
    writeExtSkill(ext, 'tdd', 'tdd desc');
    writeEnablement(home, { sp: { overrides: ['/Users/me/*', '!/Users/me/*'] } });
    expect(listGeminiExtensionSkills({ home, cwd })).toEqual([]);
  });

  it('falls back to dir name when manifest is missing', () => {
    const ext = writeExtension(home, 'noman', null);
    writeExtSkill(ext, 'foo', 'd');
    expect(listGeminiExtensionSkills({ home, cwd })[0]?.name).toBe('noman:foo');
  });

  it('skips skill subdirs without SKILL.md', () => {
    const ext = writeExtension(home, 'sp', { name: 'sp' });
    mkdirSync(join(ext, 'skills', 'empty'), { recursive: true });
    expect(listGeminiExtensionSkills({ home, cwd })).toEqual([]);
  });

  it('ignores the enablement.json file when listing extension dirs', () => {
    writeEnablement(home, {});
    const ext = writeExtension(home, 'sp', { name: 'sp' });
    writeExtSkill(ext, 'foo', 'd');
    const skills = listGeminiExtensionSkills({ home, cwd });
    expect(skills).toHaveLength(1);
  });

  it('treats malformed enablement.json as empty (extensions enabled by default)', () => {
    mkdirSync(join(home, '.gemini', 'extensions'), { recursive: true });
    writeFileSync(join(home, '.gemini', 'extensions', 'extension-enablement.json'), '{not json');
    const ext = writeExtension(home, 'sp', { name: 'sp' });
    writeExtSkill(ext, 'foo', 'd');
    expect(listGeminiExtensionSkills({ home, cwd })).toHaveLength(1);
  });
});
