import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export function openHistory(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "history.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      mode TEXT NOT NULL,
      tone TEXT,
      input TEXT NOT NULL,
      output TEXT NOT NULL
    );
  `);
  const insert = db.prepare(
    `INSERT INTO runs (mode, tone, input, output) VALUES (@mode, @tone, @input, @output)`
  );
  const list = db.prepare(
    `SELECT id, created_at, mode, tone, input, output FROM runs ORDER BY id DESC LIMIT 100`
  );
  return {
    save({ mode, tone, input, output }) {
      insert.run({ mode, tone: tone ?? null, input, output });
    },
    last100() {
      return list.all();
    },
  };
}
