#!/usr/bin/env node
/**
 * trucontext-openclaw CLI
 *
 * Commands:
 *   install     — First-time setup: auth, app, root nodes, agent provisioning, cron
 *   uninstall   — Remove TC from all agents, remove skill, unregister cron
 *   provision   — (Re)provision a specific agent or all agents
 *   status      — Show current state: agents, TC version, last harvest
 *   sync        — Manually trigger the maintenance cron
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
      const agentId = args[0]; // optional — if omitted, provision all
      await provision({ agentId, reProvision: true });
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
  trucontext-openclaw install        First-time setup
  trucontext-openclaw uninstall      Remove TC from OpenClaw
  trucontext-openclaw provision      Re-provision all agents (or: provision <agent-id>)
  trucontext-openclaw status         Show current state
  trucontext-openclaw sync           Run maintenance now (version check + doc drift)

After install, this package runs as an OpenClaw plugin — no manual commands needed.
The daily cron handles version updates and doc drift automatically.
`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
