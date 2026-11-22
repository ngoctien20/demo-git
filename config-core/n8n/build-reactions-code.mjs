// Generate a credential-free, no-send n8n Code node from the tested pure reaction rules.
// Usage: node config-core/n8n/build-reactions-code.mjs > /tmp/social-reactions-qa.js
// Add to an isolated QA workflow only, NOT the published Messenger workflow.
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../lib/social-reactions.mjs', import.meta.url), 'utf8')
  .replace(/^export /gm, '');
const runner = [
  '// TIEN404 Social Reactions — DRY-RUN ONLY; NEVER SENDS TO META.',
  source,
  'return $input.all().map((item) => {',
  '  const input = item.json || {};',
  '  const decision = decideSocialReaction(input.event, input.gate);',
  '  const dryRun = decision.mode === "reaction_candidate" ? buildMetaReactionDryRun(decision) : null;',
  '  return { json: { decision, dryRun, metaCallExecuted: false } };',
  '});',
].join('\n');
process.stdout.write(runner);
