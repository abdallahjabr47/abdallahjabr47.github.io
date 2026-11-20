/* Shared behaviour for every page: cursor, progress bar, nav, reveals, split text, counters, clock, toast */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- one rAF-throttled scroll/resize loop ---------- */
  const scrollFns = [];
  let ticking = false;
  function runScroll() { ticking = false; scrollFns.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }
  function requestTick() { if (!ticking) { ticking = true; requestAnimationFrame(runScroll); } }
  addEventListener('scroll', requestTick, { passive: true });
  addEventListener('resize', requestTick);
  const onScroll = (fn) => { scrollFns.push(fn); requestTick(); };

  /* ---------- split text into letters ---------- */
  function splitText(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            Array.from(part).forEach((ch) => {
              const c = document.createElement('span');
              c.className = 'c'; c.textContent = ch; c.style.setProperty('--i', i++);
              w.appendChild(c);
            });
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  }

  /* ---------- count-up ---------- */
  function countUp(el) {
    const end = parseFloat(el.dataset.count);
    if (isNaN(end)) return;
    if (reduce) { el.textContent = end; return; }
    const dur = 1400, t0 = performance.now();
    const step = (t) => {
      const p = clamp((t - t0) / dur);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- reveal observer ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add('in');
      if (el.dataset.count != null) countUp(el);
      io.unobserve(el);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });

  function scan(root = document) {
    $$('[data-split]', root).forEach((el) => { splitText(el); io.observe(el); });
    $$('[data-reveal], [data-count]', root).forEach((el) => io.observe(el));
    $$('[data-loop]', root).forEach((track) => {
      if (track.dataset.looped) return;
      track.dataset.looped = '1';
      Array.from(track.children).forEach((c) => { const k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); track.appendChild(k); });
    });
    $$('[data-icon]', root).forEach((el) => {
      if (el.dataset.iconDone) return;
      el.dataset.iconDone = '1';
      const ic = (window.ICONS || {})[el.dataset.icon];
      if (!ic) { el.textContent = el.dataset.fb || ''; return; }
      el.classList.add('has-logo');
      if (ic.full) { el.classList.add('full'); el.innerHTML = `<svg viewBox="${ic.fvb}" aria-hidden="true">${ic.full}</svg>`; return; }
      el.style.color = ic.c === 'ink' ? 'var(--ink)' : ic.c;
      el.innerHTML = `<svg viewBox="${ic.vb}" fill="currentColor" aria-hidden="true">${ic.p}</svg>`;
    });
    $$('[data-img]', root).forEach((el) => {
      if (el.dataset.imgDone) return;
      el.dataset.imgDone = '1';
      const src = el.dataset.img, im = new Image();
      im.onload = () => { el.style.backgroundImage = 'url("' + src + '")'; el.classList.add('has-img'); };
      im.src = src;
    });
    if (fine) {
      $$('[data-glow]', root).forEach((el) => {
        if (el.dataset.glowDone) return;
        el.dataset.glowDone = '1';
        el.addEventListener('pointermove', (ev) => {
          const r = el.getBoundingClientRect();
          el.style.setProperty('--mx', ev.clientX - r.left + 'px');
          el.style.setProperty('--my', ev.clientY - r.top + 'px');
        });
      });
      $$('[data-magnetic]', root).forEach((el) => {
        if (el.dataset.magDone || reduce) return;
        el.dataset.magDone = '1';
        el.addEventListener('pointermove', (ev) => {
          const r = el.getBoundingClientRect();
          const x = ev.clientX - r.left - r.width / 2, y = ev.clientY - r.top - r.height / 2;
          el.style.transform = `translate(${x * 0.22}px, ${y * 0.3}px)`;
        });
        el.addEventListener('pointerleave', () => { el.style.transform = ''; });
      });
    }
  }

  /* ---------- progress bar + nav state ---------- */
  const bar = $('.progress');
  const nav = $('#nav');
  onScroll(() => {
    const h = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${h > 0 ? clamp(scrollY / h) : 0})`;
    if (nav) nav.classList.toggle('scrolled', scrollY > 30);
  });

  /* ---------- mobile menu ---------- */
  const burger = $('.burger');
  if (burger) {
    burger.addEventListener('click', () => {
      const open = !document.body.classList.contains('menu-open');
      document.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    $$('.nav-links a').forEach((a) => a.addEventListener('click', () => {
      document.body.classList.remove('menu-open');
      burger.setAttribute('aria-expanded', 'false');
    }));
  }

  /* ---------- active nav link ---------- */
  const links = $$('.nav-links a[href^="#"]');
  if (links.length) {
    const map = new Map();
    links.forEach((a) => { const s = $(a.getAttribute('href')); if (s) map.set(s, a); });
    const navIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const a = map.get(e.target);
        if (a && e.isIntersecting) { links.forEach((l) => l.classList.remove('active')); a.classList.add('active'); }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, s) => navIO.observe(s));
  }

  /* ---------- custom cursor ---------- */
  const ring = $('.cursor-ring'), dot = $('.cursor-dot');
  if (fine && ring && dot) {
    let mx = -100, my = -100, rx = -100, ry = -100, shown = false;
    addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
      if (!shown) { shown = true; document.documentElement.classList.add('has-cursor'); rx = mx; ry = my; }
    }, { passive: true });
    document.addEventListener('pointerleave', () => { document.documentElement.classList.remove('has-cursor'); shown = false; });
    addEventListener('pointerdown', () => ring.classList.add('down'));
    addEventListener('pointerup', () => ring.classList.remove('down'));
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor], a, button, input, label, [role="switch"]');
      const v = t && t.closest('[data-cursor]');
      const btnInside = t && v && t !== v && t.closest('button, a') && v.contains(t.closest('button, a'));
      ring.classList.remove('hover', 'view');
      document.documentElement.classList.remove('has-view');
      ring.textContent = '';
      if (!t) return;
      if (v && !btnInside) { ring.classList.add('view'); ring.textContent = v.dataset.cursor; document.documentElement.classList.add('has-view'); }
      else ring.classList.add('hover');
    });
    const loop = () => {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)` + (ring.classList.contains('down') ? ' scale(.92)' : '');
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* ---------- glass letters near the mouse ---------- */
  (function () {
    if (!fine || reduce) return;
    const R = 95;
    let active = null, chars = [], raf = 0, px = 0, py = 0;
    const clear = () => { chars.forEach((c) => { c.style.removeProperty('--g'); c.classList.remove('gr'); }); chars = []; active = null; };
    const paint = () => {
      raf = 0;
      if (!active) return;
      chars.forEach((c) => {
        const r = c.getBoundingClientRect();
        const dx = Math.max(r.left - px, 0, px - r.right), dy = Math.max(r.top - py, 0, py - r.bottom);
        const d = Math.hypot(dx, dy);
        const g = d >= R ? 0 : Math.pow(1 - d / R, 1.3);
        if (g > 0.01) c.style.setProperty('--g', g.toFixed(2)); else c.style.removeProperty('--g');
        c.classList.toggle('gr', g > 0.7);
      });
    };
    addEventListener('pointermove', (e) => {
      px = e.clientX; py = e.clientY;
      const hd = [...document.querySelectorAll('h1[data-split].in, h2[data-split].in')].find((h) => {
        const r = h.getBoundingClientRect();
        return px > r.left - R && px < r.right + R && py > r.top - R && py < r.bottom + R;
      }) || null;
      if (hd !== active) { clear(); if (hd) { active = hd; chars = [...hd.querySelectorAll('.c')]; } }
      if (active && !raf) raf = requestAnimationFrame(paint);
    }, { passive: true });
    addEventListener('scroll', () => { if (active) clear(); }, { passive: true });
  })();

  /* ---------- floating dots: slow drifting particles that lean away from the mouse ---------- */
  (function () {
    const cv = $('canvas.bg-dots');
    if (!cv || reduce) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, pts = [], mx = -9999, my = -9999;
    const make = () => {
      dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, W * H / 16000));
      pts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .18, vy: -(.05 + Math.random() * .22), r: .6 + Math.random() * 1.6, a: .15 + Math.random() * .45, tw: Math.random() * 6.28, blue: Math.random() < .3 }));
    };
    make(); addEventListener('resize', make);
    addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    let last = 0;
    const tick = (t) => {
      requestAnimationFrame(tick);
      if (document.hidden || t - last < 30) return; last = t;
      const light = document.documentElement.dataset.theme === 'light';
      ctx.clearRect(0, 0, W, H);
      const sy = scrollY * .04;
      pts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.tw += .03;
        const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
        if (d2 < 14400) { const f = (1 - d2 / 14400) * .9; p.x += dx / Math.sqrt(d2 + 1) * f; p.y += dy / Math.sqrt(d2 + 1) * f; }
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
        const al = p.a * (.6 + .4 * Math.sin(p.tw));
        ctx.beginPath(); ctx.arc(p.x, (p.y - sy % H + H) % H, p.r, 0, 6.283);
        ctx.fillStyle = p.blue ? `rgba(92,155,245,${al})` : (light ? `rgba(20,24,34,${al * .5})` : `rgba(255,255,255,${al * .7})`);
        ctx.fill();
      });
    };
    requestAnimationFrame(tick);
  })();

  /* ---------- theme ---------- */
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('theme', t); } catch (e) {}
    $$('[data-theme-toggle]').forEach((b) => b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'));
    $$('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', t === 'dark' ? '#07080B' : '#F4F5F7'));
  }
  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')));
  setTheme(document.documentElement.dataset.theme || 'dark');

  /* ---------- clock + year ---------- */
  function tick() {
    let t = '';
    try { t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Hebron' }); }
    catch (e) { t = new Date().toTimeString().slice(0, 5); }
    $$('[data-clock]').forEach((el) => { el.textContent = t; });
  }
  tick(); setInterval(tick, 15000);
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg) {
    const t = $('.g-toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800);
  }

  /* ---------- data ---------- */
  /* ---------- preview mode (admin "Preview" button) ---------- */
  const isPreview = /[?&]preview\b/.test(location.search);
  function previewDraft() {
    if (!isPreview) return null;
    try {
      const d = JSON.parse(localStorage.getItem('pf-preview') || 'null');
      if (!d) return null;
      const map = d.previews || {};
      const swap = (v) => Array.isArray(v) ? v.map(swap) : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)])) : (typeof v === 'string' && map[v]) ? map[v] : v;
      return { projects: swap(d.projects || []), experience: d.experience || null };
    } catch (e) { return null; }
  }
  if (isPreview) {
    const bar = document.createElement('div');
    bar.className = 'preview-bar';
    bar.innerHTML = '<span><b>Preview</b> — only you can see this. Nothing is live until you press Publish in the admin.</span><button type="button">Close preview</button>';
    bar.querySelector('button').addEventListener('click', () => { location.href = location.pathname + location.hash; });
    document.body.appendChild(bar);
    // keep preview mode when moving between pages
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (/^(index|project)\.html/.test(href) && !/preview/.test(href)) {
        e.preventDefault();
        const [p, h] = href.split('#');
        location.href = p + '?preview=1' + (h ? '#' + h : '');
      }
    }, true);
  }

  async function loadProjects() {
    const draft = previewDraft();
    if (draft) return /project\.html/.test(location.pathname) ? draft.projects : draft.projects.filter((p) => p.published !== false);
    const path = (window.SITE_CONFIG && window.SITE_CONFIG.dataPath) || 'data/projects.json';
    const res = await fetch(path + '?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load ' + path);
    const list = await res.json();
    return list.filter((p) => p.published !== false);
  }

  /* ---------- profile: photos + links from data/site.json (editable in admin → Profile) ---------- */
  function loadImg(el, src) {
    const im = new Image();
    im.onload = () => { el.style.backgroundImage = 'url("' + src + '")'; el.classList.add('has-img'); };
    im.src = src;
  }
  function applySite(s) {
    if (!s) return;
    const url = {
      email: s.email ? 'mailto:' + s.email : '',
      whatsapp: s.whatsapp ? 'https://wa.me/' + String(s.whatsapp).replace(/[^0-9]/g, '') : '',
      linkedin: s.linkedin || '', behance: s.behance || '', dribbble: s.dribbble || '', github: s.github || '', cv: s.cv || ''
    };
    $$('[data-site-href]').forEach((a) => {
      const v = url[a.dataset.siteHref];
      if (v) { a.href = v; a.hidden = false; } else if (a.classList.contains('cpill')) a.hidden = true;
    });
    $$('[data-site-text]').forEach((el) => { const v = s[el.dataset.siteText]; if (v) el.textContent = v; });
    $$('[data-site-img]').forEach((el) => { const v = s[el.dataset.siteImg]; if (v) loadImg(el, v); });
  }
  let siteReady = Promise.resolve(null);
  (function () {
    if (!$('[data-site-href],[data-site-img]')) return;
    let draft = null;
    if (isPreview) { try { const d = JSON.parse(localStorage.getItem('pf-preview') || 'null'); if (d && d.site) { draft = d.site; const map = d.previews || {}; Object.keys(draft).forEach((k) => { if (Array.isArray(draft[k])) draft[k] = draft[k].map((v) => map[v] || v); else if (map[draft[k]]) draft[k] = map[draft[k]]; }); } } catch (e) {} }
    if (draft) { siteReady = Promise.resolve(draft); return applySite(draft); }
    siteReady = fetch('data/site.json?v=' + Date.now(), { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).catch(() => null);
    siteReady.then(applySite);
  })();

  window.Site = { getSite: () => siteReady, $, $$, clamp, esc, scan, onScroll, splitText, toast, loadProjects, previewDraft, isPreview, reduce, fine };
  scan();
})();
