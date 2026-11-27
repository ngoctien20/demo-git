// Replays source dialogues through the candidate. Only supported scenarios have an acceptance oracle.
import {isDeepStrictEqual} from 'node:util';
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
  QA11:['change_preview','change_saved'], QA12:['change_preview','change_saved'],
  QA13:['ask_valid_phone','ask_clarification'], QA14:['change_preview','change_cancelled'],
  QA15:['change_preview','change_saved'], QA16:['change_preview','change_saved'],
  QA17:['ask_valid_address'], QA18:['unverified_order'], QA19:['change_preview','change_preview','change_saved'],
  QA20:['line_preview','line_saved'], QA21:['line_preview','line_saved'], QA22:['line_preview','line_saved'],
  QA23:['line_preview','reconfirm_price'], QA24:['line_preview','reconfirm_stock'],
  QA31:['ask_valid_name','ask_clarification'], QA32:['ask_valid_address','ask_clarification'],
};
const seen=new Set();
console.log('case_id,turn,status,drafts,stock,assertion,scope,reply_total,expected_total,draft_sku,draft_qty,draft_total');
for (const {case_id:id,mode,turns_json} of rows) {
  if (seen.has(id)) throw Error('duplicate case '+id);
  seen.add(id);
  const book=createQaShopBook({shops:[{page:'A',owner:'owner'}],
    variants:[{page:'A',sku:'T-A',size:'M',color:'trắng',price:159000,stock:8},
      {page:'A',sku:'T-B',size:'M',color:'đen',price:179000,stock:3},
      {page:'A',sku:'T-C',size:'L',color:'đỏ',price:180000,stock:6},
      {page:'A',sku:'T-D',size:'L',color:'xanh',price:79000,stock:0}]});
  const editing=(id>='QA11' && id<='QA19') || ['QA31','QA32'].includes(id);
  const pricing=id>='QA20' && id<='QA24';
  const white={sku:'T-A',size:'M',color:'trắng'};
  const red={sku:'T-C',size:'L',color:'đỏ'};
  if (editing || pricing) {
    for (const [i,text] of ['Lấy T-A x2',contact,'đồng ý'].entries())
      book.customerMessage({page:'A',sender:'customer',event:'setup-'+i},{text});
  }
  if (pricing) {
    book.changePrice('owner',{sku:'T-B',size:'M',color:'đen'},159000);
    book.changePrice('owner',red,210000);
    if (id==='QA21') book.changePrice('owner',white,200000);
  }
  const baseline=book.inbox('owner')[0];
  let draftId;
  for (const [i,raw] of JSON.parse(turns_json).entries()) {
    if(mode!=='dialogue') {
      console.log([id,i+1,'NOT_RUN','','','NOT_RUN',mode+'_writer_required','','','','',''].join(','));
      continue;
    }
    const text=raw.replaceAll('{contact}',contact).replaceAll('{order}','QA-ORDER-1').replaceAll('{old}','0000000000');
    if (i===1 && id==='QA23') book.changePrice('owner',red,220000);
    if (i===1 && id==='QA24') book.changeStock('owner',white,2);
    const reply=book.customerMessage({page:'A',sender:'customer',event:String(i)},{text});
    const drafts=book.inbox('owner');
    const inventory=book.customerMessage({page:'A',sender:'observer',event:String(i)},{text:'Xem sản phẩm'}).rows;
    const stocks=inventory.map(r=>r.stock);
    const stock=stocks[0];
    let grade='UNSUPPORTED';
    if(expected[id]) {
      const status=expected[id][i];
      const qty=id==='QA05' || ((id==='QA06' || id==='QA07') && i<2) ? 2 : 1;
      let ok=reply.status===status && stock===(id==='QA24' && i===1 ? 2 : 8) && drafts.length===((editing || pricing) ? 1 : Number(status==='pending_owner'));
      if (pricing) {
        const target=id==='QA20' ? {sku:'T-B',color:'đen',size:'M'} : ['QA21','QA24'].includes(id) ? white : red;
        const quantity=target===white ? 3 : 2;
        const price=target===red ? (id==='QA23' && i===1 ? 220000 : 210000) : 159000;
        const saved=status==='line_saved';
        const after=saved ? {...baseline,...target,qty:quantity,price,edit_version:1,
          catalog_price_at_edit:id==='QA21' ? 200000 : price} : {...baseline};
        ok &&= isDeepStrictEqual({...drafts[0]},after) && stocks.slice(1).join(',')==='3,6,0';
        if (status==='reconfirm_stock') ok &&= reply.stock===2;
        else ok &&= reply.sku===target.sku && reply.size===target.size && reply.color===target.color &&
          reply.price===price && reply.qty===quantity && reply.total===quantity*price;
        if (saved) ok &&= reply.expected_total===quantity*price;
      }
      if (editing) {
        const saved=status==='change_saved';
        const field=['QA11','QA12','QA14'].includes(id) ? 'phone' : id==='QA15' ? 'name' : 'address';
        const value=field==='phone' ? '0987654321' : field==='name' ? 'Khách Mới' :
          (id==='QA19' && i>0 ? '19' : '18')+' Đường Mẫu, Xã Thử';
        const updated=field==='phone' ? contact.replace('0000000000',value) :
          field==='name' ? contact.replace('Khách QA',value) : contact.replace('18 Đường Mẫu',value);
        ok &&= isDeepStrictEqual({...drafts[0]}, {...baseline,edit_version:Number(saved),contact:saved ? updated : contact})
          && stocks.join(',')==='8,3,6,0';
        if (saved || status==='change_preview') ok &&= reply.order==='QA-ORDER-1' && reply.field===field && reply.value===value;
        if (status==='unverified_order') ok &&= Object.keys(reply).length===1;
      }
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
    const draft=drafts.length===1 ? drafts[0] : null;
    console.log([id,i+1,reply.status,drafts.length,stock,grade,'offline_sqlite',
      reply.total,reply.expected_total,draft?.sku,draft?.qty,draft ? draft.price*draft.qty : null].join(','));
  }
  book.close();
}
