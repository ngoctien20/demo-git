// Run after building apps/owner. Module is uploaded with the pilot, never with a credential.
import { readFile,readdir,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
const [dir,out]=process.argv.slice(2);
const assets={};
for(const file of ['index.html',...(await readdir(join(dir,'assets'))).filter(f=>/^[a-zA-Z0-9_-]+\.(js|css)$/.test(f)).map(f=>'assets/'+f)]) {
  const type=file.endsWith('html')?'text/html; charset=utf-8':file.endsWith('js')?'text/javascript':'text/css';
  assets[file]=[type,gzipSync(await readFile(join(dir,file))).toString('base64')];
}
await writeFile(out,'export default '+JSON.stringify(assets)+';\n');
