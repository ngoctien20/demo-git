// Deployment-only composition: private/legacy.mjs is supplied from the verified
// local live-source checkpoint at assembly time. It must never be committed or
// uploaded to a public repository. Public CI tests router.mjs with synthetic handlers.
import * as legacy from './private/legacy.mjs';
import * as candidate from '../src/worker.mjs';
import { createPilot } from './router.mjs';

const pilot = createPilot(legacy, candidate);
export const route = pilot.route;
export default { fetch: pilot.fetch };

