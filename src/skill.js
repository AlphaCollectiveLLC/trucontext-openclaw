/**
 * trucontext-openclaw skill installer (simplified)
 *
 * Installs the tc-memory skill into ~/.openclaw/skills (shared across all agents).
 *
 * Preferred path: `openclaw skills install trucontext-openclaw --force`
 * Fallback path: manual file copy from bundled skill/ template.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_TEMPLATE_DIR = path.join(__dirname, '..', 'skill');
const CLAWHUB_SLUG = 'trucontext-openclaw';
const SHARED_SKILLS_DIR = path.join(os.homedir(), '.openclaw', 'skills');

/**
 * Install (or update) the trucontext-openclaw skill.
 * Returns { method: 'clawhub' | 'bundled' }
 */
export async function installSkill() {
  fs.mkdirSync(SHARED_SKILLS_DIR, { recursive: true });

  try {
    execSync(`openclaw skills install ${CLAWHUB_SLUG} --force`, { encoding: 'utf8', stdio: 'pipe' });
    _installFromTemplate(SHARED_SKILLS_DIR);
    return { method: 'clawhub' };
  } catch {
    // ClawHub install failed — fall back to bundled copy
  }

  _installFromTemplate(SHARED_SKILLS_DIR);
  return { method: 'bundled' };
}

/**
 * Remove the skill from the shared skills dir.
 */
export async function removeSkill() {
  const target = path.join(SHARED_SKILLS_DIR, CLAWHUB_SLUG);
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true });

  const legacy = path.join(SHARED_SKILLS_DIR, 'tc-memory');
  if (fs.existsSync(legacy)) fs.rmSync(legacy, { recursive: true });
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function _installFromTemplate(baseDir) {
  const targetDir = path.join(baseDir, CLAWHUB_SLUG);
  const scriptsDir = path.join(targetDir, 'scripts');

  fs.mkdirSync(scriptsDir, { recursive: true });

  // Copy SKILL.md
  const skillMd = fs.readFileSync(path.join(SKILL_TEMPLATE_DIR, 'SKILL.md'), 'utf8');
  fs.writeFileSync(path.join(targetDir, 'SKILL.md'), skillMd, 'utf8');

  // Copy main script
  const scriptSrc = path.join(SKILL_TEMPLATE_DIR, 'scripts', 'trucontext-openclaw.sh');
  if (fs.existsSync(scriptSrc)) {
    const script = fs.readFileSync(scriptSrc, 'utf8');
    const scriptDest = path.join(scriptsDir, 'trucontext-openclaw.sh');
    fs.writeFileSync(scriptDest, script, 'utf8');
    fs.chmodSync(scriptDest, '755');

    // Backward compat symlink
    const symlinkDest = path.join(scriptsDir, 'tc-memory.sh');
    if (fs.existsSync(symlinkDest)) fs.unlinkSync(symlinkDest);
    fs.symlinkSync('trucontext-openclaw.sh', symlinkDest);
  }
}
