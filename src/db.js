const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'workout.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS workouts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    exerciseName  TEXT NOT NULL,
    weight        TEXT,
    reps          INTEGER,
    setNumber     INTEGER,
    rawText       TEXT NOT NULL,
    createdAt     DATETIME DEFAULT (datetime('now', 'localtime')),
    date          TEXT NOT NULL
  )
`);

module.exports = db;
