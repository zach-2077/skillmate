import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';
import { Installed } from '../../src/screens/Installed.js';
import { StoreProvider } from '../../src/store.js';

const sample = [
  { name: 'react', description: 'react helper', scope: 'global' as const, agents: ['claude'], path: '/p/r' },
  { name: 'pdf', description: 'pdf helper', scope: 'global' as const, agents: ['cursor'], path: '/p/p' },
];

function withStore(override = {}) {
  return render(
    <StoreProvider override={override}>
      <Installed />
    </StoreProvider>,
  );
}

describe('Installed screen', () => {
  it('renders only skills for current agent', () => {
    const { lastFrame } = withStore({ installed: sample, currentAgent: 'claude' });
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
      <StoreProvider override={{ installed: sample, currentAgent: 'claude' }}>
        <Installed />
      </StoreProvider>,
    );
    expect(lastFrame()).toContain('Claude Code');
    await new Promise((r) => setTimeout(r, 10)); // let useEffect mount
    stdin.write('\t');
    await new Promise((r) => setTimeout(r, 10)); // let re-render
    expect(lastFrame()).toContain('Cursor');
  });
});
