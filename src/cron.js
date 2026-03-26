/**
 * Daily maintenance cron
 *
 * Job 1: Check TC CLI version — update if newer, refresh skill
 * Job 2: Scan agent workspace files for changes — re-provision if dirty
 * Job 3: Append harvest log
 *
 * Registered in OpenClaw's native cron (openclaw.json) — no system cron needed.
 */

import fs from 'fs';
import { readState, updateState } from './state.js';
import { discoverAgents } from './discover.js';
import { harvestDelta } from './harvest.js';
import { provisionOne } from './provision.js';
import { installSkill } from './skill.js';
import { getTcVersion, getLatestTcVersion, updateTc } from './auth.js';
import path from 'path';
import { log, OPENCLAW_CONFIG_PATH, TC_HARVEST_LOG_PATH } from './utils.js';

const CRON_ID = 'trucontext-openclaw-maintenance';

// ---------------------------------------------------------------------------
// Main sync — called by cron or `trucontext-openclaw sync`
// ---------------------------------------------------------------------------

export async function sync({ verbose = false } = {}) {
  const state = readState();
  const logEntries = [];
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');

  if (verbose) log.info('\n── TruContext Sync ──────────────────────────────────');

  // Job 1: Version check
  const current = getTcVersion();
  const latest = getLatestTcVersion();

  if (current && latest && latest !== current) {
    if (verbose) log.info(`  → TC update: ${current} → ${latest}`);
    try {
      updateTc();
      const newVersion = getTcVersion();
      if (state.workspace_root) await installSkill(state.workspace_root);
      updateState({ tc_version: newVersion, last_checked: new Date().toISOString() });
      logEntries.push(`${ts} — TC updated ${current} → ${newVersion}, skill regenerated`);
      if (verbose) log.info(`  ✓ TC updated to ${newVersion}`);
    } catch (err) {
      logEntries.push(`${ts} — TC update FAILED: ${err.message}`);
      log.error(`TC update failed: ${err.message}`);
    }
  } else {
    updateState({ last_checked: new Date().toISOString() });
    if (verbose) log.info(`  ✓ TC version current: ${current}`);
  }

  // Job 2: Doc drift check
  const agents = discoverAgents();
  let anyChanges = false;

  for (const agent of agents) {
    const agentState = state.agents?.[agent.id];
    if (!agentState) {
      log.debug(`sync: ${agent.id} not provisioned, skipping (gateway_start will handle)`);
      continue;
    }

    const delta = harvestDelta(agent, agentState.last_harvested, agentState.files);
    if (!delta.changed) continue;

    anyChanges = true;
    if (verbose) log.info(`  → ${agent.name}: ${delta.changedFiles.join(', ')} changed`);

    try {
      await provisionOne({
        agentId: agent.id,
        reProvision: true,
        userRootNode: state.user_root_node,
        verbose,
      });

      const wordCount = Object.values(delta.content)
        .flat()
        .filter(Boolean)
        .join(' ')
        .split(/\s+/).length;

      logEntries.push(`${ts} — ${agent.name}: ${delta.changedFiles.join(', ')} changed, re-ingested (~${wordCount} words)`);
    } catch (err) {
      logEntries.push(`${ts} — ${agent.name}: re-provision FAILED: ${err.message}`);
      log.error(`Re-provision failed for ${agent.id}: ${err.message}`);
    }
  }

  if (!anyChanges && verbose) log.info('  ✓ No doc changes detected');

  // Job 3: Write harvest log
  if (logEntries.length > 0) {
    appendHarvestLog(logEntries);
    if (verbose) log.info(`\n  Log: ${TC_HARVEST_LOG_PATH}`);
  }

  return { logEntries };
}

// ---------------------------------------------------------------------------
// Cron registration (written to openclaw.json)
// ---------------------------------------------------------------------------

export function registerCron() {
  const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8'));
  config.cron = (config.cron ?? []).filter(c => c.id !== CRON_ID);
  config.cron.push({
    id: CRON_ID,
    schedule: '0 2 * * *',
    command: 'trucontext-openclaw sync',
    description: 'TruContext: check for CLI updates and harvest agent doc changes',
  });
  fs.writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  log.debug(`Cron registered: ${CRON_ID}`);
}

export function unregisterCron() {
  if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) return;
  const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8'));
  if (!config.cron) return;
  config.cron = config.cron.filter(c => c.id !== CRON_ID);
  fs.writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  log.debug(`Cron unregistered: ${CRON_ID}`);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function appendHarvestLog(entries) {
  import path from 'path'; // already imported above
  const dir = path.dirname(TC_HARVEST_LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(TC_HARVEST_LOG_PATH, entries.join('\n') + '\n', 'utf8');
}
