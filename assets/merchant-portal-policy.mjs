// TIEN404 V12.2 UI-only access policy; DB RLS remains the authority.
export const PANEL_IDS=Object.freeze([
  'overview','products','orders','customers','care','bots','reports',
  'subscriptions','help','settings'
]);
const managerPanels=new Set(['orders','customers','care','bots','reports']);
export function mayOpenPanel(role,view) {
  if(!PANEL_IDS.includes(view)) return false;
  if(!['owner','manager','staff'].includes(role)) return false;
  return !managerPanels.has(view)||role==='owner'||role==='manager';
}
export function selectAuthorizedShop(shops,requestedId) {
  if(!Array.isArray(shops)||!shops.length)return null;
  if(typeof requestedId!=='string')return shops[0];
  return shops.find(shop=>shop?.id===requestedId)||null;
}
export function ownsScope(current,tenantId) {
  return Boolean(current && typeof current.id==='string' && current.id===tenantId);
}
