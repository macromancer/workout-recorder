# Next Exercise Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a recommendation banner above the input bar suggesting the next exercise based on previous workout order patterns, with tap-to-fill and double-tap-to-save.

**Architecture:** New API endpoint `/api/workouts/next-recommendation` computes the next exercise from the most recent workout day's order. Frontend adds a banner div above the input bar with tap/double-tap handlers.

**Tech Stack:** Express (existing), better-sqlite3 (existing), vanilla JS/CSS (existing)

---

### Task 1: Add API endpoint for next recommendation

**Files:**
- Modify: `src/routes.js` (add new route before `module.exports`)

- [ ] **Step 1: Add the `/api/workouts/next-recommendation` route**

Add this before `module.exports = router;` in `src/routes.js`:

```javascript
// GET /api/workouts/next-recommendation — 다음 운동 추천
router.get('/workouts/next-recommendation', (req, res) => {
  const today = new Date().toLocaleDateString('sv-SE');

  // 1. Find most recent workout day (before today)
  const lastDateRow = db.prepare(
    'SELECT DISTINCT date FROM workouts WHERE date < ? ORDER BY date DESC LIMIT 1'
  ).get(today);

  if (!lastDateRow) {
    return res.json({ recommendation: null });
  }

  const lastDate = lastDateRow.date;

  // 2. Get last day's exercise order (by first appearance in createdAt)
  const lastDayRecords = db.prepare(
    'SELECT exerciseName, rawText, setNumber FROM workouts WHERE date = ? ORDER BY createdAt ASC'
  ).all(lastDate);

  // Build ordered exercise list with total sets and rawText per exercise
  const exerciseOrder = [];
  const exerciseInfo = {};
  for (const r of lastDayRecords) {
    if (!exerciseInfo[r.exerciseName]) {
      exerciseOrder.push(r.exerciseName);
      exerciseInfo[r.exerciseName] = { totalSets: 0, rawText: r.rawText };
    }
    exerciseInfo[r.exerciseName].totalSets++;
  }

  // 3. Get today's records to find completed exercises
  const todayRecords = db.prepare(
    'SELECT exerciseName, COUNT(*) as setsDone FROM workouts WHERE date = ? GROUP BY exerciseName'
  ).all(today);

  const todaySets = {};
  for (const r of todayRecords) {
    todaySets[r.exerciseName] = r.setsDone;
  }

  // 4. Find first incomplete exercise in order
  for (const name of exerciseOrder) {
    const done = todaySets[name] || 0;
    const total = exerciseInfo[name].totalSets;
    if (done < total) {
      return res.json({
        recommendation: {
          exerciseName: name,
          rawText: exerciseInfo[name].rawText,
          setNumber: done + 1,
          totalSets: total,
        },
      });
    }
  }

  // All exercises complete
  res.json({ recommendation: null });
});
```

- [ ] **Step 2: Test the endpoint manually**

Restart the server and test:
```bash
curl http://localhost:3000/api/workouts/next-recommendation
```

Expected: JSON response with `recommendation` object containing `exerciseName`, `rawText`, `setNumber`, `totalSets`, or `null` if all done.

- [ ] **Step 3: Commit**

```bash
git add src/routes.js
git commit -m "feat: add next-recommendation API endpoint"
```

---

### Task 2: Add recommendation banner HTML

**Files:**
- Modify: `public/index.html` (add banner div inside `#input-bar`)

- [ ] **Step 1: Add the banner div**

In `public/index.html`, add the recommendation banner as the first child of `#input-bar` (before `#autocomplete-area`):

```html
    <footer id="input-bar">
      <div id="recommendation-banner" class="hidden"></div>
      <div id="autocomplete-area" class="hidden"></div>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: add recommendation banner HTML element"
```

---

### Task 3: Style the recommendation banner

**Files:**
- Modify: `public/style.css` (add styles after `#autocomplete-area.hidden`)

- [ ] **Step 1: Add banner CSS**

Add after the `#autocomplete-area.hidden` rule (around line 231) in `public/style.css`:

```css
/* Recommendation banner */
#recommendation-banner {
  background: var(--primary);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

#recommendation-banner:active {
  background: var(--primary-dark);
}

#recommendation-banner.hidden {
  display: none;
}

#recommendation-banner .rec-label {
  font-size: 11px;
  opacity: 0.8;
}

#recommendation-banner .rec-text {
  font-weight: 600;
}

#recommendation-banner .rec-set {
  font-size: 12px;
  opacity: 0.8;
  white-space: nowrap;
}
```

- [ ] **Step 2: Commit**

```bash
git add public/style.css
git commit -m "feat: style recommendation banner"
```

---

### Task 4: Implement recommendation logic and tap behavior in JavaScript

**Files:**
- Modify: `public/app.js` (add recommendation functions and wire up events)

- [ ] **Step 1: Add recommendation state and load function**

Add after the `let trendChart = null;` line (line 7) in `public/app.js`:

```javascript
let currentRecommendation = null;
let recTapTimer = null;
```

- [ ] **Step 2: Add loadRecommendation function**

Add before the `// ===== Init =====` section (before line 553) in `public/app.js`:

```javascript
// ===== Recommendation Banner =====
async function loadRecommendation() {
  const banner = document.getElementById('recommendation-banner');
  const data = await api('/workouts/next-recommendation');

  if (!data.recommendation) {
    banner.classList.add('hidden');
    currentRecommendation = null;
    return;
  }

  currentRecommendation = data.recommendation;
  const r = currentRecommendation;
  banner.innerHTML = `
    <div>
      <div class="rec-label">다음 운동</div>
      <div class="rec-text">${r.rawText}</div>
    </div>
    <div class="rec-set">${r.setNumber}/${r.totalSets}세트</div>
  `;
  banner.classList.remove('hidden');
}
```

- [ ] **Step 3: Add tap/double-tap handler**

Add right after the `loadRecommendation` function:

```javascript
document.getElementById('recommendation-banner').addEventListener('click', () => {
  if (!currentRecommendation) return;

  if (recTapTimer) {
    // Double tap — save immediately
    clearTimeout(recTapTimer);
    recTapTimer = null;
    workoutInput.value = currentRecommendation.rawText;
    saveWorkout();
  } else {
    // Single tap — fill input, wait for possible double tap
    workoutInput.value = currentRecommendation.rawText;
    updateParsePreview();
    hideAutocomplete();
    workoutInput.focus();

    recTapTimer = setTimeout(() => {
      recTapTimer = null;
    }, 300);
  }
});
```

- [ ] **Step 4: Call loadRecommendation after saveWorkout**

In the `saveWorkout` function, add `loadRecommendation();` after `loadExercises();` (after line 86):

```javascript
  input.value = '';
  hideParsePreview();
  hideAutocomplete();
  loadTodayRecords();
  loadExercises();
  loadRecommendation();
```

- [ ] **Step 5: Call loadRecommendation on init**

In the `// ===== Init =====` section at the bottom, add `loadRecommendation();`:

```javascript
// ===== Init =====
loadTodayRecords();
loadExercises();
loadRecommendation();
```

- [ ] **Step 6: Call loadRecommendation on tab switch to record**

In the tab click handler (around line 31), add loadRecommendation when switching to record tab:

```javascript
    if (tab.dataset.tab === 'record') loadRecommendation();
    if (tab.dataset.tab === 'trend') loadTrend();
```

- [ ] **Step 7: Commit**

```bash
git add public/app.js
git commit -m "feat: implement recommendation banner with tap/double-tap"
```

---

### Task 5: Update design summary and push

**Files:**
- Modify: `workout-recorder-design-summary.md`

- [ ] **Step 1: Update the design summary**

Add to the 화면 구성 > 기록 탭 section:

```markdown
- **추천 배너**: 입력창 위에 다음 운동 추천 표시 (지난 운동 순서 기반)
  - 1탭: 입력창에 추천 문장 채움
  - 더블탭: 즉시 저장
  - 모든 운동 완료 시 자동 숨김
```

Add to the API 엔드포인트 table:

```markdown
| GET | /api/workouts/next-recommendation | 다음 운동 추천 |
```

Add to the 개발 이력 table:

```markdown
| 2026-03-29 | 다음 운동 추천 기능 추가 (배너 UI, 탭/더블탭, 순서 패턴 기반) |
```

- [ ] **Step 2: Commit and push**

```bash
git add workout-recorder-design-summary.md
git commit -m "docs: update design summary with recommendation feature"
git push origin master
```
