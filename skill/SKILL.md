---
name: trucontext-openclaw
description: "TruContext persistent memory for OpenClaw agents. Use when you need to remember something significant across sessions, recall prior context, query the knowledge graph, check what TC is curious about, or declare entity nodes. Triggers on: 'remember this', 'recall what we know about', 'check TC', 'what has TC flagged', 'create a node for', 'find the node for'."
metadata: {"openclaw": {"emoji": "🧠", "requires": {"bins": ["trucontext"]}, "install": [{"id": "npm-trucontext-openclaw", "kind": "node", "package": "trucontext-openclaw", "bins": ["trucontext-openclaw"], "label": "Install trucontext-openclaw (npm) — includes TC CLI setup"}]}}
---

# trucontext-openclaw

Your persistent memory layer. All TC operations go through this skill.
Never call the `trucontext` CLI directly — use the `tc-memory` verbs below.

If `tc-memory` is not found, run: `trucontext-openclaw install`

## Verbs

```bash
# Remember something significant (narrative, not summary)
tc-memory ingest "<narrative text>" [--permanent]

# Retrieve relevant context before a decision or conversation
tc-memory recall "<query>" [--limit N]

# Ask the graph a natural language question
tc-memory query "<question>" [--limit N]

# What gaps has TC identified in your graph?
tc-memory gaps

# What is TC's intelligence layer reporting about your recipe alignment?
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

## Your user

Your AGENTS.md fragment tells you your user's root node ID (e.g. `User root: dustin`).
This is the person you serve. Use it to recall what you know about them and to link
observations about them to their node.

**Recall what you know about your user:**
```bash
tc-memory recall "preferences, communication style, and priorities" --root <user_root>
tc-memory recall "what decisions has my user made recently" --root <user_root>
tc-memory recall "what frustrates or energizes my user" --root <user_root>
```

**Ingest an observation about your user** (link it to their node):
```bash
tc-memory ingest "<narrative about user>" --about <user_root>
```
Use this when you observe something significant about how your user thinks, decides,
communicates, or reacts — not just what they asked you to do.

**Create a user root node** (only if one doesn't exist — check first):
```bash
tc-memory node find "<user name>"
# If no match with confidence > 0.8:
tc-memory node create --type Person --id <slug> --name "<Full Name>"
```
After creating, tell your user: "I've created your root node as `<id>`. 
Re-run `trucontext-openclaw install` to register it."

**Link yourself to your user:**
```bash
tc-memory node link <your_root_node> --rel SERVES --to <user_root>
```
Do this once after install if the relationship isn't already in your graph.

## Node integrity rule

**Always call `node find` before `node create`.** If a match is returned with confidence > 0.8, use the existing node ID. Only create if no match found. This prevents duplicate nodes across sessions.

## Session startup

At the start of every session, call:
```bash
tc-memory recall "active projects and entities relevant to my current work"
```
This gives you node IDs to anchor ingests during the session.

## Ingest protocol — testify, don't summarize

TC's intelligence layer pattern-matches across ingests. Pre-digested conclusions starve it.

**Before ingesting, ask:** *If TC's intelligence layer read only this, could it learn something the entity didn't explicitly say?*

If yes — it's signal. Submit it.
If no — rewrite it. Find the friction. Find the turn. Find the moment before you knew the answer.

**The three layers:**
1. What happened (facts, outcome)
2. How it happened (process, friction, pivots) ← most signal lives here
3. What it revealed (character, pattern, relationship dynamic) ← what TC is hungry for

**Write in first person, past tense, with friction.**

Examples of good vs. bad ingests:

❌ Bad: `tc-memory ingest "Fixed the MCP server issue. Used low-level SDK."`

✅ Good: `tc-memory ingest "The higher-level SDK was injecting taskSupport:forbidden into tool schemas — Claude Desktop was silently filtering the tools out because of it. No error. Just absence. Three hours of looking in the wrong places before pulling the raw protocol response and finding it. The fix was ten minutes. The three hours were spent not knowing what question to ask."`

## Temporal vs. permanent

- `--permanent` for facts: events that happened, decisions made, entities created
- Default (temporal) for: behavioral observations, inferences, preferences, patterns

## Config (resolved from ~/.trucontext/openclaw-state.json)

Your root node, user root, recipe, and primary_about are pre-configured by `trucontext-openclaw install`.
You do not need to pass them on every call.
