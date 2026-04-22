import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { InstalledSkill } from './core/installed.js';
import type { AgentId } from './core/agents.js';

export type Screen = 'installed';

export interface State {
  screen: Screen;
  currentAgent: AgentId;
  installed: InstalledSkill[];
  loadingInstalled: boolean;
  installedError: string | null;
}

export type Action =
  | { type: 'installed/loading' }
  | { type: 'installed/loaded'; payload: InstalledSkill[] }
  | { type: 'installed/error'; payload: string }
  | { type: 'agent/select'; payload: AgentId }
  | { type: 'screen/show'; payload: Screen };

export const initialState: State = {
  screen: 'installed',
  currentAgent: 'claude-code',
  installed: [],
  loadingInstalled: false,
  installedError: null,
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'installed/loading':
      return { ...state, loadingInstalled: true, installedError: null };
    case 'installed/loaded':
      return { ...state, installed: action.payload, loadingInstalled: false };
    case 'installed/error':
      return { ...state, installedError: action.payload, loadingInstalled: false };
    case 'agent/select':
      return { ...state, currentAgent: action.payload };
    case 'screen/show':
      return { ...state, screen: action.payload };
    default:
      return state;
  }
}

const StoreContext = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function StoreProvider({ children, override }: { children: ReactNode; override?: Partial<State> }) {
  const [state, dispatch] = useReducer(reducer, { ...initialState, ...override });
  return React.createElement(StoreContext.Provider, { value: { state, dispatch } }, children);
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be inside StoreProvider');
  return ctx;
}
