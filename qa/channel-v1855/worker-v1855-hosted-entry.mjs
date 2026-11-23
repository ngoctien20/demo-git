/**
 * V18.5.5 optional future Worker bundle entrypoint, source-only candidate.
 * Requires an approved SQLite Durable Object migration and binding:
 * T404_READ_ADMISSION -> T404ReadAdmission.
 * Never deploy on the existing V18.5.4 canary without explicit review/approval.
 */
import worker from './worker-v1855-readonly-adapter-candidate.mjs';
export { T404ReadAdmission } from './t404-read-admission-do.mjs';
export default worker;
