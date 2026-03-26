/**
 * File harvester
 *
 * Reads agent workspace files and builds the content payload
 * for the TC provision endpoint. No preprocessing — raw text only.
 */

import fs from 'fs';
import path from 'path';

const MAX_MEMORY_CHARS = 10_000;
const MAX_MEMORY_DAYS = 7;

/**
 * Harvest all relevant files from an agent's workspace.
 * Returns content payload for /v1/agents/provision.
 */
export function harvestAgent(agent) {
  return {
    soul: readFile(agent.soulPath),
    agents: readFile(agent.agentsPath),
    identity: readFile(agent.identityPath),
    memory: harvestMemory(agent.memoryDir),
  };
}

/**
 * Harvest only files that have changed since lastHarvested.
 * Returns { changed: bool, content: {...}, changedFiles: string[] }
 */
export function harvestDelta(agent, lastHarvested, filesMtime) {
  const changedFiles = [];
  const content = {};

  for (const [key, filePath] of [
    ['soul', agent.soulPath],
    ['agents', agent.agentsPath],
    ['identity', agent.identityPath],
  ]) {
    const mtime = getFileMtime(filePath);
    if (!mtime) continue;

    const lastKnown = filesMtime?.[path.basename(filePath)];
    if (!lastKnown || mtime > lastKnown) {
      content[key] = readFile(filePath);
      changedFiles.push(path.basename(filePath));
    }
  }

  // Memory: any new files since lastHarvested
  const newMemory = harvestMemoryDelta(agent.memoryDir, lastHarvested);
  if (newMemory.length > 0) {
    content.memory = newMemory;
    changedFiles.push(`memory/${newMemory.length} file(s)`);
  }

  return {
    changed: changedFiles.length > 0,
    content,
    changedFiles,
  };
}

/**
 * Get current mtime map for an agent's watched files.
 */
export function getFileMtimeMap(agent) {
  const map = {};
  for (const [filename, filePath] of [
    ['SOUL.md', agent.soulPath],
    ['AGENTS.md', agent.agentsPath],
    ['IDENTITY.md', agent.identityPath],
  ]) {
    const mtime = getFileMtime(filePath);
    if (mtime) map[filename] = mtime;
  }
  return map;
}

// --- Internal helpers ---

function readFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function getFileMtime(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return null;
  }
}

function harvestMemory(memoryDir, limitDays = MAX_MEMORY_DAYS) {
  if (!memoryDir || !fs.existsSync(memoryDir)) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - limitDays);

  const files = fs.readdirSync(memoryDir)
    .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
    .sort()
    .reverse() // newest first
    .filter(f => {
      const date = new Date(f.replace('.md', ''));
      return date >= cutoff;
    });

  const contents = [];
  let totalChars = 0;

  for (const file of files) {
    const content = readFile(path.join(memoryDir, file));
    if (!content) continue;
    if (totalChars + content.length > MAX_MEMORY_CHARS) break;
    contents.push(content);
    totalChars += content.length;
  }

  return contents;
}

function harvestMemoryDelta(memoryDir, since) {
  if (!memoryDir || !fs.existsSync(memoryDir)) return [];
  if (!since) return harvestMemory(memoryDir);

  const sinceDate = new Date(since);
  const files = fs.readdirSync(memoryDir)
    .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
    .sort()
    .filter(f => {
      const stat = fs.statSync(path.join(memoryDir, f));
      return stat.mtime > sinceDate;
    });

  const contents = [];
  let totalChars = 0;

  for (const file of files) {
    const content = readFile(path.join(memoryDir, file));
    if (!content) continue;
    if (totalChars + content.length > MAX_MEMORY_CHARS) break;
    contents.push(content);
    totalChars += content.length;
  }

  return contents;
}
