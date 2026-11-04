/* ---------- Web Audio: мягкие звуки ---------- */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function beep({ freq = 520, type = 'sine', dur = 0.06, gain = 0.04, slide = 0 } = {}) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + dur + 0.02);
}
const sfx = {
  hover: () => beep({ freq: 720, type: 'sine', dur: 0.045, gain: 0.018 }),
  click: () => beep({ freq: 420, type: 'triangle', dur: 0.08, gain: 0.035, slide: 180 }),
  nav: () => beep({ freq: 600, type: 'sine', dur: 0.06, gain: 0.025, slide: 120 }),
  type: () => beep({ freq: 800, type: 'sine', dur: 0.02, gain: 0.01 }),
  success: () => { beep({ freq: 600, dur: 0.1, gain: 0.03 }); setTimeout(() => beep({ freq: 800, dur: 0.15, gain: 0.03 }), 100); }
};
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => ensureAudio(), { once: true }));

/* ---------- Кнопка Наверх ---------- */
const backToTopBtn = document.getElementById('back-to-top');
window.addEventListener('scroll', () => {
  if (window.scrollY > 300) backToTopBtn.classList.add('show');
  else backToTopBtn.classList.remove('show');
});
backToTopBtn.addEventListener('click', () => {
  sfx.click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ---------- Глобальные переменные для поиска и фильтров ---------- */
let allEndpoints = [];
let currentSearchQuery = '';
let currentMethodFilter = 'ALL';

/* ---------- Функции фильтрации ---------- */
function applyFilters() {
  allEndpoints.forEach(item => {
    const el = item.element;
    const searchMatch = !currentSearchQuery || (
      (item.title || '') + ' ' + 
      (item.desc || '') + ' ' + 
      (item.url || '')
    ).toLowerCase().includes(currentSearchQuery);
    
    const methodMatch = currentMethodFilter === 'ALL' || item.method === currentMethodFilter;

    if (searchMatch && methodMatch) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

// Поиск
const searchInput = document.getElementById('search-input');
searchInput.addEventListener('input', (e) => {
  currentSearchQuery = e.target.value.toLowerCase().trim();
  if (currentSearchQuery.length % 2 === 0) sfx.type();
  applyFilters();
});

// Фильтры по методам
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sfx.click();
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMethodFilter = btn.getAttribute('data-filter');
    applyFilters();
  });
  btn.addEventListener('mouseenter', sfx.hover);
});


/* ---------- Утилита для копирования ---------- */
function copyToClipboard(text, btnElement) {
  navigator.clipboard.writeText(text).then(() => {
    sfx.success();
    const originalHtml = btnElement.innerHTML;
    btnElement.innerHTML = '✅';
    setTimeout(() => { btnElement.innerHTML = originalHtml; }, 2000);
  });
}

/* ---------- Рендер ---------- */
async function init() {
  const titleEl = document.getElementById('page-title');
  const discEl = document.getElementById('disclaimer');
  const navEl = document.getElementById('side-nav');
  const contentEl = document.getElementById('content');
  const statusDot = document.getElementById('api-status');

  let data;
  try {
    const res = await fetch('data.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (e) {
    contentEl.innerHTML = '<p style="color:#ff6b6b">Не удалось загрузить data.json: ' + e.message + '</p>';
    return;
  }

  document.title = data.title || 'API JustMC';
  titleEl.textContent = data.title || 'API JustMC';
  if (data.disclaimer) discEl.textContent = data.disclaimer;

  // --- Проверка статуса API (Ping) ---
  fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://website.justmc.io/online'))
    .then(r => r.json())
    .then(() => {
      statusDot.className = 'status-dot online';
      statusDot.title = 'API работает';
    })
    .catch(() => {
      statusDot.className = 'status-dot offline';
      statusDot.title = 'API не отвечает';
    });

  const items = data.sections || [];
  const uniqueCategories = [];
  items.forEach(item => {
    const cat = item.category || 'Другое';
    if (!uniqueCategories.includes(cat)) uniqueCategories.push(cat);
  });
  uniqueCategories.sort((a, b) => a === 'Другое' ? 1 : b === 'Другое' ? -1 : 0);

  const groups = new Map();
  uniqueCategories.forEach(cat => groups.set(cat, []));
  items.forEach((item, i) => {
    const cat = item.category || 'Другое';
    groups.get(cat).push({ item, index: i });
  });

  const contentById = new Map();

  // --- Сайдбар ---
  uniqueCategories.forEach(cat => {
    const list = groups.get(cat);
    if (!list.length) return;

    const groupWrap = document.createElement('div');
    groupWrap.className = 'nav-group closed';

    const title = document.createElement('div');
    title.className = 'nav-group-title';
    title.innerHTML = `<span>${cat}</span><span class="arrow">▼</span>`;
    
    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'nav-group-items';

    title.addEventListener('click', () => {
      sfx.click();
      groupWrap.classList.toggle('closed');
    });
    title.addEventListener('mouseenter', sfx.hover);

    groupWrap.appendChild(title);
    groupWrap.appendChild(itemsWrap);

    list.forEach(({ item, index }) => {
      const id = 'endpoint-' + index;
      const link = document.createElement('a');
      link.className = 'nav-link';
      link.href = '#' + id;
      link.textContent = item.title || 'Без названия';
      
      link.addEventListener('mouseenter', sfx.hover);
      link.addEventListener('click', () => sfx.nav());
      
      itemsWrap.appendChild(link);
      contentById.set(id, link);
    });

    navEl.appendChild(groupWrap);
  });

  // --- Карточки ---
  items.forEach((item, i) => {
    const id = 'endpoint-' + i;
    const box = document.createElement('div');
    box.className = 'endpoint';
    box.id = id;
    box.setAttribute('data-method', (item.method || 'GET').toUpperCase());

    // Заголовок
    const h2 = document.createElement('h2');
    h2.textContent = item.title || '';
    box.appendChild(h2);

    // Строка метода и URL
    const line = document.createElement('div');
    line.className = 'line';

    const method = document.createElement('span');
    method.className = 'method';
    method.textContent = item.method || 'GET';
    method.setAttribute('data-m', (item.method || 'GET').toUpperCase());
    line.appendChild(method);

    if (item.url) {
      const urlWrap = document.createElement('div');
      urlWrap.className = 'url-wrap';
      
      const urlEl = document.createElement('span');
      urlEl.className = 'url';
      urlEl.textContent = item.url;
      
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.innerHTML = '📋';
      copyBtn.title = 'Копировать URL';
      copyBtn.addEventListener('click', () => copyToClipboard(item.url, copyBtn));

      urlWrap.appendChild(urlEl);
      urlWrap.appendChild(copyBtn);
      line.appendChild(urlWrap);
    }
    box.appendChild(line);

    // Описание
    if (item.description) {
      const descEl = document.createElement('div');
      descEl.className = 'desc';
      const lines = item.description.split('\n').filter(l => l.trim() !== '');
      if (lines.length > 1) {
        const ul = document.createElement('ul');
        lines.forEach(text => {
          const li = document.createElement('li');
          li.textContent = text.replace('⏵', '').trim(); 
          ul.appendChild(li);
        });
        descEl.appendChild(ul);
      } else {
        descEl.textContent = item.description.replace('⏵', '').trim();
      }
      box.appendChild(descEl);
    }

    // Параметры и Playground
    const inputsMap = {}; 
    if (item.params && item.params.length) {
      const table = document.createElement('table');
      table.className = 'params-table';
      table.innerHTML = '<thead><tr><th>Параметр</th><th>Тип</th><th>Описание</th><th>Значение</th></tr></thead>';
      const tbody = document.createElement('tbody');
      
      item.params.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td><code>' + escapeHtml(p.name) + '</code></td>' +
          '<td>' + escapeHtml(p.type || '') + '</td>' +
          '<td>' + escapeHtml(p.description || '') + '</td>' +
          '<td></td>';
          
        if (item.canRun && !item.isCode) {
          const tdInput = tr.lastElementChild;
          const input = document.createElement('input');
          input.className = 'param-input';
          input.placeholder = 'Введите...';
          input.addEventListener('keydown', (e) => e.stopPropagation());
          tdInput.appendChild(input);
          inputsMap[p.name] = input;
        }
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      box.appendChild(table);
    }

    // Блок Выполнения (Playground)
    if (item.canRun && item.method === 'GET' && !item.isCode) {
      const responseBlock = document.createElement('div');
      responseBlock.className = 'response-block';
      const preResponse = document.createElement('pre');
      responseBlock.appendChild(preResponse);

      const runBtn = document.createElement('button');
      runBtn.className = 'btn-run';
      runBtn.innerHTML = '▶ Выполнить';
      
      runBtn.addEventListener('click', async () => {
        sfx.click();
        runBtn.disabled = true;
        runBtn.innerHTML = '<span class="spinner"></span> Загрузка...';
        responseBlock.classList.add('show');
        responseBlock.classList.remove('error');
        preResponse.textContent = '...';
        
        let targetUrl = item.url;
        
        // Подстановка параметров
        Object.keys(inputsMap).forEach(key => {
          const val = inputsMap[key].value.trim();
          if (val) {
            targetUrl = targetUrl.replace(`{${key}}`, encodeURIComponent(val));
            targetUrl = targetUrl.replace(`/${key}`, `/${encodeURIComponent(val)}`); 
          }
        });
        
        const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(targetUrl);

        try {
          const res = await fetch(proxyUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          preResponse.textContent = JSON.stringify(data, null, 2);
        } catch (err) {
          responseBlock.classList.add('error');
          preResponse.textContent = 'Ошибка запроса:\n' + err.message;
        } finally {
          runBtn.disabled = false;
          runBtn.innerHTML = '▶ Выполнить';
        }
      });
      
      box.appendChild(runBtn);
      box.appendChild(responseBlock);
    }

    // Пример кода
    if (item.example) {
      const headerWrap = document.createElement('div');
      headerWrap.className = 'example-header';
      
      const label = document.createElement('div');
      label.className = 'example-label';
      label.textContent = item.isCode ? 'Пример кода:' : 'Пример:';
      headerWrap.appendChild(label);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn text-copy';
      copyBtn.innerHTML = '📋 Скопировать';
      copyBtn.addEventListener('click', () => copyToClipboard(item.example, copyBtn));
      headerWrap.appendChild(copyBtn);

      box.appendChild(headerWrap);

      const pre = document.createElement('pre');
      pre.textContent = item.example.trim();
      box.appendChild(pre);
    }

    allEndpoints.push({
      element: box,
      title: item.title || '',
      desc: item.description || '',
      url: item.url || '',
      method: (item.method || 'GET').toUpperCase()
    });

    box.addEventListener('mouseenter', sfx.hover);
    box.addEventListener('click', () => sfx.click());

    contentEl.appendChild(box);
  });

  // Подсветка в сайдбаре
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        contentById.forEach(el => el.classList.remove('active'));
        const link = contentById.get(entry.target.id);
        if (link) link.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

  contentById.forEach((_, id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
