---
name: trucontext-openclaw
description: "TruContext persistent memory for OpenClaw agents. Use when you need to remember something significant, recall prior context, query the knowledge graph, fetch a hot topic deep-dive, or manage entity nodes. Triggers on: 'remember this', 'recall what we know about', 'check TC', 'hot topic', 'create a node for', 'find the node for'."
homepage: https://trucontext.ai
metadata: {"openclaw": {"emoji": "\ud83e\udde0", "homepage": "https://trucontext.ai", "requires": {"bins": ["trucontext"]}, "install": [{"id": "npm-trucontext-openclaw", "kind": "node", "package": "trucontext-openclaw", "bins": ["trucontext-openclaw"], "label": "Install trucontext-openclaw (npm)"}]}}
---

# trucontext-openclaw

Your persistent memory layer. All TC operations go through this skill.
Never call the `trucontext` CLI directly — use the `tc-memory` verbs below.

If `tc-memory` is not found, run: `trucontext-openclaw install`

## How memory works (automatic)

**You do not need to call recall at session startup.** The plugin writes `TC-BRIEFING.md` into your workspace automatically. OpenClaw injects it every turn — your full memory briefing is always in context.

Use the verbs below only for:
- Explicit ingests (remembering something new)
- On-demand recall when TC-BRIEFING.md doesn't cover a topic
- Hot topic deep-dives
- Entity/node management

## Verbs

```bash
# Remember something significant (narrative, not summary)
tc-memory ingest "<narrative text>" [--permanent]

# Retrieve relevant context not in TC-BRIEFING.md
tc-memory recall "<query>" [--limit N]

# Ask the graph a natural language question
tc-memory query "<question>" [--limit N]

# Fetch a hot topic deep-dive (from TC-BRIEFING.md manifest)
tc-memory hot-topic <slug>

# What gaps has TC identified in your graph?
tc-memory gaps

# What is TC's intelligence layer reporting?
tc-memory health

# Find an existing node before creating a new one
tc-memory node find "<name>"

# Create a new entity node (only after find returns no match)
tc-memory node create --type <type> --id <slug> --name "<display name>" [--permanent]

# Look up a node by ID
tc-memory node get <id>

# Create an explicit edge between two nodes
tc-memory node link <id> --rel <RELATIONSHIP> --to <id2>
```

## Node integrity rule

**Always call `node find` before `node create`.** If a match is returned with confidence > 0.8, use the existing node ID. Only create if no match found.

## Ingest protocol — testify, don't summarize

TC's intelligence layer pattern-matches across ingests. Pre-digested conclusions starve it.

**Before ingesting, ask:** *If TC's intelligence layer read only this, could it learn something the entity didn't explicitly say?*

**The three layers:**
1. What happened (facts, outcome)
2. How it happened (process, friction, pivots) — most signal lives here
3. What it revealed (character, pattern, relationship dynamic) — what TC is hungry for

**Write in first person, past tense, with friction.**

## Temporal vs. permanent

- `--permanent` for facts: events that happened, decisions made, entities created
- Default (temporal) for: behavioral observations, inferences, preferences, patterns

## Config

Your root node, user root, recipe, and app ID are pre-configured by `trucontext-openclaw install`.
You do not need to pass them on every call.

<!-- trucontext-openclaw:start -->
<!-- trucontext-openclaw:end -->

## Source

- Homepage: https://trucontext.ai
- Source: https://github.com/AlphaCollectiveLLC/trucontext-openclaw
