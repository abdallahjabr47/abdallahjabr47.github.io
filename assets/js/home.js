/* Home page: project cards, gallery, scroll-driven phone, about text, craft demos, design system, FAQ */
(function () {
  const { $, $$, clamp, esc, scan, onScroll, toast, loadProjects, reduce } = window.Site;

  /* =============== mock screens (until real screenshots are uploaded) =============== */
  function mockPhone(i, title) {
    const v = i % 4;
    if (v === 0) return `<div class="mock"><div class="mh"><b>${esc(title)}</b><i></i></div><div class="mhero"><s style="width:40%"></s><s style="width:70%"></s></div><span class="ln" style="width:45%"></span><div class="row"><i></i><i></i><i></i></div><div class="btn-m"></div></div>`;
    if (v === 1) return `<div class="mock"><div class="mh"><b>Discover</b><i></i></div><span class="ln" style="height:26px;border-radius:9px"></span>${'<div class="item"><i></i><div><span class="ln" style="width:70%;background:rgba(255,255,255,.5)"></span><span class="ln" style="width:45%"></span></div></div>'.repeat(5)}</div>`;
    if (v === 2) return `<div class="mock"><div class="mhero" style="flex-basis:48%"><s style="width:30%"></s><s style="width:80%"></s><s style="width:55%;opacity:.5"></s></div><span class="ln" style="width:85%"></span><span class="ln" style="width:70%"></span><span class="ln" style="width:78%"></span><div class="btn-m"></div></div>`;
    return `<div class="mock"><div class="mh"><b>Profile</b><i></i></div><div style="display:flex;flex-direction:column;align-items:center;gap:7px;padding:8px 0"><i style="width:54px;height:54px;border-radius:50%;background:var(--tint)"></i><span class="ln" style="width:50%;background:rgba(255,255,255,.5)"></span><span class="ln" style="width:35%"></span></div><div class="row"><i style="aspect-ratio:1"></i><i style="aspect-ratio:1"></i><i style="aspect-ratio:1"></i></div><div class="row"><i style="aspect-ratio:1"></i><i style="aspect-ratio:1"></i><i style="aspect-ratio:1"></i></div></div>`;
  }
  const mockWeb = () => `<div class="mock-web"><div class="nv"><i></i><i style="width:120px;opacity:.5"></i></div><div class="hb"><s></s><s></s></div><div class="cols"><i></i><i></i><i></i></div></div>`;
  const imgOr = (src, alt, fallback) => src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">` : fallback;

  /* =============== project cards =============== */
  function cardHTML(p, i) {
    const type = p.type || 'mobile';
    const tint = (p.cover && p.cover.tint) || '#2B3A8F';
    const href = 'project.html#' + encodeURIComponent(p.slug);
    const phoneShots = (p.screens && p.screens.length) ? p.screens.map((s) => imgOr(s, p.title + ' screen', '')) : [0, 1, 2, 3].map((k) => mockPhone(k, p.title));
    const webShots = (p.webScreens && p.webScreens.length) ? p.webScreens.map((s) => imgOr(s, p.title + ' website', '')) : [0, 1, 2].map(mockWeb);
    const count = type === 'web' ? webShots.length : phoneShots.length;
    const laptop = type !== 'mobile' ? `<div class="laptop-f"><div class="lid"><div class="scr"><div class="reel" data-reel>${webShots.map((s) => `<div>${s}</div>`).join('')}</div></div></div><div class="base"></div></div>` : '';
    const phone = type !== 'web' ? `<div class="phone-f"><div class="scr"><span class="island"></span><div class="reel" data-reel>${phoneShots.map((s) => `<div>${s}</div>`).join('')}</div></div></div>` : '';
    const catShort = (p.category || '').split('·')[0].trim();
    const icon = p.icon ? `<img src="${esc(p.icon)}" alt="">` : esc((p.title || '?').charAt(0));
    return `
    <article class="pcard type-${type}" data-type="${type}" style="--tint:${esc(tint)}" data-reveal>
      <div class="pc-head">
        <span class="app-icon">${icon}</span>
        <div class="nm"><h3>${esc(p.title)}</h3><p>${esc(p.tagline || p.category || '')}</p></div>
        <span class="meta">${esc(catShort)}${p.year ? ' · ' + esc(p.year) : ''}</span>
      </div>
      <div class="stage-panel" data-cursor="Explore case ↗" data-href="${href}" data-n="${count}">
        <div class="sp-badges"><span class="l"><span class="tag">${String(i + 1).padStart(2, '0')}</span><span class="tag">${esc(p.platform || (type === 'web' ? 'Website' : 'Mobile App'))}</span></span><span class="dots" aria-hidden="true">${Array.from({ length: count }, (_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</span></div>
        <div class="devices2">${laptop}${phone}</div>
        <button class="sp-arrow a-prev" type="button" aria-label="Previous screen of ${esc(p.title)}" disabled>←</button>
        <button class="sp-arrow a-next" type="button" aria-label="Next screen of ${esc(p.title)}"${count < 2 ? ' disabled' : ''}>→</button>
        <a class="explore" href="${href}">Explore case <span aria-hidden="true">↗</span></a>
      </div>
      <div class="pc-foot">
        <p>${esc(p.summary || '')}</p>
        ${p.status ? `<span class="status-pill ${({ 'Live': 'live', 'In progress': 'dev', 'Shipped': 'done' })[p.status] || (p.live ? 'live' : 'muted')}">${esc(p.status)}</span>` : ''}
      </div>
    </article>`;
  }

  function wireCard(card) {
    const panel = $('.stage-panel', card);
    const reels = $$('[data-reel]', card);
    const dots = $$('.dots i', card);
    const prev = $('.sp-arrow.a-prev', card), next = $('.sp-arrow.a-next', card);
    const n = parseInt(panel.dataset.n, 10) || 1;
    let i = 0;
    const go = (k) => {
      i = clamp(k, 0, n - 1);
      reels.forEach((r) => { const len = r.children.length || 1; r.style.transform = `translateX(-${(i % len) * 100}%)`; });
      dots.forEach((d, j) => d.classList.toggle('on', j === i));
      prev.disabled = i === 0; next.disabled = i >= n - 1;
    };
    prev.addEventListener('click', (e) => { e.stopPropagation(); go(i - 1); });
    next.addEventListener('click', (e) => { e.stopPropagation(); go(i + 1); });
    let x0 = null, moved = false;
    panel.addEventListener('pointerdown', (e) => { x0 = e.clientX; moved = false; });
    panel.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { moved = true; go(i + (dx < 0 ? 1 : -1)); }
    });
    panel.addEventListener('click', (e) => {
      if (moved || e.target.closest('button, a')) return;
      location.href = panel.dataset.href;
    });
  }

  function renderProjects(list) {
    const grid = $('#projects');
    if (!list.length) { grid.innerHTML = '<p class="muted">No projects yet — add your first one from the admin page.</p>'; return; }
    grid.innerHTML = list.map(cardHTML).join('');
    $$('.pcard', grid).forEach(wireCard);
    scan(grid);
    const stat = $('#stat-projects'); if (stat) stat.dataset.count = list.length;
  }

  /* filters */
  const fwrap = $('.filters');
  function placeThumb(group) {
    const on = $('button.on', group), th = $('.thumb', group);
    if (!on || !th) return;
    th.style.width = on.offsetWidth + 'px';
    th.style.transform = `translateX(${on.offsetLeft}px)`;
  }
  if (fwrap) {
    $$('button', fwrap).forEach((b) => b.addEventListener('click', () => {
      $$('button', fwrap).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      placeThumb(fwrap);
      const f = b.dataset.filter;
      $$('.pcard').forEach((c) => {
        const t = c.dataset.type;
        const show = f === 'all' || t === f || t === 'both';
        c.classList.toggle('hide', !show);
      });
    }));
    requestAnimationFrame(() => placeThumb(fwrap));
    addEventListener('resize', () => placeThumb(fwrap));
    if (document.fonts) document.fonts.ready.then(() => placeThumb(fwrap));
  }

  /* =============== tilted screens gallery =============== */
  const cols = $$('.tcol');
  async function buildGallery(list) {
    const tints = list.length ? list.map((p) => (p.cover && p.cover.tint) || '#2B3A8F') : ['#2A1530', '#14254A', '#1D3A33', '#3A2814', '#10343F', '#2E1F18'];
    const accents = ['linear-gradient(140deg,#2B3A8F,#E2577A)', 'linear-gradient(140deg,#1D6F6A,#0F2F3A)', 'linear-gradient(140deg,#1769E0,#1A2050)', 'linear-gradient(140deg,#8C5A1E,#3A230F)', 'linear-gradient(140deg,#5C9BF5,#0E1119)', 'linear-gradient(140deg,#6A2E8C,#12131E)'];
    let imgs = [];
    try { const s = await window.Site.getSite(); if (s && Array.isArray(s.showcase)) imgs = s.showcase.filter(Boolean); } catch (e) {}
    if (!imgs.length) list.forEach((p) => { (p.webScreens || []).forEach((s) => imgs.push(s)); (p.screens || []).forEach((s) => imgs.push(s)); ((p.gallery && p.gallery.after) || []).forEach((g) => g.image && imgs.push(g.image)); });
    const perCol = Math.max(5, Math.ceil(imgs.length / cols.length));
    let k = 0;
    cols.forEach((col, ci) => {
      let html = '';
      for (let j = 0; j < perCol; j++, k++) {
        const img = imgs.length ? imgs[(k * 7 + ci) % imgs.length] : '';
        html += img
          ? `<div class="tile has-img"><img src="${esc(img)}" alt="" loading="lazy" decoding="async"></div>`
          : `<div class="tile ph-tile" style="--tbg:${tints[k % tints.length]}33;--tacc:${accents[(k + ci) % accents.length]}"><div class="sb"><b>9:41</b><span></span></div><div class="tb"><i style="width:42%"></i><i class="av"></i></div><div class="hero-blk"><i style="width:52%"></i><i style="width:74%;opacity:.6"></i></div><div class="lst">${'<div><i class="th"></i><span><i style="width:70%"></i><i style="width:45%;opacity:.5"></i></span></div>'.repeat(3)}</div><div class="nav"><i></i><i></i><i></i><i></i></div></div>`;
      }
      col.innerHTML = html;
    });
  }
  const screens = $('.screens');
  if (screens && !reduce) {
    onScroll(() => {
      const r = screens.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = clamp((innerHeight - r.top) / (innerHeight + r.height));
      cols.forEach((c) => { c.style.transform = `translateY(${(p - 0.5) * parseFloat(c.dataset.speed || 0) * 2}px)`; });
    });
  }

  /* =============== scroll-driven phone =============== */
  const stagesEl = $('.stages');
  const phone = $('.phone');
  const steps = $$('.step');
  const stepsOl = $('.steps ol');
  if (stagesEl && phone) {
    let cur = -1;
    onScroll(() => {
      const r = stagesEl.getBoundingClientRect();
      const total = r.height - innerHeight;
      const p = total > 0 ? clamp(-r.top / total) : 0;
      const s = Math.min(3, Math.floor(p * 4));
      if (stepsOl) stepsOl.style.setProperty('--p', p.toFixed(3));
      $('.rail') && $('.rail').style.setProperty('--p', p.toFixed(3));
      if (s !== cur) {
        cur = s;
        phone.dataset.stage = String(s);
        steps.forEach((b, j) => { b.classList.toggle('active', j === s); b.setAttribute('aria-current', j === s ? 'step' : 'false'); });
      }
    });
    steps.forEach((b) => b.addEventListener('click', () => {
      const j = parseInt(b.dataset.step, 10);
      const top = stagesEl.getBoundingClientRect().top + scrollY;
      const total = stagesEl.offsetHeight - innerHeight;
      scrollTo({ top: top + total * ((j + 0.5) / 4), behavior: reduce ? 'auto' : 'smooth' });
    }));
  }

  /* =============== about: words light up while scrolling =============== */
  const words = $('[data-words]');
  if (words) {
    const wrapText = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
            else { const s = document.createElement('span'); s.className = 'wd'; s.textContent = part; frag.appendChild(s); }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) wrapText(n);
      });
    };
    wrapText(words);
    const all = $$('.wd', words);
    onScroll(() => {
      const r = words.getBoundingClientRect();
      const p = clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.25));
      const lit = Math.round(p * all.length * 1.1);
      all.forEach((w, j) => w.classList.toggle('lit', j < lit));
    });
  }

  /* =============== craft demos =============== */
  const ba = $('#ba');
  if (ba) {
    const input = $('input', ba);
    const set = (v) => ba.style.setProperty('--x', v + '%');
    input.addEventListener('input', () => set(input.value));
    const baIO = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting || reduce) return;
      baIO.disconnect();
      let t0 = null;
      const anim = (t) => { if (t0 == null) t0 = t; const k = clamp((t - t0) / 1600); const v = 50 + Math.sin(k * Math.PI * 2) * 22; set(v); input.value = v; if (k < 1) requestAnimationFrame(anim); };
      requestAnimationFrame(anim);
    }, { threshold: 0.5 });
    baIO.observe(ba);
  }
  const sb = $('#stateBtn');
  if (sb) {
    const setS = (v) => { sb.dataset.s = v; $$('.s', sb).forEach((x) => x.classList.toggle('cur', x.dataset.v === v)); };
    sb.addEventListener('click', () => {
      if (sb.dataset.s !== 'idle') return;
      setS('loading');
      setTimeout(() => setS('done'), 1300);
      setTimeout(() => setS('idle'), 3300);
    });
  }

  /* =============== design system =============== */
  const tokens = [['Primary', '#1769E0', '--blue'], ['Sky', '#5C9BF5', '--sky'], ['Mint', '#5FB894', '--mint'], ['Sand', '#D8A960', '--sand'], ['Lilac', '#A497DB', '--lilac'], ['Night', '#07080B', '--bg'], ['Surface', '#12141B', '--panel']];
  const sw = $('#swatches');
  if (sw) {
    sw.innerHTML = tokens.map(([n, h, v]) => `<button class="sw" type="button" data-hex="${h}" aria-label="Copy ${n} ${h}"><i style="background:${h}"></i><span class="sw-n"><b>${n}</b><code>${v}</code></span><small>${h}</small></button>`).join('');
    $$('.sw', sw).forEach((b) => b.addEventListener('click', async () => {
      const hex = b.dataset.hex;
      try { await navigator.clipboard.writeText(hex); toast('Copied ' + hex); }
      catch (e) { toast(hex); }
      const sm = $('small', b); sm.textContent = 'Copied ✓'; sm.style.color = 'var(--green)';
      setTimeout(() => { sm.textContent = hex; sm.style.color = ''; }, 1400);
    }));
  }
  function wireSeg(seg, onPick) {
    if (!seg) return;
    const bs = $$('button', seg), th = $('.thumb', seg);
    const place = () => { const j = bs.findIndex((b) => b.classList.contains('on')); th.style.transform = `translateX(${j * 100}%)`; };
    bs.forEach((b) => b.addEventListener('click', () => { bs.forEach((x) => x.classList.toggle('on', x === b)); place(); onPick && onPick(b); }));
    place();
  }
  wireSeg($('#themeSeg'), (b) => { const c = $('#cmp'); if (c) c.dataset.theme = b.dataset.v; });
  wireSeg($('#rangeSeg'));
  (function () {
    const st = $('#tkSt'), bar = $('#tkBar');
    if (!st) return;
    const S = [['Backlog', '#D8A960', 4], ['In sprint', '#7FA6E8', 33], ['In review', '#A497DB', 66], ['Shipped', '#5FB894', 100]];
    const paint = (k) => { const [t, c, w] = S[k]; st.textContent = t; st.style.setProperty('--ac', c); bar.style.width = w + '%'; bar.style.background = k === 3 ? c : ''; };
    paint(+st.dataset.i);
    st.addEventListener('click', () => { const k = (+st.dataset.i + 1) % S.length; st.dataset.i = k; paint(k); });
  })();
  $$('.switch').forEach((s) => s.addEventListener('click', () => s.setAttribute('aria-checked', String(s.getAttribute('aria-checked') !== 'true'))));

  /* =============== smooth open / close (works in every browser) =============== */
  function slide(panel, open) {
    if (!panel) return;
    if (reduce) { panel.style.height = open ? 'auto' : '0px'; return; }
    const h = panel.scrollHeight;
    if (open) {
      panel.style.height = h + 'px';
      const done = (e) => { if (e.target !== panel) return; panel.style.height = 'auto'; panel.removeEventListener('transitionend', done); };
      panel.addEventListener('transitionend', done);
    } else {
      panel.style.height = h + 'px';
      panel.getBoundingClientRect();
      panel.style.height = '0px';
    }
  }

  /* =============== FAQ =============== */
  $$('.faq-item').forEach((item, k) => {
    const q = $('.faq-q', item), a = $('.faq-a', item);
    const id = 'faq-a-' + k;
    a.id = id; q.setAttribute('aria-controls', id);
    if (item.classList.contains('open')) a.style.height = 'auto';
    q.addEventListener('click', () => {
      const open = !item.classList.contains('open');
      $$('.faq-item.open').forEach((o) => { o.classList.remove('open'); $('.faq-q', o).setAttribute('aria-expanded', 'false'); slide($('.faq-a', o), false); });
      if (open) { item.classList.add('open'); q.setAttribute('aria-expanded', 'true'); slide(a, true); }
    });
  });

  /* =============== product lens (PM / PO / Design) =============== */
  const lens = $('#lens'), flow = $('#flow');
  if (lens && flow) {
    const btns = $$('button', lens);
    let auto = !reduce, ai = 0, timer;
    const apply = (k) => {
      btns.forEach((b) => { const on = b.dataset.lens === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      placeThumb(lens);
      flow.classList.toggle('filtering', k !== 'all');
      $$('li', flow).forEach((li) => li.classList.toggle('hit', k !== 'all' && li.dataset.who.split(' ').includes(k)));
    };
    btns.forEach((b) => b.addEventListener('click', () => { auto = false; clearInterval(timer); apply(b.dataset.lens); }));
    const order = ['pm', 'po', 'ds', 'all'];
    const lensIO = new IntersectionObserver((es) => {
      es.forEach((e) => {
        clearInterval(timer);
        if (e.isIntersecting && auto) timer = setInterval(() => { if (!auto) return clearInterval(timer); apply(order[ai++ % order.length]); }, 2200);
      });
    }, { threshold: 0.4 });
    lensIO.observe(flow);
    requestAnimationFrame(() => placeThumb(lens));
    addEventListener('resize', () => placeThumb(lens));
    if (document.fonts) document.fonts.ready.then(() => placeThumb(lens));
  }

  /* =============== principles demos =============== */
  const clarity = $('#clarity');
  if (clarity) {
    const play = () => { clarity.classList.remove('tidy'); setTimeout(() => clarity.classList.add('tidy'), 900); };
    const cIO = new IntersectionObserver((es) => { if (es[0].isIntersecting) { cIO.disconnect(); play(); } }, { threshold: 0.6 });
    cIO.observe(clarity);
    $('[data-replay="clarity"]').addEventListener('click', play);
  }
  const a11y = $('#a11y');
  if (a11y) {
    const lum = (hex) => { const c = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    const modes = { before: { fg: '#A7B3AF', bg: '#F1F5F3' }, after: { fg: '#0B1513', bg: '#F1F5F3' } };
    const setMode = (m) => {
      const { fg, bg } = modes[m];
      a11y.dataset.mode = m;
      a11y.style.setProperty('--a-fg', fg); a11y.style.setProperty('--a-bg', bg);
      $$('[data-a11y]', a11y).forEach((b) => b.classList.toggle('on', b.dataset.a11y === m));
      const r = ratio(fg.slice(1), bg.slice(1));
      const grade = r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : 'Fail';
      const out = $('#ratio'); out.textContent = `${r.toFixed(1)}:1 · ${grade}`; out.className = 'ratio ' + (grade === 'Fail' ? 'bad' : 'good');
    };
    $$('[data-a11y]', a11y).forEach((b) => b.addEventListener('click', () => setMode(b.dataset.a11y)));
    setMode('after');
  }
  const grid8 = $('#grid8'), scatterBtn = $('#scatterBtn');
  if (grid8) {
    const tiles = $$('i', grid8);
    const scatter = () => {
      tiles.forEach((t) => { t.style.setProperty('--tx', (Math.random() * 120 - 60).toFixed(0) + 'px'); t.style.setProperty('--ty', (Math.random() * 70 - 35).toFixed(0) + 'px'); t.style.setProperty('--r', (Math.random() * 50 - 25).toFixed(0) + 'deg'); });
      grid8.classList.add('scattered');
      setTimeout(() => grid8.classList.remove('scattered'), 1100);
    };
    scatterBtn.addEventListener('click', scatter);
    const gIO = new IntersectionObserver((es) => { if (es[0].isIntersecting) { gIO.disconnect(); scatter(); } }, { threshold: 0.6 });
    gIO.observe(grid8);
  }

  /* =============== project index with floating preview =============== */
  const indexList = $('#indexList'), hp = $('#hoverPreview');
  function renderIndex(list) {
    if (!indexList) return;
    indexList.innerHTML = list.map((p, i) => `
      <li><a class="ix-row" href="project.html#${encodeURIComponent(p.slug)}" data-i="${i}">
        <span class="ix-n">${String(i + 1).padStart(2, '0')}</span>
        <span class="ix-t">${esc(p.title)}</span>
        <span class="ix-c">${esc((p.category || '').split('·')[0].trim())}</span>
        <span class="ix-p">Preview <span aria-hidden="true">↗</span></span>
      </a></li>`).join('');
    if (!hp || !window.Site.fine) return;
    const inner = $('.hp-inner', hp);
    let x = 0, y = 0, cx = 0, cy = 0, vx = 0, on = false, raf;
    const loop = () => {
      const nx = cx + (x - cx) * 0.14, ny = cy + (y - cy) * 0.14;
      vx = nx - cx; cx = nx; cy = ny;
      hp.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%) rotate(${clamp(vx * 0.6, -12, 12)}deg)`;
      raf = requestAnimationFrame(loop);
    };
    indexList.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; });
    $$('.ix-row', indexList).forEach((row) => {
      row.addEventListener('pointerenter', (e) => {
        const p = list[parseInt(row.dataset.i, 10)];
        const tint = (p.cover && p.cover.tint) || '#2B3A8F';
        const web = p.type === 'web';
        const img = web ? (p.webScreens || [])[0] : (p.screens || [])[0];
        inner.className = 'hp-inner ' + (web ? 'is-web' : 'is-phone');
        inner.style.setProperty('--tint', tint);
        inner.innerHTML = img ? `<img src="${esc(img)}" alt="">` : (web ? mockWeb() : mockPhone(0, p.title));
        if (!on) { x = cx = e.clientX; y = cy = e.clientY; cancelAnimationFrame(raf); loop(); }
        on = true; hp.classList.add('show');
      });
    });
    indexList.addEventListener('pointerleave', () => { on = false; hp.classList.remove('show'); setTimeout(() => { if (!on) cancelAnimationFrame(raf); }, 400); });
  }

  /* =============== experience =============== */
  function renderExperience(list) {
    const box = $('#xp');
    if (!box) return;
    const rows = list.filter((x) => x.visible !== false);
    box.innerHTML = rows.map((x, i) => {
      const current = /present|now/i.test(x.dates || '');
      const hl = (x.highlights || []).length;
      const more = hl || x.summary;
      const meta = [x.company, x.location, x.type].filter(Boolean).map(esc).join('<i aria-hidden="true">·</i>');
      return `
      <div class="xp-row${more ? ' has-hl' : ''}" data-reveal>
        <div class="xp-head">
          <div class="xp-main"><h3>${esc(x.role)}</h3><p class="xp-meta">${meta}</p></div>
          <span class="xp-date${current ? ' now' : ''}">${esc(x.dates)}</span>
          ${more ? `<button class="xp-tog" type="button" aria-expanded="false" aria-controls="xp-hl-${i}" aria-label="Show details for ${esc(x.role)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>` : '<span></span>'}
        </div>
        ${more ? `<div class="xp-hl" id="xp-hl-${i}"><div class="xp-body">${x.summary ? `<p>${esc(x.summary)}</p>` : ''}${hl ? `<ul>${x.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}</div></div>` : ''}
      </div>`;
    }).join('');
    $$('.xp-row', box).forEach((row) => {
      const btn = $('.xp-tog', row);
      if (!btn) return;
      const toggle = () => { const open = !row.classList.contains('open'); row.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); slide($('.xp-hl', row), open); };
      $('.xp-head', row).addEventListener('click', (e) => { if (e.target.closest('a')) return; toggle(); });
    });
    scan(box);
    onScroll(() => {
      const r = box.getBoundingClientRect();
      const p = clamp((innerHeight * 0.7 - r.top) / r.height);
      box.style.setProperty('--xp', p.toFixed(3));
    });
  }
  const draftX = window.Site.previewDraft && window.Site.previewDraft();
  if (draftX && draftX.experience) renderExperience(draftX.experience);
  else fetch('data/experience.json?v=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then(renderExperience).catch((e) => console.error(e));

  /* =============== load data =============== */
  loadProjects()
    .then((list) => { renderProjects(list); buildGallery(list); renderIndex(list); })
    .catch((err) => {
      console.error(err);
      buildGallery([]);
      $('#projects').innerHTML = '<p class="muted">Projects could not be loaded. If you opened this file directly, run a local server (see README) — on GitHub Pages it works automatically.</p>';
    });

  /* =============== testimonials (from Profile & links in the admin) =============== */
  (async () => {
    const sec = $('#testimonials'), box = $('#testi');
    if (!sec || !box || !window.Site.getSite) return;
    const s = await window.Site.getSite();
    const list = ((s && s.testimonials) || []).filter((t) => t && t.quote);
    if (!list.length) return;
    box.innerHTML = list.map((t, i) => `
      <figure class="tq glass" data-reveal style="--d:${i * 90}ms">
        <span class="qm" aria-hidden="true">“</span>
        <blockquote>${esc(t.quote)}</blockquote>
        <figcaption><span class="av" aria-hidden="true">${esc((t.name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase())}</span><span><b>${esc(t.name || '')}</b><small>${esc(t.role || '')}</small></span></figcaption>
      </figure>`).join('');
    sec.hidden = false;
    scan(sec);
  })();
})();
