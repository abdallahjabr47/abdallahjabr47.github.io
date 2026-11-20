/* Extra polish: calligraphy intro, scrambled labels, magnetic buttons, 3D card tilt, image wipe reveal, smooth wheel scroll */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const isPreview = /[?&]preview\b/.test(location.search);

  /* ---------- 1. intro: عبدالله writes itself in light, then flies into the logo while the curtain opens (once per visit) ---------- */
  (function intro() {
    const src = $('#sig path');
    if (!src || reduce || isPreview) return;
    let seen = false;
    try { seen = sessionStorage.getItem('intro-seen') === '1'; sessionStorage.setItem('intro-seen', '1'); } catch (e) {}
    if (seen) return;
    const d = src.getAttribute('d');
    const lg = $('#logo'), lp = lg && lg.querySelector('path');
    const vb = (lg && lg.getAttribute('viewBox')) || '0 0 430.5 201';
    const ov = document.createElement('div');
    ov.className = 'intro';
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = `<span class="ip t"></span><span class="ip b"></span>
      <svg viewBox="${vb}" class="intro-sig">
        <defs>
          <mask id="im-ar" maskUnits="userSpaceOnUse" x="-60" y="-40" width="600" height="300"><rect class="mk mk-ar" x="-60" y="-40" width="600" height="300" fill="#fff"/></mask>
          <mask id="im-en" maskUnits="userSpaceOnUse" x="-60" y="-40" width="600" height="300"><rect class="mk mk-en" x="-60" y="-40" width="600" height="300" fill="#fff"/></mask>
        </defs>
        ${lp ? `<g mask="url(#im-en)"><path class="en" d="${lp.getAttribute('d')}" mask="url(#logoKo)"/></g>` : ''}
        <g mask="url(#im-ar)"><path class="fill" d="${d}" fill-rule="evenodd"/></g>
      </svg>`;
    document.body.appendChild(ov);
    const html = document.documentElement;
    html.classList.add('intro-on');
    requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('go')));
    const finish = () => {
      if (ov.classList.contains('out')) return;
      const sig = $('.intro-sig', ov), logo = $('.brand .logo');
      if (sig && logo) {
        const a = sig.getBoundingClientRect(), b = logo.getBoundingClientRect();
        sig.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width})`;
      }
      ov.classList.add('out');
      setTimeout(() => html.classList.remove('intro-on'), 150);
      setTimeout(() => ov.remove(), 1300);
    };
    setTimeout(finish, 1500);
    ov.addEventListener('click', finish);
  })();

  /* ---------- 2. scrambled labels: eyebrows decode letter by letter when they appear ---------- */
  (function scramble() {
    if (reduce) return;
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&+#%/<>';
    const run = (el) => {
      const final = el.dataset.text;
      const total = 26 + final.length * 1.2;
      let f = 0;
      const step = () => {
        f++;
        let out = '';
        for (let i = 0; i < final.length; i++) {
          const ch = final[i];
          const lock = (i / final.length) * total * 0.75 + 6;
          out += ch === ' ' || f >= lock ? ch : glyphs[(Math.random() * glyphs.length) | 0];
        }
        el.textContent = out;
        if (f < total) requestAnimationFrame(step); else el.textContent = final;
      };
      step();
    };
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); setTimeout(() => run(e.target), 120); } }), { threshold: 0.6 });
    $$('.eyebrow').forEach((el) => {
      if (el.closest('.hero')) return;
      if (el.children.length || !el.textContent.trim()) return;
      el.dataset.text = el.textContent.trim();
      el.setAttribute('aria-label', el.dataset.text);
      el.style.minWidth = el.getBoundingClientRect().width + 'px';
      io.observe(el);
    });
  })();

  /* ---------- 3. magnetic buttons ---------- */
  (function magnetic() {
    if (!fine || reduce) return;
    const els = $$('.hero .btn, .cta-circle, .nav .cv, .xp-cv .btn');
    els.forEach((el) => {
      if (el.dataset.magDone) return;
      el.dataset.magDone = '1';
      const k = el.classList.contains('cta-circle') ? 0.18 : 0.28;
      el.addEventListener('pointermove', (ev) => {
        const r = el.getBoundingClientRect();
        const x = ev.clientX - r.left - r.width / 2, y = ev.clientY - r.top - r.height / 2;
        el.style.transition = 'transform .2s ease-out';
        el.style.transform = `translate(${x * k}px, ${y * k * 1.2}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transition = 'transform .6s cubic-bezier(.2,.9,.2,1.4)'; el.style.transform = ''; });
    });
  })();

  /* ---------- 4. 3D tilt + light glare on project cards ---------- */
  function tilt(root = document) {
    if (!fine || reduce) return;
    $$('.stage-panel', root).forEach((p) => {
      if (p.dataset.tiltDone) return;
      p.dataset.tiltDone = '1';
      p.classList.add('tilt-on');
      p.addEventListener('pointermove', (ev) => {
        const r = p.getBoundingClientRect();
        const nx = (ev.clientX - r.left) / r.width, ny = (ev.clientY - r.top) / r.height;
        p.style.setProperty('--rx', ((0.5 - ny) * 7).toFixed(2) + 'deg');
        p.style.setProperty('--ry', ((nx - 0.5) * 9).toFixed(2) + 'deg');
        p.style.setProperty('--gx', (nx * 100).toFixed(1) + '%');
        p.style.setProperty('--gy', (ny * 100).toFixed(1) + '%');
        p.classList.add('tilting');
      });
      p.addEventListener('pointerleave', () => { p.classList.remove('tilting'); p.style.setProperty('--rx', '0deg'); p.style.setProperty('--ry', '0deg'); });
    });
  }

  /* ---------- 5. image wipe reveal ---------- */
  function wipe(root = document) {
    if (reduce) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('wiped'); io.unobserve(e.target); } }), { threshold: 0.18 });
    $$('.photo-card .photo, .shot', root).forEach((el) => {
      if (el.dataset.wipeDone) return;
      el.dataset.wipeDone = '1';
      el.classList.add('wipe');
      io.observe(el);
    });
  }

  /* back to top */
  document.addEventListener('click', (e) => { if (e.target.closest('.to-top')) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });

  /* re-run for content rendered later (project cards, case-study gallery) */
  const rescan = () => { tilt(); wipe(); };
  rescan();
  new MutationObserver(() => { clearTimeout(rescan.t); rescan.t = setTimeout(rescan, 120); }).observe(document.body, { childList: true, subtree: true });

  /* ---------- 6. smooth wheel scrolling (mouse wheels and trackpads; keyboard and touch untouched) ---------- */
  (function smooth() {
    if (!fine || reduce) return;
    document.documentElement.classList.add('js-smooth');
    let target = scrollY, current = scrollY, running = false;
    const max = () => document.documentElement.scrollHeight - innerHeight;
    const scrollable = (el) => {
      for (; el && el !== document.body; el = el.parentElement) {
        const s = getComputedStyle(el);
        if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2) return true;
      }
      return false;
    };
    const loop = () => {
      current += (target - current) * 0.12;
      if (Math.abs(target - current) < 0.5) { current = target; running = false; }
      window.scrollTo(0, current);
      if (running) requestAnimationFrame(loop);
    };
    addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY) || scrollable(e.target) || document.body.classList.contains('menu-open')) return;
      e.preventDefault();
      if (!running) { target = current = scrollY; }
      const d = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
      target = Math.max(0, Math.min(max(), target + d));
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: false });
    addEventListener('scroll', () => { if (!running) { target = current = scrollY; } }, { passive: true });
    // in-page anchor links glide too
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute('href').length < 2) return;
      const t = document.getElementById(a.getAttribute('href').slice(1));
      if (!t) return;
      e.preventDefault();
      target = Math.max(0, Math.min(max(), t.getBoundingClientRect().top + scrollY - 90));
      if (!running) { current = scrollY; running = true; requestAnimationFrame(loop); }
    });
  })();
})();
