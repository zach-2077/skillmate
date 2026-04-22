import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Search } from '../../src/screens/Search.js';
import { StoreProvider } from '../../src/store.js';

vi.mock('../../src/core/registry.js', () => ({
  searchSkills: vi.fn().mockResolvedValue([
    { id: 'a/b/c', skillId: 'c', name: 'react-magic', source: 'a/b', installs: 999 },
  ]),
  fetchPopular: vi.fn().mockResolvedValue([]),
  fetchSkillMd: vi.fn(),
  DEFAULT_CACHE_DIR: '/tmp/skillmate-test',
}));

vi.mock('../../src/core/install.js', () => ({
  installSkill: vi.fn().mockResolvedValue(undefined),
  buildAddArgs: vi.fn(),
}));

vi.mock('../../src/core/installed.js', () => ({
  refreshInstalled: vi.fn().mockResolvedValue([]),
}));

describe('Search screen', () => {
  it('shows popular list when query is empty', () => {
    const popular = [
      { id: 'p/q/r', skillId: 'r', name: 'popular-skill', source: 'p/q', installs: 1 },
    ];
    const { lastFrame } = render(
      <StoreProvider override={{ screen: 'search', popular }}>
        <Search />
      </StoreProvider>,
    );
    expect(lastFrame()).toContain('popular-skill');
    expect(lastFrame()).toMatch(/Search skills\.sh/i);
  });

  it('shows search results when query has 2+ chars', () => {
    const results = [
      { id: 'a/b/c', skillId: 'c', name: 'react-magic', source: 'a/b', installs: 999 },
    ];
    const { lastFrame } = render(
      <StoreProvider
        override={{ screen: 'search', searchQuery: 'rea', searchResults: results }}
      >
        <Search />
      </StoreProvider>,
    );
    expect(lastFrame()).toContain('react-magic');
  });

  it('shows searching indicator', () => {
    const { lastFrame } = render(
      <StoreProvider
        override={{ screen: 'search', searchQuery: 'rea', searching: true }}
      >
        <Search />
      </StoreProvider>,
    );
    expect(lastFrame()).toMatch(/searching/i);
  });

  it('shows error when search fails', () => {
    const { lastFrame } = render(
      <StoreProvider
        override={{ screen: 'search', searchQuery: 'rea', searchError: 'offline' }}
      >
        <Search />
      </StoreProvider>,
    );
    expect(lastFrame()).toContain('offline');
  });

  it('types into search query after [/] focuses the input', async () => {
    const { stdin, lastFrame } = render(
      <StoreProvider override={{ screen: 'search', searchQuery: '' }}>
        <Search />
      </StoreProvider>,
    );
    await new Promise((r) => setTimeout(r, 10));
    stdin.write('/');
    await new Promise((r) => setTimeout(r, 10));
    stdin.write('r');
    await new Promise((r) => setTimeout(r, 10));
    stdin.write('e');
    await new Promise((r) => setTimeout(r, 10));
    expect(lastFrame()).toContain('re');
  });

  it('does not update query when input is not focused', async () => {
    const { stdin, lastFrame } = render(
      <StoreProvider override={{ screen: 'search', searchQuery: '' }}>
        <Search />
      </StoreProvider>,
    );
    await new Promise((r) => setTimeout(r, 10));
    stdin.write('r');
    await new Promise((r) => setTimeout(r, 10));
    stdin.write('e');
    await new Promise((r) => setTimeout(r, 10));
    // The search bar should not show 're' because typing without [/] is ignored.
    expect(lastFrame()).not.toMatch(/⌕ re/);
  });

  it('caps visible results at 10 and hides the rest', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: `a/b/s${i.toString().padStart(3, '0')}`,
      skillId: `s${i.toString().padStart(3, '0')}`,
      name: `s${i.toString().padStart(3, '0')}`,
      source: 'a/b',
      installs: 0,
    }));
    const { lastFrame } = render(
      <StoreProvider
        override={{ screen: 'search', searchQuery: 'rea', searchResults: many }}
      >
        <Search />
      </StoreProvider>,
    );
    expect(lastFrame()).toContain('s000');
    expect(lastFrame()).toContain('s009');
    expect(lastFrame()).not.toContain('s010');
    expect(lastFrame()).not.toContain('s024');
  });

  it('opens install prompt on [i]', async () => {
    const popular = [
      { id: 'p/q/r', skillId: 'r', name: 'popular-skill', source: 'p/q', installs: 1 },
    ];
    const { lastFrame, stdin } = render(
      <StoreProvider override={{ screen: 'search', popular, currentAgent: 'claude-code' }}>
        <Search />
      </StoreProvider>,
    );
    await new Promise((r) => setTimeout(r, 10));
    stdin.write('i');
    await new Promise((r) => setTimeout(r, 10));
    expect(lastFrame()).toMatch(/Install p\/q\/r/);
  });
});
