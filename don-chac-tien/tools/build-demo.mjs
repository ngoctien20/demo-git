// Gộp lib/*.mjs thành một <script> thường để trang mô phỏng mở được bằng cách bấm đúp file (file://), không cần máy chủ.
//   node don-chac-tien/tools/build-demo.mjs   →  don-chac-tien/demo/don-chac-tien-demo.html
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../lib/', import.meta.url);
const order = ['vn', 'vietqr', 'qr', 'png', 'reconcile', 'messages', 'parse-owner', 'engine'];
const v = (n) => '__m_' + n.replace(/-/g, '_');
let out = '';
for (const name of order) {
  let src = readFileSync(new URL(name + '.mjs', dir), 'utf8');
  const exportsList = [];
  src = src.replace(/^import \* as (\w+) from '\.\/([\w-]+)\.mjs';$/gm, (_, ns, m) => `const ${ns} = ${v(m)};`);
  src = src.replace(/^import \{([^}]+)\} from ['"]\.\/([\w-]+)\.mjs['"];$/gm, (_, names, m) => `const {${names}} = ${v(m)};`);
  src = src.replace(/^export (async function|function|const|let) (\w+)/gm, (_, kw, id) => { exportsList.push(id); return kw + ' ' + id; });
  if (/^\s*(import|export)\s/m.test(src)) throw new Error('unbundled import/export left in ' + name);
  out += `const ${v(name)} = (() => {\n${src}\nreturn { ${exportsList.join(', ')} };\n})();\n`;
}
out += `const { newShop, ownerMessage, bankTransfer, tick, available, monthFee } = ${v('engine')};\n`;
out += `const { encodeQr, qrSvg } = ${v('qr')}; const { qrPng } = ${v('png')}; const { parseVietQr } = ${v('vietqr')};\n`;
out += `const { vnd, local } = ${v('vn')}; const { HELP } = ${v('messages')};\n`;
const tpl = readFileSync(new URL('../demo/template.html', import.meta.url), 'utf8');
writeFileSync(new URL('../demo/don-chac-tien-demo.html', import.meta.url), tpl.replace('/*BUNDLE*/', () => out));
console.log('demo/don-chac-tien-demo.html', out.length, 'bytes of script');
