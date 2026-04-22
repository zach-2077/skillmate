import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useStore, type SearchResult } from '../store.js';
import { searchSkills } from '../core/registry.js';
import { TabBar } from '../components/TabBar.js';
import { Footer } from '../components/Footer.js';
import { ToastList } from '../components/Toast.js';
import { agents } from '../core/agents.js';

const FOOTER_KEYS: ReadonlyArray<[string, string]> = [
  ['←→', 'tab'],
  ['↑↓', 'move'],
  ['enter', 'detail'],
  ['esc', 'clear'],
  ['q', 'quit'],
];

const DEBOUNCE_MS = 250;

function formatInstalls(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function Search(): React.ReactElement {
  const { state, dispatch } = useStore();
  const [cursor, setCursor] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (state.searchQuery.length < 2) {
      abortRef.current?.abort();
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = state.searchQuery;
    timerRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      dispatch({ type: 'search/loading' });
      searchSkills(q, ctl.signal)
        .then((results) =>
          dispatch({ type: 'search/results', payload: { query: q, results } }),
        )
        .catch((err: Error) => {
          if (err.name !== 'AbortError') {
            dispatch({ type: 'search/error', payload: err.message });
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.searchQuery, dispatch]);

  const showingPopular = state.searchQuery.length < 2;
  const list = showingPopular ? state.popular : state.searchResults;

  useInput((input, key) => {
    if (key.escape) {
      if (state.searchQuery) {
        dispatch({ type: 'search/query', payload: '' });
        setCursor(0);
      }
      return;
    }
    if (key.upArrow) return setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) return setCursor((c) => Math.min(list.length - 1, c + 1));
    if (key.return) {
      const selected = list[Math.min(cursor, list.length - 1)];
      if (selected) {
        dispatch({ type: 'detail/select', payload: selected });
        dispatch({ type: 'screen/show', payload: 'detail' });
      }
      return;
    }
    if (input === 'q' && !state.searchQuery) {
      process.exit(0);
    }
    if (key.backspace || key.delete) {
      dispatch({ type: 'search/query', payload: state.searchQuery.slice(0, -1) });
      setCursor(0);
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      dispatch({ type: 'search/query', payload: state.searchQuery + input });
      setCursor(0);
    }
  });

  const clampedCursor = Math.min(cursor, Math.max(0, list.length - 1));

  return (
    <Box flexDirection="column">
      <TabBar
        active="search"
        agent={agents[state.currentAgent]?.displayName ?? state.currentAgent}
      />
      <Box paddingX={1} marginTop={1}>
        <Text bold>Discover skills </Text>
        <Text dimColor>({list.length})</Text>
      </Box>
      <Box paddingX={1}>
        <Text dimColor>⌕ </Text>
        <Text>{state.searchQuery}</Text>
        <Text inverse> </Text>
      </Box>
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {state.searching && <Text dimColor>searching…</Text>}
        {state.searchError && <Text color="red">{state.searchError}</Text>}
        {!state.searching && !state.searchError && list.length === 0 && (
          <Text dimColor>
            {showingPopular ? 'loading popular skills…' : 'no results.'}
          </Text>
        )}
        {list.map((r: SearchResult, i) => {
          const isCursor = i === clampedCursor;
          return (
            <Box key={r.id} flexDirection="column">
              <Box>
                <Text color={isCursor ? 'yellow' : undefined}>{isCursor ? ') ' : '○ '}</Text>
                <Text bold={isCursor} color={isCursor ? 'yellow' : undefined}>
                  {r.name}
                </Text>
                <Text dimColor> · {r.source}</Text>
                {r.installs > 0 && <Text dimColor> · {formatInstalls(r.installs)} installs</Text>}
              </Box>
            </Box>
          );
        })}
      </Box>
      <ToastList toasts={state.toasts} />
      <Footer keys={FOOTER_KEYS} />
    </Box>
  );
}
