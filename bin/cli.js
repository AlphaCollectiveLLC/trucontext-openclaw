#!/usr/bin/env node
/**
 * trucontext-openclaw CLI
 *
 * Commands:
 *   install     — First-time setup: auth, app, root nodes, agent provisioning, cron
 *   uninstall   — Remove TC from all agents, remove skill, clean up
 *   provision   — (Re)provision a specific agent or all agents
 *   status      — Show current state: agents, briefings, cron
 *   sync        — Manually trigger the daily sync (hash-check + briefing refresh)
 */

import { install } from '../src/install.js';
import { uninstall } from '../src/uninstall.js';
import { provision } from '../src/provision.js';
import { status } from '../src/status.js';
import { sync } from '../src/cron.js';

const [,, command, ...args] = process.argv;

async function main() {
  switch (command) {
    case 'install':
      await install({ args });
      break;
    case 'uninstall':
      await uninstall({ args });
      break;
    case 'provision': {
      const agentId = args[0];
      const force = args.includes('--force');
      await provision({ agentId, force });
      break;
    }
    case 'status':
      await status();
      break;
    case 'sync':
      await sync({ verbose: true });
      break;
    default:
      console.log(`
trucontext-openclaw — TruContext memory for OpenClaw

Usage:
  trucontext-openclaw install          First-time setup
  trucontext-openclaw uninstall        Remove TC from OpenClaw
  trucontext-openclaw provision        Re-provision all agents (or: provision <agent-id>)
  trucontext-openclaw provision --force Force re-provision even if SOUL.md unchanged
  trucontext-openclaw status           Show current state
  trucontext-openclaw sync             Run daily sync now (hash-check + briefing refresh)

After install, this package runs as an OpenClaw plugin — no manual commands needed.
TC-BRIEFING.md is refreshed automatically on every trigger.
`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
