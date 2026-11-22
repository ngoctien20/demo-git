// Generates n8n Workflow SDK code for "TIEN404 CONFIG MENU BRIDGE" from the tested pure libs.
// Usage: node config-core/n8n/build-bridge.mjs > config-core/n8n/bridge.sdk.js
import fs from 'node:fs';
import { ACTION_REGISTRY, HANDOFF_DEFAULT_ACK } from '../lib/action-registry.mjs';
const lib = (f) => fs.readFileSync(new URL('../lib/' + f, import.meta.url), 'utf8')
  .replace(/^import [^\n]*\n/gm, '').replace(/^export /gm, '')
  .split('\n').filter((l) => !/^\s*\/\//.test(l) && l.trim()).map((l) => l.replace(/^\s+/, '')).join('\n');
const bundle = [
  'const structuredClone = globalThis.structuredClone || ((x) => JSON.parse(JSON.stringify(x)));',
  // The bridge only needs action status + handoff wording (validation happens server-side on save/publish).
  'const ACTION_REGISTRY = ' + JSON.stringify(Object.fromEntries(Object.entries(ACTION_REGISTRY).map(([k, v]) => [k, { status: v.status }]))) + ';',
  'const HANDOFF_DEFAULT_ACK = ' + JSON.stringify(HANDOFF_DEFAULT_ACK) + ';',
  lib('channel-render.mjs'), lib('bot-bridge.mjs'),
  `// ---- main ----
const inp = $('Bridge input').first().json;
const res = $input.first().json || {};
const menu = res && Array.isArray(res.menu) && res.schema_version === 1 ? res : null;
const channel = String(inp.channel || 'messenger');
const d = decide(menu, { payload: inp.payload, text: inp.text }, channel);
return [{ json: { ...d, configVersion: menu ? menu.version_no : null, configSha: menu ? menu.config_sha256 : null,
  configSource: menu ? 'published' : (res && res.error ? 'read_failed' : 'none') } }];`,
].join('\n');
const SUPABASE_URL = 'https://ifxlvrhyjhbzbrkdsida.supabase.co';
const KEY = 'sb_publishable_e7L9qkumVD6Y57RSLaWsaQ_tRjF7OvF'; // public browser key (same as owner App)
const code = `import { workflow, node, trigger } from '@n8n/workflow-sdk';
const input = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger', version: 1.1,
  config: { name: 'Bridge input', position: [0, 0], parameters: { inputSource: 'workflowInputs',
    workflowInputs: { values: [{ name: 'channel', type: 'string' }, { name: 'accountId', type: 'string' }, { name: 'payload', type: 'string' }, { name: 'text', type: 'string' }] } } },
  output: [{ channel: 'messenger', accountId: '2379295362359912', payload: 'T404:M:catalog', text: '' }]
});
const readMenu = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.2,
  config: { name: 'Read published menu', position: [260, 0], onError: 'continueRegularOutput', alwaysOutputData: true,
    parameters: { method: 'POST', url: ${JSON.stringify(SUPABASE_URL + '/rest/v1/rpc/get_channel_menu')},
      sendHeaders: true, headerParameters: { parameters: [{ name: 'apikey', value: ${JSON.stringify(KEY)} }, { name: 'Content-Type', value: 'application/json' }] },
      sendBody: true, specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ p_channel: $json.channel, p_external_account_id: $json.accountId }) }}",
      options: { timeout: 3000 } } },
  output: [{ schema_version: 1, version_no: 1, greeting: 'Chào bạn', menu: [] }]
});
const bridge = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Decide from menu', position: [520, 0], parameters: { mode: 'runOnceForAllItems', jsCode: ${JSON.stringify(bundle)} } },
  output: [{ mode: 'legacy' }]
});
export default workflow('tien404-config-menu-bridge', 'TIEN404 CONFIG MENU BRIDGE — Messenger/Web đọc menu đã kích hoạt (DRAFT)')
  .add(input).to(readMenu).to(bridge);
`;
process.stdout.write(code);
