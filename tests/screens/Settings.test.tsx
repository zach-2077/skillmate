import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Settings } from '../../src/screens/Settings.js';
import { StoreProvider } from '../../src/store.js';

vi.mock('../../src/core/config.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/core/config.js')>(
    '../../src/core/config.js',
  );
  return { ...actual, saveConfig: vi.fn() };
});

vi.mock('../../src/core/detect-agents.js', () => ({
  detectAgents: vi.fn().mockReturnValue(['claude-code', 'codex']),
}));

describe('Settings screen', () => {
  it('renders detected agents as toggleable rows', () => {
    const { lastFrame } = render(
      <StoreProvider override={{ screen: 'settings', config: null }}>
        <Settings />
      </StoreProvider>,
    );
    expect(lastFrame()).toContain('Claude Code');
    expect(lastFrame()).toContain('Codex');
  });

  it('shows scope radios', () => {
    const { lastFrame } = render(
      <StoreProvider override={{ screen: 'settings', config: null }}>
        <Settings />
      </StoreProvider>,
    );
    expect(lastFrame()).toMatch(/global/i);
    expect(lastFrame()).toMatch(/project/i);
  });

  it('toggles the focused agent on space', async () => {
    const { lastFrame, stdin } = render(
      <StoreProvider override={{ screen: 'settings', config: null }}>
        <Settings />
      </StoreProvider>,
    );
    await new Promise((r) => setTimeout(r, 10));
    // First toggleable row is the first agent (Claude Code). Start state depends on config
    // — with null config, initial draft includes detected agents, so the box is [x].
    // Press space to toggle it off.
    stdin.write(' ');
    await new Promise((r) => setTimeout(r, 10));
    expect(lastFrame()).toMatch(/\[ \] Claude Code/);
  });

  it('renders all known agents, marking undetected ones', () => {
    const { lastFrame } = render(
      <StoreProvider override={{ screen: 'settings', config: null }}>
        <Settings />
      </StoreProvider>,
    );
    // Detected (mocked to ['claude-code', 'codex']) — no "(not detected)" tag.
    expect(lastFrame()).toContain('Claude Code');
    expect(lastFrame()).toContain('Codex');
    // An agent NOT in the detected mock should still appear, with the tag.
    expect(lastFrame()).toContain('Gemini CLI');
    expect(lastFrame()).toContain('OpenCode');
    expect(lastFrame()).toMatch(/Gemini CLI.*\(not detected\)/);
  });

  it('saves and exits on enter', async () => {
    const { saveConfig } = await import('../../src/core/config.js');
    const { stdin } = render(
      <StoreProvider override={{ screen: 'settings', config: null }}>
        <Settings />
      </StoreProvider>,
    );
    await new Promise((r) => setTimeout(r, 10));
    stdin.write('\r');
    await new Promise((r) => setTimeout(r, 10));
    expect(saveConfig).toHaveBeenCalled();
  });
});
