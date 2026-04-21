import { describe, expect, it } from 'vitest';
import { agents, displayNameToId, knownAgentIds } from '../../src/core/agents.js';

describe('agents map', () => {
  it('exposes claude with the right directory', () => {
    expect(agents.claude).toEqual({ id: 'claude', displayName: 'Claude Code', dirName: '.claude' });
  });

  it('exposes a list of known agent ids', () => {
    expect(knownAgentIds).toContain('claude');
    expect(knownAgentIds).toContain('cursor');
    expect(knownAgentIds.length).toBeGreaterThan(2);
  });

  it('reverse-maps display name to id', () => {
    expect(displayNameToId('Claude Code')).toBe('claude');
    expect(displayNameToId('Cursor')).toBe('cursor');
  });

  it('returns undefined for unknown display names', () => {
    expect(displayNameToId('NotARealAgent')).toBeUndefined();
  });
});
