/**
 * TruContext API client
 *
 * Wraps the TC CLI for all operations.
 * Also calls the TC REST API for the provision endpoint.
 *
 * Set TC_STUB_MODE=true for local development — returns mock responses.
 */

import { spawnSync } from 'child_process';
import { checkAuth, getAccessToken, getTcVersion } from './auth.js';
import { log } from './utils.js';

const TC_API_BASE = process.env.TC_API_BASE ?? 'https://platform.trucontext.ai';
const STUB_MODE = process.env.TC_STUB_MODE === 'true';

// ---------------------------------------------------------------------------
// Agent provision (new TC endpoint)
// ---------------------------------------------------------------------------

/**
 * Provision an agent via POST /v1/apps/{appId}/agents/provision.
 * Returns { data: { agent_root, recipe_id, prompt_fragment, content_ingested, ... } }.
 */
export async function provisionAgent({ agent, user, content, hints = {}, options = {} }) {
  if (STUB_MODE) {
    log.warn(`[STUB] provision for ${agent.id} — set TC_STUB_MODE=false for production`);
    return stubProvisionResponse(agent, user.root_node);
  }

  const { appId } = checkAuth();
  if (!appId) throw new Error('Not authenticated with TruContext. Run: trucontext login');

  const token = getAccessToken();
  const body = {
    agent: { id: agent.id, name: agent.name, role: agent.role ?? '' },
    user: { root_node: user.root_node },
    content,
    hints,
    options: {
      create_root_node: options.create_root_node ?? true,
      dry_run: options.dry_run ?? false,
    },
  };

  log.debug(`provisionAgent: POST ${TC_API_BASE}/v1/apps/${appId}/agents/provision body=${JSON.stringify({ agent: body.agent })}`);

  const res = await fetch(`${TC_API_BASE}/v1/apps/${appId}/agents/provision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new AuthExpiredError(`TC auth expired or invalid. Run: npx trucontext login`);
    }
    throw new Error(`TC provision failed (${res.status}): ${errText}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// TC CLI wrappers — all TC commands go through tc()
// ---------------------------------------------------------------------------

export function tcIngest(text, contexts = [], opts = {}) {
  const args = ['ingest', text];
  for (const ctx of contexts) args.push('--context', ctx);
  if (opts.noTemporal) args.push('--no-temporal');
  if (opts.confidence != null) args.push('--confidence', String(opts.confidence));
  return tc(args);
}

export function tcRecall(query, rootNode, opts = {}) {
  const args = ['recall', query, '--root', rootNode];
  if (opts.limit) args.push('--limit', String(opts.limit));
  if (opts.depth) args.push('--depth', String(opts.depth));
  return tc(args);
}

export function tcQuery(question, rootNode, opts = {}) {
  const args = ['query', question, '--root', rootNode];
  if (opts.limit) args.push('--limit', String(opts.limit));
  return tc(args);
}

export function tcCuriosityList(rootNode) {
  return tc(['curiosity', 'list', '--root', rootNode]);
}

export function tcCuriosityTrigger(rootNode) {
  return tc(['curiosity', 'trigger', '--root', rootNode]);
}

export function tcMindThoughts(opts = {}) {
  const args = ['mind', 'thoughts'];
  if (opts.limit) args.push('--limit', String(opts.limit));
  if (opts.mode) args.push('--mode', opts.mode);
  return tc(args);
}

export function tcRootsCreate({ id, type, name, recipe, dreamers, contextLinks = [] }) {
  const args = [
    'roots', 'create',
    '--id', id,
    '--type', type,
    '--recipe', recipe,
    '--properties', JSON.stringify({ name }),
  ];
  if (dreamers?.length) args.push('--dreamers', dreamers.join(','));
  for (const link of contextLinks) args.push('--context', link);
  return tc(args);
}

export function tcRootsList() {
  return tc(['roots', 'list']);
}

export function tcEntityCreate({ id, type, name, contexts = [] }) {
  const args = [
    'entities', 'create',
    '--id', id,
    '--type', type,
    '--properties', JSON.stringify({ name }),
  ];
  for (const ctx of contexts) args.push('--context', ctx);
  return tc(args);
}

export function tcGraphSearch(query) {
  return tc(['graph', 'search', query]);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function tc(args) {
  log.debug(`tc: trucontext ${args.join(' ')}`);
  const result = spawnSync('trucontext', args, { encoding: 'utf8' });
  if (result.status !== 0 || result.error) {
    const msg = (result.stderr || result.stdout || result.error?.message || 'unknown error').trim();
    if (/unauthorized|unauthenticated|401|403|token.*expired|not logged in/i.test(msg)) {
      throw new AuthExpiredError(`TC auth expired or invalid. Run: npx trucontext login`);
    }
    throw new Error(`trucontext ${args[0]} failed: ${msg}`);
  }
  return result.stdout.trim();
}

/**
 * Sentinel error class for TC auth failures.
 * Callers can check `err instanceof AuthExpiredError` to surface targeted recovery advice.
 */
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
      agent_root: agent.id,
      user_root: userRoot,
      status: 'created',
      recipe_id: 'recipe:generic',
      recipe_inference: 'skipped',
      prompt_fragment: [
        '## Memory',
        `Load the \`tc-memory\` skill. Your root node: ${agent.id}. User root: ${userRoot}.`,
        '',
        '# Memory Briefing (stub)',
        '',
        'This is a stub response. Set TC_STUB_MODE=false to get a real LLM-generated briefing.',
        '',
        '<!-- trucontext-openclaw managed — do not edit manually -->',
      ].join('\n'),
      content_ingested: {
        soul: true,
        agents: false,
        identity: false,
        memory_files: 0,
      },
    },
  };
}
