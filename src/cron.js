/**
 * Daily maintenance cron
 *
 * Job 1: Check TC CLI version — update if newer, refresh skill
 * Job 2: Scan agent workspace files for changes — re-provision if dirty
 * Job 3: Append harvest log
 *
 * Registered via `openclaw cron add` — NOT by writing openclaw.json directly.
 * This ensures the job is tracked in OpenClaw's cron registry and survives
 * config migrations (OpenClaw 2026.3.24+ expects cron as an object, not array).
 */

import fs from 'fs';
import { execSync } from 'child_process';
import { readState, updateState } from './state.js';
import { discoverAgents } from './discover.js';
import { harvestDelta } from './harvest.js';
import { provisionOne } from './provision.js';
import { installSkill } from './skill.js';
import { getTcVersion, getLatestTcVersion, updateTc } from './auth.js';
import path from 'path';
import { log, TC_HARVEST_LOG_PATH } from './utils.js';

export const CRON_ID = 'trucontext-openclaw-maintenance';
const CRON_NAME = 'TruContext — Daily Maintenance';
const CRON_SCHEDULE = '0 2 * * *';
const CRON_TZ = 'America/Chicago';
const CRON_DESCRIPTION = 'TruContext: check for CLI updates and harvest agent doc changes';

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
// Cron registration — uses openclaw CLI, not direct JSON manipulation
// ---------------------------------------------------------------------------

/**
 * Register the daily maintenance cron via `openclaw cron add`.
 * Idempotent: removes any existing job with the same ID first.
 *
 * Failure alerts are enabled so sync failures surface to the agent
 * rather than silently disappearing.
 */
export function registerCron({ alertChannel = 'slack', alertTo = null } = {}) {
  // Remove any stale registration first (idempotent)
  _removeCronIfExists();

  const args = [
    'openclaw', 'cron', 'add',
    '--name', CRON_NAME,
    '--cron', CRON_SCHEDULE,
    '--tz', CRON_TZ,
    '--session', 'isolated',
    '--agent', 'main',
    '--message', 'trucontext-openclaw sync',
    '--description', CRON_DESCRIPTION,
    '--failure-alert',
    '--failure-alert-channel', alertChannel,
    '--failure-alert-after', '2',
    '--failure-alert-cooldown', '6h',
    '--json',
  ];

  // If a delivery target was provided (e.g. "#halbot"), wire it up
  if (alertTo) {
    args.push('--failure-alert-to', alertTo);
  }

  try {
    const result = execSync(args.join(' '), { encoding: 'utf8' });
    const parsed = JSON.parse(result);
    // openclaw cron add --json returns the created job; capture the assigned id
    const assignedId = parsed?.id ?? CRON_ID;
    log.debug(`Cron registered: ${assignedId}`);
    return assignedId;
  } catch (err) {
    throw new Error(`Failed to register cron via openclaw CLI: ${err.message}`);
  }
}

/**
 * Unregister the maintenance cron via `openclaw cron rm`.
 */
export function unregisterCron() {
  _removeCronIfExists();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _removeCronIfExists() {
  try {
    execSync(`openclaw cron rm ${CRON_ID} --json`, { encoding: 'utf8', stdio: 'pipe' });
    log.debug(`Cron removed: ${CRON_ID}`);
  } catch {
    // Job didn't exist — that's fine
  }
}

function appendHarvestLog(entries) {
  const dir = path.dirname(TC_HARVEST_LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(TC_HARVEST_LOG_PATH, entries.join('\n') + '\n', 'utf8');
}
