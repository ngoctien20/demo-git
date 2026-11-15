// Browser-only UI preview; do not turn this into a provider sender or trusted API.
const $=id=>document.getElementById(id);
const modes=Object.freeze({BOT:'ZALO_BOT_CREATOR',OA:'ZALO_OA'});
let mode=modes.BOT;
let actions=[];
let menuTitle='Bot cửa hàng — Xin chào!';
const setText=(id,text)=>{$(id).textContent=text;};
function actionButton(action){
  const b=document.createElement('button');
  b.type='button';
  b.className='action';
  b.dataset.actionId=action.action_id;
  b.textContent=mode===modes.BOT
    ?'Thử chọn '+action.fallback_command+' · '+action.label
    :action.label;
  b.addEventListener('click',()=>{
    // UI preview is untrusted. No network, subscription, customer info or order writes.
    const isRead=action.action_type==='READ';
    const marker=isRead?'READ_PREVIEW_ONLY':'DRAFT_PREVIEW_ONLY';
    const explanation=isRead?'Chỉ xem trước hành động, chưa truy vấn dữ liệu shop.':
      'Chỉ xem yêu cầu. Cần xác minh quyền và xác nhận ở backend trước khi ghi.';
    setText('selectionResult',
      'Đã chọn: '+action.label+'\nAction ID: '+action.action_id+
      '\nLệnh văn bản: '+action.fallback_command+
      '\nTrạng thái: '+marker+'\n'+explanation);
  });
  return b;
}
function render(){
  const bot=mode===modes.BOT;
  $('modeBot').setAttribute('aria-pressed',String(bot));
  $('modeOa').setAttribute('aria-pressed',String(!bot));
  const text=bot?[menuTitle,...actions.map(a=>a.fallback_command+' — '+a.label),
    'Nhắn số tương ứng hoặc mô tả nhu cầu bằng tiếng Việt.'].join('\n'):
    menuTitle+'\nCác nút phía dưới chỉ dùng để xem trước UI OA.';
  setText('messageText',text);
  setText('modeNote',bot
    ?'Bot Creator: bên dưới là các nút nhấn CHỈ TRONG DEMO. Tin nhắn Zalo thật là menu chữ, không có nút này.'
    :'Zalo OA: nút nhấn là MOCK, chưa gửi qua OA API hay xác thực callback.');
  const area=$('buttonArea');area.replaceChildren();
  for(const action of actions)area.append(actionButton(action));
  setText('selectionResult','Hãy thử chọn một mục. Tất cả thao tác ở chế độ mô phỏng, không gửi dữ liệu.');
}
$('modeBot').addEventListener('click',()=>{mode=modes.BOT;render();});
$('modeOa').addEventListener('click',()=>{mode=modes.OA;render();});
async function init(){
  try{
    const response=await fetch('../../sales-lite/v131/menu-registry.json',{method:'GET',cache:'no-store'});
    if(!response.ok)throw Error('MENU_FETCH_FAILED');
    const source=await response.json();
    if(source?.menu_version!=='1.1.0'||source.send_enabled!==false||
       source.order_write_enabled!==false||source.subscription_write_enabled!==false)throw Error('REGISTRY_UNSAFE');
    const item=source.menus?.find(m=>m.actor_role==='CUSTOMER');
    if(!item||!Array.isArray(item.actions))throw Error('CUSTOMER_MENU_MISSING');
    const chosen=item.actions.filter(a=>a.enabled===true&&a.actor_role==='CUSTOMER');
    const seen=new Set(),numbers=new Set();
    if(chosen.length<1||chosen.length>9)throw Error('ACTION_COUNT_UNSAFE');
    for(const a of chosen){
      if(!/^[A-Z][A-Z0-9_]{2,63}$/.test(a.action_id||'')||
         !/^[1-9][0-9]?$/.test(a.fallback_command||'')||
         !Array.isArray(a.required_permissions)||seen.has(a.action_id)||numbers.has(a.fallback_command)||
         typeof a.label!=='string'||a.label.length>72||
         !a.channel_support?.includes('ZALO_BOT_TEXT'))throw Error('ACTION_CONTRACT_UNSAFE');
      seen.add(a.action_id);numbers.add(a.fallback_command);
    }
    menuTitle=String(item.title||'Bot cửa hàng — Xin chào!');
    actions=chosen;
    render();
  }catch{
    actions=[];
    setText('messageText','Chưa thể tải menu đã xác minh. Không hiển thị nút thử nghiệm.');
    setText('selectionResult','BLOCKED: Dữ liệu menu hoặc hợp đồng QA không hợp lệ.');
    $('buttonArea').replaceChildren();
    $('modeOa').disabled=true;
  }
}
init();
