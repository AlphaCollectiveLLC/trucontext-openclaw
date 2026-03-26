# trucontext-openclaw

**TruContext memory for OpenClaw — install once, works forever.**

## Install

```bash
# Install from local directory (until published to npm)
npm install -g /path/to/trucontext-openclaw

# Or from npm (once published)
npm install -g trucontext-openclaw

# Run install wizard
trucontext-openclaw install
```

The install wizard:
1. Checks for (and installs) the TruContext CLI
2. Opens browser for TruContext OAuth login
3. Creates a TC knowledge graph app for your OpenClaw instance
4. Provisions each existing agent with a root node and recipe
5. Installs the `tc-memory` skill into your workspace
6. Registers a daily maintenance cron in OpenClaw

## Commands

```bash
trucontext-openclaw install          # First-time setup
trucontext-openclaw uninstall        # Remove TC from OpenClaw (graph preserved)
trucontext-openclaw provision        # Re-provision all agents
trucontext-openclaw provision <id>   # Re-provision one agent
trucontext-openclaw status           # Show current state
trucontext-openclaw sync             # Run maintenance now (version check + doc drift)
```

## Agent usage (via tc-memory skill)

After install, all agents use the `tc-memory` skill:

```bash
# Remember something significant — narrate, don't summarize
tc-memory ingest "Today we spent 3 hours debugging the MCP server..."
tc-memory ingest "The decision was permanent..." --permanent

# Retrieve context
tc-memory recall "what do we know about X"
tc-memory query "what has changed recently in the EpisodePack project"

# Graph intelligence
tc-memory gaps       # what TC is curious about (curiosity engine)
tc-memory health     # latest fitness assessment

# Node management — always find before create
tc-memory node find "EpisodePack v2"
tc-memory node create --type Project --id ep-v2 --name "EpisodePack v2"
tc-memory node get ep-v2
tc-memory node link ep-v2 --rel PART_OF --to episodepack
```

## OpenClaw plugin

This package also runs as an OpenClaw plugin (registered via `openclaw.plugin.json`).
Install it via `openclaw plugins install`:

```bash
openclaw plugins install /path/to/trucontext-openclaw
openclaw gateway restart
```

Plugin configuration in `openclaw.json` (merged into existing config):

```json
{
  "plugins": {
    "entries": {
      "trucontext-openclaw": {
        "config": {
          "promptInjection": true,
          "recallLimit": 5,
          "memoryDays": 7
        }
      }
    }
  }
}
```

## Debug mode

```bash
# Verbose TC logging
TC_DEBUG=true trucontext-openclaw sync

# Or via DEBUG env var
DEBUG=trucontext trucontext-openclaw install

# Use TC API stub (for development before provision endpoint is live)
TC_STUB_MODE=true trucontext-openclaw provision
```

## Uninstall

```bash
trucontext-openclaw uninstall
```

Removes: `tc-memory` skill, AGENTS.md fragments, cron, state file.
**Preserves:** your TruContext graph data (nothing deleted from TC's servers).

To also delete graph data:
```bash
trucontext roots delete <agent-id>   # for each agent
trucontext apps delete               # to remove the app entirely
```

## For TC engineer

The `POST /v1/agents/provision` endpoint must be built on TC's API.
See design doc: [`TRUCONTEXT-OPENCLAW-DESIGN.md`](../TRUCONTEXT-OPENCLAW-DESIGN.md)

Until the endpoint is live, set `TC_STUB_MODE=true` for full local development.
The stub returns a valid mock response that exercises the complete provisioning flow.

## Architecture

```
bin/cli.js              CLI entry (install/uninstall/provision/status/sync)
src/
  plugin.js             OpenClaw plugin (gateway_start, before_prompt_build hooks)
  install.js            Install orchestrator (wizard + disclosure)
  uninstall.js          Clean removal
  provision.js          Agent provisioning (new + re-provision)
  harvest.js            File reader — SOUL.md, AGENTS.md, memory delta
  inject.js             AGENTS.md managed fragment injection/removal
  tc-api.js             TC CLI wrapper + provision REST endpoint
  cron.js               Daily maintenance — version check + doc drift
  discover.js           Agent discovery from ~/.openclaw/openclaw.json
  auth.js               TC CLI install, auth, version management
  state.js              State file (~/.trucontext/openclaw-state.json)
  skill.js              tc-memory skill file installer
  status.js             Status command
  utils.js              Shared: logger, confirm(), path constants
skill/
  SKILL.md              tc-memory skill with ingest epistemology
  scripts/tc-memory.sh  Skill script — resolves agent config, wraps TC verbs
```

## State file location

`~/.trucontext/openclaw-state.json` — tracks TC version, registered agents,
file mtimes, and prompt fragment hashes. Written by install, updated by cron.

## Harvest log

`~/.trucontext/harvest-log.md` — append-only log of every harvest event.
Shows what changed, how many words were ingested, TC version updates.
View recent entries: `trucontext-openclaw status`
