'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const m=require('./guided-readiness.cjs');
function fixture(){
 const base=fs.mkdtempSync(path.join(process.platform==='win32'?(process.env.USERPROFILE||os.homedir()):os.tmpdir(),'t404-v18619-'));
 const project=path.join(base,'linked-project'),output=path.join(base,'private-output');
 fs.mkdirSync(path.join(project,'supabase','.temp'),{recursive:true});fs.mkdirSync(output);
 fs.writeFileSync(path.join(project,'supabase','config.toml'),'project_id = "synthetic"\n');
 fs.writeFileSync(path.join(project,'supabase','.temp','project-ref'),m.EXPECTED_REF+'\n');
 return {base,project,output,cleanup:()=>fs.rmSync(base,{recursive:true,force:true})};
}
function inspect(f,override={},deps={}){return m.diagnose({projectRoot:f.project,outputDir:f.output,...override},{env:{},nodeVersion:'22.0.0',hasCommand:()=>true,...deps});}
const has=(r,c)=>r.codes.includes(c);
test('ref is the nonsecret staging identifier',()=>assert.equal(m.EXPECTED_REF,'ifxlvrhyjhbzbrkdsida'));
test('no export flag accepted',()=>assert.throws(()=>m.parseArgs(['--execute']),/UNSUPPORTED_ARGUMENT_NO_EXPORT/));
test('no db-url or credentials accepted',()=>assert.throws(()=>m.parseArgs(['--db-url','postgresql://fake']),/UNSUPPORTED_ARGUMENT_NO_EXPORT/));
test('no CLI execution or network or file writes in wizard source',()=>{
 const s=fs.readFileSync(path.join(__dirname,'guided-readiness.cjs'),'utf8');
 assert.doesNotMatch(s,/require\(['"]node:(?:child_process|http|https|net|tls)['"]\)/);
 assert.doesNotMatch(s,/\b(?:fetch|spawnSync|execFile|execSync|writeFileSync|unlinkSync|mkdirSync|rmdirSync|rmSync)\s*\(/);
});
test('help does not require paths',()=>assert.equal(m.parseArgs(['--help']).help,true));
test('paths parsed as data, not command',()=>assert.deepEqual(m.parseArgs(['--project-root','C:\\shop','--output-dir','D:\\backup']),{projectRoot:'C:\\shop',outputDir:'D:\\backup',help:false}));
test('Windows containment uses case-insensitive comparison',()=>{assert(m.inside('C:\\SHOP\\data','c:\\shop','win32'));assert(!m.inside('C:\\SHOPX','c:\\shop','win32'))});
test('ref marker matches in valid fixture',()=>{const f=fixture();try{const r=inspect(f);assert.equal(r.targetRefConfirmed,true);assert(!has(r,m.CODES.WRONG_LINKED_PROJECT));assert.equal(r.exportExecuted,false);assert.equal(r.restoreExecuted,false);assert.equal(r.fullPlatformBackupVerified,false);assert.equal(r.productionReady,false);}finally{f.cleanup()}});
test('Windows native fixture passes readiness when local tools exist',t=>{if(process.platform!=='win32')return t.skip('Only Windows runner can prove Windows native paths');const f=fixture();try{assert.equal(inspect(f).status,'GUIDED_READINESS_ONLY_PASS')}finally{f.cleanup()}});
test('non-Windows host never claims ready',()=>{const f=fixture();try{const r=inspect(f);if(process.platform!=='win32')assert(has(r,m.CODES.OWNER_WINDOWS_ONLY))}finally{f.cleanup()}});
test('wrong linked ref is blocked',()=>{const f=fixture();try{fs.writeFileSync(path.join(f.project,'supabase','.temp','project-ref'),'wrong');assert(has(inspect(f),m.CODES.WRONG_LINKED_PROJECT))}finally{f.cleanup()}});
test('missing config/marker is blocked',()=>{const f=fixture();try{fs.unlinkSync(path.join(f.project,'supabase','config.toml'));assert(has(inspect(f),m.CODES.LINKED_PROJECT_MARKER_NOT_FOUND))}finally{f.cleanup()}});
test('nested backup folder under project is blocked',()=>{const f=fixture();try{const d=path.join(f.project,'out');fs.mkdirSync(d);assert(has(inspect(f,{outputDir:d}),m.CODES.OUTPUT_UNSAFE_LOCATION))}finally{f.cleanup()}});
test('output parent of project is blocked',()=>{const f=fixture();try{assert(has(inspect(f,{outputDir:f.base}),m.CODES.OUTPUT_UNSAFE_LOCATION))}finally{f.cleanup()}});
test('another git checkout is blocked',()=>{const f=fixture();try{fs.mkdirSync(path.join(f.base,'.git'));assert(has(inspect(f),m.CODES.OUTPUT_UNSAFE_LOCATION))}finally{f.cleanup()}});
test('OneDrive company folder is blocked',()=>{const f=fixture();try{const d=path.join(f.base,'OneDrive - Shop');fs.mkdirSync(d);assert(has(inspect(f,{outputDir:d}),m.CODES.OUTPUT_UNSAFE_LOCATION))}finally{f.cleanup()}});
test('nonempty backup folder is blocked',()=>{const f=fixture();try{fs.writeFileSync(path.join(f.output,'not-a-backup.txt'),'fixture');assert(has(inspect(f),m.CODES.OUTPUT_NOT_EMPTY))}finally{f.cleanup()}});
test('missing backup folder is blocked',()=>{const f=fixture();try{assert(has(inspect(f,{outputDir:path.join(f.base,'absent')}),m.CODES.BACKUP_FOLDER_MISSING))}finally{f.cleanup()}});
test('relative paths are blocked',()=>{const f=fixture();try{assert(has(inspect(f,{projectRoot:'relative'}),m.CODES.ABSOLUTE_PATHS_REQUIRED))}finally{f.cleanup()}});
test('CI is always blocked even with valid paths',()=>{const f=fixture();try{assert(has(inspect(f,{}, {env:{CI:'true'}}),m.CODES.CI_FORBIDDEN))}finally{f.cleanup()}});
test('Node 21 does not pass',()=>{const f=fixture();try{assert(has(inspect(f,{}, {nodeVersion:'21.9.0'}),m.CODES.NODE_22_REQUIRED))}finally{f.cleanup()}});
test('Supabase CLI not found is reported',()=>{const f=fixture();try{assert(has(inspect(f,{}, {hasCommand:n=>n!=='supabase'}),m.CODES.SUPABASE_CLI_MISSING))}finally{f.cleanup()}});
test('Docker CLI not found is reported',()=>{const f=fixture();try{assert(has(inspect(f,{}, {hasCommand:n=>n!=='docker'}),m.CODES.DOCKER_CLI_MISSING))}finally{f.cleanup()}});
test('no path, password or secret is included in status',()=>{const f=fixture();try{const s=JSON.stringify(inspect(f));assert(!s.includes(f.base));assert(!s.includes('postgresql://'));assert(!s.includes('password'));assert(!s.includes('token'));}finally{f.cleanup()}});
test('diagnose does not write any files',()=>{const f=fixture();try{const before=fs.readdirSync(f.output);inspect(f);assert.deepEqual(fs.readdirSync(f.output),before)}finally{f.cleanup()}});
