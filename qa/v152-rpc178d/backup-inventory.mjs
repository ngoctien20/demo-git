/**
 * RPC17.8D — private OPERATOR-ONLY Supabase backup inventory.
 *
 * GET Management API backup metadata, never triggers restore, schema changes, or sends.
 * Not for GitHub Actions, public web pages or ChatGPT. No token, backup IDs,
 * customer content or raw response may enter logs/PRs.
 *
 * Backup-list success is NOT evidence of completed staging restore.
 */
const PROJECT = 'ifxlvrhyjhbzbrkdsida';
const ENDPOINT = `https://api.supabase.com/v1/projects/${PROJECT}/database/backups`;
const denied = (reason) => Object.freeze({
  status: 'BLOCKED',
  reason,
  project: PROJECT,
  can_migrate: false,
  can_restore: false,
  can_accept_real_jwt: false,
  can_send: false,
});
const cleanUtc = (value) => {
  if (typeof value !== 'string' || value.length > 50) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
};
export async function inspectBackupInventory(input = {}) {
  try {
    const { fetchImpl, token, endpoint = ENDPOINT } = input || {};
    if (typeof fetchImpl !== 'function') return denied('PRIVATE_FETCH_UNAVAILABLE');
    if (typeof token !== 'string' || token.length < 12 || token.length > 4096 ||
        /[\r\n\s]/.test(token)) return denied('PRIVATE_READ_TOKEN_REQUIRED');
    if (endpoint !== ENDPOINT) return denied('MANAGEMENT_ENDPOINT_NOT_ALLOWLISTED');
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!response || response.status !== 200) return denied('BACKUP_INVENTORY_NOT_CONFIRMED');
    const data = await response.json();
    if (!data || !Array.isArray(data.backups) || typeof data.pitr_enabled !== 'boolean')
      return denied('BACKUP_METADATA_INVALID');
    if (data.backups.length > 10000) return denied('BACKUP_METADATA_OUT_OF_BOUNDS');
    const valid = data.backups.every(x => x && Number.isSafeInteger(x.id) &&
      typeof x.is_physical_backup === 'boolean' &&
      ['COMPLETED','FAILED','PENDING','REMOVED','ARCHIVED','CANCELLED'].includes(x.status) &&
      cleanUtc(x.inserted_at));
    if (!valid) return denied('BACKUP_METADATA_INVALID');
    const completed = data.backups.filter(b => b.status === 'COMPLETED');
    const latest = completed.map(b=>cleanUtc(b.inserted_at)).sort().at(-1) ?? null;
    return Object.freeze({
      status: 'INVENTORY_OBSERVED_RESTORE_UNVERIFIED',
      project: PROJECT,
      completed_backup_count: completed.length,
      latest_completed_utc: latest,
      pitr_enabled: data.pitr_enabled,
      // No backup ID, token, raw response, endpoint header or customer details.
      can_migrate: false,
      can_restore: false,
      can_accept_real_jwt: false,
      can_send: false,
    });
  } catch {
    return denied('PRIVATE_BACKUP_READ_FAILED_CLOSED');
  }
}
export function defaultRecoveryDecision() { return denied('LIVE_RESTORE_EVIDENCE_MISSING'); }
