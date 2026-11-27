// Replays source dialogues through the candidate. Only supported scenarios have an acceptance oracle.
import {execFileSync} from 'node:child_process';
import {createQaShopBook} from './draft-store.mjs';
const source=process.argv[2];
if (!source) throw Error('Supply the project multi-turn CSV path');
const rows=JSON.parse(execFileSync('python3',['-c',
  "import csv,json,sys; print(json.dumps(list(csv.DictReader(open(sys.argv[1],encoding='utf-8-sig')))))",source]));
const contact='Tên Khách QA, SĐT 0000000000, địa chỉ 18 Đường Mẫu';
const expected={
  QA01:['catalog_answer','catalog_answer'],
  QA02:['catalog_answer','estimate','browsing'],
  QA03:['no_match'],
  QA04:['ask_variant','ask_variant'],
  QA05:['ask_contact','summary','pending_owner'],
  QA06:['ask_contact','summary','on_hold'],
  QA07:['ask_contact','summary','summary','pending_owner'],
  QA08:['ask_contact','summary','pending_owner','pending_owner'],
  QA09:['reconfirm_stock','reconfirm_stock'],
  QA10:['ask_contact','ask_contact'],
};
const seen=new Set();
console.log('case_id,turn,status,drafts,stock,assertion,scope');
for (const {case_id:id,mode,turns_json} of rows) {
  if (seen.has(id)) throw Error('duplicate case '+id);
  seen.add(id);
  const book=createQaShopBook({shops:[{page:'A',owner:'owner'}],
    variants:[{page:'A',sku:'T-A',size:'M',color:'trắng',price:159000,stock:8},
      {page:'A',sku:'T-B',size:'M',color:'đen',price:179000,stock:3},
      {page:'A',sku:'T-C',size:'L',color:'đỏ',price:180000,stock:6},
      {page:'A',sku:'T-D',size:'L',color:'xanh',price:79000,stock:0}]});
  let draftId;
  for (const [i,raw] of JSON.parse(turns_json).entries()) {
    if(mode!=='dialogue') {
      console.log([id,i+1,'NOT_RUN','','','NOT_RUN',mode+'_writer_required'].join(','));
      continue;
    }
    const text=raw.replaceAll('{contact}',contact).replaceAll('{order}','QA-ORDER-1').replaceAll('{old}','0000000000');
    const reply=book.customerMessage({page:'A',sender:'customer',event:String(i)},{text});
    const drafts=book.inbox('owner');
    const inventory=book.customerMessage({page:'A',sender:'observer',event:String(i)},{text:'Xem sản phẩm'}).rows;
    const stocks=inventory.map(r=>r.stock);
    const stock=stocks[0];
    let grade='UNSUPPORTED';
    if(expected[id]) {
      const status=expected[id][i];
      const qty=id==='QA05' || ((id==='QA06' || id==='QA07') && i<2) ? 2 : 1;
      let ok=reply.status===status && stock===8 && drafts.length===Number(status==='pending_owner');
      if (id<='QA04') {
        ok &&= stocks.join(',')==='8,3,6,0' && typeof reply.text==='string' && reply.text.length>0;
        if(status==='catalog_answer') {
          const wanted=id==='QA01' ? ['T-A','T-B'] : ['T-A'];
          ok &&= reply.rows?.map(r=>r.sku).join(',')===wanted.join(',') &&
            wanted.every(sku=>{
              const row=inventory.find(r=>r.sku===sku);
              return reply.text.includes(sku) && reply.text.includes(row.price.toLocaleString('vi-VN')+'đ') &&
                reply.text.includes('còn '+row.stock+' cái');
            });
        }
        if(status==='estimate') ok &&= reply.total===318000 && reply.text.includes('318.000đ');
        if(status==='ask_variant') ok &&= reply.text.includes('mã mẫu');
        if(status==='no_match') ok &&= !reply.rows?.length && reply.text.includes('chưa tìm thấy');
      }
      if(status==='summary') ok &&= reply.qty===qty && reply.total===qty*159000 && reply.sku==='T-A';
      if(status==='pending_owner') {
        const d=drafts[0];
        ok &&= d?.qty===qty && d.price===159000 && d.contact===contact && d.sku==='T-A' &&
          d.approved===0 && reply.id===d.id && (draftId===undefined || draftId===reply.id);
        draftId=reply.id;
      }
      grade=ok?'PASS':'FAIL';
      if(!ok) process.exitCode=1;
    }
    console.log([id,i+1,reply.status,drafts.length,stock,grade,'offline_sqlite'].join(','));
  }
  book.close();
}
