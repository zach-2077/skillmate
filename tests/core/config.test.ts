import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig, saveConfig, defaultConfig, type Config } from '../../src/core/config.js';

describe('config', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sg-config-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null when no config file exists', () => {
    expect(loadConfig({ dir })).toBeNull();
  });

  it('round-trips a saved config', () => {
    const cfg: Config = {
      defaultAgents: ['claude-code', 'cursor'],
      defaultScope: 'global',
      confirmRemove: true,
      autoUpdate: false,
      currentAgent: 'claude-code',
    };
    saveConfig(cfg, { dir });
    expect(loadConfig({ dir })).toEqual(cfg);
  });

  it('overlays partial saved config on defaults', () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ confirmRemove: false }));
    const loaded = loadConfig({ dir });
    expect(loaded).not.toBeNull();
    expect(loaded!.confirmRemove).toBe(false);
    expect(loaded!.defaultScope).toBe(defaultConfig.defaultScope);
  });

  it('returns null on corrupt JSON', () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), '{not json');
    expect(loadConfig({ dir })).toBeNull();
  });

  it('creates the directory on save', () => {
    saveConfig(defaultConfig, { dir });
    expect(existsSync(join(dir, 'config.json'))).toBe(true);
  });
});
