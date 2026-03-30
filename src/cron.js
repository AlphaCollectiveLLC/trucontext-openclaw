/**
 * Daily sync (v2)
 *
 * Cron is now declarative — written to ~/.openclaw/cron/jobs.json during install.
 * This module provides the CLI `sync` command for manual runs.
 */

import fs from 'fs';
import path from 'path';
import { readState, updateState } from './state.js';
import { discoverAgents } from './discover.js';
import { provisionAgent } from './provision.js';
import { refreshBriefing } from './briefing.js';
import { log, TC_HARVEST_LOG_PATH } from './utils.js';

/**
 * Run the sync manually (same as what the daily cron does).
 * Hash-check SOUL.md for each agent, re-provision if changed, refresh briefings.
 */
export async function sync({ verbose = false } = {}) {
  const state = readState();
  if (!state.app_id) {
    log.error('Not installed. Run: trucontext-openclaw install');
    return { logEntries: [] };
  }

  const logEntries = [];
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');

  if (verbose) log.info('\n-- TruContext Sync --');

  const agents = discoverAgents();

  for (const [agentId, agentState] of Object.entries(state.agents ?? {})) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) continue;

    try {
      const result = await provisionAgent({
        agentId,
        userRoot: state.user_root,
        appId: state.app_id,
        force: false,
        verbose,
      });

      if (result.changed) {
        logEntries.push(`${ts} -- ${agentId}: re-provisioned (SOUL.md changed)`);
      }

      await refreshBriefing(agent.workspace, state.app_id, agentState.agent_root);
      if (verbose) log.info(`  ✓ ${agentId}: briefing refreshed`);
    } catch (err) {
      logEntries.push(`${ts} -- ${agentId}: sync FAILED: ${err.message}`);
      log.error(`Sync failed for ${agentId}: ${err.message}`);
    }
  }

  if (logEntries.length > 0) {
    const dir = path.dirname(TC_HARVEST_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(TC_HARVEST_LOG_PATH, logEntries.join('\n') + '\n', 'utf8');
  }

  if (verbose && logEntries.length === 0) log.info('  ✓ All agents current');

  return { logEntries };
}
