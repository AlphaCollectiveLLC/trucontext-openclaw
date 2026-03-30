/**
 * Webhook handler for TruContext dream:memory-load events
 *
 * Registered as an OpenClaw HTTP route via api.registerHttpRoute().
 * Validates HMAC signature before processing.
 */

import crypto from 'crypto';
import { readState, resolveAgentByRoot } from './state.js';
import { refreshBriefing } from './briefing.js';
import { discoverAgents } from './discover.js';
import { log } from './utils.js';

/**
 * Register the webhook HTTP route with the OpenClaw plugin API.
 */
export function registerWebhook(api, webhookPath) {
  api.registerHttpRoute({
    path: webhookPath,
    auth: 'plugin',
    match: 'exact',
    replaceExisting: true,
    handler: async (req, res) => {
      // Collect request body
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString('utf8');

      // Validate signature
      const state = readState();
      const signature = req.headers['x-trucontext-signature'];
      if (state.webhook_secret && signature) {
        const expected = crypto
          .createHmac('sha256', state.webhook_secret)
          .update(rawBody)
          .digest('hex');
        if (signature !== `sha256=${expected}`) {
          log.warn('Webhook signature mismatch — rejecting');
          res.statusCode = 401;
          res.end('Unauthorized');
          return true;
        }
      } else if (state.webhook_secret && !signature) {
        log.warn('Webhook missing signature header — rejecting');
        res.statusCode = 401;
        res.end('Unauthorized');
        return true;
      }

      // Parse payload
      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        res.statusCode = 400;
        res.end('Bad Request');
        return true;
      }

      // Respond immediately — processing is async
      res.statusCode = 200;
      res.end('ok');

      // Handle dream:memory-load event
      if (payload.event === 'dream:memory-load' && payload.payload?.agent_id) {
        handleMemoryLoad(payload.payload).catch(err =>
          log.error(`Webhook dream:memory-load handler error: ${err.message}`)
        );
      }

      return true;
    },
  });

  log.debug(`Webhook registered at ${webhookPath}`);
}

/**
 * Handle a dream:memory-load webhook payload.
 * Refreshes TC-BRIEFING.md for the affected agent.
 */
async function handleMemoryLoad(payload) {
  const state = readState();
  if (!state.app_id) return;

  const agentState = resolveAgentByRoot(payload.agent_id);
  if (!agentState) {
    log.debug(`Webhook: no agent found for agent_root=${payload.agent_id}`);
    return;
  }

  // Resolve workspace dir for this agent
  const agents = discoverAgents();
  const agent = agents.find(a => a.id === agentState.ocAgentId);
  if (!agent) return;

  log.plugin(`Webhook: refreshing briefing for ${agentState.ocAgentId}`);
  await refreshBriefing(agent.workspace, state.app_id, payload.agent_id);
}
