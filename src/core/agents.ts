export type AgentId = string;

export interface Agent {
  id: AgentId;
  displayName: string;
  dirName: string;
}

export const agents: Record<string, Agent> = {
  'claude-code': { id: 'claude-code', displayName: 'Claude Code', dirName: '.claude' },
  cursor: { id: 'cursor', displayName: 'Cursor', dirName: '.cursor' },
  codex: { id: 'codex', displayName: 'Codex', dirName: '.codex' },
  opencode: { id: 'opencode', displayName: 'OpenCode', dirName: '.config/opencode' },
  'gemini-cli': { id: 'gemini-cli', displayName: 'Gemini CLI', dirName: '.gemini' },
  'github-copilot': { id: 'github-copilot', displayName: 'GitHub Copilot', dirName: '.copilot' },
  cline: { id: 'cline', displayName: 'Cline', dirName: '.cline' },
  windsurf: { id: 'windsurf', displayName: 'Windsurf', dirName: '.codeium/windsurf' },
  continue: { id: 'continue', displayName: 'Continue', dirName: '.continue' },
  warp: { id: 'warp', displayName: 'Warp', dirName: '.warp' },
  roo: { id: 'roo', displayName: 'Roo Code', dirName: '.roo' },
};

export const knownAgentIds: AgentId[] = Object.keys(agents);

const displayNameIndex: Record<string, AgentId> = Object.fromEntries(
  Object.values(agents).map((a) => [a.displayName, a.id]),
);

export function displayNameToId(name: string): AgentId | undefined {
  return displayNameIndex[name];
}
