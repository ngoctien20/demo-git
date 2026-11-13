const {test}=require('node:test'),a=require('node:assert/strict');
const {advance}=require('./ordered.cjs'),{respond}=require('./engine.cjs');
const blank={scope:'qa-order-a',rev:0,cursor:0,buffer:'[]',facts:'{}',seen:'[]',expires:0};
const turn=(row,seq,text,patch={})=>advance(row,{scope:blank.scope,seq,text,id:'qa-'+seq,...patch},10,respond);
test('out of order, replay, conflict, bound, isolation and cancellation',()=>{
 let r=turn(blank,1,'F01');r=turn(r,3,'thôi lấy 1');a.equal(r.preview,null);
 r=turn(r,2,'lấy 2');a.equal(r.cursor,3);a.deepEqual(JSON.parse(r.facts),{sku:'F01',quantity:1});a.match(r.preview,/159.000/);
 a.equal(turn(r,2,'lấy 2').skip,true);a.throws(()=>turn(r,3,'lấy 9'),/CONFLICT/);
 a.throws(()=>turn(r,4,'F01',{scope:'qa-order-b'}),/BINDING/);
 a.throws(()=>turn(r,25,'F01'),/GAP/);a.equal(turn(r,4,'hủy').facts,'{}');
});
