// Generates n8n Workflow SDK code for "TIEN404 BOT CORE" from the live Messenger agent export.
// Usage: node channels/n8n/build-core.mjs <Z7Fd-export.json> > core.sdk.js
import fs from 'node:fs';
const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).workflow;
const byName = Object.fromEntries(src.nodes.map((n) => [n.name, n]));
let prompt = byName['Messenger AI Agent'].parameters.options.systemMessage;
prompt = prompt
  .replace('# TIEN404 AI MESSENGER — BÁN HÀNG V3\nLà nhân viên của Fanpage Tien404 AI,',
    '# TIEN404 AI — BÁN HÀNG ĐA KÊNH (lõi dùng chung)\nLà nhân viên bán hàng của shop Tien404 AI, trả lời khách trên nhiều kênh (Messenger, Instagram, Telegram, website). Kênh hiện tại được ghi ở dòng [Kênh: ...] đầu mỗi tin; dòng đó do hệ thống thêm, không phải lời khách. Không bao giờ nói tên kênh nội bộ hay mã phiên cho khách.\nXưng')
  .replace('\nXưng xưng ', '\nXưng ')
  .replaceAll('Read Products - Messenger Read Only', 'Read Products - chỉ đọc')
  .replaceAll('liên hệ nhân viên Fanpage', 'liên hệ nhân viên của shop')
  .replaceAll('liên hệ trực tiếp Fanpage', 'liên hệ trực tiếp shop');
const tool = (name) => byName[name].parameters;
const J = (v) => JSON.stringify(v, null, 1);
const ticket = structuredClone(tool('create_support_ticket'));
ticket.workflowInputs.value.sender_id = "={{ $('Chuẩn hoá yêu cầu').first().json.channel + ':' + $('Chuẩn hoá yêu cầu').first().json.senderId }}";
ticket.workflowInputs.value.page_id = "={{ $('Chuẩn hoá yêu cầu').first().json.accountId }}";
ticket.workflowInputs.value.user_message = "={{ $('Chuẩn hoá yêu cầu').first().json.text }}";
ticket.description = ticket.description.replace('từ Webhook', 'từ kênh chat');
const adapters = fs.readFileSync(new URL('../lib/channel-adapters.mjs', import.meta.url), 'utf8');
const fnSrc = (name) => { const m = adapters.match(new RegExp('export function ' + name + '\\([\\s\\S]*?\\n}\\n')); return m[0].replace('export ', ''); };

const normalizeCode = `// Kiểm tra yêu cầu từ adapter kênh. Adapter đã xác thực nguồn; ở đây chặn dữ liệu sai dạng.
const CHANNELS=['messenger','instagram','telegram','web','zalo','tiktok_shop'];
const fold=s=>String(s??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
${fnSrc('detectSku')}
const r=$input.first().json;
const channel=String(r.channel??'');
const accountId=String(r.accountId??'');
const senderId=String(r.senderId??'');
let text=typeof r.text==='string'?r.text.trim():'';
if(!CHANNELS.includes(channel))throw new Error('unknown_channel');
if(!/^[A-Za-z0-9_.-]{1,64}$/.test(accountId)||!/^-?[A-Za-z0-9_-]{1,64}$/.test(senderId))throw new Error('bad_identity');
if(!text||text.length>1800)throw new Error('bad_text');
let mediaType=String(r.mediaType||'text');
let selectedSku=/^[A-Z][0-9]{3}$/.test(String(r.selectedSku??''))?String(r.selectedSku):null;
let memoryUserText=typeof r.memoryUserText==='string'&&r.memoryUserText?r.memoryUserText:text;
if(!selectedSku&&mediaType==='text'&&text.length<=80){selectedSku=detectSku(text);}
if(selectedSku)mediaType='product_detail';
const label={messenger:'Messenger',instagram:'Instagram',telegram:'Telegram',web:'Website',zalo:'Zalo',tiktok_shop:'TikTok Shop'}[channel];
return [{json:{channel,accountId,senderId,messageId:String(r.messageId??''),text,mediaType,selectedSku,memoryUserText,
 sessionId:channel+':'+accountId+':'+senderId,chatInput:'[Kênh: '+label+']\\n'+text}}];`;

const formatCode = `const req=$('Chuẩn hoá yêu cầu').first().json;
${fnSrc('formatProduct')}
return [{json:{output:formatProduct(req.selectedSku,$input.all().map(i=>i.json)),source:'fast_path'}}];`;

const finalCode = `// Trả lời trung lập theo kênh: adapter tự hiển thị nút/quick reply và giới hạn tối đa 3 tin.
const j=$input.first().json;
const replyText=typeof j.output==='string'?j.output.trim():'';
const source=j.source||'ai';
const skus=source==='fast_path'?[]:[...new Set(Array.from(replyText.matchAll(/^\\s*(?:[-•*]\\s*)?(?:\\*\\*)?([A-Z]\\d{3})\\b/gm),m=>m[1]))].slice(0,3);
const req=$('Chuẩn hoá yêu cầu').first().json;
return [{json:{replyText:replyText||'Dạ shop đang kiểm tra thông tin, mình chờ chút rồi nhắn lại giúp shop nhé ạ.',skus,source,channel:req.channel,accountId:req.accountId,senderId:req.senderId,messageId:req.messageId}}];`;

const code = `import { workflow, node, trigger, ifElse, languageModel, memory, tool } from '@n8n/workflow-sdk';
const sheetDoc = ${J(byName['Read selected demo product'].parameters.documentId)};
const sheetTab = ${J(byName['Read selected demo product'].parameters.sheetName)};
const sheetsCred = { googleSheetsOAuth2Api: { id: 'FLLxWe2VNQEZsGWP', name: 'Google Sheets account' } };

const start = trigger({ type: 'n8n-nodes-base.executeWorkflowTrigger', version: 1.3, config: { name: 'Nhận yêu cầu từ adapter kênh', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [
 { name: 'channel', type: 'string' }, { name: 'accountId', type: 'string' }, { name: 'senderId', type: 'string' }, { name: 'messageId', type: 'string' },
 { name: 'text', type: 'string' }, { name: 'mediaType', type: 'string' }, { name: 'selectedSku', type: 'string' }, { name: 'memoryUserText', type: 'string' } ] } } } });

const normalize = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Chuẩn hoá yêu cầu', parameters: { jsCode: ${J(normalizeCode)} } } });

const sessionKey = "={{ $('Chuẩn hoá yêu cầu').first().json.sessionId }}";
const mem = memory({ type: '@n8n/n8n-nodes-langchain.memoryBufferWindow', version: 1.4, config: { name: 'Bộ nhớ hội thoại theo kênh', parameters: { sessionIdType: 'customKey', sessionKey, contextWindowLength: 14 } } });
const model = languageModel({ type: '@n8n/n8n-nodes-langchain.lmChatOpenAi', version: 1.3, config: { name: 'OpenAI gpt-5-mini (như Messenger)', parameters: ${J((({builtInTools, ...rest}) => rest)(byName['Messenger OpenAI Chat Model'].parameters))} } });
const readProducts = tool({ type: 'n8n-nodes-base.googleSheetsTool', version: 4.7, config: { name: 'Read Products - chỉ đọc', parameters: ${J(tool('Read Products - Messenger Read Only'))}, credentials: sheetsCred } });
${['create_order','update_order_address','manage_order','get_order_status'].map((n, i) => `const t${i} = tool({ type: '@n8n/n8n-nodes-langchain.toolWorkflow', version: 2.2, config: { name: '${n}', parameters: ${J(tool(n))} } });`).join('\n')}
const t4 = tool({ type: '@n8n/n8n-nodes-langchain.toolWorkflow', version: 2.2, config: { name: 'create_support_ticket', parameters: ${J(ticket)} } });
const agent = node({ type: '@n8n/n8n-nodes-langchain.agent', version: 3.1, config: { name: 'AI bán hàng (lõi chung)', onError: 'continueErrorOutput',
 parameters: { promptType: 'define', text: '={{ $json.chatInput }}', options: { systemMessage: ${J(prompt)}, maxIterations: 12 } },
 subnodes: { model, memory: mem, tools: [readProducts, t0, t1, t2, t3, t4] } } });

const isProduct = ifElse({ version: 2.2, config: { name: 'Product detail?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [ { leftValue: "={{ $json.mediaType === 'product_detail' }}", operator: { type: 'boolean', operation: 'true', singleValue: true } } ], combinator: 'and' } } } });
const readOne = node({ type: 'n8n-nodes-base.googleSheets', version: 4.7, config: { name: 'Đọc đúng 1 mẫu (Sheet demo)', alwaysOutputData: true, parameters: { operation: 'read', documentId: sheetDoc, sheetName: sheetTab, filtersUI: { values: [ { lookupColumn: 'sku', lookupValue: '={{ $json.selectedSku }}' } ] }, options: {} }, credentials: sheetsCred } });
const format = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Định dạng mẫu', parameters: { jsCode: ${J(formatCode)} } } });
const remember = node({ type: '@n8n/n8n-nodes-langchain.memoryManager', version: 1.1, config: { name: 'Ghi nhớ mẫu vừa xem', parameters: { mode: 'insert', insertMode: 'insert', messages: { messageValues: [
 { type: 'user', message: "={{ $('Chuẩn hoá yêu cầu').first().json.memoryUserText }}" }, { type: 'ai', message: '={{ $json.output }}' } ] } }, subnodes: { memory: mem } } });
const forward = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Lấy câu trả lời mẫu', parameters: { jsCode: "return [{json:{output:$('Định dạng mẫu').first().json.output,source:'fast_path'}}];" } } });
const timeout = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'AI quá giờ - báo đang kiểm tra', parameters: { jsCode: "return [{json:{output:'Dạ shop đang kiểm tra thông tin, mình chờ chút rồi nhắn lại giúp shop nhé ạ.',source:'timeout'}}];" } } });
const final = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Trả lời chuẩn cho adapter', parameters: { jsCode: ${J(finalCode)} } } });

export default workflow('tien404-bot-core', 'TIEN404 BOT CORE — AI bán hàng dùng chung (DRAFT)')
 .add(start).to(normalize).to(isProduct
   .onTrue(readOne.to(format).to(remember).to(forward).to(final))
   .onFalse(agent.to(final)))
 .add(agent.onError(timeout.to(final)));
`;
process.stdout.write(code);
