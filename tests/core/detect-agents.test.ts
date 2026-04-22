import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { detectAgents } from '../../src/core/detect-agents.js';

describe('detectAgents', () => {
  let home: string;
  beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'sg-home-')); });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it('returns empty when no agent dirs exist', () => {
    expect(detectAgents({ home })).toEqual([]);
  });

  it('detects claude-code when ~/.claude exists', () => {
    mkdirSync(join(home, '.claude'));
    expect(detectAgents({ home })).toContain('claude-code');
  });

  it('detects multiple agents', () => {
    mkdirSync(join(home, '.claude'));
    mkdirSync(join(home, '.cursor'));
    const detected = detectAgents({ home });
    expect(detected).toContain('claude-code');
    expect(detected).toContain('cursor');
  });

  it('handles nested dirNames like .codeium/windsurf', () => {
    mkdirSync(join(home, '.codeium', 'windsurf'), { recursive: true });
    expect(detectAgents({ home })).toContain('windsurf');
  });
});
