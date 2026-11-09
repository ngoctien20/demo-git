import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';
const target=document.querySelector('#n8n-chat');
if(target){
  try{
    createChat({
      webhookUrl:'https://ngoctien20.app.n8n.cloud/webhook/c29c6398-04d1-467f-ab23-8d679cdd7133/chat',
      target:'#n8n-chat',
      mode:'fullscreen',
      showWelcomeScreen:false,
      initialMessages:[
        'Xin chào! Mình là TIEN404 AI Consultant (AI thật, bản thử nghiệm).',
        'Bạn đang bán hàng ở ngành nào? Mình có thể giải thích các giải pháp và hướng dẫn bạn dùng thử website.'
      ],
      i18n:{
        en:{
          title:'TIEN404 AI · Trợ lý tư vấn',
          subtitle:'AI thật · môi trường thử nghiệm an toàn',
          footer:'',
          getStarted:'Bắt đầu trò chuyện',
          inputPlaceholder:'Hỏi về AI bán hàng, Messenger hoặc quy trình tự động...',
          closeButtonTooltip:'Đóng cửa sổ chat'
        }
      }
    });
    document.documentElement.classList.add('tien404-chat-ready');
  }catch(e){
    const note=document.querySelector('#n8n-chat-fallback');
    if(note)note.hidden=false;
  }
}