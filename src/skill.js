/**
 * tc-memory skill installer
 *
 * Preferred path: `openclaw skills install tc-memory --force` once the skill
 * is published to ClawHub. This ensures OpenClaw tracks the skill as a managed
 * install (visible to `openclaw skills list`, `check`, and `update`).
 *
 * Fallback path: manual file copy from the bundled skill/ template. Used
 * during development or when ClawHub publication is pending.
 *
 * TODO: replace fallback with `openclaw skills install tc-memory --force`
 * once published to ClawHub.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_TEMPLATE_DIR = path.join(__dirname, '..', 'skill');
const CLAWHUB_SLUG = 'tc-memory';

/**
 * Install (or update) the tc-memory skill in the given workspace.
 *
 * Tries `openclaw skills install` first (ClawHub, managed).
 * Falls back to bundled file copy if ClawHub install fails (e.g. not yet published).
 */
export async function installSkill(workspaceRoot) {
  // Preferred: install via openclaw CLI so the skill is properly registered
  try {
    execSync(
      `openclaw skills install ${CLAWHUB_SLUG} --force`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    return { method: 'clawhub' };
  } catch {
    // ClawHub install failed (skill not yet published) — fall back to bundled copy
  }

  // Fallback: manual file copy from bundled template
  // TODO: remove this block once tc-memory is published to ClawHub
  _installFromTemplate(workspaceRoot);
  return { method: 'bundled' };
}

/**
 * Remove the tc-memory skill from the workspace.
 */
export async function removeSkill(workspaceRoot) {
  const targetDir = path.join(workspaceRoot, 'skills', 'tc-memory');
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _installFromTemplate(workspaceRoot) {
  const targetDir = path.join(workspaceRoot, 'skills', 'tc-memory');
  const scriptsDir = path.join(targetDir, 'scripts');

  fs.mkdirSync(scriptsDir, { recursive: true });

  const skillMd = fs.readFileSync(path.join(SKILL_TEMPLATE_DIR, 'SKILL.md'), 'utf8');
  fs.writeFileSync(path.join(targetDir, 'SKILL.md'), skillMd, 'utf8');

  const script = fs.readFileSync(path.join(SKILL_TEMPLATE_DIR, 'scripts', 'tc-memory.sh'), 'utf8');
  const scriptDest = path.join(scriptsDir, 'tc-memory.sh');
  fs.writeFileSync(scriptDest, script, 'utf8');
  fs.chmodSync(scriptDest, '755');
}
