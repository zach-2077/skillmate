import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveEnabledPlugins } from '../../src/core/claude-settings.js';

function writeSettings(dir: string, file: string, contents: object) {
  const target = join(dir, '.claude');
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, file), JSON.stringify(contents));
}

describe('resolveEnabledPlugins', () => {
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

  it('returns empty when no files exist', () => {
    expect(resolveEnabledPlugins({ home, cwd })).toEqual({});
  });

  it('reads user-level enablement', () => {
    writeSettings(home, 'settings.json', { enabledPlugins: { 'foo@bar': true } });
    expect(resolveEnabledPlugins({ home, cwd })).toEqual({
      'foo@bar': { enabled: true, layer: 'user' },
    });
  });

  it('user-local overrides user', () => {
    writeSettings(home, 'settings.json', { enabledPlugins: { 'foo@bar': true } });
    writeSettings(home, 'settings.local.json', { enabledPlugins: { 'foo@bar': false } });
    expect(resolveEnabledPlugins({ home, cwd })).toEqual({
      'foo@bar': { enabled: false, layer: 'user' },
    });
  });

  it('project overrides user even when both set true', () => {
    writeSettings(home, 'settings.json', { enabledPlugins: { 'foo@bar': true } });
    writeSettings(cwd, 'settings.json', { enabledPlugins: { 'foo@bar': true } });
    expect(resolveEnabledPlugins({ home, cwd })).toEqual({
      'foo@bar': { enabled: true, layer: 'project' },
    });
  });

  it('project-local overrides project', () => {
    writeSettings(cwd, 'settings.json', { enabledPlugins: { 'foo@bar': true } });
    writeSettings(cwd, 'settings.local.json', { enabledPlugins: { 'foo@bar': false } });
    expect(resolveEnabledPlugins({ home, cwd })).toEqual({
      'foo@bar': { enabled: false, layer: 'project' },
    });
  });

  it('records layer as project when project disables a user-enabled plugin', () => {
    writeSettings(home, 'settings.json', { enabledPlugins: { 'foo@bar': true } });
    writeSettings(cwd, 'settings.json', { enabledPlugins: { 'foo@bar': false } });
    expect(resolveEnabledPlugins({ home, cwd })).toEqual({
      'foo@bar': { enabled: false, layer: 'project' },
    });
  });

  it('ignores non-boolean values', () => {
    writeSettings(home, 'settings.json', { enabledPlugins: { 'foo@bar': 'yes' } });
    expect(resolveEnabledPlugins({ home, cwd })).toEqual({});
  });

  it('tolerates corrupt JSON', () => {
    mkdirSync(join(home, '.claude'), { recursive: true });
    writeFileSync(join(home, '.claude', 'settings.json'), '{not json');
    expect(resolveEnabledPlugins({ home, cwd })).toEqual({});
  });

  it('merges multiple plugins across layers', () => {
    writeSettings(home, 'settings.json', {
      enabledPlugins: { 'a@x': true, 'b@x': true },
    });
    writeSettings(cwd, 'settings.json', {
      enabledPlugins: { 'b@x': false, 'c@x': true },
    });
    expect(resolveEnabledPlugins({ home, cwd })).toEqual({
      'a@x': { enabled: true, layer: 'user' },
      'b@x': { enabled: false, layer: 'project' },
      'c@x': { enabled: true, layer: 'project' },
    });
  });
});
