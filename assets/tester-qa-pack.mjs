/* TIEN404 AI QA Studio V12.3 — public SYNTHETIC contract only.
 * Hard-coded expectations are independent of the deterministic browser simulator.
 * This pack does NOT call an LLM, workflow, customer API, or live store.
 */
import {calculateDemo,formatVnd} from './tester-sandbox.mjs';
export const AI_REVIEW_CASE_ID='SHEET-AI-REVIEW-001';
export const PRIORITY_CHECKS=Object.freeze([
 Object.freeze({caseId:'SHEET-SIM-002',risk:'P1',title:'Báo giá đúng',input:Object.freeze({sku:'QA-DEMO-01',quantity:'2'}),expected:'ok',expectedTotal:318000}),
 Object.freeze({caseId:'SHEET-SIM-003',risk:'P1',title:'Mua đúng tồn kho',input:Object.freeze({sku:'QA-DEMO-01',quantity:'25'}),expected:'ok',expectedTotal:3975000}),
 Object.freeze({caseId:'SHEET-SIM-004',risk:'P0',title:'Chặn vượt tồn',input:Object.freeze({sku:'QA-DEMO-01',quantity:'26'}),expected:'out_of_stock'}),
 Object.freeze({caseId:'SHEET-SIM-005',risk:'P1',title:'Không tự đoán SKU',input:Object.freeze({sku:'QA-NOT-FOUND',quantity:'1'}),expected:'not_found'}),
 Object.freeze({caseId:'SHEET-SIM-006',risk:'P1',title:'Từ chối số lượng 0',input:Object.freeze({sku:'QA-DEMO-01',quantity:'0'}),expected:'invalid_quantity'}),
 Object.freeze({caseId:'SHEET-SIM-009',risk:'P0',title:'Không nhận giá khách',input:Object.freeze({sku:'QA-DEMO-01',quantity:'2',offeredPrice:'100000'}),expected:'price_mismatch'}),
 Object.freeze({caseId:'SHEET-SIM-010',risk:'P1',title:'Nhận giá VND hợp lệ',input:Object.freeze({sku:'QA-DEMO-01',quantity:'1',offeredPrice:'159.000'}),expected:'ok',expectedTotal:159000}),
 Object.freeze({caseId:'SHEET-SIM-011',risk:'P1',title:'Từ chối giá không hợp lệ',input:Object.freeze({sku:'QA-DEMO-01',quantity:'1',offeredPrice:'159.5'}),expected:'invalid_price'})
]);
export function runPriorityChecks(availableIds){
 const ids=new Set(availableIds);
 return PRIORITY_CHECKS.filter(x=>ids.has(x.caseId)).map(c=>{
  const output=calculateDemo(c.input);
  const ok=output.code===c.expected &&
   (c.expectedTotal===undefined||output.total===c.expectedTotal);
  return Object.freeze({caseId:c.caseId,title:c.title,risk:c.risk,
   input:c.input,expected:c.expected,expectedTotal:c.expectedTotal??null,
   observed:output.code,observedTotal:output.total??null,ok});
 });
}
export function reviewPrompt(results){
 if(!Array.isArray(results)||!results.length)throw Error('QA_NOT_EXECUTED');
 const safe=results.map(r=>({
  test:r.caseId,priority:r.risk,title:r.title,input:r.input,
  expectedCode:r.expected,expectedTotalVND:r.expectedTotal,
  observedCode:r.observed,observedTotalVND:r.observedTotal,
  localMatch:r.ok
 }));
 return `BẠN LÀ CHUYÊN GIA QA ĐỘC LẬP CHO TIEN404 AI.
MỤC TIÊU: Phân tích chất lượng, tìm khoảng trống kiểm thử và đề xuất cách tái hiện lỗi.
SẢN PHẨM: TIEN404 AI hướng tới trợ lý tư vấn bán hàng cho cửa hàng nhỏ tại Việt Nam.
PHẠM VI ĐÃ CHẠY: BỘ TÍNH GIẢ LẬP 100% trong trình duyệt; KHÔNG PHẢI phản hồi LLM, Messenger, Zalo, Commerce, Supabase production hoặc đơn hàng thật.
QUY TẮC AN TOÀN:
- Chỉ đọc JSON kết quả tổng hợp bên dưới, không đòi token, mật khẩu, số điện thoại, dữ liệu khách hoặc webhook.
- Không tự gọi API, không tạo đơn, không gửi tin và không truy cập hệ thống thật.
- Không nói hệ thống AI SALES/Messenger đã PASS chỉ dựa trên kết quả giả lập.
- Mỗi phát hiện phải ghi rõ: vấn đề; mức độ P0/P1/P2; test ID; điều kiện tái hiện; expected vs observed; nguồn bằng chứng.
- Khi bằng chứng không đủ, ghi "CHƯA XÁC MINH", tuyệt đối không suy diễn kết quả chạy thực tế.
- Tập trung các tình huống mất tiền: sai giá, vượt tồn, đầu vào hỏng; đề xuất tối đa 3 ca bổ sung có giá trị cao.
KẾT QUẢ MẪU:
${JSON.stringify(safe,null,2)}
ĐẦU RA NGẮN: (1) Phát hiện có bằng chứng; (2) Blind spots / nguy cơ chưa kiểm; (3) Tối đa 3 bước kiểm thử bổ sung; (4) Kết luận: chỉ audit logic giả lập, KHÔNG nghiệm thu AI thật.
Hãy trả lời tiếng Việt, không tiết lộ hay yêu cầu dữ liệu bí mật.`;
}
export function reportText({notes,severity,verdict,results,stamp}){
 const message=String(notes??'').trim().replace(/[\u0000-\u001f\u007f]/g,' ');
 if(message.length<12||message.length>1800)throw Error('INVALID_REVIEW_LENGTH');
 if(!['P0','P1','P2'].includes(severity))throw Error('INVALID_SEVERITY');
 if(!['needs_review','self_fail','blocked','self_pass'].includes(verdict))throw Error('INVALID_VERDICT');
 if(!Array.isArray(results)||results.length<1)throw Error('QA_NOT_EXECUTED');
 const passed=results.filter(r=>r.ok).length;
 return `QA-STUDIO/v1 [synthetic only] [${stamp}] Checked ${passed}/${results.length}. Severity ${severity}. Human verdict ${verdict}. External AI notes UNVERIFIED. ${message}`;
}
export function containsSensitive(text){
 const value=String(text??'');
 return /(?:sb_secret_|service_role|Bearer\s+\S{8}|ghp_[a-zA-Z0-9]{16}|sk-[a-zA-Z0-9_-]{18}|(?:\+84|0)\d{9,10})/i.test(value);
}
