const target=document.querySelector('#n8n-chat');
if(target){
  (async () => {
  try{
    const { createChat } = await import('https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js');
    createChat({
      webhookUrl:'https://ngoctien20.app.n8n.cloud/webhook/c29c6398-04d1-467f-ab23-8d679cdd7133/chat',
      target:'#n8n-chat',
      mode:'fullscreen',
      showWelcomeScreen:false,
      initialMessages:[
        'Xin chào! Mình là trợ lý tư vấn TIEN404 AI.',
        'Bạn có thể hỏi về AI bán hàng, Messenger, chi phí, tích hợp hoặc cách triển khai cho cửa hàng. Mình sẽ giải thích rõ những tính năng đang thử nghiệm.'
      ],
      i18n:{
        en:{
          title:'TIEN404 AI · Trợ lý tư vấn',
          subtitle:'AI tư vấn · không tạo đơn hay lưu thông tin khách',
          footer:'',
          getStarted:'Bắt đầu trò chuyện',
          inputPlaceholder:'Hỏi bất kỳ điều gì về TIEN404 AI...',
          closeButtonTooltip:'Đóng cửa sổ chat'
        }
      }
    });
    document.documentElement.classList.add('tien404-chat-ready');
  }catch(e){
    const note=document.querySelector('#n8n-chat-fallback');
    if(note)note.hidden=false;
    target.setAttribute('aria-label','Chat AI hiện không tải được; vui lòng thử bản mô phỏng.');
  }
  })();
}