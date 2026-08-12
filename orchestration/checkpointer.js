/**
 * @file orchestration/checkpointer.js
 * SQLite WAL state checkpointer with main-thread write queue to prevent SQLITE_BUSY locks.
 */

import { BaseCheckpointSaver } from '@langchain/langgraph';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

export class SqliteWalCheckpointer extends BaseCheckpointSaver {
  constructor(dbPath = ':memory:') {
    super();
    this.dbPath = dbPath;
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.writeQueue = Promise.resolve();
    this.initDb();
  }

  initDb() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS checkpoints (
        thread_id TEXT,
        checkpoint_ns TEXT DEFAULT '',
        checkpoint_id TEXT,
        parent_checkpoint_id TEXT,
        type TEXT,
        checkpoint TEXT,
        metadata TEXT,
        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
      );
      CREATE TABLE IF NOT EXISTS writes (
        thread_id TEXT,
        checkpoint_ns TEXT DEFAULT '',
        checkpoint_id TEXT,
        task_id TEXT,
        idx INTEGER,
        channel TEXT,
        type TEXT,
        value TEXT,
        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
      );
    `);
  }

  async getTuple(config) {
    const threadId = config.configurable?.thread_id;
    const checkpointNs = config.configurable?.checkpoint_ns || '';
    const checkpointId = config.configurable?.checkpoint_id;

    if (!threadId) return undefined;

    let query = 'SELECT * FROM checkpoints WHERE thread_id = ? AND checkpoint_ns = ?';
    const params = [threadId, checkpointNs];

    if (checkpointId) {
      query += ' AND checkpoint_id = ?';
      params.push(checkpointId);
    } else {
      query += ' ORDER BY checkpoint_id DESC LIMIT 1';
    }

    const stmt = this.db.prepare(query);
    const row = stmt.get(...params);
    if (!row) return undefined;

    const checkpoint = JSON.parse(row.checkpoint);
    const metadata = JSON.parse(row.metadata || '{}');

    const writesStmt = this.db.prepare(
      'SELECT channel, value FROM writes WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ? ORDER BY idx ASC'
    );
    const writeRows = writesStmt.all(threadId, checkpointNs, row.checkpoint_id);
    const pendingWrites = writeRows.map(w => [w.channel, JSON.parse(w.value)]);

    return {
      config: {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: row.checkpoint_id
        }
      },
      checkpoint,
      metadata,
      parentConfig: row.parent_checkpoint_id ? {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: row.parent_checkpoint_id
        }
      } : undefined,
      pendingWrites
    };
  }

  async *list(config, options) {
    const threadId = config.configurable?.thread_id;
    const checkpointNs = config.configurable?.checkpoint_ns || '';

    let query = 'SELECT * FROM checkpoints WHERE thread_id = ? AND checkpoint_ns = ? ORDER BY checkpoint_id DESC';
    const params = [threadId, checkpointNs];

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);

    for (const row of rows) {
      yield {
        config: {
          configurable: {
            thread_id: threadId,
            checkpoint_ns: checkpointNs,
            checkpoint_id: row.checkpoint_id
          }
        },
        checkpoint: JSON.parse(row.checkpoint),
        metadata: JSON.parse(row.metadata || '{}'),
        parentConfig: row.parent_checkpoint_id ? {
          configurable: {
            thread_id: threadId,
            checkpoint_ns: checkpointNs,
            checkpoint_id: row.parent_checkpoint_id
          }
        } : undefined
      };
    }
  }

  async put(config, checkpoint, metadata) {
    const threadId = config.configurable?.thread_id;
    const checkpointNs = config.configurable?.checkpoint_ns || '';
    const checkpointId = checkpoint.id;
    const parentCheckpointId = config.configurable?.checkpoint_id;

    if (!threadId) throw new Error('thread_id is required');

    return this.enqueueWrite(() => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO checkpoints (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, checkpoint, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        threadId,
        checkpointNs,
        checkpointId,
        parentCheckpointId || null,
        JSON.stringify(checkpoint),
        JSON.stringify(metadata || {})
      );

      return {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: checkpointId
        }
      };
    });
  }

  async putWrites(config, writes, taskId) {
    const threadId = config.configurable?.thread_id;
    const checkpointNs = config.configurable?.checkpoint_ns || '';
    const checkpointId = config.configurable?.checkpoint_id;

    if (!threadId || !checkpointId) return;

    return this.enqueueWrite(() => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO writes (thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      writes.forEach(([channel, value], idx) => {
        stmt.run(
          threadId,
          checkpointNs,
          checkpointId,
          taskId,
          idx,
          channel,
          JSON.stringify(value)
        );
      });
    });
  }

  enqueueWrite(fn) {
    this.writeQueue = this.writeQueue.then(() => fn()).catch(err => {
      console.error('[SqliteWalCheckpointer] Write error:', err);
      throw err;
    });
    return this.writeQueue;
  }
}

export function createSqliteWalCheckpointer(dbPath = ':memory:') {
  return new SqliteWalCheckpointer(dbPath);
}