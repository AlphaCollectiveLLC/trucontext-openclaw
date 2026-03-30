/**
 * OpenClaw Plugin Entry Point (v2)
 *
 * Lifecycle hooks:
 *   gateway_start        — provision new agents, refresh all briefings
 *   before_compaction    — ingest conversation to TC graph (fire and forget)
 *   after_compaction     — refresh TC-BRIEFING.md
 *   before_prompt_build  — inject context for lightweight/isolated sessions only
 *
 * TC-BRIEFING.md is injected into interactive sessions automatically by OpenClaw
 * (workspace bootstrap file set). No before_prompt_build needed for those.
 *
 * Debug logging: set DEBUG=trucontext or TC_DEBUG=true
 */

import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';
import { readState } from './state.js';
import { discoverAgents, discoverUnprovisioned } from './discover.js';
import { provisionAgent } from './provision.js';
import { refreshBriefing } from './briefing.js';
import { registerWebhook } from './webhook.js';
import * as tcApi from './tc-api.js';
import { log } from './utils.js';

export default definePluginEntry({
  id: 'trucontext-openclaw',
  name: 'TruContext Memory',
  description: 'Persistent knowledge graph memory for all OpenClaw agents',
  kind: 'memory',

  register(api) {
    const cfg = api.config ?? {};
    const webhookPath = cfg.webhookPath ?? '/trucontext/webhook';

    // -----------------------------------------------------------------------
    // Register webhook HTTP route for dream:memory-load events
    // -----------------------------------------------------------------------
    registerWebhook(api, webhookPath);

    // -----------------------------------------------------------------------
    // gateway_start — provision unregistered agents + refresh all briefings
    // -----------------------------------------------------------------------
    api.on('gateway_start', async () => {
      const state = readState();
      if (!state.app_id) {
        log.debug('gateway_start: not installed, skipping');
        return;
      }

      // 1. Provision any agents not yet in state
      const registeredIds = Object.keys(state.agents ?? {});
      const unprovisioned = discoverUnprovisioned(registeredIds);

      for (const agent of unprovisioned) {
        log.plugin(`New agent detected: ${agent.name} (${agent.id}) — provisioning`);
        try {
          await provisionAgent({
            agentId: agent.id,
            userRoot: state.user_root,
            appId: state.app_id,
          });
        } catch (err) {
          log.error(`Failed to provision ${agent.id}: ${err.message}`);
        }
      }

      // 2. Hash-check SOUL.md for all registered agents, re-provision if changed
      // Re-read state since provisioning may have updated it
      const freshState = readState();
      const agents = discoverAgents();
      for (const [agentId, agentState] of Object.entries(freshState.agents ?? {})) {
        const agent = agents.find(a => a.id === agentId);
        if (!agent) continue;
        try {
          const result = await provisionAgent({
            agentId,
            userRoot: freshState.user_root,
            appId: freshState.app_id,
            force: false,
          });
          if (result.changed) {
            log.plugin(`gateway_start: re-provisioned ${agentId} (SOUL.md changed)`);
          }
        } catch (err) {
          log.error(`Failed to check/re-provision ${agentId}: ${err.message}`);
        }

        // Refresh briefing regardless of re-provision
        try {
          await refreshBriefing(agent.workspace, freshState.app_id, agentState.agent_root);
        } catch (err) {
          log.error(`Failed to refresh briefing for ${agentId}: ${err.message}`);
        }
      }
    });

    // -----------------------------------------------------------------------
    // before_compaction — ingest conversation to TC graph (fire and forget)
    // -----------------------------------------------------------------------
    api.on('before_compaction', async (event, ctx) => {
      const state = readState();
      if (!state.app_id) return;

      const agentId = ctx.agentId;
      if (!agentId) return;

      const agentState = state.agents?.[agentId];
      if (!agentState) return;

      // Build snapshot from event.messages if available, or from sessionFile
      let snapshot = '';
      if (event.messages && Array.isArray(event.messages)) {
        // Serialize messages to text for ingest
        snapshot = event.messages
          .map(m => {
            if (typeof m === 'string') return m;
            if (m?.content) return typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
            return JSON.stringify(m);
          })
          .join('\n\n');
      }

      if (!snapshot) {
        log.debug(`before_compaction: no messages available for ${agentId}, skipping ingest`);
        return;
      }

      // Truncate to reasonable size for ingest
      const MAX_INGEST_CHARS = 50_000;
      if (snapshot.length > MAX_INGEST_CHARS) {
        snapshot = snapshot.slice(0, MAX_INGEST_CHARS);
      }

      // Fire and forget — do not block compaction
      tcApi.ingest(state.app_id, {
        content: snapshot,
        agent_id: agentState.agent_root,
        contexts: [
          { context_id: agentState.user_root, relationship: 'ABOUT' },
          { context_id: agentState.agent_root, relationship: 'BY' },
        ],
        confidence: 0.8,
        temporal: true,
      }).catch(err => log.error(`[tc] ingest failed: ${err.message}`));
    });

    // -----------------------------------------------------------------------
    // after_compaction — refresh TC-BRIEFING.md
    // -----------------------------------------------------------------------
    api.on('after_compaction', async (_event, ctx) => {
      const state = readState();
      if (!state.app_id) return;

      const agentId = ctx.agentId;
      if (!agentId) return;

      const agentState = state.agents?.[agentId];
      if (!agentState) return;

      const agents = discoverAgents();
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      await refreshBriefing(agent.workspace, state.app_id, agentState.agent_root);
    });

    // -----------------------------------------------------------------------
    // before_prompt_build — lightweight/isolated sessions only
    //
    // Interactive sessions get TC-BRIEFING.md via workspace bootstrap (no hook).
    // Heartbeat sessions: inject hot topics manifest.
    // Cron sessions: inject targeted recall.
    // -----------------------------------------------------------------------
    api.on('before_prompt_build', async (event, ctx) => {
      const state = readState();
      if (!state.app_id) return {};

      // Only handle lightweight sessions (heartbeat, cron)
      // Interactive sessions are handled by TC-BRIEFING.md bootstrap injection
      const trigger = ctx.trigger; // "user" | "heartbeat" | "cron" | "memory"
      if (!trigger || trigger === 'user') return {};

      const agentId = ctx.agentId;
      if (!agentId) return {};

      const agentState = state.agents?.[agentId];
      if (!agentState) return {};

      try {
        if (trigger === 'heartbeat') {
          // Heartbeat: inject hot topics manifest only
          const res = await tcApi.listHotTopics(state.app_id, agentState.agent_root);
          const topics = res?.data || [];
          if (!topics.length) return {};
          const manifest = topics.map(t => `- ${t.label} (${t.slug})`).join('\n');
          return {
            appendSystemContext: `\n## Active Memory Topics\n${manifest}\nUse tc-memory to fetch any topic: tc-memory hot-topic <slug>\n`,
          };
        }

        if (trigger === 'cron') {
          // Check if this is the TruContext sync cron
          const prompt = event.prompt ?? '';
          if (prompt.includes('TruContext sync')) {
            // Run the daily sync: hash-check SOUL.md for each agent, re-provision if changed
            const agents = discoverAgents();
            const summaryParts = [];

            for (const [id, as] of Object.entries(state.agents ?? {})) {
              const agent = agents.find(a => a.id === id);
              if (!agent) continue;

              try {
                const result = await provisionAgent({
                  agentId: id,
                  userRoot: state.user_root,
                  appId: state.app_id,
                  force: false,
                });
                if (result.changed) summaryParts.push(`${id}: re-provisioned (SOUL.md changed)`);

                await refreshBriefing(agent.workspace, state.app_id, as.agent_root);
              } catch (err) {
                summaryParts.push(`${id}: error — ${err.message}`);
              }
            }

            if (summaryParts.length) {
              return { prependContext: `## TruContext Sync Results\n${summaryParts.join('\n')}\n` };
            }
            return { prependContext: '## TruContext Sync\nAll agents current. No changes detected.\n' };
          }

          // Other cron jobs: targeted recall by task intent
          const lastMessage = event.prompt || 'What context is relevant to this task?';
          const recallRes = await tcApi.recall(
            state.app_id,
            agentState.agent_root,
            lastMessage,
            { maxResults: 8 },
          );
          if (recallRes?.data?.synthesis?.summary) {
            return { prependContext: `## Task Context\n${recallRes.data.synthesis.summary}\n` };
          }
        }
      } catch (err) {
        log.debug(`before_prompt_build failed for ${agentId} (${trigger}): ${err.message}`);
      }

      return {};
    });
  },
});
