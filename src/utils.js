/**
 * Shared utilities
 *
 * - Unified logger with DEBUG flag
 * - Shared confirm() prompt
 * - Shared path constants
 */

import readline from 'readline';
import path from 'path';
import os from 'os';

// ---------------------------------------------------------------------------
// Paths (single source of truth)
// ---------------------------------------------------------------------------

export const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw');
export const OPENCLAW_CONFIG_PATH = path.join(OPENCLAW_DIR, 'openclaw.json');
export const TC_STATE_PATH = path.join(OPENCLAW_DIR, 'trucontext.json');
export const TC_CREDENTIALS_PATH = path.join(os.homedir(), '.trucontext', 'credentials.json');
export const TC_HARVEST_LOG_PATH = path.join(os.homedir(), '.trucontext', 'harvest-log.md');

export const TC_API_BASE = process.env.TC_API_BASE ?? 'https://api.trucontext.ai';
export const STUB_MODE = process.env.TC_STUB_MODE === 'true';

// ---------------------------------------------------------------------------
// Logger (gated on DEBUG env var)
// ---------------------------------------------------------------------------

const DEBUG = process.env.DEBUG?.includes('trucontext') || process.env.TC_DEBUG === 'true';

export const log = {
  /** Always shown — install steps, status output */
  info: (msg) => console.log(msg),

  /** Shown only when DEBUG=trucontext or TC_DEBUG=true */
  debug: (msg) => { if (DEBUG) console.log(`[tc:debug] ${msg}`); },

  /** Warnings — always shown */
  warn: (msg) => console.warn(`[tc:warn] ${msg}`),

  /** Errors — always shown */
  error: (msg) => console.error(`[tc:error] ${msg}`),

  /** Plugin-internal logging — only in debug mode */
  plugin: (msg) => { if (DEBUG) console.log(`[trucontext-openclaw] ${msg}`); },
};

// ---------------------------------------------------------------------------
// CLI confirm prompt
// ---------------------------------------------------------------------------

/**
 * Prompt the user for confirmation.
 * @param {string} prompt - Text to display
 * @param {boolean} defaultYes - If true, Enter = yes
 */
export async function confirm(prompt, defaultYes = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (defaultYes) {
        resolve(trimmed === '' || trimmed === 'y' || trimmed === 'yes');
      } else {
        resolve(trimmed === 'y' || trimmed === 'yes');
      }
    });
  });
}
