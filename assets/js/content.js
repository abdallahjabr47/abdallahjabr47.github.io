/* Editable page text. Every visible text on the home page gets a stable key, so the admin can
   change any wording or hide any section without touching code. Overrides live in data/content.json.
   Loaded before core.js so text is in place before headings are split and animated.
   Text syntax used in the admin:  *word*  = blue italic accent,  **words** = highlighted,  new line = line break. */
(function (root) {
  const ALLOWED = (n) => n.nodeType === 3 || n.nodeType === 8 || (n.nodeType === 1 && (
    n.tagName === 'EM' || n.tagName === 'BR' || n.tagName === 'SUP' ||
    (n.tagName === 'SPAN' && /\b(hl|arr|pm)\b/.test(n.className)) || (n.tagName === 'SPAN' && n.hasAttribute('data-count'))));
  const KEEP = (n) => n.nodeType === 1 && n.tagName === 'SPAN' && /\b(arr|pm)\b/.test(n.className);
  const SKIP = '.ph, [data-site-text], .cpill, .clock, #projects, #xp, #indexList, #hoverPreview, #testi, .tilt, .sparks, .orbits, .badge-ring, svg, script, style, .sp-arrow, .phone, .cursor-ring, [data-c-skip]';
  const ITEM = '.faq-item, .stat, .sk-card, .tool, .item, .edu, .pr, .pm-card, .role-card, .cpill, li';
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'x';

  function toText(el) {
    let out = '';
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) out += n.textContent;
      else if (n.nodeType !== 1 || KEEP(n)) return;
      else if (n.tagName === 'BR') out += '\n';
      else if (n.tagName === 'EM') out += '*' + n.textContent + '*';
      else if (n.tagName === 'SPAN' && n.classList.contains('hl')) out += '**' + n.textContent + '**';
      else if (n.hasAttribute && n.hasAttribute('data-count')) out += n.getAttribute('data-count');
      else out += n.textContent;
    });
    return out.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
  }

  function sections(doc) {
    const main = doc.querySelector('main');
    if (!main) return [];
    const used = {};
    return Array.from(main.children).filter((s) => /^(SECTION|DIV)$/.test(s.tagName) && s.textContent.trim()).map((s, i) => {
      const eb = s.querySelector('.eyebrow');
      let key = s.id || (eb ? slug(eb.textContent) : '') || slug(s.getAttribute('aria-label') || '') || 'section-' + i;
      if (used[key]) key += '-' + (++used[key]); else used[key] = 1;
      const h = s.querySelector('h1, h2');
      const NAMES = { hero: 'Top of the page (hero)', tools: 'Tools strip', work: 'Selected work (titles)', screens: 'Screens wall', process: 'Process animation', about: 'About', product: 'Product management', experience: 'Experience (titles)', skills: 'Skills', testimonials: 'Testimonials (titles)', faq: 'FAQ', contact: 'Contact' };
      const name = NAMES[s.id] || (eb && eb.textContent.trim()) || (h && h.textContent.trim()) || s.getAttribute('aria-label') || key;
      return { el: s, key, name };
    });
  }

  function fields(sec) {
    const picked = [];
    const seen = {};
    sec.el.querySelectorAll('*').forEach((el) => {
      if (el.closest(SKIP)) return;
      if (picked.some((p) => p.el.contains(el))) return;
      const kids = Array.from(el.childNodes);
      if (!kids.length || !kids.every(ALLOWED)) return;
      const txt = toText(el);
      if (!txt || txt.length < 2) return;
      let key = sec.key + ':' + el.tagName.toLowerCase() + ':' + slug(txt);
      if (seen[key]) key += '-' + (++seen[key]); else seen[key] = 1;
      const kind = /^H[1-3]$/.test(el.tagName) ? 'Heading' : el.classList.contains('eyebrow') ? 'Label' : el.classList.contains('btn') || el.tagName === 'BUTTON' ? 'Button / question' : el.closest('.stat') && el.tagName === 'B' ? 'Number' : el.tagName === 'SMALL' ? 'Small text' : txt.length > 90 ? 'Paragraph' : 'Text';
      picked.push({ el, key, text: txt, kind });
    });
    return picked;
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function setText(el, value) {
    const item = el.closest(ITEM) || el;
    if (!String(value).trim()) { item.hidden = true; return; }
    item.hidden = false;
    const keep = Array.from(el.childNodes).filter(KEEP).map((n) => n.cloneNode(true));
    if (el.tagName === 'B' && el.closest('.stat')) {
      const m = String(value).trim().match(/^(\d+(?:\.\d+)?)(.*)$/);
      el.innerHTML = m ? `<span data-count="${m[1]}">0</span>${esc(m[2]).replace(/\+$/, '<sup>+</sup>')}` : esc(value);
      return;
    }
    const brClass = (el.querySelector('br') || {}).className || '';
    el.innerHTML = esc(value)
      .replace(/\*\*(.+?)\*\*/g, '<span class="hl">$1</span>')
      .replace(/\*(.+?)\*/g, '<em class="serif">$1</em>')
      .replace(/\n/g, brClass ? `<br class="${brClass}">` : '<br>');
    keep.forEach((k) => el.appendChild(k));
  }

  function apply(doc, data) {
    if (!data) return;
    const hidden = data.hidden || [], text = data.text || {};
    sections(doc).forEach((sec) => {
      if (hidden.includes(sec.key)) {
        sec.el.hidden = true;
        if (sec.el.id) doc.querySelectorAll(`a[href="#${sec.el.id}"]`).forEach((a) => { if (a.closest('nav')) a.hidden = true; });
        return;
      }
      fields(sec).forEach((f) => { if (Object.prototype.hasOwnProperty.call(text, f.key)) setText(f.el, text[f.key]); });
    });
  }

  root.SiteContent = { sections, fields, apply, toText };

  /* on the site itself: apply overrides right away (preview draft first, then data/content.json) */
  if (root.document && document.querySelector('main') && !/admin\.html/.test(location.pathname)) {
    let data = null;
    if (/[?&]preview\b/.test(location.search)) { try { const d = JSON.parse(localStorage.getItem('pf-preview') || 'null'); if (d && d.content) data = d.content; } catch (e) {} }
    if (!data) {
      try {
        const x = new XMLHttpRequest();
        x.open('GET', 'data/content.json?v=' + Date.now(), false);
        x.send();
        if (x.status === 200) data = JSON.parse(x.responseText);
      } catch (e) {}
    }
    apply(document, data);
  }
})(window);
