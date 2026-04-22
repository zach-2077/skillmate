import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useStore } from '../store.js';
import { agents, type AgentId } from '../core/agents.js';
import { detectAgents } from '../core/detect-agents.js';
import { saveConfig, defaultConfig, type Config } from '../core/config.js';
import { TabBar } from '../components/TabBar.js';
import { Footer } from '../components/Footer.js';
import { ToastList } from '../components/Toast.js';

const FOOTER_KEYS: ReadonlyArray<[string, string]> = [
  ['←→', 'tab'],
  ['↑↓', 'move'],
  ['space', 'toggle'],
  ['enter', 'save'],
  ['esc', 'cancel'],
];

type Row =
  | { kind: 'header'; label: string }
  | { kind: 'agent'; label: string; agentId: AgentId }
  | { kind: 'scope'; label: string; value: 'global' | 'project' }
  | { kind: 'confirm-remove'; label: string }
  | { kind: 'auto-update'; label: string };

function buildRows(detected: AgentId[]): Row[] {
  const agentRows: Row[] = detected.map((id) => ({
    kind: 'agent',
    agentId: id,
    label: agents[id]?.displayName ?? id,
  }));
  return [
    { kind: 'header', label: 'Default install targets' },
    ...agentRows,
    { kind: 'header', label: 'Default install scope' },
    { kind: 'scope', label: 'global — install to ~/<agent>/skills', value: 'global' },
    { kind: 'scope', label: 'project — install to ./<agent>/skills', value: 'project' },
    { kind: 'header', label: 'Behavior' },
    { kind: 'confirm-remove', label: 'Confirm before remove' },
    { kind: 'auto-update', label: 'Auto-update on launch' },
  ];
}

function isSelectable(row: Row): boolean {
  return row.kind !== 'header';
}

function nextSelectable(rows: Row[], from: number, delta: 1 | -1): number {
  let i = from + delta;
  while (i >= 0 && i < rows.length) {
    if (isSelectable(rows[i]!)) return i;
    i += delta;
  }
  return from;
}

export function Settings(): React.ReactElement {
  const { state, dispatch } = useStore();
  const detected = detectAgents();

  const initial: Config = state.config ?? {
    ...defaultConfig,
    defaultAgents: detected,
    currentAgent: detected[0] ?? 'claude-code',
  };
  const [draft, setDraft] = useState<Config>(initial);

  const rows = buildRows(detected);
  const firstSelectable = rows.findIndex(isSelectable);
  const [cursor, setCursor] = useState(firstSelectable === -1 ? 0 : firstSelectable);

  useInput((input, key) => {
    if (key.upArrow) return setCursor((c) => nextSelectable(rows, c, -1));
    if (key.downArrow) return setCursor((c) => nextSelectable(rows, c, 1));
    if (key.escape) return dispatch({ type: 'screen/show', payload: 'installed' });
    if (key.return) {
      saveConfig(draft);
      dispatch({ type: 'config/load', payload: draft });
      dispatch({ type: 'screen/show', payload: 'installed' });
      return;
    }
    if (input === ' ') {
      const row = rows[cursor];
      if (!row) return;
      setDraft((d) => {
        switch (row.kind) {
          case 'agent': {
            const set = new Set(d.defaultAgents);
            if (set.has(row.agentId)) set.delete(row.agentId);
            else set.add(row.agentId);
            return { ...d, defaultAgents: [...set] };
          }
          case 'scope':
            return { ...d, defaultScope: row.value };
          case 'confirm-remove':
            return { ...d, confirmRemove: !d.confirmRemove };
          case 'auto-update':
            return { ...d, autoUpdate: !d.autoUpdate };
          case 'header':
            return d;
        }
      });
    }
  });

  function marker(row: Row): string {
    switch (row.kind) {
      case 'agent':
        return draft.defaultAgents.includes(row.agentId) ? '[x]' : '[ ]';
      case 'scope':
        return draft.defaultScope === row.value ? '(•)' : '( )';
      case 'confirm-remove':
        return draft.confirmRemove ? '[x]' : '[ ]';
      case 'auto-update':
        return draft.autoUpdate ? '[x]' : '[ ]';
      case 'header':
        return '';
    }
  }

  return (
    <Box flexDirection="column">
      <TabBar active="settings" />
      <Box flexDirection="column" paddingX={1} marginTop={1} flexGrow={1}>
        {rows.map((row, i) => {
          if (row.kind === 'header') {
            return (
              <Box key={`h-${i}`} marginTop={i === 0 ? 0 : 1}>
                <Text bold>{row.label}</Text>
              </Box>
            );
          }
          const isCursor = i === cursor;
          return (
            <Box key={i}>
              <Text color={isCursor ? 'yellow' : undefined}>{isCursor ? '> ' : '  '}</Text>
              <Text dimColor={!isCursor}>{marker(row)} </Text>
              <Text bold={isCursor} color={isCursor ? 'yellow' : undefined}>
                {row.label}
              </Text>
            </Box>
          );
        })}
      </Box>
      <ToastList toasts={state.toasts} />
      <Footer keys={FOOTER_KEYS} />
    </Box>
  );
}
