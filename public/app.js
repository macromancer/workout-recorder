// ===== State =====
let exercises = [];
let editingId = null;
let historyDate = null;
let calendarMonth = new Date().toISOString().slice(0, 7);
let calendarWorkoutDays = [];
let trendChart = null;

// ===== API helpers =====
async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

// ===== Tabs =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

    // Show/hide input bar
    const inputBar = document.getElementById('input-bar');
    inputBar.style.display = tab.dataset.tab === 'record' ? '' : 'none';

    // Load tab data
    if (tab.dataset.tab === 'trend') loadTrend();
    if (tab.dataset.tab === 'history') loadHistory();
    if (tab.dataset.tab === 'calendar') loadCalendar();
  });
});

// ===== Record Tab =====
async function loadTodayRecords() {
  const today = new Date().toLocaleDateString('sv-SE');
  const records = await api(`/workouts?date=${today}`);
  const container = document.getElementById('today-records');

  if (records.length === 0) {
    container.innerHTML = '<div class="empty-state">오늘 기록이 없습니다.<br>아래에서 운동을 입력하세요.</div>';
    return;
  }

  container.innerHTML = records.map(r => `
    <div class="record-item" data-id="${r.id}">
      <div class="record-info">
        <div class="record-name">${r.exerciseName || '(파싱 실패)'}</div>
        <div class="record-detail">${r.weight ? r.weight + ' · ' : ''}${r.reps ? r.reps + '회' : ''} ${r.rawText !== (r.exerciseName || '') ? '· ' + r.rawText : ''}</div>
      </div>
      <div class="record-meta">
        <div class="record-set">${r.setNumber}세트</div>
        <div>${r.createdAt ? r.createdAt.slice(11, 16) : ''}</div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.record-item').forEach(item => {
    item.addEventListener('click', () => openEditModal(records.find(r => r.id === Number(item.dataset.id))));
  });
}

// ===== Save =====
document.getElementById('save-btn').addEventListener('click', saveWorkout);
document.getElementById('workout-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') saveWorkout();
});

async function saveWorkout() {
  const input = document.getElementById('workout-input');
  const rawText = input.value.trim();
  if (!rawText) return;

  await api('/workouts', {
    method: 'POST',
    body: JSON.stringify({ rawText }),
  });

  input.value = '';
  hideParsePreview();
  hideAutocomplete();
  loadTodayRecords();
  loadExercises();
}

// ===== Parse Preview =====
const workoutInput = document.getElementById('workout-input');
let previewTimeout;

workoutInput.addEventListener('input', () => {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(() => {
    updateParsePreview();
    updateAutocomplete();
  }, 200);
});

function updateParsePreview() {
  const text = workoutInput.value.trim();
  const preview = document.getElementById('parse-preview');

  if (!text) {
    hideParsePreview();
    return;
  }

  const parsed = parseLocally(text);
  preview.innerHTML = `운동: <strong>${parsed.exerciseName || '?'}</strong> | 중량: <strong>${parsed.weight || '-'}</strong> | 횟수: <strong>${parsed.reps || '?'}</strong>`;
  preview.classList.remove('hidden');
}

function hideParsePreview() {
  document.getElementById('parse-preview').classList.add('hidden');
}

// Client-side parser (mirrors server logic)
function parseLocally(rawText) {
  let text = rawText.replace(/\s+/g, ' ').trim();
  const tokens = text.split(' ');

  let exerciseName = null, weight = null, reps = null;

  // Extract reps from end
  if (tokens.length > 0) {
    const last = tokens[tokens.length - 1];
    const m = last.match(/^(\d+)\s*회?$/);
    if (m) {
      reps = parseInt(m[1], 10);
      tokens.pop();
    }
  }

  // Split remaining into name and weight
  const nameTokens = [];
  const weightTokens = [];
  let foundNumeric = false;

  for (const token of tokens) {
    if (!foundNumeric && (/^\d/.test(token) || /강도$/.test(token))) {
      foundNumeric = true;
    }
    if (foundNumeric) {
      weightTokens.push(token);
    } else {
      nameTokens.push(token);
    }
  }

  exerciseName = nameTokens.join(' ') || null;
  weight = weightTokens.join(' ') || null;

  return { exerciseName, weight, reps };
}

// ===== Autocomplete =====
async function loadExercises() {
  exercises = await api('/exercises');
}

async function updateAutocomplete() {
  const text = workoutInput.value.trim();
  const area = document.getElementById('autocomplete-area');

  if (!text) {
    hideAutocomplete();
    return;
  }

  // Find matching exercises
  const firstToken = text.split(' ')[0];
  const matches = exercises.filter(e => e.startsWith(firstToken));

  if (matches.length === 0 || (matches.length === 1 && text.startsWith(matches[0] + ' '))) {
    // If exact match and user is past the name, show last record
    const parsed = parseLocally(text);
    if (parsed.exerciseName && exercises.includes(parsed.exerciseName)) {
      showLastRecord(parsed.exerciseName);
    } else {
      hideAutocomplete();
    }
    return;
  }

  // Show exercise name suggestions
  let html = '';
  for (const name of matches.slice(0, 5)) {
    const latest = await api(`/workouts/latest?exercise=${encodeURIComponent(name)}`);
    let lastInfo = '';
    if (latest.records.length > 0) {
      const sets = latest.records.map(r => `${r.reps}회`).join('/');
      const w = latest.records[0].weight || '';
      lastInfo = `<div class="autocomplete-last">${latest.date} · ${w ? w + ' · ' : ''}${sets}</div>`;
    }
    html += `<div class="autocomplete-item" data-name="${name}"><strong>${name}</strong>${lastInfo}</div>`;
  }

  area.innerHTML = html;
  area.classList.remove('hidden');

  area.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('click', async () => {
      const name = item.dataset.name;
      const latest = await api(`/workouts/latest?exercise=${encodeURIComponent(name)}`);
      if (latest.records.length > 0 && latest.records[0].rawText) {
        workoutInput.value = latest.records[0].rawText;
      } else {
        workoutInput.value = name + ' ';
      }
      workoutInput.focus();
      updateParsePreview();
      showLastRecord(name);
    });
  });
}

async function showLastRecord(exerciseName) {
  const area = document.getElementById('autocomplete-area');
  const latest = await api(`/workouts/latest?exercise=${encodeURIComponent(exerciseName)}`);

  if (latest.records.length === 0) {
    hideAutocomplete();
    return;
  }

  const sets = latest.records.map(r =>
    `<span>${r.setNumber}세트 ${r.weight || ''} ${r.reps}회</span>`
  ).join(' ');

  area.innerHTML = `<div style="color:var(--primary);font-size:11px;margin-bottom:4px;">지난번 ${exerciseName} (${latest.date})</div><div style="font-size:12px;display:flex;gap:12px;flex-wrap:wrap;">${sets}</div>`;
  area.classList.remove('hidden');
}

function hideAutocomplete() {
  document.getElementById('autocomplete-area').classList.add('hidden');
}

// ===== Voice Input =====
const micBtn = document.getElementById('mic-btn');
let recognition = null;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'ko-KR';
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    workoutInput.value = transcript;
    updateParsePreview();
    updateAutocomplete();
    micBtn.classList.remove('recording');
  };

  recognition.onerror = () => {
    micBtn.classList.remove('recording');
  };

  recognition.onend = () => {
    micBtn.classList.remove('recording');
  };

  micBtn.addEventListener('click', () => {
    if (micBtn.classList.contains('recording')) {
      recognition.stop();
    } else {
      recognition.start();
      micBtn.classList.add('recording');
    }
  });
} else {
  micBtn.style.display = 'none';
}

// ===== Edit Modal =====
function openEditModal(record) {
  editingId = record.id;
  document.getElementById('edit-name').value = record.exerciseName || '';
  document.getElementById('edit-weight').value = record.weight || '';
  document.getElementById('edit-reps').value = record.reps || '';
  document.getElementById('edit-modal').classList.remove('hidden');
}

document.getElementById('edit-cancel').addEventListener('click', () => {
  document.getElementById('edit-modal').classList.add('hidden');
});

document.getElementById('edit-save').addEventListener('click', async () => {
  await api(`/workouts/${editingId}`, {
    method: 'PUT',
    body: JSON.stringify({
      exerciseName: document.getElementById('edit-name').value,
      weight: document.getElementById('edit-weight').value || null,
      reps: parseInt(document.getElementById('edit-reps').value) || null,
    }),
  });
  document.getElementById('edit-modal').classList.add('hidden');
  loadTodayRecords();
});

document.getElementById('edit-delete').addEventListener('click', async () => {
  if (confirm('이 기록을 삭제하시겠습니까?')) {
    await api(`/workouts/${editingId}`, { method: 'DELETE' });
    document.getElementById('edit-modal').classList.add('hidden');
    loadTodayRecords();
  }
});

// ===== Trend Tab =====
async function loadTrend() {
  const select = document.getElementById('trend-exercise');

  // Populate exercise list
  if (select.options.length <= 1) {
    await loadExercises();
    select.innerHTML = '<option value="">운동을 선택하세요</option>' +
      exercises.map(e => `<option value="${e}">${e}</option>`).join('');
  }

  if (select.value) {
    showTrend(select.value);
  }
}

document.getElementById('trend-exercise').addEventListener('change', (e) => {
  if (e.target.value) showTrend(e.target.value);
});

async function showTrend(exerciseName) {
  const data = await api(`/workouts/trend?exercise=${encodeURIComponent(exerciseName)}`);
  const dates = Object.keys(data);

  if (dates.length === 0) {
    document.getElementById('trend-detail').innerHTML = '<div class="empty-state">기록이 없습니다.</div>';
    return;
  }

  // Chart: average reps per day, max weight per day
  const labels = dates;
  const avgReps = dates.map(d => {
    const recs = data[d];
    const sum = recs.reduce((a, r) => a + (r.reps || 0), 0);
    return Math.round(sum / recs.length);
  });
  const weights = dates.map(d => {
    const recs = data[d];
    const nums = recs.map(r => parseFloat(r.weight)).filter(n => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : null;
  });

  const ctx = document.getElementById('trend-chart').getContext('2d');
  if (trendChart) trendChart.destroy();

  const datasets = [{
    label: '평균 횟수',
    data: avgReps,
    borderColor: '#4a6cf7',
    backgroundColor: 'rgba(74, 108, 247, 0.1)',
    tension: 0.3,
    yAxisID: 'y',
  }];

  if (weights.some(w => w !== null)) {
    datasets.push({
      label: '중량',
      data: weights,
      borderColor: '#2ecc71',
      backgroundColor: 'rgba(46, 204, 113, 0.1)',
      tension: 0.3,
      yAxisID: 'y1',
    });
  }

  trendChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { position: 'left', title: { display: true, text: '횟수', color: '#888' }, ticks: { color: '#888' }, grid: { color: '#2a2a4a' } },
        y1: { position: 'right', title: { display: true, text: '중량', color: '#888' }, ticks: { color: '#888' }, grid: { display: false } },
        x: { ticks: { color: '#888', maxRotation: 45 }, grid: { color: '#2a2a4a' } },
      },
      plugins: { legend: { labels: { color: '#e0e0e0' } } },
    },
  });

  // Detail table
  const detail = document.getElementById('trend-detail');
  detail.innerHTML = dates.reverse().map(d => {
    const recs = data[d];
    const sets = recs.map(r => `${r.setNumber}세트: ${r.weight || '-'} ${r.reps || '-'}회`).join(' / ');
    return `<div class="record-item"><div class="record-info"><div class="record-name">${d}</div><div class="record-detail">${sets}</div></div></div>`;
  }).join('');
}

// ===== History Tab =====
async function loadHistory() {
  if (!historyDate) {
    const result = await api('/workouts/previous-day');
    if (result.date) {
      historyDate = result.date;
      renderHistory(result.date, result.records);
    } else {
      document.getElementById('history-date').textContent = '-';
      document.getElementById('history-records').innerHTML = '<div class="empty-state">기록이 없습니다.</div>';
    }
  } else {
    const records = await api(`/workouts/day?date=${historyDate}`);
    renderHistory(historyDate, records);
  }
}

function renderHistory(date, records) {
  document.getElementById('history-date').textContent = date;

  if (records.length === 0) {
    document.getElementById('history-records').innerHTML = '<div class="empty-state">기록이 없습니다.</div>';
    return;
  }

  // Group by exercise
  const groups = {};
  for (const r of records) {
    const name = r.exerciseName || '(기타)';
    if (!groups[name]) groups[name] = [];
    groups[name].push(r);
  }

  const container = document.getElementById('history-records');
  container.innerHTML = Object.entries(groups).map(([name, recs]) => `
    <div class="history-group">
      <div class="history-group-name">${name}</div>
      <div class="history-sets">
        ${recs.map(r => `
          <div class="history-set-row">
            <span>${r.setNumber}세트</span>
            <span>${r.weight || '-'} · ${r.reps || '-'}회</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

document.getElementById('history-prev').addEventListener('click', async () => {
  if (!historyDate) return;
  const result = await api(`/workouts/previous-day?before=${historyDate}`);
  if (result.date) {
    historyDate = result.date;
    renderHistory(result.date, result.records);
  }
});

document.getElementById('history-next').addEventListener('click', async () => {
  if (!historyDate) return;
  const result = await api(`/workouts/next-day?after=${historyDate}`);
  if (result.date) {
    historyDate = result.date;
    renderHistory(result.date, result.records);
  }
});

// ===== Calendar Tab =====
async function loadCalendar() {
  document.getElementById('cal-month').textContent = calendarMonth;
  calendarWorkoutDays = await api(`/workouts/calendar?month=${calendarMonth}`);
  renderCalendar();
}

function renderCalendar() {
  const [year, month] = calendarMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toLocaleDateString('sv-SE');

  const headers = ['일', '월', '화', '수', '목', '금', '토'];
  let html = headers.map(h => `<div class="cal-header">${h}</div>`).join('');

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-day empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calendarMonth}-${String(d).padStart(2, '0')}`;
    const hasWorkout = calendarWorkoutDays.includes(dateStr);
    const isToday = dateStr === today;
    const classes = ['cal-day'];
    if (hasWorkout) classes.push('has-workout');
    if (isToday) classes.push('today');

    html += `<div class="${classes.join(' ')}" data-date="${dateStr}">${d}</div>`;
  }

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = html;

  grid.querySelectorAll('.cal-day:not(.empty)').forEach(cell => {
    cell.addEventListener('click', async () => {
      grid.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      const date = cell.dataset.date;
      const records = await api(`/workouts/day?date=${date}`);
      renderCalendarDetail(date, records);
    });
  });
}

function renderCalendarDetail(date, records) {
  const container = document.getElementById('calendar-detail');
  if (records.length === 0) {
    container.innerHTML = `<div class="empty-state">${date} — 기록 없음</div>`;
    return;
  }

  const groups = {};
  for (const r of records) {
    const name = r.exerciseName || '(기타)';
    if (!groups[name]) groups[name] = [];
    groups[name].push(r);
  }

  container.innerHTML = `<h3 style="font-size:14px;margin:12px 0 8px;">${date}</h3>` +
    Object.entries(groups).map(([name, recs]) => `
      <div class="history-group">
        <div class="history-group-name">${name}</div>
        <div class="history-sets">
          ${recs.map(r => `
            <div class="history-set-row">
              <span>${r.setNumber}세트</span>
              <span>${r.weight || '-'} · ${r.reps || '-'}회</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
}

document.getElementById('cal-prev').addEventListener('click', () => {
  const [y, m] = calendarMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  calendarMonth = d.toISOString().slice(0, 7);
  loadCalendar();
});

document.getElementById('cal-next').addEventListener('click', () => {
  const [y, m] = calendarMonth.split('-').map(Number);
  const d = new Date(y, m, 1);
  calendarMonth = d.toISOString().slice(0, 7);
  loadCalendar();
});

// ===== Init =====
loadTodayRecords();
loadExercises();
