import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useStore } from '../store.js';
import { knownAgentIds, agents } from '../core/agents.js';
import type { InstalledSkill } from '../core/installed.js';
import { Header } from '../components/Header.js';
import { Footer } from '../components/Footer.js';

const FOOTER_KEYS: ReadonlyArray<[string, string]> = [
  ['↑↓', 'move'],
  ['/', 'filter'],
  ['tab', 'switch agent'],
  ['q', 'quit'],
];

const FOOTER_KEYS_FILTERING: ReadonlyArray<[string, string]> = [
  ['↑↓', 'move'],
  ['enter', 'apply'],
  ['esc', 'clear'],
];

function matchesFilter(skill: InstalledSkill, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return skill.name.toLowerCase().includes(q) || skill.description.toLowerCase().includes(q);
}

function viewportHeight(): number {
  return Math.max(3, (process.stdout.rows ?? 24) - 6);
}

export function Installed(): React.ReactElement {
  const { state, dispatch } = useStore();
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [filterQuery, setFilterQuery] = useState('');
  const [filtering, setFiltering] = useState(false);

  const filtered = state.installed
    .filter((s) => s.agents.includes(state.currentAgent))
    .filter((s) => matchesFilter(s, filterQuery));

  const rows = viewportHeight();

  useEffect(() => {
    if (cursor < scrollOffset) setScrollOffset(cursor);
    else if (cursor >= scrollOffset + rows) setScrollOffset(cursor - rows + 1);
  }, [cursor, scrollOffset, rows]);

  function resetPosition() {
    setCursor(0);
    setScrollOffset(0);
  }

  useInput((input, key) => {
    if (filtering) {
      if (key.escape) {
        setFilterQuery('');
        setFiltering(false);
        resetPosition();
        return;
      }
      if (key.return) {
        setFiltering(false);
        return;
      }
      if (key.backspace || key.delete) {
        setFilterQuery((q) => q.slice(0, -1));
        resetPosition();
        return;
      }
      if (key.upArrow) return setCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) return setCursor((c) => Math.min(filtered.length - 1, c + 1));
      if (input && !key.ctrl && !key.meta) {
        setFilterQuery((q) => q + input);
        resetPosition();
      }
      return;
    }

    if (input === '/') return setFiltering(true);
    if (key.tab) {
      const idx = knownAgentIds.indexOf(state.currentAgent);
      const next = knownAgentIds[(idx + 1) % knownAgentIds.length]!;
      dispatch({ type: 'agent/select', payload: next });
      resetPosition();
      return;
    }
    if (key.upArrow) return setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) return setCursor((c) => Math.min(filtered.length - 1, c + 1));
    if (input === 'q') process.exit(0);
  });

  const clampedCursor = Math.min(cursor, Math.max(0, filtered.length - 1));
  const visible = filtered.slice(scrollOffset, scrollOffset + rows);
  const hasMore = filtered.length > rows;

  return (
    <Box flexDirection="column">
      <Header agent={agents[state.currentAgent]?.displayName ?? state.currentAgent} />
      {(filtering || filterQuery) && (
        <Box paddingX={1}>
          <Text dimColor>filter: </Text>
          <Text>{filterQuery}</Text>
          {filtering && <Text inverse> </Text>}
        </Box>
      )}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {state.loadingInstalled && <Text dimColor>loading installed skills…</Text>}
        {state.installedError && <Text color="red">{state.installedError}</Text>}
        {!state.loadingInstalled && !state.installedError && filtered.length === 0 && (
          <Text dimColor>
            {filterQuery
              ? 'no matches. press [esc] to clear filter.'
              : 'no skills installed for this agent. press [tab] to switch.'}
          </Text>
        )}
        {visible.map((skill, i) => {
          const globalIdx = scrollOffset + i;
          const isCursor = globalIdx === clampedCursor;
          return (
            <Box key={`${skill.scope}:${skill.name}`}>
              <Text color={isCursor ? 'cyan' : undefined}>{isCursor ? '▸ ' : '  '}</Text>
              <Box width={3}>
                <Text dimColor>{skill.scope === 'global' ? 'G' : 'P'}</Text>
              </Box>
              <Box width={32}>
                <Text bold={isCursor}>{skill.name}</Text>
              </Box>
              <Text dimColor>{skill.description}</Text>
            </Box>
          );
        })}
        {hasMore && (
          <Text dimColor>
            {clampedCursor + 1}/{filtered.length}
          </Text>
        )}
      </Box>
      <Footer keys={filtering ? FOOTER_KEYS_FILTERING : FOOTER_KEYS} />
    </Box>
  );
}
