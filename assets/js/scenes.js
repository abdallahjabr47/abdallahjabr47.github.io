/* Animated backgrounds for the cover on each case-study page — one scene per kind of product.
   Plain HTML/SVG animated with CSS, tinted by the project's colour (--tint). */
(function () {
  const rows = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
  const S = {};
  S.currency = () => `
    ${rows(12, (i) => `<i class="sc-float" style="--x:${(i * 83) % 96 + 2}%;--d:${9 + (i % 5) * 2}s;--dl:-${(i * 1.7).toFixed(1)}s;--s:${(0.7 + (i % 4) * 0.35).toFixed(2)};--b:${i % 3 === 0 ? 3 : 0}px">${['$', '€', '£', '¥', '₪', 'JD', '₹', '₩'][i % 8]}</i>`)}
    <svg class="sc-chart" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M0 96 L40 88 L80 92 L120 70 L160 76 L200 52 L240 60 L280 36 L320 44 L360 20 L400 26"/></svg>
    <span class="sc-pill bob" style="--x:6%;--y:30%">USD → JOD <b>0.7455</b> <em>▲</em></span>`;
  S.clock = () => `
    <svg class="sc-dial" viewBox="0 0 200 200" aria-hidden="true">
      <circle class="d1" cx="100" cy="100" r="96"/><circle class="d2" cx="100" cy="100" r="74"/><circle class="d3" cx="100" cy="100" r="52"/>
      <line class="hand" x1="100" y1="100" x2="100" y2="16"/><circle class="hub" cx="100" cy="100" r="3"/>
    </svg>
    ${[['Jerusalem', '10:29', 6, 30], ['New York', '03:29', 74, 26], ['Seoul', '05:29', 4, 60], ['London', '08:29', 78, 56]].map(([c, t, x, y], i) => `<span class="sc-pill bob" style="--x:${x}%;--y:${y}%;--dl:-${i * 1.3}s">${c} <b>${t}</b></span>`).join('')}`;
  S.series = () => `<div class="sc-strips">${[0, 1, 2].map((k) => `<div class="strip${k % 2 ? ' rev' : ''}">${rows(16, (i) => `<span class="ep"><i>▶</i><b>EP ${String((i % 8) + 1).padStart(2, '0')}</b></span>`)}</div>`).join('')}</div>`;
  S.meetups = () => {
    const pts = [[14, 36], [84, 32], [10, 70], [88, 66], [50, 20]];
    return `<svg class="sc-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${pts.slice(0, 4).map(([x, y]) => `<line x1="50" y1="20" x2="${x}" y2="${y}"/>`).join('')}</svg>
    ${pts.map(([x, y], i) => `<span class="sc-pin" style="--x:${x}%;--y:${y}%;--dl:-${i * 0.7}s"><i>${'AMLRS'[i]}</i></span>`).join('')}`;
  };
  S.careers = () => `${[['Internship', 4, 30], ['Full-time', 76, 26], ['Training', 6, 62], ['Volunteer', 78, 58]].map(([t, x, y], i) => `<span class="sc-job bob" style="--x:${x}%;--y:${y}%;--dl:-${i * 1.1}s"><i></i><b></b><s>${t}</s></span>`).join('')}`;
  S.onboarding = () => `<div class="sc-steps">${['Sign up', 'Verify', 'Profile', 'Welcome'].map((t, i) => `<span style="--i:${i}"><i>✓</i>${t}</span>`).join('')}</div>`;
  S.cafe = () => `<svg class="sc-steam" viewBox="0 0 120 160" aria-hidden="true">${[20, 55, 90].map((x, i) => `<path style="--dl:-${i * 1.2}s" d="M${x} 150 C${x - 14} 120 ${x + 14} 100 ${x} 70 S${x - 12} 30 ${x} 10"/>`).join('')}</svg>
    ${rows(9, (i) => `<i class="sc-bean" style="--x:${(i * 71) % 92 + 3}%;--y:${(i * 37) % 70 + 8}%;--rot:${i * 40}deg;--dl:-${i}s"></i>`)}`;
  S.auction = () => rows(9, (i) => `<i class="sc-float sm" style="--x:${(i * 79) % 90 + 4}%;--d:${8 + (i % 4) * 2}s;--dl:-${(i * 1.9).toFixed(1)}s;--s:1;--b:0px">+${[50, 120, 80, 200, 35, 150, 90, 60, 300][i]} pts</i>`);
  S.health = () => `<svg class="sc-ecg" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M0 60 H120 L135 60 L145 30 L158 88 L170 18 L182 60 H260 L272 60 L280 44 L290 72 L298 60 H400"/></svg>`;
  S.city = () => `${[[12, 30], [84, 26], [8, 64], [88, 60]].map(([x, y], i) => `<span class="sc-pin" style="--x:${x}%;--y:${y}%;--dl:-${i * 0.8}s"><i>⌂</i></span>`).join('')}
    ${[[20, 46], [74, 42]].map(([x, y], i) => `<span class="sc-qr bob" style="--x:${x}%;--y:${y}%;--dl:-${i * 2}s"></span>`).join('')}`;
  const arrow = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 1.5l5 12.5 1.9-5.1 5.1-1.9z"/></svg>';
  S.build = () => `<div class="sc-grid"></div>
    <div class="sc-sel"><i></i><i></i><i></i><i></i><span>Case study</span></div>
    <span class="sc-code bob" style="--x:74%;--y:24%;--dl:-2s"><span class="sc-type">&lt;CaseStudy live /&gt;</span></span>
    <span class="sc-pill sc-save bob" style="--x:5%;--y:62%;--dl:-4s"><em>●</em> Saved · published</span>
    ${[[80, 52, 0], [10, 40, 1], [86, 70, 2]].map(([x, y, i]) => `<span class="sc-blk" style="--x:${x}%;--y:${y}%;--i:${i}"><i></i><b></b><b></b></span>`).join('')}`;
  S.quiz = () => `${rows(10, (i) => `<i class="sc-float" style="--x:${(i * 87) % 94 + 3}%;--d:${10 + (i % 4) * 2}s;--dl:-${(i * 1.6).toFixed(1)}s;--s:${(0.8 + (i % 3) * 0.4).toFixed(2)};--b:${i % 3 === 1 ? 3 : 0}px">${['؟', '?', '+50', '؟', '+45'][i % 5]}</i>`)}
    <div class="sc-opts" dir="rtl">${['أ', 'ب', 'ج', 'د'].map((t, i) => `<span class="${i === 2 ? 'ok' : ''}" style="--i:${i}">${t}</span>`).join('')}</div>
    <svg class="sc-timer" viewBox="0 0 100 100" aria-hidden="true"><circle class="t0" cx="50" cy="50" r="44"/><circle class="t1" cx="50" cy="50" r="44" pathLength="1"/><text x="50" y="58" text-anchor="middle">⏱</text></svg>`;
  S.boxing = () => `${rows(5, (i) => `<i class="sc-streak" style="--y:${18 + i * 15}%;--dl:-${(i * 0.9).toFixed(1)}s;--w:${30 + (i % 3) * 14}%"></i>`)}
    ${[[9, 44], [91, 30], [92, 64], [7, 72]].map(([x, y], i) => `<span class="sc-hit" style="--x:${x}%;--y:${y}%;--dl:-${(i * 0.65).toFixed(2)}s"></span>`).join('')}
    <span class="sc-pill sc-round bob" style="--x:5%;--y:24%"><em>●</em> ROUND 3 <b>02:59</b></span>`;
  const TOP = { build: () => `<span class="sc-cur c1">${arrow}<b>Abdallah</b></span><span class="sc-cur c2">${arrow}<b>Claude</b></span>` };
  S.aurora = () => `<span class="sc-blob b1"></span><span class="sc-blob b2"></span><span class="sc-blob b3"></span>`;
  const BY_SLUG = { xchange: 'currency', worldclockr: 'clock', redz: 'series', 'momyt-meet': 'meetups', foras: 'careers', ruckaroo: 'onboarding', 'sip-cafe': 'cafe', mazadak: 'auction', afyti: 'health', minicity: 'city', 'portfolio-site': 'build', 'shoof-hazzak': 'quiz', boxchampy: 'boxing' };
  window.Scenes = {
    list: [['auto', 'Automatic'], ['currency', 'Money / exchange'], ['clock', 'Time / clocks'], ['series', 'Video / series'], ['meetups', 'People / meetups'], ['careers', 'Jobs / opportunities'], ['onboarding', 'Steps / onboarding'], ['cafe', 'Café / food'], ['auction', 'Auction / bids'], ['health', 'Health'], ['city', 'Map / places'], ['build', 'Design / build'], ['quiz', 'Quiz / game'], ['boxing', 'Sport / boxing'], ['aurora', 'Soft light']],
    key: (p) => (p.scene && p.scene !== 'auto' && S[p.scene]) ? p.scene : (BY_SLUG[p.slug] || 'aurora'),
    html: (p) => { const k = window.Scenes.key(p); return `<div class="sc sc-${k}" aria-hidden="true">${S[k]()}</div>${TOP[k] ? `<div class="sc sc-top sc-${k}" aria-hidden="true">${TOP[k]()}</div>` : ''}`; }
  };
})();
