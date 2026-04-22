import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

vi.mock('../src/core/installed.js', () => ({
  refreshInstalled: vi.fn().mockResolvedValue([
    { name: 'demo', description: 'd', scope: 'global', agents: ['claude-code'], path: '/p/d' },
  ]),
}));

import { App } from '../src/app.js';

describe('App', () => {
  it('renders the installed screen and loads skills', async () => {
    const { lastFrame } = render(<App />);
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain('agent:');
    expect(lastFrame()).toContain('demo');
  });
});
