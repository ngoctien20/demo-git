(() => {
  'use strict';
  const navButton = document.getElementById('nav-toggle');
  const menu = document.getElementById('main-menu');
  if (navButton && menu) {
    navButton.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('open');
      navButton.setAttribute('aria-expanded', String(isOpen));
      navButton.setAttribute('aria-label', isOpen ? 'Đóng menu' : 'Mở menu');
    });
    document.addEventListener('keydown', (e) => {if(e.key === 'Escape') { menu.classList.remove('open');navButton.setAttribute('aria-expanded','false'); }});
  }

  // The public demo is intentionally local-only. It never calls the n8n API.
  const feed=document.getElementById('chat-feed');
  const chatForm=document.getElementById('chat-form');
  if (feed && chatForm) {
    const input=document.getElementById('chat-input');
    const suggestions=document.getElementById('suggestions');
    const scenarios={
      product:{
        opening:'Xin chào! Đây là TIEN404 AI Sales Assistant trong chế độ mô phỏng. Bạn muốn tìm hiểu sản phẩm nào? Danh mục dưới đây chỉ là ví dụ.',
        hints:['Shop có giày chạy bộ không?','Có những mẫu nào?','Chính sách đổi trả?']
      },
      budget:{
        opening:'Mình có thể lọc sản phẩm mẫu theo ngân sách. Bạn muốn tìm sản phẩm trong khoảng giá nào?',
        hints:['Tìm sản phẩm dưới 800.000đ','Ngân sách 500.000đ','Ưu tiên chạy bộ']
      },
      order:{
        opening:'Mình chỉ có thể tra cứu đơn hàng giả lập: DEMO-404. Mọi trạng thái dưới đây là dữ liệu minh họa.',
        hints:['Kiểm tra đơn DEMO-404','Đơn hàng đã giao chưa?','Mã vận đơn là gì?']
      },
      edit:{
        opening:'Bạn đang ở tình huống sửa đơn giả lập. Mình có thể ghi nhận yêu cầu thay đổi địa chỉ hoặc số điện thoại để nhân viên xác nhận. Không có đơn thật nào bị sửa.',
        hints:['Đổi địa chỉ nhận hàng','Đổi số điện thoại','Sửa đơn DEMO-404']
      },
      human:{
        opening:'Mình có thể giúp thu thập thông tin để nhân viên liên hệ. Trong bản demo, yêu cầu không được gửi đến người thật.',
        hints:['Tôi muốn gặp nhân viên','Có thể gọi lại cho tôi?','Tôi cần hỗ trợ']
      },
      automation:{
        opening:'Hãy thử một tình huống tự động hóa: khi khách yêu cầu thông tin, hệ thống phân loại → kiểm tra điều kiện → chuyển yêu cầu. Tất cả chạy mô phỏng trong trình duyệt.',
        hints:['Minh họa luồng xử lý','Nếu thông tin chưa đủ?','AI kết nối n8n thế nào?']
      }
    };
    const fakeProducts=[
      {name:'Giày chạy bộ Aero Lite',price:690000,feature:'êm, nhẹ',category:'giày'},
      {name:'Bình nước Trail 650ml',price:220000,feature:'gọn và bền',category:'phụ kiện'},
      {name:'Áo chạy bộ MoveDry',price:340000,feature:'thoáng khí',category:'áo'},
      {name:'Giày chạy bộ Terra Flex',price:890000,feature:'bám đường',category:'giày'}
    ];
    let scenario='product',count=0;
    const state={changedAddress:false,changedPhone:false};
    const cap=30;
    function addMessage(text,fromUser=false){
      const node=document.createElement('div');node.className='sim-message'+(fromUser?' mine':'');node.textContent=text;
      feed.appendChild(node);feed.scrollTop=feed.scrollHeight;
    }
    function showHints(){
      suggestions.replaceChildren();
      scenarios[scenario].hints.forEach((text)=>{
        const b=document.createElement('button');b.type='button';b.className='suggestion';b.textContent=text;
        b.addEventListener('click',()=>send(text));suggestions.appendChild(b);
      });
    }
    function switchScenario(which){
      scenario=which;count=0;state.changedAddress=false;state.changedPhone=false;feed.replaceChildren();
      document.querySelectorAll('.scenario').forEach(b=>{b.classList.toggle('active',b.dataset.scenario===scenario);b.setAttribute('aria-pressed',String(b.dataset.scenario===scenario));});
      addMessage(scenarios[scenario].opening);showHints();
    }
    function parseBudget(s){
      // Supports 800.000, 800k, 800 nghìn, 1 triệu, 1000000 VND.
      const million=s.match(/(\d+(?:[,.]\d+)?)\s*(triệu|tr)/i);
      if(million)return Math.round(parseFloat(million[1].replace(',','.'))*1e6);
      const thou=s.match(/(\d+(?:[,.]\d+)?)\s*(nghìn|ngàn|k)\b/i);
      if(thou)return Math.round(parseFloat(thou[1].replace(',','.'))*1000);
      const num=s.match(/\d[\d.,]*/);
      if(num){let n=Number(num[0].replace(/\D/g,''));if(Number.isFinite(n)){if(n<1000 && n>=50)n*=1000;return n;}}
      return null;
    }
    const money=(n)=>new Intl.NumberFormat('vi-VN').format(n)+'đ';
    function respond(message){
      const raw=message.toLocaleLowerCase('vi-VN');
      if(/(api key|mật khẩu|token|secret|production)/i.test(raw))return 'Để bảo mật, đừng chia sẻ mật khẩu, API key hoặc token ở đây. Đây là giao diện mô phỏng, không thể kết nối tới workflow quản trị hay đơn hàng thật.';
      if(/(người thật|nhân viên|tư vấn viên|gọi lại|liên hệ)/i.test(raw) || scenario==='human')return 'Mình đã nhận diện nhu cầu gặp nhân viên (mô phỏng). Để gửi yêu cầu liên hệ thật khi backend được bật, bạn hãy sử dụng trang Liên hệ. Demo này không gửi thông báo cho nhân viên.';
      if(scenario==='order' || /demo-404|trạng thái đơn|vận đơn|đơn hàng đã giao|kiểm tra đơn/i.test(raw))return 'Đơn hàng MẪU DEMO-404:\n• Sản phẩm: Giày chạy bộ Aero Lite × 1\n• Tổng minh họa: 690.000đ\n• Trạng thái giả lập: Đang chuẩn bị hàng\n• Vận đơn: Chưa có\nKhông có tra cứu hay giao dịch thật.';
      if(scenario==='edit' || /(đổi|sửa|thay).*(địa chỉ|số điện thoại|đơn)/i.test(raw)){
        if(/địa chỉ/i.test(raw))state.changedAddress=true;
        if(/(số điện thoại|sđt)/i.test(raw))state.changedPhone=true;
        const what=(state.changedAddress&&state.changedPhone)?'địa chỉ và số điện thoại':state.changedAddress?'địa chỉ':state.changedPhone?'số điện thoại':'thông tin đơn hàng';
        return `Đã ghi nhận yêu cầu thay đổi ${what} của đơn MẪU DEMO-404 (chỉ mô phỏng). Trong quy trình thật, hệ thống cần xác minh danh tính và yêu cầu nhân viên xác nhận trước khi sửa.`;
      }
      if(scenario==='automation' || /quy trình|workflow|n8n|luồng xử lý|thông tin chưa đủ/i.test(raw))return 'SƠ ĐỒ MÔ PHỎNG:\n1. Khách gửi yêu cầu → 2. Phân loại mục đích → 3. Kiểm tra nguồn dữ liệu được phép → 4. Xác nhận hoặc chuyển nhân viên → 5. Ghi nhận kết quả.\nNếu thiếu thông tin, hệ thống cần hỏi thêm hoặc dừng xử lý. Đây chưa phải workflow n8n đang chạy.';
      if(/(giá|bao nhiêu|ngân sách|dưới|tầm|khoảng|triệu|nghìn|\dk\b)/i.test(raw) || scenario==='budget'){
        const limit=parseBudget(raw);
        if(limit && limit>=100000){
          const requested=/(giày|chạy bộ)/i.test(raw)?'giày':/(áo)/i.test(raw)?'áo':/(phụ kiện|bình)/i.test(raw)?'phụ kiện':null;
          const matching=fakeProducts.filter(p=>p.price<=limit && (!requested || p.category===requested)).sort((a,b)=>b.price-a.price);
          if(matching.length)return `Theo danh mục GIẢ LẬP, trong mức ${money(limit)} có:\n${matching.map(p=>'• '+p.name+' — '+money(p.price)).join('\n')}\nBạn ưu tiên kiểu dáng, độ êm hay tính năng nào?`;
          return `Danh mục giả lập hiện chưa có mẫu trong ngân sách ${money(limit)}. Bạn có muốn xem lựa chọn khác không?`;
        }
        return 'Bạn có thể nhập ngân sách ví dụ “dưới 800.000đ” hoặc “500 nghìn” để mình lọc danh mục sản phẩm mẫu.';
      }
      if(/đổi trả|chính sách|bảo hành/i.test(raw))return 'Chính sách mô phỏng: nhân viên sẽ kiểm tra tình trạng sản phẩm và điều kiện đổi trả theo quy định của cửa hàng. Khi triển khai thực tế, cần nạp chính sách chính thức trước khi AI trả lời.';
      if(/(giày|chạy bộ|sản phẩm|mẫu|áo|phụ kiện|có gì)/i.test(raw))return 'Danh mục sản phẩm GIẢ LẬP gồm:\n• Giày chạy bộ Aero Lite — 690.000đ (êm, nhẹ)\n• Giày Terra Flex — 890.000đ (bám đường)\n• Áo MoveDry — 340.000đ (thoáng khí)\n• Bình Trail 650ml — 220.000đ\nBạn muốn tìm theo ngân sách hoặc mục đích sử dụng?';
      return 'Mình đang hoạt động theo kịch bản mẫu, nên chỉ xử lý một số chủ đề: tìm sản phẩm, ngân sách, đơn DEMO-404, thay đổi thông tin giả lập và chuyển nhân viên. Hãy thử một câu hỏi gợi ý bên dưới.';
    }
    function send(value){
      const msg=String(value).trim().slice(0,500);
      if(!msg)return;
      if(count>=cap){addMessage('Bạn đã đạt giới hạn 30 tin nhắn trong lượt demo. Hãy chọn lại một tình huống để bắt đầu lại.');return;}
      count++;addMessage(msg,true);input.value='';addMessage(respond(msg));
    }
    document.querySelectorAll('.scenario').forEach(b=>b.addEventListener('click',()=>switchScenario(b.dataset.scenario)));
    chatForm.addEventListener('submit',(e)=>{e.preventDefault();send(input.value);});
    switchScenario('product');
  }

  // GitHub Pages can only serve static files. Explicitly surface backend status.
  const isStaticHost = location.protocol === 'file:' || location.protocol === 'about:' || /(^|\.)github\.io$/.test(location.hostname);
  const staticNotice=document.getElementById('static-form-notice');
  if (staticNotice && isStaticHost) staticNotice.hidden=false;
  document.querySelectorAll('.nav-links a').forEach(link=>{
    if(link.classList.contains('active')) link.setAttribute('aria-current','page');
    link.addEventListener('click',()=>{if(menu){menu.classList.remove('open');navButton?.setAttribute('aria-expanded','false');}});
  });
  document.addEventListener('click',e=>{
    if(menu?.classList.contains('open') && !menu.contains(e.target) && !navButton?.contains(e.target)) {
      menu.classList.remove('open');navButton?.setAttribute('aria-expanded','false');
    }
  });

  const leadForm=document.getElementById('lead-form');
  if(leadForm){
    const alertBox=document.getElementById('form-alert');
    const submit=document.getElementById('lead-submit');
    const urlPlan=new URLSearchParams(window.location.search).get('plan');
    const product=leadForm.elements.namedItem('product');
    if(urlPlan && product){const opt=[...product.options].find(x=>x.value===urlPlan);if(opt)product.value=opt.value; else leadForm.elements.namedItem('message').value='Tôi muốn nhận tư vấn về: '+urlPlan+'.';}
    function alertMessage(text,style){alertBox.textContent=text;alertBox.className='form-alert visible '+style;alertBox.scrollIntoView({behavior:'smooth',block:'nearest'});}
    leadForm.addEventListener('submit',async(e)=>{
      e.preventDefault();
      const form=new FormData(leadForm);
      const name=String(form.get('name')||'').trim(),business=String(form.get('business')||'').trim(),contact=String(form.get('contact')||'').trim();
      if(name.length<2||business.length<2||!contact){alertMessage('Vui lòng điền đầy đủ tên, cửa hàng và thông tin liên hệ hợp lệ.','error');return;}
      const looksEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
      const phone=contact.replace(/[\s().-]/g,'');
      const looksPhone=/^\+?\d{9,15}$/.test(phone);
      if(!looksEmail&&!looksPhone){alertMessage('Email hoặc số điện thoại chưa hợp lệ. Vui lòng kiểm tra lại.','error');return;}
      if(!form.get('industry')||!leadForm.elements.namedItem('consent').checked){alertMessage('Vui lòng chọn ngành hàng và đồng ý với chính sách quyền riêng tư.','error');return;}
      if(isStaticHost){alertMessage('GitHub Pages chỉ lưu trữ trang tĩnh. Chưa có backend nhận biểu mẫu: thông tin của bạn KHÔNG được gửi hoặc lưu.','error');return;}
      const body={name,business,contact,industry:String(form.get('industry')||''),channel:String(form.get('channel')||''),product:String(form.get('product')||''),budget:String(form.get('budget')||''),message:String(form.get('message')||''),website:String(form.get('website')||''),consent:true};
      submit.disabled=true;submit.textContent='Đang gửi yêu cầu...';
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
      try{
        const res=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal,credentials:'same-origin'});
        const data=await res.json().catch(()=>null);
        if(!res.ok)throw new Error(data?.detail && typeof data.detail==='string' ? data.detail : res.status===404?'Máy chủ nhận yêu cầu chưa được kết nối.':'Không thể gửi yêu cầu lúc này.');
        if(data?.status==='accepted'){alertMessage('Đã ghi nhận yêu cầu trên máy chủ thử nghiệm. Mã tham chiếu: '+data.id+'. Chúng tôi cần cấu hình thông báo quản trị để xử lý yêu cầu đúng quy trình.','success');leadForm.reset();}
        else throw new Error('Phản hồi máy chủ không hợp lệ.');
      }catch(error){alertMessage(error.name==='AbortError'?'Yêu cầu hết thời gian chờ. Vui lòng thử lại.':error.message||'Đã có lỗi khi gửi yêu cầu.','error');}
      finally{clearTimeout(timer);submit.disabled=false;submit.textContent='Gửi yêu cầu tư vấn ↗';}
    });
  }

  // Motion system V2: progressive enhancement; reduced-motion, touch & low-power aware.
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  const motionAllowed = !motionQuery.matches && !saveData;

  // Reading progress indicator. No extra scroll listeners per component.
  if (motionAllowed) {
    const progress = document.createElement('div');
    progress.className='reading-progress';
    progress.setAttribute('aria-hidden','true');
    document.body.append(progress);
    let scrollQueued = false;
    const updateProgress=()=>{
      const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
      progress.style.transform='scaleX('+Math.min(1,Math.max(0,scrollY/max))+')';
      scrollQueued=false;
    };
    const scheduleProgress=()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(updateProgress);}};
    window.addEventListener('scroll',scheduleProgress,{passive:true});
    window.addEventListener('resize',scheduleProgress,{passive:true});
    scheduleProgress();
  }

  // IntersectionObserver: animate visible content only, never hide content when JS is disabled.
  if (motionAllowed && 'IntersectionObserver' in window) {
    const selectors=[
      '.section-header', '.section .split-layout > *', '.section .grid3 > *',
      '.section .grid4 > *', '.section .timeline > *', '.faq-stack > details',
      '.cta-banner', '.page-hero > .container', '.solution-detail',
      '.motion-lab', '.sim-shell', '.contact-card', '.table-wrap'
    ];
    const elements=[...new Set(document.querySelectorAll(selectors.join(',')))].filter(el=>
      !el.closest('.hero') && !el.closest('.dash-scene') && (el.classList.contains('motion-lab') || !el.closest('.motion-lab'))
    );
    const io=new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(!entry.isIntersecting)return;
        entry.target.classList.add('is-revealed');
        entry.target.classList.remove('motion-pending');
        io.unobserve(entry.target);
      });
    },{threshold:0.08,rootMargin:'0px 0px -28px 0px'});
    elements.forEach((el)=>{
      const rect=el.getBoundingClientRect();
      if(rect.bottom<0 || rect.top>innerHeight*0.88){
        const parent=el.parentElement;
        const siblings=parent ? [...parent.children].filter(x=>x.matches('.feature-card,.solution-card,.price-card,.industry-card,.step')):[];
        const order=siblings.indexOf(el);
        if(order>=0)el.style.setProperty('--reveal-delay',Math.min(order,5)*85+'ms');
        el.setAttribute('data-reveal','');
        el.classList.add('motion-pending');io.observe(el);
      }
    });
  }

  // Spotlight: one pointer listener per active card, no repaint while idle.
  if (motionAllowed && finePointer.matches) {
    const cards=document.querySelectorAll('.feature-card,.solution-card,.price-card,.industry-card,.workflow-visual');
    cards.forEach(card=>{
      let frame=0, px=0, py=0;
      card.classList.add('spotlight-ready');
      card.addEventListener('pointermove',(event)=>{
        const rect=card.getBoundingClientRect();
        px=event.clientX-rect.left;py=event.clientY-rect.top;
        if(!frame)frame=requestAnimationFrame(()=>{
          card.style.setProperty('--pointer-x',px+'px');
          card.style.setProperty('--pointer-y',py+'px');
          frame=0;
        });
      },{passive:true});
    });

    // Small, capped parallax tilt on the dashboard illustration only.
    const scene=document.querySelector('[data-tilt-scene]');
    if(scene){
      let frame=0, rx=0, ry=0;
      scene.addEventListener('pointermove',(event)=>{
        const bounds=scene.getBoundingClientRect();
        const x=(event.clientX-bounds.left)/bounds.width-.5;
        const y=(event.clientY-bounds.top)/bounds.height-.5;
        rx=(-y*4).toFixed(2);ry=(x*5).toFixed(2);
        if(!frame)frame=requestAnimationFrame(()=>{
          scene.style.setProperty('--tilt-x',rx+'deg');
          scene.style.setProperty('--tilt-y',ry+'deg');
          frame=0;
        });
      },{passive:true});
      scene.addEventListener('pointerleave',()=>{
        scene.style.removeProperty('--tilt-x');scene.style.removeProperty('--tilt-y');
      });
    }
  }

  // Actual interactive story: only fake examples; no network access.
  const lab=document.querySelector('[data-motion-lab]');
  if(lab){
    const buttons=[...lab.querySelectorAll('[data-lab-step]')];
    const panel=lab.querySelector('#lab-stage');
    const stages=[
      {status:'01 · INPUT RECEIVED',title:'Tiếp nhận câu hỏi của khách',text:'Khách gửi câu hỏi về sản phẩm, giá hoặc trạng thái yêu cầu. Luồng ghi nhận thông tin cần thiết để xử lý bước tiếp theo.',sample:'“Shop có mẫu giày nào dưới 800.000đ?”'},
      {status:'02 · INTENT DETECTED',title:'Phân loại nhu cầu và dữ liệu',text:'Quy trình xác định đây là yêu cầu tìm sản phẩm theo ngân sách. Chỉ truy vấn nguồn dữ liệu được cấp quyền và kiểm tra thông tin còn thiếu.',sample:'Ý định mẫu: TÌM SẢN PHẨM · Ngân sách: 800.000đ'},
      {status:'03 · RULES VERIFIED',title:'Đề xuất theo quy tắc đã thiết lập',text:'Trong bản triển khai thật, các điều kiện về giá, tồn kho và quyền thao tác phải được kiểm tra trước khi trả lời hoặc thực hiện hành động.',sample:'Kết quả ví dụ: sản phẩm phù hợp → hỏi thêm sở thích'},
      {status:'04 · HUMAN HANDOFF',title:'Chuyển người phụ trách khi cần',text:'Khi yêu cầu vượt phạm vi được phép hoặc cần xác nhận, hệ thống dừng thao tác và chuyển thông tin phù hợp để nhân viên xem xét.',sample:'Trạng thái mẫu: CHỜ NHÂN VIÊN XÁC NHẬN'}
    ];
    const setStep=(index,focus=false)=>{
      buttons.forEach((button,i)=>{
        button.classList.toggle('is-active',i===index);
        button.setAttribute('aria-selected',String(i===index));
        button.tabIndex=i===index?0:-1;
      });
      const item=stages[index];
      lab.querySelector('[data-lab-counter]').textContent=String(index+1).padStart(2,'0')+' / 04';
      lab.querySelector('[data-lab-status]').textContent=item.status;
      lab.querySelector('[data-lab-heading]').textContent=item.title;
      lab.querySelector('[data-lab-description]').textContent=item.text;
      lab.querySelector('[data-lab-sample]').textContent=item.sample;
      lab.style.setProperty('--current-step',String(index));
      panel.setAttribute('aria-labelledby',buttons[index].id);
      panel.classList.remove('stage-updated');
      if(motionAllowed){void panel.offsetWidth;panel.classList.add('stage-updated');}
      if(focus)buttons[index].focus();
    };
    buttons.forEach((button,i)=>{
      button.addEventListener('click',()=>setStep(i));
      button.addEventListener('keydown',e=>{
        const delta=(e.key==='ArrowDown'||e.key==='ArrowRight')?1:(e.key==='ArrowUp'||e.key==='ArrowLeft')?-1:0;
        if(delta){e.preventDefault();setStep((i+delta+buttons.length)%buttons.length,true);}
        if(e.key==='Home'){e.preventDefault();setStep(0,true);}
        if(e.key==='End'){e.preventDefault();setStep(buttons.length-1,true);}
      });
    });
    setStep(0);
  }
})();