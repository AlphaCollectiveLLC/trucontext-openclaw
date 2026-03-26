/**
 * Install flow
 *
 * 1. Display disclosure + get consent
 * 2. Ensure TC CLI is installed
 * 3. Auth (login if needed)
 * 4. Ensure TC app exists
 * 5. Ensure user root node exists
 * 6. Discover + provision all agents
 * 7. Install tc-memory skill
 * 8. Register cron
 * 9. Write state
 */

import readline from 'readline';
import { execSync } from 'child_process';
import { ensureTcInstalled, checkAuth, login, ensureApp, getTcVersion } from './auth.js';
import { discoverAgents, getOpenClawWorkspaceRoot } from './discover.js';
import { provisionOne } from './provision.js';
import { installSkill } from './skill.js';
import { registerCron } from './cron.js';
import { updateState } from './state.js';
import { tcRootsList, tcRootsCreate } from './tc-api.js';
import { log, confirm } from './utils.js';

export async function install({ args = [] } = {}) {
  const dryRun = args.includes('--dry-run');

  log.info('\n╔════════════════════════════════════════════════════╗');
  log.info('║         trucontext-openclaw — Install              ║');
  log.info('╚════════════════════════════════════════════════════╝\n');

  // Disclosure
  log.info('TruContext will:\n');
  log.info('  ✦ Create a knowledge graph for your OpenClaw instance');
  log.info('  ✦ Read your agents\' SOUL.md, AGENTS.md, and memory files');
  log.info('  ✦ Ingest content from agent sessions you mark as significant');
  log.info('  ✦ Store this in TruContext\'s servers under your account\n');
  log.info('  Privacy policy: https://trucontext.ai/privacy');
  log.info('  Uninstall: trucontext-openclaw uninstall\n');

  if (!dryRun) {
    const proceed = await confirm('Continue? [y/N] ');
    if (!proceed) { log.info('\nInstall cancelled.'); process.exit(0); }
  }

  log.info('\n── Step 1: TruContext CLI ──────────────────────────────');
  const tcVersion = ensureTcInstalled();

  log.info('\n── Step 2: Authentication ──────────────────────────────');
  let authState = checkAuth();
  if (!authState.authed) {
    login();
    authState = checkAuth();
    if (!authState.authed) throw new Error('Authentication failed. Please try again.');
  }
  log.info(`  ✓ Logged in as: ${authState.email}`);

  log.info('\n── Step 3: TruContext App ──────────────────────────────');
  const appId = ensureApp('openclaw');

  log.info('\n── Step 4: User Root Node ──────────────────────────────');
  const userRootNode = await ensureUserRootNode();
  log.info(`  ✓ User root node: ${userRootNode}`);

  log.info('\n── Step 5: Discover OpenClaw Agents ───────────────────');
  const workspaceRoot = getOpenClawWorkspaceRoot();
  const agents = discoverAgents();
  log.info(`  Found ${agents.length} agent(s):`);
  for (const a of agents) log.info(`    • ${a.name} (${a.id})`);

  log.info('\n── Step 6: Provision Agents ───────────────────────────');
  for (const agent of agents) {
    log.info(`\n  Agent: ${agent.name} (${agent.id})`);

    if (!dryRun) {
      const proceed = await confirm(
        `  Will read: SOUL.md, AGENTS.md, IDENTITY.md, memory (last 7 days)\n` +
        `  Will create TC root node: ${agent.id}\n` +
        `  Will update AGENTS.md\n` +
        `  Proceed? [Y/n] `,
        true
      );
      if (!proceed) { log.info('  → Skipped'); continue; }
    }

    try {
      await provisionOne({ agentId: agent.id, userRootNode, dryRun, verbose: true });
      // Sync IDENTITY.md into OpenClaw's agent registry
      if (!dryRun && agent.workspaceDir) {
        try {
          execSync(
            `openclaw agents set-identity --agent ${agent.id} --from-identity --workspace ${agent.workspaceDir}`,
            { encoding: 'utf8', stdio: 'pipe' }
          );
          log.debug(`  ✓ Identity synced for ${agent.id}`);
        } catch {
          // Non-fatal: agent may not have an IDENTITY.md yet
          log.debug(`  → No IDENTITY.md for ${agent.id}, skipping identity sync`);
        }
      }
    } catch (err) {
      log.error(`  ${err.message}`);
    }
  }

  log.info('\n── Step 7: Install tc-memory Skill ────────────────────');
  if (!dryRun) {
    const { method } = await installSkill(workspaceRoot);
    if (method === 'clawhub') {
      log.info('  ✓ Skill installed via ClawHub (managed)');
    } else {
      log.info(`  ✓ Skill installed from bundled template: ${workspaceRoot}/skills/tc-memory/`);
      log.info('  ⚠ Not tracked by openclaw skills — publish to ClawHub to enable managed installs');
    }
  }

  log.info('\n── Step 8: Register Daily Cron ────────────────────────');
  if (!dryRun) {
    registerCron({ alertChannel: 'slack' });
    log.info('  ✓ Cron registered via openclaw CLI (daily at 2am, failure alerts enabled)');
  }

  log.info('\n── Step 9: Save State ─────────────────────────────────');
  if (!dryRun) {
    updateState({
      tc_version: tcVersion,
      workspace_root: workspaceRoot,
      user_root_node: userRootNode,
      tc_app_id: appId,
      last_checked: new Date().toISOString(),
    });
    log.info('  ✓ State saved');
  }

  log.info('\n╔════════════════════════════════════════════════════╗');
  log.info('║   ✓ TruContext memory is active for all agents     ║');
  log.info('╚════════════════════════════════════════════════════╝\n');
  log.info('Agents now have access to the tc-memory skill.');
  log.info('The daily cron will keep everything current.\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureUserRootNode() {
  const rootsOutput = tcRootsList();

  // Parse roots list: look for a Person root node
  const lines = rootsOutput.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('— Person —') && i > 0) {
      const id = lines[i - 1].trim();
      log.debug(`ensureUserRootNode: found existing Person root: ${id}`);
      return id;
    }
  }

  // Prompt for name and create root node
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const name = await new Promise(resolve => {
    rl.question('  Enter your name for the TC root node (e.g. "Dustin"): ', resolve);
  });
  rl.close();

  const id = name.trim().toLowerCase().replace(/\s+/g, '-');
  log.info(`  → Creating user root node: ${id}`);

  tcRootsCreate({
    id,
    type: 'Person',
    name: name.trim(),
    recipe: 'recipe:personal-assistant-memory',
    dreamers: ['decay', 'concepts', 'people', 'curiosity', 'fitness'],
  });

  return id;
}
