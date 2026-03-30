/**
 * TC-BRIEFING.md writer
 *
 * The single function that writes TC-BRIEFING.md. Called from every refresh
 * trigger: gateway_start, after_compaction, dream:memory-load webhook, daily cron.
 *
 * No conditional logic. No diffing. No caching. Fetch and overwrite.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import * as tcApi from './tc-api.js';
import { log } from './utils.js';

/**
 * Fetch the MLC briefing from TC and write TC-BRIEFING.md.
 *
 * @param {string} workspaceDir - Agent workspace directory
 * @param {string} appId - TC app ID
 * @param {string} agentRoot - TC agent root (agent_root from state)
 */
export async function refreshBriefing(workspaceDir, appId, agentRoot) {
  try {
    const res = await tcApi.getMemoryLoad(appId, agentRoot);
    const data = res?.data;

    let content;
    if (data?.status === 'ready') {
      const hotTopicsList = (data.hot_topics || [])
        .map(t => `- **${t.label}** (\`${t.slug}\`)${t.teaser ? `: ${t.teaser}` : ''}`)
        .join('\n');

      content = [
        '# Memory Briefing (TruContext)',
        `*Generated: ${data.generated_at}${data.heartbeat_cycle ? ` | Cycle: ${data.heartbeat_cycle}` : ''}*\n`,
        data.document,
        hotTopicsList ? `\n## Hot Topics Available\n${hotTopicsList}` : '',
        '\n---',
        '*Use `tc-memory recall "<query>"` for anything not covered above.*',
      ].filter(Boolean).join('\n');
    } else {
      content = '# Memory Briefing\n\nNo briefing available yet. Use `tc-memory recall` for live queries.\n';
    }

    writeFileSync(join(workspaceDir, 'TC-BRIEFING.md'), content);
    log.debug(`refreshBriefing: wrote TC-BRIEFING.md for ${agentRoot} in ${workspaceDir}`);
  } catch (err) {
    log.error(`refreshBriefing failed for ${agentRoot}: ${err.message}`);
  }
}
