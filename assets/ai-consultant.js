const target=document.querySelector('#n8n-chat');
if(target){
  const chatPanel=document.getElementById('tien404-chat-panel');
  const launcher=document.getElementById('tien404-chat-launcher');
  const close=document.getElementById('tien404-chat-close');
  let opener=launcher;
  let started=false;

  const setOpen=(open,trigger)=>{
    chatPanel.hidden=!open;
    launcher.setAttribute('aria-expanded',String(open));
    if(!open){
      opener.focus({preventScroll:true});
      return;
    }
    opener=trigger;
    chatPanel.scrollTop=0;
    const composer=document.getElementById('tien404-composer');
    const focusTarget=composer.hidden ? close : document.getElementById('tien404-message');
    focusTarget.focus({preventScroll:true});
    if(!started){
      started=true;
      initializeChat();
    }
  };
  launcher.addEventListener('click',()=>setOpen(chatPanel.hidden,launcher));
  document.querySelectorAll('[data-tien404-open-chat]').forEach(button=>{
    button.addEventListener('click',()=>setOpen(true,button));
  });
  close.addEventListener('click',()=>setOpen(false));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!chatPanel.hidden)setOpen(false);
  });

  async function initializeChat(){
  let timer;
  const style=document.createElement('link');
  style.rel='stylesheet';
  style.href='https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css';
  const stylesLoaded=new Promise((resolve,reject)=>{
    style.onload=resolve;
    style.onerror=()=>reject(new Error('Chat stylesheet unavailable'));
  });
  document.head.insertBefore(style,document.head.firstChild);

  chatPanel?.setAttribute('aria-busy','true');
  try{
    const [sdk]=await Promise.race([
      Promise.all([import('https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js'),stylesLoaded]),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Chat load timeout')),10000)})
    ]);
    const {createChat}=sdk;
    createChat({
      webhookUrl:'https://ngoctien20.app.n8n.cloud/webhook/c29c6398-04d1-467f-ab23-8d679cdd7133/chat',
      target:'#n8n-chat',
      mode:'fullscreen',
      showWelcomeScreen:false,
      initialMessages:[
        'Xin chào! Bạn muốn hỏi về tính năng, chi phí hay cách dùng TIEN404 AI?'
      ],
      i18n:{
        en:{
          title:'TIEN404 AI',
          subtitle:'Trợ lý tư vấn trực tuyến',
          footer:'',
          getStarted:'Bắt đầu trò chuyện',
          inputPlaceholder:'Hỏi bất kỳ điều gì về TIEN404 AI...',
          closeButtonTooltip:'Đóng cửa sổ chat'
        }
      }
    });

    // Android dark-mode hardening: n8n chat can render its composer with
    // a light background while inheriting a light text color.
    // Scope the fix to the composer, not the conversation bubbles.
    const fixComposer=()=>{
      const root=document.querySelector('#n8n-chat');
      if(!root)return;
      const controls=root.querySelectorAll(
        '.chat-footer textarea, .chat-footer input, .chat-inputs textarea, .chat-inputs input, .chat-footer [contenteditable="true"]'
      );
      controls.forEach(el=>{
        el.style.setProperty('color','#172033','important');
        el.style.setProperty('-webkit-text-fill-color','#172033','important');
        el.style.setProperty('background-color','#ffffff','important');
        el.style.setProperty('caret-color','#5c3ac7','important');
        el.style.setProperty('color-scheme','light','important');
        el.style.setProperty('opacity','1','important');
      });
    };
    fixComposer();
    const observer=new MutationObserver(fixComposer);
    observer.observe(target,{childList:true,subtree:true});
    target.addEventListener('focusin',fixComposer);
    target.addEventListener('input',fixComposer);

    // Dedicated, accessible composer: keeps n8n's original message transport
    // and history, but replaces its visually broken Android text field.
    const externalForm=document.getElementById('tien404-composer');
    const externalInput=document.getElementById('tien404-message');
    const externalSend=document.getElementById('tien404-send');
    const externalStatus=document.getElementById('tien404-composer-status');
    let nativeInput=null;
    let nativeSend=null;
    let sending=false;
    const findNativeComposer=()=>{
      const footer=target.querySelector('.chat-footer');
      if(!footer)return false;
      const input=footer.querySelector('textarea, input:not([type="hidden"]), [contenteditable="true"]');
      const send=footer.querySelector('.chat-input-send-button, button[type="submit"], .chat-inputs button, button[aria-label*="Send"], button[title*="Send"]');
      if(!input||!send)return false;
      nativeInput=input;
      nativeSend=send;
      target.classList.add('tien404-custom-compose');
      externalForm.hidden=false;
      return true;
    };
    findNativeComposer();
    const composerObserver=new MutationObserver(()=>{if(!nativeInput?.isConnected||!nativeSend?.isConnected)findNativeComposer()});
    composerObserver.observe(target,{childList:true,subtree:true});
    externalForm.addEventListener('submit',async event=>{
      event.preventDefault();
      const message=externalInput.value.trim();
      if(!message||sending)return;
      if(!findNativeComposer()){
        externalStatus.textContent='Ô chat đang tải lại. Vui lòng thử sau ít giây.';
        return;
      }
      sending=true;
      externalSend.disabled=true;
      externalStatus.textContent='Đang chuyển tin nhắn...';
      try{
        if(nativeInput.isContentEditable){
          nativeInput.textContent=message;
          nativeInput.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:message}));
        }else{
          const descriptor=Object.getOwnPropertyDescriptor(
            nativeInput.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value'
          );
          descriptor.set.call(nativeInput,message);
          nativeInput.dispatchEvent(new Event('input',{bubbles:true}));
          nativeInput.dispatchEvent(new Event('change',{bubbles:true}));
        }
        // Give Vue's reactive input state a chance to update the send button.
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        if(!nativeSend.isConnected||nativeSend.disabled){
          externalStatus.textContent='Chưa thể gửi. Nội dung vẫn được giữ lại để bạn thử tiếp.';
          return;
        }
        nativeSend.click();
        externalStatus.textContent='';
        externalInput.value='';
        externalInput.focus({preventScroll:true});
      }catch(error){
        externalStatus.textContent='Không gửi được tin. Vui lòng thử lại.';
      }finally{
        sending=false;
        externalSend.disabled=false;
      }
    });
    externalInput.addEventListener('input',()=>{externalStatus.textContent=''});
    // Keyboard alternative to clicking send; plain Enter still allows composing text.
    externalInput.addEventListener('keydown',event=>{
      if(event.isComposing)return;
      if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){
        event.preventDefault();
        if(!sending)externalForm.requestSubmit();
      }
    });

    chatPanel?.setAttribute('aria-busy','false');
    document.documentElement.classList.add('tien404-chat-ready');
  }catch(e){
    chatPanel?.setAttribute('aria-busy','false');
    const note=document.querySelector('#n8n-chat-fallback');
    if(note)note.hidden=false;
    target.setAttribute('aria-label','Chat AI hiện không tải được; vui lòng thử bản mô phỏng.');
  }finally{
    clearTimeout(timer);
  }
  }
}