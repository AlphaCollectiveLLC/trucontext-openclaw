/**
 * OpenClaw Plugin Entry Point
 *
 * Lifecycle hooks:
 *   gateway_start      — provision new agents, background version check
 *   before_prompt_build — inject TC recall into every agent turn
 *   session_start      — (reserved for future per-session init)
 *   session_end        — (reserved for future harvest prompting)
 *
 * Debug logging: set DEBUG=trucontext or TC_DEBUG=true
 */

import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';
import { readState, updateState } from './state.js';
import { discoverUnprovisioned } from './discover.js';
import { provisionOne } from './provision.js';
import { tcRecall } from './tc-api.js';
import { getTcVersion, getLatestTcVersion, updateTc } from './auth.js';
import { installSkill } from './skill.js';
import { log } from './utils.js';

export default definePluginEntry({
  id: 'trucontext-openclaw',
  name: 'TruContext Memory',
  description: 'Persistent knowledge graph memory for all OpenClaw agents',

  register(api) {
    const cfg = api.config ?? {};

    // -----------------------------------------------------------------------
    // gateway_start — provision new agents, background version check
    // -----------------------------------------------------------------------
    api.on('gateway_start', async () => {
      const state = readState();
      if (!state.user_root_node) {
        log.debug('gateway_start: not installed, skipping');
        return;
      }

      // Provision any agents not yet in state
      const registeredIds = Object.keys(state.agents ?? {});
      const unprovisioned = discoverUnprovisioned(registeredIds);

      for (const agent of unprovisioned) {
        log.plugin(`New agent detected: ${agent.name} (${agent.id}) — provisioning`);
        try {
          await provisionOne({
            agentId: agent.id,
            reProvision: false,
            userRootNode: state.user_root_node,
            verbose: false,
          });
        } catch (err) {
          log.error(`Failed to provision ${agent.id}: ${err.message}`);
        }
      }

      // Non-blocking version check (once per day max)
      const lastChecked = state.last_checked ? new Date(state.last_checked) : null;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (!lastChecked || lastChecked < oneDayAgo) {
        setImmediate(async () => {
          try {
            const current = getTcVersion();
            const latest = getLatestTcVersion();
            if (current && latest && latest !== current) {
              log.plugin(`TC update: ${current} → ${latest}`);
              updateTc();
              if (state.workspace_root) await installSkill(state.workspace_root);
              updateState({ tc_version: getTcVersion(), last_checked: new Date().toISOString() });
            } else {
              updateState({ last_checked: new Date().toISOString() });
            }
          } catch (err) {
            log.error(`Background version check failed: ${err.message}`);
          }
        });
      }
    });

    // -----------------------------------------------------------------------
    // before_prompt_build — inject TC recall into every agent turn
    // -----------------------------------------------------------------------
    api.on('before_prompt_build', async (event, ctx) => {
      const state = readState();
      if (!state.user_root_node) return;
      if (cfg.promptInjection === false) return;

      const agentId = ctx.agentId;
      if (!agentId) return;

      const agentState = state.agents?.[agentId];
      if (!agentState) return;

      try {
        const query = event.prompt?.slice(0, 200) ?? 'recent context and active projects';
        const recall = tcRecall(query, agentState.root_node, {
          limit: cfg.recallLimit ?? 5,
        });

        if (!recall || recall.includes('No results')) return;

        log.plugin(`Injecting TC recall for ${agentId} (${recall.length} chars)`);

        // prependContext is injected before the system prompt each turn
        // staticSystemPromptPrefix is cached and prepended once (for static guidance)
        return {
          prependContext: `## TruContext Memory Context\n\n${recall}\n\n---\n`,
        };
      } catch (err) {
        // Non-fatal — agent continues without TC context
        log.debug(`before_prompt_build recall failed for ${agentId}: ${err.message}`);
      }
    });

    // -----------------------------------------------------------------------
    // session_start — reserved
    // -----------------------------------------------------------------------
    api.on('session_start', async (_event, _ctx) => {
      // Future: cache session-level recall, log session start
    });

    // -----------------------------------------------------------------------
    // session_end — reserved
    // -----------------------------------------------------------------------
    api.on('session_end', async (_event, _ctx) => {
      // Future: surface "anything worth ingesting?" prompt for significant sessions
    });
  },
});
