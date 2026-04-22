import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

vi.mock('../../src/core/config.js', () => ({
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

vi.mock('../../src/core/installed.js', () => ({
  refreshInstalled: vi.fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { name: 'react-magic', description: '', scope: 'global', agents: ['claude-code'], path: '/p' },
    ]),
}));

vi.mock('../../src/core/registry.js', () => ({
  searchSkills: vi.fn().mockResolvedValue([
    { id: 'a/b/react-magic', skillId: 'react-magic', name: 'react-magic', source: 'a/b', installs: 5 },
  ]),
  fetchPopular: vi.fn().mockResolvedValue([]),
  fetchSkillMd: vi.fn().mockResolvedValue('# react-magic'),
  DEFAULT_CACHE_DIR: '/tmp/skillmate-e2e',
}));

vi.mock('../../src/core/install.js', () => ({
  installSkill: vi.fn().mockResolvedValue(undefined),
  buildAddArgs: vi.fn(),
}));

import { App } from '../../src/app.js';

describe('Phase 2 smoke', () => {
  it('search -> install -> installed refresh', async () => {
    const { lastFrame, stdin } = render(<App />);
    await new Promise((r) => setTimeout(r, 40));

    // Navigate to Discover tab via right arrow (ESC + [C)
    stdin.write('\x1b[C');
    await new Promise((r) => setTimeout(r, 20));

    // Enter search mode with [/]
    stdin.write('/');
    await new Promise((r) => setTimeout(r, 20));

    // Type query one char at a time
    for (const c of 'rea') {
      stdin.write(c);
      await new Promise((r) => setTimeout(r, 20));
    }
    // Wait for debounce + promise to resolve
    await new Promise((r) => setTimeout(r, 400));

    expect(lastFrame()).toContain('react-magic');

    // Exit search input mode so [i] is treated as a command, not a character
    stdin.write('\r');
    await new Promise((r) => setTimeout(r, 20));

    // Open install prompt
    stdin.write('i');
    await new Promise((r) => setTimeout(r, 20));
    expect(lastFrame()).toMatch(/Install a\/b\/react-magic/);

    // Confirm install
    stdin.write('\r');
    // Install + refresh can take a few ticks
    await new Promise((r) => setTimeout(r, 60));

    // Success toast appears
    expect(lastFrame()).toMatch(/installed a\/b\/react-magic/);
  });
});
