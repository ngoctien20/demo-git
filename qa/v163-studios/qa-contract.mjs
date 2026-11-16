/** TIEN404 V16.3 QA contract — local synthetic only, never authorize actual users or shops. */
export const STAGE='T404_V163_LOCAL_SYNTHETIC_NO_SEND';
export const TIERS=Object.freeze(['Economy','Standard','Priority']);
export const assert=(ok,why)=>{if(!ok)throw Error(why);};
export const qaId=(x)=>typeof x==='string'&&/^QA_[A-Z0-9_]{1,36}$/.test(x);
export function qaContext(ctx,allowed=['owner','manager','reviewer','staff','system']){
  assert(ctx&&typeof ctx==='object'&&!Array.isArray(ctx),'QA_CONTEXT_REQUIRED');
  assert(exact(ctx,['stage','enrolled','tenant_id','store_id','actor_id','role']),'QA_CONTEXT_EXTRA_FIELD_DENIED');
  assert(ctx.stage===STAGE&&ctx.enrolled===true,'INDEPENDENT_QA_IDENTITY_REQUIRED');
  assert(qaId(ctx.tenant_id)&&qaId(ctx.store_id)&&qaId(ctx.actor_id),'QA_SCOPE_REQUIRED');
  assert(allowed.includes(ctx.role),'QA_ROLE_DENIED');
  return {tenant_id:ctx.tenant_id,store_id:ctx.store_id,actor_id:ctx.actor_id,role:ctx.role};
}
export function qaScope(ctx){const v=qaContext(ctx);return v.tenant_id+'\u0000'+v.store_id;}
export function sameStore(a,b){return a.tenant_id===b.tenant_id&&a.store_id===b.store_id;}
export function exact(v,fields){return !!v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k));}
export function positiveInt(x){return Number.isSafeInteger(x)&&x>=0;}
export function qaEvent(x){assert(qaId(x),'QA_EVENT_ID_REQUIRED');return x;}
export const noLive=(action)=>{throw Error('NO_LIVE_'+action+'_V163');};
