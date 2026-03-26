/**
 * Agent provisioning
 *
 * Orchestrates: harvest → TC provision API → inject fragment → update state
 */

import { discoverAgents } from './discover.js';
import { harvestAgent, harvestDelta, getFileMtimeMap } from './harvest.js';
import { provisionAgent } from './tc-api.js';
import { injectFragment } from './inject.js';
import { readState, registerAgent } from './state.js';

/**
 * Provision a single agent (new or re-provision).
 *
 * @param {object} params
 * @param {string} params.agentId - agent ID to provision
 * @param {boolean} params.reProvision - if true, update existing root node
 * @param {string} params.userRootNode - user's TC root node ID
 * @param {boolean} params.dryRun - don't write anything
 * @param {boolean} params.verbose
 */
export async function provisionOne({ agentId, reProvision = false, userRootNode, dryRun = false, verbose = false }) {
  const agents = discoverAgents();
  const agent = agents.find(a => a.id === agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const state = readState();
  const existingState = state.agents?.[agentId];
  userRootNode = userRootNode ?? state.user_root_node ?? 'dustin';

  if (verbose) console.log(`\n  Provisioning agent: ${agent.name} (${agent.id})`);

  // Harvest content
  let content, changedFiles;
  if (reProvision && existingState) {
    const delta = harvestDelta(agent, existingState.last_harvested, existingState.files);
    if (!delta.changed) {
      if (verbose) console.log(`  ✓ No file changes since last harvest`);
      return { changed: false };
    }
    content = delta.content;
    changedFiles = delta.changedFiles;
    if (verbose) console.log(`  → Changed files: ${changedFiles.join(', ')}`);
  } else {
    content = harvestAgent(agent);
    changedFiles = ['SOUL.md', 'AGENTS.md', 'IDENTITY.md', 'memory'];
    if (verbose) console.log(`  → Full harvest`);
  }

  // Call TC provision endpoint
  const response = await provisionAgent({
    agent: {
      id: agent.id,
      name: agent.name,
      role: agent.role,
    },
    user: { root_node: userRootNode },
    content,
    hints: {
      existing_root_node: reProvision ? agentId : null,
    },
    options: {
      create_root_node: !reProvision,
      dry_run: dryRun,
    },
  });

  // Unwrap { data: { ... } } response shape
  const result = response.data ?? response;

  if (verbose) {
    console.log(`  ✓ Root node: ${result.agent_root}`);
    console.log(`  ✓ Recipe: ${result.recipe_id}`);
    if (result.recipe_inference === 'pending') {
      console.log(`  ✓ Recipe inference: pending (async)`);
    }
  }

  if (!dryRun) {
    // Inject prompt fragment into AGENTS.md
    const { changed: fragmentChanged, hash } = injectFragment(
      agent.agentsPath,
      result.prompt_fragment
    );
    if (verbose && fragmentChanged) console.log(`  ✓ AGENTS.md updated`);

    // Update state — map from actual response fields
    const { getTcVersion } = await import('./auth.js');
    registerAgent(agentId, {
      name: agent.name,
      workspace: agent.workspace,
      root_node: result.agent_root,
      user_root: userRootNode,
      recipe: result.recipe_id,
      primary_about: agentId,
      tc_version: getTcVersion() ?? '0.0.0',
      last_harvested: new Date().toISOString(),
      prompt_fragment_hash: hash,
      files: getFileMtimeMap(agent),
    });
  }

  return { changed: true, response: result };
}

/**
 * Provision all discovered agents not yet in the state file.
 */
export async function provisionAll({ userRootNode, dryRun = false, verbose = false } = {}) {
  const agents = discoverAgents();
  const state = readState();
  const results = [];

  for (const agent of agents) {
    const isNew = !state.agents?.[agent.id];
    try {
      const result = await provisionOne({
        agentId: agent.id,
        reProvision: !isNew,
        userRootNode,
        dryRun,
        verbose,
      });
      results.push({ agentId: agent.id, ...result });
    } catch (err) {
      console.error(`  ✗ Failed to provision ${agent.id}: ${err.message}`);
      results.push({ agentId: agent.id, error: err.message });
    }
  }

  return results;
}

/**
 * Exported as `provision` for CLI use.
 */
export async function provision({ agentId, reProvision = false } = {}) {
  const state = readState();
  const userRootNode = state.user_root_node;

  if (agentId) {
    await provisionOne({ agentId, reProvision, userRootNode, verbose: true });
  } else {
    await provisionAll({ userRootNode, verbose: true });
  }
}
