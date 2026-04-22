import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

vi.mock('../src/core/config.js', () => ({
  loadConfig: vi.fn().mockReturnValue(null),
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
vi.mock('../src/core/detect-agents.js', () => ({
  detectAgents: vi.fn().mockReturnValue(['claude-code']),
}));
vi.mock('../src/core/installed.js', () => ({ refreshInstalled: vi.fn().mockResolvedValue([]) }));
vi.mock('../src/core/registry.js', () => ({
  fetchPopular: vi.fn().mockResolvedValue([]),
  searchSkills: vi.fn().mockResolvedValue([]),
  fetchSkillMd: vi.fn().mockResolvedValue(null),
  DEFAULT_CACHE_DIR: '/tmp/cache',
}));

import { App } from '../src/app.js';

describe('App first-run', () => {
  it('lands on settings when no config exists', async () => {
    const { lastFrame } = render(<App />);
    await new Promise((r) => setTimeout(r, 30));
    expect(lastFrame()).toMatch(/Default install targets/);
  });
});

describe('App configured', () => {
  it('skips settings when config exists', async () => {
    const { loadConfig } = await import('../src/core/config.js');
    (loadConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      defaultAgents: ['claude-code'],
      defaultScope: 'global',
      confirmRemove: true,
      autoUpdate: false,
      currentAgent: 'claude-code',
    });
    const { lastFrame } = render(<App />);
    await new Promise((r) => setTimeout(r, 30));
    // Should be on Installed screen — no Settings-specific header.
    expect(lastFrame() ?? '').not.toMatch(/Default install targets/);
  });
});
