/* TIEN404 AI v4: browser-safe product sandbox and guided product experience.
 * No authentication, payments or order changes happen in this client.
 */
(()=>{
  'use strict';
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const params=new URLSearchParams(location.search);
  const text=(el,s)=>{if(el)el.textContent=String(s??'')};
  const money=(v)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(v);
  const clean=(value)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim();
  const safeQS=(str)=>encodeURIComponent(str);
  const conf=window.TIEN404_CONFIG||{};
  const apiBase=typeof conf.apiBase==='string'?conf.apiBase.replace(/\/$/,''):'';
  const canCheckBackend=!!apiBase || !/(^|\.)github\.io$/.test(location.hostname);

  const WIZARD_OPTIONS=[
    {title:'Bạn đang kinh doanh lĩnh vực gì?',desc:'Chúng mình sẽ chọn danh mục mẫu gần với ngành bạn làm.',key:'industry',options:[['fashion','Thời trang','Áo, quần, size và tồn kho'],['beauty','Mỹ phẩm','Serum, chăm sóc da, tư vấn'],['accessories','Phụ kiện','Sản phẩm nhỏ, nhiều mẫu'],['online','Bán hàng online','Danh mục đa ngành và giao hàng'],['services','Dịch vụ','Đặt lịch và phản hồi câu hỏi']]},
    {title:'Khách hàng thường liên hệ ở đâu?',desc:'Đây là lựa chọn kênh mong muốn, không phải một kết nối đang hoạt động.',key:'channel',options:[['facebook','Facebook Messenger','Hội thoại trên fanpage'],['zalo','Zalo','Hỗ trợ và tư vấn'],['website','Website','Chat trực tiếp trên website'],['multiple','Nhiều kênh','Tổng hợp và chuyển tiếp']]},
    {title:'Bạn muốn giải quyết vấn đề nào trước?',desc:'Tập trung vào một quy trình rõ ràng để AI dễ được kiểm thử.',key:'pain',options:[['faq','Trả lời tin nhắn lặp lại','Giảm thao tác tư vấn thủ công'],['product','Tìm kiếm sản phẩm','Lọc theo giá, loại và tồn kho'],['orders','Tiếp nhận yêu cầu mua','Không thay đổi đơn hàng thật'],['handoff','Chuyển tiếp nhân viên','Biết khi nào AI nên dừng']]}
  ];
  const labels={fashion:'Shop thời trang',beauty:'Shop mỹ phẩm',accessories:'Shop phụ kiện',online:'Cửa hàng online',services:'Doanh nghiệp dịch vụ',facebook:'Messenger',zalo:'Zalo',website:'Website',multiple:'Nhiều kênh',faq:'FAQ & phản hồi',product:'Tìm sản phẩm',orders:'Yêu cầu mua',handoff:'Nhân viên hỗ trợ'};
  const defaults={
    fashion:[['A001','Áo thun đen size L',159000,12],['A002','Áo trắng cotton size M',189000,8],['A003','Quần jean xanh',430000,4],['A004','Áo khoác bomber',790000,0]],
    beauty:[['B101','Serum vitamin C 30ml',320000,8],['B102','Sữa rửa mặt dịu nhẹ',180000,15],['B103','Kem chống nắng SPF50',275000,3],['B104','Kem dưỡng da',420000,0]],
    accessories:[['C201','Túi đeo chéo mini',290000,7],['C202','Ví da basic',220000,10],['C203','Dây đồng hồ',190000,2],['C204','Kính mát classic',650000,0]],
    online:[['D301','Áo thể thao basic',240000,12],['D302','Bình nước 650ml',130000,20],['D303','Túi đựng laptop',410000,5],['D304','Đèn để bàn LED',360000,0]],
    services:[['S401','Gói tư vấn cơ bản',350000,10],['S402','Lịch hẹn chuyên sâu',650000,5],['S403','Gói chăm sóc định kỳ',900000,4],['S404','Dịch vụ ngoài giờ',450000,0]]
  };

  function initWizard(){
    const wrapper=$('[data-v4-wizard]');if(!wrapper)return;
    const stage=$('#v4-wizard-stage'),count=$('#v4-step-count'),fill=$('#v4-wizard-fill'),back=$('#v4-back'),next=$('#v4-next');
    let step=0;const selected={industry:'',channel:'',pain:''};
    function render(){
      stage.replaceChildren();
      text(count,`BƯỚC 0${step+1} / 04`);fill.style.width=`${(step+1)*25}%`;
      $$('[data-v4-step-marker]').forEach((el,i)=>el.classList.toggle('active',i===step));
      back.disabled=step===0;text(next,step===3?'Mở AI Sales Lab →':'Tiếp tục →');
      if(step===3){
        const h=document.createElement('h3');h.className='v4-wizard-title';h.textContent='Đây là kịch bản dành cho shop của bạn.';stage.append(h);
        const p=document.createElement('p');p.className='v4-muted';p.textContent='Chúng mình đã chuẩn bị một danh mục mẫu và tình huống thử phù hợp với lựa chọn của bạn.';stage.append(p);
        const summary=document.createElement('div');summary.className='v4-wizard-summary';
        for(const [k,tag] of [['industry','NGÀNH'],['channel','KÊNH'],['pain','MỤC TIÊU']]){const row=document.createElement('div'),l=document.createElement('span'),v=document.createElement('strong');l.textContent=tag;v.textContent=labels[selected[k]]||'—';row.append(l,v);summary.append(row)}
        stage.append(summary);
        const note=document.createElement('p');note.className='v4-note-small';note.textContent='Đây chỉ là bản xem thử. Kênh Messenger/Zalo và sản phẩm thật chưa được kết nối.';stage.append(note);
        return;
      }
      const spec=WIZARD_OPTIONS[step];const h=document.createElement('h3');h.className='v4-wizard-title';h.textContent=spec.title;stage.append(h);
      const p=document.createElement('p');p.className='v4-muted';p.textContent=spec.desc;stage.append(p);
      const choices=document.createElement('div');choices.className='v4-choices';
      spec.options.forEach(([v,label,sub])=>{
        const b=document.createElement('button');b.type='button';b.className='v4-choice';b.setAttribute('aria-pressed',String(selected[spec.key]===v));
        const title=document.createElement('strong');title.textContent=label;const detail=document.createElement('small');detail.textContent=sub;const tick=document.createElement('span');tick.textContent='↗';
        b.append(title,detail,tick);b.addEventListener('click',()=>{selected[spec.key]=v;$$('.v4-choice',choices).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});choices.append(b);
      });stage.append(choices);
    }
    next?.addEventListener('click',()=>{
      if(step===3){location.href=`lab.html?industry=${safeQS(selected.industry)}&channel=${safeQS(selected.channel)}&pain=${safeQS(selected.pain)}`;return;}
      if(!selected[WIZARD_OPTIONS[step].key]){const b=$('.v4-choice',stage);b?.focus();return;}
      step++;render();
    });back?.addEventListener('click',()=>{if(step>0){step--;render();}});render();
  }

  function initLab(){
    const chatForm=$('#v4-chat-form');if(!chatForm)return;
    const industry=Object.hasOwn(defaults,params.get('industry'))?params.get('industry'):'fashion';
    const productList=$('#v4-product-list'),form=$('#v4-product-form'),messages=$('#v4-chat-messages'),chatInput=$('#v4-chat-input');
    let products=defaults[industry].map(([sku,name,price,stock])=>({sku,name,price,stock}));
    let chatHistory=[],count=0,online=false,busy=false,mode='local';const maxCount=20;
    const capability=$('#v4-capability-text'),alertBox=$('#v4-lab-alert'),aiRadio=$('input[name="v4-mode"][value="ai"]'),consent=$('#v4-ai-consent'),consentBox=$('#v4-ai-consent-wrap');
    function showProductList(){
      productList.replaceChildren();text($('#v4-products-count'),`${products.length} sản phẩm`);
      products.forEach((p,i)=>{const row=document.createElement('div');row.className='v4-product-row';
        const info=document.createElement('div');const sku=document.createElement('small');sku.textContent=p.sku;const strong=document.createElement('strong');strong.textContent=p.name;const price=document.createElement('span');price.textContent=money(p.price);info.append(sku,strong,price);
        const right=document.createElement('div');right.className='v4-product-right';const stock=document.createElement('span');stock.className=p.stock?'v4-instock':'v4-outstock';stock.textContent=p.stock?`Còn ${p.stock}`:'Hết hàng';const del=document.createElement('button');del.type='button';del.className='v4-mini-remove';del.textContent='×';del.setAttribute('aria-label',`Xóa ${p.name}`);del.addEventListener('click',()=>{products.splice(i,1);showProductList();});right.append(stock,del);
        row.append(info,right);productList.append(row);
      });
    }
    function addBubble(message,who='assistant'){
      const item=document.createElement('div');item.className=`v4-bubble v4-bubble--${who}`;
      const label=document.createElement('small');label.textContent=who==='user'?'Bạn':'TIEN404 AI · '+(mode==='ai'?'Sandbox AI':'Mô phỏng');
      const body=document.createElement('div');body.textContent=message;item.append(label,body);messages.append(item);messages.scrollTop=messages.scrollHeight;
    }
    function markProcess(steps,status,detail){$$('[data-v4-process]').forEach(x=>x.classList.toggle('is-current',steps.includes(x.dataset.v4Process)));text($('#v4-process-result'),status);text($('#v4-process-sub'),detail);}
    function findBudget(raw){const m=raw.match(/(?:dưới|duoi|tầm|tam|khoảng|khoang|không quá|toi da|max|<=|\bunder\b)\s*(\d[\d.,]*)\s*(triệu|trieu|tr|nghìn|nghin|ngàn|ngan|k|đ|vnd)?/i);if(!m)return 0;const n=Number(m[1].replace(/\./g,'').replace(/,/g,''));if(!Number.isFinite(n))return 0;const unit=clean(m[2]||'');if(unit==='k'||unit.startsWith('ngh')||unit.startsWith('nga'))return n*1000;if(unit==='tr'||unit.startsWith('tri'))return n*1000000;return n<10000?n*1000:n;}
    function matchProduct(raw){const w=clean(raw);let exact=products.find(p=>w.includes(clean(p.sku)));if(exact)return exact;let candidates=products.map(p=>({p,match:clean(p.name).split(/\s+/).filter(token=>token.length>=3&&w.includes(token)).length})).sort((a,b)=>b.match-a.match);return candidates[0]?.match>=2?candidates[0].p:null;}
    function localReply(raw){
      const q=clean(raw),budget=findBudget(raw);
      if(/(mat khau|api key|token|secret)/i.test(q)){markProcess(['receive'],'Không cần thông tin bí mật','Hãy bỏ thông tin nhạy cảm.');return 'Vui lòng không gửi mật khẩu, API key hay dữ liệu khách thật. Đây chỉ là phòng thử nghiệm.';}
      if(/(nhan vien|nguoi that|ho tro|tu van vien)/i.test(q)){markProcess(['receive','handoff'],'Yêu cầu chuyển nhân viên — mô phỏng','Không gửi tin nhắn đến người thật.');return 'Mình đã nhận diện yêu cầu gặp nhân viên (mô phỏng). Trong hệ thống thật, cần chuyển đúng người phụ trách và xác nhận đã tiếp nhận. Bạn có thể gửi yêu cầu tư vấn qua website khi backend được kết nối.';}
      const selected=matchProduct(raw);
      if(/(dat|mua|lay|chot|tao don)/i.test(q)&&selected){let qm=q.match(/\b(\d{1,3})\s*(?:cai|chiec|san pham|ao|lo|hop|bo)?\b/i);let qty=qm?Math.min(100,Math.max(1,Number(qm[1]))):1;
        markProcess(['receive','lookup','respond','handoff'],'Yêu cầu mua — mô phỏng','Chưa trừ kho hoặc lưu đơn thật.');
        if(!selected.stock)return `${selected.name} hiện hết hàng trong danh mục mẫu. Chưa có đơn được tạo.`;
        if(qty>selected.stock)return `${selected.name} chỉ còn ${selected.stock} sản phẩm mẫu. Bạn muốn chọn số lượng nhỏ hơn không? Không có đơn nào được tạo.`;
        return `YÊU CẦU MUA GIẢ LẬP\n• ${selected.name} (${selected.sku}) × ${qty}\n• Đơn giá: ${money(selected.price)}\n• Tổng minh họa: ${money(selected.price*qty)}\n• Bước tiếp theo: nhân viên xác minh thông tin trước khi xác nhận.\nKhông tạo đơn hoặc trừ kho thật.`;
      }
      if(/(don hang|van don|doi dia chi|sua dia chi|cap nhat don)/i.test(q)){markProcess(['receive','handoff'],'Cần xác thực trước khi xử lý','Không truy cập đơn hàng thật.');return 'Demo không tra cứu, sửa hay tạo đơn hàng thật. Với đơn đã tồn tại, nhân viên cần xác thực khách và duyệt thay đổi trước khi AI thực hiện hành động.';}
      let matched=budget?products.filter(p=>p.price<=budget&&p.stock>0):products.filter(p=>p.stock>0);
      if(selected)matched=products.filter(p=>p===selected);
      markProcess(['receive','lookup','respond'],'Đã tra cứu danh mục mẫu',`${matched.length} sản phẩm phù hợp.`);
      if(!products.length)return 'Danh mục mẫu đang trống. Hãy thêm sản phẩm ở cột bên trái để thử.';
      if(!matched.length)return budget?`Chưa có sản phẩm còn hàng dưới ${money(budget)} trong danh mục mẫu. Bạn thử tăng ngân sách nhé.`:'Chưa tìm được sản phẩm phù hợp. Bạn có thể hỏi theo SKU hoặc ngân sách.';
      const rows=matched.slice(0,6).map(p=>`• ${p.name} (${p.sku}): ${money(p.price)} — ${p.stock>0?`Còn ${p.stock}`:'Hết hàng'}`).join('\n');
      return `Theo danh mục MẪU của cửa hàng:\n${rows}\nBạn muốn tìm theo ngân sách, mã SKU hay tạo yêu cầu mua giả lập?`;
    }
    function setMode(value){mode=value;chatHistory=[];messages.replaceChildren();text($('#v4-chat-subtitle'),value==='ai'?'AI thật · Sandbox API, không lưu đơn':'Kịch bản mô phỏng · Sandbox');consentBox.hidden=value!=='ai';
      text(alertBox,value==='ai'?'AI thật chỉ nhận danh mục và câu hỏi thử; không gửi dữ liệu khách thật. Hãy xác nhận đồng ý trước khi gửi.':'Mô phỏng cục bộ, dữ liệu danh mục không rời trình duyệt.');
      addBubble(value==='ai'?'Bạn đã chọn AI thật trong sandbox. Không nhập dữ liệu khách thật hoặc bí mật.':'Xin chào! Mình đang dùng sản phẩm và tồn kho GIẢ LẬP. Hãy hỏi thử về giá, tồn kho hoặc một yêu cầu mua mẫu.');markProcess([],'Sẵn sàng nhận yêu cầu','Không có đơn hàng thật được tạo.');}
    async function sendMessage(raw){const message=raw.trim().slice(0,400);if(!message||busy)return;
      if(count>=maxCount){text(alertBox,'Phiên thử đạt giới hạn 20 lượt. Hãy tải lại trang để bắt đầu phiên demo mới.');return;}
      if(mode==='ai'&&!consent.checked){text(alertBox,'Hãy đồng ý chia sẻ danh mục và câu hỏi MẪU với máy chủ thử nghiệm trước khi bật AI thật.');consent.focus();return;}
      chatInput.value='';count++;text($('#v4-chat-remaining'),`${maxCount-count} lượt thử còn lại`);addBubble(message,'user');busy=true;
      const submit=$('.v4-send');submit.disabled=true;
      try{
        let reply;
        if(mode==='ai'){
          const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
          try{const response=await fetch(`${apiBase}/api/ai/chat`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',signal:controller.signal,body:JSON.stringify({message,products:products.map(({sku,name,price,stock})=>({sku,name,price,stock})),history:chatHistory.slice(-6),industry,consent:true})});
            if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(typeof data.detail==='string'?data.detail:'Máy chủ AI thử nghiệm không phản hồi.');}
            const data=await response.json();if(typeof data.reply!=='string'||!data.reply.trim())throw new Error('Phản hồi AI không hợp lệ.');reply=data.reply.slice(0,1500);
            markProcess(['receive','lookup','respond'],'Phản hồi từ AI sandbox','Không chạy công cụ tạo/sửa đơn hàng.');
          }finally{clearTimeout(timer)}
        }else{reply=localReply(message);}
        addBubble(reply);chatHistory.push({role:'user',content:message},{role:'assistant',content:reply});chatHistory=chatHistory.slice(-8);
      }catch(err){addBubble(`Không thể xử lý yêu cầu AI thử nghiệm: ${err.name==='AbortError'?'Đã hết thời gian chờ.':err.message} Vui lòng chọn chế độ mô phỏng cục bộ để tiếp tục.`);markProcess([],'Backend chưa sẵn sàng','Không gửi đơn hàng hay lưu dữ liệu.');}
      finally{busy=false;submit.disabled=false;chatInput.focus();}
    }
    form.addEventListener('submit',(ev)=>{ev.preventDefault();const d=new FormData(form);const name=String(d.get('name')||'').trim(),sku=String(d.get('sku')||'').toUpperCase().trim(),price=Number(d.get('price')),stock=Number(d.get('stock'));const error=$('#v4-product-error');
      if(products.length>=10){text(error,'Danh mục thử tối đa 10 sản phẩm. Xóa một sản phẩm trước.');return;}
      if(name.length<2||!/^[A-Z0-9_-]{2,16}$/.test(sku)||products.some(p=>p.sku===sku)||!Number.isInteger(price)||price<0||price>100000000||!Number.isInteger(stock)||stock<0||stock>10000){text(error,'Kiểm tra tên, SKU không trùng, giá và số lượng tồn kho hợp lệ.');return;}
      products.push({name,sku,price,stock});showProductList();form.reset();text(error,'Đã thêm vào danh mục giả lập.');
    });
    $('#v4-reset-products')?.addEventListener('click',()=>{products=defaults[industry].map(([sku,name,price,stock])=>({sku,name,price,stock}));showProductList();text($('#v4-product-error'),'Đã khôi phục dữ liệu mẫu.');});
    $$('[name="v4-mode"]').forEach(radio=>radio.addEventListener('change',()=>{if(radio.checked)setMode(radio.value)}));
    $$('[data-v4-prompt]').forEach(b=>b.addEventListener('click',()=>sendMessage(b.dataset.v4Prompt)));
    chatForm.addEventListener('submit',e=>{e.preventDefault();sendMessage(chatInput.value)});
    $('#v4-chat-clear')?.addEventListener('click',()=>{count=0;chatHistory=[];text($('#v4-chat-remaining'),`${maxCount} lượt thử còn lại`);setMode(mode)});
    showProductList();setMode('local');
    if(canCheckBackend){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);
      fetch(`${apiBase}/api/ai/capabilities`,{signal:controller.signal,credentials:'omit'})
        .then(r=>r.ok?r.json():null).then(data=>{online=data?.enabled===true;aiRadio.disabled=!online;text(capability,online?'AI backend QA đã được kết nối · tùy chọn AI thật có sẵn':'AI backend chưa kết nối · đang dùng mô phỏng an toàn');})
        .catch(()=>text(capability,'Chế độ mô phỏng đang sẵn sàng · AI backend chưa kết nối')).finally(()=>clearTimeout(timer));
    }else{text(capability,'Chế độ mô phỏng sẵn sàng · GitHub Pages chưa kết nối AI backend');}
  }

  function initImpact(){const hours=$('#v4-hours-result');if(!hours)return;
    const ids=['messages','minutes','repeat','hourly'];const controls=Object.fromEntries(ids.map(k=>[k,$('#v4-'+k)]));
    function update(){const messages=+controls.messages.value,minutes=+controls.minutes.value,share=+controls.repeat.value,hourly=+controls.hourly.value;
      text($('#v4-messages-value'),new Intl.NumberFormat('vi-VN').format(messages));text($('#v4-minutes-value'),minutes);text($('#v4-repeat-value'),share+'%');text($('#v4-hourly-value'),money(hourly));
      const total=messages*minutes/60,repeat=total*share/100; text(hours,total.toLocaleString('vi-VN',{maximumFractionDigits:1}));text($('#v4-repeat-result'),repeat.toLocaleString('vi-VN',{maximumFractionDigits:1})+' giờ');text($('#v4-cost-result'),money(repeat*hourly));$('#v4-repeat-bar').style.width=share+'%';
    }Object.values(controls).forEach(el=>el.addEventListener('input',update));update();
  }
  function initDashboard(){if(!document.body.hasAttribute('data-v4-dashboard'))return;
    const chart=$('#v4-dash-bars'),queue=$('#v4-dash-queue');if(!chart||!queue)return;
    const samples={week:[14,25,20,38,34,42,29],month:[24,27,35,30,45,41,39,51,60,55,57,45,43,48,63]};
    const queueData=[['#DEMO-103','Khách hỏi đổi địa chỉ','Cần xác minh'],['#DEMO-104','Khách hỏi đổi trả','Chờ nhân viên'],['#DEMO-105','Tư vấn mẫu hết hàng','Cần hỗ trợ']];
    function render(period){chart.replaceChildren();let data=samples[period],max=Math.max(...data);data.forEach((value,i)=>{const wrap=document.createElement('div');wrap.className='v4-bar-wrap';const bar=document.createElement('div');bar.className='v4-chart-bar';bar.style.height=(value/max*100)+'%';bar.setAttribute('title',`${value} hội thoại MẪU`);const small=document.createElement('small');small.textContent=period==='week'?['T2','T3','T4','T5','T6','T7','CN'][i]:String(i*2+1);wrap.append(bar,small);chart.append(wrap)});
      queue.replaceChildren();queueData.forEach(([id,subject,status])=>{const el=document.createElement('div');el.className='v4-queue-row';const a=document.createElement('div'),b=document.createElement('b'),span=document.createElement('span'),state=document.createElement('small');b.textContent=id;span.textContent=subject;state.textContent=status;a.append(b,span);el.append(a,state);queue.append(el)});
      $$('[data-v4-period]').forEach(b=>b.classList.toggle('active',b.dataset.v4Period===period));
    }$$('[data-v4-period]').forEach(b=>b.addEventListener('click',()=>render(b.dataset.v4Period)));render('week');
  }
  initWizard();initLab();initImpact();initDashboard();
})();