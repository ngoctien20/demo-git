// Independent SQLite connection per worker. Both snapshots are read before the coordinator releases either writer.
import {parentPort,workerData} from 'node:worker_threads';
import {DatabaseSync} from 'node:sqlite';
import {createQaShopBook} from './draft-store.mjs';
import {writeLine} from './edit-writer.mjs';
const {file,id,qty}=workerData;
const db=new DatabaseSync(file);
const book=createQaShopBook({},db);
const row=db.prepare('SELECT * FROM drafts WHERE id=1').get();
parentPort.postMessage({ready:true,version:row?.edit_version});
parentPort.once('message',()=>{
  try {
    let result;
    if (id==='QA30') {
      result=book.customerMessage({page:'A',sender:'x',event:'same-confirm'},{text:'đồng ý'});
    } else {
      db.exec('BEGIN IMMEDIATE');
      const variant=db.prepare('SELECT * FROM variants WHERE page=? AND sku=?').get(row.page,row.sku);
      result=writeLine(db,row,variant,qty,row.price*qty,true);
      db.exec('COMMIT');
    }
    parentPort.postMessage(result);
  } finally {book.close();}
});
