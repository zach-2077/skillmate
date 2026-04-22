import { describe, expect, it } from 'vitest';
import { agents, displayNameToId, knownAgentIds } from '../../src/core/agents.js';

describe('agents map', () => {
  it('exposes claude-code with the right directory', () => {
    expect(agents['claude-code']).toEqual({
      id: 'claude-code',
      displayName: 'Claude Code',
      dirName: '.claude',
    });
  });

  it('exposes a list of known agent ids', () => {
    expect(knownAgentIds).toContain('claude-code');
    expect(knownAgentIds).toContain('cursor');
    expect(knownAgentIds).toContain('gemini-cli');
    expect(knownAgentIds).toContain('github-copilot');
    expect(knownAgentIds.length).toBeGreaterThanOrEqual(10);
  });

  it('reverse-maps display name to id', () => {
    expect(displayNameToId('Claude Code')).toBe('claude-code');
    expect(displayNameToId('Cursor')).toBe('cursor');
    expect(displayNameToId('Gemini CLI')).toBe('gemini-cli');
    expect(displayNameToId('GitHub Copilot')).toBe('github-copilot');
  });

  it('returns undefined for unknown display names', () => {
    expect(displayNameToId('NotARealAgent')).toBeUndefined();
  });
});
