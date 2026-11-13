// Input is an editor-only synthetic transcript. No conversation persists in n8n.
function replayTranscript(input) {
  if (typeof input !== 'string' || input.length > 2048) return 'Hãy nhập hội thoại thử dưới 2.048 ký tự.';
  const lines = input.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if (!lines.length || lines.length > 8) return 'Hãy nhập từ 1 đến 8 lượt thử, mỗi lượt trên một dòng.';
  let state = {};
  return lines.map((line,index) => {
    const result = respond('fashion', state, line);
    state = result.state;
    return (index+1)+'. '+result.reply;
  }).join('\n');
}
