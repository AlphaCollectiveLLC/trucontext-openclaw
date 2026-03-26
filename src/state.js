/**
 * State file management
 * Location: ~/.trucontext/openclaw-state.json
 */

import fs from 'fs';
import path from 'path';
import { TC_STATE_PATH } from './utils.js';

const DEFAULT_STATE = {
  tc_version: null,
  workspace_root: null,
  user_root_node: null,
  tc_app_id: null,
  last_checked: null,
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
  fs.writeFileSync(TC_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

export function updateState(updates) {
  const next = { ...readState(), ...updates };
  writeState(next);
  return next;
}

export function registerAgent(agentId, agentData) {
  const state = readState();
  state.agents[agentId] = {
    ...state.agents[agentId],
    ...agentData,
    last_updated: new Date().toISOString(),
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
