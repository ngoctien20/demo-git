#!/usr/bin/env node
/** TIEN404 Auth-only Render preview build. No private repo files or demo data deployed.
 * Output is PUBLIC STATIC; Supabase RLS remains the authorization for tenant data.
 */
import { mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'auth-preview-dist');
const allowList=[
  'login.html','account.html',
  'assets/style.css','assets/auth.css','assets/favicon.svg',
  'assets/app.js','assets/site-config.js',
  'assets/auth-config.js','assets/auth-client.js','assets/auth-login.js',
  'assets/auth-account.js','assets/auth-helpers.mjs'
];
const production='https://ngoctien20.github.io/demo-git/';
if(!existsSync(path.join(root,'assets/auth-client.js')))throw Error('Auth source missing');
rmSync(output,{recursive:true,force:true});
mkdirSync(path.join(output,'assets'),{recursive:true});
for(const relative of allowList){
  const from=path.join(root,relative),to=path.join(output,relative);
  if(!existsSync(from))throw Error('Required preview asset missing: '+relative);
  copyFileSync(from,to);
}
for(const page of ['login.html','account.html']){
  const target=path.join(output,page);
  let html=readFileSync(target,'utf8');
  // Marketing links go to the existing public site, local auth links stay in preview.
  html=html.replace(/href="([a-z0-9-]+\.html)(#[^"]*)?"/g,(full,basename,hash='')=>
    ['login.html','account.html'].includes(basename)
      ?full:'href="'+production+basename+hash+'"');
  if(page==='login.html'){
    // Recovery stays closed until the allowlist and callback are both verified.
    // Block broken recovery emails on Render until its exact URL is allowlisted.
    html=html.replace('id="auth-forgot-password"',
      'id="auth-forgot-password" disabled title="Khôi phục qua email đang tạm khóa trên staging"');
    html=html.replace(/(<span id="auth-recovery-note">).*?(<\/span>)/,
      '$1Khôi phục qua email đang tạm khóa trên bản thử nghiệm. Nếu cần hỗ trợ, chọn Yêu cầu hỗ trợ truy cập.$2');
  }
  if(!html.includes('name="robots"'))html=html.replace('</head>','<meta name="robots" content="noindex,nofollow"></head>');
  writeFileSync(target,html,'utf8');
}
const index='<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="refresh" content="0;url=login.html"><title>TIEN404 Auth Staging</title></head><body><p>TIEN404 Auth staging preview — <a href="login.html">Mở đăng nhập thử nghiệm</a></p></body></html>';
writeFileSync(path.join(output,'index.html'),index,'utf8');
writeFileSync(path.join(output,'404.html'),'<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Staging preview</title></head><body><p>Đường dẫn thử nghiệm không tồn tại. <a href="/login.html">Mở đăng nhập</a></p></body></html>');
writeFileSync(path.join(output,'robots.txt'),'User-agent: *\nDisallow: /\n');
console.log('Built staging-only Auth preview: '+allowList.length+' allowlisted assets plus index/404/robots.');
console.log('No data exports, .env, production Orders, dashboards or administrator application.');
