const test=require('node:test'),assert=require('node:assert/strict');
const {inspectShadow}=require('./shadow.cjs');
test('shadow route disabled by default, returns decision only',()=>{
 const event={accepted:true,stage:'READ_ONLY',eventName:'message.text.received',chatType:'PRIVATE',chatId:'qa-owner',messageId:'qa-one',text:'test'};
 assert.deepEqual(inspectShadow({...event,approvedChat:'qa-owner'}),{decision:'disabled'});
 assert.deepEqual(inspectShadow(event,'qa-owner'),{decision:'eligible_for_shadow'});
 for(const patch of [{accepted:false},{stage:'other'},{eventName:'other'},{chatType:'GROUP'},{chatId:'qa-other'},{text:''},{messageId:''}])
   assert.notEqual(inspectShadow({...event,...patch},'qa-owner').decision,'eligible_for_shadow');
});
