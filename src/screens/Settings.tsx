import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useStore } from '../store.js';
import { agents, knownAgentIds, type AgentId } from '../core/agents.js';
import { detectAgents } from '../core/detect-agents.js';
import { saveConfig, defaultConfig, type Config } from '../core/config.js';
import { refreshInstalled } from '../core/installed.js';
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

const TWO_COLUMN_MIN_WIDTH = 80;

type Row =
  | { kind: 'header'; label: string }
  | { kind: 'agent'; label: string; agentId: AgentId; detected: boolean }
  | { kind: 'scope'; label: string; value: 'global' | 'project' }
  | { kind: 'confirm-remove'; label: string }
  | { kind: 'auto-update'; label: string }
  | { kind: 'show-plugin-skills'; label: string };

function buildRows(detected: AgentId[]): Row[] {
  const detectedSet = new Set(detected);
  const agentRows: Row[] = knownAgentIds.map((id) => ({
    kind: 'agent',
    agentId: id,
    label: agents[id]?.displayName ?? id,
    detected: detectedSet.has(id),
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
    { kind: 'show-plugin-skills', label: 'Show plugin skills' },
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

function agentRange(rows: Row[]): { start: number; end: number } {
  const start = rows.findIndex((r) => r.kind === 'agent');
  let end = start;
  while (end < rows.length && rows[end]!.kind === 'agent') end += 1;
  return { start, end };
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
      const prev = state.config;
      saveConfig(draft);
      dispatch({ type: 'config/load', payload: draft });
      dispatch({ type: 'screen/show', payload: 'installed' });
      if (prev?.showPluginSkills !== draft.showPluginSkills) {
        dispatch({ type: 'installed/loading' });
        void refreshInstalled({ showPluginSkills: draft.showPluginSkills })
          .then((skills) => dispatch({ type: 'installed/loaded', payload: skills }))
          .catch((err: Error) => dispatch({ type: 'installed/error', payload: err.message }));
      }
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
          case 'show-plugin-skills':
            return { ...d, showPluginSkills: !d.showPluginSkills };
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
      case 'show-plugin-skills':
        return draft.showPluginSkills ? '[x]' : '[ ]';
      case 'header':
        return '';
    }
  }

  function renderAgentRow(row: Row & { kind: 'agent' }, globalIdx: number): React.ReactElement {
    const isCursor = globalIdx === cursor;
    const notDetected = !row.detected;
    return (
      <Box key={globalIdx}>
        <Text color={isCursor ? 'yellow' : undefined}>{isCursor ? '> ' : '  '}</Text>
        <Text dimColor={!isCursor}>{marker(row)} </Text>
        <Text
          bold={isCursor}
          color={isCursor ? 'yellow' : undefined}
          dimColor={notDetected && !isCursor}
        >
          {row.label}
        </Text>
        {notDetected && <Text dimColor> (not detected)</Text>}
      </Box>
    );
  }

  function renderNonAgentRow(row: Row, i: number): React.ReactElement {
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
  }

  const { start: agentStart, end: agentEnd } = agentRange(rows);
  const agentRows = rows.slice(agentStart, agentEnd) as (Row & { kind: 'agent' })[];
  const twoColumns = (process.stdout.columns ?? 80) >= TWO_COLUMN_MIN_WIDTH;
  const rowsPerColumn = twoColumns ? Math.ceil(agentRows.length / 2) : agentRows.length;
  const col0 = agentRows.slice(0, rowsPerColumn);
  const col1 = agentRows.slice(rowsPerColumn);

  return (
    <Box flexDirection="column">
      <TabBar active="settings" />
      <Box flexDirection="column" paddingX={1} marginTop={1} flexGrow={1}>
        {/* Pre-agent rows (expect: the first header only) */}
        {rows.slice(0, agentStart).map((row, i) => renderNonAgentRow(row, i))}

        {/* Agent rows — one or two columns */}
        {twoColumns ? (
          <Box flexDirection="row">
            <Box flexDirection="column" width="50%">
              {col0.map((row, i) => renderAgentRow(row, agentStart + i))}
            </Box>
            <Box flexDirection="column" width="50%">
              {col1.map((row, i) => renderAgentRow(row, agentStart + rowsPerColumn + i))}
            </Box>
          </Box>
        ) : (
          <Box flexDirection="column">
            {agentRows.map((row, i) => renderAgentRow(row, agentStart + i))}
          </Box>
        )}

        {/* Post-agent rows */}
        {rows.slice(agentEnd).map((row, i) => renderNonAgentRow(row, agentEnd + i))}
      </Box>
      <ToastList toasts={state.toasts} />
      <Footer keys={FOOTER_KEYS} />
    </Box>
  );
}
