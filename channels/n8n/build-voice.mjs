// Generates n8n Workflow SDK code for "TIEN404 VOICE → chữ (dùng chung)".
// Usage: node channels/n8n/build-voice.mjs > voice.sdk.js
import fs from 'node:fs';
const blocks = fs.readFileSync(new URL('../lib/voice-understanding.mjs', import.meta.url), 'utf8')
  .split(/\n(?=export )/).slice(1).map((b) => b.replace(/^\/\/.*\n/gm, '').replace(/^export /, '').trim());
const pick = (...names) => names.map((n) => { const b = blocks.find((x) => new RegExp('^(?:const|function) ' + n + '\\b').test(x)); if (!b) throw new Error('missing ' + n); return b; }).join('\n');
const libPrep = pick('MAX_AUDIO_BYTES', 'AUDIO_MIME', 'VOICE_SCHEMA', 'LETTER_SAY', 'buildVoicePrompt', 'buildGeminiBody');
const libDecide = pick('geminiText', 'parseGemini', 'DIGIT_WORDS', 'LETTER_WORDS', 'QTY_WORDS', 'BA_LIKE', 'voiceRules', 'ASK_AGAIN', 'confirmSkuText', 'foldVi', 'decideVoice');
const J = (v) => JSON.stringify(v, null, 1);
const TRIGGER = 'Nhận âm thanh từ adapter';
const prepCode = `// Kiểm tra âm thanh + tạo yêu cầu Gemini (danh mục đọc từ Sheet AI_SALES_DEMO để gợi ý mã).
${libPrep}
const req=$('${TRIGGER}').first().json;
const catalog=$input.all().map(i=>i.json||{}).filter(r=>/^[A-Z]\\d{3}$/.test(String(r.sku||''))).map(r=>({sku:String(r.sku),name:String(r.name||'')}));
const b64=String(req.audioBase64||'').replace(/\\s+/g,'');
let fail=null;
if(!b64||b64.length<100||!/^[A-Za-z0-9+/]+={0,2}$/.test(b64))fail='no_audio';
else if(Math.floor(b64.length*3/4)>MAX_AUDIO_BYTES)fail='too_large';
let mime=String(req.mimeType||'').toLowerCase().split(';')[0].trim();
if(!AUDIO_MIME.includes(mime))mime='audio/ogg';
return [{json:{fail,skus:catalog.map(c=>c.sku),names:catalog.map(c=>c.name),gemini_body:fail?null:buildGeminiBody(b64,mime,catalog)}}];`;
const decideCode = `// Gộp kết quả Gemini + luật đọc transcript. Không chắc thì trả câu hỏi lại khách (không gọi lõi).
${libDecide}
const prep=$('Chuẩn bị gọi Gemini').first().json;
const ch=String($('${TRIGGER}').first().json.channel||'');
const out=prep.fail?decideVoice(null,prep.skus,prep.fail):decideVoice(parseGemini($input.first().json),prep.skus,null,prep.names);
return [{json:{...out,channel:ch}}];`;

const code = `import { workflow, node, trigger, ifElse } from '@n8n/workflow-sdk';
const sheetsCred = { googleSheetsOAuth2Api: { id: 'FLLxWe2VNQEZsGWP', name: 'Google Sheets account' } };
const geminiCred = { googlePalmApi: { id: 'WwmLCfAY9sZm1wC1', name: 'Google Gemini(PaLM) Api account' } };
const start = trigger({ type: 'n8n-nodes-base.executeWorkflowTrigger', version: 1.3, config: { name: '${TRIGGER}', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [
 { name: 'channel', type: 'string' }, { name: 'audioBase64', type: 'string' }, { name: 'mimeType', type: 'string' } ] } } } });
const readCat = node({ type: 'n8n-nodes-base.googleSheets', version: 4.7, config: { name: 'Đọc danh mục mã (Sheet demo)', alwaysOutputData: true, onError: 'continueRegularOutput', parameters: { operation: 'read',
 documentId: { __rl: true, mode: 'id', value: '1flbUFHb6ybJVLnnXTf3FQD70YNtd6MneL_xVpPYsscE', cachedResultName: 'AI_SALES_DEMO' },
 sheetName: { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'Products' }, options: {} }, credentials: sheetsCred } });
const prep = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Chuẩn bị gọi Gemini', parameters: { jsCode: ${J(prepCode)} } } });
const okAudio = ifElse({ version: 2.2, config: { name: 'Âm thanh hợp lệ?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [ { leftValue: '={{ !$json.fail }}', operator: { type: 'boolean', operation: 'true', singleValue: true } } ], combinator: 'and' } } } });
const gemini = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Gemini nghe tin thoại', notes: 'Gemini REST, gemini-3.5-flash-lite (miễn phí), timeout cứng 15s, không thử lại.', onError: 'continueRegularOutput', alwaysOutputData: true, retryOnFail: false,
 parameters: { method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', authentication: 'predefinedCredentialType', nodeCredentialType: 'googlePalmApi', sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.gemini_body) }}', options: { timeout: 15000 } }, credentials: geminiCred } });
const decide = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Hiểu tin thoại', parameters: { jsCode: ${J(decideCode)} } } });
export default workflow('tien404-voice', 'TIEN404 VOICE → chữ (dùng chung mọi kênh)')
 .add(start).to(readCat).to(prep).to(okAudio.onTrue(gemini.to(decide)).onFalse(decide));
`;
process.stdout.write(code);
