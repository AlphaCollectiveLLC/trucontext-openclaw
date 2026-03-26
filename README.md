# trucontext-openclaw

Persistent, intelligent memory for OpenClaw agents. Install once, works forever.

## Install

```bash
npm install -g trucontext-openclaw
trucontext-openclaw install
```

That's it. Browser opens for auth. Every agent gets memory.

## What It Does

- Authenticates with TruContext via OAuth
- Creates a TC app for this OpenClaw instance
- Provisions each agent — reads SOUL.md, creates root nodes, seeds the graph
- Installs the `tc-memory` skill — the wrapper all agents use
- Registers a daily cron to keep everything in sync

## What Agents Get

```
tc-memory recall "what do we know about X"   # retrieve context
tc-memory ingest "narrative text here"        # remember this
tc-memory ingest "confirmed pattern" --permanent  # permanent memory
tc-memory query "what has changed recently"   # ask the graph
tc-memory gaps                                # what is TC curious about
tc-memory health                              # latest fitness assessment
```

## How It Works

See [TruContext Agent Provision API](https://app.trucontext.ai/documentation) for the full architecture.

## License

MIT — see [LICENSE](LICENSE)
