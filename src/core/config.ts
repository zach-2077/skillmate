import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { xdgConfig } from 'xdg-basedir';
import type { AgentId } from './agents.js';

export interface Config {
  defaultAgents: AgentId[];
  defaultScope: 'global' | 'project';
  confirmRemove: boolean;
  autoUpdate: boolean;
  currentAgent: AgentId;
}

export const defaultConfig: Config = {
  defaultAgents: [],
  defaultScope: 'global',
  confirmRemove: true,
  autoUpdate: false,
  currentAgent: 'claude-code',
};

export const DEFAULT_CONFIG_DIR = join(
  xdgConfig ?? join(process.env.HOME ?? '.', '.config'),
  'skillmate',
);

export interface IoOpts {
  dir?: string;
}

function configPath(opts?: IoOpts): string {
  return join(opts?.dir ?? DEFAULT_CONFIG_DIR, 'config.json');
}

export function loadConfig(opts?: IoOpts): Config | null {
  const path = configPath(opts);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as Partial<Config>;
    return { ...defaultConfig, ...parsed };
  } catch {
    return null;
  }
}

export function saveConfig(cfg: Config, opts?: IoOpts): void {
  const dir = opts?.dir ?? DEFAULT_CONFIG_DIR;
  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath(opts), JSON.stringify(cfg, null, 2));
}
