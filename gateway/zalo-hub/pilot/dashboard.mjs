// The deployment tool includes only the built QA dashboard's public assets.
export function dashboardResponse(request, assets) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/qa-store/')) return null;
  if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405});
  const asset = assets[path.slice('/qa-store/'.length) || 'index.html'];
  if (!Array.isArray(asset)) return new Response(null,{status:404});
  const [type,base64]=asset;
  const headers={'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer','x-frame-options':'DENY',
    'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://ifxlvrhyjhbzbrkdsida.supabase.co; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
  if(request.method==='HEAD') return new Response(null,{headers});
  const zipped=Uint8Array.from(atob(base64),ch=>ch.charCodeAt(0));
  return new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip')),{headers});
}
