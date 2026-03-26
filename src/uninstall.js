/**
 * Uninstall flow — non-destructive, graph data preserved
 */

import fs from 'fs';
import path from 'path';
import { readState, statePath } from './state.js';
import { removeFragment } from './inject.js';
import { discoverAgents } from './discover.js';
import { unregisterCron } from './cron.js';
import { log, confirm } from './utils.js';

export async function uninstall({ args = [] } = {}) {
  const force = args.includes('--force');

  log.info('\n╔════════════════════════════════════════════════════╗');
  log.info('║       trucontext-openclaw — Uninstall              ║');
  log.info('╚════════════════════════════════════════════════════╝\n');

  log.info('This will:\n');
  log.info('  • Remove the tc-memory skill from your workspace');
  log.info('  • Remove TruContext references from each agent\'s AGENTS.md');
  log.info('  • Unregister the daily cron job');
  log.info('  • Delete the local state file\n');
  log.info('  Your TruContext graph data is PRESERVED.');
  log.info('  To delete: trucontext roots delete <id>\n');

  if (!force) {
    const proceed = await confirm('Continue? [y/N] ');
    if (!proceed) { log.info('\nUninstall cancelled.'); process.exit(0); }
  }

  const state = readState();

  log.info('\n── Removing AGENTS.md fragments ───────────────────────');
  for (const agent of discoverAgents()) {
    if (fs.existsSync(agent.agentsPath)) {
      removeFragment(agent.agentsPath);
      log.info(`  ✓ ${agent.name} (${agent.id})`);
    }
  }

  log.info('\n── Removing tc-memory skill ────────────────────────────');
  const skillDir = state.workspace_root
    ? path.join(state.workspace_root, 'skills', 'tc-memory')
    : null;
  if (skillDir && fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true });
    log.info(`  ✓ Removed: ${skillDir}`);
  } else {
    log.info('  → Skill not found, skipping');
  }

  log.info('\n── Unregistering cron ──────────────────────────────────');
  unregisterCron();
  log.info('  ✓ Cron removed');

  log.info('\n── Deleting state file ─────────────────────────────────');
  const sp = statePath();
  if (fs.existsSync(sp)) {
    fs.unlinkSync(sp);
    log.info(`  ✓ Deleted: ${sp}`);
  }

  log.info('\n╔════════════════════════════════════════════════════╗');
  log.info('║   ✓ TruContext removed from OpenClaw               ║');
  log.info('╚════════════════════════════════════════════════════╝\n');
  log.info('Your TC graph data is untouched at trucontext.ai\n');
}
