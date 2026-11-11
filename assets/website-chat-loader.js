/* TIEN404 AI V5: one public widget mount shared by all marketing pages.
   Public marketing bot ONLY. Never put user tokens, order credentials or
   tenant authorization into this client-side loader.
*/
(() => {
  "use strict";
  if (document.body?.dataset.saasPage || document.querySelector('#tien404-floating-widget')) return;
  const shell="<div class=\"tien404-floating-widget\" id=\"tien404-floating-widget\"><button type=\"button\" id=\"tien404-chat-launcher\" class=\"tien404-chat-launcher\" aria-label=\"Trò chuyện với TIEN404 AI\" aria-expanded=\"false\" aria-controls=\"tien404-chat-panel\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8v.5Z\"/></svg><span>Chat AI</span></button><section id=\"tien404-chat-panel\" class=\"tien404-chat-panel\" aria-label=\"Trò chuyện với TIEN404 AI\" hidden><header class=\"tien404-panel-head\"><div><strong>TIEN404 AI</strong><small>Trợ lý tư vấn trực tuyến</small></div><button type=\"button\" id=\"tien404-chat-close\" aria-label=\"Thu nhỏ khung chat\">—</button></header><div class=\"ai-live-card\" id=\"tien404-chat-card\"><div id=\"n8n-chat\" class=\"tien404-ai-chat\" aria-label=\"Chat với TIEN404 AI Consultant\"></div><form id=\"tien404-composer\" class=\"tien404-composer\" hidden><label class=\"tien404-composer-label\" for=\"tien404-message\">Tin nhắn của bạn</label><div class=\"tien404-composer-row\"><textarea id=\"tien404-message\" rows=\"2\" maxlength=\"2000\" placeholder=\"Nhập câu hỏi tại đây...\" aria-label=\"Soạn tin nhắn cho TIEN404 AI\"></textarea><button id=\"tien404-send\" type=\"submit\" aria-label=\"Gửi tin nhắn\">Gửi ↗</button></div><p id=\"tien404-composer-status\" class=\"tien404-composer-status\" role=\"status\" aria-live=\"polite\"></p></form><p id=\"n8n-chat-fallback\" hidden>Chat hiện không tải được. Bạn có thể thử <a href=\"lab.html\">bản mô phỏng</a>.</p></div></section></div>";
  document.body.insertAdjacentHTML('beforeend',shell);
  const script=document.createElement('script');
  script.type='module';
  script.src='assets/ai-consultant.js?v=global9';
  script.addEventListener('error',()=>{
    const fallback=document.querySelector('#n8n-chat-fallback');
    if(fallback)fallback.hidden=false;
  });
  document.body.appendChild(script);
})();
