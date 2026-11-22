const it=$input.first();
let b64='',mime='audio/aac',err='';
try{const bin=it.binary&&it.binary.data;if(!bin)throw Error('no audio');mime=bin.mimeType&&bin.mimeType.startsWith('audio/')?bin.mimeType:'audio/aac';const buf=await this.helpers.getBinaryDataBuffer(0,'data');if(buf.length>5*1024*1024)throw Error('audio too large');b64=buf.toString('base64');}catch(e){err=String(e.message||e).slice(0,60)}
if(err)return [{json:{error:'tải ghi âm lỗi: '+err}}];
// Context biasing: tell the recogniser which product codes and phrases to expect (like phrase hints in big ASR systems).
const prompt=['Bạn là bộ nhận giọng nói tiếng Việt cho chủ một shop thời trang thử nghiệm.',
'Mã sản phẩm hợp lệ: F01 (đọc là "ép không một", "ép một" hoặc "F01").',
'Câu thường gặp: "Giá F01 bao nhiêu", "F01 còn không", "Mua F01", "Lấy F01 hai cái", "Mua F01 3 cái".',
'Lưu ý: "mua" hay bị nghe nhầm thành "mo", "mu" hoặc "một" khi đứng ngay trước mã.',
'Việc của bạn: 1) chép lại nguyên văn câu nói (transcript); 2) xác định ý định: price (hỏi giá/còn hàng), buy (muốn mua/lấy/đặt), unknown; 3) mã sản phẩm (sku) nếu có; 4) số lượng (quantity) là số nguyên nếu người nói nêu rõ, ngược lại null; 5) độ chắc chắn (confidence) high/medium/low.',
'Không đoán số lượng. Nếu nghe không rõ, đặt confidence là low.'].join('\n');
const schema={type:'OBJECT',properties:{transcript:{type:'STRING'},intent:{type:'STRING',enum:['price','buy','unknown']},sku:{type:'STRING',nullable:true},quantity:{type:'INTEGER',nullable:true},confidence:{type:'STRING',enum:['high','medium','low']}},required:['transcript','intent','confidence']};
return [{json:{gemini_body:{contents:[{role:'user',parts:[{inline_data:{mime_type:mime,data:b64}},{text:prompt}]}],generationConfig:{maxOutputTokens:400,temperature:0,responseMimeType:'application/json',responseSchema:schema}}}}];
