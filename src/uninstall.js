/**
 * Uninstall flow — non-destructive, graph data preserved
 *
 * Each step is wrapped independently — a failure in one step does not
 * abort the rest. All results are collected and reported at the end.
 */

import fs from 'fs';
import { readState, statePath } from './state.js';
import { removeFragment } from './inject.js';
import { discoverAgents } from './discover.js';
import { unregisterCron } from './cron.js';
import { removeSkill } from './skill.js';
import { log, confirm } from './utils.js';

export async function uninstall({ args = [] } = {}) {
  const force = args.includes('--force');

  log.info('\n╔════════════════════════════════════════════════════╗');
  log.info('║       trucontext-openclaw — Uninstall              ║');
  log.info('╚════════════════════════════════════════════════════╝\n');

  log.info('This will:\n');
  log.info('  • Remove the tc-memory skill from your workspace');
  log.info('  • Remove TruContext fenced blocks from each agent\'s AGENTS.md');
  log.info('  • Unregister the daily cron job');
  log.info('  • Delete the local state file\n');
  log.info('  Your TruContext graph data is PRESERVED.');
  log.info('  To delete: trucontext roots delete <id>\n');

  if (!force) {
    const proceed = await confirm('Continue? [y/N] ');
    if (!proceed) { log.info('\nUninstall cancelled.'); process.exit(0); }
  }

  const state = readState();
  const errors = [];

  // ── Step 1: Remove AGENTS.md fragments ──────────────────────────────────
  log.info('\n── Removing AGENTS.md fragments ───────────────────────');
  try {
    for (const agent of discoverAgents()) {
      if (!fs.existsSync(agent.agentsPath)) continue;
      try {
        const { removed } = removeFragment(agent.agentsPath);
        if (removed) {
          log.info(`  ✓ ${agent.name} (${agent.id})`);
        } else {
          log.info(`  → ${agent.name} (${agent.id}): no managed block found, skipping`);
        }
      } catch (err) {
        log.warn(`  ✗ ${agent.name} (${agent.id}): ${err.message}`);
        errors.push(`AGENTS.md remove failed for ${agent.id}: ${err.message}`);
      }
    }
  } catch (err) {
    log.warn(`  ✗ Could not discover agents: ${err.message}`);
    errors.push(`Agent discovery failed: ${err.message}`);
  }

  // ── Step 2: Remove skill ─────────────────────────────────────────────────
  log.info('\n── Removing trucontext-openclaw skill ──────────────────');
  try {
    await removeSkill(state.workspace_root);
    log.info('  ✓ Skill removed from ~/.openclaw/skills');
  } catch (err) {
    log.warn(`  ✗ Could not remove skill: ${err.message}`);
    errors.push(`Skill removal failed: ${err.message}`);
  }

  // ── Step 3: Unregister cron ──────────────────────────────────────────────
  log.info('\n── Unregistering cron ──────────────────────────────────');
  try {
    unregisterCron();
    log.info('  ✓ Cron removed');
  } catch (err) {
    log.warn(`  ✗ Could not unregister cron: ${err.message}`);
    errors.push(`Cron unregister failed: ${err.message}`);
  }

  // ── Step 4: Delete state file ────────────────────────────────────────────
  log.info('\n── Deleting state file ─────────────────────────────────');
  try {
    const sp = statePath();
    if (fs.existsSync(sp)) {
      fs.unlinkSync(sp);
      log.info(`  ✓ Deleted: ${sp}`);
    } else {
      log.info('  → State file not found, skipping');
    }
  } catch (err) {
    log.warn(`  ✗ Could not delete state file: ${err.message}`);
    errors.push(`State file deletion failed: ${err.message}`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  if (errors.length > 0) {
    log.info('\n╔════════════════════════════════════════════════════╗');
    log.info('║   ⚠ Uninstall completed with warnings              ║');
    log.info('╚════════════════════════════════════════════════════╝\n');
    log.warn('The following steps had errors:');
    for (const e of errors) log.warn(`  • ${e}`);
    log.info('\nYour TC graph data is untouched at trucontext.ai\n');
  } else {
    log.info('\n╔════════════════════════════════════════════════════╗');
    log.info('║   ✓ TruContext removed from OpenClaw               ║');
    log.info('╚════════════════════════════════════════════════════╝\n');
    log.info('Your TC graph data is untouched at trucontext.ai\n');
  }
}
