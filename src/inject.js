/**
 * AGENTS.md prompt fragment injection
 *
 * Appends (or updates) a managed TruContext memory section in an agent's AGENTS.md.
 * Uses HTML comment markers to identify the managed block.
 */

import fs from 'fs';
import crypto from 'crypto';

const MANAGED_START = '## TruContext Memory';
const MANAGED_END = '<!-- trucontext-openclaw managed — do not edit manually -->';

/**
 * Inject or update the TC prompt fragment in an agent's AGENTS.md.
 * Returns { changed: bool, hash: string }
 */
export function injectFragment(agentsPath, fragment) {
  if (!fs.existsSync(agentsPath)) {
    // Create the file with just the fragment
    fs.writeFileSync(agentsPath, `\n${fragment}\n`, 'utf8');
    return { changed: true, hash: hashFragment(fragment) };
  }

  const current = fs.readFileSync(agentsPath, 'utf8');
  const existing = extractFragment(current);
  const newHash = hashFragment(fragment);

  if (existing && hashFragment(existing) === newHash) {
    return { changed: false, hash: newHash };
  }

  let updated;
  if (existing) {
    // Replace existing managed block
    updated = replaceManagedBlock(current, fragment);
  } else {
    // Append to end of file
    updated = current.trimEnd() + '\n\n' + fragment + '\n';
  }

  fs.writeFileSync(agentsPath, updated, 'utf8');
  return { changed: true, hash: newHash };
}

/**
 * Remove the managed TC block from an agent's AGENTS.md.
 */
export function removeFragment(agentsPath) {
  if (!fs.existsSync(agentsPath)) return;
  const current = fs.readFileSync(agentsPath, 'utf8');
  const cleaned = removeManagedBlock(current);
  fs.writeFileSync(agentsPath, cleaned, 'utf8');
}

/**
 * Extract the current managed fragment from AGENTS.md content.
 * Returns the fragment string or null if not present.
 */
export function extractFragment(content) {
  const startIdx = content.indexOf(MANAGED_START);
  const endIdx = content.indexOf(MANAGED_END);
  if (startIdx === -1 || endIdx === -1) return null;
  return content.slice(startIdx, endIdx + MANAGED_END.length).trim();
}

// --- Internal ---

function replaceManagedBlock(content, newFragment) {
  const startIdx = content.indexOf(MANAGED_START);
  const endIdx = content.indexOf(MANAGED_END) + MANAGED_END.length;
  // Consume trailing newline if present
  const afterEnd = content[endIdx] === '\n' ? endIdx + 1 : endIdx;
  return content.slice(0, startIdx).trimEnd() + '\n\n' + newFragment + '\n' + content.slice(afterEnd);
}

function removeManagedBlock(content) {
  const startIdx = content.indexOf(MANAGED_START);
  const endIdx = content.indexOf(MANAGED_END);
  if (startIdx === -1 || endIdx === -1) return content;
  const afterEnd = endIdx + MANAGED_END.length;
  const before = content.slice(0, startIdx).trimEnd();
  const after = content.slice(afterEnd).replace(/^\n+/, '');
  return before + (after ? '\n\n' + after : '\n');
}

function hashFragment(fragment) {
  return crypto.createHash('sha256').update(fragment).digest('hex').slice(0, 16);
}
