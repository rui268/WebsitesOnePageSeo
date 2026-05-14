/* ============================================================
   BudgetPal — personal finance tracker
   Storage: localStorage key "budgetpal_v1"
============================================================ */

// ── Categories ────────────────────────────────────────────
const EXPENSE_CATS = [
  { id: '住房',     color: '#4A90E2' },
  { id: '餐飲',     color: '#F5A623' },
  { id: '交通',     color: '#2ECC71' },
  { id: '購物',     color: '#9B59B6' },
  { id: '娛樂',     color: '#E74C3C' },
  { id: '其他',     color: '#95A5A6' },
];
const INCOME_CATS = [
  { id: '薪資',     color: '#27AE60' },
  { id: '獎金',     color: '#F39C12' },
  { id: '投資',     color: '#3498DB' },
  { id: '其他收入', color: '#BDC3C7' },
];

const CAT_MAP = {};
[...EXPENSE_CATS, ...INCOME_CATS].forEach(c => { CAT_MAP[c.id] = c.color; });

// ── UUID (works in file:// and non-secure contexts) ───────
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Storage ───────────────────────────────────────────────
const SK = 'budgetpal_v1';
let _mem = null; // in-memory fallback when localStorage is blocked

function load() {
  try {
    const s = localStorage.getItem(SK);
    if (s) { _mem = JSON.parse(s); return _mem; }
  } catch(e) { console.warn('load failed', e); }
  return _mem || { records: [], budgets: {} };
}

function save(data) {
  _mem = data;
  try { localStorage.setItem(SK, JSON.stringify(data)); }
  catch(e) { console.warn('localStorage blocked, using memory only', e); }
  // sync to Firestore in background
  if (typeof fbSave === 'function') fbSave(data);
}

// ── State ─────────────────────────────────────────────────
const now   = new Date();
let curYear = now.getFullYear();
let curMon  = now.getMonth() + 1;       // 1-based
let filter  = 'all';
let formType = 'expense';
let pendingDeleteId = null;
let chartInstance = null;

const curMonthStr = () => `${curYear}-${String(curMon).padStart(2, '0')}`;

// ── Helpers ───────────────────────────────────────────────
const $  = id => document.getElementById(id);
const fmtMoney = n => '$' + n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate  = d => {
  const [y, m, day] = d.split('-');
  return `${m}/${day}`;
};

// ── Month navigation ──────────────────────────────────────
$('prevMonth').addEventListener('click', () => {
  curMon--;
  if (curMon < 1) { curMon = 12; curYear--; }
  render();
});
$('nextMonth').addEventListener('click', () => {
  curMon++;
  if (curMon > 12) { curMon = 1; curYear++; }
  render();
});

function updateMonthLabel() {
  $('currentMonth').textContent = `${curYear} 年 ${String(curMon).padStart(2, '0')} 月`;
}

// ── Type toggle ───────────────────────────────────────────
$('typeToggle').addEventListener('click', e => {
  const btn = e.target.closest('.type-btn');
  if (!btn) return;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  formType = btn.dataset.type;
  buildCategorySelect();
});

function buildCategorySelect() {
  const sel  = $('fCategory');
  const cats = formType === 'expense' ? EXPENSE_CATS : INCOME_CATS;
  sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.id}</option>`).join('');
}

// ── Form ──────────────────────────────────────────────────
function addRecord() {
  try {
    const amount = parseFloat($('fAmount').value);
    const category = $('fCategory').value;
    const date = $('fDate').value;
    if (!amount || amount <= 0) { showToast('請輸入有效金額'); return; }
    if (!category) { showToast('請選擇分類'); return; }
    if (!date) { showToast('請選擇日期'); return; }
    const data = load();
    data.records.unshift({ id: uuid(), type: formType, amount, category, date, note: $('fNote').value.trim() });
    save(data);
    $('fAmount').value = '';
    $('fNote').value = '';
    setDefaultDate();
    buildCategorySelect();
    render();
    showToast(`已新增：${category} ${fmtMoney(amount)}`);
  } catch(err) {
    showToast('新增失敗，請重試');
    console.error('submit error', err);
  }
}

// Use both form submit AND button click to cover all WebView environments
$('recordForm').addEventListener('submit', e => { e.preventDefault(); addRecord(); });
$('submitBtn').addEventListener('click', e => { e.preventDefault(); addRecord(); });

function setDefaultDate() {
  const d = new Date();
  $('fDate').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Budget ────────────────────────────────────────────────
$('editBudgetBtn').addEventListener('click', () => {
  const data = load();
  $('budgetInput').value = data.budgets[curMonthStr()] || '';
  $('budgetEditRow').classList.remove('hidden');
  $('budgetInput').focus();
});

$('saveBudgetBtn').addEventListener('click', () => {
  const val = parseFloat($('budgetInput').value);
  if (!val || val <= 0) { showToast('請輸入有效預算金額'); return; }
  const data = load();
  data.budgets[curMonthStr()] = val;
  save(data);
  $('budgetEditRow').classList.add('hidden');
  render();
  showToast(`${curYear}年${curMon}月預算已設為 ${fmtMoney(val)}`);
});

$('cancelBudgetBtn').addEventListener('click', () => {
  $('budgetEditRow').classList.add('hidden');
});

$('budgetInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('saveBudgetBtn').click();
  if (e.key === 'Escape') $('cancelBudgetBtn').click();
});

// ── Filter tabs ───────────────────────────────────────────
$('filterTabs').addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  filter = tab.dataset.filter;
  renderRecordsList();
});

// ── Delete flow ───────────────────────────────────────────
$('confirmDelete').addEventListener('click', () => {
  if (!pendingDeleteId) return;
  const data = load();
  data.records = data.records.filter(r => r.id !== pendingDeleteId);
  save(data);
  pendingDeleteId = null;
  $('confirmOverlay').classList.add('hidden');
  render();
  showToast('記錄已刪除');
});

$('cancelDelete').addEventListener('click', () => {
  pendingDeleteId = null;
  $('confirmOverlay').classList.add('hidden');
});

$('confirmOverlay').addEventListener('click', e => {
  if (e.target === $('confirmOverlay')) $('cancelDelete').click();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $('cancelDelete').click();
});

// ── Render: Summary cards ─────────────────────────────────
function renderSummary(records) {
  const income  = records.filter(r => r.type === 'income').reduce((s, r)  => s + r.amount, 0);
  const expense = records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const balance = income - expense;

  $('totalIncome').textContent  = fmtMoney(income);
  $('totalExpense').textContent = fmtMoney(expense);
  $('totalBalance').textContent = fmtMoney(balance);
  $('totalBalance').style.color = balance >= 0 ? 'var(--green)' : 'var(--red)';
}

// ── Render: Budget progress ───────────────────────────────
function renderBudget(records) {
  const data    = load();
  const budget  = data.budgets[curMonthStr()] || 0;
  const expense = records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  $('budgetSpent').textContent = fmtMoney(expense);
  $('budgetTotal').textContent = budget ? fmtMoney(budget) : '未設定';

  if (!budget) {
    $('progressFill').style.width = '0%';
    $('progressPct').textContent  = '--%';
    $('budgetHint').textContent   = '尚未設定本月預算';
    $('budgetHint').className     = 'budget-hint';
    return;
  }

  const pct  = Math.min((expense / budget) * 100, 100);
  const fill = $('progressFill');
  fill.style.width = pct + '%';
  fill.className   = pct >= 90 ? 'progress-fill danger' : pct >= 70 ? 'progress-fill warn' : 'progress-fill';
  $('progressPct').textContent = pct.toFixed(0) + '%';

  const remain = budget - expense;
  const hint   = $('budgetHint');
  if (remain < 0) {
    hint.textContent = `已超支 ${fmtMoney(-remain)}`;
    hint.className   = 'budget-hint over';
  } else if (pct >= 70) {
    hint.textContent = `剩餘預算 ${fmtMoney(remain)}，請注意消費`;
    hint.className   = 'budget-hint close';
  } else {
    hint.textContent = `剩餘預算 ${fmtMoney(remain)}`;
    hint.className   = 'budget-hint good';
  }
}

// ── Render: Records list ──────────────────────────────────
function renderRecordsList() {
  const data    = load();
  const all     = data.records.filter(r => r.date.startsWith(curMonthStr()));
  const shown   = filter === 'all' ? all : all.filter(r => r.type === filter);
  const list    = $('recordsList');

  if (!shown.length) {
    list.innerHTML = `<div class="records-empty">${all.length ? '此分類本月無記錄' : '本月尚無任何記錄'}</div>`;
    return;
  }

  // Sort newest first
  const sorted = [...shown].sort((a, b) => b.date.localeCompare(a.date));

  list.innerHTML = sorted.map(r => {
    const color  = CAT_MAP[r.category] || '#95A5A6';
    const sign   = r.type === 'income' ? '+' : '-';
    const cls    = r.type;
    return `
      <div class="record-item" data-id="${r.id}">
        <div class="ri-dot" style="background:${color}"></div>
        <div class="ri-info">
          <div class="ri-top">
            <span class="ri-cat">${r.category}</span>
            <span class="ri-amount ${cls}">${sign}${fmtMoney(r.amount)}</span>
          </div>
          <div class="ri-bottom">
            <span>${fmtDate(r.date)}</span>
            ${r.note ? `<span>· ${r.note}</span>` : ''}
          </div>
        </div>
        <button class="ri-delete" data-id="${r.id}" title="刪除">✕</button>
      </div>`;
  }).join('');

  list.querySelectorAll('.ri-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      pendingDeleteId = btn.dataset.id;
      $('confirmOverlay').classList.remove('hidden');
    });
  });
}

// ── Render: Pie chart ─────────────────────────────────────
function renderChart(records) {
  const expenses = records.filter(r => r.type === 'expense');
  const total    = expenses.reduce((s, r) => s + r.amount, 0);

  // Aggregate by category
  const statsMap = {};
  expenses.forEach(r => {
    statsMap[r.category] = (statsMap[r.category] || 0) + r.amount;
  });
  const stats = Object.entries(statsMap).sort((a, b) => b[1] - a[1]);

  const empty = $('chartEmpty');
  const canvas = $('pieChart');
  const legend = $('chartLegend');

  if (!stats.length) {
    canvas.classList.add('hidden');
    empty.classList.remove('hidden');
    legend.innerHTML = '';
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    return;
  }

  canvas.classList.remove('hidden');
  empty.classList.add('hidden');

  const labels = stats.map(([k]) => k);
  const values = stats.map(([, v]) => v);
  const colors = labels.map(l => CAT_MAP[l] || '#95A5A6');

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#161b22' }] },
    options: {
      cutout: '60%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}：${fmtMoney(ctx.raw)}（${((ctx.raw / total) * 100).toFixed(1)}%）`
          }
        }
      },
      animation: { duration: 500 },
    }
  });

  legend.innerHTML = stats.map(([cat, amt]) => `
    <li class="legend-item">
      <div class="legend-dot" style="background:${CAT_MAP[cat] || '#95A5A6'}"></div>
      <span class="legend-name">${cat}</span>
      <span class="legend-amt">${fmtMoney(amt)}</span>
      <span class="legend-pct">${((amt / total) * 100).toFixed(1)}%</span>
    </li>
  `).join('');
}

// ── Render: Category summary (sidebar) ───────────────────
function renderCatSummary(records) {
  const expenses = records.filter(r => r.type === 'expense');
  const total    = expenses.reduce((s, r) => s + r.amount, 0);
  const ul       = $('catSummary');

  if (!expenses.length) {
    ul.innerHTML = '<li class="cat-empty">本月尚無支出</li>';
    return;
  }

  const statsMap = {};
  expenses.forEach(r => { statsMap[r.category] = (statsMap[r.category] || 0) + r.amount; });
  const stats = Object.entries(statsMap).sort((a, b) => b[1] - a[1]);
  const max   = stats[0][1];

  ul.innerHTML = stats.map(([cat, amt]) => {
    const pct   = total ? (amt / total * 100).toFixed(0) : 0;
    const barW  = max  ? (amt / max * 100).toFixed(0) : 0;
    const color = CAT_MAP[cat] || '#95A5A6';
    return `
      <li class="cat-row">
        <div class="cat-swatch" style="background:${color}"></div>
        <span class="cat-name">${cat}</span>
        <div class="cat-bar-wrap">
          <div class="cat-bar-fill" style="width:${barW}%;background:${color}"></div>
        </div>
        <span class="cat-amt">${fmtMoney(amt)}</span>
      </li>`;
  }).join('');
}

// ── Toast ─────────────────────────────────────────────────
function showToast(msg) {
  let t = document.querySelector('.bp-toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'bp-toast';
    Object.assign(t.style, {
      position: 'fixed', bottom: 'calc(70px + env(safe-area-inset-bottom))', right: '1rem',
      background: '#21262d', border: '1px solid #30363d', color: '#c9d1d9',
      padding: '.65rem 1.1rem', borderRadius: '8px', fontSize: '.85rem',
      zIndex: '999', boxShadow: '0 4px 16px rgba(0,0,0,.5)',
      transition: 'opacity .3s',
    });
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

// ── Bottom nav (mobile tab switching) ────────────────────
const TAB_SECTIONS = {
  record: () => document.querySelector('.content .card:first-child'),
  list:   () => document.querySelector('.content .card:last-child'),
  chart:  () => document.querySelectorAll('.sidebar .card')[1],
  budget: () => document.querySelectorAll('.sidebar .card')[0],
};

let activeTab = 'record';

function switchTab(tab) {
  if (window.innerWidth > 540) return;  // desktop: all visible
  activeTab = tab;

  // Update nav highlight
  document.querySelectorAll('.bn-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  // On mobile: scroll to the target section smoothly
  const el = TAB_SECTIONS[tab]?.();
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('bottomNav').addEventListener('click', e => {
  const btn = e.target.closest('.bn-item');
  if (btn) switchTab(btn.dataset.tab);
});

// ── Full render ───────────────────────────────────────────
function render() {
  const data    = load();
  const records = data.records.filter(r => r.date.startsWith(curMonthStr()));
  updateMonthLabel();
  renderSummary(records);
  renderBudget(records);
  renderRecordsList();
  renderChart(records);
  renderCatSummary(records);
}

// ── Service Worker registration ───────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// ── Auth ──────────────────────────────────────────────────
function showApp()   { $('loginOverlay').style.display = 'none'; $('appLoading').style.display = 'none'; }
function showLogin() { $('loginOverlay').style.display = ''; $('appLoading').style.display = 'none'; }

function initAuth() {
  // Firebase not configured → run offline mode
  if (typeof FB_READY === 'undefined' || !FB_READY) {
    showApp();
    buildCategorySelect();
    setDefaultDate();
    render();
    return;
  }

  // Check Firebase actually loaded
  if (typeof fbAuth === 'undefined') {
    showApp(); buildCategorySelect(); setDefaultDate(); render(); return;
  }

  // Show loading spinner while checking auth (login overlay stays visible)
  $('appLoading').style.display = 'flex';

  try { fbAuth.onAuthStateChanged(async user => {
    if (user) {
      // Load cloud data and merge into local cache
      const cloud = await fbLoad();
      if (cloud) save(cloud);

      // Update navbar user info
      const avatar = $('userAvatar');
      if (user.photoURL) { avatar.src = user.photoURL; avatar.alt = user.displayName || ''; }
      $('userName').textContent = user.displayName ? user.displayName.split(' ')[0] : '';
      $('userArea').classList.add('visible');

      showApp();
      buildCategorySelect();
      setDefaultDate();
      render();
    } else {
      $('userArea').classList.remove('visible');
      showLogin();
    }
  }); } catch(e) { console.error('Auth setup failed', e); showLogin(); }

  $('btnGoogleLogin').addEventListener('click', async () => {
    try {
      $('btnGoogleLogin').disabled = true;
      $('btnGoogleLogin').textContent = '登入中…';
      await fbSignIn();
    } catch(e) {
      showToast('登入失敗，請重試');
      console.error('sign-in error', e);
      $('btnGoogleLogin').disabled = false;
      $('btnGoogleLogin').innerHTML = `<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg> 使用 Google 帳號登入`;
    }
  });

  $('btnSignOut').addEventListener('click', async () => {
    await fbSignOut();
    showToast('已登出');
  });
}

// ── Boot ──────────────────────────────────────────────────
initAuth();
