const express = require('express');
const db = require('./db');
const { parseWorkoutInput } = require('./parser');

const router = express.Router();

// POST /api/workouts — 기록 저장
router.post('/workouts', (req, res) => {
  const { rawText } = req.body;
  if (!rawText || !rawText.trim()) {
    return res.status(400).json({ error: '입력이 비어있습니다' });
  }

  const parsed = parseWorkoutInput(rawText);
  const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD

  // Calculate set number
  let setNumber = 1;
  if (parsed.exerciseName) {
    const row = db.prepare(
      'SELECT COUNT(*) as cnt FROM workouts WHERE date = ? AND exerciseName = ?'
    ).get(today, parsed.exerciseName);
    setNumber = row.cnt + 1;
  }

  const stmt = db.prepare(
    'INSERT INTO workouts (exerciseName, weight, reps, setNumber, rawText, date) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(
    parsed.exerciseName,
    parsed.weight,
    parsed.reps,
    setNumber,
    parsed.rawText,
    today
  );

  res.json({
    id: result.lastInsertRowid,
    ...parsed,
    setNumber,
    date: today,
  });
});

// GET /api/workouts?date= — 날짜별 조회
router.get('/workouts', (req, res) => {
  const date = req.query.date || new Date().toLocaleDateString('sv-SE');
  const rows = db.prepare(
    'SELECT * FROM workouts WHERE date = ? ORDER BY createdAt ASC'
  ).all(date);
  res.json(rows);
});

// GET /api/workouts/latest?exercise= — 특정 운동 지난 기록
router.get('/workouts/latest', (req, res) => {
  const { exercise } = req.query;
  if (!exercise) {
    return res.status(400).json({ error: 'exercise 파라미터가 필요합니다' });
  }

  const today = new Date().toLocaleDateString('sv-SE');

  // Find the most recent date (before today) that has this exercise
  const lastDate = db.prepare(
    'SELECT DISTINCT date FROM workouts WHERE exerciseName = ? AND date < ? ORDER BY date DESC LIMIT 1'
  ).get(exercise, today);

  if (!lastDate) {
    // Also check today if no previous date
    const todayRecords = db.prepare(
      'SELECT * FROM workouts WHERE exerciseName = ? AND date = ? ORDER BY setNumber ASC'
    ).all(exercise, today);
    if (todayRecords.length > 0) {
      return res.json({ date: today, records: todayRecords });
    }
    return res.json({ date: null, records: [] });
  }

  const records = db.prepare(
    'SELECT * FROM workouts WHERE exerciseName = ? AND date = ? ORDER BY setNumber ASC'
  ).all(exercise, lastDate.date);

  res.json({ date: lastDate.date, records });
});

// GET /api/workouts/trend?exercise= — 운동별 추이
router.get('/workouts/trend', (req, res) => {
  const { exercise } = req.query;
  if (!exercise) {
    return res.status(400).json({ error: 'exercise 파라미터가 필요합니다' });
  }

  const rows = db.prepare(
    'SELECT * FROM workouts WHERE exerciseName = ? ORDER BY date ASC, setNumber ASC'
  ).all(exercise);

  // Group by date
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.date]) {
      grouped[row.date] = [];
    }
    grouped[row.date].push(row);
  }

  res.json(grouped);
});

// GET /api/workouts/calendar?month= — 월별 운동 날짜
router.get('/workouts/calendar', (req, res) => {
  const month = req.query.month || new Date().toLocaleDateString('sv-SE').slice(0, 7);
  const rows = db.prepare(
    "SELECT DISTINCT date FROM workouts WHERE date LIKE ? || '%' ORDER BY date"
  ).all(month);
  res.json(rows.map(r => r.date));
});

// GET /api/workouts/day?date= — 특정 날짜의 운동별 요약
router.get('/workouts/day', (req, res) => {
  const date = req.query.date;
  if (!date) {
    return res.status(400).json({ error: 'date 파라미터가 필요합니다' });
  }
  const rows = db.prepare(
    'SELECT * FROM workouts WHERE date = ? ORDER BY exerciseName, setNumber ASC'
  ).all(date);
  res.json(rows);
});

// PUT /api/workouts/:id — 기록 수정
router.put('/workouts/:id', (req, res) => {
  const { id } = req.params;
  const { exerciseName, weight, reps } = req.body;

  const existing = db.prepare('SELECT * FROM workouts WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '기록을 찾을 수 없습니다' });
  }

  db.prepare(
    'UPDATE workouts SET exerciseName = ?, weight = ?, reps = ? WHERE id = ?'
  ).run(
    exerciseName ?? existing.exerciseName,
    weight ?? existing.weight,
    reps ?? existing.reps,
    id
  );

  const updated = db.prepare('SELECT * FROM workouts WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/workouts/:id — 기록 삭제
router.delete('/workouts/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM workouts WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '기록을 찾을 수 없습니다' });
  }

  db.prepare('DELETE FROM workouts WHERE id = ?').run(id);
  res.json({ success: true });
});

// GET /api/exercises — 운동명 목록 (자동완성용)
router.get('/exercises', (req, res) => {
  const rows = db.prepare(
    'SELECT DISTINCT exerciseName FROM workouts WHERE exerciseName IS NOT NULL ORDER BY exerciseName'
  ).all();
  res.json(rows.map(r => r.exerciseName));
});

// GET /api/workouts/previous-day — 지난 운동일 조회
router.get('/workouts/previous-day', (req, res) => {
  const { before } = req.query;
  const date = before || new Date().toLocaleDateString('sv-SE');

  const row = db.prepare(
    'SELECT DISTINCT date FROM workouts WHERE date < ? ORDER BY date DESC LIMIT 1'
  ).get(date);

  if (!row) {
    return res.json({ date: null, records: [] });
  }

  const records = db.prepare(
    'SELECT * FROM workouts WHERE date = ? ORDER BY exerciseName, setNumber ASC'
  ).all(row.date);

  res.json({ date: row.date, records });
});

// GET /api/workouts/next-day — 다음 운동일 조회
router.get('/workouts/next-day', (req, res) => {
  const { after } = req.query;
  if (!after) {
    return res.status(400).json({ error: 'after 파라미터가 필요합니다' });
  }

  const row = db.prepare(
    'SELECT DISTINCT date FROM workouts WHERE date > ? ORDER BY date ASC LIMIT 1'
  ).get(after);

  if (!row) {
    return res.json({ date: null, records: [] });
  }

  const records = db.prepare(
    'SELECT * FROM workouts WHERE date = ? ORDER BY exerciseName, setNumber ASC'
  ).all(row.date);

  res.json({ date: row.date, records });
});

module.exports = router;
