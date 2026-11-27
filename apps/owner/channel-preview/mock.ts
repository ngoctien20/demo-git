// Only imported by the isolated preview build. No network requests.
type Person = 'old' | 'second' | 'new' | 'staff';
type EventListener = (event: string, session: ReturnType<typeof session>) => void;
const listeners = new Set<EventListener>();
const current = () => sessionStorage.getItem('qa_actor') as Person | null;
const session = () => current() ? {user:{id:current(), email:'tài khoản QA'}} : null;
function emit(event: string) { listeners.forEach(fn => fn(event, session())); }
const stores = [
  {id:'QA-A', tenant_id:'TA', name:'Tiệm Mây', is_default:true},
  {id:'QA-B', tenant_id:'TB', name:'Vải Mộc', is_default:false},
];
function rows() {
  const name = sessionStorage.getItem('qa_new_shop');
  return name ? [...stores, {id:'QA-C',tenant_id:'TC',name,is_default:true}] : stores;
}
export function finish(person: Person | null) {
  if(person) sessionStorage.setItem('qa_actor',person);
  else sessionStorage.removeItem('qa_actor');
  emit(person ? 'SIGNED_IN' : 'SIGNED_OUT');
}
const unavailable = async () => ({error:new Error('Chỉ dùng tài khoản QA trong bản xem trước.')});
export const appUrl = () => location.origin + location.pathname;
export const friendlyError = () => 'Hãy dùng nút Google mô phỏng và chọn một tài khoản QA.';
export const callbackStatus = Promise.resolve('');
export const supabase = {
  auth:{
    onAuthStateChange(fn: EventListener) {
      listeners.add(fn); queueMicrotask(()=>fn('INITIAL_SESSION',session()));
      return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};
    },
    async signInWithOAuth() { window.dispatchEvent(new Event('qa:accounts')); return {error:null}; },
    async signOut() {finish(null);},
    signInWithPassword:unavailable, signUp:unavailable, resetPasswordForEmail:unavailable, updateUser:unavailable,
  },
  from(table:string) {
    const person=current();
    const roles:Record<string,Record<string,string>>={old:{'QA-A':'owner','QA-B':'manager'},second:{'QA-B':'owner'},staff:{'QA-A':'staff'},new:{'QA-C':'owner'}};
    const mine=rows().filter(row=>person && roles[person]?.[row.id]);
    const data=table==='stores'?mine:table==='tenants'?mine.map(s=>({id:s.tenant_id,name:s.name,industry:'retail'})):
      mine.map(s=>({store_id:s.id,tenant_id:s.tenant_id,role:roles[person!][s.id]}));
    const result={data,error:null,select:()=>result,eq:()=>result,order:()=>result};return result;
  },
  async rpc(_:string, body:{p_name:string}) {
    if(current()!=='new' || sessionStorage.getItem('qa_new_shop'))return {error:new Error('already')};
    sessionStorage.setItem('qa_new_shop',body.p_name);return {error:null};
  },
};
