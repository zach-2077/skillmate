import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { useStore } from '../store.js';
import { fetchSkillMd, DEFAULT_CACHE_DIR } from '../core/registry.js';
import { TabBar } from '../components/TabBar.js';
import { Footer } from '../components/Footer.js';
import { ToastList } from '../components/Toast.js';
import { agents } from '../core/agents.js';

marked.use(markedTerminal() as Parameters<typeof marked.use>[0]);

const FOOTER_KEYS: ReadonlyArray<[string, string]> = [
  ['↑↓', 'scroll'],
  ['esc', 'back'],
  ['q', 'quit'],
];

function formatInstalls(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function Detail(): React.ReactElement {
  const { state, dispatch } = useStore();
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    if (!state.detail) return;
    let cancelled = false;
    setLoading(true);
    fetchSkillMd(state.detail.id, { cacheDir: DEFAULT_CACHE_DIR })
      .then((text) => {
        if (!cancelled) {
          setBody(text);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBody(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [state.detail?.id]);

  useInput((input, key) => {
    if (key.escape) {
      dispatch({ type: 'screen/show', payload: 'search' });
      return;
    }
    if (key.upArrow) return setScrollOffset((o) => Math.max(0, o - 1));
    if (key.downArrow) return setScrollOffset((o) => o + 1);
    if (input === 'q') process.exit(0);
  });

  const detail = state.detail;
  if (!detail) {
    return (
      <Box flexDirection="column">
        <TabBar active="search" agent={agents[state.currentAgent]?.displayName ?? state.currentAgent} />
        <Box paddingX={1} marginTop={1}>
          <Text dimColor>no skill selected</Text>
        </Box>
        <Footer keys={FOOTER_KEYS} />
      </Box>
    );
  }

  const rendered = body ? (marked.parse(body) as string) : null;
  const lines = rendered ? rendered.split('\n') : [];
  const visibleLines = lines.slice(scrollOffset);

  return (
    <Box flexDirection="column">
      <TabBar active="search" agent={agents[state.currentAgent]?.displayName ?? state.currentAgent} />
      <Box paddingX={1} marginTop={1} justifyContent="space-between">
        <Box>
          <Text bold>{detail.name}</Text>
          <Text dimColor> · {detail.source}</Text>
        </Box>
        {detail.installs > 0 && <Text dimColor>{formatInstalls(detail.installs)} installs</Text>}
      </Box>
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {loading && <Text dimColor>loading preview…</Text>}
        {!loading && body === null && (
          <>
            <Text dimColor>preview unavailable</Text>
            <Text>npx skills add {detail.id}</Text>
          </>
        )}
        {!loading && rendered && <Text>{visibleLines.join('\n')}</Text>}
      </Box>
      <ToastList toasts={state.toasts} />
      <Footer keys={FOOTER_KEYS} />
    </Box>
  );
}
