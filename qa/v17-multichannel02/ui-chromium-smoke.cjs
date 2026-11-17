// Browser smoke for exact local synthetic UI. No external packages or network.
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL}=require('node:url');

const browser = ['/usr/bin/google-chrome','/usr/bin/chromium',
 'google-chrome','chromium','chromium-browser'].find(bin=>{
 if(bin.startsWith('/'))return fs.existsSync(bin);
 const r=spawnSync('which',[bin],{encoding:'utf8',timeout:2000});
 return r.status===0;
});
if(!browser)throw Error('CHROMIUM_BROWSER_NOT_INSTALLED_IN_CI');
const url=pathToFileURL(path.resolve(__dirname,'ui/index.html')).href;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'t404-mc02-chromium-'));
try {
 for(const [width,height] of [[375,812],[768,1024],[1280,800]]) {
   const filename=path.join(temp,'qa-'+width+'.png');
   const profile=path.join(temp,'profile-'+width);
   const args=[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage',
    '--disable-gpu','--disable-extensions','--no-first-run',
    '--disable-background-networking','--allow-file-access-from-files',
    '--no-default-browser-check','--hide-scrollbars','--virtual-time-budget=1500',
    '--user-data-dir='+profile,'--window-size='+width+','+height,
    '--screenshot='+filename,'--dump-dom',url
   ];
   const run=spawnSync(browser,args,{encoding:'utf8',timeout:20000,maxBuffer:3*1024*1024});
   if(run.error)throw run.error;
   if(run.status!==0)throw Error('BROWSER_EXIT_'+width+'_'+run.status+':'+String(run.stderr).slice(-600));
   if(!run.stdout.includes('QA-A-01') || !run.stdout.includes('4 hội thoại thử nghiệm'))
     throw Error('UI_NOT_RENDERED_'+width+':'+run.stdout.slice(-300));
   if(!fs.existsSync(filename))throw Error('BROWSER_SCREENSHOT_NOT_CREATED_'+width);
   const data=fs.readFileSync(filename);
   if(data.length<10000||data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
     throw Error('BROWSER_SCREENSHOT_INVALID_'+width);
   console.log('BROWSER_QA_PASS',width+'x'+height,'rendered QA only, png bytes',data.length);
 }
} finally {
 fs.rmSync(temp,{recursive:true,force:true});
}
