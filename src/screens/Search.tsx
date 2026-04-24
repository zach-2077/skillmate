import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useStore, type SearchResult } from '../store.js';
import { searchSkills } from '../core/registry.js';
import { TabBar } from '../components/TabBar.js';
import { Footer } from '../components/Footer.js';
import { ToastList } from '../components/Toast.js';
import { SearchBar } from '../components/SearchBar.js';
import { installSkill, type InstallOpts } from '../core/install.js';
import { refreshInstalled } from '../core/installed.js';
import type { AgentId } from '../core/agents.js';

const FOOTER_KEYS: ReadonlyArray<[string, string]> = [
  ['←→', 'tab'],
  ['↑↓', 'move'],
  ['/', 'search'],
  ['enter', 'detail'],
  ['i', 'install'],
  ['q', 'quit'],
];

const FOOTER_KEYS_SEARCHING: ReadonlyArray<[string, string]> = [
  ['↑↓', 'move'],
  ['enter', 'apply'],
  ['esc', 'clear'],
];

const FOOTER_KEYS_PROMPT: ReadonlyArray<[string, string]> = [
  ['enter', 'confirm'],
  ['esc', 'cancel'],
];

const DEBOUNCE_MS = 250;
const PAGE_SIZE = 10;

function formatInstalls(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function Search(): React.ReactElement {
  const { state, dispatch } = useStore();
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [inputActive, setInputActive] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<{
    result: SearchResult;
    agents: Set<AgentId>;
    scope: 'global' | 'project';
  } | null>(null);

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

  useEffect(() => {
    if (cursor < scrollOffset) setScrollOffset(cursor);
    else if (cursor >= scrollOffset + PAGE_SIZE) setScrollOffset(cursor - PAGE_SIZE + 1);
  }, [cursor, scrollOffset]);

  useInput((input, key) => {
    if (installPrompt) {
      if (key.escape) return setInstallPrompt(null);
      if (key.return) {
        const opts: InstallOpts = {
          id: installPrompt.result.id,
          agents: [...installPrompt.agents],
          scope: installPrompt.scope,
        };
        const opId = installPrompt.result.id;
        setInstallPrompt(null);
        dispatch({ type: 'op/start', payload: { id: opId, kind: 'install' } });
        void (async () => {
          try {
            await installSkill(opts);
            dispatch({ type: 'op/done', payload: { id: opId } });
            dispatch({
              type: 'toast/push',
              payload: { id: `t-${Date.now()}`, kind: 'success', text: `installed ${opts.id}` },
            });
            const fresh = await refreshInstalled({
              showPluginSkills: state.config?.showPluginSkills ?? true,
            });
            dispatch({ type: 'installed/loaded', payload: fresh });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            dispatch({ type: 'op/error', payload: { id: opId, message: msg } });
            dispatch({
              type: 'toast/push',
              payload: { id: `t-${Date.now()}`, kind: 'error', text: msg },
            });
          }
        })();
        return;
      }
      return; // swallow other keys while prompt is open
    }

    if (inputActive) {
      if (key.escape) {
        dispatch({ type: 'search/query', payload: '' });
        setInputActive(false);
        setCursor(0);
        setScrollOffset(0);
        return;
      }
      if (key.return) {
        setInputActive(false);
        return;
      }
      if (key.upArrow) return setCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) return setCursor((c) => Math.min(list.length - 1, c + 1));
      if (key.backspace || key.delete) {
        dispatch({ type: 'search/query', payload: state.searchQuery.slice(0, -1) });
        setCursor(0);
        setScrollOffset(0);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        dispatch({ type: 'search/query', payload: state.searchQuery + input });
        setCursor(0);
        setScrollOffset(0);
      }
      return;
    }

    if (input === '/') {
      setInputActive(true);
      return;
    }
    if (key.escape) {
      if (state.searchQuery) {
        dispatch({ type: 'search/query', payload: '' });
        setCursor(0);
        setScrollOffset(0);
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
    if (input === 'i') {
      const selected = list[Math.min(cursor, list.length - 1)];
      if (selected) {
        setInstallPrompt({
          result: selected,
          agents: new Set([state.currentAgent]),
          scope: 'global',
        });
      }
      return;
    }
    if (input === 'q') {
      process.exit(0);
    }
  });

  const clampedCursor = Math.min(cursor, Math.max(0, list.length - 1));
  const visible = list.slice(scrollOffset, scrollOffset + PAGE_SIZE);

  return (
    <Box flexDirection="column">
      <TabBar active="search" />
      <Box paddingX={1} marginTop={1}>
        <SearchBar query={state.searchQuery} active={inputActive} placeholder="Search skills.sh…" />
      </Box>
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {state.searching && <Text dimColor>searching…</Text>}
        {state.searchError && <Text color="red">{state.searchError}</Text>}
        {!state.searching && !state.searchError && list.length === 0 && (
          <Text dimColor>
            {showingPopular ? 'loading popular skills…' : 'no results.'}
          </Text>
        )}
        {visible.map((r: SearchResult, i) => {
          const globalIdx = scrollOffset + i;
          const isCursor = globalIdx === clampedCursor;
          return (
            <Box key={r.id} flexDirection="column">
              <Box>
                <Text color={isCursor ? 'yellow' : undefined}>{isCursor ? '> ' : '○ '}</Text>
                <Text bold={isCursor} color={isCursor ? 'yellow' : undefined}>
                  {r.name}
                </Text>
                <Text dimColor> · {r.source}</Text>
                {r.installs > 0 && <Text dimColor> · {formatInstalls(r.installs)} installs</Text>}
              </Box>
            </Box>
          );
        })}
        {list.length > 0 && (
          <Box marginTop={1}>
            <Text dimColor>
              {clampedCursor + 1}/{list.length}
            </Text>
          </Box>
        )}
      </Box>
      {installPrompt && (
        <Box flexDirection="column" borderStyle="single" paddingX={1} marginX={1}>
          <Text bold>Install {installPrompt.result.id}</Text>
          <Text dimColor>Target agents: {[...installPrompt.agents].join(', ')}</Text>
          <Text dimColor>Scope: {installPrompt.scope}</Text>
          <Text dimColor>[enter] confirm   [esc] cancel</Text>
        </Box>
      )}
      <ToastList toasts={state.toasts} />
      <Footer
        keys={installPrompt ? FOOTER_KEYS_PROMPT : inputActive ? FOOTER_KEYS_SEARCHING : FOOTER_KEYS}
      />
    </Box>
  );
}
