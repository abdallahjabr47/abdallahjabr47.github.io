/* Shared behaviour for every page: cursor, progress bar, nav, reveals, split text, counters, clock, toast */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* Safari (Mac + iPhone) struggles with live blur on many layers: it gets a lighter render path */
  const safari = /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(navigator.userAgent);
  if (safari) document.documentElement.classList.add('is-safari');
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
    el.setAttribute('aria-label', (el.innerText || el.textContent).replace(/\s+/g, ' ').trim());
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
    /* photos managed in the admin (data-site-img) come from site.json only — no request for a default file that isn't there */
    $$('[data-img]', root).forEach((el) => {
      if (el.dataset.imgDone || el.hasAttribute('data-site-img')) return;
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
    $$('section[data-nav]').forEach((s) => { const a = links.find((l) => l.getAttribute('href') === '#' + s.dataset.nav); if (a) map.set(s, a); });
    const navIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const a = map.get(e.target);
        if (a && e.isIntersecting) { links.forEach((l) => l.classList.remove('active')); a.classList.add('active'); }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, s) => navIO.observe(s));
    // sections without a menu link (Testimonials, Contact) clear the highlight instead of leaving FAQ lit
    const free = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((l) => l.classList.remove('active')); }), { rootMargin: '-45% 0px -50% 0px' });
    $$('main > section[id]').filter((s) => !map.has(s) && s.id !== 'hero').forEach((s) => free.observe(s));
  }

  /* ---------- pause looping animations in sections you can't see ---------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('is-away', !e.isIntersecting)), { rootMargin: '200px 0px' });
    $$('main > section, main > div, footer').forEach((s) => io.observe(s));
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
      requestAnimationFrame(loop);
      if (Math.abs(mx - rx) < 0.1 && Math.abs(my - ry) < 0.1 && ring.dataset.d === String(ring.classList.contains('down'))) return;
      ring.dataset.d = String(ring.classList.contains('down'));
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)` + (ring.classList.contains('down') ? ' scale(.92)' : '');
    };
    loop();
  }

  /* ---------- glass letters near the mouse ---------- */
  (function () {
    if (!fine || reduce) return;
    const R = 60;
    let active = null, chars = [], raf = 0, px = 0, py = 0;
    const clear = () => { chars.forEach((c) => { c.style.removeProperty('--g'); c.classList.remove('gr'); }); chars = []; active = null; };
    const paint = () => {
      raf = 0;
      if (!active) return;
      chars.forEach((c) => {
        const r = c.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const nx = Math.abs(px - cx) / Math.max(r.width, 18), ny = Math.abs(py - cy) / (r.height * 0.75);
        const d = Math.max(nx, ny);
        const g = d < 0.55 ? 1 : d < 1.15 ? 0.5 : 0;
        if (g) c.style.setProperty('--g', g); else c.style.removeProperty('--g');
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
      dpr = safari ? 1 : Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(safari ? 50 : 90, W * H / 16000));
      pts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .18, vy: -(.05 + Math.random() * .22), r: .6 + Math.random() * 1.6, a: .15 + Math.random() * .45, tw: Math.random() * 6.28, blue: Math.random() < .3 }));
    };
    make(); addEventListener('resize', make);
    addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    let last = 0;
    const tick = (t) => {
      requestAnimationFrame(tick);
      if (document.hidden || t - last < (safari ? 45 : 30)) return; last = t;
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
  function paintTheme(t) {
    document.documentElement.dataset.theme = t;
    $$('[data-theme-toggle]').forEach((b) => b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'));
    $$('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', t === 'dark' ? '#07080B' : '#F4F5F7'));
  }
  function setTheme(t) { paintTheme(t); try { localStorage.setItem('theme', t); } catch (e) {} }
  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')));
  paintTheme(document.documentElement.dataset.theme || 'dark');
  /* light mode is switched on or off from the admin (site.json → lightMode); off = always dark, no toggle button */
  function applyLightMode(on) {
    const html = document.documentElement, was = html.classList.contains('light-on');
    try { if (on) localStorage.setItem('light-on', '1'); else localStorage.removeItem('light-on'); } catch (e) {}
    html.classList.toggle('light-on', on);
    if (!on) { if (html.dataset.theme !== 'dark') paintTheme('dark'); return; }
    if (!was) { let t = null; try { t = localStorage.getItem('theme'); } catch (e) {} if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; paintTheme(t); }
  }

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
    applyLightMode(s.lightMode === true);
    const url = {
      email: s.email ? 'mailto:' + s.email : '',
      emailcta: s.email ? 'mailto:' + s.email + '?subject=' + encodeURIComponent("Hello Abdallah") : '',
      whatsapp: s.whatsapp ? 'https://wa.me/' + String(s.whatsapp).replace(/[^0-9]/g, '') : '',
      linkedin: s.linkedin || '', behance: s.behance || '', dribbble: s.dribbble || '', github: s.github || '', cv: s.cv || ''
    };
    $$('[data-site-href]').forEach((a) => {
      const v = url[a.dataset.siteHref];
      if (v) { a.href = v; a.hidden = false; if (a.closest('.xp-cv')) a.closest('.xp-cv').hidden = false; }
      else if (a.classList.contains('cpill') || a.dataset.siteHref === 'cv') { a.hidden = true; if (a.closest('.xp-cv')) a.closest('.xp-cv').hidden = true; }
    });
    $$('[data-site-text]').forEach((el) => { const v = s[el.dataset.siteText]; const slot = el.classList.contains('avail') ? $('span', el) : el; if (el.classList.contains('avail') && s.availabilityOn === false) { el.hidden = true; return; } if (v) { slot.textContent = v; el.hidden = false; } else if (el.classList.contains('avail')) el.hidden = true; });
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

  /* page-to-page transition: fade out with a progress line, fade the next page in */
  (() => {
    const html = document.documentElement;
    if (html.classList.contains('pv-enter')) {
      try { sessionStorage.removeItem('pv'); } catch (e) {}
      requestAnimationFrame(() => requestAnimationFrame(() => html.classList.add('pv-go')));
      setTimeout(() => html.classList.remove('pv-enter', 'pv-go'), 700);
    }
    const norm = (p) => p.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      let u; try { u = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }
      if (u.origin !== location.origin || !/(\.html|\/)$/.test(u.pathname)) return;
      if (norm(u.pathname) === norm(location.pathname)) return;
      e.preventDefault();
      go(u.href);
    });
    function go(href) {
      try { sessionStorage.setItem('pv', '1'); } catch (err) {}
      html.classList.add('pv-leave');
      setTimeout(() => { location.href = href; }, reduce ? 0 : 360);
    }
    window.SiteGo = go;
    addEventListener('pageshow', (e) => { if (e.persisted) html.classList.remove('pv-leave', 'pv-enter', 'pv-go'); });
  })();

  /* home and All work: Back from a project (or another page) returns to the same spot, not the top */
  (function keepPlace() {
    if (!(document.getElementById('hero') || /work\.html$/.test(location.pathname))) return;
    const key = 'y:' + location.pathname;
    try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
    addEventListener('pagehide', () => { try { sessionStorage.setItem(key, String(Math.round(scrollY))); } catch (e) {} });
    let type = '';
    try { const n = performance.getEntriesByType('navigation')[0]; type = n ? n.type : ''; } catch (e) {}
    const isWork = !document.getElementById('hero');
    if (!(type === 'back_forward' || (isWork && type === 'reload'))) return;
    let y = 0; try { y = parseInt(sessionStorage.getItem(key), 10) || 0; } catch (e) {}
    if (y <= 0) return;
    /* projects render a moment later, so keep placing the page until it is tall enough (stop if you scroll yourself) */
    let stop = false; const quit = () => { stop = true; };
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((t) => addEventListener(t, quit, { once: true, passive: true }));
    const t0 = Date.now();
    const place = () => {
      if (stop) return;
      const max = document.documentElement.scrollHeight - innerHeight;
      scrollTo(0, Math.min(y, max));
      if ((max < y || Math.abs(scrollY - y) > 2) && Date.now() - t0 < 2500) requestAnimationFrame(place);
      else setTimeout(() => { if (!stop && Math.abs(scrollY - y) > 2) scrollTo(0, y); }, 300);
    };
    place(); addEventListener('load', place);
  })();

  window.Site = { getSite: () => siteReady, lightMode: applyLightMode, $, $$, clamp, esc, scan, onScroll, splitText, toast, loadProjects, previewDraft, isPreview, reduce, fine };
  scan();
})();
