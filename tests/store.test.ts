import { describe, expect, it } from 'vitest';
import { reducer, initialState, type Action } from '../src/store.js';
import type { State } from '../src/store.js';
import type { Config } from '../src/core/config.js';

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
    const next = reducer(initialState, { type: 'agent/select', payload: 'codex' });
    expect(next.currentAgent).toBe('codex');
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

describe('reducer (Phase 2)', () => {
  it('updates search query', () => {
    const next = reducer(initialState, { type: 'search/query', payload: 'react' });
    expect(next.searchQuery).toBe('react');
  });

  it('stores search results when query matches current searchQuery', () => {
    const seeded = reducer(initialState, { type: 'search/query', payload: 'react' });
    const next = reducer(seeded, {
      type: 'search/results',
      payload: { query: 'react', results: [{ id: 'a/b/c', skillId: 'c', name: 'c', source: 'a/b', installs: 1 }] },
    });
    expect(next.searchResults).toHaveLength(1);
    expect(next.searching).toBe(false);
  });

  it('drops stale search results when query has changed', () => {
    const seeded = reducer(initialState, { type: 'search/query', payload: 'next' });
    const next = reducer(seeded, {
      type: 'search/results',
      payload: { query: 'old', results: [{ id: 'a/b/c', skillId: 'c', name: 'c', source: 'a/b', installs: 1 }] },
    });
    expect(next.searchResults).toHaveLength(0);
  });

  it('stores popular list', () => {
    const next = reducer(initialState, {
      type: 'popular/loaded',
      payload: [{ id: 'a/b/c', skillId: 'c', name: 'c', source: 'a/b', installs: 0 }],
    });
    expect(next.popular).toHaveLength(1);
  });

  it('selects skill for detail', () => {
    const next = reducer(initialState, {
      type: 'detail/select',
      payload: { id: 'a/b/c', skillId: 'c', name: 'c', source: 'a/b', installs: 1 },
    });
    expect(next.detail?.id).toBe('a/b/c');
  });

  it('records and clears ops', () => {
    const start = reducer(initialState, { type: 'op/start', payload: { id: 'a/b/c', kind: 'install' } });
    expect(start.ops['a/b/c']).toMatchObject({ kind: 'install', state: 'running' });
    const done = reducer(start, { type: 'op/done', payload: { id: 'a/b/c' } });
    expect(done.ops['a/b/c']).toBeUndefined();
  });

  it('records op error', () => {
    const start = reducer(initialState, { type: 'op/start', payload: { id: 'a/b/c', kind: 'install' } });
    const err = reducer(start, { type: 'op/error', payload: { id: 'a/b/c', message: 'boom' } });
    expect(err.ops['a/b/c']).toMatchObject({ state: 'error', message: 'boom' });
  });

  it('pushes and dismisses toasts', () => {
    const pushed = reducer(initialState, { type: 'toast/push', payload: { id: 't1', kind: 'info', text: 'hi' } });
    expect(pushed.toasts).toHaveLength(1);
    const dismissed = reducer(pushed, { type: 'toast/dismiss', payload: 't1' });
    expect(dismissed.toasts).toHaveLength(0);
  });

  it('switches screen to search and detail', () => {
    expect(reducer(initialState, { type: 'screen/show', payload: 'search' }).screen).toBe('search');
    expect(reducer(initialState, { type: 'screen/show', payload: 'detail' }).screen).toBe('detail');
  });
});

describe('reducer (Phase 3)', () => {
  it('loads config and updates currentAgent', () => {
    const cfg: Config = {
      defaultAgents: ['claude-code'],
      defaultScope: 'global',
      confirmRemove: false,
      autoUpdate: true,
      currentAgent: 'codex',
    };
    const next = reducer(initialState, { type: 'config/load', payload: cfg });
    expect(next.config).toEqual(cfg);
    expect(next.currentAgent).toBe('codex');
  });

  it('switches screen to settings', () => {
    expect(reducer(initialState, { type: 'screen/show', payload: 'settings' }).screen).toBe('settings');
  });

  it('toggles help overlay', () => {
    const opened = reducer(initialState, { type: 'help/toggle' });
    expect(opened.helpOpen).toBe(true);
    const closed = reducer(opened, { type: 'help/toggle' });
    expect(closed.helpOpen).toBe(false);
  });
});
