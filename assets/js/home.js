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
  /* which devices a project has (admin: Devices), with a sensible default from its type */
  function devicesOf(p) {
    const d = p.devices || {};
    if (d.mobile || d.tablet || d.desktop) return { mobile: !!d.mobile, tablet: !!d.tablet, desktop: !!d.desktop };
    const t = p.type || 'mobile';
    return { mobile: t !== 'web' || !!(p.screens && p.screens.length), tablet: !!(p.tabletScreens && p.tabletScreens.length), desktop: t !== 'mobile' };
  }
  window.SiteDevices = devicesOf;
  const DEV_IC = {
    mobile: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.6"/><path d="M11 18.5h2"/></svg>',
    tablet: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2.6"/><path d="M11 18h2"/></svg>',
    desktop: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="11.5" rx="1.8"/><path d="M2 19.5h20"/></svg>' };
  const unbr = (v) => typeof v === 'string' ? v.replace(/\s*\[[^\]]*\]/g, '').trim() : v;
  function cardHTML(p, i) {
    p = Object.assign({}, p, { tagline: unbr(p.tagline), category: unbr(p.category), summary: unbr(p.summary), year: unbr(p.year) });
    const type = p.type || 'mobile';
    const tint = (p.cover && p.cover.tint) || '#2B3A8F';
    const href = 'project.html#' + encodeURIComponent(p.slug);
    const dv = devicesOf(p);
    const pref = p.cardDevice && p.cardDevice !== 'auto' && dv[p.cardDevice] ? p.cardDevice : (type === 'mobile' ? (dv.mobile ? 'mobile' : dv.tablet ? 'tablet' : 'desktop') : (dv.desktop ? 'desktop' : dv.tablet ? 'tablet' : 'mobile'));
    const first = (arr) => (arr && p.coverShot && arr.includes(p.coverShot)) ? [p.coverShot, ...arr.filter((x) => x !== p.coverShot)] : arr;
    const list = (arr, alt, mock, n) => (arr = first(arr), arr && arr.length) ? arr.map((s) => imgOr(s, p.title + ' ' + alt, '')) : Array.from({ length: n }, (_, k) => mock(k));
    const shots = pref === 'mobile' ? list(p.screens, 'screen', (k) => mockPhone(k, p.title), 4)
      : pref === 'tablet' ? list(p.tabletScreens, 'tablet screen', mockWeb, 3)
      : list(p.webScreens, 'website', mockWeb, 3);
    const count = shots.length;
    const reel = `<div class="reel" data-reel>${shots.map((s) => `<div>${s}</div>`).join('')}</div>`;
    const device = pref === 'desktop' ? `<div class="laptop-f"><div class="lid"><div class="scr">${reel}</div></div><div class="base"></div></div>`
      : pref === 'tablet' ? `<div class="tablet-f"><div class="scr">${reel}</div></div>`
      : `<div class="phone-f"><div class="scr"><span class="island"></span>${reel}</div></div>`;
    /* a website that also works on phones: a small phone in front of the laptop */
    const sidePhone = pref === 'desktop' && dv.mobile ? `<div class="phone-f phone-side" aria-hidden="true"><div class="scr"><span class="island"></span>${(p.screens && p.screens[0]) ? imgOr(first(p.screens)[0], '', '') : mockPhone(0, p.title)}</div></div>` : '';
    /* cover thumbnail: bold name + one device on the project's colour; style a/b/c varies per project */
    const st = ['a', 'b', 'c'].includes(p.cardStyle) ? p.cardStyle : 'abc'[i % 3];
    const laptop = '<span class="orb o1"></span><span class="orb o2"></span><span class="orb o3"></span>', phone = `<span class="ta-ghost" aria-hidden="true" style="--n:${Math.max(4, (p.title || '').length)}">${/[\u0600-\u06FF]/.test(p.title || '') ? esc(p.title).split(' ').join('<br>') : esc(p.title)}</span>` + device + sidePhone;
    const devChips = ['mobile', 'tablet', 'desktop'].filter((k) => dv[k]).map((k) => `<span class="dv${k === pref ? ' on' : ''}" title="${({ mobile: 'Phone', tablet: 'Tablet', desktop: 'Desktop' })[k]}">${DEV_IC[k]}</span>`).join('');
    const catShort = (p.category || '').split('·')[0].trim();
    const icon = p.icon ? `<img src="${esc(p.icon)}" alt="">` : esc((p.title || '?').charAt(0));
    const soon = p.status === 'Coming soon';
    const rtl = /[\u0600-\u06FF]/.test(p.title || '');
    return `
    <article class="pcard art st-${st} type-${type} show-${pref}${sidePhone ? ' with-phone' : ''}${soon ? ' is-soon' : ''}${rtl ? ' is-rtl' : ''}" data-type="${type}" style="--tint:${esc(tint)}"${soon ? ' aria-disabled="true"' : ''} data-reveal>
      <div class="stage-panel"${soon ? ' data-cursor="Case study coming soon"' : ` data-cursor="Explore case ↗" data-href="${href}"`} data-n="${count}">${soon ? '<span class="lb soon-tag"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Coming soon</span>' : ''}
        <div class="sp-badges"><span class="l"><span class="lb lb-${type}">${({ mobile: 'Mobile app', web: 'Website', both: 'Mobile + Website' })[type] || 'Mobile app'}</span>${catShort ? `<span class="lb lb-cat">${esc(catShort)}</span>` : ''}</span>${count > 6 ? `<span class="dots bar" aria-hidden="true"><span class="trk"><b style="width:${100 / count}%"></b></span><em>1/${count}</em></span>` : `<span class="dots" aria-hidden="true">${Array.from({ length: count }, (_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</span>`}</div>
        <div class="devices2">${laptop}${phone}</div>
        <button class="sp-arrow a-prev" type="button" aria-label="Previous screen of ${esc(p.title)}" disabled>←</button>
        <button class="sp-arrow a-next" type="button" aria-label="Next screen of ${esc(p.title)}"${count < 2 ? ' disabled' : ''}>→</button>
        ${soon ? '' : `<a class="explore" href="${href}">Explore case <span aria-hidden="true">↗</span></a>`}
      </div>
      <div class="pc-head">
        <span class="app-icon">${icon}</span>
        <div class="nm"><h3>${esc(p.title)}</h3><p>${esc(p.tagline || p.category || '')}</p></div>
        ${p.status ? `<span class="status-pill ${({ 'Live': 'live', 'In progress': 'dev', 'Shipped': 'done', 'Personal': 'pers', 'Coming soon': 'soon' })[p.status] || (p.live ? 'live' : 'muted')}">${esc(p.status)}</span>` : ''}
      </div>
    </article>`;
  }

  function seeAllHTML(list, rest) {
    const ic = (p) => `<span class="app-icon" style="--tint:${esc((p.cover && p.cover.tint) || '#2B3A8F')}">${p.icon ? `<img src="${esc(p.icon)}" alt="">` : esc((p.title || '?').charAt(0))}</span>`;
    return `
    <a class="pcard see-all" href="work.html" data-reveal>
      <div class="sa-panel">
        <span class="sa-icons">${rest.slice(0, 4).map(ic).join('')}${rest.length > 4 ? `<span class="app-icon more">+${rest.length - 4}</span>` : ''}</span>
        <b>${rest.length} more project${rest.length > 1 ? 's' : ''}</b>
        <small>${rest.map((p) => esc(p.title)).slice(0, 3).join(' · ')}${rest.length > 3 ? ' …' : ''}</small>
        <span class="btn btn-primary sa-btn">See all ${list.length} projects <span class="arr">↗</span></span>
      </div>
      <div class="pc-head"><div class="nm"><h3>All work</h3><p>Every app, website and case study</p></div></div>
    </a>`;
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
      const bar = $('.dots.bar', card); if (bar) { bar.querySelector('b').style.width = `${((i + 1) / n) * 100}%`; bar.querySelector('em').textContent = `${i + 1}/${n}`; }
      prev.disabled = i === 0; next.disabled = i >= n - 1;
    };
    prev.addEventListener('click', (e) => { e.stopPropagation(); go(i - 1); });
    next.addEventListener('click', (e) => { e.stopPropagation(); go(i + 1); });
    let x0 = null, moved = false;
    panel.addEventListener('pointerdown', (e) => { x0 = e.clientX; moved = false; });
    panel.addEventListener('pointercancel', () => { x0 = null; });
    panel.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { moved = true; go(i + (dx < 0 ? 1 : -1)); }
    });
    /* motion: screens play like a thumbnail — on hover (desktop) or while in view (touch) */
    let timer = null;
    const play = () => { if (timer || n < 2 || reduce) return; timer = setInterval(() => go(i >= n - 1 ? 0 : i + 1), 1700); };
    const stop = (reset) => { clearInterval(timer); timer = null; if (reset) go(0); };
    if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
      panel.addEventListener('mouseenter', () => { go(i >= n - 1 ? 0 : i + 1); play(); });
      panel.addEventListener('mouseleave', () => stop(true));
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => es.forEach((en) => en.isIntersecting ? play() : stop(false)), { threshold: .6 }).observe(panel);
    }
    [prev, next].forEach((b) => b.addEventListener('click', () => { stop(false); }));
    panel.addEventListener('click', (e) => {
      if (moved || e.target.closest('button, a') || !panel.dataset.href) return;
      (window.SiteGo || ((h) => { location.href = h; }))(panel.dataset.href);
    });
  }

  function renderProjects(list) {
    const grid = $('#projects');
    if (!grid) return;
    if (!list.length) { grid.innerHTML = '<p class="muted">No projects yet — add your first one from the admin page.</p>'; return; }
    const all = grid.hasAttribute('data-all');
    let shown = list, rest = [];
    if (!all && list.length > 6) {
      const feat = list.map((p, i) => ({ p, i })).filter((x) => x.p.featured).sort((a, b) => (a.p.featuredRank || 99) - (b.p.featuredRank || 99) || a.i - b.i).map((x) => x.p);
      const pick = (feat.length ? feat.concat(list.filter((p) => !p.featured)) : list).slice(0, 5);
      shown = pick;
      rest = list.filter((p) => !pick.includes(p));
    }
    grid.innerHTML = shown.map(cardHTML).join('') + (rest.length ? seeAllHTML(list, rest) : '');
    $$('.pcard:not(.see-all)', grid).forEach(wireCard);
    scan(grid);
    const stat = $('#stat-projects'); if (stat) stat.dataset.count = list.length;
  }

  /* filters */
  const fwrap = $('.filters');
  function placeThumb(group) {
    const on = $('button.on', group), th = $('.thumb', group);
    if (!on || !th) return;
    th.style.width = on.offsetWidth + 'px';
    th.style.transform = `translateX(${on.offsetLeft - th.offsetLeft}px)`;
  }
  if (fwrap) {
    $$('button', fwrap).forEach((b) => b.addEventListener('click', () => {
      $$('button', fwrap).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      placeThumb(fwrap);
      const f = b.dataset.filter;
      $$('.pcard').forEach((c) => {
        const t = c.dataset.type;
        if (!t) { c.classList.toggle('hide', f !== 'all'); return; }
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
    const accents = ['linear-gradient(140deg,#2B3A8F,#E2577A)', 'linear-gradient(140deg,#1D6F6A,#0F2F3A)', 'linear-gradient(140deg,#1452B8,#1A2050)', 'linear-gradient(140deg,#8C5A1E,#3A230F)', 'linear-gradient(140deg,#4F86E6,#0E1119)', 'linear-gradient(140deg,#6A2E8C,#12131E)'];
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

  /* =============== process: scroll through the 4 stages, then move on =============== */
  const proc = $('.proc');
  const phone = proc && $('.phone', proc);
  if (proc && phone) {
    const notes = $$('.pnote', proc);
    let cur = -1;
    const progress = () => { const r = proc.getBoundingClientRect(); const total = r.height - innerHeight; return total > 0 ? clamp(-r.top / total) : 0; };
    onScroll(() => {
      const p = progress() * notes.length;
      const s = Math.min(notes.length - 1, Math.floor(p));
      notes.forEach((n, j) => { $('.pn-bar i', n).style.transform = `scaleX(${clamp(p - j)})`; });
      if (s !== cur) {
        cur = s;
        phone.dataset.stage = String(s);
        notes.forEach((n, j) => { n.classList.toggle('active', j === s); n.classList.toggle('done', j < s); n.setAttribute('aria-current', j === s ? 'step' : 'false'); });
      }
    });
    notes.forEach((n) => n.addEventListener('click', () => {
      const j = +n.dataset.step;
      const top = proc.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + (proc.offsetHeight - innerHeight) * ((j + 0.5) / notes.length), behavior: reduce ? 'auto' : 'smooth' });
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
  const tokens = [['Primary', '#1452B8', '--blue'], ['Sky', '#4F86E6', '--sky'], ['Mint', '#5FB894', '--mint'], ['Sand', '#D8A960', '--sand'], ['Lilac', '#A497DB', '--lilac'], ['Night', '#07080B', '--bg'], ['Surface', '#12141B', '--panel']];
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
      flow.dataset.lens = k;
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
      <li><a class="ix-row${p.status === 'Coming soon' ? ' is-soon' : ''}" ${p.status === 'Coming soon' ? 'aria-disabled="true" tabindex="-1"' : `href="project.html#${encodeURIComponent(p.slug)}"`} data-i="${i}">
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
        const L = web ? (p.webScreens || []) : (p.screens || []);
        const img = p.coverShot && L.includes(p.coverShot) ? p.coverShot : L[0];
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
    const all = list.filter((x) => x.visible !== false);
    const isIntern = (x) => /intern/i.test(x.type || '');
    const interns = all.filter(isIntern);
    renderXpList($('#xp'), all.filter((x) => !isIntern(x)), 'xp');
    renderXpList($('#xpIntern'), interns, 'xpi');
    const tab = $('[data-xp-tab="intern"]');
    if (tab) { tab.hidden = !interns.length; const xt = $('.xp-tabs'); if (xt) requestAnimationFrame(() => placeThumb(xt)); }
  }
  function renderXpList(box, rows, pfx) {
    if (!box) return;
    box.innerHTML = rows.map((x, i) => {
      const current = /present|now/i.test(x.dates || '');
      const hl = (x.highlights || []).length;
      const more = hl || x.summary;
      const tk = /intern/i.test(x.type || '') ? 'intern' : /part/i.test(x.type || '') ? 'part' : /contract|freelance/i.test(x.type || '') ? 'contract' : x.type ? 'full' : '';
      const meta = [x.company, x.location].filter(Boolean).map(esc).join('<i aria-hidden="true">·</i>') + (x.type ? `<span class="xp-type t-${tk}">${esc(x.type)}</span>` : '');
      return `
      <div class="xp-row${more ? ' has-hl' : ''}${tk ? ' k-' + tk : ''}" data-reveal>
        <div class="xp-head">
          <div class="xp-main"><h3>${esc(x.role)}</h3><p class="xp-meta">${meta}</p></div>
          <span class="xp-date${current ? ' now' : ''}">${esc(x.dates)}</span>
          ${more ? `<button class="xp-tog" type="button" aria-expanded="false" aria-controls="${pfx}-hl-${i}" aria-label="Show details for ${esc(x.role)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>` : '<span></span>'}
        </div>
        ${more ? `<div class="xp-hl" id="${pfx}-hl-${i}"><div class="xp-body">${x.summary ? `<p>${esc(x.summary)}</p>` : ''}${hl ? `<ul>${x.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}</div></div>` : ''}
      </div>`;
    }).join('');
    $$('.xp-row', box).forEach((row) => {
      const btn = $('.xp-tog', row);
      if (!btn) return;
      const toggle = () => { const open = !row.classList.contains('open'); row.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); slide($('.xp-hl', row), open); };
      $('.xp-head', row).addEventListener('click', (e) => { if (e.target.closest('a')) return; toggle(); });
    });
    scan(box);
    /* progress line: filled down to the point 70% down the screen; re-measured while a row opens or closes */
    const fill = () => {
      const r = box.getBoundingClientRect();
      const p = clamp((innerHeight * 0.7 - r.top) / r.height);
      box.style.setProperty('--xp', p.toFixed(4));
    };
    const follow = () => { const end = performance.now() + 600; const loop = () => { fill(); if (performance.now() < end) requestAnimationFrame(loop); }; requestAnimationFrame(loop); };
    $$('.xp-head', box).forEach((h) => h.addEventListener('click', follow));
    addEventListener('resize', fill);
    onScroll(fill); fill();
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

  /* =============== learning & recognition (from Profile & links in the admin) =============== */
  (async () => {
    const box = $('#recGrid'), sec = box && box.closest('.xp-pane');
    if (!box || !window.Site.getSite) return;
    const s = await window.Site.getSite();
    const items = ((s && s.recognition) || []).filter((r) => r && r.title && !r.hidden);
    if (!items.length) { const row = $('.xp-tabs-row'); if (row) row.hidden = true; return; }
    const COLS = [
      { kinds: ['education', 'certificate'], name: 'Education & certificates', ac: '#E2B866', ic: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5Z"/><path d="M6.5 11v4.5c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3V11M21.5 9v5"/>' },
      { kinds: ['award'], name: 'Hackathons & fellowships', ac: '#A497DB', ic: '<path d="M7.5 4.5h9v4a4.5 4.5 0 0 1-9 0Z"/><path d="M7.5 6.5h-3a3 3 0 0 0 3 3.5M16.5 6.5h3a3 3 0 0 1-3 3.5M12 13v3.5M8.5 19.5h7M9.5 16.5h5v3h-5Z"/>' },
      { kinds: ['leadership'], name: 'Leadership & community', ac: '#5FB894', ic: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M15.8 14.2c2.3.2 4 2 4.6 4.8"/>' }];
    const tag = { education: 'Degree', certificate: 'Certificate', award: '', leadership: '' };
    box.innerHTML = COLS.map((c, ci) => {
      const list = items.filter((r) => c.kinds.includes(r.kind || 'certificate'));
      if (!list.length) return '';
      return `<div class="rec-col" style="--ac:${c.ac};--d:${ci * 100}ms" data-reveal>
        <div class="rec-h"><span class="rec-ic" aria-hidden="true"><svg viewBox="0 0 24 24">${c.ic}</svg></span><h3>${c.name}</h3><span class="rec-n">${list.length}</span></div>
        <ol class="rec-list">${list.map((r, k) => {
          const head = `<span class="rec-b"><b>${esc(r.title)}</b><small>${esc(r.org || '')}</small></span><span class="rec-y">${esc(r.year || '')}</span>`;
          const cls = k >= 3 ? ' class="more" hidden' : '';
          if (r.image) return `<li${cls}><button type="button" class="rec-row rec-cert" data-cert="${esc(r.image)}" data-title="${esc(r.title)}" data-org="${esc([r.org, r.year].filter(Boolean).join(' · '))}" data-note="${esc(r.note || '')}" data-link="${esc(r.link || '')}" data-cursor="View ↗"><span class="rec-thumb" style="background-image:url('${esc(r.image)}')"></span>${head}<span class="rec-chev cert" aria-hidden="true"></span></button></li>`;
          const extra = r.note || r.link;
          return `<li${cls}>${extra ? `<details><summary>${head}<span class="rec-chev" aria-hidden="true"></span></summary><div class="rec-x">${r.note ? `<p>${esc(r.note)}</p>` : ''}${r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">View certificate <span class="arr">↗</span></a>` : ''}</div></details>` : `<div class="rec-row">${head}<span class="rec-chev none" aria-hidden="true"></span></div>`}</li>`;
        }).join('')}</ol>
        ${list.length > 3 ? `<button class="rec-more" type="button" data-n="${list.length - 3}">Show ${list.length - 3} more</button>` : ''}
      </div>`;
    }).join('');
    /* certificate viewer */
    let cv = $('#certView');
    if (!cv) {
      document.body.insertAdjacentHTML('beforeend', '<div class="cert-view" id="certView" role="dialog" aria-modal="true" aria-label="Certificate" hidden><div class="cert-card"><button class="cert-x" type="button" aria-label="Close">✕</button><div class="cert-img"><img alt=""></div><div class="cert-meta"><b></b><small></small><p></p></div></div></div>');
      cv = $('#certView');
      const close = () => { cv.classList.remove('on'); setTimeout(() => { cv.hidden = true; }, 250); };
      cv.addEventListener('click', (e) => {
        if (e.target === cv || e.target.closest('.cert-x')) return close();
        const wrap = e.target.closest('.cert-img'); if (!wrap) return;
        const img = $('img', wrap), r = img.getBoundingClientRect();
        const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
        const on = wrap.classList.toggle('zoom');
        if (on) requestAnimationFrame(() => { wrap.scrollLeft = fx * wrap.scrollWidth - wrap.clientWidth / 2; wrap.scrollTop = fy * wrap.scrollHeight - wrap.clientHeight / 2; });
      });
      addEventListener('keydown', (e) => { if (e.key === 'Escape' && !cv.hidden) { e.preventDefault(); close(); } });
    }
    box.addEventListener('click', (e) => {
      const b = e.target.closest('.rec-cert'); if (!b) return;
      $('img', cv).src = b.dataset.cert; $('img', cv).alt = b.dataset.title;
      $('.cert-meta b', cv).textContent = b.dataset.title; $('.cert-meta small', cv).textContent = b.dataset.org;
      const p = $('.cert-meta p', cv); p.textContent = b.dataset.note; p.hidden = !b.dataset.note;
      $('.cert-img', cv).classList.remove('zoom');
      cv.hidden = false; requestAnimationFrame(() => cv.classList.add('on')); $('.cert-x', cv).focus();
    });
    $$('.rec-more', box).forEach((btn) => btn.addEventListener('click', () => {
      const col = btn.closest('.rec-col'); const open = col.classList.toggle('open');
      $$('li.more', col).forEach((li) => { li.hidden = !open; });
      btn.textContent = open ? 'Show less' : `Show ${btn.dataset.n} more`;
    }));
    scan(sec);
  })();

  /* =============== testimonials (from Profile & links in the admin) =============== */
  (async () => {
    const sec = $('#testimonials'), box = $('#testi');
    if (!sec || !box || !window.Site.getSite) return;
    const s = await window.Site.getSite();
    const list = ((s && s.testimonials) || []).filter((t) => t && t.quote);
    if (!list.length) return;
    const n = list.length;
    const ini = (t) => esc((t.name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase());
    const card = (t, i) => `
      <figure class="hc" data-i="${i}"${n > 1 ? ` role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}"` : ''}>
        <span class="qm" aria-hidden="true">“</span>
        <blockquote>${esc(t.quote)}</blockquote>
        <figcaption class="who">${t.image ? `<img src="${esc(t.image)}" alt="" loading="lazy" decoding="async">` : `<span class="av" aria-hidden="true">${ini(t)}</span>`}<span><b>${t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.name || '')}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg></a>` : esc(t.name || '')}</b><small>${esc(t.role || '')}</small></span></figcaption>
      </figure>`;
    if (n < 2) {
      /* one: a still, centred card */
      box.className = 'testi few'; box.innerHTML = list.map(card).join('');
      $$('.hc', box).forEach((c) => c.setAttribute('data-reveal', ''));
    } else {
      /* two or more: one row gliding sideways; hover pauses, a click holds it */
      const reps = Math.max(1, Math.ceil(6 / n));
      const set = Array.from({ length: reps }, (_, r) => list.map((t, i) => card(t, i)).join('')).join('');
      box.className = 'testi mq';
      box.innerHTML = `<div class="mq-row" style="--dur:${n * reps * 9}s"><div class="mq-set">${set}</div><div class="mq-set" aria-hidden="true">${set}</div></div>`;
      $$('.mq-set[aria-hidden] .hc', box).forEach((c) => { c.removeAttribute('role'); $$('a', c).forEach((x) => x.tabIndex = -1); });
      box.addEventListener('click', (e) => { if (e.target.closest('a')) return; box.classList.toggle('held'); });
      box.addEventListener('focusin', () => box.classList.add('held'));
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) box.classList.add('held');
    }
    sec.hidden = false;
    scan(sec);
  })();


  /* =============== experience: Work / Learning tabs =============== */
  const xt = $('.xp-tabs');
  if (xt) {
    const put = () => placeThumb(xt);
    $$('button', xt).forEach((b) => b.addEventListener('click', () => {
      $$('button', xt).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
      $$('[data-xp-pane]').forEach((p) => { p.hidden = p.dataset.xpPane !== b.dataset.xpTab; if (!p.hidden) scan(p); });
      put();
    }));
    requestAnimationFrame(put); addEventListener('resize', put); if (document.fonts) document.fonts.ready.then(put);
    if (location.hash === '#recognition') $('[data-xp-tab="learn"]', xt).click();
  }
})();

/* hero card: rotate the one-line slides with the quiet step dots */
(function () {
  const qs = Array.from(document.querySelectorAll('.hx-q')), dots = Array.from(document.querySelectorAll('.hx-steps i'));
  if (qs.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let k = 0;
  const go = (n) => { k = n; qs.forEach((q, i) => { q.classList.toggle('on', i === k); q.setAttribute('aria-hidden', String(i !== k)); }); dots.forEach((d, i) => d.classList.toggle('on', i === k)); };
  setInterval(() => { if (!document.hidden) go((k + 1) % qs.length); }, 5200);
})();

/* How I work: open each part in a large dialog instead of a new page */
(function () {
  const dlg = document.getElementById('hiwDlg'); if (!dlg) return;
  const frame = dlg.querySelector('iframe'), title = dlg.querySelector('#hiwTitle'), x = dlg.querySelector('.hiw-x');
  const names = { product: 'Product management', skills: 'Skills & design system' };
  let opener = null;
  const close = () => { dlg.classList.remove('open'); document.documentElement.classList.remove('hiw-lock'); setTimeout(() => { dlg.hidden = true; }, 300); if (opener) opener.focus(); };
  document.querySelectorAll('[data-hiw]').forEach((a) => a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); opener = a;
    const k = a.dataset.hiw, th = document.documentElement.dataset.theme || '';
    const src = `how-i-work.html?embed=${k}${th ? '&theme=' + th : ''}`;
    if (frame.getAttribute('src') !== src) frame.src = src;
    title.textContent = names[k] || 'How I work';
    dlg.hidden = false; document.documentElement.classList.add('hiw-lock');
    requestAnimationFrame(() => dlg.classList.add('open')); x.focus();
  }));
  x.addEventListener('click', close);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dlg.hidden) { e.preventDefault(); close(); } });
  frame.addEventListener('load', () => { try { frame.contentWindow.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } }); } catch (_) {} });
})();
