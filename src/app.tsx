import React, { useEffect } from 'react';
import { useInput } from 'ink';
import { StoreProvider, useStore, type Screen } from './store.js';
import { Detail } from './screens/Detail.js';
import { Installed } from './screens/Installed.js';
import { Search } from './screens/Search.js';
import { Settings } from './screens/Settings.js';
import { refreshInstalled } from './core/installed.js';
import { fetchPopular, DEFAULT_CACHE_DIR } from './core/registry.js';
import { loadConfig } from './core/config.js';

export const TAB_ORDER: readonly Screen[] = ['installed', 'search', 'settings'];

export function cycleTab(current: Screen, delta: 1 | -1): Screen {
  // 'detail' lives inside the 'search' tab — treat it as search for cycling.
  const normalized: Screen = current === 'detail' ? 'search' : current;
  const idx = TAB_ORDER.indexOf(normalized);
  if (idx === -1) return 'installed';
  const next = (idx + delta + TAB_ORDER.length) % TAB_ORDER.length;
  return TAB_ORDER[next]!;
}

function GlobalKeys(): null {
  const { state, dispatch } = useStore();
  useInput((_input, key) => {
    if (key.leftArrow) {
      dispatch({ type: 'screen/show', payload: cycleTab(state.screen, -1) });
    } else if (key.rightArrow) {
      dispatch({ type: 'screen/show', payload: cycleTab(state.screen, 1) });
    }
  });
  return null;
}

function Router(): React.ReactElement {
  const { state, dispatch } = useStore();

  useEffect(() => {
    let cancelled = false;
    const cfg = loadConfig();
    if (cfg) {
      dispatch({ type: 'config/load', payload: cfg });
    } else {
      dispatch({ type: 'screen/show', payload: 'settings' });
    }
    dispatch({ type: 'installed/loading' });
    refreshInstalled()
      .then((skills) => {
        if (!cancelled) dispatch({ type: 'installed/loaded', payload: skills });
      })
      .catch((err: Error) => {
        if (!cancelled) dispatch({ type: 'installed/error', payload: err.message });
      });
    fetchPopular({ cacheDir: DEFAULT_CACHE_DIR })
      .then((p) => { if (!cancelled) dispatch({ type: 'popular/loaded', payload: p }); })
      .catch(() => { /* fallback baked in */ });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    if (state.toasts.length === 0) return;
    const timers = state.toasts.map((t) =>
      setTimeout(() => dispatch({ type: 'toast/dismiss', payload: t.id }), 3000),
    );
    return () => timers.forEach(clearTimeout);
  }, [state.toasts, dispatch]);

  switch (state.screen) {
    case 'search':
      return <Search />;
    case 'detail':
      return <Detail />;
    case 'settings':
      return <Settings />;
    case 'installed':
    default:
      return <Installed />;
  }
}

export function App(): React.ReactElement {
  return (
    <StoreProvider>
      <GlobalKeys />
      <Router />
    </StoreProvider>
  );
}
