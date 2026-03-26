/**
 * tc-memory skill installer
 *
 * Copies the skill template into the OpenClaw workspace's skills/ directory.
 * The skill is the agent's interface to TC — all TC calls go through it.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_TEMPLATE_DIR = path.join(__dirname, '..', 'skill');

/**
 * Install (or update) the tc-memory skill in the given workspace.
 */
export async function installSkill(workspaceRoot) {
  const targetDir = path.join(workspaceRoot, 'skills', 'tc-memory');
  const scriptsDir = path.join(targetDir, 'scripts');

  // Create target directories
  fs.mkdirSync(scriptsDir, { recursive: true });

  // Copy SKILL.md
  const skillMd = fs.readFileSync(path.join(SKILL_TEMPLATE_DIR, 'SKILL.md'), 'utf8');
  fs.writeFileSync(path.join(targetDir, 'SKILL.md'), skillMd, 'utf8');

  // Copy script
  const script = fs.readFileSync(path.join(SKILL_TEMPLATE_DIR, 'scripts', 'tc-memory.sh'), 'utf8');
  const scriptDest = path.join(scriptsDir, 'tc-memory.sh');
  fs.writeFileSync(scriptDest, script, 'utf8');
  fs.chmodSync(scriptDest, '755');
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
