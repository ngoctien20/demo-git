'use strict';
// Client-side package comparison ONLY. This does NOT grant rights, publish bot, charge or authenticate.
(async function initPackageResearchPreview(){
  const select=document.getElementById('packagePreviewSelect');
  const status=document.getElementById('packagePreviewStatus');
  const list=document.getElementById('packagePreviewFeatures');
  const description=document.getElementById('packagePreviewDescription');
  if(!select||!status||!list||!description)return;
  const setStatus=(text)=>{status.textContent=text};
  setStatus('ĐANG TẢI MẪU NGHIÊN CỨU — KHÔNG PHẢI QUYỀN ĐÃ CẤP');
  let manifest;
  try{
    const response=await fetch('../../v134r/plan-catalog.json',{
      method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error'
    });
    if(!response.ok)throw Error('CATALOG_UNAVAILABLE');
    manifest=await response.json();
    if(manifest?.status!=='RESEARCH_ONLY'||!Array.isArray(manifest.plans)||
       !Array.isArray(manifest.features)||manifest.plans.length!==3)
       throw Error('CATALOG_INVALID');
  }catch{
    setStatus('KHÔNG TẢI ĐƯỢC MẪU GÓI — KHÔNG TỰ CẤP QUYỀN');
    return;
  }
  const labels=new Map(manifest.features.map(item=>[item.key,item.label]));
  for(const p of manifest.plans){
    const option=document.createElement('option');
    option.value=p.code;option.textContent=p.label;
    select.appendChild(option);
  }
  function draw(){
    const plan=manifest.plans.find(item=>item.code===select.value);
    list.replaceChildren();
    if(!plan)return setStatus('KHÔNG XÁC ĐỊNH GÓI');
    description.textContent=plan.overview;
    for(const key of plan.features){
      const li=document.createElement('li');
      li.textContent=labels.get(key)||key;list.appendChild(li);
    }
    for(const key of plan.conditional_features){
      const li=document.createElement('li');
      li.textContent=(labels.get(key)||key)+' — chỉ khi có hợp đồng và quyền provider đã xác minh';
      list.appendChild(li);
    }
    const price=plan.price_status==='QUOTE_ONLY'
      ?'Báo giá theo hợp đồng':plan.price_vnd_hypothesis?.toLocaleString('vi-VN')+'đ/tháng (giá nghiên cứu)';
    setStatus(plan.label+' · '+price+' · MẪU QUYỀN LỢI — KHÔNG CẤP QUYỀN');
  }
  select.addEventListener('change',draw);
  select.value='SALES_LITE';
  draw();
})();
