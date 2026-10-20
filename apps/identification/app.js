(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'The smallest testable model', text: 'The app starts with one factor and three indicators.',
    question: 'How many degrees of freedom does it have?', options: ['0', '1', '3'], answer: 0,
    explain: 'Three variables give 3 × 4 / 2 = 6 knowns. With a marker loading fixed to 1, the model estimates 2 loadings, 3 error variances and 1 factor variance: 6 unknowns. df = 0, so the model is just-identified and its fit cannot be tested.' },
  { title: 'Add an indicator', text: 'Give the factor four indicators.',
    question: 'Now the degrees of freedom are…', options: ['1', '2', '4'], answer: 1,
    explain: '4 × 5 / 2 = 10 knowns; 3 free loadings + 4 error variances + 1 factor variance = 8 unknowns; df = 2.' },
  { title: 'A different way to set the scale', text: 'Switch the scaling method to "Fixed factor variance".',
    question: 'What happens to the degrees of freedom?', options: ['They go up', 'They stay the same', 'They go down'], answer: 1,
    explain: 'Fixing the variance instead of a loading swaps one fixed parameter for another. The model is equivalent and the fit is identical.' },
  { title: 'Passing the count is not enough', text: 'Set 2 factors with 2 indicators each. Open "More settings" and make the factors uncorrelated.',
    question: 'Is the model identified?', options: ['Yes, df is positive', 'No'], answer: 1,
    explain: 'Each two-indicator factor needs a non-zero correlation with another factor to be identified. The t-rule (df ≥ 0) is necessary but not sufficient: read the notes below the table.' }
]);

  const st = { type: 'cfa', k: 1, m: [3, 3, 3, 3, 3], scale: 'marker', structure: 'correlated', errCov: 0, cross: 0,
    nx: 2, ny: 2, paths: 4, distCov: 0 };
  const int = v => String(v);

  // Model type
  const typeSel = UI.select({ label: 'Type of model', value: 'cfa', options: [
    { value: 'cfa', label: 'Confirmatory factor analysis (CFA)' }, { value: 'path', label: 'Path model (observed variables only)' }],
    onChange: v => { st.type = v; document.getElementById('cfa-controls').hidden = v !== 'cfa'; document.getElementById('path-controls').hidden = v !== 'path'; document.getElementById('diagram-fig').hidden = v !== 'cfa'; render(); } });
  document.getElementById('type').appendChild(typeSel.el);

  // CFA controls
  const cfa = document.getElementById('cfa-controls');
  const kS = UI.slider({ label: 'Number of factors', min: 1, max: 5, step: 1, value: 1, format: int, onInput: v => { st.k = v; buildIndicatorSliders(); syncStructure(); render(); } });
  const indBox = h('fieldset', null, [h('legend', { text: 'Indicators per factor' })]);
  const indInner = h('div'); indBox.appendChild(indInner);
  const scaleSel = UI.select({ label: 'How each factor\'s scale is set', value: 'marker', options: [
    { value: 'marker', label: 'Marker variable: one loading fixed to 1 (Amos default)' }, { value: 'fixed', label: 'Fixed factor variance: variance fixed to 1' }],
    onChange: v => { st.scale = v; render(); } });
  const structSel = UI.select({ label: 'Relations among the factors', value: 'correlated', options: [
    { value: 'correlated', label: 'All factors correlated' }, { value: 'uncorrelated', label: 'Factors uncorrelated (orthogonal)' }, { value: 'second', label: 'A second-order factor explains them' }],
    onChange: v => { st.structure = v; render(); } });
  const ecS = UI.slider({ label: 'Error covariances added', min: 0, max: 10, step: 1, value: 0, format: int, hint: 'For example, freed after inspecting modification indices.', onInput: v => { st.errCov = v; render(); } });
  const crS = UI.slider({ label: 'Cross-loadings added', min: 0, max: 6, step: 1, value: 0, format: int, hint: 'Indicators that also load on a second factor.', onInput: v => { st.cross = v; render(); } });
  const moreBox = UI.more('More settings: relations among factors, error covariances, cross-loadings');
  moreBox.body.append(structSel.el, ecS.el, crS.el);
  cfa.append(kS.el, indBox, scaleSel.el, moreBox.el);
  function buildIndicatorSliders() {
    indInner.innerHTML = '';
    for (let j = 0; j < st.k; j++) {
      indInner.appendChild(UI.slider({ label: `Factor ${j + 1}`, min: 1, max: 8, step: 1, value: st.m[j], format: int, onInput: v => { st.m[j] = v; render(); } }).el);
    }
  }
  function syncStructure() {
    const opt = structSel.input.querySelector('option[value="second"]');
    opt.disabled = st.k < 2;
    if (st.k < 2 && st.structure !== 'correlated') { st.structure = 'correlated'; structSel.set('correlated'); }
  }

  // Path controls
  const pc = document.getElementById('path-controls');
  const nxS = UI.slider({ label: 'Exogenous variables (no arrows pointing in)', min: 1, max: 6, step: 1, value: st.nx, format: int, onInput: v => { st.nx = v; render(); } });
  const nyS = UI.slider({ label: 'Endogenous variables (at least one arrow in)', min: 1, max: 6, step: 1, value: st.ny, format: int, onInput: v => { st.ny = v; render(); } });
  const pS = UI.slider({ label: 'Directional paths (single-headed arrows)', min: 1, max: 30, step: 1, value: st.paths, format: int, onInput: v => { st.paths = v; render(); } });
  const dS = UI.slider({ label: 'Covariances between disturbances', min: 0, max: 10, step: 1, value: 0, format: int, onInput: v => { st.distCov = v; render(); } });
  pc.append(nxS.el, nyS.el, pS.el, dS.el, h('p', { class: 'small', text: 'Exogenous variables are assumed to be free to covary with each other, as Amos requires you to draw.' }));

  function countCFA() {
    const k = st.k, m = st.m.slice(0, k), p = m.reduce((a, b) => a + b, 0);
    const rows = [], warn = [];
    const second = st.structure === 'second' && k >= 2;
    const markerFirst = second ? true : st.scale === 'marker';
    rows.push(['Factor loadings (free)', p - (markerFirst ? k : 0), markerFirst ? `${p} loadings, ${k} fixed to 1` : `${p} loadings, all free`]);
    rows.push(['Error variances', p, 'One per indicator']);
    if (second) {
      rows.push(['Second-order loadings', st.scale === 'marker' ? k - 1 : k, st.scale === 'marker' ? 'One fixed to 1' : 'All free']);
      rows.push(['Second-order factor variance', st.scale === 'marker' ? 1 : 0, st.scale === 'marker' ? 'Free' : 'Fixed to 1']);
      rows.push(['Disturbances of first-order factors', k, 'One per first-order factor']);
    } else {
      rows.push(['Factor variances', markerFirst ? k : 0, markerFirst ? 'Free' : 'Fixed to 1']);
      rows.push(['Factor covariances', st.structure === 'correlated' ? k * (k - 1) / 2 : 0, st.structure === 'correlated' ? 'Every pair of factors' : 'Fixed to 0']);
    }
    if (st.errCov) rows.push(['Error covariances', st.errCov, 'Added']);
    if (st.cross) rows.push(['Cross-loadings', st.cross, 'Added']);
    const free = rows.reduce((a, r) => a + r[1], 0), knowns = p * (p + 1) / 2;

    m.forEach((mi, j) => {
      if (mi === 1) warn.push(`Factor ${j + 1} has one indicator. Its loading and error variance cannot both be estimated; you would have to fix the error variance (for example, from a known reliability).`);
      else if (mi === 2) {
        if (k === 1) warn.push('A single factor with two indicators is under-identified: three knowns cannot pay for its parameters.');
        else if (st.structure === 'uncorrelated') warn.push(`Factor ${j + 1} has only two indicators and is uncorrelated with the other factors, so it is not identified.`);
        else warn.push(`Factor ${j + 1} has two indicators. It is identified only through its non-zero correlation with another factor, so estimation can be unstable ("empirical under-identification").`);
      }
    });
    if (second && k === 2) warn.push('A second-order factor with only two first-order factors is under-identified at the higher level unless you add a constraint, such as equal second-order loadings.');
    if (second && k === 3) warn.push('With three first-order factors, the second-order part is just-identified: the model fits exactly as well as the correlated-factors model. Compare the df of the two.');
    if (k === 1 && m[0] === 3 && !st.errCov && !st.cross) warn.push('A one-factor model with three indicators is just-identified (df = 0), so its fit cannot be tested.');
    if (st.errCov || st.cross) warn.push('Added error covariances and cross-loadings can create identification problems even when df stays positive. Each should be justified by theory, not only by a modification index.');
    return { rows, free, knowns, p, warn };
  }

  function countPath() {
    const x = st.nx, y = st.ny, v = x + y;
    const maxRec = x * y + y * (y - 1) / 2;
    const rows = [
      ['Variances of exogenous variables', x, ''],
      ['Covariances among exogenous variables', x * (x - 1) / 2, 'Every pair'],
      ['Directional paths', st.paths, ''],
      ['Disturbance (residual) variances', y, 'One per endogenous variable']
    ];
    if (st.distCov) rows.push(['Disturbance covariances', st.distCov, '']);
    const warn = [];
    if (st.paths < y) warn.push('Each endogenous variable needs at least one path pointing into it.');
    if (st.paths > maxRec) warn.push(`More than ${maxRec} paths means the model must contain a feedback loop (a non-recursive model). Non-recursive models need extra conditions to be identified.`);
    else if (!st.distCov) warn.push('A recursive model (no feedback loops) with uncorrelated disturbances is always identified.');
    if (st.distCov) warn.push('Correlated disturbances can make a recursive model under-identified; check the specific pattern.');
    const free = rows.reduce((a, r) => a + r[1], 0), knowns = v * (v + 1) / 2;
    return { rows, free, knowns, p: v, warn };
  }

  function render() {
    const c = st.type === 'cfa' ? countCFA() : countPath();
    const df = c.knowns - c.free;
    UI.stats(document.getElementById('stats'), [
      { k: 'Observed variables (p)', v: String(c.p) },
      { k: 'Knowns: p(p + 1) / 2', v: String(c.knowns) },
      { k: 'Free parameters', v: String(c.free) },
      { k: 'Degrees of freedom', v: String(df) }
    ]);
    const status = document.getElementById('status'); status.innerHTML = '';
    let kind, text;
    if (df < 0) { kind = 'bad'; text = 'Under-identified: more unknowns than knowns. Amos will not estimate this model.'; }
    else if (df === 0) { kind = 'warn'; text = 'Just-identified: the model reproduces the data exactly, so its fit cannot be tested.'; }
    else { kind = 'good'; text = `Over-identified by the t-rule (df = ${df}): fit can be tested. Check the notes below for other conditions.`; }
    status.appendChild(h('p', null, [UI.badge(df < 0 ? 'Under-identified' : df === 0 ? 'Just-identified' : 'Over-identified', kind), ' ', text]));
    UI.table(document.getElementById('params'), { caption: 'Free parameters', rowHeader: true, head: ['Parameter type', 'Number free', 'Note'], leftCols: [2],
      rows: c.rows.map(r => [r[0], String(r[1]), r[2]]).concat([['Total', String(c.free), '']]) });
    const w = document.getElementById('warnings'); w.innerHTML = '';
    if (c.warn.length) w.appendChild(h('ul', null, c.warn.map(t => h('li', { text: t }))));
    if (st.type === 'cfa') drawCFA();
    UI.announce(`${c.knowns} knowns, ${c.free} free parameters, ${df} degrees of freedom. ${text}`);
  }

  function drawCFA() {
    const box = document.getElementById('diagram'); box.innerHTML = '';
    const k = st.k, m = st.m.slice(0, k), p = m.reduce((a, b) => a + b, 0);
    const second = st.structure === 'second' && k >= 2, markerFirst = second || st.scale === 'marker';
    const IW = 46, GAP = 18, W = Math.max(360, p * IW + (k - 1) * GAP + 40);
    const top = second ? 70 : (st.structure === 'correlated' && k > 1 ? 30 + (k - 1) * 14 : 20), fy = top + 70, iy = fy + 110, ey = iy + 80, H = ey + 40;
    const E = Chart.svgEl;
    const svg = E('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-labelledby': 'dg-t dg-d', style: `min-width:${Math.min(W, p * 34 + 60)}px` });
    E('title', { id: 'dg-t' }, svg).textContent = 'Path diagram of the CFA model';
    const desc = E('desc', { id: 'dg-d' }, svg);
    desc.textContent = `${k} factor${k > 1 ? 's' : ''} with ${m.join(', ')} indicators. ` + (second ? 'A second-order factor points to each first-order factor. ' : st.structure === 'correlated' && k > 1 ? 'All factors covary. ' : '') +
      (markerFirst ? 'The first loading of each factor is fixed to 1.' : 'Each factor variance is fixed to 1.');
    const defs = E('defs', null, svg);
    const mkr = E('marker', { id: 'arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    E('path', { d: 'M0,0L10,5L0,10Z', fill: 'var(--text)' }, mkr);
    const stroke = { stroke: 'var(--text)', 'stroke-width': 1.5, fill: 'none' };
    let x = 20, vi = 0; const fx = [];
    m.forEach((mi, j) => {
      const xs = []; for (let i = 0; i < mi; i++) { xs.push(x + IW / 2); x += IW; } x += GAP;
      const cx = (xs[0] + xs[xs.length - 1]) / 2; fx.push(cx);
      xs.forEach((ix, i) => {
        E('line', Object.assign({ x1: cx, y1: fy + 24, x2: ix, y2: iy - 18, 'marker-end': 'url(#arr)' }, stroke), svg);
        if (i === 0 && markerFirst) { const t = E('text', { x: (cx + ix) / 2 - 8, y: (fy + iy) / 2, 'font-size': 13, 'font-weight': 700, fill: 'var(--s2)' }, svg); t.textContent = '1'; }
        E('rect', { x: ix - 18, y: iy - 18, width: 36, height: 36, fill: 'var(--bg)', stroke: 'var(--text)', 'stroke-width': 1.5 }, svg);
        const t = E('text', { x: ix, y: iy + 5, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text)' }, svg);
        t.textContent = 'v' + (++vi);
        E('line', Object.assign({ x1: ix, y1: ey - 12, x2: ix, y2: iy + 18, 'marker-end': 'url(#arr)' }, stroke), svg);
        E('circle', { cx: ix, cy: ey, r: 12, fill: 'var(--bg)', stroke: 'var(--text)', 'stroke-width': 1.5 }, svg);
      });
      E('ellipse', { cx, cy: fy, rx: Math.min(56, Math.max(30, xs.length * IW / 2 - 4)), ry: 24, fill: 'var(--surface-2)', stroke: 'var(--s1)', 'stroke-width': 2 }, svg);
      const t = E('text', { x: cx, y: fy + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: 'var(--text)' }, svg); t.textContent = 'F' + (j + 1);
      if (!markerFirst && !second) { const v = E('text', { x: cx + 34, y: fy - 22, 'font-size': 12, 'font-weight': 700, fill: 'var(--s2)' }, svg); v.textContent = 'var = 1'; }
    });
    if (second) {
      const cx = (fx[0] + fx[fx.length - 1]) / 2, cy = top;
      fx.forEach((f, j) => {
        E('line', Object.assign({ x1: cx, y1: cy + 22, x2: f, y2: fy - 24, 'marker-end': 'url(#arr)' }, stroke), svg);
        if (j === 0 && st.scale === 'marker') { const t = E('text', { x: (cx + f) / 2 - 10, y: (cy + fy) / 2, 'font-size': 13, 'font-weight': 700, fill: 'var(--s2)' }, svg); t.textContent = '1'; }
      });
      E('ellipse', { cx, cy, rx: 60, ry: 22, fill: 'var(--surface-2)', stroke: 'var(--s4)', 'stroke-width': 2 }, svg);
      const t = E('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: 'var(--text)' }, svg); t.textContent = 'Higher-order';
    } else if (st.structure === 'correlated' && k > 1) {
      for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) {
        const x1 = fx[a], x2 = fx[b], lift = 18 + (b - a) * 14;
        E('path', Object.assign({ d: `M${x1},${fy - 24} C${x1},${fy - 24 - lift} ${x2},${fy - 24 - lift} ${x2},${fy - 24}`, 'marker-end': 'url(#arr)', 'marker-start': 'url(#arr)' }, stroke), svg);
      }
    }
    box.appendChild(svg);
  }

  buildIndicatorSliders(); syncStructure(); render();
})();
