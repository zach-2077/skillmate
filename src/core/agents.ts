export type AgentId = string;

export interface Agent {
  id: AgentId;
  displayName: string;
  dirName: string;
  /**
   * True when this agent uses the universal `.agents/skills` directory
   * (both for project-level and home-level global skills under `~/.agents/skills`).
   * Upstream's `skills list --json` only attributes a skill to an agent when it finds
   * a matching path in the agent's own dir; for universal agents, that means skills
   * sitting purely in `~/.agents/skills/` come back with an empty agents array even
   * though those agents actually read them at runtime.
   */
  isUniversal: boolean;
}

export const agents: Record<string, Agent> = {
  'claude-code': { id: 'claude-code', displayName: 'Claude Code', dirName: '.claude', isUniversal: false },
  codex: { id: 'codex', displayName: 'Codex', dirName: '.codex', isUniversal: true },
  opencode: { id: 'opencode', displayName: 'OpenCode', dirName: '.config/opencode', isUniversal: true },
  'gemini-cli': { id: 'gemini-cli', displayName: 'Gemini CLI', dirName: '.gemini', isUniversal: true },
};

export const universalAgentIds: AgentId[] = Object.values(agents)
  .filter((a) => a.isUniversal)
  .map((a) => a.id);

export const knownAgentIds: AgentId[] = Object.keys(agents);

const displayNameIndex: Record<string, AgentId> = Object.fromEntries(
  Object.values(agents).map((a) => [a.displayName, a.id]),
);

export function displayNameToId(name: string): AgentId | undefined {
  return displayNameIndex[name];
}
