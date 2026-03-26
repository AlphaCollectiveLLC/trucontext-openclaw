/**
 * AGENTS.md prompt fragment injection
 *
 * Appends (or updates) a managed TruContext memory section in an agent's AGENTS.md.
 * Uses HTML comment fence markers to identify the managed block — both start and end
 * are written on inject, so removeFragment can always find and cleanly remove the block
 * regardless of what else is in the file.
 *
 * Fence format:
 *   <!-- trucontext-openclaw:start -->
 *   ## TruContext Memory
 *   ...TC-generated content...
 *   <!-- trucontext-openclaw:end -->
 */

import fs from 'fs';
import crypto from 'crypto';

const FENCE_START = '<!-- trucontext-openclaw:start -->';
const FENCE_END   = '<!-- trucontext-openclaw:end -->';

// TC API currently returns "## Memory" as the fragment header.
// Normalize to "## TruContext Memory" to avoid colliding with existing ## Memory sections.
const TC_API_HEADER = '## Memory';
const NORMALIZED_HEADER = '## TruContext Memory';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Inject or update the TC prompt fragment in an agent's AGENTS.md.
 * Always writes content wrapped in fence markers.
 * Returns { changed: bool, hash: string }
 */
export function injectFragment(agentsPath, rawFragment) {
  const fragment = _normalizeHeader(rawFragment);
  const fenced = _fence(fragment);
  const newHash = hashFragment(fragment);

  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(agentsPath, `\n${fenced}\n`, 'utf8');
    return { changed: true, hash: newHash };
  }

  const current = fs.readFileSync(agentsPath, 'utf8');
  const existing = extractFragment(current);

  if (existing && hashFragment(existing) === newHash) {
    return { changed: false, hash: newHash };
  }

  const updated = existing
    ? _replaceManagedBlock(current, fenced)
    : current.trimEnd() + '\n\n' + fenced + '\n';

  fs.writeFileSync(agentsPath, updated, 'utf8');
  return { changed: true, hash: newHash };
}

/**
 * Remove the managed TC block from an agent's AGENTS.md.
 * Returns { removed: bool } — false if no fenced block was found.
 */
export function removeFragment(agentsPath) {
  if (!fs.existsSync(agentsPath)) return { removed: false };
  const current = fs.readFileSync(agentsPath, 'utf8');
  if (!_hasFence(current)) return { removed: false };
  const cleaned = _removeManagedBlock(current);
  fs.writeFileSync(agentsPath, cleaned, 'utf8');
  return { removed: true };
}

/**
 * Extract the inner content of the managed block (without fence markers).
 * Returns the fragment string or null if no fenced block is present.
 */
export function extractFragment(content) {
  const startIdx = content.indexOf(FENCE_START);
  const endIdx   = content.indexOf(FENCE_END);
  if (startIdx === -1 || endIdx === -1) return null;
  // Return only the inner content between the fence lines
  const inner = content.slice(startIdx + FENCE_START.length, endIdx);
  return inner.trim();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _normalizeHeader(raw) {
  return raw.startsWith(TC_API_HEADER + '\n')
    ? NORMALIZED_HEADER + raw.slice(TC_API_HEADER.length)
    : raw;
}

function _fence(fragment) {
  return `${FENCE_START}\n${fragment.trim()}\n${FENCE_END}`;
}

function _hasFence(content) {
  return content.includes(FENCE_START) && content.includes(FENCE_END);
}

function _replaceManagedBlock(content, newFenced) {
  const startIdx = content.indexOf(FENCE_START);
  const endIdx   = content.indexOf(FENCE_END) + FENCE_END.length;
  const afterEnd = content[endIdx] === '\n' ? endIdx + 1 : endIdx;
  return (
    content.slice(0, startIdx).trimEnd() +
    '\n\n' +
    newFenced +
    '\n' +
    content.slice(afterEnd)
  );
}

function _removeManagedBlock(content) {
  const startIdx = content.indexOf(FENCE_START);
  const endIdx   = content.indexOf(FENCE_END) + FENCE_END.length;
  const afterEnd = content[endIdx] === '\n' ? endIdx + 1 : endIdx;
  const before = content.slice(0, startIdx).trimEnd();
  const after  = content.slice(afterEnd).replace(/^\n+/, '');
  return before + (after ? '\n\n' + after : '\n');
}

export function hashFragment(fragment) {
  return crypto.createHash('sha256').update(fragment).digest('hex').slice(0, 16);
}
