# trucontext-openclaw

**Persistent, intelligent memory for every OpenClaw agent.**

Your agents forget everything between sessions. Context compaction destroys what they learned. Memory plugins store facts but can't connect them.

TruContext gives your agents a brain that survives. Not flat files — an intelligent knowledge graph that understands relationships, tracks how beliefs evolve, asks its own questions about what's missing, and dreams about patterns while your agents sleep.

One install. Every agent gets memory. Forever.

---

## Install

```bash
npm install -g trucontext-openclaw
trucontext-openclaw install
```

Browser opens for auth. Agents are provisioned. Memory is active.

No configuration. No YAML. No per-agent setup.

## What Happens

1. **Auth** — OAuth browser login to TruContext (30 seconds)
2. **App created** — an intelligent knowledge graph for your OpenClaw instance
3. **Agents provisioned** — each agent gets a root node, a recipe, and a personalized memory briefing
4. **Skill installed** — `tc-memory` becomes available to all agents
5. **Cron registered** — daily sync keeps everything current

---

## What Agents Get

Every agent receives a `tc-memory` skill with five commands:

```bash
tc-memory recall "what do we know about X"        # rebuild working memory
tc-memory ingest "narrative about what happened"   # remember this session
tc-memory ingest "confirmed pattern" --permanent   # permanent knowledge
tc-memory gaps                                     # what the system is curious about
tc-memory health                                   # intelligence layer status
```

Every agent also gets a **personalized memory briefing** — an LLM-generated guide that teaches it how to remember well, shaped by its role. A competitive intelligence agent learns to track pricing patterns and show the turn. A personal assistant learns to capture preference signals and behavioral observations. The briefing is injected into the agent's AGENTS.md automatically.

### Session Startup

Each briefing includes a session startup protocol:

```bash
tc-memory recall "active projects and recent context"
```

This runs at the start of every session, rebuilding working memory from the graph. The agent wakes up knowing what it knew yesterday.

---

## What Makes TruContext Different

### Intelligent knowledge graph — not flat storage

Other memory tools store text and retrieve by keyword similarity. TruContext builds a living model. It tracks entities, relationships, confidence scores, and temporal decay. A preference stated once fades over time. A preference confirmed across five sessions becomes core knowledge. A contradiction between what someone says and what they do gets surfaced — not buried.

### Your agents ask questions

The curiosity engine identifies gaps in the graph — orphan nodes, sparse neighborhoods, missing context, contradictions — and generates questions. Agents check `tc-memory gaps` to see what the system is curious about and proactively fill those gaps. The graph gets smarter because the system knows what it doesn't know.

### Memory that dreams

Dream workers run continuously, reasoning about your data while your agents sleep. They find cross-session patterns, reinforce stable knowledge, let stale observations decay, surface contradictions, and generate insights no single session could produce. Each dream is scoped to a root node and filtered through a recipe lens — focused reasoning, not random association.

### Recipe-driven intelligence

Each agent gets a recipe — a cognitive template that shapes how the intelligence layer interprets its data. A personal assistant recipe watches for preference drift and behavioral patterns. A competitive intelligence recipe tracks strategic positioning and pricing sequences. The system selects the right recipe automatically based on the agent's soul and role description.

### Model-agnostic memory

TruContext is the memory layer, not the reasoning layer. Your agents can run on Claude, GPT, Gemini, open-source models — the knowledge graph persists across all of them. Switch models, keep the memory. Switch agents, keep the memory. The intelligence is in the graph.

---

## Automatic Agent Discovery

When you create a new agent in OpenClaw, trucontext-openclaw detects it on the next gateway start, provisions it with the right recipe, and injects the memory skill. Zero manual steps.

When you modify an agent's SOUL.md, the daily sync detects the change, re-provisions the agent, and generates an updated memory briefing that reflects the new identity. The graph evolves with the agent.

## Daily Maintenance

A daily cron handles two jobs:

1. **Version check** — updates the TC CLI if newer, refreshes the skill
2. **Soul drift** — if SOUL.md or AGENTS.md changed since last harvest, re-provisions the agent with a fresh memory briefing

Your graph stays in sync with how your agents evolve. No manual maintenance.

---

## Commands

```bash
trucontext-openclaw install          # First-time setup (auth + provision all agents)
trucontext-openclaw uninstall        # Remove TC integration (graph data preserved)
trucontext-openclaw provision        # Re-provision all agents
trucontext-openclaw provision <id>   # Re-provision one agent
trucontext-openclaw status           # Show current state
trucontext-openclaw sync             # Run daily maintenance now
```

## Uninstall

```bash
trucontext-openclaw uninstall
```

Removes the skill, AGENTS.md fragments, cron, and local state. Your TruContext graph data is preserved — nothing is deleted from TC's servers unless you explicitly request it through the dashboard.

---

## Requirements

- Node.js >= 22
- OpenClaw >= 2026.3.0
- TruContext account — [app.trucontext.ai](https://app.trucontext.ai) (free tier available)

## Documentation

- [TruContext Documentation](https://app.trucontext.ai/documentation)
- [TruContext CLI](https://www.npmjs.com/package/trucontext)
- [API Reference](https://app.trucontext.ai/documentation)

## License

MIT — see [LICENSE](LICENSE)
