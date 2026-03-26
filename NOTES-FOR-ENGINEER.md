# Notes for Engineer

## Bug Fix: ## Memory header collision (inject.js)

**Problem:** TC API returns prompt fragments with `## Memory` as the header. OpenClaw agent workspaces often have existing `## Memory` sections (for session notes). This causes the injected TC block to merge with the existing section rather than append cleanly.

**Fix in `src/inject.js`:** The `injectFragment()` function now normalizes `## Memory` → `## TruContext Memory` before writing, and uses `## TruContext Memory` as the managed block marker. The HTML comment end-marker is unchanged.

**Request for TC server-side:** Consider returning `## TruContext Memory` as the fragment header from `/v1/apps/{appId}/agents/provision` to make this normalization unnecessary in future versions.

## Bug: Re-provision requires soul even on delta sends

**Problem:** When re-provisioning with only changed files (delta harvest), the server returns 400 "content.soul is required" if soul file wasn't modified. Soul should be optional on re-provision — or the endpoint should fetch the existing soul from the graph.

**Current workaround:** Force full harvest on re-provision.
