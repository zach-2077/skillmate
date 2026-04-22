import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

vi.mock('../src/core/config.js', () => ({
  loadConfig: vi.fn().mockReturnValue({
    defaultAgents: ['claude-code'],
    defaultScope: 'global',
    confirmRemove: true,
    autoUpdate: false,
    currentAgent: 'claude-code',
  }),
  saveConfig: vi.fn(),
  defaultConfig: {
    defaultAgents: [],
    defaultScope: 'global',
    confirmRemove: true,
    autoUpdate: false,
    currentAgent: 'claude-code',
  },
  DEFAULT_CONFIG_DIR: '/tmp/sg',
}));
vi.mock('../src/core/installed.js', () => ({
  refreshInstalled: vi.fn().mockResolvedValue([
    { name: 'demo', description: 'd', scope: 'global', agents: ['claude-code'], path: '/p/d' },
  ]),
}));

import { App, cycleTab } from '../src/app.js';

describe('cycleTab', () => {
  it('cycles forward installed -> search -> settings -> installed', () => {
    expect(cycleTab('installed', 1)).toBe('search');
    expect(cycleTab('search', 1)).toBe('settings');
    expect(cycleTab('settings', 1)).toBe('installed');
  });

  it('cycles backward installed -> settings -> search -> installed', () => {
    expect(cycleTab('installed', -1)).toBe('settings');
    expect(cycleTab('settings', -1)).toBe('search');
    expect(cycleTab('search', -1)).toBe('installed');
  });

  it('treats detail as belonging to the search tab', () => {
    expect(cycleTab('detail', 1)).toBe('settings');
    expect(cycleTab('detail', -1)).toBe('installed');
  });
});

describe('App', () => {
  it('renders the installed screen and loads skills', async () => {
    const { lastFrame } = render(<App />);
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain('agent:');
    expect(lastFrame()).toContain('demo');
  });
});
