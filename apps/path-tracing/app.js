(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'Trace the routes', text: 'Only a1 (X1 → M), b (M → Y) and c1 (X1 → Y) are switched on. Look at the decomposition of r(X1, Y).',
    question: 'What is the implied correlation between X1 and Y?', options: ['.10', '.20', '.30'], answer: 2,
    explain: 'There are two routes: the direct path c1 = .10, and the indirect route a1 × b = .50 × .40 = .20. Together they give .30.' },
  { title: 'Remove the direct path', text: 'Untick "Include this path" for c1.',
    question: 'Now r(X1, Y) is…', options: ['.20', '0', '.10'], answer: 0,
    explain: 'Only the indirect route is left. Notice that the model now has one degree of freedom: one path has been fixed to zero.' },
  { title: 'Spurious association', text: 'Switch c1 back on and choose r(M, Y) in the decomposition.',
    question: 'Part of r(M, Y) is labelled spurious because…', options: ['X1 is a common cause of M and Y', 'M causes X1', 'of measurement error'], answer: 0,
    explain: 'The route M ← X1 → Y links M and Y through a shared cause, not through any effect of M on Y. A raw correlation between a mediator and an outcome mixes both.' },
  { title: 'A second predictor', text: 'Open "More settings", switch on X1 ↔ X2 and a2, and look at r(X1, Y) again.',
    question: 'What kind of route has appeared?', options: ['Unanalysed (through the X1–X2 correlation)', 'Another direct effect'], answer: 0,
    explain: 'Routes that pass through a curved, two-headed arrow are unanalysed: the model says X1 and X2 are related but not why.' }
]);

  const P = {
    r12: { label: 'X1 ↔ X2 (correlation)', value: 0.3, on: false, from: 'X1', to: 'X2', curved: true },
    a1: { label: 'a1: X1 → M', value: 0.5, on: true, from: 'X1', to: 'M' },
    a2: { label: 'a2: X2 → M', value: 0.2, on: false, from: 'X2', to: 'M' },
    b: { label: 'b: M → Y', value: 0.4, on: true, from: 'M', to: 'Y' },
    c1: { label: 'c1: X1 → Y', value: 0.1, on: true, from: 'X1', to: 'Y' },
    c2: { label: 'c2: X2 → Y', value: 0.0, on: false, from: 'X2', to: 'Y' }
  };
  const v = k => P[k].on ? P[k].value : 0;
  const box = document.getElementById('controls');
  const moreBox = UI.more('More settings: a second predictor, X2');
  for (const k of ['a1', 'b', 'c1', 'r12', 'a2', 'c2']) {
    const fs = h('fieldset', null, [h('legend', { text: P[k].label })]);
    const cb = UI.checkbox({ label: 'Include this path', checked: P[k].on, onChange: on => { P[k].on = on; sl.input.disabled = !on; render(); } });
    const sl = UI.slider({ label: 'Value', min: -0.9, max: 0.9, step: 0.05, value: P[k].value, format: x => S.fmt(x, 2), onInput: x => { P[k].value = x; render(); } });
    sl.input.disabled = !P[k].on;
    fs.append(cb.el, sl.el); (['r12', 'a2', 'c2'].includes(k) ? moreBox.body : box).appendChild(fs);
  }
  box.appendChild(moreBox.el);

  const VARS = ['X1', 'X2', 'M', 'Y'];
  function routes() {
    const r12 = v('r12'), a1 = v('a1'), a2 = v('a2'), b = v('b'), c1 = v('c1'), c2 = v('c2');
    const R = (route, type, terms, val) => ({ route, type, terms, val });
    return {
      'X1|X2': [R('X1 ↔ X2', 'Unanalysed', 'r12', r12)],
      'X1|M': [R('X1 → M', 'Direct', 'a1', a1), R('X1 ↔ X2 → M', 'Unanalysed', 'r12 × a2', r12 * a2)],
      'X2|M': [R('X2 → M', 'Direct', 'a2', a2), R('X2 ↔ X1 → M', 'Unanalysed', 'r12 × a1', r12 * a1)],
      'X1|Y': [R('X1 → Y', 'Direct', 'c1', c1), R('X1 → M → Y', 'Indirect', 'a1 × b', a1 * b), R('X1 ↔ X2 → Y', 'Unanalysed', 'r12 × c2', r12 * c2), R('X1 ↔ X2 → M → Y', 'Unanalysed', 'r12 × a2 × b', r12 * a2 * b)],
      'X2|Y': [R('X2 → Y', 'Direct', 'c2', c2), R('X2 → M → Y', 'Indirect', 'a2 × b', a2 * b), R('X2 ↔ X1 → Y', 'Unanalysed', 'r12 × c1', r12 * c1), R('X2 ↔ X1 → M → Y', 'Unanalysed', 'r12 × a1 × b', r12 * a1 * b)],
      'M|Y': [R('M → Y', 'Direct', 'b', b), R('M ← X1 → Y', 'Spurious', 'a1 × c1', a1 * c1), R('M ← X2 → Y', 'Spurious', 'a2 × c2', a2 * c2), R('M ← X1 ↔ X2 → Y', 'Spurious', 'a1 × r12 × c2', a1 * r12 * c2), R('M ← X2 ↔ X1 → Y', 'Spurious', 'a2 × r12 × c1', a2 * r12 * c1)]
    };
  }
  const pairs = Object.keys(routes());
  const pairSel = UI.select({ label: 'Correlation to decompose', value: 'X1|Y', options: pairs.map(p => ({ value: p, label: 'r(' + p.replace('|', ', ') + ')' })), onChange: () => render() });
  document.getElementById('pair').appendChild(pairSel.el);

  function implied() {
    const rt = routes(), R = {};
    for (const p of pairs) R[p] = rt[p].reduce((s, x) => s + x.val, 0);
    const r12 = v('r12'), a1 = v('a1'), a2 = v('a2'), b = v('b'), c1 = v('c1'), c2 = v('c2');
    const r2M = a1 * a1 + a2 * a2 + 2 * a1 * a2 * r12;
    const r2Y = c1 * R['X1|Y'] + c2 * R['X2|Y'] + b * R['M|Y'];
    return { R, r2M, r2Y, rt };
  }

  function drawDiagram() {
    const E = Chart.svgEl, W = 560, H = 300;
    const pos = { X1: [70, 70], X2: [70, 230], M: [280, 150], Y: [490, 150] };
    const boxEl = document.getElementById('diagram'); boxEl.innerHTML = '';
    const svg = E('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-labelledby': 'pd-t pd-d' });
    E('title', { id: 'pd-t' }, svg).textContent = 'Path diagram';
    E('desc', { id: 'pd-d' }, svg).textContent = Object.keys(P).map(k => `${P[k].label}: ${P[k].on ? S.fmt(P[k].value, 2) : 'removed'}`).join('; ') + '.';
    const defs = E('defs', null, svg);
    const mk = E('marker', { id: 'pa', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
    E('path', { d: 'M0,0L10,5L0,10Z', fill: 'var(--text)' }, mk);
    const RAD = 30;
    const edge = (a, b2) => {
      const [x1, y1] = pos[a], [x2, y2] = pos[b2], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
      return [x1 + dx / L * RAD, y1 + dy / L * RAD, x2 - dx / L * (RAD + 2), y2 - dy / L * (RAD + 2)];
    };
    for (const k of Object.keys(P)) {
      const p = P[k], w = p.on ? 1.2 + Math.abs(p.value) * 5 : 1.2;
      const st = { stroke: p.on ? 'var(--text)' : 'var(--muted)', 'stroke-width': w, fill: 'none', 'stroke-dasharray': p.on ? null : '2 5', opacity: p.on ? 1 : 0.6 };
      let lx, ly;
      if (p.curved) {
        E('path', Object.assign({ d: `M${pos.X1[0] - 30},${pos.X1[1] + 10} C${-10},${120} ${-10},${180} ${pos.X2[0] - 30},${pos.X2[1] - 10}`, 'marker-end': 'url(#pa)', 'marker-start': 'url(#pa)' }, st), svg);
        lx = 26; ly = 154;
      } else {
        const [x1, y1, x2, y2] = edge(p.from, p.to);
        if (k === 'c1' || k === 'c2') {
          const cy = k === 'c1' ? 20 : 280;
          E('path', Object.assign({ d: `M${x1},${y1} Q${280},${cy} ${x2},${y2}`, 'marker-end': 'url(#pa)' }, st), svg);
          lx = 280; ly = k === 'c1' ? 50 : 262;
        } else {
          E('line', Object.assign({ x1, y1, x2, y2, 'marker-end': 'url(#pa)' }, st), svg);
          lx = (x1 + x2) / 2; ly = (y1 + y2) / 2 - 10;
        }
      }
      const lbl = k === 'r12' ? 'r12' : k;
      const t = E('text', { x: lx, y: ly, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: p.on ? 'var(--s2)' : 'var(--muted)', 'paint-order': 'stroke', stroke: 'var(--bg)', 'stroke-width': 4 }, svg);
      t.textContent = p.on ? `${lbl} = ${S.fmt(p.value, 2)}` : `${lbl} removed`;
    }
    for (const n of VARS) {
      E('rect', { x: pos[n][0] - RAD, y: pos[n][1] - 22, width: RAD * 2, height: 44, rx: 4, fill: 'var(--surface-2)', stroke: 'var(--s1)', 'stroke-width': 2 }, svg);
      const t = E('text', { x: pos[n][0], y: pos[n][1] + 5, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: 'var(--text)' }, svg); t.textContent = n;
    }
    boxEl.appendChild(svg);
  }

  function render() {
    drawDiagram();
    const im = implied(), inv = document.getElementById('invalid');
    const bad = [];
    if (im.r2M > 1) bad.push(`M would have R² = ${S.fmt(im.r2M, 2)}, more than 1`);
    if (im.r2Y > 1) bad.push(`Y would have R² = ${S.fmt(im.r2Y, 2)}, more than 1`);
    inv.hidden = !bad.length;
    if (bad.length) inv.textContent = `These values are impossible for standardised variables: ${bad.join(' and ')}. Reduce some paths.`;
    const removed = Object.keys(P).filter(k => !P[k].on).length;
    UI.stats(document.getElementById('stats'), [
      { k: 'R² for M', v: S.fmtNoZero(im.r2M, 3) }, { k: 'R² for Y', v: S.fmtNoZero(im.r2Y, 3) },
      { k: 'Paths removed', v: String(removed) }, { k: 'Model df', v: String(removed) }
    ]);
    const M = VARS.map(a => VARS.map(b => a === b ? 1 : (im.R[a + '|' + b] !== undefined ? im.R[a + '|' + b] : im.R[b + '|' + a])));
    UI.table(document.getElementById('matrix'), { caption: 'Implied correlation matrix', rowHeader: true, head: [''].concat(VARS),
      rows: VARS.map((a, i) => [a].concat(M[i].map((x, j) => j > i ? '' : S.fmt(x, 2)))) });
    const p = pairSel.value, list = im.rt[p];
    const types = ['Direct', 'Indirect', 'Spurious', 'Unanalysed'];
    const totals = types.map(t => list.filter(x => x.type === t).reduce((s, x) => s + x.val, 0));
    UI.table(document.getElementById('decomp'), { caption: `Routes contributing to r(${p.replace('|', ', ')})`, rowHeader: true, head: ['Route', 'Type', 'Product', 'Value'], leftCols: [1, 2],
      rows: list.map(x => [x.route, x.type, x.terms, S.fmt(x.val, 2)]).concat([['Total (implied r)', '', '', S.fmt(im.R[p], 2)]]) });
    const dec = document.getElementById('decomp');
    dec.appendChild(h('p', { text: types.map((t, i) => list.some(x => x.type === t) ? `${t}: ${S.fmt(totals[i], 3)}` : null).filter(Boolean).join(' · ') }));
    UI.announce(`Implied r(${p.replace('|', ', ')}) = ${S.fmt(im.R[p], 3)}.`);
  }
  render();
})();
