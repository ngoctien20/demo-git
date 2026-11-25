const detail = $('Format selected product').first(0, $runIndex).json;
return [{ json: { output: detail.output, detailImage: detail.detailImage ?? null } }];