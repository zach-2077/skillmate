import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';
import { Installed } from '../../src/screens/Installed.js';
import { StoreProvider } from '../../src/store.js';

const sample = [
  { name: 'react', description: 'react helper', scope: 'global' as const, agents: ['claude-code'], path: '/p/r' },
  { name: 'pdf', description: 'pdf helper', scope: 'global' as const, agents: ['cursor'], path: '/p/p' },
];

function manySkills(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    name: `skill-${i.toString().padStart(3, '0')}`,
    description: `description ${i}`,
    scope: 'global' as const,
    agents: ['claude-code'],
    path: `/p/${i}`,
  }));
}

function withStore(override = {}) {
  return render(
    <StoreProvider override={override}>
      <Installed />
    </StoreProvider>,
  );
}

describe('Installed screen', () => {
  it('renders only skills for current agent', () => {
    const { lastFrame } = withStore({ installed: sample, currentAgent: 'claude-code' });
    expect(lastFrame()).toContain('react');
    expect(lastFrame()).not.toContain('pdf');
  });

  it('shows empty state when no skills for agent', () => {
    const { lastFrame } = withStore({ installed: sample, currentAgent: 'codex' });
    expect(lastFrame()).toMatch(/no skills installed/i);
  });

  it('shows loading message', () => {
    const { lastFrame } = withStore({ loadingInstalled: true });
    expect(lastFrame()).toMatch(/loading/i);
  });

  it('shows error message', () => {
    const { lastFrame } = withStore({ installedError: 'boom' });
    expect(lastFrame()).toContain('boom');
  });

  it('cycles current agent on tab', async () => {
    const { lastFrame, stdin } = render(
      <StoreProvider override={{ installed: sample, currentAgent: 'claude-code' }}>
        <Installed />
      </StoreProvider>,
    );
    expect(lastFrame()).toContain('Claude Code');
    await new Promise((r) => setTimeout(r, 10));
    stdin.write('\t');
    await new Promise((r) => setTimeout(r, 10));
    expect(lastFrame()).toContain('Cursor');
  });

  it('filters by substring when [/] is pressed', async () => {
    const list = [
      { name: 'git-commit', description: '', scope: 'global' as const, agents: ['claude-code'], path: '/p/a' },
      { name: 'react-magic', description: '', scope: 'global' as const, agents: ['claude-code'], path: '/p/b' },
      { name: 'pdf', description: '', scope: 'global' as const, agents: ['claude-code'], path: '/p/c' },
    ];
    const { lastFrame, stdin } = render(
      <StoreProvider override={{ installed: list, currentAgent: 'claude-code' }}>
        <Installed />
      </StoreProvider>,
    );
    await new Promise((r) => setTimeout(r, 10));
    stdin.write('/');
    await new Promise((r) => setTimeout(r, 10));
    for (const c of 'git') {
      stdin.write(c);
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(lastFrame()).toContain('git-commit');
    expect(lastFrame()).not.toContain('react-magic');
    expect(lastFrame()).not.toContain('pdf');
  });

  it('clears filter on [esc]', async () => {
    const list = [
      { name: 'git-commit', description: '', scope: 'global' as const, agents: ['claude-code'], path: '/p/a' },
      { name: 'pdf', description: '', scope: 'global' as const, agents: ['claude-code'], path: '/p/b' },
    ];
    const { lastFrame, stdin } = render(
      <StoreProvider override={{ installed: list, currentAgent: 'claude-code' }}>
        <Installed />
      </StoreProvider>,
    );
    await new Promise((r) => setTimeout(r, 10));
    stdin.write('/');
    await new Promise((r) => setTimeout(r, 10));
    stdin.write('g');
    await new Promise((r) => setTimeout(r, 10));
    expect(lastFrame()).not.toContain('pdf');
    stdin.write(''); // ESC
    await new Promise((r) => setTimeout(r, 10));
    expect(lastFrame()).toContain('pdf');
    expect(lastFrame()).toContain('git-commit');
  });

  it('caps the visible page and hides rows beyond the cap', () => {
    const { lastFrame } = withStore({ installed: manySkills(100), currentAgent: 'claude-code' });
    // Page size is 10; first 10 rows render, the rest are hidden.
    expect(lastFrame()).toContain('skill-000');
    expect(lastFrame()).toContain('skill-009');
    expect(lastFrame()).not.toContain('skill-010');
    expect(lastFrame()).not.toContain('skill-099');
    // Total count is shown in the section header.
    expect(lastFrame()).toContain('Total: 100');
  });
});
