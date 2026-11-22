// V22.6: sticker -> one friendly reply. The AI only picks a mood from a fixed list; the Worker owns the wording.
const deepText=(o,d=0)=>{if(d>8||o==null||typeof o!=='object')return '';if(Array.isArray(o)){for(const x of o){const t=deepText(x,d+1);if(t)return t}return ''}for(const k of ['text','content','output']){if(typeof o[k]==='string'&&o[k].trim())return o[k]}for(const v of Object.values(o)){const t=deepText(v,d+1);if(t)return t}return ''};
const inp=$input.first()?.json||{};
let mood='other';
if(!inp.error){try{const m=deepText(inp).match(/\{[\s\S]*\}/);const j=JSON.parse(m?m[0]:'{}');if(['happy','thanks','sad','angry','question','greeting','other'].includes(j.mood))mood=j.mood;}catch(_){}}
return [{json:{mediaKind:'sticker',mood,echo:{kind:'STICKER_REPLY',mood}}}];
