/**
 * Status command — show current state of the TC integration
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { readState } from './state.js';
import { checkAuth, getTcVersion, getLatestTcVersion } from './auth.js';
import { discoverAgents } from './discover.js';
import { log, TC_HARVEST_LOG_PATH } from './utils.js';

export async function status() {
  const state = readState();
  const { authed, email } = checkAuth();
  const currentVersion = getTcVersion();
  const latestVersion = getLatestTcVersion();
  const agents = discoverAgents();

  log.info('\n╔════════════════════════════════════════════════════╗');
  log.info('║         trucontext-openclaw — Status               ║');
  log.info('╚════════════════════════════════════════════════════╝\n');

  log.info('── Auth ────────────────────────────────────────────────');
  log.info(`  ${authed ? '✓' : '✗'} Authenticated: ${email ?? 'not logged in'}`);
  log.info(`  App ID: ${state.tc_app_id ?? 'not set'}`);

  log.info('\n── TC CLI ──────────────────────────────────────────────');
  log.info(`  Installed: ${currentVersion ?? 'not found'}`);
  log.info(`  Latest:    ${latestVersion ?? 'unknown'}`);
  if (currentVersion && latestVersion && currentVersion !== latestVersion) {
    log.info(`  ⚠ Update available — run: trucontext-openclaw sync`);
  }

  log.info('\n── User ────────────────────────────────────────────────');
  log.info(`  Root node: ${state.user_root_node ?? 'not set'}`);
  log.info(`  Workspace: ${state.workspace_root ?? 'not set'}`);
  log.info(`  Last sync: ${state.last_checked ?? 'never'}`);

  log.info('\n── Agents ──────────────────────────────────────────────');
  for (const agent of agents) {
    const agentState = state.agents?.[agent.id];
    const provisioned = !!agentState;
    const lastHarvested = agentState?.last_harvested
      ? new Date(agentState.last_harvested).toLocaleString()
      : 'never';

    log.info(`\n  ${provisioned ? '✓' : '✗'} ${agent.name} (${agent.id})`);
    if (provisioned) {
      log.info(`    Root node: ${agentState.root_node}`);
      log.info(`    Recipe:    ${agentState.recipe}`);
      log.info(`    Harvested: ${lastHarvested}`);
    } else {
      log.info(`    Not provisioned — run: trucontext-openclaw provision ${agent.id}`);
    }
  }

  log.info('\n── Harvest Log (last 5 entries) ────────────────────────');
  if (fs.existsSync(TC_HARVEST_LOG_PATH)) {
    const lines = fs.readFileSync(TC_HARVEST_LOG_PATH, 'utf8').trim().split('\n').slice(-5);
    for (const line of lines) log.info(`  ${line}`);
  } else {
    log.info('  No harvest log yet');
  }

  log.info('');
}
