// Prints {template_key: config} so the UAT can compare the SQL seed with the JS source.
import { TEMPLATES } from '../../config-core/lib/templates.mjs';
import { ACTION_REGISTRY } from '../../config-core/lib/action-registry.mjs';
const which = process.argv[2];
if (which === 'registry') console.log(JSON.stringify(Object.fromEntries(Object.entries(ACTION_REGISTRY).map(([k, v]) => [k, v.status]))));
else console.log(JSON.stringify(Object.fromEntries(Object.entries(TEMPLATES).map(([k, v]) => [k, v.config]))));
