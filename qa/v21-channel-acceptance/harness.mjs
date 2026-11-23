// Runs n8n Code-node source (copied verbatim from the PUBLISHED version) with a fake `$`.
export function runCode(src, nodes, extra = {}) {
  const $ = (name) => {
    const items = (nodes[name] || []).map((json) => ({ json }));
    return { first: () => items[0], all: () => items, item: items[0] };
  };
  const $input = { first: () => ({ json: (nodes.$input || [])[0] }), all: () => (nodes.$input || []).map((json) => ({ json })) };
  const fn = new Function('$', '$input', '$execution', 'require', `return (function(){${src}\n})();`);
  return fn($, $input, extra.$execution ?? { id: '9999' }, (m) => { throw new Error('require ' + m); });
}
