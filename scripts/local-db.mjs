import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

class LocalStatement {
  constructor(database, sql, params = []) {
    this.database = database;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new LocalStatement(this.database, this.sql, params);
  }

  first(column) {
    const row = this.database.prepare(this.sql).get(...this.params);
    if (!row) return null;
    return column === undefined ? row : row[column];
  }

  all() {
    return { success: true, results: this.database.prepare(this.sql).all(...this.params) };
  }

  run() {
    const result = this.database.prepare(this.sql).run(...this.params);
    return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
}

export function openLocalDb(databasePath, migrationsPath) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
  database.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  for (const name of readdirSync(migrationsPath).filter(name => name.endsWith('.sql')).sort()) {
    database.exec('BEGIN IMMEDIATE');
    try {
      if (!database.prepare('SELECT name FROM local_migrations WHERE name = ?').get(name)) {
        database.exec(readFileSync(join(migrationsPath, name), 'utf8'));
        database.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(name);
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  return {
    prepare(sql) { return new LocalStatement(database, sql); },
    batch(statements) {
      database.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(statement => statement.all());
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    close() { database.close(); }
  };
}
