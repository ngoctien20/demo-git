// All data is synthetic. Faults are injected only in the disposable SQLite database.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {Worker} from 'node:worker_threads';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createQaShopBook} from './draft-store.mjs';
import {writeLine,writeContact} from './edit-writer.mjs';

export const writerCases=new Set(['QA25','QA26','QA27','QA28','QA29','QA30','QA33','QA34','QA35','QA36']);

async function parallel(file,id) {
  const workers=[3,4].map(qty=>new Worker(new URL('./writer-worker.mjs',import.meta.url),{workerData:{file,id,qty}}));
  try {
    const snapshots=await Promise.all(workers.map(w=>once(w,'message')));
    for(const [snapshot] of snapshots) {
      assert.equal(snapshot.ready,true);
      assert.equal(snapshot.version,id==='QA29' ? 0 : undefined);
    }
    const results=workers.map(w=>once(w,'message'));
    workers.forEach(w=>w.postMessage('apply'));
    return (await Promise.all(results)).map(([result])=>result);
  } finally {await Promise.all(workers.map(w=>w.terminate()));}
}

export async function replayWriter(id,turns) {
  const dir=mkdtempSync(join(tmpdir(),'tien404-qa-'));
  const file=join(dir,'qa.sqlite');
  const db=new DatabaseSync(file);
  const variants=['T-A','T-B'].map(sku=>({page:'A',sku,size:'M',color:'đen',price:159000,stock:8}));
  const book=createQaShopBook({shops:[{page:'A',owner:'owner'}],variants},db);
  const send=(event,text)=>book.customerMessage({page:'A',sender:'x',event},{text});
  const contact='Tên Khách QA, SĐT 0000000000, địa chỉ 18 Đường Mẫu';
  const output=[];
  try {
    if(id!=='QA36') {
      send('buy','Lấy T-A x2');send('contact',contact);
      if(id!=='QA30') send('confirm','đồng ý');
    }
    const baseline=book.inbox('owner')[0];
    for(const [i,raw] of turns.entries()) {
      const text=raw.replaceAll('{order}','QA-ORDER-1').replaceAll('{old}','0000000000');
      let status;
      let expected=baseline;
      if (['QA25','QA26','QA27'].includes(id)) {
        db.exec('BEGIN IMMEDIATE');
        const result=id==='QA27' ? writeContact(db,baseline,contact.replace('Khách QA','QA Mới'),false) :
          writeLine(db,baseline,variants[id==='QA25'?1:0],id==='QA25'?2:3,undefined,true);
        db.exec('COMMIT');
        status=result.status;
        assert.equal(status,id==='QA27'?'confirmation_required':'expected_total_required');
      } else if(id==='QA29' || id==='QA30') {
        const results=await parallel(file,id);
        const states=results.map(r=>r.status).sort();
        const saved=book.inbox('owner')[0];
        if(id==='QA29') {
          assert.deepEqual(states,['change_stale','line_saved']);
          const winner=results.findIndex(r=>r.status==='line_saved');
          expected={...baseline,qty:winner+3,edit_version:1,catalog_price_at_edit:159000};
        } else {
          assert.deepEqual(states,['duplicate','pending_owner']);
          assert.ok(results.every(r=>r.id===saved.id));
          assert.equal(saved.qty,2);assert.equal(saved.price,159000);assert.equal(saved.approved,0);
          const reopened=new DatabaseSync(file,{readOnly:true});
          try {
            assert.deepEqual(reopened.prepare('SELECT id,sku,qty,price FROM drafts').all().map(r=>({...r})),
              [{id:saved.id,sku:'T-A',qty:2,price:159000}]);
          } finally {reopened.close();}
          expected=saved;
        }
        status=states.join('+');
      } else if(i===0) {
        const result=send('turn-0',text);
        status=result.status;
        assert.equal(status,id==='QA36'?'external_unavailable':'change_preview');
        if(id==='QA36') assert.equal(result.text,'Shop cần tự gửi email này.');
      } else if(id==='QA28') {
        const other=contact.replace('Khách QA','Chủ QA');
        db.exec('BEGIN IMMEDIATE');
        assert.equal(writeContact(db,baseline,other,true).status,'change_saved');
        db.exec('COMMIT');
        status=send('turn-1',text).status;
        assert.equal(status,'change_stale');
        expected={...baseline,contact:other,edit_version:1};
      } else if(id==='QA35') {
        send('turn-1',text); // Discard the successful return, as if the reply was lost.
        const recovered=send('turn-1',text);
        assert.deepEqual(recovered,{status:'duplicate',id:baseline.id,current_version:1});
        expected={...baseline,contact:contact.replace('0000000000','0987654321'),edit_version:1};
        status='duplicate_readback';
      } else {
        const fault=id==='QA33' ? "AFTER UPDATE OF contact ON drafts BEGIN UPDATE drafts SET contact=987654321 WHERE id=NEW.id; END" :
          "BEFORE UPDATE ON drafts BEGIN SELECT RAISE(ABORT,'QA_WRITE_FAULT'); END";
        db.exec('CREATE TEMP TRIGGER inject_fault '+fault);
        assert.throws(()=>send('turn-1',text),id==='QA33'?/CONTACT_READBACK_MISMATCH/:/QA_WRITE_FAULT/);
        status=id==='QA33'?'readback_rejected':'write_rolled_back';
        assert.equal(db.prepare("SELECT count(*) AS n FROM receipts WHERE event='turn-1'").get().n,0);
      }
      const rows=book.inbox('owner');
      assert.deepEqual(rows.map(r=>({...r})),expected?[{...expected}]:[]);
      const stock=db.prepare('SELECT stock FROM variants ORDER BY sku').all();
      assert.deepEqual(stock.map(v=>v.stock),[8,8]);
      const d=rows[0];
      output.push([id,i+1,status,rows.length,8,'PASS','offline_sqlite_writer','','',d?.sku,d?.qty,d && d.qty*d.price].join(','));
    }
  } finally {book.close();rmSync(dir,{recursive:true,force:true});}
  return output;
}
