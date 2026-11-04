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
  type: () => beep({ freq: 800, type: 'sine', dur: 0.02, gain: 0.01 })
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

/* ---------- Логика поиска ---------- */
const searchInput = document.getElementById('search-input');
let allEndpoints = []; 

searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  if (query.length % 2 === 0) sfx.type();

  allEndpoints.forEach(item => {
    const el = item.element;
    
    // Если поиск пуст — показываем всё
    if (!query) {
      el.classList.remove('hidden');
      return;
    }

    // Проверяем совпадения в заголовке, описании и URL
    const textToSearch = (
      (item.title || '') + ' ' + 
      (item.desc || '') + ' ' + 
      (item.url || '')
    ).toLowerCase();

    if (textToSearch.includes(query)) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
});


/* ---------- Рендер ---------- */
async function init() {
  const titleEl = document.getElementById('page-title');
  const discEl = document.getElementById('disclaimer');
  const navEl = document.getElementById('side-nav');
  const contentEl = document.getElementById('content');

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

  const items = data.sections || [];

  // 1. Динамически собираем все уникальные категории из JSON
  const uniqueCategories = [];
  items.forEach(item => {
    const cat = item.category || 'Другое';
    if (!uniqueCategories.includes(cat)) {
      uniqueCategories.push(cat);
    }
  });

  // 2. Сортируем категории (чтобы "Другое" было в конце, если оно есть)
  uniqueCategories.sort((a, b) => {
    if (a === 'Другое') return 1;
    if (b === 'Другое') return -1;
    return 0;
  });

  // Группируем эндпоинты по категориям
  const groups = new Map();
  uniqueCategories.forEach(cat => groups.set(cat, []));

  items.forEach((item, i) => {
    const cat = item.category || 'Другое';
    groups.get(cat).push({ item, index: i });
  });

  const contentById = new Map();

  // Боковая навигация
  uniqueCategories.forEach(cat => {
    const list = groups.get(cat);
    if (!list.length) return;

    const groupWrap = document.createElement('div');
    // По умолчанию все закрыты
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

  // Карточки
  items.forEach((item, i) => {
    const id = 'endpoint-' + i;
    const box = document.createElement('div');
    box.className = 'endpoint';
    box.id = id;
    box.setAttribute('data-method', (item.method || 'GET').toUpperCase());

    const h2 = document.createElement('h2');
    h2.textContent = item.title || '';
    box.appendChild(h2);

    const line = document.createElement('div');
    line.className = 'line';

    const method = document.createElement('span');
    method.className = 'method';
    method.textContent = item.method || 'GET';
    method.setAttribute('data-m', (item.method || 'GET').toUpperCase());
    line.appendChild(method);

    if (item.url) {
      const urlEl = document.createElement('span');
      urlEl.className = 'url';
      urlEl.textContent = item.url;
      line.appendChild(urlEl);
    }
    box.appendChild(line);

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

    // Параметры
    if (item.params && item.params.length) {
      const table = document.createElement('table');
      table.className = 'params-table';
      table.innerHTML = '<thead><tr><th>Параметр</th><th>Тип</th><th>Описание</th></tr></thead>';
      const tbody = document.createElement('tbody');
      item.params.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td><code>' + escapeHtml(p.name) + '</code></td>' +
          '<td>' + escapeHtml(p.type || '') + '</td>' +
          '<td>' + escapeHtml(p.description || '') + '</td>';
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      box.appendChild(table);
    }

    // Пример
    if (item.example) {
      const label = document.createElement('div');
      label.className = 'example-label';
      label.textContent = item.isCode ? 'Пример кода:' : 'Пример:';
      box.appendChild(label);
      const pre = document.createElement('pre');
      pre.textContent = item.example.trim();
      box.appendChild(pre);
    }

    // Сохраняем в массив для поиска
    allEndpoints.push({
      element: box,
      title: item.title || '',
      desc: item.description || '',
      url: item.url || ''
    });

    box.addEventListener('mouseenter', sfx.hover);
    box.addEventListener('click', () => sfx.click());

    contentEl.appendChild(box);
  });

  // Подсветка активного пункта в сайдбаре
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
