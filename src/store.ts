import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { InstalledSkill } from './core/installed.js';
import type { AgentId } from './core/agents.js';
import type { Config } from './core/config.js';

export type Screen = 'installed' | 'search' | 'detail' | 'settings';

export interface SearchResult {
  id: string;        // "owner/repo/skillId"
  skillId: string;
  name: string;
  source: string;    // "owner/repo"
  installs: number;
}

export interface OpState {
  kind: 'install' | 'remove' | 'update';
  state: 'running' | 'error';
  message?: string;
}

export interface Toast {
  id: string;
  kind: 'info' | 'error' | 'success';
  text: string;
}

export interface State {
  screen: Screen;
  currentAgent: AgentId;
  installed: InstalledSkill[];
  loadingInstalled: boolean;
  installedError: string | null;
  searchQuery: string;
  searching: boolean;
  searchError: string | null;
  searchResults: SearchResult[];
  popular: SearchResult[];
  detail: SearchResult | null;
  ops: Record<string, OpState>;
  toasts: Toast[];
  config: Config | null;
  helpOpen: boolean;
}

export type Action =
  | { type: 'installed/loading' }
  | { type: 'installed/loaded'; payload: InstalledSkill[] }
  | { type: 'installed/error'; payload: string }
  | { type: 'agent/select'; payload: AgentId }
  | { type: 'screen/show'; payload: Screen }
  | { type: 'search/query'; payload: string }
  | { type: 'search/loading' }
  | { type: 'search/results'; payload: { query: string; results: SearchResult[] } }
  | { type: 'search/error'; payload: string }
  | { type: 'popular/loaded'; payload: SearchResult[] }
  | { type: 'detail/select'; payload: SearchResult }
  | { type: 'op/start'; payload: { id: string; kind: OpState['kind'] } }
  | { type: 'op/done'; payload: { id: string } }
  | { type: 'op/error'; payload: { id: string; message: string } }
  | { type: 'toast/push'; payload: Toast }
  | { type: 'toast/dismiss'; payload: string }
  | { type: 'config/load'; payload: Config }
  | { type: 'help/toggle' };

export const initialState: State = {
  screen: 'installed',
  currentAgent: 'claude-code',
  installed: [],
  loadingInstalled: false,
  installedError: null,
  searchQuery: '',
  searching: false,
  searchError: null,
  searchResults: [],
  popular: [],
  detail: null,
  ops: {},
  toasts: [],
  config: null,
  helpOpen: false,
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
    case 'search/query':
      return { ...state, searchQuery: action.payload };
    case 'search/loading':
      return { ...state, searching: true, searchError: null };
    case 'search/results':
      return state.searchQuery === action.payload.query
        ? { ...state, searching: false, searchResults: action.payload.results }
        : state;
    case 'search/error':
      return { ...state, searching: false, searchError: action.payload };
    case 'popular/loaded':
      return { ...state, popular: action.payload };
    case 'detail/select':
      return { ...state, detail: action.payload };
    case 'op/start':
      return {
        ...state,
        ops: { ...state.ops, [action.payload.id]: { kind: action.payload.kind, state: 'running' } },
      };
    case 'op/done': {
      const { [action.payload.id]: _, ...rest } = state.ops;
      return { ...state, ops: rest };
    }
    case 'op/error':
      return {
        ...state,
        ops: {
          ...state.ops,
          [action.payload.id]: {
            kind: state.ops[action.payload.id]?.kind ?? 'install',
            state: 'error',
            message: action.payload.message,
          },
        },
      };
    case 'toast/push':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'toast/dismiss':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };
    case 'config/load':
      return { ...state, config: action.payload, currentAgent: action.payload.currentAgent };
    case 'help/toggle':
      return { ...state, helpOpen: !state.helpOpen };
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
