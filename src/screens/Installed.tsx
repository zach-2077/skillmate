import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useStore } from '../store.js';
import { knownAgentIds, agents } from '../core/agents.js';
import { Header } from '../components/Header.js';
import { Footer } from '../components/Footer.js';

const FOOTER_KEYS: ReadonlyArray<[string, string]> = [
  ['↑↓', 'move'],
  ['tab', 'switch agent'],
  ['q', 'quit'],
];

export function Installed(): React.ReactElement {
  const { state, dispatch } = useStore();
  const [cursor, setCursor] = useState(0);

  const filtered = state.installed.filter((s) => s.agents.includes(state.currentAgent));

  useInput((input, key) => {
    if (key.tab) {
      const idx = knownAgentIds.indexOf(state.currentAgent);
      const next = knownAgentIds[(idx + 1) % knownAgentIds.length]!;
      dispatch({ type: 'agent/select', payload: next });
      setCursor(0);
    } else if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor((c) => Math.min(filtered.length - 1, c + 1));
    } else if (input === 'q') {
      process.exit(0);
    }
  });

  return (
    <Box flexDirection="column">
      <Header agent={agents[state.currentAgent]?.displayName ?? state.currentAgent} />
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {state.loadingInstalled && <Text dimColor>loading installed skills…</Text>}
        {state.installedError && <Text color="red">{state.installedError}</Text>}
        {!state.loadingInstalled && !state.installedError && filtered.length === 0 && (
          <Text dimColor>no skills installed for this agent. press [tab] to switch.</Text>
        )}
        {filtered.map((skill, i) => (
          <Box key={`${skill.scope}:${skill.name}`}>
            <Text color={i === cursor ? 'cyan' : undefined}>{i === cursor ? '▸ ' : '  '}</Text>
            <Box width={3}>
              <Text dimColor>{skill.scope === 'global' ? 'G' : 'P'}</Text>
            </Box>
            <Box width={32}>
              <Text bold={i === cursor}>{skill.name}</Text>
            </Box>
            <Text dimColor>{skill.description}</Text>
          </Box>
        ))}
      </Box>
      <Footer keys={FOOTER_KEYS} />
    </Box>
  );
}
