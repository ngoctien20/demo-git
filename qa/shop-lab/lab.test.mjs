import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from './fixtures.mjs';
import {audit} from './checks.mjs';
import {draftRule,wholesale,alternatives,confirmAlternative} from './options.mjs';
test('hai catalog, năm câu thử độc lập, giá sửa hai lần, hết hàng và trường thiếu size',()=>{
 const a=catalog('A'),b=catalog('B');
 for(const price of [159000,170000,165000]){
   a[1].price=price;const before=JSON.stringify(a);
   const results=audit(a[1],a);
   assert.deepEqual(results.map(r=>r.grade),['Đạt','Đạt','Đạt','Chưa thử','Đạt']);
   assert.match(results[1].reply,new RegExp((price*2).toLocaleString('vi-VN')));
   assert.match(audit(b[1],b,1)[0].reply,/378.000đ/);
   assert.equal(JSON.stringify(a),before);
 }
 assert.equal(audit(a[2],a,3)[0].grade,'Đạt');
 assert.equal(audit({...a[0],size:''},a,2)[0].grade,'Chưa thử');
});
test('quy tắc nháp và ngoại lệ',()=>{
 const a=draftRule('Đủ ba áo cùng mẫu thì tính sỉ, được trộn màu'),b=draftRule('Ba áo cùng mẫu, phải cùng màu');
 const items=['đen','trắng','đỏ'].map(color=>({sku:'A001',color}));
 assert.match(wholesale(a,items),/^Đủ/);assert.match(wholesale(b,items),/^Chưa đủ/);
 assert.match(wholesale(a,items.slice(1)),/^Chưa đủ/);
 assert.match(wholesale(a,items.map((r,i)=>({...r,sku:String(i)}))),/^Chưa đủ/);
 assert.match(wholesale(a,[{sku:''}]),/mã mẫu/);assert.equal(draftRule('Đủ ba áo khác mẫu'),null);
});
test('hết mẫu: hai, một, không còn lựa chọn; giá hoặc tồn đổi sau khi chọn',()=>{
 const rows=catalog('A'),o=rows[2];
 const picks=alternatives(rows,o,'color',200000);
 assert.equal(picks.length,2);assert.equal(alternatives(rows,o,'style',200000).length,1);
 const selected={...picks[0]};
 assert.equal(confirmAlternative(rows,o,'color',200000,selected).sku,selected.sku);
 picks[0].price++;assert.equal(confirmAlternative(rows,o,'color',200000,selected),null);
 picks.forEach(r=>r.stock=0);assert.deepEqual(alternatives(rows,o,'color',200000),[]);
 assert.equal(confirmAlternative(rows,o,'color',200000,selected),null);
});
