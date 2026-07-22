import * as lancedb from 'vectordb';
import path from 'path';

async function test() {
  const db = await lancedb.connect('.lancedb');
  try {
    await db.dropTable('test_chunks');
  } catch(e) {}
  
  const data = [
    { fileId: "file1", text: "hello world", vector: [0.1, 0.2] },
    { fileId: "file1", text: "chunk 2", vector: [0.3, 0.4] }
  ];
  
  const tbl = await db.createTable('test_chunks', data);
  console.log("Created table. Count:", await tbl.countRows());
  
  await tbl.delete('`fileId` = \'file1\'');
  console.log("After delete count:", await tbl.countRows());
  console.log(await tbl.search().limit(10).execute());
}
test().catch(console.error);
