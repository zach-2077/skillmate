import React, { useEffect, useState } from 'react';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { Box, Text, useInput } from 'ink';
import { useStore } from '../store.js';
import { knownAgentIds, agents } from '../core/agents.js';
import type { InstalledSkill, SkillScope } from '../core/installed.js';
import { refreshInstalled } from '../core/installed.js';
import { TabBar, type TabKey } from '../components/TabBar.js';
import { Footer } from '../components/Footer.js';
import { ToastList } from '../components/Toast.js';
import { SearchBar } from '../components/SearchBar.js';
import type { Screen } from '../store.js';
import {
  removeCanonicalSkill,
  disablePlugin,
  disableCodexPlugin,
  disableGeminiExtension,
} from '../core/remove.js';
import { updateSkill } from '../core/update.js';

const FOOTER_KEYS: ReadonlyArray<[string, string]> = [
  ['←→', 'tab'],
  ['↑↓', 'move'],
  ['/', 'filter'],
  ['tab', 'agent'],
  ['d', 'remove'],
  ['u', 'update'],
  ['q', 'quit'],
];

function codexPluginKeyFromSkillName(name: string): string | null {
  const colon = name.indexOf(':');
  if (colon === -1) return null;
  const short = name.slice(0, colon);
  try {
    const path = join(homedir(), '.codex', 'config.toml');
    const text = readFileSync(path, 'utf8');
    const re = new RegExp(`\\[plugins\\."(${short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}@[^"]+)"\\]`);
    const m = re.exec(text);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function pluginKeyFromSkillName(name: string, _installed: InstalledSkill[]): string | null {
  const colon = name.indexOf(':');
  if (colon === -1) return null;
  const short = name.slice(0, colon);
  try {
    const path = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
    const data = JSON.parse(readFileSync(path, 'utf8')) as { plugins?: Record<string, unknown> };
    for (const key of Object.keys(data.plugins ?? {})) {
      if (key.startsWith(`${short}@`)) return key;
    }
  } catch {
    // fall through
  }
  return null;
}

function screenToTab(screen: Screen): TabKey {
  if (screen === 'search' || screen === 'detail') return 'search';
  if (screen === 'settings') return 'settings';
  return 'installed';
}

const FOOTER_KEYS_FILTERING: ReadonlyArray<[string, string]> = [
  ['↑↓', 'move'],
  ['enter', 'apply'],
  ['esc', 'clear'],
];

const PAGE_SIZE = 10;

function scopeLabel(scope: SkillScope): string {
  switch (scope) {
    case 'project':
      return 'Project';
    case 'global':
      return 'Global';
    case 'plugin-user':
      return 'Plugin-user';
    case 'plugin-project':
      return 'Plugin-project';
    case 'plugin-codex':
      return 'Codex plugin';
    case 'extension-gemini':
      return 'Gemini ext';
  }
}

function matchesFilter(skill: InstalledSkill, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return skill.name.toLowerCase().includes(q) || skill.description.toLowerCase().includes(q);
}

function viewportHeight(): number {
  return Math.min(PAGE_SIZE, Math.max(3, (process.stdout.rows ?? 24) - 6));
}

export function Installed(): React.ReactElement {
  const { state, dispatch } = useStore();
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [filterQuery, setFilterQuery] = useState('');
  const [filtering, setFiltering] = useState(false);
  const [removePrompt, setRemovePrompt] = useState<{ skill: InstalledSkill } | null>(null);

  const filtered = state.installed
    .filter((s) => s.agents.includes(state.currentAgent))
    .filter((s) => matchesFilter(s, filterQuery));

  const rows = viewportHeight();

  useEffect(() => {
    if (cursor < scrollOffset) setScrollOffset(cursor);
    else if (cursor >= scrollOffset + rows) setScrollOffset(cursor - rows + 1);
  }, [cursor, scrollOffset, rows]);

  function resetPosition() {
    setCursor(0);
    setScrollOffset(0);
  }

  function performRemove(skill: InstalledSkill) {
    const opId = `remove:${skill.scope}:${skill.name}`;
    dispatch({ type: 'op/start', payload: { id: opId, kind: 'remove' } });
    void (async () => {
      try {
        if (skill.scope === 'project' || skill.scope === 'global') {
          await removeCanonicalSkill({
            name: skill.name,
            agent: state.currentAgent,
            scope: skill.scope,
          });
        } else if (skill.scope === 'plugin-user' || skill.scope === 'plugin-project') {
          const pluginKey = pluginKeyFromSkillName(skill.name, state.installed);
          if (!pluginKey) throw new Error(`could not resolve plugin key for ${skill.name}`);
          await disablePlugin(pluginKey, skill.scope);
        } else if (skill.scope === 'plugin-codex') {
          const key = codexPluginKeyFromSkillName(skill.name);
          if (!key) throw new Error(`could not resolve codex plugin key for ${skill.name}`);
          disableCodexPlugin(key);
        } else if (skill.scope === 'extension-gemini') {
          const colon = skill.name.indexOf(':');
          if (colon === -1) throw new Error(`could not resolve gemini extension for ${skill.name}`);
          disableGeminiExtension(skill.name.slice(0, colon));
        }
        dispatch({ type: 'op/done', payload: { id: opId } });
        dispatch({
          type: 'toast/push',
          payload: { id: `t-${Date.now()}`, kind: 'success', text: `removed ${skill.name}` },
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
  }

  function performUpdate(skill: InstalledSkill) {
    if (skill.scope === 'plugin-user' || skill.scope === 'plugin-project') {
      dispatch({
        type: 'toast/push',
        payload: {
          id: `t-${Date.now()}`,
          kind: 'info',
          text: `plugin skills update via Claude Code /plugin`,
        },
      });
      return;
    }
    const opId = `update:${skill.name}`;
    dispatch({ type: 'op/start', payload: { id: opId, kind: 'update' } });
    void (async () => {
      try {
        await updateSkill(skill.name);
        dispatch({ type: 'op/done', payload: { id: opId } });
        dispatch({
          type: 'toast/push',
          payload: { id: `t-${Date.now()}`, kind: 'success', text: `updated ${skill.name}` },
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
  }

  useInput((input, key) => {
    if (removePrompt) {
      if (key.escape) return setRemovePrompt(null);
      if (key.return || input === 'y') {
        const target = removePrompt.skill;
        setRemovePrompt(null);
        performRemove(target);
      }
      return;
    }

    if (filtering) {
      if (key.escape) {
        setFilterQuery('');
        setFiltering(false);
        resetPosition();
        return;
      }
      if (key.return) {
        setFiltering(false);
        return;
      }
      if (key.backspace || key.delete) {
        setFilterQuery((q) => q.slice(0, -1));
        resetPosition();
        return;
      }
      if (key.upArrow) return setCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) return setCursor((c) => Math.min(filtered.length - 1, c + 1));
      if (input && !key.ctrl && !key.meta) {
        setFilterQuery((q) => q + input);
        resetPosition();
      }
      return;
    }

    if (input === '/') return setFiltering(true);
    if (key.tab) {
      const cycle =
        state.config?.defaultAgents && state.config.defaultAgents.length > 0
          ? state.config.defaultAgents
          : knownAgentIds;
      const idx = cycle.indexOf(state.currentAgent);
      const next = cycle[(idx + 1) % cycle.length] ?? cycle[0]!;
      dispatch({ type: 'agent/select', payload: next });
      resetPosition();
      return;
    }
    if (key.upArrow) return setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) return setCursor((c) => Math.min(filtered.length - 1, c + 1));
    if (input === 'd' && filtered[clampedCursor]) {
      const skill = filtered[clampedCursor]!;
      if (state.config?.confirmRemove ?? true) {
        setRemovePrompt({ skill });
      } else {
        performRemove(skill);
      }
      return;
    }
    if (input === 'u' && filtered[clampedCursor]) {
      performUpdate(filtered[clampedCursor]!);
      return;
    }
    if (input === 'q') process.exit(0);
  });

  const clampedCursor = Math.min(cursor, Math.max(0, filtered.length - 1));
  const visible = filtered.slice(scrollOffset, scrollOffset + rows);

  return (
    <Box flexDirection="column">
      <TabBar active={screenToTab(state.screen)} agent={agents[state.currentAgent]?.displayName ?? state.currentAgent} />
      <Box paddingX={1} marginTop={1}>
        <SearchBar query={filterQuery} active={filtering} placeholder="Filter installed skills…" />
      </Box>
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {state.loadingInstalled && <Text dimColor>loading installed skills…</Text>}
        {state.installedError && <Text color="red">{state.installedError}</Text>}
        {!state.loadingInstalled && !state.installedError && filtered.length === 0 && (
          <Text dimColor>
            {filterQuery
              ? 'no matches. press [esc] to clear filter.'
              : 'no skills installed for this agent. press [tab] to switch.'}
          </Text>
        )}
        {visible.map((skill, i) => {
          const globalIdx = scrollOffset + i;
          const isCursor = globalIdx === clampedCursor;
          return (
            <Box key={`${skill.scope}:${skill.name}`}>
              <Text color={isCursor ? 'yellow' : undefined}>{isCursor ? '> ' : '○ '}</Text>
              <Text bold={isCursor} color={isCursor ? 'yellow' : undefined}>
                {skill.name}
              </Text>
              <Text dimColor> · {scopeLabel(skill.scope)}</Text>
            </Box>
          );
        })}
        {filtered.length > 0 && (
          <Box marginTop={1}>
            <Text dimColor>
              {clampedCursor + 1}/{filtered.length}
            </Text>
          </Box>
        )}
      </Box>
      {removePrompt && (
        <Box flexDirection="column" borderStyle="round" paddingX={1} marginX={1}>
          <Text bold>
            Remove {removePrompt.skill.name}
            {removePrompt.skill.scope.startsWith('plugin') ? ' (disables the whole plugin)' : ''}?
          </Text>
          <Text dimColor>scope: {removePrompt.skill.scope}</Text>
          <Text dimColor>[enter/y] confirm   [esc] cancel</Text>
        </Box>
      )}
      <ToastList toasts={state.toasts} />
      <Footer keys={filtering ? FOOTER_KEYS_FILTERING : FOOTER_KEYS} />
    </Box>
  );
}
