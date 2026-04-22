import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Detail } from '../../src/screens/Detail.js';
import { StoreProvider } from '../../src/store.js';

vi.mock('../../src/core/registry.js', () => ({
  fetchSkillMd: vi.fn().mockResolvedValue('---\nname: x\n---\n# Hello\n\nbody.'),
  DEFAULT_CACHE_DIR: '/tmp/skillmate-detail',
}));

describe('Detail screen', () => {
  it('shows search-entry header with source + installs', async () => {
    const detail = { id: 'a/b/c', skillId: 'c', name: 'c', source: 'a/b', installs: 99 };
    const { lastFrame } = render(
      <StoreProvider override={{ screen: 'detail', detail }}>
        <Detail />
      </StoreProvider>,
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(lastFrame()).toContain('a/b');
    expect(lastFrame()).toContain('99');
  });

  it('shows preview-unavailable when fetch returns null', async () => {
    const detail = { id: 'x/y/z', skillId: 'z', name: 'z', source: 'x/y', installs: 0 };
    const { fetchSkillMd } = await import('../../src/core/registry.js');
    (fetchSkillMd as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const { lastFrame } = render(
      <StoreProvider override={{ screen: 'detail', detail }}>
        <Detail />
      </StoreProvider>,
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(lastFrame()).toMatch(/preview unavailable/i);
    expect(lastFrame()).toContain('npx skills add x/y/z');
  });
});
