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
  let tab = 'projects';     // which list is shown
  let mode = 'project';     // which editor is open
  const EXP_PATH = 'data/experience.json';
  const SITE_PATH = 'data/site.json';
  let site = {};
  let originalSite = '{}';
  const changed = () => JSON.stringify(projects) !== original || JSON.stringify(experience) !== originalExp || JSON.stringify(site) !== originalSite || pending.size > 0;
  let dirty = false;

  /* ---------------- helpers ---------------- */
  const show = (id) => ['v-login', 'v-list', 'v-edit'].forEach((v) => $('#' + v).classList.toggle('hidden', v !== id));
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
  $('#logout').addEventListener('click', () => { if (dirty && !window.confirm('You have unpublished changes. Lock anyway?')) return; clearAuth(); auth = null; setDirty(false); initLogin(); });

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
    original = JSON.stringify(projects);
    originalExp = JSON.stringify(experience);
    originalSite = JSON.stringify(site);
    pending.clear();
    setDirty(false);
    renderList();
  }

  /* ---------------- list ---------------- */
  function renderList() {
    editing = -1;
    if (tab === 'profile') return openSiteEditor();
    show('v-list');
    $$('.atabs button').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    $('#newProject').textContent = tab === 'projects' ? '+ New project' : '+ Add role';
    $('#list-title').innerHTML = tab === 'projects' ? 'Your <em class="serif">projects</em>' : 'Your <em class="serif">experience</em>';
    const el = $('#plist');
    if (tab === 'experience') {
      if (!experience.length) { el.innerHTML = '<div class="card-a glass"><p class="muted">No roles yet. Press <b>+ Add role</b>.</p></div>'; return; }
      el.innerHTML = experience.map((x, i) => `<div class="prow glass">
        <span class="t"><b>${esc(x.role || 'Untitled role')}</b><small>${esc(x.company || '')}${x.dates ? ' · ' + esc(x.dates) : ''}</small></span>
        <span class="badge-d ${x.visible !== false ? 'on' : ''}">${x.visible !== false ? 'Visible' : 'Hidden'}</span>
        <span class="acts">
          <button class="ib" type="button" data-a="up" data-i="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="ib" type="button" data-a="down" data-i="${i}" aria-label="Move down" ${i === experience.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="ib" type="button" data-a="toggle" data-i="${i}">${x.visible !== false ? 'Hide' : 'Show'}</button>
          <button class="ib" type="button" data-a="edit" data-i="${i}">Edit</button>
          <button class="ib danger" type="button" data-a="del" data-i="${i}">Delete</button>
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
        <span class="badge-d ${p.published !== false ? 'on' : ''}">${p.published !== false ? 'Published' : 'Hidden'}</span>
        <span class="acts">
          <button class="ib" type="button" data-a="up" data-i="${i}" aria-label="Move ${esc(p.title)} up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="ib" type="button" data-a="down" data-i="${i}" aria-label="Move ${esc(p.title)} down" ${i === projects.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="ib" type="button" data-a="toggle" data-i="${i}">${p.published !== false ? 'Hide' : 'Show'}</button>
          <button class="ib" type="button" data-a="edit" data-i="${i}">Edit</button>
          <button class="ib danger" type="button" data-a="del" data-i="${i}" aria-label="Delete ${esc(p.title)}">Delete</button>
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
  $$('.atabs button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; renderList(); }));
  $('#newProject').addEventListener('click', () => {
    if (tab === 'experience') {
      experience.unshift({ id: 'role-' + Date.now().toString(36), visible: true, role: '', company: '', location: '', dates: '', type: 'Full-time', summary: '', highlights: [] });
      return openExpEditor(0, true);
    }
    projects.push({ slug: '', title: '', headline: '', headlineAccent: '', tagline: '', category: '', platform: 'Mobile App', type: 'mobile', year: String(new Date().getFullYear()), live: false, liveUrl: '', status: '', published: true, summary: '', cover: { image: '', ghost: '', tint: '#2B3A8F' }, company: '', role: '', team: '', timeline: '', platforms: '', tags: [], overview: '', problem: '', responsibilities: { product: [], design: [] }, process: [], challenges: [], gallery: { before: [], after: [] }, results: [], learnings: '', icon: '', screens: [], webScreens: [] });
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
  const C = (label, key, val) => `<label class="chk"><input type="checkbox" data-k="${key}" ${val ? 'checked' : ''}> ${label}</label>`;

  function imgItem(path, cls, withLabel, label) {
    return `<div class="im ${cls}" data-path="${esc(path)}">
      <span class="th" style="${path ? `background-image:url('${esc(imgURL(path))}')` : ''}">${path ? '' : 'Empty'}</span>
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
    if (kind === 'results') return `<div class="rep-item" data-row><label class="f">Value<input data-r="value" value="${esc(a.value || '')}" placeholder="+35%"></label><label class="f">What it measures<input data-r="label" value="${esc(a.label || '')}" placeholder="Weekly active users"></label><button class="ib danger" type="button" data-del-row aria-label="Remove">✕</button></div>`;
    return '';
  }
  const rep = (kind, list, addLabel) => `<div class="rep" data-rep="${kind}">${(list || []).map((a) => repRow(kind, a)).join('')}</div><button class="btn btn-ghost btn-sm" type="button" data-add-row="${kind}" style="align-self:flex-start">+ ${addLabel}</button>`;

  function openEditor(i, isNew) {
    editing = i; mode = 'project';
    const p = projects[i];
    show('v-edit');
    $('#ed-title').innerHTML = isNew ? 'New <em class="serif">project</em>' : `Edit <em class="serif">${esc(p.title || 'project')}</em>`;
    $('#ed-preview').href = 'project.html#' + encodeURIComponent(p.slug || '');
    $('#ed-draft').textContent = 'Preview changes ↗';
    const r = p.responsibilities || {};
    const g = p.gallery || {};
    $('#edForm').innerHTML = `
      <fieldset><legend>Basics</legend>
        <div class="g2">${F('Project name *', 'title', p.title)}${F('URL name (slug)', 'slug', p.slug, { hint: 'Auto-filled from the name. Used in the link: project.html#slug' })}</div>
        <div class="g2">${F('Card one-liner', 'tagline', p.tagline, { hint: 'Shown under the name on the card and on the case study.' })}${F('Category', 'category', p.category, { ph: 'Entertainment · Series platform' })}</div>
        <div class="g3">${F('Type', 'type', p.type || 'mobile', { select: [['mobile', 'Mobile app'], ['web', 'Website'], ['both', 'Website + mobile app']] })}${F('Platform label', 'platform', p.platform, { ph: 'Mobile App' })}${F('Year', 'year', p.year)}</div>
        <div class="g3">${F('Status pill', 'status', p.status, { ph: 'Live on App Store' })}${F('Live link (optional)', 'liveUrl', p.liveUrl, { ph: 'https://…' })}<div style="display:flex;flex-direction:column;justify-content:flex-end">${C('It is live (green dot)', 'live', p.live)}${C('Show on the website', 'published', p.published !== false)}</div></div>
        ${F('Short summary (card)', 'summary', p.summary, { area: true, rows: 3 })}
      </fieldset>

      <fieldset><legend>Card images</legend>
        <p class="hint">App icon, then the phone screenshots visitors swipe through on the card (portrait, e.g. 1170×2532). For websites add desktop screenshots.</p>
        <div class="f">App icon</div>${imgList('icon', p.icon ? [p.icon] : [], 'sq', false, false)}
        <div class="f">Phone screens</div>${imgList('screens', p.screens || [])}
        <div class="f">Website screens</div>${imgList('webScreens', p.webScreens || [], 'wide')}
      </fieldset>

      <fieldset><legend>Case study header</legend>
        <div class="g2">${F('Big title', 'headline', p.headline, { ph: 'From content' })}${F('Italic blue part', 'headlineAccent', p.headlineAccent, { ph: 'to series.' })}</div>
        <div class="g3">${F('Accent colour', 'cover.tint', (p.cover && p.cover.tint) || '#2B3A8F', { type: 'color' })}${F('Big background word', 'cover.ghost', p.cover && p.cover.ghost, { ph: 'REDZ' })}${F('Tags (comma separated)', 'tags', (p.tags || []).join(', '))}</div>
        <div class="f">Cover image (optional — wide, replaces the device mock-up)</div>${imgList('cover.image', p.cover && p.cover.image ? [p.cover.image] : [], 'wide', false, false)}
        <div class="g3">${F('My role', 'role', p.role)}${F('Company / client', 'company', p.company)}${F('Team', 'team', p.team)}${F('Timeline', 'timeline', p.timeline)}${F('Platforms', 'platforms', p.platforms, { ph: 'iOS · Android' })}</div>
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

  function openSiteEditor() {
    editing = 0; mode = 'site';
    show('v-edit');
    $('#ed-title').innerHTML = 'Profile <em class="serif">&amp; links</em>';
    $('#ed-preview').href = 'index.html#contact';
    $('#ed-draft').textContent = 'Preview changes ↗';
    $$('.atabs button').forEach((b) => { const on = b.dataset.tab === 'profile'; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    const cvName = site.cv ? site.cv.split('/').pop() : 'none';
    $('#edForm').innerHTML = `
      <fieldset><legend>Photos</legend>
        <p class="hint">Portrait photos look best (about 4:5, at least 1000px tall). They are resized automatically. Leave empty to keep the current photo.</p>
        <div class="g2">
          <div><div class="f">Main photo (top of the page)</div>${imgList('photo', site.photo ? [site.photo] : [], 'wide', false, false)}</div>
          <div><div class="f">Second photo (About section)</div>${imgList('photo2', site.photo2 ? [site.photo2] : [], 'wide', false, false)}</div>
        </div>
      </fieldset>
      <fieldset><legend>Links</legend>
        <p class="hint">Leave a link empty to hide its button on the site.</p>
        <div class="g2">${F('Email', 'email', site.email, { type: 'email', ph: 'you@email.com' })}${F('WhatsApp number (with country code)', 'whatsapp', site.whatsapp, { ph: '970597323726' })}</div>
        <div class="g2">${F('LinkedIn URL', 'linkedin', site.linkedin, { ph: 'https://www.linkedin.com/in/…' })}${F('Behance URL', 'behance', site.behance, { ph: 'https://www.behance.net/…' })}</div>
        <div class="g2">${F('Dribbble URL', 'dribbble', site.dribbble, { ph: 'https://dribbble.com/…' })}${F('GitHub URL', 'github', site.github, { ph: 'https://github.com/…' })}</div>
      </fieldset>
      <fieldset><legend>Résumé (CV)</legend>
        <p class="hint">Current file: <b id="cvName">${esc(cvName)}</b>. Upload a new PDF to replace it — every “View My CV” button updates.</p>
        <label class="btn btn-ghost btn-sm" style="align-self:flex-start;cursor:pointer">Upload new CV (PDF)<input type="file" accept="application/pdf" id="cvInput" hidden></label>
      </fieldset>`;
    $('#cvInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) { toast('That PDF is too large (max 20 MB)'); return; }
      const fr = new FileReader();
      fr.onload = () => {
        const path = 'assets/cv-' + Date.now().toString(36) + '.pdf';
        pending.set(path, String(fr.result).split(',')[1]);
        previews.set(path, URL.createObjectURL(file));
        site.cv = path;
        $('#cvName').textContent = file.name + ' (new — publish to put it live)';
        setDirty(true);
      };
      fr.readAsDataURL(file);
    });
  }

  function openExpEditor(i, isNew) {
    editing = i; mode = 'exp';
    const x = experience[i];
    show('v-edit');
    $('#ed-title').innerHTML = isNew ? 'New <em class="serif">role</em>' : `Edit <em class="serif">${esc(x.company || 'role')}</em>`;
    $('#ed-preview').href = 'index.html#experience';
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
    if (mode === 'site') {
      $$('#edForm [data-k]').forEach((el) => { site[el.dataset.k] = el.value.trim(); });
      $$('#edForm [data-imgs]').forEach((box) => { const im = $('.im', box); site[box.dataset.imgs] = im ? im.dataset.path : ''; });
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
  form.addEventListener('change', async (e) => {
    const input = e.target;
    if (input.type !== 'file' || !input.files.length) return;
    const box = input.closest('[data-imgs]');
    if (!box) return;
    const cls = box.dataset.cls, lab = box.dataset.lab === '1', multi = box.dataset.multi === '1';
    const titleEl = $('[data-k="slug"]', form);
    const folder = mode === 'site' ? 'profile' : slugify((titleEl && titleEl.value) || ($('[data-k="title"]', form) || {}).value || 'project');
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

  $('#backList').addEventListener('click', () => { collect(); setDirty(changed()); if (mode === 'site') tab = 'projects'; renderList(); });
  $('#discard').addEventListener('click', () => {
    if (!window.confirm('Discard all unpublished changes?')) return;
    projects = JSON.parse(original); experience = JSON.parse(originalExp); site = JSON.parse(originalSite); pending.clear(); setDirty(false); if (tab === 'profile') tab = 'projects'; renderList();
  });

  /* ---------------- preview (nothing goes live) ---------------- */
  function openPreview(target) {
    collect();
    try {
      localStorage.setItem('pf-preview', JSON.stringify({ projects, experience, site, previews: Object.fromEntries(previews), ts: Date.now() }));
    } catch (e) { toast('Preview could not be prepared — try fewer or smaller images'); return; }
    window.open(target, '_blank');
  }
  $('#ed-draft').addEventListener('click', () => {
    if (mode === 'exp') return openPreview('index.html?preview=1#experience');
    if (mode === 'site') return openPreview('index.html?preview=1');
    const p = projects[editing];
    if (p && !p.slug) p.slug = slugify(p.title);
    openPreview('project.html?preview=1#' + encodeURIComponent((p && p.slug) || ''));
  });
  $('#previewHome').addEventListener('click', () => openPreview('index.html?preview=1'));
  $('#previewBtn').addEventListener('click', () => {
    if (editing >= 0 && (mode === 'project' || mode === 'site')) return $('#ed-draft').click();
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
      const cur = editing >= 0 ? (mode === 'exp' ? experience[editing] : mode === 'site' ? { title: 'profile & links' } : projects[editing]) : null;
      const label = cur ? `Update ${cur.title || cur.company}` : 'Update portfolio content';
      const newCommit = await (await gh(`${repoPath()}/git/commits`, { method: 'POST', body: JSON.stringify({ message: `${label} (via admin)`, tree: newTree.sha, parents: [baseCommit] }) })).json();
      await gh(`${repoPath()}/git/refs/heads/${encodeURIComponent(auth.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: newCommit.sha }) });

      original = JSON.stringify(projects);
      originalExp = JSON.stringify(experience);
      originalSite = JSON.stringify(site);
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
  if (auth && auth.token) loadData().catch((e) => { toast('Please sign in again'); clearAuth(); auth = null; initLogin(); });
  else initLogin();
})();
