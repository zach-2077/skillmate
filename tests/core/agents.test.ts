import { describe, expect, it } from 'vitest';
import { agents, displayNameToId, knownAgentIds } from '../../src/core/agents.js';

describe('agents map', () => {
  it('exposes claude-code with the right directory', () => {
    expect(agents['claude-code']).toEqual({
      id: 'claude-code',
      displayName: 'Claude Code',
      dirName: '.claude',
      isUniversal: false,
    });
  });

  it('flags universal-dir agents', () => {
    expect(agents['gemini-cli']?.isUniversal).toBe(true);
    expect(agents['codex']?.isUniversal).toBe(true);
    expect(agents['opencode']?.isUniversal).toBe(true);
    expect(agents['claude-code']?.isUniversal).toBe(false);
  });

  it('exposes the four supported agent ids', () => {
    expect(knownAgentIds).toEqual(['claude-code', 'codex', 'opencode', 'gemini-cli']);
  });

  it('reverse-maps display name to id', () => {
    expect(displayNameToId('Claude Code')).toBe('claude-code');
    expect(displayNameToId('Codex')).toBe('codex');
    expect(displayNameToId('OpenCode')).toBe('opencode');
    expect(displayNameToId('Gemini CLI')).toBe('gemini-cli');
  });

  it('returns undefined for unknown display names', () => {
    expect(displayNameToId('NotARealAgent')).toBeUndefined();
  });
});
