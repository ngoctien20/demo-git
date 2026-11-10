// TIEN404 Website V4.1 static navigation regression (read-only).
// Run: node scripts/check-site-navigation.mjs
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const pages=[
'index.html','solutions.html','demo.html','pricing.html','contact.html',
'lab.html','faq.html','about.html','onboarding.html','industries.html',
'login.html','register.html','checkout.html',
'industry-fashion.html','industry-beauty.html','industry-accessories.html',
'industry-ecommerce.html','industry-services.html',
'impact.html','privacy.html','terms.html','refund.html','dashboard.html','billing.html'
];
const expected=['Trang chủ','Tính năng','Thử AI','Bảng giá','Liên hệ','Đăng nhập'];
let errors=[];
for(const p of pages){
 const file=path.join(root,p);
 if(!fs.existsSync(file)){errors.push(p+': missing');continue}
 const html=fs.readFileSync(file,'utf8');
 const menu=html.match(/<nav aria-label="Điều hướng chính"[\s\S]*?<\/nav>/)?.[0];
 if(!menu){errors.push(p+': navigation missing');continue}
 const labels=[...menu.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)]
 .map(x=>x[1].replace(/<[^>]*>/g,'').replace(/↗/g,'').trim());
 if(labels.length!==expected.length || labels.some((x,i)=>x!==expected[i])){
   errors.push(p+': incorrect menu '+JSON.stringify(labels));
 }
 if(menu.includes('href="onboarding.html"')||menu.includes('href="industries.html"')){
   errors.push(p+': optional industry/setup links must not be in primary nav');
 }
}
const solutions=fs.readFileSync(path.join(root,'solutions.html'),'utf8');
if(!solutions.includes('href="industries.html"')||!solutions.includes('href="onboarding.html"')){
 errors.push('solutions.html: missing links to preserved specialist experiences');
}
const onboarding=fs.readFileSync(path.join(root,'onboarding.html'),'utf8');
if(!onboarding.includes('data-v4-wizard'))errors.push('onboarding.html: interactive wizard missing');
const industries=fs.readFileSync(path.join(root,'industries.html'),'utf8');
if(!industries.includes('industry-fashion.html'))errors.push('industries.html: industry cards missing');
if(errors.length){for(const e of errors)console.error('FAIL '+e);process.exit(1)}
console.log('PASS '+pages.length+' public pages share simplified navigation; preserved optional experiences.');
