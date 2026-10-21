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
  nav: () => beep({ freq: 600, type: 'sine', dur: 0.06, gain: 0.025, slide: 120 })
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

  const order = ['Миры', 'Модули', 'Пользователи', 'Онлайн', 'Другое'];
  const groups = new Map();
  order.forEach(k => groups.set(k, []));

  const items = data.sections || [];
  items.forEach((item, i) => {
    const cat = order.includes(item.category) ? item.category : 'Другое';
    groups.get(cat).push({ item, index: i });
  });

  const contentById = new Map();

  // Боковая навигация
  order.forEach(cat => {
    const list = groups.get(cat);
    if (!list.length) return;

    const groupWrap = document.createElement('div');
    // ВАЖНО: сразу добавляем closed, чтобы всё было закрыто по умолчанию
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
    // Устанавливаем атрибут метода для полосы слева
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
      const url = document.createElement('span');
      url.className = 'url';
      url.textContent = item.url;
      line.appendChild(url);
    }
    box.appendChild(line);

    if (item.description) {
      const p = document.createElement('div');
      p.className = 'desc';
      
      const lines = item.description.split('\n').filter(l => l.trim() !== '');
      if (lines.length > 1) {
        const ul = document.createElement('ul');
        lines.forEach(text => {
          const li = document.createElement('li');
          // Так как треугольник теперь рисует CSS, очищаем текст от старых символов, если они остались
          li.textContent = text.replace('⏵', '').trim(); 
          ul.appendChild(li);
        });
        p.appendChild(ul);
      } else {
        p.textContent = item.description.replace('⏵', '').trim();
      }
      box.appendChild(p);
    }

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

    if (item.example) {
      const label = document.createElement('div');
      label.className = 'example-label';
      label.textContent = 'Пример:';
      box.appendChild(label);
      const pre = document.createElement('pre');
      pre.textContent = item.example;
      box.appendChild(pre);
    }

    box.addEventListener('mouseenter', sfx.hover);
    box.addEventListener('click', () => sfx.click());

    contentEl.appendChild(box);
  });

  // Подсветка активного пункта
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