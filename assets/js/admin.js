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
      { id: 'hero', label: 'Heading, intro & photo', kind: 'site', groups: ['photo'], keys: ['hero'], side: true },
      { id: 'avail', label: 'Availability line', kind: 'site', groups: ['availability'] },
      { id: 'tools', label: 'Tools strip', kind: 'content', keys: ['tools'] }] },
    { id: 'work', label: 'Work', subs: [
      { id: 'projects', label: 'Selected work', kind: 'projects', keys: ['work'], part: 'work', partName: 'Selected work' },
      { id: 'screens', label: 'Screens that ship', kind: 'site', groups: ['showcase'], keys: ['screens'] },
      { id: 'process', label: 'From sketch to shipped', kind: 'content', keys: ['process'] }] },
    { id: 'about', label: 'About', subs: [
      { id: 'about-text', label: 'About text, numbers & photo', kind: 'site', groups: ['photo2'], keys: ['about'], side: true }] },
    { id: 'experience', label: 'Experience', subs: [
      { id: 'roles', label: 'Experience', kind: 'experience', keys: ['experience'], part: 'experience', partName: 'Experience' },
      { id: 'learning', label: 'Learning & recognition', kind: 'site', groups: ['recognition'] , part: 'learning', partName: 'Learning & recognition tab' }] },
    { id: 'product', label: 'Product', subs: [
      { id: 'product-text', label: 'Product management', kind: 'content', keys: ['product'], fnot: '.cycle' },
      { id: 'flow', label: 'How a feature travels', kind: 'content', keys: ['product'], fsel: '.cycle', part: 'flow' },
      { id: 'principles', label: 'Principles', kind: 'content', keys: ['principles'] }] },
    { id: 'skills', label: 'Skills', subs: [
      { id: 'skills-text', label: 'Skills', kind: 'content', keys: ['skills'] },
      { id: 'system', label: 'Design system', kind: 'content', keys: ['design-system'] }] },
    { id: 'beyond', label: 'Beyond', subs: [
      { id: 'beyond', label: 'Beyond the screen', kind: 'content', keys: ['beyond'] }] },
    { id: 'contact', label: 'Contact & more', subs: [
      { id: 'links', label: 'Contact', kind: 'site', groups: ['links', 'cv'], keys: ['contact'], part: 'contact', partName: 'Contact' },
      { id: 'faq', label: 'FAQ', kind: 'content', keys: ['faq'] },
      { id: 'testi', label: 'Testimonials', kind: 'site', groups: ['testimonials'], keys: ['testimonials'] }] }];
  let page = PAGES[0], sub = PAGES[0].subs[0];
  const KIND_TAB = { projects: 'projects', experience: 'experience', site: 'profile', content: 'content' };
  tab = KIND_TAB[sub.kind];
  function drawTabs() {
    const subKey = (x) => x.part || (x.keys && x.keys[0]) || '';
    const subOff = (x) => { const k = subKey(x); return !!k && (content.hidden || []).includes(k); };
    const pageOff = (p) => p.subs.every((x) => subOff(x));
    const OFF_I = '<svg class="t-off" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c5 0 9 4.5 10 6-.4.7-1.4 2-2.9 3.3M6.6 6.6C4.6 8 3.3 9.8 2 12c1 1.5 5 6 10 6 1.6 0 3.1-.4 4.4-1.1"/></svg>';
    $('#pageTabs').innerHTML = PAGES.map((p) => `<button type="button" role="tab" data-page="${p.id}" class="${p === page ? 'on' : ''}${pageOff(p) ? ' t-hid' : ''}" aria-selected="${p === page}" title="${pageOff(p) ? 'Every section here is hidden — this menu link is hidden on the website too' : ''}">${pageOff(p) ? OFF_I : ''}${esc(p.label)}${p.subs.some((x) => touched.has(p.id + '/' + x.id)) ? '<i class="tdot" title="Unpublished changes"></i>' : ''}</button>`).join('');
    $('#partBar').hidden = true;
    $('#subTabs').hidden = page.subs.length <= 1;
    $('#subTabs').innerHTML = page.subs.map((x) => `<button type="button" data-sub="${x.id}" class="${x === sub ? 'on' : ''}${subOff(x) ? ' t-hid' : ''}" aria-pressed="${x === sub}" title="${subOff(x) ? 'Hidden on the website' : ''}">${subOff(x) ? OFF_I : ''}${esc(x.label)}${touched.has(page.id + '/' + x.id) ? '<i class="tdot" title="Unpublished changes"></i>' : ''}</button>`).join('');
  }
  const partHead = () => { const on = !(content.hidden || []).includes(sub.part); return `<header class="wt-head part-sw"><div><small>Section</small><h3>${esc(sub.partName)}</h3></div><label class="wt-switch"><input type="checkbox" data-part-show="${esc(sub.part)}" ${on ? 'checked' : ''}><span></span>Show on website</label></header>`; };
  function placePartSwitch() {
    $$('.part-sw').forEach((x) => x.remove());
    if (!sub.part || (sub.keys && sub.keys.includes(sub.part))) return;
    if (sub.kind === 'site') { const fs = $$('#edForm fieldset[data-g]').find((f) => !f.hidden); const lg = fs && $('legend', fs); if (lg) lg.insertAdjacentHTML('afterend', partHead()); }
    else { $('#plist').insertAdjacentHTML('beforebegin', `<div class="part-sw part-list">${partHead()}</div>`); }
    markPartOff();
  }
  const OFF_NOTE = '<p class="off-note">Hidden on the website — visitors won’t see this section. Your edits are kept.</p>';
  function markPartOff() {
    $$('.is-part-off').forEach((x) => x.classList.remove('is-part-off'));
    $$('.off-note.pn').forEach((x) => x.remove());
    const sw = $('.part-sw'); if (!sw) return;
    const off = !$('[data-part-show]', sw).checked;
    const target = sub.kind === 'site' ? sw.closest('fieldset') : $('#plist');
    if (target) target.classList.toggle('is-part-off', off);
    if (off) sw.insertAdjacentHTML(sw.tagName === 'HEADER' ? 'afterend' : 'beforeend', OFF_NOTE.replace('off-note', 'off-note pn'));
  }
  function goTo(p, x) { collect(); setDirty(changed(), false); page = p; sub = x || p.subs[0]; tab = KIND_TAB[sub.kind]; renderList(); }
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
  /* every fieldset gets the same visible header (built from its legend) */
  const headFieldsets = () => {
    const sets = $$('#edForm > fieldset');
    sets.forEach((f, n) => {
      const lg = $(':scope > legend', f); if (!lg) return;
      let h = $(':scope > .fs-head', f);
      if (!h) { h = document.createElement('div'); h.className = 'fs-head'; lg.after(h); }
      const num = $('#edLayout').classList.contains('two') ? ' ' + String(n + 1).padStart(2, '0') : '';
      h.innerHTML = `<small>Section${num}</small><h3>${esc(lg.textContent)}</h3><i class="fs-tog" aria-hidden="true"></i>`;
      if (!f.dataset.colInit && $('#edLayout').classList.contains('two')) { f.dataset.colInit = '1'; if (n > 0 && matchMedia('(max-width:760px)').matches) f.classList.add('fs-shut'); }
    });
  };
  new MutationObserver(() => headFieldsets()).observe($('#edForm'), { childList: true });
  $('#edForm').addEventListener('click', (e) => { const h = e.target.closest('.fs-head'); if (!h || !matchMedia('(max-width:760px)').matches || !$('#edLayout').classList.contains('two')) return; h.parentElement.classList.toggle('fs-shut'); });
  new MutationObserver(() => headFieldsets()).observe($('#edLayout'), { attributes: true, attributeFilter: ['class'] });
  /* our own confirm popup (instead of the browser's) — resolves true / false */
  function ask({ title, text = '', ok = 'OK', cancel = 'Cancel', tone = '' }) {
    const d = $('#askDlg');
    if (!d || !d.showModal) return Promise.resolve(window.confirm(title + (text ? '\n\n' + text : '')));
    $('.ask-t', d).textContent = title; $('.ask-p', d).textContent = text; $('.ask-p', d).hidden = !text;
    const yes = $('[data-ask="ok"]', d), no = $('[data-ask="no"]', d);
    yes.textContent = ok; no.textContent = cancel; d.dataset.tone = tone;
    d.showModal(); no.focus();
    return new Promise((res) => {
      const done = (v) => { d.removeEventListener('click', onClick); d.removeEventListener('cancel', onCancel); d.classList.add('closing'); setTimeout(() => { d.classList.remove('closing'); d.close(); }, 140); res(v); };
      const onClick = (e) => { if (e.target === yes) done(true); else if (e.target === no || e.target === d) done(false); };
      const onCancel = (e) => { e.preventDefault(); done(false); };
      d.addEventListener('click', onClick); d.addEventListener('cancel', onCancel);
    });
  }
  const show = (id) => { ['v-login', 'v-list', 'v-edit'].forEach((v) => $('#' + v).classList.toggle('hidden', v !== id)); $('#nav').hidden = id === 'v-login'; };
  const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-+|-+$/g, '') || 'project-' + Date.now().toString(36);
  const imgURL = (path) => previews.get(path) || path;
  const b64FromUtf8 = (str) => { const bytes = new TextEncoder().encode(str); let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); }); return btoa(bin); };
  const touched = new Set();   // "page/sub" ids with unpublished edits, shown as dots on the tabs
  /* ---- saving: every change is checked against what's live; real changes save on their own a moment later ---- */
  let saving = false, saveAgain = false, saveTimer = 0, checkTimer = 0, hideTimer = 0;
  const tabsReady = () => $('#pageTabs').children.length && drawTabs();
  function status(state, text) {
    const bar = $('#savebar'), m = $('#saveMsg');
    clearTimeout(hideTimer);
    if (!state) { bar.classList.add('hidden'); document.body.classList.remove('has-savebar'); return; }
    bar.classList.remove('hidden'); bar.dataset.state = state;
    m.textContent = text || { pending: 'You have unsaved changes', saving: 'Saving…', ok: 'Saved ✓ — live on your site in about a minute' }[state];
    $('#saveDiscard').hidden = !['pending', 'hint', 'err'].includes(state);
    document.body.classList.add('has-savebar');
    $('#saveRetry').hidden = !['pending', 'err', 'conflict'].includes(state);
    $('#saveRetry').textContent = state === 'conflict' ? 'Reload' : state === 'err' ? 'Try again' : 'Save';
    $('#saveRetry').classList.toggle('primary', state === 'pending');
    if (state === 'ok') hideTimer = setTimeout(() => { if (!dirty && !saving) { bar.classList.add('hidden'); document.body.classList.remove('has-savebar'); } }, 3500);
  }
  function recheck() {
    collect();
    dirty = changed();
    clearTimeout(saveTimer);
    if (!dirty) { touched.clear(); if (!saving) status(''); }
    else if (!saving) status('pending');
    tabsReady();
  }
  function setDirty(v, mark = true) {
    if (v) { if (mark && page && sub) touched.add(page.id + '/' + sub.id); clearTimeout(checkTimer); checkTimer = setTimeout(recheck, 250); tabsReady(); return; }
    dirty = false; touched.clear(); clearTimeout(saveTimer); clearTimeout(checkTimer); if (!saving) status(''); tabsReady();
  }
  addEventListener('beforeunload', (e) => { if (dirty || saving) { e.preventDefault(); e.returnValue = ''; } });

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
  if ($('#logout')) $('#logout').addEventListener('click', async () => { if ((dirty || saving) && !(await ask({ title: 'Lock the editor?', text: 'You have changes that aren’t saved yet. Lock anyway and lose them?', ok: 'Lock anyway', tone: 'danger' }))) return; clearAuth(); auth = null; setDirty(false); initLogin(); });

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
    normalize();
    original = JSON.stringify(projects);
    originalExp = JSON.stringify(experience);
    originalSite = JSON.stringify(site);
    originalContent = JSON.stringify(content);
    pending.clear();
    setDirty(false);
    renderList();
  }

  /* ---------------- list ---------------- */
  const IC = {
    grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    hide: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c5 0 9 4.5 10 6-.4.7-1.4 2-2.9 3.3M6.6 6.6C4.6 8 3.3 9.8 2 12c1 1.5 5 6 10 6 1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    show: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c1-1.5 5-6 10-6s9 4.5 10 6c-1 1.5-5 6-10 6S3 13.5 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>',
    del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  const iconBtn = (a, i, icon, label, cls = '', dis = false) => `<button class="ib ico ${cls}" type="button" data-a="${a}" data-i="${i}" aria-label="${esc(label)}" title="${esc(label)}"${dis ? ' disabled' : ''}>${icon}</button>`;
  const FEAT_MAX = 5;
  /* featured projects in their home-page order (featuredRank, then list order) */
  const featList = () => projects.map((p, i) => ({ p, i })).filter((x) => x.p.featured).sort((a, b) => (a.p.featuredRank || 99) - (b.p.featuredRank || 99) || a.i - b.i).map((x) => x.p);
  const rerank = (list) => list.forEach((p, n) => { p.featuredRank = n + 1; });
  /* featured projects always sit first, in their home-page order; the rest keep their order after them */
  function normalize() {
    const f = featList(); rerank(f);
    const rest = projects.filter((p) => !p.featured);
    rest.forEach((p) => { delete p.featuredRank; });
    projects.splice(0, projects.length, ...f, ...rest);
  }
  /* the list order is the order everywhere: the first 5 shown projects are the home page, numbered 1–5; the rest follow 6, 7, 8 … */
  function applyOrder() {
    let n = 0;
    projects.forEach((p) => { if (p.published !== false && n < FEAT_MAX) { p.featured = true; p.featuredRank = ++n; } else { if (p.featured !== undefined) p.featured = false; delete p.featuredRank; } });
  }
  function renderList() {
    editing = -1;
    tab = KIND_TAB[sub.kind];
    drawTabs();
    $$('.part-sw').forEach((x) => x.remove());
    if (tab === 'profile') return openSiteEditor();
    if (tab === 'content') return openContentEditor();
    /* list pages whose section text lives on the same tab: the text (with the section switch) sits above the list */
    const tp = $('#tabPanel'), comboList = !!sub.keys;
    const keep = comboList && !tp.hidden && tp.dataset.sub === sub.id && $('#edForm', tp);
    if (!keep) { if (!tp.hidden && $('#edForm [data-ckey]')) collect(); unembed(); tp.dataset.sub = ''; }
    show('v-list');
    if (comboList && !keep) {
      tp.dataset.sub = sub.id; $('#listHint').before(tp); tp.hidden = false; tp.appendChild($('#edForm'));
      $('#edSide').hidden = true; $('#edLayout').classList.remove('two'); $('#edForm').oninput = null; $('#edForm').onchange = null;
      $('#edForm').innerHTML = ''; openContentEditor($('#edForm')).then(syncPartOff);
    }
    $('#newProject').textContent = tab === 'projects' ? '+ New project' : '+ Add role';
    $('#list-title').innerHTML = `${esc(page.label)} <em class="serif">· ${esc(sub.label)}</em>`;
    $('#listHint').innerHTML = '<span>' + (tab === 'projects' ? 'Drag projects by the handle to order them. The first 5 (in gold) are on the home page; every project is on the All work page. Then press <b>Save</b>.' : 'Use the arrows to set the order. The eye hides a role but keeps it saved. Press <b>Save</b> when you’re done.') + '</span>';
    placePartSwitch();
    const el = $('#plist');
    if (tab === 'experience') {
      if (!experience.length) { el.innerHTML = '<div class="card-a glass"><p class="muted">No roles yet. Press <b>+ Add role</b>.</p></div>'; return; }
      el.innerHTML = experience.map((x, i) => `<div class="prow glass">
        <span class="t"><b>${esc(x.role || 'Untitled role')}</b><small>${esc(x.company || '')}${x.dates ? ' · ' + esc(x.dates) : ''}</small></span>
        ${x.visible !== false ? '' : '<span class="badge-d">Hidden</span>'}
        <span class="acts">
          ${iconBtn('up', i, IC.up, 'Move up', '', i === 0)}${iconBtn('down', i, IC.down, 'Move down', '', i === experience.length - 1)}
          <span class="acts-sep"></span>
          ${x.visible !== false ? iconBtn('toggle', i, IC.hide, 'Hide from the website', 'hide') : iconBtn('toggle', i, IC.show, 'Show on the website', 'show')}
          ${iconBtn('edit', i, IC.edit, 'Edit', 'edit')}${iconBtn('del', i, IC.del, 'Delete', 'danger')}
        </span></div>`).join('');
      return;
    }
    if (!projects.length) { el.innerHTML = '<div class="card-a glass"><p class="muted">No projects yet. Press <b>+ New project</b> to add your first one.</p></div>'; return; }
    const feats = featList();
    const icn = (p) => { const tint = (p.cover && p.cover.tint) || '#2B3A8F'; return `<span class="ic" style="background:linear-gradient(140deg,${esc(tint)},#0E1119)">${p.icon ? `<img src="${esc(imgURL(p.icon))}" alt="">` : esc((p.title || '?').charAt(0))}</span>`; };
    const nf = feats.length;
    applyOrder();
    let num = 0, lastFeat = -1;
    projects.forEach((p, k) => { if (p.featured) lastFeat = k; });
    el.innerHTML = projects.map((p, i) => {
      const shown = p.published !== false, no = shown ? ++num : 0;
      return `<div class="prow glass${shown ? '' : ' is-hidden'}${p.featured ? ' is-feat' : ''}" data-row-i="${i}">
        <button type="button" class="grip" data-grip="${i}" aria-label="Drag to reorder ${esc(p.title || 'project')}" title="Drag to reorder">${IC.grip}</button>
        <span class="pno" title="${p.featured ? 'On the home page' : shown ? 'On the All work page' : 'Hidden'}">${no || '–'}</span>
        <span class="pthumb">${coverMini({ title: p.title, tint: p.cover && p.cover.tint, dev: projDev(p), shot: projShot(p, projDev(p)), style: p.cardStyle, idx: i })}</span>
        ${icn(p)}
        <span class="t"><b>${esc(p.title || 'Untitled')}</b><small><span class="lb lb-${p.type || 'mobile'}">${KIND_LABEL[p.type || 'mobile']}</span>${p.category ? ` <span class="pcat">${esc(p.category.split('·')[0].trim())}</span>` : ''}</small></span>
        <span class="bdgs">${shown ? '' : '<span class="badge-d">Hidden</span>'}</span>
        <span class="acts">
          ${shown ? iconBtn('toggle', i, IC.hide, 'Hide from the website', 'hide') : iconBtn('toggle', i, IC.show, 'Show on the website', 'show')}
          ${iconBtn('edit', i, IC.edit, 'Edit', 'edit')}${iconBtn('del', i, IC.del, 'Delete', 'danger')}
        </span></div>${i === lastFeat && lastFeat < projects.length - 1 ? '<div class="feat-split"><span>The rest — shown on the All work page</span></div>' : ''}`;
    }).join('');
  }
  /* drag a row by its handle (mouse or touch); arrow keys on the handle move it too */
  const plist = $('#plist');
  const commitOrder = () => {
    const order = $$('.prow[data-row-i]', plist).map((r) => projects[+r.dataset.rowI]);
    if (order.length !== projects.length) return;
    projects.splice(0, projects.length, ...order);
    applyOrder(); setDirty(changed()); renderList();
  };
  let drag = null;
  plist.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('[data-grip]'); if (!g || tab !== 'projects') return;
    e.preventDefault();
    const row = g.closest('.prow');
    drag = { row, id: e.pointerId };
    row.classList.add('dragging'); plist.classList.add('is-dragging');
    g.setPointerCapture(e.pointerId);
  });
  plist.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const rows = $$('.prow[data-row-i]', plist).filter((r) => r !== drag.row);
    const after = rows.find((r) => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
    if (after) { if (drag.row.nextElementSibling !== after) plist.insertBefore(drag.row, after); }
    else plist.appendChild(drag.row);
    $$('.feat-split', plist).forEach((x) => x.remove());
    const r = drag.row.getBoundingClientRect();
    if (e.clientY < 90) scrollBy(0, -12); else if (e.clientY > innerHeight - 110) scrollBy(0, 12);
    void r;
  });
  const endDrag = (e) => { if (!drag || e.pointerId !== drag.id) return; drag.row.classList.remove('dragging'); plist.classList.remove('is-dragging'); drag = null; commitOrder(); };
  plist.addEventListener('pointerup', endDrag);
  plist.addEventListener('pointercancel', endDrag);
  plist.addEventListener('keydown', (e) => {
    const g = e.target.closest('[data-grip]'); if (!g || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const i = +g.dataset.grip, j = e.key === 'ArrowUp' ? i - 1 : i + 1;
    if (j < 0 || j >= projects.length) return;
    [projects[i], projects[j]] = [projects[j], projects[i]];
    applyOrder(); setDirty(changed()); renderList();
    const ng = $(`[data-grip="${j}"]`, plist); if (ng) ng.focus();
  });
  $('#plist').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    if (b.dataset.a === 'new') { $('#newProject').click(); return; }
    const i = parseInt(b.dataset.i, 10), a = b.dataset.a;
    const arr = tab === 'projects' ? projects : experience;
    const flag = tab === 'projects' ? 'published' : 'visible';
    if (a === 'edit') return tab === 'projects' ? openEditor(i) : openExpEditor(i);
    if (a === 'up' && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    if (a === 'down' && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    if (a === 'toggle') arr[i][flag] = arr[i][flag] === false;
    if (a === 'feat' || a === 'fleft' || a === 'fright') {
      const list = featList(), p = projects[i], n = list.indexOf(p);
      if (a === 'feat') {
        if (n > -1) { list.splice(n, 1); p.featured = false; delete p.featuredRank; }
        else if (list.length >= FEAT_MAX) { status('hint', `The home page shows ${FEAT_MAX}. Remove one first.`); return; }
        else { p.featured = true; list.push(p); }
      }
      if (a === 'fleft' && n > 0) [list[n - 1], list[n]] = [list[n], list[n - 1]];
      if (a === 'fright' && n > -1 && n < list.length - 1) [list[n + 1], list[n]] = [list[n], list[n + 1]];
      rerank(list);
    }
    if (a === 'del') { if (!(await ask({ title: `Delete “${arr[i].title || arr[i].role}”?`, text: 'It’s removed from the website after you press Save.', ok: 'Delete', tone: 'danger' }))) return; arr.splice(i, 1); }
    setDirty(changed());
    renderList();
  });
  function syncPartOff() {
    if (!sub.part) return;
    const sw = $(`[data-sec-show="${sub.part}"]`); if (!sw) return;
    const off = !sw.checked;
    $('#plist').classList.toggle('is-part-off', off && !$('#plist').hidden);
    $$('#edForm > fieldset[data-g]').forEach((f) => { if (!f.hidden) f.classList.toggle('is-part-off', off); });
    drawTabs();
  }
  document.addEventListener('change', (e) => { if (e.target.matches && e.target.matches('[data-sec-show]')) { const k = e.target.dataset.secShow; content.hidden = (content.hidden || []).filter((x) => x !== k).concat(e.target.checked ? [] : [k]); syncPartOff(); drawTabs(); } });
  document.addEventListener('change', (e) => {
    const c = e.target.closest && e.target.closest('[data-part-show]'); if (!c) return;
    const k = c.dataset.partShow;
    content.hidden = (content.hidden || []).filter((x) => x !== k).concat(c.checked ? [] : [k]);
    setDirty(changed()); markPartOff(); drawTabs();
  });
  $('#pageTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (!b) return; const p = PAGES.find((x) => x.id === b.dataset.page); if (p === page && editing < 0 && tab !== 'profile' && tab !== 'content') return; goTo(p); });
  $('#subTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-sub]'); if (!b) return; const x = page.subs.find((y) => y.id === b.dataset.sub); if (x === sub && (tab === 'profile' || tab === 'content')) return; goTo(page, x); });
  $('#newProject').addEventListener('click', () => {
    if (tab === 'experience') {
      experience.unshift({ id: 'role-' + Date.now().toString(36), visible: true, role: '', company: '', location: '', dates: '', type: 'Full-time', summary: '', highlights: [] });
      return openExpEditor(0, true);
    }
    projects.push({ slug: '', title: '', headline: '', headlineAccent: '', tagline: '', category: '', platform: 'Mobile App', type: 'mobile', year: '', live: false, liveUrl: '', status: '', published: true, summary: '', cover: { image: '', ghost: '', tint: '#2B3A8F' }, company: '', role: '', team: '', timeline: '', platforms: '', tags: [], overview: '', problem: '', responsibilities: { product: [], design: [] }, process: [], challenges: [], gallery: { before: [], after: [] }, results: [], learnings: '', icon: '', screens: [], tabletScreens: [], webScreens: [], devices: { mobile: true, tablet: false, desktop: false }, cardDevice: 'auto' });
    openEditor(projects.length - 1, true);
  });

  /* ---------------- editor ---------------- */
  const F = (label, key, val, opts = {}) => {
    const v = esc(val == null ? '' : val);
    const hint = opts.hint ? `<small>${opts.hint}</small>` : '';
    if (opts.area) return `<label class="f">${label}<textarea data-k="${key}" rows="${opts.rows || 4}">${v}</textarea>${hint}</label>`;
    if (opts.select) return `<label class="f">${label}<select data-k="${key}">${opts.select.map(([ov, ol]) => `<option value="${ov}" ${String(val) === ov ? 'selected' : ''}>${ol}</option>`).join('')}</select>${hint}</label>`;
    const inp = `<input data-k="${key}" type="${opts.type || 'text'}" value="${v}" ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''}>`;
    const ic = opts.icon && window.ICONS && window.ICONS[opts.icon];
    if (ic) return `<label class="f">${label}<span class="f-ico">${ic.full ? `<svg viewBox="${ic.fvb}" aria-hidden="true">${ic.full}</svg>` : `<svg viewBox="${ic.vb}" aria-hidden="true" style="color:${ic.c === 'ink' ? 'var(--ink)' : ic.c}">${ic.p}</svg>`}${inp}</span>${hint}</label>`;
    return `<label class="f">${label}${inp}${hint}</label>`;
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
  /* app demo rows: screen + taps + loading */
  function demoRow(st = {}, p = projects[editing] || {}) {
    const img = st.img || (p.screens || [])[st.s] || '';
    const taps = st.taps || (st.tap ? [st.tap] : []);
    return `<div class="demo-row" data-demo-row data-img="${esc(img)}" data-taps='${esc(JSON.stringify(taps))}'>
      <div class="dr-shot" data-dr-shot title="Click where the tap happens">${img ? `<img src="${esc(imgURL(img))}" alt="">` : '<em>Pick a screen</em>'}${taps.map((t, n) => `<i class="dr-dot" data-dr-dot="${n}" style="left:${t[0] * 100}%;top:${t[1] * 100}%">${n + 1}</i>`).join('')}</div>
      <div class="dr-f">
        <label class="f">Screen<select data-dr="img"></select></label>
        <label class="f">Step name<input data-dr="label" value="${esc(st.label || '')}" placeholder="Log in"></label>
        <label class="f">Note (optional)<input data-dr="note" value="${esc(st.note || '')}" placeholder="Email or Google, Facebook, Apple"></label>
        <label class="f">Loading first<select data-dr="loading">${[['0', 'No'], ['900', 'Short'], ['1400', 'Long']].map(([v, l]) => `<option value="${v}"${String(st.loading || 0) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="dr-acts"><button type="button" class="ib" data-dr-mv="-1" aria-label="Move up">↑</button><button type="button" class="ib" data-dr-mv="1" aria-label="Move down">↓</button><button type="button" class="ib" data-dr-clear>Clear taps</button><button type="button" class="ib danger" data-dr-del>Remove</button></div>
      </div></div>`;
  }
  const demoShots = () => $$('#edForm [data-imgs="screens"] .im').map((im) => im.dataset.path).filter(Boolean);
  function demoSync() {
    const shots = demoShots();
    $$('#edForm [data-demo-row]').forEach((row, n) => {
      const sel = $('[data-dr="img"]', row), cur = row.dataset.img;
      const html = (cur && !shots.includes(cur) ? [cur] : []).concat(shots).map((s) => `<option value="${esc(s)}"${s === cur ? ' selected' : ''}>Screen ${shots.indexOf(s) + 1 || '–'} · ${esc(s.split('/').pop().replace(/^[a-z0-9]+-/, '').slice(0, 26))}</option>`).join('') || '<option value="">Upload phone screens first</option>';
      if (sel.dataset.h !== html) { sel.dataset.h = html; sel.innerHTML = html; }
    });
  }
  function demoDraw(row) {
    const img = row.dataset.img, taps = JSON.parse(row.dataset.taps || '[]');
    $('[data-dr-shot]', row).innerHTML = (img ? `<img src="${esc(imgURL(img))}" alt="">` : '<em>Pick a screen</em>') + taps.map((t, n) => `<i class="dr-dot" data-dr-dot="${n}" style="left:${t[0] * 100}%;top:${t[1] * 100}%">${n + 1}</i>`).join('');
  }
  function repRow(kind, a = {}) {
    if (kind === 'process') return `<div class="rep-item" data-row><label class="f">Step<input data-r="title" value="${esc(a.title || '')}"></label><label class="f">Description<textarea data-r="desc">${esc(a.desc || '')}</textarea></label><button class="ib danger" type="button" data-del-row aria-label="Remove">✕</button></div>`;
    if (kind === 'challenges') return `<div class="rep-item two" data-row><label class="f">Challenge<textarea data-r="challenge">${esc(a.challenge || '')}</textarea></label><label class="f">Solution<textarea data-r="solution">${esc(a.solution || '')}</textarea></label><button class="ib danger" type="button" data-del-row aria-label="Remove">✕</button></div>`;
    if (kind === 'testimonials') return `<div class="rep-item" data-row><label class="f">Quote<textarea data-r="quote" placeholder="What they said about working with you">${esc(a.quote || '')}</textarea></label><div style="display:flex;flex-direction:column;gap:12px"><label class="f">Name<input data-r="name" value="${esc(a.name || '')}" placeholder="Full name"></label><label class="f">Role &amp; company<input data-r="role" value="${esc(a.role || '')}" placeholder="CTO, Homyt"></label></div><button class="ib danger" type="button" data-del-row aria-label="Remove">✕</button></div>`;
    if (kind === 'recognition') {
      const K = [['certificate', 'Certificate'], ['education', 'Degree / education'], ['award', 'Hackathon, award or fellowship'], ['leadership', 'Leadership & community']];
      const KL = { certificate: 'Certificate', education: 'Degree', award: 'Award', leadership: 'Leadership' };
      const kk = a.kind || 'certificate', open = !a.title;
      const head = `<div class="rr-h" data-rec-toggle role="button" tabindex="0" aria-expanded="${open}"><span class="rr-mini"${a.image ? ` style="background-image:url('${esc(imgURL(a.image))}')"` : ''}></span><span class="rr-k k-${kk}">${KL[kk]}</span><span class="rr-ht"><b>${esc(a.title || 'New item')}</b><small>${esc([a.org, a.year].filter(Boolean).join(' · '))}</small></span><button class="rr-del" type="button" data-del-row aria-label="Delete this item" title="Delete"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5"/></svg></button><svg class="rr-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></div>`;
      return `<div class="rep-item rec-row${open ? ' open' : ''}" data-row>${head}<div class="rr-b"><div class="g2"><label class="f">Type<select data-r="kind">${K.map(([v, l]) => `<option value="${v}"${(a.kind || 'certificate') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label><label class="f">Year<input data-r="year" value="${esc(a.year || '')}" placeholder="2024 or 2022 — 2024"></label></div><label class="f">Title<input data-r="title" value="${esc(a.title || '')}" placeholder="Google UX Design Professional Certificate"></label><div class="g2"><label class="f">Organisation · place<input data-r="org" value="${esc(a.org || '')}" placeholder="Google · Online"></label><label class="f">Link (optional)<input data-r="link" value="${esc(a.link || '')}" placeholder="https://… certificate link"></label></div><div class="f">Certificate image (optional)<div class="rec-img"><input type="hidden" data-r="image" value="${esc(a.image || '')}"><span class="rec-th"${a.image ? ` style="background-image:url('${esc(imgURL(a.image))}')"` : ''}>${a.image ? '' : 'No image'}</span><span class="rec-acts"><label class="btn btn-ghost btn-sm">${a.image ? 'Change' : '+ Upload'}<input type="file" accept="image/*" class="rec-file" hidden></label>${a.image ? '<button type="button" class="ib danger" data-rec-rm>Remove</button>' : ''}</span></div><small class="hint" style="margin:0">Shown as a small preview on the site; visitors can click to see it full size.</small></div><label class="f">Short note (optional)<input data-r="note" value="${esc(a.note || '')}" placeholder="Selected from 300+ applicants"></label></div></div>`;
    }
    if (kind === 'links') { const t = a.type || (/apps\.apple|itunes\.apple/.test(a.url || '') ? 'appstore' : /play\.google/.test(a.url || '') ? 'googleplay' : 'web'); return `<div class="rep-item link-row" data-row><label class="f">Button<select data-r="type">${[['appstore', 'App Store'], ['googleplay', 'Google Play'], ['web', 'Website']].map(([v, l]) => `<option value="${v}"${t === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label><label class="f">Link<input data-r="url" value="${esc(a.url || '')}" placeholder="https://…"></label><button class="ib danger" type="button" data-del-row>Remove</button></div>`; }
    if (kind === 'results') return `<div class="rep-item" data-row><label class="f">Value<input data-r="value" value="${esc(a.value || '')}" placeholder="+35%"></label><label class="f">What it measures<input data-r="label" value="${esc(a.label || '')}" placeholder="Weekly active users"></label><button class="ib danger" type="button" data-del-row aria-label="Remove">✕</button></div>`;
    return '';
  }
  const rep = (kind, list, addLabel) => `<div class="rep" data-rep="${kind}">${(list || []).map((a) => repRow(kind, a)).join('')}</div><button class="btn btn-ghost btn-sm" type="button" data-add-row="${kind}" style="align-self:flex-start">+ ${addLabel}</button>`;

  /* live card + section nav beside the project editor */
  const KIND_LABEL = { mobile: 'Mobile app', web: 'Website', both: 'Mobile + Website' };
  /* a small copy of the coloured project card on the website: name, one device, soft orbs */
  function coverMini(o) {
    const st = ['a', 'b', 'c'].includes(o.style) ? o.style : 'abc'[(o.idx || 0) % 3];
    const web = o.dev === 'desktop' || o.dev === 'tablet';
    const shot = o.shot ? `<img src="${esc(imgURL(o.shot))}" alt="">` : '';
    return `<span class="mc st-${web ? 'w' : st}" style="--tint:${esc(o.tint || '#2B3A8F')};--n:${Math.max(4, (o.title || '').length)}"><i class="mc-o o1"></i><i class="mc-o o2"></i><b class="mc-g">${esc(o.title || '')}</b><span class="mc-d ${web ? 'lap' : 'ph'}">${shot || '<em></em>'}</span></span>`;
  }
  const projDev = (p) => { const t = p.type || 'mobile', has = (k) => (p[k] || []).length; const want = p.cardDevice; if (want && want !== 'auto') return want; return t === 'web' ? 'desktop' : has('screens') || t === 'mobile' ? 'mobile' : 'desktop'; };
  const projShot = (p, dev) => (({ mobile: p.screens, tablet: p.tabletScreens, desktop: p.webScreens })[dev] || [])[0] || '';
  const CATS = ['Social', 'Entertainment', 'Fintech', 'Utility', 'Careers', 'Food & drink', 'Health', 'E-commerce', 'Education', 'Travel', 'Productivity', 'Local business'];
  function setupSide(isProject) {
    const side = $('#edSide'), lay = $('#edLayout');
    side.hidden = !isProject; lay.classList.toggle('two', !!isProject);
    if (!isProject) { side.innerHTML = ''; return; }
    const fsets = $$('#edForm > fieldset');
    fsets.forEach((f, n) => { f.id = 'ed-s-' + n; });
    side.innerHTML = `<div class="ed-prev"><div class="ep-stage"><div class="ep-lbls"></div><div class="ep-dev"></div></div><div class="ep-head"><span class="ep-logo"></span><span class="ep-tx"><b class="ep-t"></b><small class="ep-l"></small></span></div><div class="ep-flags"><span class="ep-st"></span></div></div>
      <nav class="ed-nav" aria-label="Editor sections">${fsets.map((f, n) => `<a href="#ed-s-${n}" data-n="${n}"${n ? '' : ' class="on"'}><span>${String(n + 1).padStart(2, '0')}</span>${esc($('legend', f).textContent)}</a>`).join('')}</nav>`;
    const val = (k) => { const el = $(`#edForm [data-k="${k}"]`); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; };
    const first = (k) => { const im = $(`#edForm [data-imgs="${k}"] .im`); return im && im.dataset.path; };
    const draw = () => {
      const tint = val('cover.tint') || '#2B3A8F', title = val('title') || 'Untitled project', type = val('type') || 'mobile';
      const icon = first('icon');
      const on = (d) => { const c = $(`#edForm [data-dev="${d}"]`); return c ? c.checked : false; };
      const want = val('cardDevice');
      const dev = want && want !== 'auto' && on(want) ? want : type === 'mobile' ? (on('mobile') ? 'mobile' : on('tablet') ? 'tablet' : 'desktop') : (on('desktop') ? 'desktop' : on('tablet') ? 'tablet' : 'mobile');
      const shot = first({ mobile: 'screens', tablet: 'tabletScreens', desktop: 'webScreens' }[dev]);
      $('.ep-stage', side).style.setProperty('--tint', tint);
      $('.ep-dev', side).className = 'ep-dev';
      $('.ep-dev', side).innerHTML = coverMini({ title, tint, dev, shot, style: val('cardStyle'), idx: editing });
      const cat = (val('category') || '').split('·')[0].trim();
      $('.ep-lbls', side).innerHTML = `<span class="lb lb-${type}">${KIND_LABEL[type] || 'Mobile app'}</span>${cat ? `<span class="lb lb-cat">${esc(cat)}</span>` : ''}`;
      $('.ep-logo', side).innerHTML = icon ? `<img src="${esc(imgURL(icon))}" alt="">` : esc(title.charAt(0));
      $('.ep-logo', side).style.setProperty('--tint', tint);
      $('.ep-t', side).textContent = title;
      $('.ep-l', side).textContent = val('tagline') || val('category');
      const stv = val('status');
      $('.ep-flags', side).innerHTML = `${stv ? `<span class="ep-st">${esc(stv)}</span>` : ''}<span class="badge-d pub ${val('published') ? 'on' : ''}">${val('published') ? '✓ Published' : 'Hidden'}</span>${(projects[editing] || {}).featured ? `<span class="badge-d feat">★ Home #${projects[editing].featuredRank}</span>` : ''}`;

    };
    /* which sections still need something */
    const blank = (k) => { const v = val(k); return !v || /^\[[^\]]*\]$/.test(v); };
    const NEED = [
      () => [['tagline', 'one-liner'], ['category', 'kind'], ['summary', 'summary']].filter(([k]) => blank(k)).map(([, l]) => l),
      () => [],
      () => val('status') === 'Live' && !$$('#edForm [data-rep="links"] [data-r="url"]').some((i) => i.value.trim()) ? ['a link — it’s marked Live'] : [],
      () => (first('screens') || first('webScreens') || first('tabletScreens') ? [] : ['screens']).concat(first('icon') ? [] : ['app icon']),
      () => [],
      () => [['role', 'role'], ['timeline', 'timeline']].filter(([k]) => blank(k)).map(([, l]) => l),
      () => [['overview', 'overview'], ['problem', 'problem']].filter(([k]) => blank(k)).map(([, l]) => l),
      () => $$('#edForm [data-rep="process"] [data-row]').length ? [] : ['at least one step'],
      () => $$('#edForm [data-rep="challenges"] [data-row]').length ? [] : ['at least one challenge']
    ];
    const marks = () => { $$('.ed-nav a', side).forEach((a, n) => { const miss = NEED[n] ? NEED[n]() : []; a.classList.toggle('todo', miss.length > 0); a.title = miss.length ? 'Missing: ' + miss.join(', ') : ''; }); };
    const drawAll = () => { draw(); marks(); };
    drawAll();
    const form = $('#edForm');
    form.oninput = drawAll; form.onchange = drawAll;
    new MutationObserver(drawAll).observe(form, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-path'] });
    $$('.ed-nav a', side).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); const f = $(a.getAttribute('href')); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) $$('.ed-nav a', side).forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id)); }), { rootMargin: '-30% 0px -60% 0px' });
    fsets.forEach((f) => io.observe(f));
  }

  function openEditor(i, isNew) {
    unembed();
    editing = i; mode = 'project';
    const p = projects[i];
    show('v-edit'); $('#backList').textContent = '← All projects';
    $('#ed-title').innerHTML = isNew ? 'New <em class="serif">project</em>' : `Edit <em class="serif">${esc(p.title || 'project')}</em>`;
    $('#ed-draft').textContent = 'Preview changes ↗';
    const r = p.responsibilities || {};
    const g = p.gallery || {};
    const devs = (p.devices && (p.devices.mobile || p.devices.tablet || p.devices.desktop)) ? p.devices : { mobile: (p.type || 'mobile') !== 'web' || !!(p.screens || []).length, tablet: !!(p.tabletScreens || []).length, desktop: (p.type || 'mobile') !== 'mobile' };
    $('#edForm').innerHTML = `
      <fieldset><legend>Basics</legend>
        <div class="g2">${F('Project name *', 'title', p.title)}${F('URL name (slug)', 'slug', p.slug, { hint: 'Auto-filled from the name. Used in the link: project.html#slug' })}</div>
        <div class="g2">${F('What is it', 'type', p.type || 'mobile', { select: [['mobile', 'Mobile app'], ['web', 'Website'], ['both', 'Mobile + Website']] })}<label class="f">Kind<input data-k="category" list="catList" value="${esc(p.category || '')}" placeholder="Social · Series platform"><datalist id="catList">${CATS.map((c) => `<option value="${c}">`).join('')}</datalist><small>Pick one or type your own. The first word shows on the card.</small></label></div>
        <div class="g2">${F('Status', 'status', STATUSES.some(([v]) => v === (p.status || '')) ? (p.status || '') : (p.live ? 'Live' : ''), { select: STATUSES })}<div style="display:flex;flex-direction:column;justify-content:center">${C('Show on the website', 'published', p.published !== false)}</div></div>
        <div class="where-pair">
          <div class="where"><span class="where-tag">On the project card</span>${F('One-liner', 'tagline', p.tagline, { ph: 'A series-based content app', hint: 'A few words under the name on the home page and All work.' })}</div>
          <div class="where"><span class="where-tag">At the top of the case study</span>${F('Summary', 'summary', p.summary, { area: true, rows: 3, hint: 'The idea in two or three sentences, under the project name.' })}</div>
        </div>
      </fieldset>

      <fieldset><legend>Card &amp; cover</legend>
        <div class="g2">${F('Accent colour', 'cover.tint', (p.cover && p.cover.tint) || '#2B3A8F', { type: 'color', hint: 'The card colour and the glow on the case study.' })}${F('Card style', 'cardStyle', p.cardStyle || 'auto', { select: [['auto', 'Automatic'], ['a', 'Phone in the middle'], ['b', 'Phone tilted'], ['c', 'Phone in 3D']] })}</div>
        <div class="g2">${F('Card shows', 'cardDevice', p.cardDevice || 'auto', { select: [['auto', 'Automatic (best fit)'], ['mobile', 'Phone'], ['tablet', 'Tablet'], ['desktop', 'Laptop']] })}${F('Case study background', 'scene', p.scene || 'auto', { select: (window.Scenes ? window.Scenes.list : [['auto', 'Automatic']]), hint: 'Moves behind the devices at the top of the case study.' })}</div>
        <div class="f">Cover image (optional — wide, replaces the devices on the case study)</div>${imgList('cover.image', p.cover && p.cover.image ? [p.cover.image] : [], 'wide', false, false)}
      </fieldset>

      <fieldset><legend>Live links</legend>
        <p class="hint">If the app or website is live, add where people can open it. Pick App Store, Google Play or Website — visitors see that name, not the link itself.</p>
        ${rep('links', (p.links && p.links.length) ? p.links : (p.liveUrl ? [{ type: 'web', url: p.liveUrl }] : []), 'Add a link')}
      </fieldset>

      <fieldset><legend>Devices &amp; screens</legend>
        <p class="hint">Tick every device this project was designed for, then upload its screens — you can pick many at once and drag them into order. Phone screens should be 375×812 (or 2× / 3× of it), otherwise they get cropped.</p>
        <div class="dev-pick">${[['mobile', 'Phone', '<rect x="7" y="2.5" width="10" height="19" rx="2.6"/><path d="M11 18.5h2"/>'], ['tablet', 'Tablet / iPad', '<rect x="4" y="3" width="16" height="18" rx="2.6"/><path d="M11 18h2"/>'], ['desktop', 'Laptop / desktop', '<rect x="3.5" y="4.5" width="17" height="11.5" rx="1.8"/><path d="M2 19.5h20"/>']].map(([k, l, ic]) => `<label class="dev-opt"><input type="checkbox" data-k="devices.${k}" data-dev="${k}" ${devs[k] ? 'checked' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg><span>${l}</span></label>`).join('')}</div>
        <div class="f">App icon</div>${imgList('icon', p.icon ? [p.icon] : [], 'sq', false, false)}
        <div class="dev-up" data-dev-up="mobile"${devs.mobile ? '' : ' hidden'}><div class="f">Phone screens</div>${imgList('screens', p.screens || [])}</div>
        <div class="dev-up" data-dev-up="tablet"${devs.tablet ? '' : ' hidden'}><div class="f">Tablet screens</div>${imgList('tabletScreens', p.tabletScreens || [], 'tab')}</div>
        <div class="dev-up" data-dev-up="desktop"${devs.desktop ? '' : ' hidden'}><div class="f">Desktop screens</div>${imgList('webScreens', p.webScreens || [], 'wide')}</div>
      </fieldset>

      <fieldset data-demo-fs><legend>App demo</legend>
        <p class="hint">Plays on the case study like a screen recording. Add a step per screen, then click on the screen where the tap happens (click a dot to remove it). Leave empty to skip the demo.</p>
        <div class="demo-ed" data-demo-ed>${(p.demo || []).map((st) => demoRow(st, p)).join('')}</div>
        <div class="demo-acts"><button type="button" class="btn btn-ghost btn-sm" data-demo-add>+ Add step</button><button type="button" class="btn btn-ghost btn-sm" data-demo-fill>One step per screen</button></div>
      </fieldset>

      <fieldset><legend>Case study header</legend>
        ${F('Tags (comma separated)', 'tags', (p.tags || []).join(', '))}
        <div class="g2">${F('My role', 'role', p.role)}${F('Company / client', 'company', p.company)}</div>
        <div class="g3">${F('Team', 'team', p.team)}${F('Timeline', 'timeline', p.timeline, { ph: '6 months' })}${F('Platforms', 'platforms', p.platforms, { ph: 'iOS · Android' })}</div>
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
    setupSide(true);
  }

  /* Profile & links and Website text open right under the tabs, like the lists */
  function embedPanel(tabName, title) {
    $('#edForm').classList.remove('combo-side');
    if (wtUnbind) wtUnbind();
    show('v-list');
    $('#list-title').innerHTML = `${esc(page.label)} <em class="serif">· ${esc(sub.label)}</em>`;
    $('#plist').hidden = true; $('#listHint').hidden = true; $('#newProject').hidden = true;
    $('#tabPanel').hidden = false; $('#tabPanel').dataset.sub = '';
    $('#tabPanel').appendChild($('#edForm'));
    $('#edSide').hidden = true; $('#edLayout').classList.remove('two'); $('#edForm').oninput = null; $('#edForm').onchange = null;
  }
  function unembed() {
    $('#edForm').classList.remove('combo-side');
    if (wtUnbind) wtUnbind();
    $('#edLayout').appendChild($('#edForm'));
    $('#plist').hidden = false; $('#listHint').hidden = false; $('#newProject').hidden = false; $('#tabPanel').hidden = true;
  }

  let wtUnbind = null;
  async function openContentEditor(host) {
    if (!host) { editing = 0; mode = 'content'; embedPanel('content', 'Website <em class="serif">text</em>'); }
    const form = $('#edForm');
    host = host || form;
    host.innerHTML = '<p class="hint">Loading the page text…</p>';
    let doc;
    try { doc = new DOMParser().parseFromString(await (await fetch('index.html?v=' + Date.now(), { cache: 'no-store' })).text(), 'text/html'); }
    catch (e) { host.innerHTML = '<p class="hint">Could not load the page text. Refresh and try again.</p>'; return; }
    const secs = window.SiteContent.sections(doc).filter((x) => !sub.keys || sub.keys.includes(x.key));
    const pick = (f) => (!sub.fsel || f.el.closest(sub.fsel)) && (!sub.fnot || !f.el.closest(sub.fnot));
    const data = secs.map((sec) => ({ sec, fs: window.SiteContent.fields(sec).filter(pick) }));
    const valOf = (f) => (Object.prototype.hasOwnProperty.call(content.text, f.key) ? content.text[f.key] : f.text);
    const offs = content.off || [];
    const EYE_I = '<svg class="on" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c1-1.5 5-6 10-6s9 4.5 10 6c-1 1.5-5 6-10 6S3 13.5 2 12z"/><circle cx="12" cy="12" r="3"/></svg><svg class="no" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c5 0 9 4.5 10 6-.4.7-1.4 2-2.9 3.3M6.6 6.6C4.6 8 3.3 9.8 2 12c1 1.5 5 6 10 6 1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
    const editedIn = (fs) => fs.filter((f) => valOf(f) !== f.text).length;
    host.innerHTML = `
      <div class="wt${data.length < 2 ? ' one' : ''}">
        <aside class="wt-nav" role="tablist" aria-label="Page sections">${data.map(({ sec, fs }, n) => `
          <button type="button" class="wt-tab${n === 0 ? ' on' : ''}" data-wt="${n}" role="tab"><span class="wt-n">${String(n + 1).padStart(2, '0')}</span><span class="wt-l"><b>${esc(sec.name)}</b><small data-wt-meta="${n}">${fs.length} texts${editedIn(fs) ? ` · <i>${editedIn(fs)} edited</i>` : ''}${content.hidden.includes(sec.key) ? ' · hidden' : ''}</small></span></button>`).join('')}
        </aside>
        <div class="wt-body">${data.map(({ sec, fs }, n) => `
          <section class="wt-sec${content.hidden.includes(sec.key) ? ' sec-off' : ''}" data-wt-sec="${n}"${n ? ' hidden' : ''}>
            <header class="wt-head">
              <div><small>Section</small><h3>${esc(sub.fsel ? sub.label : sec.name)}</h3></div>
              ${sub.fsel && sub.part ? `<label class="wt-switch"><input type="checkbox" data-part-show="${esc(sub.part)}" ${content.hidden.includes(sub.part) ? '' : 'checked'}><span></span>Show on website</label>` : `<label class="wt-switch"><input type="checkbox" data-sec-show="${esc(sec.key)}" ${content.hidden.includes(sec.key) ? '' : 'checked'}><span></span>Show on website</label>`}
            </header>
            ${(() => {
              const isShort = (f) => !/\n/.test(f.text) && f.text.length <= 48 && !/Paragraph|Main heading|FAQ answer/.test(f.kind);
              const PLURAL = { 'Button / tab': 'Buttons & tabs', Button: 'Buttons', Text: 'Texts', Title: 'Titles', 'Small text': 'Small texts', Heading: 'Headings', 'Number caption': 'Number captions', 'Number (counts up)': 'Numbers' };
              /* compact field: no label row, reset + eye sit inside the box */
              const cfield = (f) => { const v = valOf(f); const ed = v !== f.text; const off = offs.includes(f.key); return `<div class="wt-field c${ed ? ' edited' : ''}${off ? ' off' : ''}"><textarea data-ckey="${esc(f.key)}" data-orig="${esc(f.text)}" rows="1">${esc(v)}</textarea><span class="c-act"><button type="button" class="wt-reset" data-reset${ed ? '' : ' hidden'} title="Back to: ${esc(f.text)}">↺</button><button type="button" class="wt-eye${off ? ' is-off' : ''}" data-off="${esc(f.key)}" aria-pressed="${off}" title="Show or hide this on the website">${EYE_I}</button></span><p class="wt-orig" hidden></p></div>`; };
              /* lay out a list of fields: same-kind short texts in a row, other short ones two per line */
              const flow = (list) => { let out = '', i = 0; while (i < list.length) { const f = list[i]; if (isShort(f)) { let j = i; while (j < list.length && isShort(list[j]) && list[j].kind === f.kind) j++; if (j - i >= 2) { out += `<div class="wt-run"><div class="wt-run-h">${esc(PLURAL[f.kind] || f.kind + 's')}<small>${j - i}</small></div><div class="wt-run-b">${list.slice(i, j).map(cfield).join('')}</div></div>`; i = j; continue; } out += field(f).replace('class="wt-field', 'class="wt-field half'); i++; continue; } out += field(f); i++; } return out; };
              const field = (f) => { const v = valOf(f); const ed = v !== f.text; return `
            <div class="wt-field${ed ? ' edited' : ''}${offs.includes(f.key) ? ' off' : ''}">
              <div class="wt-lab"><span>${esc(f.kind)}</span><button type="button" class="wt-reset" data-reset${ed ? '' : ' hidden'}>Reset</button><button type="button" class="wt-eye${offs.includes(f.key) ? ' is-off' : ''}" data-off="${esc(f.key)}" aria-pressed="${offs.includes(f.key)}" title="Show or hide this on the website">${EYE_I}</button></div>
              <textarea data-ckey="${esc(f.key)}" data-orig="${esc(f.text)}" rows="1">${esc(v)}</textarea>
              <p class="wt-orig"${ed ? '' : ' hidden'}>Original: ${esc(f.text)}</p>
            </div>`; };
              /* tools: small cards with the logo, name and one line each */
              const logo = (el) => { const ic = el && (window.ICONS || {})[el.dataset.icon]; if (!ic) return `<span class="tc-fb">${esc((el && el.dataset.fb) || '•')}</span>`; if (ic.full) return `<svg viewBox="${ic.fvb}" aria-hidden="true">${ic.full}</svg>`; return `<svg viewBox="${ic.vb}" fill="currentColor" style="color:${ic.c === 'ink' ? 'var(--ink)' : ic.c}" aria-hidden="true">${ic.p}</svg>`; };
              const mini = (f, ph) => { const v = valOf(f); const ed = v !== f.text; return `<div class="wt-field tf${ed ? ' edited' : ''}"><textarea data-ckey="${esc(f.key)}" data-orig="${esc(f.text)}" rows="1" placeholder="${ph}">${esc(v)}</textarea><button type="button" class="wt-reset" data-reset${ed ? '' : ' hidden'} title="Back to original">↺</button><p class="wt-orig" hidden></p></div>`; };
              const tcard = (run) => { const tool = run[0].el.closest('.tool'); const gk = 'g:' + run[0].key, goff = offs.includes(gk); return `<div class="wt-group tcard${goff ? ' off' : ''}"><div class="wt-gh"><span class="tc-ic">${logo(tool && tool.querySelector('[data-icon]'))}</span><div class="tc-f">${run.map((f, i) => mini(f, i ? 'Short line' : 'Name')).join('')}</div><button type="button" class="wt-eye g${goff ? ' is-off' : ''}" data-off="${esc(gk)}" aria-pressed="${goff}" title="Show / hide this tool">${EYE_I}<span>${goff ? 'Hidden' : 'Shown'}</span></button></div></div>`; };
              let html = '', k = 0, grid = '', lastFam = '';
              const openGrid = (cls) => { if (grid !== cls) { if (grid) html += '</div>'; if (cls) html += `<div class="${cls}">`; grid = cls; } };
              while (k < fs.length) {
                const g = fs[k].group;
                const isTool = g && fs[k].el.closest('.tool');
                if (!g) { openGrid(''); const loose = []; while (k < fs.length && !fs[k].group) loose.push(fs[k++]); html += flow(loose); continue; }
                const run = []; while (k < fs.length && fs[k].group === g) run.push(fs[k++]);
                if (isTool) { openGrid('tgrid'); html += tcard(run); continue; }
                const isList = g.startsWith('list-');
                if (!isList) {
                  /* cards side by side, always open */
                  const fam = run[0].el.closest('[data-c-group]') ? 'named' : String(run[0].groupLabel || '').replace(/\s*\d+.*$/, '');
                  if (grid === 'cgrid' && fam !== lastFam) openGrid('');
                  lastFam = fam;
                  openGrid('cgrid');
                  const gk = 'g:' + run[0].key, goff = offs.includes(gk);
                  html += `<div class="wt-group card${goff ? ' off' : ''}"><div class="wt-gh"><b>${esc(run[0].groupLabel)}</b><button type="button" class="wt-eye g${goff ? ' is-off' : ''}" data-off="${esc(gk)}" aria-pressed="${goff}" title="Show or hide this card on the website">${EYE_I}<span>${goff ? 'Hidden' : 'Shown'}</span></button></div><div class="wt-gb">${(() => {
                    const isPt = (f) => { const li = f.el.closest('li'); return li && run.filter((g) => li.contains(g.el)).length === 1; };
                    const words = run.length >= 4 && run.every((f) => f.text.length <= 30 && f.el.tagName === run[0].el.tagName);
                    if (words) return `<div class="pts words"><div class="wt-run-h">Words<small>${run.length}</small></div><div class="wt-run-b">${run.map(cfield).join('')}</div></div>`;
                    const main = run.filter((f) => !isPt(f)), pts = run.filter(isPt);
                    const lab = (f, i) => f.el.closest('.role-tag, .eyebrow, .n') ? 'Label' : /^H[1-6]$/.test(f.el.tagName) ? 'Heading' : f.el.tagName === 'P' || f.text.length > 55 || (i === main.length - 1 && i > 0 && f.text.length > 25) ? 'Description' : i === 0 && main.length >= 3 ? 'Label' : 'Title';
                    return main.map((f, i) => field(f.kind === 'Text' || f.kind === 'Title' || f.kind === 'Heading' ? Object.assign({}, f, { kind: lab(f, i) }) : f.kind === 'Small text' ? Object.assign({}, f, { kind: 'Detail' }) : f)).join('') + (pts.length ? `<div class="pts"><div class="wt-run-h">Points<small>${pts.length}</small></div>${pts.map(cfield).join('')}</div>` : '');
                  })()}</div></div>`;
                  continue;
                }
                openGrid('');
                const gk = 'g:' + run[0].key, goff = !isList && offs.includes(gk);
                html += `<div class="wt-group${isList ? ' list' : ''}${goff ? ' off' : ''}"><div class="wt-gh"${isList ? '' : ' data-fold'}>${isList ? '' : '<svg class="wt-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'}<b>${esc(run[0].groupLabel)}</b>${isList ? '' : '<span class="wt-peek"></span>'}<small>${run.length} ${run.length === 1 ? 'text' : 'texts'}</small>${isList ? '' : `<button type="button" class="wt-eye g${goff ? ' is-off' : ''}" data-off="${esc(gk)}" aria-pressed="${goff}">${EYE_I}<span>${goff ? 'Hidden' : 'Shown'}</span></button>`}</div><div class="wt-gb${isList ? '' : ' wt-flow'}">${isList ? run.map(field).join('') : flow(run)}</div></div>`;
              }
              openGrid('');
              return `<div class="wt-flow">${html}</div>`;
            })()}
          </section>`).join('')}
        </div>
      </div>`;
    const grow = (t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; };
    /* sections that are switched off: dim them and say so */
    const markSec = (sec$) => { const off = !$('[data-sec-show],[data-part-show]', sec$).checked; sec$.classList.toggle('sec-off', off); const note = $('.off-note', sec$); if (off && !note) $('.wt-head', sec$).insertAdjacentHTML('afterend', OFF_NOTE); if (!off && note) note.remove(); };
    $$('.wt-sec', form).forEach(markSec);
    /* long sections: fold the cards, with a jump list on the side */
    const peek = (g) => { const t = $('textarea', g); const p = $('.wt-peek', g); if (!p) return; const v = t ? t.value.replace(/[*\n]+/g, ' ').trim() : ''; const lab = ($('.wt-gh b', g).textContent || '').toLowerCase(); p.textContent = v && !lab.includes(v.toLowerCase()) ? v : ''; };
    const fold = (g, closed) => { g.classList.toggle('closed', closed); const h = $('[data-fold]', g); if (h) h.setAttribute('aria-expanded', String(!closed)); if (!closed) $$('textarea', g).forEach(grow); };
    $$('.wt-sec', form).forEach((sec$, n) => {
      const groups = $$('.wt-group.card', sec$);
      groups.forEach((g, i) => { g.id = `wt-g-${n}-${i}`; peek(g); const h = $('[data-fold]', g); if (h) { h.tabIndex = 0; h.setAttribute('role', 'button'); } });
      const tabBtn = $(`.wt-tab[data-wt="${n}"]`, form);
      if (groups.length > 5) tabBtn.insertAdjacentHTML('afterend', `<div class="wt-jumps" data-jumps="${n}"${n ? ' hidden' : ''}><div class="wt-jh"><small>${groups.length} cards</small></div>${groups.map((g, i) => `<a href="#wt-g-${n}-${i}" data-jump>${esc($('.wt-gh b', g).textContent)}</a>`).join('')}</div>`);
    });
    if (wtUnbind) wtUnbind();
    const onClick = (e) => {
      const fa = e.target.closest('[data-fold-all]');
      if (fa) { const sec$ = $(`[data-wt-sec="${fa.dataset.foldAll}"]`, form); const open = fa.textContent === 'Open all'; $$('.wt-group.card', sec$).forEach((g) => fold(g, !open)); fa.textContent = open ? 'Close all' : 'Open all'; return; }
      const j = e.target.closest('[data-jump]');
      if (j) { e.preventDefault(); const g = $(j.getAttribute('href'), form); if (!g) return; fold(g, false); g.scrollIntoView({ behavior: 'smooth', block: 'start' }); g.classList.remove('flash'); void g.offsetWidth; g.classList.add('flash'); return; }
      const h = e.target.closest('[data-fold]');
      if (h && !e.target.closest('[data-off]')) fold(h.parentElement, !h.parentElement.classList.contains('closed'));
    };
    const onKey = (e) => { const h = e.target.closest && e.target.closest('[data-fold]'); if (h && e.target === h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); h.click(); } };
    const onIn = (e) => { const g = e.target.closest('.wt-group'); if (g && $('textarea', g) === e.target) peek(g); };
    if (data.length < 2 && !$('.wt-jumps', form)) $('.wt', form).classList.add('flat');
    form.addEventListener('click', onClick); form.addEventListener('keydown', onKey); form.addEventListener('input', onIn);
    wtUnbind = () => { form.removeEventListener('click', onClick); form.removeEventListener('keydown', onKey); form.removeEventListener('input', onIn); wtUnbind = null; };
    const refreshMeta = (n) => { const { sec, fs } = data[n]; const sec$ = $(`[data-wt-sec="${n}"]`, form); const ed = $$('.wt-field.edited', sec$).length; const hid = !$('[data-sec-show],[data-part-show]', sec$).checked; $(`[data-wt-meta="${n}"]`, form).innerHTML = `${fs.length} texts${ed ? ` · <i>${ed} edited</i>` : ''}${hid ? ' · hidden' : ''}`; };
    $$('.wt-tab', form).forEach((b) => b.addEventListener('click', () => {
      $$('.wt-tab', form).forEach((x) => x.classList.toggle('on', x === b));
      $$('.wt-sec', form).forEach((x) => { x.hidden = x.dataset.wtSec !== b.dataset.wt; });
      $$('.wt-jumps', form).forEach((x) => { x.hidden = x.dataset.jumps !== b.dataset.wt; });
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
      sec$.addEventListener('change', (e) => { if (e.target.matches('[data-sec-show],[data-part-show]')) { refreshMeta(n); markSec(sec$); setDirty(true); } });
      sec$.addEventListener('click', (e) => {
        const eye = e.target.closest('[data-off]');
        if (eye) {
          const off = !eye.classList.contains('is-off');
          eye.classList.toggle('is-off', off); eye.setAttribute('aria-pressed', String(off));
          (eye.closest('.wt-gh') ? eye.closest('.wt-group') : eye.closest('.wt-field')).classList.toggle('off', off);
          const lab = $('span', eye); if (lab) lab.textContent = off ? 'Hidden' : 'Shown';
          setDirty(true); return;
        }
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
        <p class="hint">Screenshots for the big “Screens that ship” wall on the home page — app screens, web pages, anything you designed. Add as many as you like (10+ looks best), drag them (or use ← →) to order them. Phone and web screenshots can be mixed. If empty, screens from your projects are used.</p>
        ${imgList('showcase', site.showcase || [], '', false, true)}
      </fieldset>
      <fieldset data-g="availability"><legend>Availability</legend>
        <header class="wt-head av-head"><div><small>Section</small><h3>Availability</h3></div><label class="wt-switch"><input type="checkbox" data-k="availabilityOn" ${site.availabilityOn === false ? '' : 'checked'}><span></span>Show on website</label></header>
        <p class="hint">One short line under the buttons at the top of the page, with a green dot.</p>
        ${F('Availability line', 'availability', site.availability, { ph: 'Open to Product Manager / Product Owner roles · Ramallah or remote' })}
      </fieldset>
      <fieldset data-g="beyond"><legend>Beyond the screen — card photos (optional)</legend>
        <p class="hint">Each card on the home page has a small animation. Upload a photo or a GIF to show your own work there instead (square-ish, e.g. 1200×900). A GIF plays like a short video.</p>
        <div class="ph-grid">${[['ui', 'Product & UX'], ['motion', 'Interaction & motion'], ['graphic', 'Graphic & advertising'], ['brand', 'Brand & visual identity'], ['photo', 'Photography & editing'], ['film', 'Filmmaking & directing'], ['fashion', 'Fashion & style'], ['sport', 'Sport & gym']].map(([k, l]) => `<div class="ph-card"><div class="ph-top"><span><b>${l}</b></span></div>${imgList('int_' + k, site['int_' + k] ? [site['int_' + k]] : [], 'wide', false, false)}</div>`).join('')}</div>
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
        <div class="g2">${F('Email', 'email', site.email, { icon: 'gmail', type: 'email', ph: 'you@email.com' })}${F('WhatsApp number (with country code)', 'whatsapp', site.whatsapp, { icon: 'whatsapp', ph: '9705XXXXXXXX' })}</div>
        <div class="g2">${F('LinkedIn URL', 'linkedin', site.linkedin, { icon: 'linkedin', ph: 'https://www.linkedin.com/in/…' })}${F('Behance URL', 'behance', site.behance, { icon: 'behance', ph: 'https://www.behance.net/…' })}</div>
        <div class="g2">${F('Dribbble URL', 'dribbble', site.dribbble, { icon: 'dribbble', ph: 'https://dribbble.com/…' })}${F('GitHub URL', 'github', site.github, { icon: 'github', ph: 'https://github.com/…' })}</div>
      </fieldset>
      <fieldset data-g="cv"><legend>CV</legend>
        <p class="hint">The “View My CV” button in the top bar opens this file. Removing it hides the button.</p>
        <div id="cvBox"></div>
        <input type="file" accept="application/pdf" id="cvInput" hidden>
      </fieldset>`;
    $$('#edForm fieldset[data-g]').forEach((f) => { f.hidden = !!(sub.groups && !sub.groups.includes(f.dataset.g)); });
    placePartSwitch();
    /* sections whose text and images live on one admin page: the text editor goes first */
    $('#edForm').classList.toggle('combo-side', !!(sub.keys && sub.side));
    if (sub.keys) { const host = document.createElement('div'); host.className = 'combo-text'; $('#edForm').prepend(host); openContentEditor(host).then(syncPartOff); }
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
        <span class="cv-meta"><b>${esc(name)}</b><small>${when}${isNew ? ' · <i>new — press Save to put it live</i>' : ' · <i class="ok">Live on the site</i>'}</small></span>
        <span class="cv-act">
          <a class="ib" href="${esc(previews.get(site.cv) || site.cv)}" target="_blank" rel="noopener">View</a>
          <label class="ib edit" for="cvInput" style="cursor:pointer">Replace</label>
          <button class="ib danger" type="button" id="cvRemove">Remove</button>
        </span></div>`;
      $('#cvRemove').addEventListener('click', async () => {
        if (!(await ask({ title: 'Remove the CV?', text: 'The “View My CV” button will disappear from the website.', ok: 'Remove', tone: 'danger' }))) return;
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
    show('v-edit'); $('#backList').textContent = '← All roles';
    $('#ed-title').innerHTML = isNew ? 'New <em class="serif">role</em>' : `Edit <em class="serif">${esc(x.company || 'role')}</em>`;
    $('#edForm').innerHTML = `
      <fieldset><legend>Role</legend>
        <div class="g2">${F('Job title *', 'role', x.role)}${F('Company *', 'company', x.company)}</div>
        <div class="g3">${F('Dates', 'dates', x.dates, { ph: 'Mar 2024 — Present' })}${F('Location', 'location', x.location, { ph: 'Ramallah, Palestine' })}${F('Type', 'type', x.type, { ph: 'Full-time' })}</div>
        ${C('Show on the website', 'visible', x.visible !== false)}
        ${F('One-line summary', 'summary', x.summary, { area: true, rows: 2 })}
        ${F('Highlights (one per line — shown when visitors open the role)', 'highlights', (x.highlights || []).join('\n'), { area: true, rows: 7 })}
      </fieldset>`;
    setupSide(false);
  }

  /* collect form -> project */
  function collect() {
    if (editing < 0) { const tp = $('#tabPanel'); if (!tp.hidden && $('#edForm', tp) && $('#edForm [data-ckey]')) { const m = mode; mode = 'content'; editing = 0; collect(); editing = -1; mode = m; } return; }
    if (mode === 'site' && $('#edForm [data-ckey]')) { const m = mode; mode = 'content'; collect(); mode = m; }
    if (mode === 'content') {
      if (!$('#edForm [data-ckey]')) return;
      const text = Object.assign({}, content.text);
      $$('#edForm [data-ckey]').forEach((t) => { delete text[t.dataset.ckey]; const v = t.value.replace(/\r/g, ''); if (v.trim() !== t.dataset.orig.trim()) text[t.dataset.ckey] = v.trim(); });
      content.text = text;
      const shown = $$('#edForm [data-sec-show]');
      const here = shown.map((c) => c.dataset.secShow);
      content.hidden = content.hidden.filter((k) => !here.includes(k)).concat(shown.filter((c) => !c.checked).map((c) => c.dataset.secShow));
      const eyes = $$('#edForm [data-off]');
      if (eyes.length) {
        const ks = eyes.map((b) => b.dataset.off);
        const off = (content.off || []).filter((k) => !ks.includes(k)).concat(eyes.filter((b) => b.classList.contains('is-off')).map((b) => b.dataset.off));
        if (off.length) content.off = off; else delete content.off;
      }
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
      if (box.dataset.rep === 'links') { p.links = p.links.filter((l) => l.url); delete p.liveUrl; }
    });
    $$('[data-imgs]', form).forEach((box) => {
      const key = box.dataset.imgs, lab = box.dataset.lab === '1', multi = box.dataset.multi === '1';
      const items = $$('.im', box).map((im) => lab ? { label: ($('[data-lbl]', im) || {}).value || '', image: im.dataset.path } : im.dataset.path).filter((x) => lab ? (x.image || x.label) : x);
      setPath(p, key, multi ? items : (items[0] || ''));
    });
    const dRows = $$('[data-demo-row]', form);
    if ($('[data-demo-ed]', form)) {
      const shots = p.screens || [];
      p.demo = dRows.map((row) => { const g = (k) => ($(`[data-dr="${k}"]`, row) || {}).value || ''; const img = row.dataset.img, taps = JSON.parse(row.dataset.taps || '[]');
        const o = { img, s: Math.max(0, shots.indexOf(img)), label: g('label').trim() }; if (g('note').trim()) o.note = g('note').trim(); if (+g('loading')) o.loading = +g('loading'); if (taps.length) o.taps = taps; return o; }).filter((o) => o.img);
      if (!p.demo.length) delete p.demo;
    }
  }

  /* editor events */
  const form = $('#edForm');
  form.addEventListener('change', (e) => { if (e.target.dataset && e.target.dataset.dr === 'img') { const row = e.target.closest('[data-demo-row]'); row.dataset.img = e.target.value; demoDraw(row); setDirty(true); } });
  /* drag screens into order (arrows still work on touch) */
  let dragIm = null;
  form.addEventListener('dragstart', (e) => { const im = e.target.closest && e.target.closest('.imgs .im'); if (!im) return; dragIm = im; im.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch (er) {} });
  form.addEventListener('dragover', (e) => { if (!dragIm) return; const over = e.target.closest && e.target.closest('.im'); if (!over || over === dragIm || over.parentNode !== dragIm.parentNode) return; e.preventDefault(); const r = over.getBoundingClientRect(); const after = (e.clientX - r.left) > r.width / 2; over.parentNode.insertBefore(dragIm, after ? over.nextSibling : over); });
  form.addEventListener('dragend', () => { if (dragIm) { dragIm.classList.remove('dragging'); dragIm = null; setDirty(true); demoSync(); } });
  /* warn when a phone screen isn't 375×812 (it would be cropped) or an icon isn't square */
  const sizeSeen = new Map();
  function checkSizes() {
    $$('#edForm [data-imgs="screens"] .im[data-path], #edForm [data-imgs="icon"] .im[data-path]').forEach((im) => {
      const path = im.dataset.path; if (!path) return;
      const isIcon = im.closest('[data-imgs="icon"]');
      const apply = (w, h) => { const ok = isIcon ? Math.abs(w / h - 1) < 0.03 : Math.abs(w / h - 375 / 812) < 0.012; im.classList.toggle('size-warn', !ok); im.title = ok ? '' : (isIcon ? `Not square (${w}×${h}) — it will be cropped` : `Not 375×812 (${w}×${h}) — the phone frame will crop it`); };
      if (sizeSeen.has(path)) { const [w, h] = sizeSeen.get(path); apply(w, h); return; }
      const img = new Image(); img.onload = () => { sizeSeen.set(path, [img.naturalWidth, img.naturalHeight]); apply(img.naturalWidth, img.naturalHeight); }; img.src = imgURL(path);
    });
  }
  let sizeT = 0;
  new MutationObserver(() => { clearTimeout(sizeT); sizeT = setTimeout(() => { if (mode !== 'project') return; checkSizes(); demoSync(); $$('#edForm .imgs .im').forEach((im) => { im.draggable = true; }); }, 120); }).observe(form, { childList: true, subtree: true });
  form.addEventListener('change', (e) => { const d = e.target.dataset && e.target.dataset.dev; if (!d) return; const up = form.querySelector(`[data-dev-up="${d}"]`); if (up) up.hidden = !e.target.checked; });
  form.addEventListener('input', (e) => {
    if (mode === 'project' && e.target.dataset.k === 'title') {
      const s = $('[data-k="slug"]', form);
      if (s && (!s.dataset.touched)) s.value = slugify(e.target.value);
    }
    if (e.target.dataset.k === 'slug') e.target.dataset.touched = '1';
    const rr = e.target.closest && e.target.closest('.rec-row');
    if (rr) { const v = (k) => (($(`[data-r="${k}"]`, rr) || {}).value || '').trim(); $('.rr-ht b', rr).textContent = v('title') || 'New item'; $('.rr-ht small', rr).textContent = [v('org'), v('year')].filter(Boolean).join(' · '); const kk = v('kind') || 'certificate', kp = $('.rr-k', rr); kp.className = 'rr-k k-' + kk; kp.textContent = { certificate: 'Certificate', education: 'Degree', award: 'Award', leadership: 'Leadership' }[kk]; }
    setDirty(true);
  });
  form.addEventListener('click', (e) => {
    const sg = e.target.closest('[data-seg]');
    if (sg) { const box = sg.parentElement, h = $('input[data-k]', box); h.value = sg.dataset.seg; $$('[data-seg]', box).forEach((b) => b.classList.toggle('on', b === sg)); h.dispatchEvent(new Event('input', { bubbles: true })); h.dispatchEvent(new Event('change', { bubbles: true })); setDirty(true); return; }
    const dAdd = e.target.closest('[data-demo-add],[data-demo-fill]');
    if (dAdd) { const ed = $('[data-demo-ed]', form), shots = demoShots();
      if (dAdd.hasAttribute('data-demo-fill')) { const have = $$('[data-demo-row]', ed).map((r) => r.dataset.img); shots.filter((s) => !have.includes(s)).forEach((s, n) => ed.insertAdjacentHTML('beforeend', demoRow({ img: s, label: '' }))); }
      else ed.insertAdjacentHTML('beforeend', demoRow({ img: shots[$$('[data-demo-row]', ed).length] || shots[0] || '' }));
      demoSync(); setDirty(true); return; }
    const dRow = e.target.closest('[data-demo-row]');
    if (dRow) {
      const dot = e.target.closest('[data-dr-dot]');
      if (dot) { const t = JSON.parse(dRow.dataset.taps || '[]'); t.splice(+dot.dataset.drDot, 1); dRow.dataset.taps = JSON.stringify(t); demoDraw(dRow); setDirty(true); return; }
      const shot = e.target.closest('[data-dr-shot]');
      if (shot && dRow.dataset.img) { const r = shot.getBoundingClientRect(); const t = JSON.parse(dRow.dataset.taps || '[]'); t.push([+((e.clientX - r.left) / r.width).toFixed(3), +((e.clientY - r.top) / r.height).toFixed(3)]); dRow.dataset.taps = JSON.stringify(t); demoDraw(dRow); setDirty(true); return; }
      if (e.target.closest('[data-dr-clear]')) { dRow.dataset.taps = '[]'; demoDraw(dRow); setDirty(true); return; }
      if (e.target.closest('[data-dr-del]')) { dRow.remove(); setDirty(true); return; }
      const mv = e.target.closest('[data-dr-mv]');
      if (mv) { if (mv.dataset.drMv === '-1' && dRow.previousElementSibling) dRow.parentNode.insertBefore(dRow, dRow.previousElementSibling); else if (mv.dataset.drMv === '1' && dRow.nextElementSibling) dRow.parentNode.insertBefore(dRow.nextElementSibling, dRow); setDirty(true); return; }
    }
    const add = e.target.closest('[data-add-row]');
    if (add) { const kind = add.dataset.addRow; $(`[data-rep="${kind}"]`, form).insertAdjacentHTML('beforeend', repRow(kind)); setDirty(true); return; }
    const del = e.target.closest('[data-del-row]');
    if (del) {
      const row = del.closest('[data-row]');
      if (row.classList.contains('rec-row')) { const t = ($('[data-r="title"]', row) || {}).value || 'this item'; ask({ title: `Delete “${t}”?`, text: 'It’s removed from the website after you press Save.', ok: 'Delete', tone: 'danger' }).then((y) => { if (y) { row.remove(); setDirty(true); } }); return; }
      row.remove(); setDirty(true); return;
    }
    const tg = e.target.closest('[data-rec-toggle]');
    if (tg) { const row = tg.closest('.rec-row'); const o = !row.classList.contains('open'); row.classList.toggle('open', o); tg.setAttribute('aria-expanded', String(o)); return; }
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
    const th = $('.rec-th', wrap); th.style.backgroundImage = path ? `url('${imgURL(path)}')` : ''; th.textContent = path ? '' : 'No image'; const mini = wrap.closest('.rec-row') && $('.rr-mini', wrap.closest('.rec-row')); if (mini) mini.style.backgroundImage = path ? `url('${imgURL(path)}')` : '';
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

  $('#backList').addEventListener('click', () => { collect(); setDirty(changed(), false); renderList(); });

  /* ---------------- guide (the ⓘ button in the top bar) ---------------- */
  const helpDlg = $('#helpDlg');
  if (helpDlg && $('#helpBtn')) {
    $('#helpBtn').addEventListener('click', () => { if (helpDlg.showModal) helpDlg.showModal(); else helpDlg.setAttribute('open', ''); });
    helpDlg.addEventListener('click', (e) => { if (e.target === helpDlg || e.target.closest('[data-help-close]')) helpDlg.close ? helpDlg.close() : helpDlg.removeAttribute('open'); });
  }

  /* ---------------- search every text in the admin ---------------- */
  let searchDoc = null;
  async function searchIndex() {
    if (!searchDoc) searchDoc = new DOMParser().parseFromString(await (await fetch('index.html?v=' + Date.now(), { cache: 'no-store' })).text(), 'text/html');
    const out = [];
    const secs = window.SiteContent.sections(searchDoc);
    PAGES.forEach((p) => p.subs.forEach((x) => {
      if (x.keys) secs.filter((sec) => !x.keys || x.keys.includes(sec.key)).forEach((sec) => window.SiteContent.fields(sec).forEach((f) => {
        const v = Object.prototype.hasOwnProperty.call(content.text, f.key) ? content.text[f.key] : f.text;
        out.push({ p, x, text: v, kind: f.kind, go: { ckey: f.key } });
      }));
      if (x.kind === 'projects') projects.forEach((pr, i) => out.push({ p, x, text: [pr.title, pr.tagline, pr.category].filter(Boolean).join(' · '), kind: 'Project', go: { project: i } }));
      if (x.kind === 'experience') experience.forEach((r, i) => out.push({ p, x, text: [r.role, r.company].filter(Boolean).join(' · '), kind: 'Role', go: { role: i } }));
      if (x.kind === 'site') {
        const G = x.groups || [];
        if (G.includes('availability') && site.availability) out.push({ p, x, text: site.availability, kind: 'Availability', go: { sel: '[data-k="availability"]' } });
        if (G.includes('links')) ['email', 'whatsapp', 'linkedin', 'behance', 'dribbble', 'github'].forEach((k) => { if (site[k]) out.push({ p, x, text: site[k], kind: 'Link', go: { sel: `[data-k="${k}"]` } }); });
        if (G.includes('cv') && site.cvName) out.push({ p, x, text: site.cvName, kind: 'CV', go: { sel: '#cvBox' } });
        if (G.includes('recognition')) (site.recognition || []).forEach((r, i) => out.push({ p, x, text: [r.title, r.org, r.year, r.note].filter(Boolean).join(' · '), kind: 'Learning', go: { rec: i } }));
        if (G.includes('testimonials')) (site.testimonials || []).forEach((t, i) => out.push({ p, x, text: [t.quote, t.name, t.role].filter(Boolean).join(' · '), kind: 'Testimonial', go: { sel: `[data-rep="testimonials"] [data-row]:nth-child(${i + 1})` } }));
      }
    }));
    return out;
  }
  const sBox = $('#adminSearch'), sRes = $('#searchRes');
  if (sBox) {
    let timer = 0, hits = [];
    const hl = (t, q) => { const i = t.toLowerCase().indexOf(q); const a = Math.max(0, i - 40); const cut = (a ? '…' : '') + t.slice(a, i + q.length + 60) + (i + q.length + 60 < t.length ? '…' : ''); return esc(cut).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), (m) => `<mark>${m}</mark>`); };
    const run = async () => {
      const q = sBox.value.trim().toLowerCase();
      if (q.length < 2) { sRes.hidden = true; return; }
      let all; try { all = await searchIndex(); } catch (e) { return; }
      hits = all.filter((h) => h.text && h.text.toLowerCase().includes(q)).slice(0, 8);
      sRes.innerHTML = hits.length ? hits.map((h, i) => `<button type="button" data-hit="${i}"><small>${esc(h.p.label)} · ${esc(h.x.label)} <i>${esc(h.kind)}</i></small><span>${hl(h.text, q)}</span></button>`).join('') : '<p>Nothing found</p>';
      sRes.hidden = false;
    };
    sBox.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 160); });
    sBox.addEventListener('focus', run);
    sBox.addEventListener('keydown', (e) => { if (e.key === 'Escape') { sBox.value = ''; sRes.hidden = true; sBox.blur(); } if (e.key === 'Enter') { const b = $('[data-hit]', sRes); if (b) b.click(); } });
    document.addEventListener('click', (e) => { if (!e.target.closest('.asearch')) sRes.hidden = true; });
    sRes.addEventListener('click', (e) => {
      const b = e.target.closest('[data-hit]'); if (!b) return;
      const h = hits[+b.dataset.hit]; sRes.hidden = true; sBox.value = ''; sBox.blur();
      goTo(h.p, h.x);
      if (h.go.project != null) return openEditor(h.go.project);
      if (h.go.role != null) return openExpEditor(h.go.role);
      if (h.go.sel || h.go.rec != null) {
        const el = h.go.sel ? $('#edForm ' + h.go.sel) : $$('#edForm .rec-row')[h.go.rec];
        if (!el) return;
        if (el.classList.contains('rec-row') && !el.classList.contains('open')) $('[data-rec-toggle]', el).click();
        const box = el.closest('.f, [data-row]') || el;
        box.scrollIntoView({ behavior: 'smooth', block: 'center' }); box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
        const inp = el.matches('input, textarea') ? el : ($('[data-r="title"]', el) || $('[data-r="quote"]', el) || $('input, textarea', el)); if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 350);
        return;
      }
      let tries = 0;
      const find = () => {
        const t = $(`#edForm textarea[data-ckey="${CSS.escape(h.go.ckey)}"]`);
        if (!t) { if (++tries < 40) setTimeout(find, 60); return; }
        const sec$ = t.closest('.wt-sec'); if (sec$ && sec$.hidden) { const tb = $(`.wt-tab[data-wt="${sec$.dataset.wtSec}"]`); if (tb) tb.click(); }
        const g = t.closest('.wt-group.closed'); if (g) $('[data-fold]', g).click();
        const box = t.closest('.wt-field');
        box.scrollIntoView({ behavior: 'smooth', block: 'center' }); box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
        setTimeout(() => t.focus({ preventScroll: true }), 350);
      };
      find();
    });
  }

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

  /* ---------------- publish (one commit) ---------------- */
  async function autoSave() {
    if (saving) { saveAgain = true; return; }
    collect();
    if (!changed()) { dirty = false; status(''); return; }
    const badX = experience.find((x) => !x.role || !x.role.trim() || !x.company || !x.company.trim());
    if (badX) return status('hint', 'Add a job title and company, then press Save.');
    const bad = projects.find((p) => !p.title || !p.title.trim());
    if (bad) return status('hint', 'Add a project name, then press Save.');
    const slugs = projects.map((p) => p.slug);
    const dup = slugs.find((x, i) => slugs.indexOf(x) !== i);
    if (dup) return status('err', `Not saved yet: two projects use the same URL name “${dup}”.`);
    saving = true; status('saving');
    const snap = { p: JSON.stringify(projects), x: JSON.stringify(experience), s: JSON.stringify(site), c: JSON.stringify(content) };
    try {
      const files = [];
      if (!same(projects, original)) files.push({ path: CFG.dataPath || 'data/projects.json', b64: b64FromUtf8(JSON.stringify(projects, null, 2) + '\n') });
      if (!same(content, originalContent)) files.push({ path: CONTENT_PATH, b64: b64FromUtf8(JSON.stringify(content, null, 2) + '\n') });
      if (!same(site, originalSite)) files.push({ path: SITE_PATH, b64: b64FromUtf8(JSON.stringify(site, null, 2) + '\n') });
      if (!same(experience, originalExp)) files.push({ path: EXP_PATH, b64: b64FromUtf8(JSON.stringify(experience, null, 2) + '\n') });
      const used = new Set(JSON.stringify([projects, site, experience]).match(/"[^"]+\.(?:webp|jpg|jpeg|png|svg|gif|pdf)"/g) || []);
      const sent = [];
      pending.forEach((b64, path) => { if (used.has('"' + path + '"')) { files.push({ path, b64 }); sent.push(path); } });
      if (files.length) {
        const ref = await (await gh(`${repoPath()}/git/ref/heads/${encodeURIComponent(auth.branch)}`)).json();
        const baseCommit = ref.object.sha;
        /* someone saved from another tab or device since this page loaded? then don't overwrite their work */
        const base = { [CFG.dataPath || 'data/projects.json']: original, [CONTENT_PATH]: originalContent, [SITE_PATH]: originalSite, [EXP_PATH]: originalExp };
        for (const f of files) {
          if (!(f.path in base)) continue;
          let live;
          try { live = JSON.parse(await (await gh(`${repoPath()}/contents/${f.path}?ref=${baseCommit}`, { headers: { Accept: 'application/vnd.github.raw+json' } })).text()); } catch (e) { continue; }
          if (!same(live, base[f.path])) { saving = false; status('conflict', 'Changed from another tab or device. Reload to get the latest — this change wasn’t saved.'); return; }
        }
        const commit = await (await gh(`${repoPath()}/git/commits/${baseCommit}`)).json();
        const tree = [];
        for (let i = 0; i < files.length; i++) {
          if (files.length > 2) status('saving', `Saving… ${i + 1} of ${files.length}`);
          const blob = await (await gh(`${repoPath()}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: files[i].b64, encoding: 'base64' }) })).json();
          tree.push({ path: files[i].path, mode: '100644', type: 'blob', sha: blob.sha });
        }
        const newTree = await (await gh(`${repoPath()}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: commit.tree.sha, tree }) })).json();
        const label = page && sub ? `Update ${page.label} · ${sub.label}` : 'Update portfolio content';
        const newCommit = await (await gh(`${repoPath()}/git/commits`, { method: 'POST', body: JSON.stringify({ message: `${label} (via admin)`, tree: newTree.sha, parents: [baseCommit] }) })).json();
        await gh(`${repoPath()}/git/refs/heads/${encodeURIComponent(auth.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: newCommit.sha }) });
      }
      original = snap.p; originalExp = snap.x; originalSite = snap.s; originalContent = snap.c;
      sent.forEach((path) => pending.delete(path));
      saving = false;
      dirty = changed();
      if (dirty) status('pending');
      else { touched.clear(); tabsReady(); status('ok'); }
    } catch (err) {
      saving = false;
      status('err', 'Couldn’t save: ' + err.message);
    }
    if (saveAgain) { saveAgain = false; recheck(); }
  }
  addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (dirty && !saving) { collect(); autoSave(); } } });
  /* discard: drop every unsaved change and go back to what's live */
  $('#saveDiscard').addEventListener('click', async () => {
    if (saving) return;
    const ok = await ask({ title: 'Discard unsaved changes?', text: 'Everything you changed since the last save goes back to how it is on the site.', ok: 'Discard', tone: 'danger' });
    if (!ok) return;
    const wasMode = mode, wasIdx = editing;
    projects = JSON.parse(original); experience = JSON.parse(originalExp); site = JSON.parse(originalSite); content = JSON.parse(originalContent);
    content.text = content.text || {}; content.hidden = content.hidden || [];
    pending.clear();
    $('#tabPanel').hidden = true; $('#tabPanel').dataset.sub = '';
    setDirty(false);
    if (wasMode === 'project' && wasIdx >= 0 && projects[wasIdx]) openEditor(wasIdx);
    else if (wasMode === 'exp' && wasIdx >= 0 && experience[wasIdx]) openExpEditor(wasIdx);
    else renderList();
    setDirty(false);
  });
  $('#saveRetry').addEventListener('click', () => { if ($('#savebar').dataset.state === 'conflict') { dirty = false; saving = false; location.reload(); return; } clearTimeout(saveTimer); autoSave(); });

  /* ---------------- start ---------------- */
  auth = loadAuth();
  if (/[?&]lock\b/.test(location.search)) { clearAuth(); auth = null; history.replaceState(null, '', location.pathname); initLogin(); }
  if (auth && auth.token) loadData().catch((e) => { toast('Please sign in again'); clearAuth(); auth = null; initLogin(); });
  else initLogin();
})();
