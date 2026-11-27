import test from 'node:test';
import {replayWriter} from './replay-writer.mjs';

for (const id of ['QA25','QA26','QA27','QA29','QA30']) {
  test(id+' · kiểm chứng writer độc lập trên SQLite QA',async()=>{
    await replayWriter(id,['direct/parallel']);
  });
}
