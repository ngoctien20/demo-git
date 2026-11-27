export function catalog(shop) {
  const price=shop==='A'?159000:189000;
  return [
    {sku:'A001',color:'đen',size:'M',price,stock:3,style:'áo thun'},
    {sku:'A001',color:'đen',size:'L',price,stock:shop==='A'?2:5,style:'áo thun'},
    {sku:'A002',color:'đen',size:'L',price:179000,stock:0,style:'áo polo'},
    {sku:'A003',color:'trắng',size:'L',price:175000,stock:3,style:'áo polo'},
    {sku:'A004',color:'đen',size:'L',price:185000,stock:1,style:'áo sơ mi'}
  ];
}
