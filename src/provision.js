/**
 * Agent provisioning (v2)
 *
 * Orchestrates: harvest -> TC provision API -> inject fragment -> write state -> refresh briefing
 *
 * Hash-based re-provision: SHA256 of SOUL.md determines whether to call provision.
 * The TC endpoint is idempotent — same agent_root returned, only re-runs LLM
 * analysis when content actually changed.
 */

import crypto from 'crypto';
import fs from 'fs';
import { discoverAgents } from './discover.js';
import { harvestAgent } from './harvest.js';
import { injectFragment } from './inject.js';
import { readState, registerAgent } from './state.js';
import { refreshBriefing } from './briefing.js';
import * as tcApi from './tc-api.js';
import { log } from './utils.js';

/**
 * Compute SHA256 hash of a file's contents.
 */
function hashFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Provision a single agent (new or re-provision).
 *
 * @param {object} params
 * @param {string} params.agentId - OpenClaw agent ID
 * @param {string} params.userRoot - User root node ID
 * @param {string} params.appId - TC app ID
 * @param {boolean} params.force - Force re-provision even if SOUL.md unchanged
 * @param {boolean} params.dryRun
 * @param {boolean} params.verbose
 */
export async function provisionAgent({ agentId, userRoot, appId, force = false, dryRun = false, verbose = false }) {
  const agents = discoverAgents();
  const agent = agents.find(a => a.id === agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const state = readState();
  const existingState = state.agents?.[agentId];
  userRoot = userRoot ?? state.user_root ?? 'user';
  appId = appId ?? state.app_id;

  if (!appId) throw new Error('No app_id in state. Run: trucontext-openclaw install');

  // Hash-based re-provision check
  const currentSoulHash = hashFile(agent.soulPath);
  if (!force && existingState?.soul_hash && existingState.soul_hash === currentSoulHash) {
    if (verbose) log.info(`  ✓ ${agent.name}: SOUL.md unchanged, skipping`);
    return { changed: false };
  }

  if (!fs.existsSync(agent.soulPath)) {
    throw new Error(`SOUL.md not found at ${agent.soulPath} — required for provisioning`);
  }

  if (verbose) log.info(`  → Provisioning: ${agent.name} (${agent.id})`);

  // Harvest content
  const content = harvestAgent(agent);

  // Call TC provision endpoint
  const response = await tcApi.provision(appId, {
    agent: {
      id: agent.id,
      name: agent.name,
      role: agent.role ?? `${agent.name} OpenClaw agent`,
    },
    user: { root_node: userRoot },
    content,
    options: {
      create_root_node: true,
      dry_run: dryRun,
    },
  });

  const result = response.data ?? response;

  if (verbose) {
    log.info(`  ✓ Root node: ${result.agent_root}`);
    log.info(`  ✓ Recipe: ${result.recipe_id}`);
  }

  if (!dryRun) {
    // Inject prompt fragment into SKILL.md (not AGENTS.md)
    if (result.prompt_fragment) {
      const skillPath = getSkillMdPath(agent);
      if (skillPath) {
        injectFragment(skillPath, result.prompt_fragment);
        if (verbose) log.info(`  ✓ SKILL.md prompt fragment updated`);
      }
    }

    // Update state
    registerAgent(agentId, {
      agent_root: result.agent_root,
      user_root: userRoot,
      recipe_id: result.recipe_id,
      soul_hash: currentSoulHash,
      provisioned_at: new Date().toISOString(),
    });

    // Refresh briefing immediately
    await refreshBriefing(agent.workspace, appId, result.agent_root);
    if (verbose) log.info(`  ✓ TC-BRIEFING.md refreshed`);
  }

  return { changed: true, response: result };
}

/**
 * Provision all discovered agents not yet in the state file.
 */
export async function provisionAll({ userRoot, appId, dryRun = false, verbose = false } = {}) {
  const agents = discoverAgents();
  const state = readState();
  const results = [];

  for (const agent of agents) {
    try {
      const result = await provisionAgent({
        agentId: agent.id,
        userRoot,
        appId,
        force: false,
        dryRun,
        verbose,
      });
      results.push({ agentId: agent.id, ...result });
    } catch (err) {
      if (err instanceof tcApi.AuthExpiredError) {
        log.error(`  ✗ ${err.message}`);
        log.error(`     Run: npx trucontext login`);
      } else {
        log.error(`  ✗ Failed to provision ${agent.id}: ${err.message}`);
      }
      results.push({ agentId: agent.id, error: err.message });
    }
  }

  return results;
}

/**
 * CLI entry point.
 */
export async function provision({ agentId, force = false } = {}) {
  const state = readState();
  if (agentId) {
    await provisionAgent({ agentId, userRoot: state.user_root, appId: state.app_id, force, verbose: true });
  } else {
    await provisionAll({ userRoot: state.user_root, appId: state.app_id, verbose: true });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import path from 'path';
import os from 'os';

function getSkillMdPath(agent) {
  // The skill SKILL.md lives in the shared skills directory
  const sharedSkillPath = path.join(os.homedir(), '.openclaw', 'skills', 'trucontext-openclaw', 'SKILL.md');
  if (fs.existsSync(sharedSkillPath)) return sharedSkillPath;
  // Fallback: agent workspace skills
  const wsSkillPath = path.join(agent.workspace, 'skills', 'trucontext-openclaw', 'SKILL.md');
  if (fs.existsSync(wsSkillPath)) return wsSkillPath;
  return null;
}
