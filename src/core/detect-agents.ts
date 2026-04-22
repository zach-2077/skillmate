import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { agents, knownAgentIds, type AgentId } from './agents.js';

export interface DetectOpts {
  home?: string;
}

export function detectAgents(opts?: DetectOpts): AgentId[] {
  const home = opts?.home ?? homedir();
  return knownAgentIds.filter((id) => existsSync(join(home, agents[id]!.dirName)));
}
