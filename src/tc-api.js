/**
 * TruContext REST API client
 *
 * Thin wrapper over the TC REST API. All functions read credentials from state.
 * No CLI wrappers — everything goes through fetch().
 *
 * Set TC_STUB_MODE=true for local development — returns mock responses.
 */

import { readState } from './state.js';
import { TC_API_BASE, STUB_MODE, log } from './utils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function headers(state) {
  return {
    'x-api-key': state?.api_key ?? '',
    'Content-Type': 'application/json',
  };
}

async function apiCall(method, path, state, body) {
  const url = `${TC_API_BASE}${path}`;
  log.debug(`tc-api: ${method} ${url}`);

  const res = await fetch(url, {
    method,
    headers: headers(state),
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new AuthExpiredError('TC auth expired or invalid. Run: npx trucontext login');
    }
    throw new Error(`TC API ${method} ${path} failed (${res.status}): ${errText}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Provision an agent.
 * POST /v1/apps/{appId}/agents/provision
 */
export async function provision(appId, payload) {
  if (STUB_MODE) {
    log.warn(`[STUB] provision for ${payload.agent?.id}`);
    return stubProvisionResponse(payload.agent, payload.user?.root_node);
  }
  const state = readState();
  return apiCall('POST', `/v1/apps/${appId}/agents/provision`, state, payload);
}

/**
 * Get the MLC briefing for an agent.
 * GET /v1/apps/{appId}/agents/{agentId}/memory-load
 */
export async function getMemoryLoad(appId, agentId) {
  if (STUB_MODE) return { data: { status: 'pending' } };
  const state = readState();
  return apiCall('GET', `/v1/apps/${appId}/agents/${agentId}/memory-load`, state);
}

/**
 * List hot topics for an agent.
 * GET /v1/apps/{appId}/agents/{agentId}/hot-topics
 */
export async function listHotTopics(appId, agentId) {
  if (STUB_MODE) return { data: [] };
  const state = readState();
  return apiCall('GET', `/v1/apps/${appId}/agents/${agentId}/hot-topics`, state);
}

/**
 * Get a specific hot topic.
 * GET /v1/apps/{appId}/agents/{agentId}/hot-topics/{slug}
 */
export async function getHotTopic(appId, agentId, slug) {
  if (STUB_MODE) return { data: null };
  const state = readState();
  return apiCall('GET', `/v1/apps/${appId}/agents/${agentId}/hot-topics/${encodeURIComponent(slug)}`, state);
}

/**
 * Ingest content into the graph.
 * POST /v1/apps/{appId}/ingest
 */
export async function ingest(appId, payload) {
  if (STUB_MODE) { log.warn('[STUB] ingest'); return { data: { status: 'ok' } }; }
  const state = readState();
  return apiCall('POST', `/v1/apps/${appId}/ingest`, state, payload);
}

/**
 * Semantic recall.
 * POST /v1/apps/{appId}/recall
 */
export async function recall(appId, rootId, query, opts = {}) {
  if (STUB_MODE) return { data: { synthesis: { summary: '' } } };
  const state = readState();
  return apiCall('POST', `/v1/apps/${appId}/recall`, state, {
    query,
    root_id: rootId,
    maxResults: opts.maxResults ?? 10,
    expansionDepth: opts.expansionDepth ?? 2,
    ...(opts.intent && { intent: opts.intent }),
  });
}

/**
 * Natural language query.
 * POST /v1/apps/{appId}/query
 */
export async function query(appId, rootId, question, opts = {}) {
  if (STUB_MODE) return { data: { answer: '' } };
  const state = readState();
  return apiCall('POST', `/v1/apps/${appId}/query`, state, {
    question,
    root_id: rootId,
    maxResults: opts.maxResults ?? 10,
  });
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class AuthExpiredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

// ---------------------------------------------------------------------------
// Stub mode
// ---------------------------------------------------------------------------

function stubProvisionResponse(agent, userRoot) {
  return {
    data: {
      agent_root: agent?.id ?? 'stub',
      user_root: userRoot ?? 'user',
      status: 'created',
      recipe_id: 'recipe:generic',
      prompt_fragment: [
        '## Memory',
        `Load the \`tc-memory\` skill. Your root node: ${agent?.id ?? 'stub'}. User root: ${userRoot ?? 'user'}.`,
        '',
        'All content you ingest is automatically enriched by the TruContext pipeline.',
        '',
        '<!-- trucontext-openclaw managed — do not edit manually -->',
      ].join('\n'),
      content_ingested: { soul: true, agents: false, identity: false, memory_files: 0 },
    },
  };
}
