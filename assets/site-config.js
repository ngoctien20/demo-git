/* Public configuration only; NEVER insert secrets here.
 * supabaseKey is the Supabase *publishable* key (safe for browsers; access is enforced by RLS and
 * SECURITY DEFINER RPC checks). Never put a service_role or secret key in this file. */
window.TIEN404_CONFIG = Object.freeze({
  apiBase: '',
  appUrl: 'app/',
  supabaseUrl: 'https://ifxlvrhyjhbzbrkdsida.supabase.co',
  supabaseKey: 'sb_publishable_e7L9qkumVD6Y57RSLaWsaQ_tRjF7OvF',
  chatWebhook: 'https://ngoctien20.app.n8n.cloud/webhook/c29c6398-04d1-467f-ab23-8d679cdd7133/chat'
});
