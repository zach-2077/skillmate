export type AgentId = string;

export interface Agent {
  id: AgentId;
  displayName: string;
  dirName: string;
}

export const agents: Record<string, Agent> = {
  claude: { id: 'claude', displayName: 'Claude Code', dirName: '.claude' },
  cursor: { id: 'cursor', displayName: 'Cursor', dirName: '.cursor' },
  codex: { id: 'codex', displayName: 'Codex', dirName: '.codex' },
  opencode: { id: 'opencode', displayName: 'OpenCode', dirName: '.opencode' },
};

export const knownAgentIds: AgentId[] = Object.keys(agents);

const displayNameIndex: Record<string, AgentId> = Object.fromEntries(
  Object.values(agents).map((a) => [a.displayName, a.id]),
);

export function displayNameToId(name: string): AgentId | undefined {
  return displayNameIndex[name];
}
