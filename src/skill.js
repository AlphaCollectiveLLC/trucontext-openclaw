/**
 * trucontext-openclaw skill installer
 *
 * Installs the skill into ~/.openclaw/skills (shared across ALL agents),
 * not into a single agent workspace. This ensures every agent has access
 * without requiring per-agent installs.
 *
 * Preferred path: `openclaw skills install trucontext-openclaw --force`
 * (ClawHub managed — visible to `openclaw skills list`, `check`, `update`).
 *
 * Fallback path: manual file copy from the bundled skill/ template.
 * Used when ClawHub install is unavailable (e.g. offline, not yet published).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_TEMPLATE_DIR = path.join(__dirname, '..', 'skill');
const CLAWHUB_SLUG = 'trucontext-openclaw';

// Shared skills dir — visible to all agents on this machine
const SHARED_SKILLS_DIR = path.join(os.homedir(), '.openclaw', 'skills');

/**
 * Install (or update) the trucontext-openclaw skill into ~/.openclaw/skills.
 *
 * Tries `openclaw skills install` first (ClawHub managed path).
 * Falls back to bundled file copy if ClawHub install fails.
 *
 * Returns { method: 'clawhub' | 'bundled' }
 */
export async function installSkill(_workspaceRoot) {
  // Ensure shared skills dir exists
  fs.mkdirSync(SHARED_SKILLS_DIR, { recursive: true });

  // Preferred: install via openclaw CLI (ClawHub managed)
  try {
    execSync(
      `openclaw skills install ${CLAWHUB_SLUG} --force`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    // Also copy to shared dir so all agents pick it up regardless of active workspace
    _installFromTemplate(SHARED_SKILLS_DIR);
    return { method: 'clawhub' };
  } catch {
    // ClawHub install failed — fall back to bundled copy
  }

  // Fallback: manual file copy from bundled template into shared skills dir
  _installFromTemplate(SHARED_SKILLS_DIR);
  return { method: 'bundled' };
}

/**
 * Remove the trucontext-openclaw skill from the shared skills dir.
 * Also cleans up the legacy tc-memory location if present.
 */
export async function removeSkill(_workspaceRoot) {
  const sharedTarget = path.join(SHARED_SKILLS_DIR, CLAWHUB_SLUG);
  if (fs.existsSync(sharedTarget)) {
    fs.rmSync(sharedTarget, { recursive: true });
  }
  // Clean up legacy tc-memory install location if present
  const legacyTarget = path.join(SHARED_SKILLS_DIR, 'tc-memory');
  if (fs.existsSync(legacyTarget)) {
    fs.rmSync(legacyTarget, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _installFromTemplate(baseDir) {
  const targetDir = path.join(baseDir, CLAWHUB_SLUG);
  const scriptsDir = path.join(targetDir, 'scripts');

  fs.mkdirSync(scriptsDir, { recursive: true });

  // Copy SKILL.md
  const skillMd = fs.readFileSync(path.join(SKILL_TEMPLATE_DIR, 'SKILL.md'), 'utf8');
  fs.writeFileSync(path.join(targetDir, 'SKILL.md'), skillMd, 'utf8');

  // Copy main script
  const script = fs.readFileSync(
    path.join(SKILL_TEMPLATE_DIR, 'scripts', 'trucontext-openclaw.sh'),
    'utf8'
  );
  const scriptDest = path.join(scriptsDir, 'trucontext-openclaw.sh');
  fs.writeFileSync(scriptDest, script, 'utf8');
  fs.chmodSync(scriptDest, '755');

  // Symlink tc-memory.sh → trucontext-openclaw.sh for backward compatibility
  // with any AGENTS.md files that still reference `tc-memory`
  const symlinkDest = path.join(scriptsDir, 'tc-memory.sh');
  if (fs.existsSync(symlinkDest)) fs.unlinkSync(symlinkDest);
  fs.symlinkSync('trucontext-openclaw.sh', symlinkDest);
}
