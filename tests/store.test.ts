import { describe, expect, it } from 'vitest';
import { reducer, initialState, type Action } from '../src/store.js';

describe('reducer', () => {
  it('sets installed skills', () => {
    const action: Action = {
      type: 'installed/loaded',
      payload: [
        { name: 'a', description: '', scope: 'global', agents: ['claude-code'], path: '/p/a' },
      ],
    };
    const next = reducer(initialState, action);
    expect(next.installed).toHaveLength(1);
    expect(next.loadingInstalled).toBe(false);
  });

  it('marks installed as loading', () => {
    const next = reducer(initialState, { type: 'installed/loading' });
    expect(next.loadingInstalled).toBe(true);
  });

  it('switches current agent', () => {
    const next = reducer(initialState, { type: 'agent/select', payload: 'cursor' });
    expect(next.currentAgent).toBe('cursor');
  });

  it('switches screen', () => {
    const next = reducer(initialState, { type: 'screen/show', payload: 'installed' });
    expect(next.screen).toBe('installed');
  });

  it('records load error', () => {
    const next = reducer(initialState, { type: 'installed/error', payload: 'boom' });
    expect(next.installedError).toBe('boom');
    expect(next.loadingInstalled).toBe(false);
  });
});
