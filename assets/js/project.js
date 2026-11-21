/* Case study page — renders one project from data/projects.json, chosen by the #slug in the address */
(function () {
  const { $, $$, clamp, esc, scan, onScroll, loadProjects, reduce } = window.Site;
  const main = $('#case');
  let projects = [];

  const has = (v) => Array.isArray(v) ? v.filter(Boolean).length > 0 : !!(v && String(v).trim());
  const getSlug = () => {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (h) return h;
    return new URLSearchParams(location.search).get('p') || '';
  };
  const mockScreen = (tint) => `<div class="mock" style="--tint:${tint}"><div class="mh"><b>&nbsp;</b><i></i></div><div class="mhero"><s style="width:40%"></s><s style="width:70%"></s></div><span class="ln" style="width:45%"></span><div class="row"><i></i><i></i><i></i></div><div class="btn-m"></div></div>`;

  /* placeholder notes like "[Add 1–2 sentences…]" never show on the site */
  const clean = (v) => typeof v === 'string' ? v.replace(/\s*\[[^\]]*\]/g, '').trim()
    : Array.isArray(v) ? v.map(clean) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)])) : v;
  const DEV = {
    mobile: ['Phone', '<rect x="7" y="2.5" width="10" height="19" rx="2.6"/><path d="M11 18.5h2"/>'],
    tablet: ['Tablet', '<rect x="4" y="3" width="16" height="18" rx="2.6"/><path d="M11 18h2"/>'],
    desktop: ['Desktop', '<rect x="3.5" y="4.5" width="17" height="11.5" rx="1.8"/><path d="M2 19.5h20"/>'] };
  const devIc = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${DEV[k][1]}</svg>`;

  function render(p, idx) {
    p = clean(p);
    ['process', 'challenges', 'results'].forEach((k) => { if (Array.isArray(p[k])) p[k] = p[k].filter((x) => x && Object.values(x).some((v) => has(v))); });
    const tint = (p.cover && p.cover.tint) || '#2B3A8F';
    const type = p.type || 'mobile';
    document.title = `${p.title} — Case study · Abdallah Jabr`;
    const sections = [];
    const toc = [];
    const add = (id, label, html) => { toc.push([id, label]); sections.push(`<section class="cs-sec" id="${id}">${html.replace('%N%', String(toc.length).padStart(2, '0'))}</section>`); };

    if (has(p.overview) || has(p.problem)) {
      add('overview', 'Overview', `
        <span class="k" data-reveal>%N% · OVERVIEW</span>
        <h2 class="h-md" data-split>The <em class="serif">story</em></h2>
        ${has(p.overview) ? `<p class="cs-lead" data-reveal>${esc(p.overview)}</p>` : ''}
        ${has(p.problem) ? `<div class="quote glass" data-reveal><small>THE PROBLEM</small><p>${esc(p.problem)}</p></div>` : ''}`);
    }
    const resp = p.responsibilities || {};
    if (has(resp.product) || has(resp.design) || has(p.role)) {
      const cards = [];
      if (has(resp.product)) cards.push(`<div class="role glass" data-glow data-reveal><span class="ico" style="background:rgba(23,105,224,.14);color:var(--sky)">◎</span><h3>Product · PM / PO</h3><ul>${resp.product.filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`);
      if (has(resp.design)) cards.push(`<div class="role glass" data-glow data-reveal style="--d:120ms"><span class="ico" style="background:rgba(23,105,224,.18);color:#5C9BF5">✦</span><h3>Design · UI/UX</h3><ul>${resp.design.filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`);
      add('role', 'My role', `
        <span class="k" data-reveal>%N% · MY ROLE</span>
        <h2 class="h-md" data-split>What I <em class="serif">owned</em></h2>
        ${has(p.role) ? `<p class="cs-text" data-reveal>${esc(p.role)}</p>` : ''}
        ${cards.length ? `<div class="roles">${cards.join('')}</div>` : ''}`);
    }
    if (has(p.process)) {
      add('process', 'Process', `
        <span class="k" data-reveal>%N% · PROCESS</span>
        <h2 class="h-md" data-split>How it <em class="serif">came together</em></h2>
        <div class="timeline">${p.process.map((s, i) => `<div class="tl glass" data-reveal style="--d:${i * 90}ms"><span class="n">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.title)}</h3><p>${esc(s.desc)}</p></div>`).join('')}</div>`);
    }
    if (has(p.challenges)) {
      add('challenges', 'Challenges', `
        <span class="k" data-reveal>%N% · CHALLENGES</span>
        <h2 class="h-md" data-split>Problems <em class="serif">&amp; solutions</em></h2>
        ${p.challenges.map((c, i) => `<div class="chal glass" data-reveal><div><small style="color:var(--red)">CHALLENGE ${String(i + 1).padStart(2, '0')}</small><p>${esc(c.challenge)}</p></div><div><small style="color:var(--green)">SOLUTION</small><p style="color:var(--ink2)">${esc(c.solution)}</p></div></div>`).join('')}`);
    }
    const gal = p.gallery || {};
    const before = (gal.before || []).filter((g) => g && (g.label || g.image));
    const after = (gal.after || []).filter((g) => g && (g.label || g.image));
    if (before.length || after.length) {
      const tabs = before.length && after.length
        ? `<div class="tabs glass" role="group" aria-label="Compare versions"><span class="thumb"></span><button type="button" data-g="before">Before</button><button type="button" class="on" data-g="after">After</button></div>` : '';
      add('designs', 'Designs', `
        <div class="gal-head"><div style="display:flex;flex-direction:column;gap:16px"><span class="k" data-reveal>%N% · DESIGNS</span><h2 class="h-md" data-split>The <em class="serif">screens</em></h2></div>${tabs}</div>
        <div class="gallery" id="gallery"></div>`);
    }
    const dvs = (p.devices && (p.devices.mobile || p.devices.tablet || p.devices.desktop)) ? p.devices : { mobile: type !== 'web', tablet: false, desktop: type !== 'mobile' };
    const sets = [['mobile', p.screens], ['tablet', p.tabletScreens], ['desktop', p.webScreens]].filter(([k, l]) => dvs[k] && Array.isArray(l) && l.filter(Boolean).length).map(([k, l]) => [k, l.filter(Boolean)]);
    if (sets.length) {
      add('screens', 'All screens', `
        <div class="gal-head"><div style="display:flex;flex-direction:column;gap:16px"><span class="k" data-reveal>%N% · EVERY SCREEN</span><h2 class="h-md" data-split>Across <em class="serif">devices</em></h2></div>
        ${sets.length > 1 ? `<div class="tabs glass dev-tabs" role="group" aria-label="Device"><span class="thumb"></span>${sets.map(([k], i) => `<button type="button" data-dv="${k}"${i ? '' : ' class="on"'}>${devIc(k)}${DEV[k][0]}</button>`).join('')}</div>` : ''}</div>
        ${sets.map(([k, l], i) => `<div class="dev-grid g-${k}" data-dv-pane="${k}"${i ? ' hidden' : ''}>${l.map((src, j) => `<button class="dshot" type="button" data-set="${k}" data-i="${j}" data-cursor="Open ↗" aria-label="Open ${DEV[k][0].toLowerCase()} screen ${j + 1}"><img src="${esc(src)}" alt="${esc(p.title)} ${DEV[k][0].toLowerCase()} screen ${j + 1}" loading="lazy"></button>`).join('')}</div>`).join('')}`);
    }
    if (has(p.results) || has(p.learnings)) {
      add('results', 'Results', `
        <span class="k" data-reveal>%N% · RESULTS</span>
        <h2 class="h-md" data-split>The <em class="serif">impact</em></h2>
        ${has(p.results) ? `<div class="results">${p.results.map((r, i) => `<div class="res glass" data-reveal style="--d:${i * 100}ms"><b>${esc(r.value)}</b><span>${esc(r.label)}</span></div>`).join('')}</div>` : ''}
        ${has(p.learnings) ? `<div class="quote glass" data-reveal><small>WHAT I LEARNED</small><p style="font-weight:500;color:var(--ink2)">${esc(p.learnings)}</p></div>` : ''}`);
    }

    const shots = (p.screens && p.screens.length) ? p.screens : [];
    const dv = (p.devices && (p.devices.mobile || p.devices.tablet || p.devices.desktop)) ? p.devices : { mobile: type !== 'web', tablet: false, desktop: type !== 'mobile' };
    const coverInner = p.cover && p.cover.image
      ? `<img src="${esc(p.cover.image)}" alt="${esc(p.title)} cover">`
      : `<span class="ghost" aria-hidden="true">${esc(p.title)}</span><div class="devices" style="gap:28px">
           ${dv.desktop ? `<div class="dev-desk">${p.webScreens && p.webScreens[0] ? `<img src="${esc(p.webScreens[0])}" alt="" style="width:100%;height:100%;object-fit:cover">` : 'Desktop'}</div>` : ''}
           ${dv.tablet ? `<div class="dev-tab">${p.tabletScreens && p.tabletScreens[0] ? `<img src="${esc(p.tabletScreens[0])}" alt="" style="width:100%;height:100%;object-fit:cover">` : 'Tablet'}</div>` : ''}
           ${dv.mobile ? (dv.desktop || dv.tablet ? [1] : [0, 1, 2]).map((k) => `<div class="dev-phone" style="${k !== 1 ? 'transform:translateY(-26px);opacity:.75' : 'border-color:var(--sky)'};overflow:hidden">${shots[k] || (k === 1 && shots[0]) ? `<img src="${esc(shots[k] || shots[0])}" alt="" style="width:100%;height:100%;object-fit:cover">` : mockScreen(tint)}</div>`).join('') : ''}
         </div>`;

    const snap = [['My role', p.role], ['Company', p.company], ['Category', p.category], ['Team', p.team], ['Timeline', p.timeline], ['Platform', p.platforms]].filter(([, v]) => has(v));

    main.innerHTML = `
      <section class="container cs-hero">
        <div class="cs-id" data-reveal>
          ${has(p.icon) ? `<span class="cs-icon"><img src="${esc(p.icon)}" alt="${esc(p.title)} logo"></span>` : `<span class="cs-icon letter" style="--tint:${esc(tint)}">${esc((p.title || '?').charAt(0))}</span>`}
          <span class="cs-idt"><h1 class="cs-idt-h">${esc(p.title)}</h1><small>Case study ${String(idx + 1).padStart(2, '0')}${has(p.category) ? ' · ' + esc(p.category) : ''}</small></span>
        </div>
        ${has(p.summary) || has(p.tagline) ? `<p class="cs-sum" data-reveal style="--d:250ms">${esc(has(p.summary) ? p.summary : p.tagline)}</p>` : ''}
        <div class="cs-meta" data-reveal style="--d:350ms">
          <span class="pill dev-pill">${['mobile', 'tablet', 'desktop'].filter((k) => dv[k]).map((k) => `<span title="${DEV[k][0]}">${devIc(k)}</span>`).join('')}${esc(p.platform || (type === 'web' ? 'Website' : type === 'both' ? 'Website + app' : 'Mobile app'))}</span>
          ${(p.tags || []).map((t) => `<span class="pill">${esc(t)}</span>`).join('')}
          ${p.status ? `<span class="status-pill ${({ 'Live': 'live', 'In progress': 'dev', 'Shipped': 'done' })[p.status] || (p.live ? 'live' : 'muted')}">${esc(p.status)}</span>` : ''}
          ${has(p.liveUrl) ? `<a class="btn btn-primary btn-sm" href="${esc(p.liveUrl)}" target="_blank" rel="noopener">Visit live <span class="arr">↗</span></a>` : ''}
        </div>
      </section>
      <section class="container">
        <div class="cs-cover" data-reveal style="background:radial-gradient(120% 90% at 50% 120%,${esc(tint)},transparent 65%),var(--panel)">
          <div class="inner">${coverInner}</div>
        </div>
        ${snap.length ? `<div class="snap glass" data-reveal>${snap.map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
      </section>
      <div class="container cs-body">
        ${toc.length ? `<nav class="toc" aria-label="On this page">${toc.map(([id, l]) => `<a href="#${id}" data-toc="${id}">${l}</a>`).join('')}</nav>` : ''}
        <div class="cs-content">${sections.join('') || '<p class="cs-text">Details for this case study are coming soon.</p>'}</div>
      </div>
`;

    /* gallery */
    const galEl = $('#gallery');
    let galList = after.length ? after : before;
    let curList = galList;
    const drawGallery = () => {
      if (!galEl) return;
      galEl.innerHTML = galList.map((g, i) => `<button class="shot glass" type="button" data-i="${i}" data-cursor="Open ↗" aria-label="Open ${esc(g.label || 'screen')}"><span class="scr">${g.image ? `<img src="${esc(g.image)}" alt="${esc(g.label || '')}" loading="lazy">` : mockScreen(tint)}</span><span>${esc(g.label || '')}</span></button>`).join('');
      $$('.shot', galEl).forEach((b) => b.addEventListener('click', () => { curList = galList; openLB(parseInt(b.dataset.i, 10)); }));
    };
    drawGallery();
    const tabsEl = $('.tabs', main);
    if (tabsEl) {
      const bs = $$('button', tabsEl), th = $('.thumb', tabsEl);
      const place = () => { const on = $('button.on', tabsEl); th.style.width = on.offsetWidth + 'px'; th.style.transform = `translateX(${on.offsetLeft - 5}px)`; };
      bs.forEach((b) => b.addEventListener('click', () => {
        bs.forEach((x) => x.classList.toggle('on', x === b)); place();
        galList = b.dataset.g === 'before' ? before : after; drawGallery();
      }));
      requestAnimationFrame(place);
      if (document.fonts) document.fonts.ready.then(place);
    }

    /* device screens */
    const dt = $('.dev-tabs', main);
    if (dt) {
      const bs = $$('button', dt), th = $('.thumb', dt);
      const place = () => { const on = $('button.on', dt); th.style.width = on.offsetWidth + 'px'; th.style.transform = `translateX(${on.offsetLeft - 5}px)`; };
      bs.forEach((b) => b.addEventListener('click', () => { bs.forEach((x) => x.classList.toggle('on', x === b)); $$('[data-dv-pane]', main).forEach((g) => { g.hidden = g.dataset.dvPane !== b.dataset.dv; }); place(); }));
      requestAnimationFrame(place); if (document.fonts) document.fonts.ready.then(place);
    }
    $$('.dshot', main).forEach((b) => b.addEventListener('click', () => {
      const set = sets.find(([k]) => k === b.dataset.set);
      curList = set[1].map((src, j) => ({ image: src, label: `${DEV[set[0]][0]} · ${j + 1}` }));
      openLB(parseInt(b.dataset.i, 10));
    }));

    /* lightbox */
    const lb = $('#lightbox');
    let li = 0;
    function showLB() {
      const g = curList[li];
      $('.lb-scr', lb).innerHTML = g.image ? `<img src="${esc(g.image)}" alt="${esc(g.label || '')}">` : mockScreen(tint);
      $('.lb-label', lb).textContent = g.label || '';
      $('.lb-count', lb).textContent = `${li + 1} / ${curList.length}`;
    }
    function openLB(i) { li = i; showLB(); lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false'); $('.lb-close', lb).focus(); }
    window.__lb = { step: (d) => { li = (li + d + curList.length) % curList.length; showLB(); }, close: () => { lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true'); } };

    /* toc active */
    const tocLinks = $$('.toc a');
    tocLinks.forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const s = document.getElementById(a.dataset.toc);
      if (s) scrollTo({ top: s.getBoundingClientRect().top + scrollY - 100, behavior: reduce ? 'auto' : 'smooth' });
    }));
    if (tocLinks.length) {
      const tio = new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) tocLinks.forEach((a) => a.classList.toggle('active', a.dataset.toc === e.target.id));
      }), { rootMargin: '-40% 0px -55% 0px' });
      toc.forEach(([id]) => { const s = document.getElementById(id); s && tio.observe(s); });
    }
    scan(main);
    scrollTo(0, 0);
  }

  /* lightbox controls (bound once) */
  const lb = $('#lightbox');
  $('.lb-close', lb).addEventListener('click', () => window.__lb && window.__lb.close());
  $('.lb-btn.prev', lb).addEventListener('click', () => window.__lb && window.__lb.step(-1));
  $('.lb-btn.nxt', lb).addEventListener('click', () => window.__lb && window.__lb.step(1));
  lb.addEventListener('click', (e) => { if (e.target === lb) window.__lb && window.__lb.close(); });
  addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open') || !window.__lb) return;
    if (e.key === 'Escape') window.__lb.close();
    if (e.key === 'ArrowRight') window.__lb.step(1);
    if (e.key === 'ArrowLeft') window.__lb.step(-1);
  });

  /* cover parallax */
  if (!reduce) onScroll(() => {
    const c = $('.cs-cover .inner');
    if (!c) return;
    const r = c.parentElement.getBoundingClientRect();
    const p = clamp(1 - r.bottom / (innerHeight + r.height));
    c.style.setProperty('--s', (1.08 - p * 0.08).toFixed(3));
  });

  function route() {
    const slug = getSlug();
    const idx = projects.findIndex((p) => p.slug === slug);
    if (idx === -1) {
      if (!slug && projects.length) { render(projects[0], 0); return; }
      main.innerHTML = `<section class="container notfound"><h1 class="h-lg">Project <em class="serif">not found</em></h1><a class="btn btn-primary" href="index.html#work">Back to all work <span class="arr">↗</span></a></section>`;
      return;
    }
    render(projects[idx], idx);
  }
  addEventListener('hashchange', () => {
    const slug = getSlug();
    if (projects.some((p) => p.slug === slug)) route();
  });

  loadProjects().then((list) => { projects = list; route(); }).catch((e) => {
    console.error(e);
    main.innerHTML = `<section class="container notfound"><h1 class="h-md">Couldn't load projects</h1><p class="muted">Open the site through a web server (see README). On GitHub Pages this works automatically.</p></section>`;
  });
})();
