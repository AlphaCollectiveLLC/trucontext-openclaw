/**
 * Status command — show current state of the TC integration
 */

import fs from 'fs';
import { readState } from './state.js';
import { checkAuth, getTcVersion } from './auth.js';
import { discoverAgents } from './discover.js';
import { log, TC_HARVEST_LOG_PATH, OPENCLAW_DIR } from './utils.js';
import path from 'path';

export async function status() {
  const state = readState();
  const { authed, email } = checkAuth();
  const currentVersion = getTcVersion();
  const agents = discoverAgents();

  log.info('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  log.info('\u2551         trucontext-openclaw \u2014 Status               \u2551');
  log.info('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n');

  log.info('\u2500\u2500 Auth \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  log.info(`  ${authed ? '\u2713' : '\u2717'} Authenticated: ${email ?? 'not logged in'}`);
  log.info(`  App ID: ${state.app_id ?? 'not set'}`);

  log.info('\n\u2500\u2500 TC CLI \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  log.info(`  Version: ${currentVersion ?? 'not found'}`);

  log.info('\n\u2500\u2500 User \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  log.info(`  Root node: ${state.user_root ?? 'not set'}`);
  log.info(`  Installed: ${state.installed_at ?? 'never'}`);

  log.info('\n\u2500\u2500 Agents \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  for (const agent of agents) {
    const agentState = state.agents?.[agent.id];
    const provisioned = !!agentState;

    log.info(`\n  ${provisioned ? '\u2713' : '\u2717'} ${agent.name} (${agent.id})`);
    if (provisioned) {
      log.info(`    Agent root:  ${agentState.agent_root}`);
      log.info(`    Recipe:      ${agentState.recipe_id}`);
      log.info(`    SOUL hash:   ${agentState.soul_hash?.slice(0, 20) ?? 'n/a'}...`);
      log.info(`    Provisioned: ${agentState.provisioned_at ?? 'unknown'}`);

      // Check TC-BRIEFING.md exists
      const briefingPath = path.join(agent.workspace, 'TC-BRIEFING.md');
      const hasBriefing = fs.existsSync(briefingPath);
      log.info(`    TC-BRIEFING:  ${hasBriefing ? '\u2713 exists' : '\u2717 missing'}`);
    } else {
      log.info(`    Not provisioned \u2014 run: trucontext-openclaw provision ${agent.id}`);
    }
  }

  log.info('\n\u2500\u2500 Cron \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  const cronPath = path.join(OPENCLAW_DIR, 'cron', 'jobs.json');
  if (fs.existsSync(cronPath)) {
    try {
      const jobs = JSON.parse(fs.readFileSync(cronPath, 'utf8'));
      const jobList = Array.isArray(jobs) ? jobs : (jobs?.jobs ?? []);
      const tcJob = jobList.find(j => j.name === 'trucontext-sync');
      if (tcJob) {
        log.info(`  \u2713 trucontext-sync: ${tcJob.schedule?.expr ?? 'unknown schedule'}`);
      } else {
        log.info('  \u2717 trucontext-sync not found in cron/jobs.json');
      }
    } catch {
      log.info('  \u2717 Could not parse cron/jobs.json');
    }
  } else {
    log.info('  \u2717 No cron/jobs.json found');
  }

  log.info('\n\u2500\u2500 Harvest Log (last 5) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  if (fs.existsSync(TC_HARVEST_LOG_PATH)) {
    const lines = fs.readFileSync(TC_HARVEST_LOG_PATH, 'utf8').trim().split('\n').slice(-5);
    for (const line of lines) log.info(`  ${line}`);
  } else {
    log.info('  No harvest log yet');
  }

  log.info('');
}
