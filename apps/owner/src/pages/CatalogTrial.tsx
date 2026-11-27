import {useState} from 'react';
import {audit} from '../../../../qa/shop-lab/checks.mjs';
export type TrialRow={sku:string;price:number;stock:number;color:string;size:string;style?:string};
export function CatalogTrial({row,rows,onEdit}:{row:TrialRow;rows:TrialRow[];onEdit:()=>void}) {
  const [results,setResults]=useState(()=>audit(row,rows));
  return <section aria-label="Thử làm khách"><p>Adapter tư vấn QA · chỉ đọc danh mục</p>
    {results.map((result,i)=><article key={i} className="trial-result">
      <header><b>{result.question}</b><small>{result.grade}</small></header>
      <p>{result.reply}</p><p className="muted">Đối chiếu · {result.source}</p>
      <button type="button" onClick={()=>setResults(old=>old.map((r,j)=>j===i?audit(row,rows,i)[0]:r))}>Thử lại câu này</button>
    </article>)}<button type="button" onClick={onEdit}>Sửa sản phẩm {row.sku}</button></section>;
}
