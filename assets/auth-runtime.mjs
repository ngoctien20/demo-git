// Browser-safe, bounded waits for Auth operations. Timed-out calls are NOT
// authorization successes; browser RLS/server must still decide all access.
export function withDeadline(operation, ms, label = 'AUTH_TIMEOUT') {
  let timer;
  return Promise.race([
    Promise.resolve(operation),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(label), { code:'AUTH_TIMEOUT' })), ms);
    })
  ]).finally(() => clearTimeout(timer));
}
export function isTimeout(error) {
  return error?.code === 'AUTH_TIMEOUT';
}
