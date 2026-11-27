import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CatalogTrial} from '../src/pages/CatalogTrial';
import {catalog} from '../../../qa/shop-lab/fixtures.mjs';
import {alternatives,confirmAlternative,draftRule,wholesale} from '../../../qa/shop-lab/options.mjs';
import evidence from '../../../qa/shop-lab/journey.json';
import './theme.css';
const money=n=>n.toLocaleString('vi-VN')+'đ';
const scenarios=[
 ['Ba áo cùng mẫu, khác màu',['đen','trắng','xanh'].map(color=>({sku:'A001',color}))],
 ['Hai áo',Array(2).fill({sku:'A001',color:'đen'})],
 ['Ba áo khác mẫu',['A001','A002','A003'].map(sku=>({sku,color:'đen'}))],
 ['Thiếu mã mẫu',[{sku:'',color:'đen'}]]];
function Lab(){
 const [shop,S]=useState('A'),[tab,T]=useState('Thử làm khách'),[books,B]=useState({A:catalog('A'),B:catalog('B')});
 const [index,I]=useState(1),[editing,E]=useState(false),[price,P]=useState(''),[stock,Q]=useState('');
 const [rules,R]=useState({A:[],B:[]}),[draft,D]=useState(null),[sentence,F]=useState('Đủ ba áo cùng mẫu thì tính sỉ, được trộn màu');
 const [amended,saveAmended]=useState({A:null,B:null});
 const [priority,Y]=useState(''),[selection,U]=useState(null),[note,N]=useState('');
 const rows=books[shop],row=rows[index],original=rows[2],history=rules[shop],current=history.at(-1);
 const picks=alternatives(rows,original,priority,200000);
 function reset(){D(null);Y('');U(null);E(false);N('');}
 const examples=rule=><ul>{scenarios.map(([label,items])=><li key={label}><b>{label}</b><br/>{wholesale(rule,items)}</li>)}</ul>;
 return <main><header className="bar"><b>TIEN404 <span>AI</span></b><label>Shop QA <select value={shop} onChange={e=>{S(e.target.value);I(1);reset();}}><option>A</option><option>B</option></select></label></header>
 <h1>Phòng thử của shop</h1><p className="sub">Danh mục thời trang mô phỏng · Thay đổi chỉ tồn tại trong phiên mở trang.</p>
 <nav>{['Thử làm khách','Đơn nháp','Dạy bot','Hết mẫu'].map(t=><button key={t} aria-pressed={t===tab} onClick={()=>{T(t);reset();}}>{t}</button>)}</nav>
 {tab==='Thử làm khách'&&<><label className="field">Sản phẩm và biến thể<select value={index} onChange={e=>{I(Number(e.target.value));E(false);}}>{rows.map((r,i)=><option key={i} value={i}>{r.sku} · {r.color} · size {r.size}</option>)}</select></label>
 {editing&&<form onSubmit={e=>{e.preventDefault();B({...books,[shop]:rows.map((v,i)=>i===index?{...v,price:Number(price),stock:Number(stock)}:v)});E(false);}}>
 <label>Đơn giá (đ)<input type="number" min="0" max="1000000000" required value={price} onChange={e=>P(e.target.value)}/></label>
 <label>Tồn kho<input type="number" min="0" max="999999" required value={stock} onChange={e=>Q(e.target.value)}/></label><button>Lưu vào catalog QA</button></form>}
 <CatalogTrial key={shop+'-'+index+'-'+JSON.stringify(rows)} row={row} rows={rows} onEdit={()=>{P(String(row.price));Q(String(row.stock));E(true);}}/></>}
 {tab==='Đơn nháp'&&<><h2>Hộp duyệt · Shop {shop}</h2><p>Bản ghi từ lần chạy SQLite QA, tại thời điểm khách vừa chốt.</p>
 {shop==='A'?<article><strong>{evidence.owner.sku} · Áo đen size {evidence.owner.size}</strong><p>{evidence.owner.qty} chiếc · {money(evidence.owner.total)}</p></article>:<article>Shop B có 0 yêu cầu chờ.</article>}
 {shop==='A'&&<details><summary>Hội thoại và kết quả từng lượt của shop A</summary><ol>{evidence.trace.map((x,i)=><li key={i}><b>{x.input}</b><br/>{x.reply}</li>)}</ol></details>}</>}
 {tab==='Dạy bot'&&<><h2>Ba áo khác màu có được tính sỉ?</h2><p>Quy tắc đang dùng · {current?'lần duyệt '+history.length:'chưa thiết lập'}</p>
 <label>Câu trả lời của chủ<textarea value={sentence} onChange={e=>{F(e.target.value);D(null);N('');}}/></label>
 <button onClick={()=>{const r=draftRule(sentence);D(r);N(r?'':'Chưa diễn giải được. Ví dụ: “Ba áo cùng mẫu, phải cùng màu”.');}}>Soạn quy tắc nháp</button>
 {draft&&<article><b>Xem trước · {draft.sentence}</b>{examples(draft)}<button onClick={()=>{R({...rules,[shop]:[...history,draft]});D(null);}}>Duyệt cho shop {shop}</button></article>}
 {current&&<article><b>Đã duyệt · {current.sentence}</b>{examples(current)}<button onClick={()=>R({...rules,[shop]:history.slice(0,-1)})}>Hoàn tác lần duyệt cuối</button></article>}</>}
 {tab==='Hết mẫu'&&<><h2>{original.sku} · Áo polo đen size L</h2><p>Ngân sách dưới 200.000đ · tồn {original.stock}. {original.stock===0?'Bạn muốn giữ màu hay giữ kiểu?':'Mẫu đang có hàng.'}</p>
 {original.stock===0&&<><button onClick={()=>{Y('color');U(null);N('');}}>Giữ màu đen</button> <button onClick={()=>{Y('style');U(null);N('');}}>Giữ kiểu polo</button>
 {priority&&!picks.length&&<p>Chưa có mẫu phù hợp. Bạn có thể gọi nhân viên.</p>}
 {picks.map(r=><article key={r.sku}><b>{r.sku} · {r.style} {r.color}</b><p>Size {r.size} · {money(r.price)} · còn {r.stock}. {r.color===original.color?'Đổi kiểu áo.':'Đổi màu áo.'}</p><button onClick={()=>{U({...r});N('');}}>Chọn mẫu này</button></article>)}
 {selection&&<button onClick={()=>{const next=confirmAlternative(rows,original,priority,200000,selection);if(next) saveAmended({...amended,[shop]:next});N(next?'Đã cập nhật yêu cầu thử.':'Giá hoặc tồn đã đổi. Vui lòng chọn lại.');U(null);}}>Xác nhận đổi sang {selection.sku}</button>}</>}</>}
 {tab==='Hết mẫu'&&amended[shop]&&<article><b>Yêu cầu thử · Shop {shop}</b><p>{amended[shop].sku} · {amended[shop].color} · size {amended[shop].size} × 1 · {money(amended[shop].total)}</p></article>}
 {note&&<p role="status">{note}</p>}</main>;
}
createRoot(document.getElementById('root')).render(<Lab/>);
