/**
 * TruContext REST API client
 *
 * Uses the TC CLI's own auth module (ensureFreshToken) and config (URLs) so
 * we always use the same token + endpoints as the CLI itself — no divergence.
 *
 * Data plane  (api.trucontext.ai)     — ingest, recall, query, provision, briefing, hot-topics
 * Control plane (platform.trucontext.ai) — apps, auth validation
 *
 * Set TC_STUB_MODE=true for local development — returns mock responses.
 */

import { STUB_MODE, log } from './utils.js';

// Lazy-import TC CLI internals so missing package gives a clear error
async function getTcInternals() {
  try {
    // Resolve the TC CLI package dynamically from PATH
    const { createRequire } = await import('module');
    const { spawnSync } = await import('child_process');
    const npmRoot = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim();
    const tcRoot = `${npmRoot}/trucontext`;
    const [{ ensureFreshToken }, { DATA_PLANE_URL, CONTROL_PLANE_URL, getActiveApp }] = await Promise.all([
      import(`${tcRoot}/src/auth.js`),
      import(`${tcRoot}/src/config.js`),
    ]);
    return { ensureFreshToken, DATA_PLANE_URL, CONTROL_PLANE_URL, getActiveApp };
  } catch {
    // Fallback: try npx / global path resolution
    throw new Error('TruContext CLI not found. Run: npm install -g trucontext');
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function apiCall(plane, method, path, body) {
  const { ensureFreshToken, DATA_PLANE_URL, CONTROL_PLANE_URL } = await getTcInternals();
  const baseUrl = plane === 'data' ? DATA_PLANE_URL : CONTROL_PLANE_URL;
  const url = `${baseUrl}${path}`;

  log.debug(`tc-api: ${method} ${url}`);

  const token = await ensureFreshToken();
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 30000);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      ...(body && { body: JSON.stringify(body) }),
      signal: ac.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401 || res.status === 403) {
        throw new AuthExpiredError('TC auth expired or invalid. Run: trucontext-openclaw install');
      }
      throw new Error(`TC API ${method} ${path} failed (${res.status}): ${errText}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeout);
  }
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
  return apiCall('data', 'POST', `/v1/apps/${appId}/agents/provision`, payload);
}

/**
 * Get the MLC briefing for an agent.
 * GET /v1/apps/{appId}/agents/{agentId}/memory-load
 */
export async function getMemoryLoad(appId, agentId) {
  if (STUB_MODE) return { data: { status: 'pending' } };
  return apiCall('data', 'GET', `/v1/apps/${appId}/agents/${agentId}/memory-load`);
}

/**
 * List hot topics for an agent.
 * GET /v1/apps/{appId}/agents/{agentId}/hot-topics
 */
export async function listHotTopics(appId, agentId) {
  if (STUB_MODE) return { data: [] };
  return apiCall('data', 'GET', `/v1/apps/${appId}/agents/${agentId}/hot-topics`);
}

/**
 * Get a specific hot topic.
 * GET /v1/apps/{appId}/agents/{agentId}/hot-topics/{slug}
 */
export async function getHotTopic(appId, agentId, slug) {
  if (STUB_MODE) return { data: null };
  return apiCall('data', 'GET', `/v1/apps/${appId}/agents/${agentId}/hot-topics/${encodeURIComponent(slug)}`);
}

/**
 * Ingest content into the graph.
 * POST /v1/apps/{appId}/ingest
 */
export async function ingest(appId, payload) {
  if (STUB_MODE) { log.warn('[STUB] ingest'); return { data: { status: 'ok' } }; }
  return apiCall('data', 'POST', `/v1/apps/${appId}/ingest`, payload);
}

/**
 * Semantic recall.
 * POST /v1/apps/{appId}/recall
 */
export async function recall(appId, rootId, query, opts = {}) {
  if (STUB_MODE) return { data: { synthesis: { summary: '' } } };
  return apiCall('data', 'POST', `/v1/apps/${appId}/recall`, {
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
  return apiCall('data', 'POST', `/v1/apps/${appId}/query`, {
    question,
    root_id: rootId,
    maxResults: opts.maxResults ?? 10,
  });
}

/**
 * Validate auth against the control plane (used by install wizard).
 * GET /apps — returns true if token is valid.
 */
export async function validateAuth() {
  if (STUB_MODE) return true;
  try {
    await apiCall('control', 'GET', '/apps');
    return true;
  } catch (err) {
    if (err instanceof AuthExpiredError || err.status === 401 || err.status === 403) return false;
    // Network error or other — treat as invalid
    return false;
  }
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
