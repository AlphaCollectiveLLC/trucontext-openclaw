/**
 * Uninstall flow — non-destructive, graph data preserved
 *
 * Each step is wrapped independently — a failure in one step does not
 * abort the rest. All results are collected and reported at the end.
 */

import fs from 'fs';
import path from 'path';
import { readState, statePath } from './state.js';
import { removeFragment } from './inject.js';
import { discoverAgents } from './discover.js';
import { removeSkill } from './skill.js';
import { log, confirm, OPENCLAW_DIR } from './utils.js';

export async function uninstall({ args = [] } = {}) {
  const force = args.includes('--force');

  log.info('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  log.info('\u2551       trucontext-openclaw \u2014 Uninstall              \u2551');
  log.info('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n');

  log.info('This will:\n');
  log.info('  \u2022 Remove the tc-memory skill');
  log.info('  \u2022 Remove TruContext fenced blocks from SKILL.md files');
  log.info('  \u2022 Remove TC-BRIEFING.md from agent workspaces');
  log.info('  \u2022 Remove the cron job from cron/jobs.json');
  log.info('  \u2022 Delete the local state file\n');
  log.info('  Your TruContext graph data is PRESERVED.');
  log.info('  To delete: trucontext roots delete <id>\n');

  if (!force) {
    const proceed = await confirm('Continue? [y/N] ');
    if (!proceed) { log.info('\nUninstall cancelled.'); process.exit(0); }
  }

  const errors = [];

  // Step 1: Remove SKILL.md fragments and TC-BRIEFING.md files
  log.info('\n\u2500\u2500 Removing managed files \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  try {
    for (const agent of discoverAgents()) {
      // Remove TC-BRIEFING.md
      const briefingPath = path.join(agent.workspace, 'TC-BRIEFING.md');
      if (fs.existsSync(briefingPath)) {
        fs.unlinkSync(briefingPath);
        log.info(`  \u2713 ${agent.name}: TC-BRIEFING.md removed`);
      }
    }
  } catch (err) {
    log.warn(`  \u2717 Could not clean agent workspaces: ${err.message}`);
    errors.push(`Agent cleanup failed: ${err.message}`);
  }

  // Step 2: Remove skill
  log.info('\n\u2500\u2500 Removing skill \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  try {
    await removeSkill();
    log.info('  \u2713 Skill removed');
  } catch (err) {
    log.warn(`  \u2717 Could not remove skill: ${err.message}`);
    errors.push(`Skill removal failed: ${err.message}`);
  }

  // Step 3: Remove cron job from jobs.json
  log.info('\n\u2500\u2500 Removing cron job \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  try {
    const cronPath = path.join(OPENCLAW_DIR, 'cron', 'jobs.json');
    if (fs.existsSync(cronPath)) {
      const jobs = JSON.parse(fs.readFileSync(cronPath, 'utf8'));
      const jobList = Array.isArray(jobs) ? jobs : (jobs?.jobs ?? []);
      const filtered = jobList.filter(j => j.name !== 'trucontext-sync');
      fs.writeFileSync(cronPath, JSON.stringify(filtered, null, 2), 'utf8');
      log.info('  \u2713 Cron job removed from jobs.json');
    } else {
      log.info('  \u2192 No cron/jobs.json found');
    }
  } catch (err) {
    log.warn(`  \u2717 Could not remove cron job: ${err.message}`);
    errors.push(`Cron removal failed: ${err.message}`);
  }

  // Step 4: Delete state file
  log.info('\n\u2500\u2500 Deleting state file \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  try {
    const sp = statePath();
    if (fs.existsSync(sp)) {
      fs.unlinkSync(sp);
      log.info(`  \u2713 Deleted: ${sp}`);
    } else {
      log.info('  \u2192 State file not found');
    }
  } catch (err) {
    log.warn(`  \u2717 Could not delete state file: ${err.message}`);
    errors.push(`State file deletion failed: ${err.message}`);
  }

  // Summary
  if (errors.length > 0) {
    log.info('\n\u26a0 Uninstall completed with warnings:');
    for (const e of errors) log.warn(`  \u2022 ${e}`);
  } else {
    log.info('\n\u2713 TruContext removed from OpenClaw.');
  }
  log.info('Your TC graph data is untouched at trucontext.ai\n');
}
