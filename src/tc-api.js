/**
 * TruContext API client
 *
 * Wraps the TC CLI for all operations.
 * Also calls the TC REST API for the provision endpoint.
 *
 * NOTE: POST /v1/agents/provision must be built by the TC engineer.
 * Set TC_STUB_MODE=true for local development — returns mock responses.
 */

import { spawnSync } from 'child_process';
import { checkAuth, getAccessToken, getTcVersion } from './auth.js';
import { log } from './utils.js';

const TC_API_BASE = process.env.TC_API_BASE ?? 'https://api.trucontext.ai';
const STUB_MODE = process.env.TC_STUB_MODE === 'true';

// ---------------------------------------------------------------------------
// Agent provision (new TC endpoint)
// ---------------------------------------------------------------------------

/**
 * Provision an agent via POST /v1/agents/provision.
 * Returns a ProvisionResponse with root_node, wrapper_config, and prompt_fragment.
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

  log.debug(`provisionAgent: POST ${TC_API_BASE}/v1/agents/provision body=${JSON.stringify({ agent: body.agent })}`);

  const res = await fetch(`${TC_API_BASE}/v1/agents/provision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
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
    throw new Error(`trucontext ${args[0]} failed: ${msg}`);
  }
  return result.stdout.trim();
}

// ---------------------------------------------------------------------------
// Stub mode
// ---------------------------------------------------------------------------

function stubProvisionResponse(agent, userRoot) {
  const version = getTcVersion() ?? '0.0.0';
  return {
    status: 'provisioned',
    agent_id: agent.id,
    root_node: {
      id: agent.id,
      created: true,
      recipe: 'recipe:behavioral-observation',
      dreamers: ['decay', 'concepts', 'curiosity', 'fitness'],
    },
    wrapper_config: {
      agent_id: agent.id,
      root_node: agent.id,
      user_root: userRoot,
      recipe: 'recipe:behavioral-observation',
      primary_about: agent.id,
      tc_version: version,
    },
    prompt_fragment: [
      '## TruContext Memory',
      '',
      'Load the `tc-memory` skill at session start.',
      '',
      `- Your root node: ${agent.id}`,
      `- User root node: ${userRoot}`,
      '- Recipe: recipe:behavioral-observation',
      '',
      '<!-- trucontext-openclaw managed — do not edit manually -->',
    ].join('\n'),
    recipe_inference: { inferred: false, recipe: 'recipe:behavioral-observation', confidence: null },
  };
}
