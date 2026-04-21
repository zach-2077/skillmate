import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './store.js';
import { Installed } from './screens/Installed.js';
import { refreshInstalled } from './core/installed.js';

function Router(): React.ReactElement {
  const { state, dispatch } = useStore();

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'installed/loading' });
    refreshInstalled()
      .then((skills) => {
        if (!cancelled) dispatch({ type: 'installed/loaded', payload: skills });
      })
      .catch((err: Error) => {
        if (!cancelled) dispatch({ type: 'installed/error', payload: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  switch (state.screen) {
    case 'installed':
      return <Installed />;
  }
}

export function App(): React.ReactElement {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  );
}
