/* ---------- Аудио и Хоткеи ---------- */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function beep({ freq = 520, type = 'sine', dur = 0.06, gain = 0.04 } = {}) {
  const ctx = ensureAudio(); if (!ctx) return;
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(g).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + dur + 0.02);
}
const sfx = {
  hover: () => beep({ freq: 720, gain: 0.015 }),
  click: () => beep({ freq: 400, type: 'triangle', gain: 0.03 }),
  success: () => { beep({ freq: 600 }); setTimeout(() => beep({ freq: 800 }), 100); }
};

// Хоткеи
const searchInput = document.getElementById('search-input');
window.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput.focus();
  }
  if (e.key === 'Escape' && document.activeElement === searchInput) {
    searchInput.blur();
    searchInput.value = '';
    applyFilters();
  }
});

/* ---------- Утилиты ---------- */
function showToast(msg) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `✅ ${msg}`;
  t.style.cssText = 'background:var(--panel); padding:0.8rem 1.5rem; border-radius:12px; border:1px solid var(--blue); color:#fff; margin-top:10px; animation: fadeUp 0.3s ease; font-weight:500;';
  c.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => { sfx.success(); showToast('Скопировано!'); });
}
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------- Фильтры и Поиск ---------- */
let allEndpoints = [];
let currentSearchQuery = '';
let currentMethodFilter = 'ALL';

function applyFilters() {
  allEndpoints.forEach(item => {
    const searchMatch = !currentSearchQuery || (item.title + ' ' + item.desc + ' ' + item.url).toLowerCase().includes(currentSearchQuery);
    const methodMatch = currentMethodFilter === 'ALL' || item.method === currentMethodFilter;
    if (searchMatch && methodMatch) { item.element.style.display = 'block'; item.element.setAttribute('data-visible', 'true'); }
    else { item.element.style.display = 'none'; item.element.setAttribute('data-visible', 'false'); }
  });

  document.querySelectorAll('.nav-group').forEach(group => {
    let hasVisible = false;
    group.querySelectorAll('.nav-link').forEach(link => {
      const target = document.getElementById(link.getAttribute('href').substring(1));
      if (target && target.getAttribute('data-visible') === 'true') { link.style.display = 'block'; hasVisible = true; }
      else { link.style.display = 'none'; }
    });
    group.style.display = hasVisible ? 'block' : 'none';
  });
}

searchInput.addEventListener('input', (e) => { currentSearchQuery = e.target.value.toLowerCase().trim(); applyFilters(); });
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sfx.click();
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMethodFilter = btn.getAttribute('data-filter');
    applyFilters();
  });
});

/* ---------- Живой URL ---------- */
function updateLiveUrl(item, box, inputsMap) {
  const previewEl = box.querySelector('.url-preview');
  if (!previewEl) return;
  let targetUrl = item.url;
  Object.keys(inputsMap).forEach(key => {
    const val = inputsMap[key].value.trim();
    if (val) targetUrl = targetUrl.replace(`{${key}}`, `<span class="url-param">${encodeURIComponent(val)}</span>`);
    else targetUrl = targetUrl.replace(`{${key}}`, `<span class="url-placeholder">{${key}}</span>`);
  });
  previewEl.innerHTML = targetUrl;
}

/* ---------- Главный рендер ---------- */
async function init() {
  const contentEl = document.getElementById('content');
  const navEl = document.getElementById('side-nav');
  
  // Проверка API
  fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://website.justmc.io/online'))
    .then(() => document.getElementById('api-status').className = 'status-dot online')
    .catch(() => document.getElementById('api-status').className = 'status-dot offline');

  let data;
  try { data = await (await fetch('data.json')).json(); } 
  catch (e) { contentEl.innerHTML = `<p style="color:red">Ошибка data.json: ${e.message}</p>`; return; }

  document.title = data.title;
  const items = data.sections || [];
  
  // Группировка
  const groups = {};
  items.forEach((item, i) => {
    const cat = item.category || 'Другое';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ item, index: i });
  });

  // Сайдбар
  Object.keys(groups).forEach(cat => {
    const groupWrap = document.createElement('div');
    groupWrap.className = 'nav-group closed';
    groupWrap.innerHTML = `<div class="nav-group-title"><span>${cat}</span><span class="arrow">▼</span></div><div class="nav-group-items"></div>`;
    
    groupWrap.querySelector('.nav-group-title').addEventListener('click', (e) => {
      e.currentTarget.parentElement.classList.toggle('closed'); sfx.click();
    });

    const itemsWrap = groupWrap.querySelector('.nav-group-items');
    groups[cat].forEach(({ item, index }) => {
      const link = document.createElement('a');
      link.className = 'nav-link'; link.href = `#endpoint-${index}`; link.textContent = item.title;
      link.addEventListener('click', () => {
        sfx.click(); searchInput.value = ''; currentSearchQuery = ''; applyFilters();
      });
      itemsWrap.appendChild(link);
    });
    navEl.appendChild(groupWrap);
  });

  // Карточки
  items.forEach((item, i) => {
    const id = `endpoint-${i}`;
    const box = document.createElement('div');
    box.className = 'endpoint'; box.id = id; box.setAttribute('data-method', item.method);
    
    // Шапка карточки
    box.innerHTML = `<h2>${item.title}</h2>
      <div class="line">
        <span class="method" data-m="${item.method}">${item.method}</span>
        ${item.url ? `<div class="url-preview-wrap"><code class="url-preview">${item.url}</code><button class="copy-btn" title="Копировать">📋</button></div>` : ''}
      </div>`;
    
    // Кнопка копирования URL
    if (item.url) {
      box.querySelector('.copy-btn').addEventListener('click', () => copyToClipboard(item.url));
    }

    // Описание
    if (item.description) {
      const d = document.createElement('div'); d.className = 'desc';
      d.innerHTML = item.description.split('\n').filter(l=>l).map(l => `<li>${l.replace('⏵','').trim()}</li>`).join('');
      if (d.innerHTML.includes('<li>')) d.innerHTML = `<ul>${d.innerHTML}</ul>`;
      box.appendChild(d);
    }

    // Параметры и Playground
    const inputsMap = {};
    if (item.params && item.params.length) {
      const table = document.createElement('table'); table.className = 'params-table';
      table.innerHTML = '<tr><th>Параметр</th><th>Описание</th><th>Значение</th></tr>';
      item.params.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><code>${p.name}</code><br><small style="color:var(--muted)">${p.type||''}</small></td>
                        <td>${p.description||''}</td>
                        <td>${item.canRun ? `<input class="param-input" data-name="${p.name}" placeholder="...">` : '-'}</td>`;
        table.appendChild(tr);
      });
      box.appendChild(table);

      // Биндим инпуты
      box.querySelectorAll('.param-input').forEach(inp => {
        const name = inp.getAttribute('data-name');
        inputsMap[name] = inp;
        inp.addEventListener('input', () => updateLiveUrl(item, box, inputsMap));
      });
      if (item.canRun) updateLiveUrl(item, box, inputsMap);
    }

    // Кнопка Выполнить
    if (item.canRun && item.method === 'GET') {
      const btn = document.createElement('button'); btn.className = 'btn-run'; btn.textContent = '▶ Выполнить запрос';
      const resBlock = document.createElement('div'); resBlock.className = 'response-block'; resBlock.innerHTML = '<pre>...</pre>';
      
      btn.addEventListener('click', async () => {
        btn.disabled = true; btn.textContent = 'Загрузка...'; resBlock.classList.add('show');
        let u = item.url;
        Object.keys(inputsMap).forEach(k => { if(inputsMap[k].value) u = u.replace(`{${k}}`, inputsMap[k].value); });
        
        try {
          const res = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(u));
          const json = await res.json();
          resBlock.querySelector('pre').textContent = JSON.stringify(json, null, 2);
        } catch(e) { resBlock.querySelector('pre').textContent = 'Ошибка: ' + e.message; }
        btn.disabled = false; btn.textContent = '▶ Выполнить запрос';
      });
      box.appendChild(btn); box.appendChild(resBlock);
    }

    allEndpoints.push({ element: box, title: item.title, desc: item.description || '', url: item.url || '', method: item.method });
    contentEl.appendChild(box);
  });

  // Кнопка вверх
  const backBtn = document.getElementById('back-to-top');
  window.addEventListener('scroll', () => backBtn.classList.toggle('show', window.scrollY > 300));
  backBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

init();
