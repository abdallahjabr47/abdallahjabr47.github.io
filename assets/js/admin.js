/* Admin dashboard — edits data/projects.json and uploads images straight into the GitHub repo.
   Every "Publish" makes ONE commit; GitHub Pages then redeploys the site (about a minute). */
(function () {
  const { $, $$, esc, toast } = window.Site;
  const CFG = window.SITE_CONFIG || {};
  const LS = 'pf-admin-auth';
  const API = 'https://api.github.com';

  let auth = null;          // { owner, repo, branch, token }
  let projects = [];        // working copy
  let original = '[]';      // last published JSON (to detect changes)
  let pending = new Map();  // repo path -> base64 content (new images to upload)
  let previews = new Map(); // repo path -> object URL (to preview images before publish)
  let editing = -1;         // index being edited, -1 = list view
  let experience = [];      // work history
  let originalExp = '[]';
  let tab = 'projects';     // which editor kind is shown (projects | experience | profile | content)
  /* admin follows the website: one page tab per menu item, with sub-tabs for every section under it */
  const PAGES = [
    { id: 'top', label: 'Top', subs: [
      { id: 'hero', label: 'Heading & intro', kind: 'content', keys: ['hero'] },
      { id: 'photo', label: 'Main photo', kind: 'site', groups: ['photo'] },
      { id: 'avail', label: 'Availability line', kind: 'site', groups: ['availability'] },
      { id: 'tools', label: 'Tools strip', kind: 'content', keys: ['tools'] }] },
    { id: 'work', label: 'Work', subs: [
      { id: 'projects', label: 'Projects', kind: 'projects' },
      { id: 'work-text', label: 'Selected work · text', kind: 'content', keys: ['work'] },
      { id: 'screens-img', label: 'Screens that ship · images', kind: 'site', groups: ['showcase'] },
      { id: 'screens-text', label: 'Screens that ship · text', kind: 'content', keys: ['screens'] },
      { id: 'process', label: 'From sketch to shipped', kind: 'content', keys: ['process'] }] },
    { id: 'about', label: 'About', subs: [
      { id: 'about-text', label: 'About text & numbers', kind: 'content', keys: ['about'] },
      { id: 'photo2', label: 'About photo', kind: 'site', groups: ['photo2'] }] },
    { id: 'experience', label: 'Experience', subs: [
      { id: 'roles', label: 'Work experience', kind: 'experience' },
      { id: 'learning', label: 'Learning & recognition', kind: 'site', groups: ['recognition'] },
      { id: 'exp-text', label: 'Section text', kind: 'content', keys: ['experience'] }] },
    { id: 'product', label: 'Product', subs: [
      { id: 'product-text', label: 'Product management', kind: 'content', keys: ['product'] },
      { id: 'principles', label: 'Principles', kind: 'content', keys: ['principles'] }] },
    { id: 'skills', label: 'Skills', subs: [
      { id: 'skills-text', label: 'Skills', kind: 'content', keys: ['skills'] },
      { id: 'system', label: 'Design system', kind: 'content', keys: ['design-system'] }] },
    { id: 'beyond', label: 'Beyond', subs: [
      { id: 'beyond-text', label: 'Text', kind: 'content', keys: ['beyond'] },
      { id: 'beyond-photos', label: 'Card photos', kind: 'site', groups: ['beyond'] }] },
    { id: 'contact', label: 'Contact & more', subs: [
      { id: 'links', label: 'Links & CV', kind: 'site', groups: ['links', 'cv'] },
      { id: 'contact-text', label: 'Contact text', kind: 'content', keys: ['contact'] },
      { id: 'faq', label: 'FAQ', kind: 'content', keys: ['faq'] },
      { id: 'testi', label: 'Testimonials', kind: 'site', groups: ['testimonials'] },
      { id: 'testi-text', label: 'Testimonials · text', kind: 'content', keys: ['testimonials'] }] }];
  let page = PAGES[1], sub = PAGES[1].subs[0];
  const KIND_TAB = { projects: 'projects', experience: 'experience', site: 'profile', content: 'content' };
  function drawTabs() {
    $('#pageTabs').innerHTML = PAGES.map((p) => `<button type="button" role="tab" data-page="${p.id}" class="${p === page ? 'on' : ''}" aria-selected="${p === page}">${esc(p.label)}</button>`).join('');
    $('#subTabs').innerHTML = page.subs.map((x) => `<button type="button" data-sub="${x.id}" class="${x === sub ? 'on' : ''}" aria-pressed="${x === sub}">${esc(x.label)}</button>`).join('');
  }
  function goTo(p, x) { collect(); setDirty(changed()); page = p; sub = x || p.subs[0]; tab = KIND_TAB[sub.kind]; renderList(); }
  let mode = 'project';     // which editor is open
  const EXP_PATH = 'data/experience.json';
  const SITE_PATH = 'data/site.json';
  let site = {};
  let originalSite = '{}';
  const CONTENT_PATH = 'data/content.json';
  let content = { text: {}, hidden: [] };
  let originalContent = '{}';
  const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {}) : v;
  const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(JSON.parse(b)));
  const changed = () => !same(projects, original) || !same(experience, originalExp) || !same(site, originalSite) || !same(content, originalContent) || pending.size > 0;
  let dirty = false;

  /* ---------------- helpers ---------------- */
  const show = (id) => { ['v-login', 'v-list', 'v-edit'].forEach((v) => $('#' + v).classList.toggle('hidden', v !== id)); $('#nav').hidden = id === 'v-login'; };
  const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-+|-+$/g, '') || 'project-' + Date.now().toString(36);
  const imgURL = (path) => previews.get(path) || path;
  const b64FromUtf8 = (str) => { const bytes = new TextEncoder().encode(str); let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); }); return btoa(bin); };
  function setDirty(v) {
    dirty = v;
    $('#savebar').classList.toggle('hidden', !v);
    if (v) { const m = $('#saveMsg'); m.className = 'msg'; m.textContent = 'Unsaved changes — press Publish to put them live'; }
  }
  addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  async function gh(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts,
      headers: { Authorization: 'Bearer ' + auth.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) }
    });
    if (!res.ok) {
      let msg = res.status + ' ' + res.statusText;
      try { const j = await res.json(); if (j.message) msg = j.message; } catch (e) {}
      throw new Error(msg);
    }
    return res;
  }
  const repoPath = () => `/repos/${auth.owner}/${auth.repo}`;

  /* ---------------- auth ---------------- */
  function loadAuth() {
    try { const s = localStorage.getItem(LS) || sessionStorage.getItem(LS); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function saveAuth(a, remember) {
    try { (remember ? localStorage : sessionStorage).setItem(LS, JSON.stringify(a)); } catch (e) {}
  }
  function clearAuth() { try { localStorage.removeItem(LS); sessionStorage.removeItem(LS); } catch (e) {} }

  function initLogin() {
    const gh0 = CFG.github || {};
    $('#lg-owner').value = gh0.owner && !/YOUR-/.test(gh0.owner) ? gh0.owner : '';
    $('#lg-repo').value = gh0.repo && !/YOUR-/.test(gh0.repo) ? gh0.repo : '';
    $('#lg-branch').value = gh0.branch || 'main';
    show('v-login');
  }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#lg-msg'); msg.textContent = '';
    auth = { owner: $('#lg-owner').value.trim(), repo: $('#lg-repo').value.trim(), branch: $('#lg-branch').value.trim() || 'main', token: $('#lg-token').value.trim() };
    try {
      const r = await (await gh(repoPath())).json();
      if (!r.permissions || !r.permissions.push) throw new Error('This token cannot write to the repository. Give it “Contents: Read and write”.');
      saveAuth(auth, $('#lg-remember').checked);
      await loadData();
    } catch (err) { msg.textContent = 'Could not sign in: ' + err.message; auth = null; }
  });
  if ($('#logout')) $('#logout').addEventListener('click', () => { if (dirty && !window.confirm('You have unpublished changes. Lock anyway?')) return; clearAuth(); auth = null; setDirty(false); initLogin(); });

  /* ---------------- load ---------------- */
  async function loadData() {
    const path = CFG.dataPath || 'data/projects.json';
    try {
      const res = await gh(`${repoPath()}/contents/${path}?ref=${encodeURIComponent(auth.branch)}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
      const txt = await res.text();
      projects = JSON.parse(txt);
    } catch (err) {
      if (/Not Found/i.test(err.message)) projects = [];
      else throw err;
    }
    try {
      const r2 = await gh(`${repoPath()}/contents/${EXP_PATH}?ref=${encodeURIComponent(auth.branch)}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
      experience = JSON.parse(await r2.text());
    } catch (err) {
      if (/Not Found/i.test(err.message)) experience = [];
      else throw err;
    }
    try {
      const r3 = await gh(`${repoPath()}/contents/${SITE_PATH}?ref=${encodeURIComponent(auth.branch)}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
      site = JSON.parse(await r3.text());
    } catch (err) {
      if (/Not Found/i.test(err.message)) site = {};
      else throw err;
    }
    try {
      const r4 = await gh(`${repoPath()}/contents/${CONTENT_PATH}?ref=${encodeURIComponent(auth.branch)}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
      content = JSON.parse(await r4.text());
    } catch (err) {
      if (/Not Found/i.test(err.message)) content = { text: {}, hidden: [] };
      else throw err;
    }
    content.text = content.text || {}; content.hidden = content.hidden || [];
    original = JSON.stringify(projects);
    originalExp = JSON.stringify(experience);
    originalSite = JSON.stringify(site);
    originalContent = JSON.stringify(content);
    pending.clear();
    setDirty(false);
    renderList();
  }

  /* ---------------- list ---------------- */
  function renderList() {
    editing = -1;
    tab = KIND_TAB[sub.kind];
    drawTabs();
    if (tab === 'profile') return openSiteEditor();
    if (tab === 'content') return openContentEditor();
    unembed();
    show('v-list');
    $('#newProject').textContent = tab === 'projects' ? '+ New project' : '+ Add role';
    $('#list-title').innerHTML = `${esc(page.label)} <em class="serif">· ${esc(sub.label)}</em>`;
    const el = $('#plist');
    if (tab === 'experience') {
      if (!experience.length) { el.innerHTML = '<div class="card-a glass"><p class="muted">No roles yet. Press <b>+ Add role</b>.</p></div>'; return; }
      el.innerHTML = experience.map((x, i) => `<div class="prow glass">
        <span class="t"><b>${esc(x.role || 'Untitled role')}</b><small>${esc(x.company || '')}${x.dates ? ' · ' + esc(x.dates) : ''}</small></span>
        <span class="badge-d ${x.visible !== false ? 'on' : ''}">${x.visible !== false ? 'Visible' : 'Hidden'}</span>
        <span class="acts">
          <button class="ib" type="button" data-a="up" data-i="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="ib" type="button" data-a="down" data-i="${i}" aria-label="Move down" ${i === experience.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="ib ${x.visible !== false ? 'hide' : 'show'}" type="button" data-a="toggle" data-i="${i}">${x.visible !== false ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c5 0 9 4.5 10 6-.4.7-1.4 2-2.9 3.3M6.6 6.6C4.6 8 3.3 9.8 2 12c1 1.5 5 6 10 6 1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>Hide' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c1-1.5 5-6 10-6s9 4.5 10 6c-1 1.5-5 6-10 6S3 13.5 2 12z"/><circle cx="12" cy="12" r="3"/></svg>Show'}</button>
          <button class="ib edit" type="button" data-a="edit" data-i="${i}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>Edit</button>
          <button class="ib danger" type="button" data-a="del" data-i="${i}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>Delete</button>
        </span></div>`).join('');
      return;
    }
    if (!projects.length) { el.innerHTML = '<div class="card-a glass"><p class="muted">No projects yet. Press <b>+ New project</b> to add your first one.</p></div>'; return; }
    el.innerHTML = projects.map((p, i) => {
      const tint = (p.cover && p.cover.tint) || '#2B3A8F';
      const icon = p.icon ? `<img src="${esc(imgURL(p.icon))}" alt="">` : esc((p.title || '?').charAt(0));
      return `<div class="prow glass">
        <span class="ic" style="background:linear-gradient(140deg,${esc(tint)},#0E1119)">${icon}</span>
        <span class="t"><b>${esc(p.title || 'Untitled')}</b><small>${esc(p.category || '')}${p.year ? ' · ' + esc(p.year) : ''}</small></span>
        <span class="bdgs"><span class="badge-d ${p.published !== false ? 'on' : ''}">${p.published !== false ? 'Published' : 'Hidden'}</span>${p.featured ? '<span class="badge-d feat">★ Featured</span>' : ''}</span>
        <span class="acts">
          <button class="ib" type="button" data-a="up" data-i="${i}" aria-label="Move ${esc(p.title)} up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="ib" type="button" data-a="down" data-i="${i}" aria-label="Move ${esc(p.title)} down" ${i === projects.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="ib ${p.published !== false ? 'hide' : 'show'}" type="button" data-a="toggle" data-i="${i}">${p.published !== false ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c5 0 9 4.5 10 6-.4.7-1.4 2-2.9 3.3M6.6 6.6C4.6 8 3.3 9.8 2 12c1 1.5 5 6 10 6 1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>Hide' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c1-1.5 5-6 10-6s9 4.5 10 6c-1 1.5-5 6-10 6S3 13.5 2 12z"/><circle cx="12" cy="12" r="3"/></svg>Show'}</button>
          <button class="ib edit" type="button" data-a="edit" data-i="${i}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>Edit</button>
          <button class="ib danger" type="button" data-a="del" data-i="${i}" aria-label="Delete ${esc(p.title)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>Delete</button>
        </span></div>`;
    }).join('');
  }
  $('#plist').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const i = parseInt(b.dataset.i, 10), a = b.dataset.a;
    const arr = tab === 'projects' ? projects : experience;
    const flag = tab === 'projects' ? 'published' : 'visible';
    if (a === 'edit') return tab === 'projects' ? openEditor(i) : openExpEditor(i);
    if (a === 'up' && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    if (a === 'down' && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    if (a === 'toggle') arr[i][flag] = arr[i][flag] === false;
    if (a === 'del') { if (!window.confirm(`Delete “${arr[i].title || arr[i].role}”? It disappears from the site when you publish.`)) return; arr.splice(i, 1); }
    setDirty(changed());
    renderList();
  });
  $('#pageTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (!b) return; const p = PAGES.find((x) => x.id === b.dataset.page); if (p === page && editing < 0 && tab !== 'profile' && tab !== 'content') return; goTo(p); });
  $('#subTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-sub]'); if (!b) return; const x = page.subs.find((y) => y.id === b.dataset.sub); if (x === sub && (tab === 'profile' || tab === 'content')) return; goTo(page, x); });
  $('#newProject').addEventListener('click', () => {
    if (tab === 'experience') {
      experience.unshift({ id: 'role-' + Date.now().toString(36), visible: true, role: '', company: '', location: '', dates: '', type: 'Full-time', summary: '', highlights: [] });
      return openExpEditor(0, true);
    }
    projects.push({ slug: '', title: '', headline: '', headlineAccent: '', tagline: '', category: '', platform: 'Mobile App', type: 'mobile', year: String(new Date().getFullYear()), live: false, liveUrl: '', status: '', published: true, summary: '', cover: { image: '', ghost: '', tint: '#2B3A8F' }, company: '', role: '', team: '', timeline: '', platforms: '', tags: [], overview: '', problem: '', responsibilities: { product: [], design: [] }, process: [], challenges: [], gallery: { before: [], after: [] }, results: [], learnings: '', icon: '', screens: [], tabletScreens: [], webScreens: [], devices: { mobile: true, tablet: false, desktop: false }, cardDevice: 'auto' });
    openEditor(projects.length - 1, true);
  });

  /* ---------------- editor ---------------- */
  const F = (label, key, val, opts = {}) => {
    const v = esc(val == null ? '' : val);
    const hint = opts.hint ? `<small>${opts.hint}</small>` : '';
    if (opts.area) return `<label class="f">${label}<textarea data-k="${key}" rows="${opts.rows || 4}">${v}</textarea>${hint}</label>`;
    if (opts.select) return `<label class="f">${label}<select data-k="${key}">${opts.select.map(([ov, ol]) => `<option value="${ov}" ${String(val) === ov ? 'selected' : ''}>${ol}</option>`).join('')}</select>${hint}</label>`;
    return `<label class="f">${label}<input data-k="${key}" type="${opts.type || 'text'}" value="${v}" ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''}>${hint}</label>`;
  };
  const STATUSES = [['', 'None (no status)'], ['Live', 'Live'], ['Shipped', 'Shipped'], ['In progress', 'In progress']];
  const C = (label, key, val) => `<label class="chk"><input type="checkbox" data-k="${key}" ${val ? 'checked' : ''}> ${label}</label>`;

  function imgItem(path, cls, withLabel, label) {
    return `<div class="im ${cls}" data-path="${esc(path)}">
      ${path ? `<span class="th" style="background-image:url('${esc(imgURL(path))}')"></span>` : `<label class="th empty" title="Upload an image for this slot"><span>+ Upload</span><input type="file" accept="image/*" data-slot hidden></label>`}
      ${withLabel ? `<input type="text" value="${esc(label || '')}" placeholder="Label" data-lbl>` : ''}
      <span class="ctl"><button type="button" data-im="left" aria-label="Move left">←</button><button type="button" data-im="right" aria-label="Move right">→</button><button type="button" data-im="del" aria-label="Remove image">✕</button></span>
    </div>`;
  }
  function imgList(key, items, cls = '', withLabel = false, multiple = true) {
    return `<div class="imgs" data-imgs="${key}" data-cls="${cls}" data-lab="${withLabel ? 1 : 0}" data-multi="${multiple ? 1 : 0}">
      ${items.map((it) => typeof it === 'string' ? imgItem(it, cls, false) : imgItem(it.image || '', cls, withLabel, it.label)).join('')}
      <label class="addimg ${cls}">+ Add image${multiple ? 's' : ''}<input type="file" accept="image/*" ${multiple ? 'multiple' : ''}></label>
    </div>`;
  }
  function repRow(kind, a = {}) {
    if (kind === 'process') return `<div class="rep-item" data-row><label class="f">Step<input data-r="title" value="${esc(a.title || '')}"></label><label class="f">Description<textarea data-r="desc">${esc(a.desc || '')}</textarea></label><button class="ib danger" type="button" data-del-row aria-label="Remove">✕</button></div>`;
    if (kind === 'challenges') return `<div class="rep-item two" data-row><label class="f">Challenge<textarea data-r="challenge">${esc(a.challenge || '')}</textarea></label><label class="f">Solution<textarea data-r="solution">${esc(a.solution || '')}</textarea></label><button class="ib danger" type="button" data-del-row aria-label="Remove">✕</button></div>`;
    if (kind === 'testimonials') return `<div class="rep-item" data-row><label class="f">Quote<textarea data-r="quote" placeholder="What they said about working with you">${esc(a.quote || '')}</textarea></label><div style="display:flex;flex-direction:column;gap:12px"><label class="f">Name<input data-r="name" value="${esc(a.name || '')}" placeholder="Full name"></label><label class="f">Role &amp; company<input data-r="role" value="${esc(a.role || '')}" placeholder="CTO, Homyt"></label></div><button class="ib danger" type="button" data-del-row aria-label="Remove">✕</button></div>`;
    if (kind === 'recognition') {
      const K = [['certificate', 'Certificate'], ['education', 'Degree / education'], ['award', 'Hackathon, award or fellowship'], ['leadership', 'Leadership & community']];
      return `<div class="rep-item rec-row" data-row><div class="g2"><label class="f">Type<select data-r="kind">${K.map(([v, l]) => `<option value="${v}"${(a.kind || 'certificate') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label><label class="f">Year<input data-r="year" value="${esc(a.year || '')}" placeholder="2024 or 2022 — 2024"></label></div><label class="f">Title<input data-r="title" value="${esc(a.title || '')}" placeholder="Google UX Design Professional Certificate"></label><div class="g2"><label class="f">Organisation · place<input data-r="org" value="${esc(a.org || '')}" placeholder="Google · Online"></label><label class="f">Link (optional)<input data-r="link" value="${esc(a.link || '')}" placeholder="https://… certificate link"></label></div><div class="f">Certificate image (optional)<div class="rec-img"><input type="hidden" data-r="image" value="${esc(a.image || '')}"><span class="rec-th"${a.image ? ` style="background-image:url('${esc(imgURL(a.image))}')"` : ''}>${a.image ? '' : 'No image'}</span><span class="rec-acts"><label class="btn btn-ghost btn-sm">${a.image ? 'Change' : '+ Upload'}<input type="file" accept="image/*" class="rec-file" hidden></label>${a.image ? '<button type="button" class="ib danger" data-rec-rm>Remove</button>' : ''}</span></div><small class="hint" style="margin:0">Shown as a small preview on the site; visitors can click to see it full size.</small></div><label class="f">Short note (optional)<input data-r="note" value="${esc(a.note || '')}" placeholder="Selected from 300+ applicants"></label><button class="ib danger" type="button" data-del-row aria-label="Remove">✕</button></div>`;
    }
    if (kind === 'results') return `<div class="rep-item" data-row><label class="f">Value<input data-r="value" value="${esc(a.value || '')}" placeholder="+35%"></label><label class="f">What it measures<input data-r="label" value="${esc(a.label || '')}" placeholder="Weekly active users"></label><button class="ib danger" type="button" data-del-row aria-label="Remove">✕</button></div>`;
    return '';
  }
  const rep = (kind, list, addLabel) => `<div class="rep" data-rep="${kind}">${(list || []).map((a) => repRow(kind, a)).join('')}</div><button class="btn btn-ghost btn-sm" type="button" data-add-row="${kind}" style="align-self:flex-start">+ ${addLabel}</button>`;

  function openEditor(i, isNew) {
    unembed();
    editing = i; mode = 'project';
    const p = projects[i];
    show('v-edit');
    $('#ed-title').innerHTML = isNew ? 'New <em class="serif">project</em>' : `Edit <em class="serif">${esc(p.title || 'project')}</em>`;
    $('#ed-draft').textContent = 'Preview changes ↗';
    const r = p.responsibilities || {};
    const g = p.gallery || {};
    const devs = (p.devices && (p.devices.mobile || p.devices.tablet || p.devices.desktop)) ? p.devices : { mobile: (p.type || 'mobile') !== 'web' || !!(p.screens || []).length, tablet: !!(p.tabletScreens || []).length, desktop: (p.type || 'mobile') !== 'mobile' };
    $('#edForm').innerHTML = `
      <fieldset><legend>Basics</legend>
        <div class="g2">${F('Project name *', 'title', p.title)}${F('URL name (slug)', 'slug', p.slug, { hint: 'Auto-filled from the name. Used in the link: project.html#slug' })}</div>
        <div class="g2">${F('Card one-liner', 'tagline', p.tagline, { hint: 'Shown under the name on the card and on the case study.' })}${F('Category', 'category', p.category, { ph: 'Entertainment · Series platform' })}</div>
        <div class="g3">${F('Type', 'type', p.type || 'mobile', { select: [['mobile', 'Mobile app'], ['web', 'Website'], ['both', 'Website + mobile app']] })}${F('Platform label', 'platform', p.platform, { ph: 'Mobile App' })}${F('Year', 'year', p.year)}</div>
        <div class="g3">${F('Status', 'status', STATUSES.some(([v]) => v === (p.status || '')) ? (p.status || '') : (p.live ? 'Live' : ''), { select: STATUSES, hint: 'Shown on the card and case study.' })}${F('Live link (optional)', 'liveUrl', p.liveUrl, { ph: 'https://…', hint: 'Adds a “Visit live” button.' })}<div style="display:flex;flex-direction:column;justify-content:center">${C('Show on the website', 'published', p.published !== false)}${C('Featured on the home page (top 5)', 'featured', p.featured === true)}</div></div>
        ${F('Short summary', 'summary', p.summary, { area: true, rows: 3, hint: 'Two or three sentences shown on the case study page, under the one-liner.' })}
      </fieldset>

      <fieldset><legend>Devices &amp; screens</legend>
        <p class="hint">Tick every device this project was designed for, then upload its screens. Phone: portrait (e.g. 1170×2532) · Tablet: portrait (e.g. 1668×2224) · Desktop: wide (e.g. 1440×900).</p>
        <div class="dev-pick">${[['mobile', 'Phone', '<rect x="7" y="2.5" width="10" height="19" rx="2.6"/><path d="M11 18.5h2"/>'], ['tablet', 'Tablet / iPad', '<rect x="4" y="3" width="16" height="18" rx="2.6"/><path d="M11 18h2"/>'], ['desktop', 'Laptop / desktop', '<rect x="3.5" y="4.5" width="17" height="11.5" rx="1.8"/><path d="M2 19.5h20"/>']].map(([k, l, ic]) => `<label class="dev-opt"><input type="checkbox" data-k="devices.${k}" data-dev="${k}" ${devs[k] ? 'checked' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg><span>${l}</span></label>`).join('')}</div>
        ${F('Card preview shows', 'cardDevice', p.cardDevice || 'auto', { select: [['auto', 'Automatic (best fit)'], ['mobile', 'Phone'], ['tablet', 'Tablet'], ['desktop', 'Laptop']], hint: 'Which device appears on the home page card. The case study shows all of them.' })}
        <div class="f">App icon</div>${imgList('icon', p.icon ? [p.icon] : [], 'sq', false, false)}
        <div class="dev-up" data-dev-up="mobile"${devs.mobile ? '' : ' hidden'}><div class="f">Phone screens</div>${imgList('screens', p.screens || [])}</div>
        <div class="dev-up" data-dev-up="tablet"${devs.tablet ? '' : ' hidden'}><div class="f">Tablet screens</div>${imgList('tabletScreens', p.tabletScreens || [], 'tab')}</div>
        <div class="dev-up" data-dev-up="desktop"${devs.desktop ? '' : ' hidden'}><div class="f">Desktop screens</div>${imgList('webScreens', p.webScreens || [], 'wide')}</div>
      </fieldset>

      <fieldset><legend>Case study header</legend>
        <div class="g2">${F('Big title', 'headline', p.headline, { ph: 'From content' })}${F('Italic blue part', 'headlineAccent', p.headlineAccent, { ph: 'to series.' })}</div>
        <div class="g3">${F('Accent colour', 'cover.tint', (p.cover && p.cover.tint) || '#2B3A8F', { type: 'color' })}${F('Big background word', 'cover.ghost', p.cover && p.cover.ghost, { ph: 'REDZ' })}${F('Tags (comma separated)', 'tags', (p.tags || []).join(', '))}</div>
        <div class="f">Cover image (optional — wide, replaces the device mock-up)</div>${imgList('cover.image', p.cover && p.cover.image ? [p.cover.image] : [], 'wide', false, false)}
        <div class="g2">${F('My role', 'role', p.role)}${F('Company / client', 'company', p.company)}</div>
        <div class="g3">${F('Team', 'team', p.team)}${F('Timeline', 'timeline', p.timeline)}${F('Platforms', 'platforms', p.platforms, { ph: 'iOS · Android' })}</div>
      </fieldset>

      <fieldset><legend>Story</legend>
        ${F('Overview', 'overview', p.overview, { area: true, rows: 5 })}
        ${F('The problem (one question)', 'problem', p.problem, { area: true, rows: 2 })}
        <div class="g2">${F('Product responsibilities (one per line)', 'responsibilities.product', (r.product || []).join('\n'), { area: true, rows: 5 })}${F('Design responsibilities (one per line)', 'responsibilities.design', (r.design || []).join('\n'), { area: true, rows: 5 })}</div>
      </fieldset>

      <fieldset><legend>Process</legend>${rep('process', p.process, 'Add step')}</fieldset>
      <fieldset><legend>Challenges &amp; solutions</legend>${rep('challenges', p.challenges, 'Add challenge')}</fieldset>

      <fieldset><legend>Design gallery</legend>
        <p class="hint">“After” is the final design. Add “Before” screens too if you redesigned something — visitors get a Before / After switch.</p>
        <div class="f">After (final screens)</div>${imgList('gallery.after', g.after || [], '', true)}
        <div class="f">Before (optional)</div>${imgList('gallery.before', g.before || [], '', true)}
      </fieldset>

      <fieldset><legend>Results</legend>${rep('results', p.results, 'Add result')}
        ${F('What I learned', 'learnings', p.learnings, { area: true, rows: 3 })}
      </fieldset>`;
  }

  /* Profile & links and Website text open right under the tabs, like the lists */
  function embedPanel(tabName, title) {
    show('v-list');
    $('#list-title').innerHTML = `${esc(page.label)} <em class="serif">· ${esc(sub.label)}</em>`;
    $('#plist').hidden = true; $('#listHint').hidden = true; $('#newProject').hidden = true;
    $('#tabPanel').hidden = false;
    $('#tabPanel').appendChild($('#edForm'));
  }
  function unembed() {
    $('#v-edit').appendChild($('#edForm'));
    $('#plist').hidden = false; $('#listHint').hidden = false; $('#newProject').hidden = false; $('#tabPanel').hidden = true;
  }

  async function openContentEditor() {
    editing = 0; mode = 'content';
    embedPanel('content', 'Website <em class="serif">text</em>');
    const form = $('#edForm');
    form.innerHTML = '<p class="hint">Loading the page text…</p>';
    let doc;
    try { doc = new DOMParser().parseFromString(await (await fetch('index.html?v=' + Date.now(), { cache: 'no-store' })).text(), 'text/html'); }
    catch (e) { form.innerHTML = '<p class="hint">Could not load the page text. Refresh and try again.</p>'; return; }
    const secs = window.SiteContent.sections(doc).filter((x) => !sub.keys || sub.keys.includes(x.key));
    const data = secs.map((sec) => ({ sec, fs: window.SiteContent.fields(sec) }));
    const valOf = (f) => (Object.prototype.hasOwnProperty.call(content.text, f.key) ? content.text[f.key] : f.text);
    const editedIn = (fs) => fs.filter((f) => valOf(f) !== f.text).length;
    form.innerHTML = `
      <div class="wt-help glass">
        <div><b>How it works</b><span>Change any text below, then press <b>Preview</b> or <b>Publish</b> at the bottom.</span></div>
        <div class="wt-keys"><span><code>*word*</code> blue italic</span><span><code>**words**</code> highlight</span><span><kbd>Enter</kbd> new line</span><span>Empty field = hidden</span></div>
      </div>
      <div class="wt${data.length < 2 ? ' single' : ''}">
        <aside class="wt-nav" role="tablist" aria-label="Page sections">${data.map(({ sec, fs }, n) => `
          <button type="button" class="wt-tab${n === 0 ? ' on' : ''}" data-wt="${n}" role="tab"><span class="wt-n">${String(n + 1).padStart(2, '0')}</span><span class="wt-l"><b>${esc(sec.name)}</b><small data-wt-meta="${n}">${fs.length} texts${editedIn(fs) ? ` · <i>${editedIn(fs)} edited</i>` : ''}${content.hidden.includes(sec.key) ? ' · hidden' : ''}</small></span></button>`).join('')}
        </aside>
        <div class="wt-body">${data.map(({ sec, fs }, n) => `
          <section class="wt-sec" data-wt-sec="${n}"${n ? ' hidden' : ''}>
            <header class="wt-head">
              <div><small>Section ${String(n + 1).padStart(2, '0')}</small><h3>${esc(sec.name)}</h3></div>
              <label class="wt-switch"><input type="checkbox" data-sec-show="${esc(sec.key)}" ${content.hidden.includes(sec.key) ? '' : 'checked'}><span></span>Show on website</label>
            </header>
            ${(() => {
              const field = (f) => { const v = valOf(f); const ed = v !== f.text; return `
            <div class="wt-field${ed ? ' edited' : ''}">
              <div class="wt-lab"><span>${esc(f.kind)}</span><button type="button" class="wt-reset" data-reset${ed ? '' : ' hidden'}>Reset</button></div>
              <textarea data-ckey="${esc(f.key)}" data-orig="${esc(f.text)}" rows="1">${esc(v)}</textarea>
              <p class="wt-orig"${ed ? '' : ' hidden'}>Original: ${esc(f.text)}</p>
            </div>`; };
              let html = '', k = 0;
              while (k < fs.length) {
                const g = fs[k].group;
                if (!g) { html += field(fs[k]); k++; continue; }
                const run = []; while (k < fs.length && fs[k].group === g) run.push(fs[k++]);
                const isList = g.startsWith('list-');
                html += `<div class="wt-group${isList ? ' list' : ''}"><div class="wt-gh"><b>${esc(run[0].groupLabel)}</b><small>${run.length} ${run.length === 1 ? 'text' : 'texts'}</small></div><div class="wt-gb">${run.map(field).join('')}</div></div>`;
              }
              return html;
            })()}
          </section>`).join('')}
        </div>
      </div>`;
    const grow = (t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; };
    const refreshMeta = (n) => { const { sec, fs } = data[n]; const sec$ = $(`[data-wt-sec="${n}"]`, form); const ed = $$('.wt-field.edited', sec$).length; const hid = !$('[data-sec-show]', sec$).checked; $(`[data-wt-meta="${n}"]`, form).innerHTML = `${fs.length} texts${ed ? ` · <i>${ed} edited</i>` : ''}${hid ? ' · hidden' : ''}`; };
    $$('.wt-tab', form).forEach((b) => b.addEventListener('click', () => {
      $$('.wt-tab', form).forEach((x) => x.classList.toggle('on', x === b));
      $$('.wt-sec', form).forEach((x) => { x.hidden = x.dataset.wtSec !== b.dataset.wt; });
      $$(`[data-wt-sec="${b.dataset.wt}"] textarea`, form).forEach(grow);
    }));
    $$('.wt-sec', form).forEach((sec$) => {
      const n = sec$.dataset.wtSec;
      sec$.addEventListener('input', (e) => {
        const t = e.target.closest('textarea'); if (!t) return;
        grow(t);
        const box = t.closest('.wt-field'), ed = t.value.trim() !== t.dataset.orig.trim();
        box.classList.toggle('edited', ed); $('[data-reset]', box).hidden = !ed; $('.wt-orig', box).hidden = !ed;
        refreshMeta(n); setDirty(true);
      });
      sec$.addEventListener('change', (e) => { if (e.target.matches('[data-sec-show]')) { refreshMeta(n); setDirty(true); } });
      sec$.addEventListener('click', (e) => {
        const r = e.target.closest('[data-reset]'); if (!r) return;
        const box = r.closest('.wt-field'), t = $('textarea', box);
        t.value = t.dataset.orig; t.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    requestAnimationFrame(() => $$('[data-wt-sec="0"] textarea', form).forEach(grow));
  }

  function openSiteEditor() {
    editing = 0; mode = 'site';
    embedPanel('profile', 'Profile <em class="serif">&amp; links</em>');
    $('#edForm').innerHTML = `
      <fieldset data-g="photo"><legend>Main photo</legend>
        <p class="hint">Top of the home page, next to your title. Portrait photos work best (about 4:5); they're resized automatically. Hover the photo to replace or remove it.</p>
        <div class="ph-grid"><div class="ph-card"><div class="ph-top"><span class="ph-badge">01</span><span><b>Main photo</b><small>Top of the home page</small></span></div>${imgList('photo', site.photo ? [site.photo] : [], 'pt', false, false)}</div></div>
      </fieldset>
      <fieldset data-g="photo2"><legend>About photo</legend>
        <p class="hint">Shown in the About section, beside your story. Portrait works best.</p>
        <div class="ph-grid"><div class="ph-card"><div class="ph-top"><span class="ph-badge">02</span><span><b>About photo</b><small>About section</small></span></div>${imgList('photo2', site.photo2 ? [site.photo2] : [], 'pt', false, false)}</div></div>
      </fieldset>
      <fieldset data-g="showcase"><legend>Screens gallery</legend>
        <p class="hint">Screenshots for the big “Screens that ship” wall on the home page — app screens, web pages, anything you designed. Add as many as you like (10+ looks best), use ← → to order them. Phone and web screenshots can be mixed. If empty, screens from your projects are used.</p>
        ${imgList('showcase', site.showcase || [], '', false, true)}
      </fieldset>
      <fieldset data-g="availability"><legend>Availability</legend>
        <div class="av-row">
          <p class="hint" style="margin:0">One short line under the buttons at the top of the page, with a green dot.</p>
          <label class="wt-switch"><input type="checkbox" data-k="availabilityOn" ${site.availabilityOn === false ? '' : 'checked'}><span></span>Show on website</label>
        </div>
        ${F('Availability line', 'availability', site.availability, { ph: 'Open to Product Manager / Product Owner roles · Ramallah or remote' })}
      </fieldset>
      <fieldset data-g="beyond"><legend>Beyond the screen — card photos (optional)</legend>
        <p class="hint">Each card on the home page has a small animation. Upload a photo or a GIF to show your own work there instead (square-ish, e.g. 1200×900). A GIF plays like a short video.</p>
        <div class="ph-grid">${[['ui', 'UI & mobile'], ['brand', 'Graphic & drawing'], ['logo', 'Branding & logos'], ['motion', 'Motion'], ['film', 'Filmmaking & editing'], ['fashion', 'Fashion, scent & style'], ['sport', 'Sport'], ['health', 'Health']].map(([k, l]) => `<div class="ph-card"><div class="ph-top"><span><b>${l}</b></span></div>${imgList('int_' + k, site['int_' + k] ? [site['int_' + k]] : [], 'wide', false, false)}</div>`).join('')}</div>
      </fieldset>
      <fieldset data-g="recognition"><legend>Learning &amp; recognition</legend>
        <p class="hint">Degrees, certificates, hackathons and community roles. They show under Experience → “Learning &amp; recognition” tab, in three columns, in this order. Leave the list empty to hide the section.</p>
        ${rep('recognition', site.recognition, 'Add item')}
      </fieldset>
      <fieldset data-g="testimonials"><legend>Testimonials</legend>
        <p class="hint">Short quotes from managers, developers or clients. The section shows on the home page only when at least one is added.</p>
        ${rep('testimonials', site.testimonials, 'Add testimonial')}
      </fieldset>
      <fieldset data-g="links"><legend>Links</legend>
        <p class="hint">Leave a link empty to hide its button on the site.</p>
        <div class="g2">${F('Email', 'email', site.email, { type: 'email', ph: 'you@email.com' })}${F('WhatsApp number (with country code)', 'whatsapp', site.whatsapp, { ph: '970597323726' })}</div>
        <div class="g2">${F('LinkedIn URL', 'linkedin', site.linkedin, { ph: 'https://www.linkedin.com/in/…' })}${F('Behance URL', 'behance', site.behance, { ph: 'https://www.behance.net/…' })}</div>
        <div class="g2">${F('Dribbble URL', 'dribbble', site.dribbble, { ph: 'https://dribbble.com/…' })}${F('GitHub URL', 'github', site.github, { ph: 'https://github.com/…' })}</div>
      </fieldset>
      <fieldset data-g="cv"><legend>Résumé (CV)</legend>
        <p class="hint">The “View My CV” button in the top bar opens this file. Removing it hides the button.</p>
        <div id="cvBox"></div>
        <input type="file" accept="application/pdf" id="cvInput" hidden>
      </fieldset>`;
    $$('#edForm fieldset[data-g]').forEach((f) => { f.hidden = !!(sub.groups && !sub.groups.includes(f.dataset.g)); });
    const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
    const drawCv = () => {
      const box = $('#cvBox');
      if (!site.cv) {
        box.innerHTML = `<label class="cv-empty" for="cvInput"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg><b>Upload your CV</b><small>PDF, up to 20 MB</small></label>`;
        return;
      }
      const isNew = pending.has(site.cv);
      const name = site.cvName || site.cv.split('/').pop();
      const when = site.cvUpdated ? `Updated ${fmtDate(site.cvUpdated)}` : 'Uploaded';
      box.innerHTML = `<div class="cv-card">
        <span class="cv-ic" aria-hidden="true">PDF</span>
        <span class="cv-meta"><b>${esc(name)}</b><small>${when}${isNew ? ' · <i>new — publish to put it live</i>' : ' · <i class="ok">Live on the site</i>'}</small></span>
        <span class="cv-act">
          <a class="ib" href="${esc(previews.get(site.cv) || site.cv)}" target="_blank" rel="noopener">View</a>
          <label class="ib edit" for="cvInput" style="cursor:pointer">Replace</label>
          <button class="ib danger" type="button" id="cvRemove">Remove</button>
        </span></div>`;
      $('#cvRemove').addEventListener('click', () => {
        if (!window.confirm('Remove the CV? The “View My CV” buttons will be hidden on the site after you publish.')) return;
        if (pending.has(site.cv)) pending.delete(site.cv);
        site.cv = ''; site.cvName = ''; site.cvUpdated = '';
        drawCv(); setDirty(true);
      });
    };
    drawCv();
    $('#cvInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) { toast('That PDF is too large (max 20 MB)'); return; }
      const fr = new FileReader();
      fr.onload = () => {
        const path = 'assets/cv-' + Date.now().toString(36) + '.pdf';
        pending.set(path, String(fr.result).split(',')[1]);
        previews.set(path, URL.createObjectURL(file));
        site.cv = path; site.cvName = file.name; site.cvUpdated = new Date().toISOString();
        e.target.value = '';
        drawCv(); setDirty(true);
      };
      fr.readAsDataURL(file);
    });
  }

  function openExpEditor(i, isNew) {
    unembed();
    editing = i; mode = 'exp';
    const x = experience[i];
    show('v-edit');
    $('#ed-title').innerHTML = isNew ? 'New <em class="serif">role</em>' : `Edit <em class="serif">${esc(x.company || 'role')}</em>`;
    $('#edForm').innerHTML = `
      <fieldset><legend>Role</legend>
        <div class="g2">${F('Job title *', 'role', x.role)}${F('Company *', 'company', x.company)}</div>
        <div class="g3">${F('Dates', 'dates', x.dates, { ph: 'Mar 2024 — Present' })}${F('Location', 'location', x.location, { ph: 'Ramallah, Palestine' })}${F('Type', 'type', x.type, { ph: 'Full-time' })}</div>
        ${C('Show on the website', 'visible', x.visible !== false)}
        ${F('One-line summary', 'summary', x.summary, { area: true, rows: 2 })}
        ${F('Highlights (one per line — shown when visitors open the role)', 'highlights', (x.highlights || []).join('\n'), { area: true, rows: 7 })}
      </fieldset>`;
  }

  /* collect form -> project */
  function collect() {
    if (editing < 0) return;
    if (mode === 'content') {
      if (!$('#edForm [data-ckey]')) return;
      const text = Object.assign({}, content.text);
      $$('#edForm [data-ckey]').forEach((t) => { delete text[t.dataset.ckey]; const v = t.value.replace(/\r/g, ''); if (v.trim() !== t.dataset.orig.trim()) text[t.dataset.ckey] = v.trim(); });
      content.text = text;
      const shown = $$('#edForm [data-sec-show]');
      const here = shown.map((c) => c.dataset.secShow);
      content.hidden = content.hidden.filter((k) => !here.includes(k)).concat(shown.filter((c) => !c.checked).map((c) => c.dataset.secShow));
      return;
    }
    if (mode === 'site') {
      $$('#edForm [data-k]').forEach((el) => { site[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
      $$('#edForm [data-rep]').forEach((box) => { site[box.dataset.rep] = $$('[data-row]', box).map((row) => { const o = {}; $$('[data-r]', row).forEach((f) => { o[f.dataset.r] = f.value.trim(); }); return o; }).filter((o) => Object.values(o).some(Boolean)); });
      $$('#edForm [data-imgs]').forEach((box) => { if (box.dataset.multi === '1') { const arr = $$('.im', box).map((im) => im.dataset.path).filter(Boolean); if (arr.length || box.dataset.imgs in site) site[box.dataset.imgs] = arr; return; } const im = $('.im', box); const v = im ? im.dataset.path : ''; if (v || box.dataset.imgs in site) site[box.dataset.imgs] = v; });
      return;
    }
    if (mode === 'exp') {
      const x = experience[editing];
      if (!x) return;
      $$('#edForm [data-k]').forEach((el) => {
        const k = el.dataset.k;
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (k === 'highlights') v = v.split('\n').map((t) => t.trim()).filter(Boolean);
        x[k] = v;
      });
      return;
    }
    const form = $('#edForm');
    const p = projects[editing];
    const setPath = (obj, key, val) => { const ks = key.split('.'); let o = obj; ks.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; }); o[ks[ks.length - 1]] = val; };
    $$('[data-k]', form).forEach((el) => {
      const k = el.dataset.k;
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (k === 'tags') v = v.split(',').map((s) => s.trim()).filter(Boolean);
      if (k.startsWith('responsibilities.')) v = v.split('\n').map((s) => s.trim()).filter(Boolean);
      setPath(p, k, v);
    });
    p.live = p.status === 'Live';
    if (!p.slug) p.slug = slugify(p.title);
    p.slug = slugify(p.slug);
    $$('[data-rep]', form).forEach((box) => {
      p[box.dataset.rep] = $$('[data-row]', box).map((row) => { const o = {}; $$('[data-r]', row).forEach((f) => { o[f.dataset.r] = f.value.trim(); }); return o; }).filter((o) => Object.values(o).some(Boolean));
    });
    $$('[data-imgs]', form).forEach((box) => {
      const key = box.dataset.imgs, lab = box.dataset.lab === '1', multi = box.dataset.multi === '1';
      const items = $$('.im', box).map((im) => lab ? { label: ($('[data-lbl]', im) || {}).value || '', image: im.dataset.path } : im.dataset.path).filter((x) => lab ? (x.image || x.label) : x);
      setPath(p, key, multi ? items : (items[0] || ''));
    });
  }

  /* editor events */
  const form = $('#edForm');
  form.addEventListener('change', (e) => { const d = e.target.dataset && e.target.dataset.dev; if (!d) return; const up = form.querySelector(`[data-dev-up="${d}"]`); if (up) up.hidden = !e.target.checked; });
  form.addEventListener('input', (e) => {
    if (mode === 'project' && e.target.dataset.k === 'title') {
      const s = $('[data-k="slug"]', form);
      if (s && (!s.dataset.touched)) s.value = slugify(e.target.value);
    }
    if (e.target.dataset.k === 'slug') e.target.dataset.touched = '1';
    setDirty(true);
  });
  form.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add-row]');
    if (add) { const kind = add.dataset.addRow; $(`[data-rep="${kind}"]`, form).insertAdjacentHTML('beforeend', repRow(kind)); setDirty(true); return; }
    const del = e.target.closest('[data-del-row]');
    if (del) { del.closest('[data-row]').remove(); setDirty(true); return; }
    const im = e.target.closest('[data-im]');
    if (im) {
      const item = im.closest('.im'), act = im.dataset.im;
      if (act === 'del') item.remove();
      if (act === 'left' && item.previousElementSibling && item.previousElementSibling.classList.contains('im')) item.parentNode.insertBefore(item, item.previousElementSibling);
      if (act === 'right' && item.nextElementSibling && item.nextElementSibling.classList.contains('im')) item.parentNode.insertBefore(item.nextElementSibling, item);
      setDirty(true);
    }
  });
  const grow = (t) => { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, 640) + 'px'; };
  form.addEventListener('input', (e) => { if (e.target.tagName === 'TEXTAREA') grow(e.target); });
  new MutationObserver(() => requestAnimationFrame(() => $$('textarea', form).forEach(grow))).observe(form, { childList: true });
  const drawRecImg = (wrap, path) => {
    $('[data-r="image"]', wrap).value = path || '';
    const th = $('.rec-th', wrap); th.style.backgroundImage = path ? `url('${imgURL(path)}')` : ''; th.textContent = path ? '' : 'No image';
    $('.rec-acts', wrap).innerHTML = `<label class="btn btn-ghost btn-sm">${path ? 'Change' : '+ Upload'}<input type="file" accept="image/*" class="rec-file" hidden></label>${path ? '<button type="button" class="ib danger" data-rec-rm>Remove</button>' : ''}`;
  };
  form.addEventListener('click', (e) => { const b = e.target.closest('[data-rec-rm]'); if (!b) return; drawRecImg(b.closest('.rec-img'), ''); setDirty(true); });
  form.addEventListener('change', async (e) => {
    const input = e.target;
    if (input.classList && input.classList.contains('rec-file') && input.files.length) {
      const file = input.files[0], wrap = input.closest('.rec-img');
      try {
        const { b64, url, ext } = await processImage(file, 1600);
        const name = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'certificate';
        const path = `${CFG.imagesPath || 'assets/uploads'}/certs/${Date.now().toString(36)}-${name}.${ext}`;
        pending.set(path, b64); previews.set(path, url);
        drawRecImg(wrap, path); setDirty(true);
      } catch (err) { toast('Could not read ' + file.name); }
      return;
    }
    if (input.type !== 'file' || !input.files.length) return;
    const box = input.closest('[data-imgs]');
    if (!box) return;
    const cls = box.dataset.cls, lab = box.dataset.lab === '1', multi = box.dataset.multi === '1';
    const titleEl = $('[data-k="slug"]', form);
    const folder = mode === 'site' ? (box.dataset.imgs === 'showcase' ? 'showcase' : 'profile') : slugify((titleEl && titleEl.value) || ($('[data-k="title"]', form) || {}).value || 'project');
    const slot = input.hasAttribute('data-slot') ? input.closest('.im') : null;
    if (slot) {
      const file = input.files[0];
      try {
        const { b64, url, ext } = await processImage(file, cls === 'sq' ? 512 : cls === 'wide' ? 2400 : 1400);
        const name = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'image';
        const path = `${CFG.imagesPath || 'assets/uploads'}/${folder}/${Date.now().toString(36)}-${name}.${ext}`;
        pending.set(path, b64); previews.set(path, url);
        const lblEl = $('[data-lbl]', slot);
        slot.insertAdjacentHTML('afterend', imgItem(path, cls, lab, lblEl ? lblEl.value : ''));
        slot.remove();
        setDirty(true);
      } catch (err) { toast('Could not read ' + file.name); }
      return;
    }
    if (!multi) $$('.im', box).forEach((x) => x.remove());
    for (const file of Array.from(input.files)) {
      try {
        const { b64, url, ext } = await processImage(file, mode === 'site' ? 1400 : cls === 'sq' ? 512 : cls === 'wide' ? 2400 : 1400);
        const name = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'image';
        const path = `${CFG.imagesPath || 'assets/uploads'}/${folder}/${Date.now().toString(36)}-${name}.${ext}`;
        pending.set(path, b64); previews.set(path, url);
        $('.addimg', box).insertAdjacentHTML('beforebegin', imgItem(path, cls, lab, ''));
      } catch (err) { toast('Could not read ' + file.name); }
    }
    input.value = '';
    setDirty(true);
  });

  /* resize + compress in the browser before upload */
  function processImage(file, maxW) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      if (/svg|gif/.test(file.type)) {
        const fr = new FileReader();
        fr.onload = () => resolve({ b64: String(fr.result).split(',')[1], url, ext: file.type.includes('svg') ? 'svg' : 'gif' });
        fr.onerror = reject; fr.readAsDataURL(file); return;
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let data = c.toDataURL('image/webp', 0.86), ext = 'webp';
        if (!data.startsWith('data:image/webp')) { data = c.toDataURL('image/jpeg', 0.86); ext = 'jpg'; }
        resolve({ b64: data.split(',')[1], url, ext });
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  $('#backList').addEventListener('click', () => { collect(); setDirty(changed()); renderList(); });
  $('#discard').addEventListener('click', () => {
    if (!window.confirm('Discard all unpublished changes?')) return;
    projects = JSON.parse(original); experience = JSON.parse(originalExp); site = JSON.parse(originalSite); content = JSON.parse(originalContent); pending.clear(); setDirty(false); renderList();
  });

  /* ---------------- preview (nothing goes live) ---------------- */
  function openPreview(target) {
    collect();
    try {
      localStorage.setItem('pf-preview', JSON.stringify({ projects, experience, site, content, previews: Object.fromEntries(previews), ts: Date.now() }));
    } catch (e) { toast('Preview could not be prepared — try fewer or smaller images'); return; }
    window.open(target, '_blank');
  }
  $('#ed-draft').addEventListener('click', () => {
    if (mode === 'exp') return openPreview('index.html?preview=1#experience');
    if (mode === 'site' || mode === 'content') return openPreview('index.html?preview=1');
    const p = projects[editing];
    if (p && !p.slug) p.slug = slugify(p.title);
    openPreview('project.html?preview=1#' + encodeURIComponent((p && p.slug) || ''));
  });
  $('#previewHome').addEventListener('click', () => openPreview('index.html?preview=1'));
  $('#previewBtn').addEventListener('click', () => {
    if (editing >= 0 && (mode === 'project' || mode === 'site' || mode === 'content')) return $('#ed-draft').click();
    openPreview('index.html?preview=1' + (mode === 'exp' ? '#experience' : ''));
  });

  /* ---------------- publish (one commit) ---------------- */
  $('#publish').addEventListener('click', async () => {
    collect();
    const msg = $('#saveMsg'), btn = $('#publish');
    const badX = experience.find((x) => !x.role || !x.role.trim() || !x.company || !x.company.trim());
    if (badX) { msg.className = 'msg err'; msg.textContent = 'Every role needs a job title and a company.'; return; }
    const bad = projects.find((p) => !p.title || !p.title.trim());
    if (bad) { msg.className = 'msg err'; msg.textContent = 'Every project needs a name.'; return; }
    const slugs = projects.map((p) => p.slug);
    const dup = slugs.find((s, i) => slugs.indexOf(s) !== i);
    if (dup) { msg.className = 'msg err'; msg.textContent = `Two projects use the same URL name “${dup}”. Change one.`; return; }
    btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Publishing…';
    try {
      const json = JSON.stringify(projects, null, 2) + '\n';
      const used = new Set(JSON.stringify([projects, site]).match(/"[^"]+\.(?:webp|jpg|jpeg|png|svg|gif|pdf)"/g) || []);
      const files = [];
      if (json.trim() !== JSON.stringify(JSON.parse(original), null, 2) ) files.push({ path: CFG.dataPath || 'data/projects.json', b64: b64FromUtf8(json) });
      if (JSON.stringify(content) !== originalContent) files.push({ path: CONTENT_PATH, b64: b64FromUtf8(JSON.stringify(content, null, 2) + '\n') });
      if (JSON.stringify(site) !== originalSite) files.push({ path: SITE_PATH, b64: b64FromUtf8(JSON.stringify(site, null, 2) + '\n') });
      if (JSON.stringify(experience) !== originalExp) files.push({ path: EXP_PATH, b64: b64FromUtf8(JSON.stringify(experience, null, 2) + '\n') });
      if (!files.length) { msg.className = 'msg ok'; msg.textContent = 'Nothing to publish — everything is already live.'; btn.disabled = false; return; }
      pending.forEach((b64, path) => { if (used.has('"' + path + '"')) files.push({ path, b64 }); });

      const ref = await (await gh(`${repoPath()}/git/ref/heads/${encodeURIComponent(auth.branch)}`)).json();
      const baseCommit = ref.object.sha;
      const commit = await (await gh(`${repoPath()}/git/commits/${baseCommit}`)).json();
      const tree = [];
      for (let i = 0; i < files.length; i++) {
        msg.textContent = `Uploading ${i + 1} of ${files.length}…`;
        const blob = await (await gh(`${repoPath()}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: files[i].b64, encoding: 'base64' }) })).json();
        tree.push({ path: files[i].path, mode: '100644', type: 'blob', sha: blob.sha });
      }
      const newTree = await (await gh(`${repoPath()}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: commit.tree.sha, tree }) })).json();
      const cur = editing >= 0 ? (mode === 'exp' ? experience[editing] : mode === 'site' ? { title: 'profile & links' } : mode === 'content' ? { title: 'website text' } : projects[editing]) : null;
      const label = cur ? `Update ${cur.title || cur.company}` : 'Update portfolio content';
      const newCommit = await (await gh(`${repoPath()}/git/commits`, { method: 'POST', body: JSON.stringify({ message: `${label} (via admin)`, tree: newTree.sha, parents: [baseCommit] }) })).json();
      await gh(`${repoPath()}/git/refs/heads/${encodeURIComponent(auth.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: newCommit.sha }) });

      original = JSON.stringify(projects);
      originalExp = JSON.stringify(experience);
      originalSite = JSON.stringify(site);
      originalContent = JSON.stringify(content);
      pending.clear();
      dirty = false;
      msg.className = 'msg ok'; msg.textContent = 'Published ✓ — your site updates in about a minute.';
      toast('Published ✓');
      setTimeout(() => { if (!dirty) $('#savebar').classList.add('hidden'); }, 4000);
      if (editing < 0) renderList();
    } catch (err) {
      msg.className = 'msg err'; msg.textContent = 'Publish failed: ' + err.message;
    } finally { btn.disabled = false; }
  });

  /* ---------------- start ---------------- */
  auth = loadAuth();
  if (/[?&]lock\b/.test(location.search)) { clearAuth(); auth = null; history.replaceState(null, '', location.pathname); initLogin(); }
  if (auth && auth.token) loadData().catch((e) => { toast('Please sign in again'); clearAuth(); auth = null; initLogin(); });
  else initLogin();
})();
