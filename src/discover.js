/**
 * OpenClaw agent discovery
 *
 * Source of truth: ~/.openclaw/openclaw.json → agents.list
 * Each agent entry has: id, name, workspace, agentDir, identity, model
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { OPENCLAW_CONFIG_PATH, log } from './utils.js';

export function loadOpenClawConfig() {
  if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) {
    throw new Error(`OpenClaw config not found at ${OPENCLAW_CONFIG_PATH}. Is OpenClaw installed?`);
  }
  return JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8'));
}

/**
 * Discover all registered OpenClaw agents.
 * Returns normalized descriptors with resolved file paths.
 */
export function discoverAgents() {
  const config = loadOpenClawConfig();
  const defaultWorkspace = config.agents?.defaults?.workspace
    ?? path.join(os.homedir(), '.openclaw', 'workspace');

  return (config.agents?.list ?? []).map(agent => {
    const workspace = agent.workspace ?? defaultWorkspace;
    return {
      id: agent.id,
      name: agent.identity?.name ?? agent.name ?? agent.id,
      role: agent.identity?.theme ?? null,
      workspace,
      agentDir: agent.agentDir ?? null,
      identity: agent.identity ?? {},
      model: agent.model ?? config.agents?.defaults?.model?.primary ?? null,
      // Resolved file paths
      soulPath:     path.join(workspace, 'SOUL.md'),
      agentsPath:   path.join(workspace, 'AGENTS.md'),
      identityPath: path.join(workspace, 'IDENTITY.md'),
      memoryDir:    path.join(workspace, 'memory'),
    };
  });
}

/**
 * Return agents not yet present in the given set of registered IDs.
 */
export function discoverUnprovisioned(registeredAgentIds) {
  return discoverAgents().filter(a => !registeredAgentIds.includes(a.id));
}

/**
 * Return the default workspace root from OpenClaw config.
 */
export function getOpenClawWorkspaceRoot() {
  const config = loadOpenClawConfig();
  return config.agents?.defaults?.workspace
    ?? path.join(os.homedir(), '.openclaw', 'workspace');
}
