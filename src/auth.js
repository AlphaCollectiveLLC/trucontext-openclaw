/**
 * TruContext auth management
 */

import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import { log, TC_CREDENTIALS_PATH } from './utils.js';

// ---------------------------------------------------------------------------
// TC CLI version
// ---------------------------------------------------------------------------

export function getTcVersion() {
  const result = spawnSync('trucontext', ['--version'], { encoding: 'utf8' });
  if (result.status !== 0 || result.error) return null;
  return result.stdout.trim() || null;
}

export function getLatestTcVersion() {
  const result = spawnSync('npm', ['view', 'trucontext', 'version'], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

export function updateTc() {
  execSync('npm update -g trucontext', { stdio: 'inherit' });
  return getTcVersion();
}

// ---------------------------------------------------------------------------
// CLI installation
// ---------------------------------------------------------------------------

export function ensureTcInstalled() {
  const existing = getTcVersion();
  if (existing) {
    log.info(`  ✓ TruContext CLI ${existing} found`);
    return existing;
  }

  log.info('  → TruContext CLI not found. Installing...');
  try {
    execSync('npm install -g trucontext', { stdio: 'inherit' });
  } catch (err) {
    throw new Error(
      `Failed to install TruContext CLI: ${err.message}\n\nInstall manually: npm install -g trucontext`
    );
  }

  const version = getTcVersion();
  if (!version) throw new Error('TruContext CLI installed but not found in PATH.');
  log.info(`  ✓ TruContext CLI ${version} installed`);
  return version;
}

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------

export function checkAuth() {
  const result = spawnSync('trucontext', ['whoami'], { encoding: 'utf8' });
  if (
    result.status !== 0 ||
    result.error ||
    result.stderr?.includes('not logged in') ||
    result.stderr?.includes('No credentials')
  ) {
    return { authed: false };
  }

  const out = result.stdout;
  const email = out.match(/Email:\s*(.+)/)?.[1]?.trim() ?? undefined;
  const appId = out.match(/Active app:\s*(.+)/)?.[1]?.trim() ?? undefined;
  log.debug(`checkAuth: email=${email}, appId=${appId}`);
  return { authed: true, email, appId };
}

export function login() {
  log.info('\n  Opening browser for TruContext login...');
  const result = spawnSync('trucontext', ['login'], { stdio: 'inherit', encoding: 'utf8' });
  if (result.status !== 0) throw new Error('TruContext login failed or was cancelled.');
}

export function ensureApp(preferredName) {
  const { appId } = checkAuth();
  if (appId) {
    log.info(`  ✓ TruContext app: ${appId}`);
    return appId;
  }

  const name = preferredName ?? `openclaw-${os.hostname()}`;
  log.info(`  → Creating TruContext app: ${name}`);
  const result = spawnSync('trucontext', ['init', name], { stdio: 'inherit', encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Failed to create TruContext app.');

  const { appId: newAppId } = checkAuth();
  if (!newAppId) throw new Error('App created but could not retrieve app ID.');
  return newAppId;
}

// ---------------------------------------------------------------------------
// Access token for REST API calls
// ---------------------------------------------------------------------------

export function getAccessToken() {
  try {
    const creds = JSON.parse(fs.readFileSync(TC_CREDENTIALS_PATH, 'utf8'));
    // TC API requires idToken (Cognito identity token), not accessToken
    const token = creds.idToken ?? creds.accessToken ?? creds.token ?? null;
    if (!token) throw new Error('No token in credentials file.');
    return token;
  } catch {
    throw new Error('Could not read TC credentials. Run: trucontext login');
  }
}
