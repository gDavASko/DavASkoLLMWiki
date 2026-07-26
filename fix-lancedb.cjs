const fs = require('fs');
const crypto = require('crypto');
const lancedb = require('vectordb');

function md5(text) {
  return crypto.createHash('md5').update(text, 'utf8').digest('hex');
}

async function fix() {
  console.log('Connecting...');
  const db = await lancedb.connect('system/.lancedb');
  const tbl = await db.openTable('wiki_chunks');
  console.log('Fetching all rows...');
  const rows = await tbl.search().limit(20000).execute();
  
  console.log('Got ' + rows.length + ' rows. Deduplicating by fileId and chunkIndex...');
  const unique = new Map();
  for (const r of rows) {
    const key = r.fileId + '_' + r.chunkIndex;
    if (!unique.has(key)) {
      unique.set(key, r);
    }
  }
  const cleanRows = Array.from(unique.values());
  console.log('Unique chunks: ' + cleanRows.length);
  
  console.log('Preparing new rows with md5 and extendsRef...');
  const newRows = cleanRows.map(r => ({
    fileId: r.fileId || '',
    chunkIndex: r.chunkIndex || 0,
    layer: r.layer || '',
    sourceType: r.sourceType || '',
    path: r.path || '',
    symbols: r.symbols || '[]',
    tags: r.tags || '[]',
    wikilinks: r.wikilinks || '[]',
    text: r.text || '',
    vector: r.vector,
    extendsRef: '',
    md5: md5(r.text || '')
  }));
  
  console.log('Dropping old table...');
  await db.dropTable('wiki_chunks');
  
  console.log('Creating new table...');
  const dummy = { ...newRows[0], fileId: 'dummy' };
  const newTbl = await db.createTable('wiki_chunks', [dummy]);
  await newTbl.delete("`fileId` = 'dummy'");
  
  console.log('Inserting ' + newRows.length + ' rows...');
  for (let i = 0; i < newRows.length; i += 500) {
    await newTbl.add(newRows.slice(i, i + 500));
  }
  
  console.log('Done!');
}

fix().catch(console.error);
