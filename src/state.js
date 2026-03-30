/**
 * State file management
 * Location: ~/.openclaw/trucontext.json
 *
 * Atomic write: write to .tmp then rename to prevent corruption on crash.
 */

import fs from 'fs';
import path from 'path';
import { TC_STATE_PATH } from './utils.js';

const DEFAULT_STATE = {
  app_id: null,
  api_key: null,
  user_root: null,
  webhook_secret: null,
  installed_at: null,
  tc_version: null,
  agents: {},
};

export function statePath() {
  return TC_STATE_PATH;
}

export function readState() {
  try {
    if (!fs.existsSync(TC_STATE_PATH)) return { ...DEFAULT_STATE };
    return JSON.parse(fs.readFileSync(TC_STATE_PATH, 'utf8'));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeState(state) {
  const dir = path.dirname(TC_STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = TC_STATE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, TC_STATE_PATH);
}

export function updateState(updates) {
  const next = { ...readState(), ...updates };
  writeState(next);
  return next;
}

export function registerAgent(agentId, agentData) {
  const state = readState();
  if (!state.agents) state.agents = {};
  state.agents[agentId] = {
    ...state.agents[agentId],
    ...agentData,
  };
  writeState(state);
}

export function removeAgent(agentId) {
  const state = readState();
  delete state.agents[agentId];
  writeState(state);
}

export function getAgentState(agentId) {
  return readState().agents?.[agentId] ?? null;
}

/**
 * Look up an agent entry by its TC agent_root value.
 * Returns { ocAgentId, ...agentState } or null.
 */
export function resolveAgentByRoot(agentRoot) {
  const state = readState();
  for (const [id, entry] of Object.entries(state.agents ?? {})) {
    if (entry.agent_root === agentRoot) {
      return { ocAgentId: id, ...entry };
    }
  }
  return null;
}
