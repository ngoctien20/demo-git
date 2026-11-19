'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const m=require('./owner-linked-export.cjs');
function fixture(){
 const base=fs.mkdtempSync(path.join(os.homedir(),'t404-v18615-'));
 const root=path.join(base,'project');const output=path.join(base,'private');fs.mkdirSync(path.join(root,'supabase','.temp'),{recursive:true});fs.mkdirSync(output);
 fs.writeFileSync(path.join(root,'supabase','config.toml'),'project_id = "synthetic"\n');fs.writeFileSync(path.join(root,'supabase','.temp','project-ref'),m.EXPECTED_REF+'\n');
 return {base,root,output,cleanup:()=>fs.rmSync(base,{recursive:true,force:true})};
}
function check(f,opts={}){return m.preflight({projectRoot:f.root,outputDir:f.output,...opts},{env:{}})}
test('target is staging only',()=>assert.equal(m.EXPECTED_REF,'ifxlvrhyjhbzbrkdsida'));
test('help parser has no network effects',()=>assert.equal(m.parseArgs(['--help']).help,true));
test('default behavior is not --execute',()=>assert.equal(m.parseArgs([]).execute,false));
test('explicit execute parsed but cannot bypass preflight',()=>assert.equal(m.parseArgs(['--execute']).execute,true));
test('unknown arguments refused',()=>assert.throws(()=>m.parseArgs(['--db-url','x']),/UNKNOWN_ARGUMENT/));
test('relative output refused',()=>{const f=fixture();try{assert.throws(()=>check(f,{outputDir:'./x'}),/ABSOLUTE_PATHS_REQUIRED/);}finally{f.cleanup()}});
test('valid linked project marker accepted',()=>{const f=fixture();try{assert.equal(check(f).linkedCorrect,true)}finally{f.cleanup()}});
test('wrong project link refused',()=>{const f=fixture();try{fs.writeFileSync(path.join(f.root,'supabase','.temp','project-ref'),'other');assert.throws(()=>check(f),/WRONG_LINKED_PROJECT/)}finally{f.cleanup()}});
test('missing link refused',()=>{const f=fixture();try{fs.unlinkSync(path.join(f.root,'supabase','.temp','project-ref'));assert.throws(()=>check(f),/LINKED_PROJECT_MARKER_NOT_FOUND/)}finally{f.cleanup()}});
test('missing config refused',()=>{const f=fixture();try{fs.unlinkSync(path.join(f.root,'supabase','config.toml'));assert.throws(()=>check(f),/SUPABASE_LOCAL_CONFIG_NOT_FOUND/)}finally{f.cleanup()}});
test('output inside repository refused',()=>{const f=fixture();try{const inside=path.join(f.root,'out');fs.mkdirSync(inside);assert.throws(()=>check(f,{outputDir:inside}),/EXPORT_MUST_BE_OUTSIDE_PROJECT/)}finally{f.cleanup()}});
test('output folder cannot be ancestor of repository',()=>{const f=fixture();try{assert.throws(()=>check(f,{outputDir:f.base}),/EXPORT_MUST_BE_OUTSIDE_PROJECT/)}finally{f.cleanup()}});
test('nonempty destination refused',()=>{const f=fixture();try{fs.writeFileSync(path.join(f.output,'data.sql'),'x');assert.throws(()=>check(f),/OUTPUT_MUST_BE_EMPTY_NO_OVERWRITE/)}finally{f.cleanup()}});
test('cloud synced folder refused',()=>{const f=fixture();try{const d=path.join(f.base,'OneDrive');fs.mkdirSync(d);assert.throws(()=>check(f,{outputDir:d}),/SYNC_OR_SYSTEM_FOLDER_FORBIDDEN/)}finally{f.cleanup()}});
test('ci execution refused',()=>{const f=fixture();try{assert.throws(()=>m.preflight({projectRoot:f.root,outputDir:f.output},{env:{CI:'true'}}),/CI_EXPORT_FORBIDDEN/)}finally{f.cleanup()}});
test('github actions execution refused',()=>{const f=fixture();try{assert.throws(()=>m.preflight({projectRoot:f.root,outputDir:f.output},{env:{GITHUB_ACTIONS:'true'}}),/CI_EXPORT_FORBIDDEN/)}finally{f.cleanup()}});
test('password environment refused',()=>{const f=fixture();try{assert.throws(()=>m.preflight({projectRoot:f.root,outputDir:f.output},{env:{PGPASSWORD:'secret'}}),/SECRET_ENV_VARIABLES_NOT_ALLOWED/)}finally{f.cleanup()}});
test('DATABASE_URL environment refused',()=>{const f=fixture();try{assert.throws(()=>m.preflight({projectRoot:f.root,outputDir:f.output},{env:{DATABASE_URL:'secret'}}),/SECRET_ENV_VARIABLES_NOT_ALLOWED/)}finally{f.cleanup()}});
test('linked dump args never have urls',()=>{const commands=m.dumpCommands('/dummy');assert.equal(commands.length,3);for(const a of commands){assert(m.commandSafety(a));assert(a.includes('--linked'));assert(!a.includes('--db-url'))}});
test('role-only and data-only separately declared',()=>{const c=m.dumpCommands('/dummy');assert(c[0].includes('--role-only'));assert(c[2].includes('--data-only'));assert(c[2].includes('--use-copy'))});
test('db push cannot pass safety',()=>assert.throws(()=>m.commandSafety(['db','push','--linked']),/DUMP_ONLY_LINKED_CLI/));
test('external URL cannot pass safety',()=>assert.throws(()=>m.commandSafety(['db','dump','--linked','--db-url','postgresql://x']),/DUMP_ONLY_LINKED_CLI/));
test('empty or missing dump refused',()=>{const f=fixture();try{assert.throws(()=>m.verifyOutputs(f.output),/DUMP_FILE_MISSING/);fs.writeFileSync(path.join(f.output,'roles.sql'),'');assert.throws(()=>m.verifyOutputs(f.output),/DUMP_FILE_INVALID/)}finally{f.cleanup()}});
test('three synthetic files produce hashes',()=>{const f=fixture();try{for(const name of m.DUMP_FILES)fs.writeFileSync(path.join(f.output,name),'synthetic only '+name);const x=m.verifyOutputs(f.output);assert.equal(x.length,3);assert(x.every(z=>z.sha256.length===64));assert(!JSON.stringify(x).includes('postgresql://'))}finally{f.cleanup()}});
test('report explicitly does not claim restore',()=>{const x=m.publicResult([]);assert.equal(x.liveBackupVerified,false);assert.equal(x.isolatedRestoreVerified,false);assert.equal(x.productionReady,false)});
test('source never contains migration calls',()=>{const s=fs.readFileSync(path.join(__dirname,'owner-linked-export.cjs'),'utf8');assert(!/spawnSync\([^)]*db push/i.test(s));assert(!s.includes('service_role'));assert(!s.includes('restore_project'));});

// V18.6.16 — actual Windows semantics and arbitrary checkout/sync controls.
test('Windows containment comparison is case-insensitive',()=>{
 assert.equal(m.isWithin('C:\\SHOP\\SAFE\\backup','c:\\shop\\safe','win32'),true);
 assert.equal(m.isWithin('C:\\SHOP\\SAFE2','c:\\shop\\safe','win32'),false);
});
test('reject output inside any other Git checkout, not just projectRoot',()=>{
 const f=fixture();try{const second=path.join(f.base,'unrelated-app');const d=path.join(second,'private-backup');fs.mkdirSync(path.join(second,'.git'),{recursive:true});fs.mkdirSync(d);assert.throws(()=>check(f,{outputDir:d}),/GIT_CHECKOUT_FORBIDDEN/);}finally{f.cleanup()}
});
test('reject output in a Git worktree with .git marker file',()=>{
 const f=fixture();try{const second=path.join(f.base,'worktree');const d=path.join(second,'private');fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(second,'.git'),'gitdir: ../.git/worktrees/x');assert.throws(()=>check(f,{outputDir:d}),/GIT_CHECKOUT_FORBIDDEN/);}finally{f.cleanup()}
});
test('deny Windows OneDrive - company and Downloads directories',()=>{
 const f=fixture();try{for(const name of ['OneDrive - Acme','Downloads','iCloud Drive','Google Drive','AppData','temp']){
 const d=path.join(f.base,name);fs.mkdirSync(d);assert.throws(()=>check(f,{outputDir:d}),/SYNC_OR_SYSTEM_FOLDER_FORBIDDEN/,name);
 }}finally{f.cleanup()}
});
test('SHA256 of large synthetic file uses chunked reads, never fs.readFileSync',()=>{
 const f=fixture();try{for(const name of m.DUMP_FILES){const size=name==='data.sql'?18*1024*1024:128;fs.writeFileSync(path.join(f.output,name),Buffer.alloc(size,name==='data.sql'?0x61:0x62));}
 const guard={...fs,readFileSync(){throw Error('UNBOUNDED_READ_FORBIDDEN')}};
 const out=m.verifyOutputs(f.output,guard);
 assert.equal(out.find(x=>x.name==='data.sql').bytes,18*1024*1024);
 const expected=require('node:crypto').createHash('sha256').update(Buffer.alloc(18*1024*1024,0x61)).digest('hex');
 assert.equal(out.find(x=>x.name==='data.sql').sha256,expected);
 }finally{f.cleanup()}
});
test('selected output symlink/junction is rejected',t=>{
 const f=fixture();try{const alias=path.join(f.base,'backup-link');try{fs.symlinkSync(f.output,alias,process.platform==='win32'?'junction':'dir')}catch(e){if(['EPERM','ENOTSUP','EACCES'].includes(e.code)){t.skip('symlinks unavailable on runner');return;}throw e;}
 assert.throws(()=>check(f,{outputDir:alias}),/OUTPUT_LINK_NOT_ALLOWED/);
 }finally{f.cleanup()}
});
