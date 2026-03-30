/**
 * Install flow (v2)
 *
 * 1. Display disclosure + get consent
 * 2. Ensure TC CLI is installed
 * 3. Auth (login if needed)
 * 4. Ensure TC app exists
 * 5. Identify user root node
 * 6. Discover + provision all agents
 * 7. Install tc-memory skill
 * 8. Write daily sync cron to cron/jobs.json
 * 9. Register webhook URL (if configured)
 * 10. Write state
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ensureTcInstalled, checkAuth, login, ensureApp, getTcVersion, validateToken } from './auth.js';
import { discoverAgents, getOpenClawWorkspaceRoot } from './discover.js';
import { provisionAgent } from './provision.js';
import { installSkill } from './skill.js';
import { updateState } from './state.js';
import { log, confirm, OPENCLAW_DIR } from './utils.js';

export async function install({ args = [] } = {}) {
  const dryRun = args.includes('--dry-run');

  log.info('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  log.info('\u2551         trucontext-openclaw \u2014 Install              \u2551');
  log.info('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n');

  // Disclosure
  log.info('TruContext will:\n');
  log.info('  \u2726 Create a knowledge graph for your OpenClaw instance');
  log.info('  \u2726 Read your agents\' SOUL.md, AGENTS.md, and memory files');
  log.info('  \u2726 Automatically ingest content before context compaction');
  log.info('  \u2726 Write TC-BRIEFING.md into each agent workspace\n');
  log.info('  Privacy policy: https://trucontext.ai/privacy');
  log.info('  Uninstall: trucontext-openclaw uninstall\n');

  if (!dryRun) {
    const proceed = await confirm('Continue? [y/N] ');
    if (!proceed) { log.info('\nInstall cancelled.'); process.exit(0); }
  }

  log.info('\n\u2500\u2500 Step 1: TruContext CLI \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  const tcVersion = ensureTcInstalled();

  log.info('\n\u2500\u2500 Step 2: Authentication \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  let authState = checkAuth();
  if (!authState.authed) {
    login();
    authState = checkAuth();
    if (!authState.authed) throw new Error('Authentication failed. Please try again.');
  }

  // Validate token is still accepted by the TC API (catches expired tokens)
  const tokenValid = await validateToken();
  if (!tokenValid) {
    log.info('  \u26a0 Session expired \u2014 re-authenticating...');
    login(authState.appId);  // pass appId to auto-select app after OAuth, skipping interactive selector
    authState = checkAuth();
    if (!authState.authed) throw new Error('Authentication failed after re-login. Run: npx trucontext login');
    // Token is fresh — just logged in, skip second validation
  }

  log.info(`  \u2713 Logged in as: ${authState.email}`);

  log.info('\n\u2500\u2500 Step 3: TruContext App \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  const appId = ensureApp('openclaw');

  log.info('\n\u2500\u2500 Step 4: User Root Node \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  const userRoot = await ensureUserRootNode();
  log.info(`  \u2713 User root node: ${userRoot}`);

  log.info('\n\u2500\u2500 Step 5: Discover OpenClaw Agents \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  const agents = discoverAgents();
  log.info(`  Found ${agents.length} agent(s):`);
  for (const a of agents) log.info(`    \u2022 ${a.name} (${a.id})`);

  // Save state early so provision can read app_id
  if (!dryRun) {
    updateState({
      app_id: appId,
      api_key: getApiKey(),
      user_root: userRoot,
      tc_version: tcVersion,
      installed_at: new Date().toISOString(),
    });
  }

  log.info('\n\u2500\u2500 Step 6: Provision Agents \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  for (const agent of agents) {
    if (!dryRun) {
      const proceed = await confirm(
        `\n  Provision ${agent.name} (${agent.id})? [Y/n] `,
        true
      );
      if (!proceed) { log.info('  \u2192 Skipped'); continue; }
    }

    try {
      await provisionAgent({
        agentId: agent.id,
        userRoot,
        appId,
        force: true,
        dryRun,
        verbose: true,
      });
    } catch (err) {
      if (err.name === 'AuthExpiredError') {
        log.info('  \u26a0 Auth expired during provisioning \u2014 re-authenticating...');
        login();
        try {
          await provisionAgent({ agentId: agent.id, userRoot, appId, force: true, dryRun, verbose: true });
        } catch (retryErr) {
          log.error(`  ${retryErr.message}`);
        }
      } else {
        log.error(`  ${err.message}`);
      }
    }
  }

  log.info('\n\u2500\u2500 Step 7: Install tc-memory Skill \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  if (!dryRun) {
    const { method } = await installSkill();
    if (method === 'clawhub') {
      log.info('  \u2713 Skill installed via ClawHub');
    } else {
      log.info('  \u2713 Skill installed from bundled template');
    }
  }

  log.info('\n\u2500\u2500 Step 8: Write Daily Sync Cron \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  if (!dryRun) {
    writeCronConfig();
    log.info('  \u2713 Daily sync cron written to ~/.openclaw/cron/jobs.json');
  }

  log.info('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  log.info('\u2551   \u2713 TruContext memory is active for all agents     \u2551');
  log.info('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n');
  log.info('TC-BRIEFING.md is now injected into every agent session.');
  log.info('The plugin handles compaction, briefing refresh, and daily sync.\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { TC_CREDENTIALS_PATH } from './utils.js';
import { tcRootsList, tcRootsCreate } from './auth.js';

async function ensureUserRootNode() {
  const rootsOutput = tcRootsList();

  const lines = rootsOutput.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('\u2014 Person \u2014') && i > 0) {
      const id = lines[i - 1].trim();
      log.debug(`ensureUserRootNode: found existing Person root: ${id}`);
      return id;
    }
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const name = await new Promise(resolve => {
    rl.question('  Enter your name for the TC root node (e.g. "Dustin"): ', resolve);
  });
  rl.close();

  const id = name.trim().toLowerCase().replace(/\s+/g, '-');
  log.info(`  \u2192 Creating user root node: ${id}`);

  tcRootsCreate({
    id,
    type: 'Person',
    name: name.trim(),
    recipe: 'recipe:personal-assistant-memory',
    dreamers: ['decay', 'concepts', 'people', 'curiosity', 'fitness'],
  });

  return id;
}

function getApiKey() {
  try {
    const creds = JSON.parse(fs.readFileSync(TC_CREDENTIALS_PATH, 'utf8'));
    return creds.apiKey ?? creds.api_key ?? null;
  } catch {
    return null;
  }
}

function writeCronConfig() {
  const cronDir = path.join(OPENCLAW_DIR, 'cron');
  fs.mkdirSync(cronDir, { recursive: true });

  const jobsPath = path.join(cronDir, 'jobs.json');
  let jobs = [];
  try {
    if (fs.existsSync(jobsPath)) {
      const existing = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
      jobs = Array.isArray(existing) ? existing : (existing?.jobs ?? []);
    }
  } catch { /* start fresh */ }

  // Remove any existing trucontext-sync job
  jobs = jobs.filter(j => j.name !== 'trucontext-sync');

  // Add the new job
  jobs.push({
    name: 'trucontext-sync',
    schedule: { kind: 'cron', expr: '0 3 * * *', tz: 'local' },
    sessionTarget: 'isolated',
    payload: {
      kind: 'agentTurn',
      message: 'Run TruContext sync: check SOUL.md hashes and re-provision any agents where SOUL.md has changed. Refresh briefings for all agents.',
      lightContext: true,
    },
  });

  fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2), 'utf8');
}
