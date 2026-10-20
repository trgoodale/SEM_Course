(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'Fit a line by eye', text: 'Move the intercept and slope sliders (or drag the two round handles) until your line follows the points as well as you can. Watch "Your SSE".',
    question: 'Could your SSE ever be smaller than the least-squares SSE?', options: ['Yes, with a careful enough fit', 'No, never'], answer: 1,
    explain: 'The least-squares line is defined as the line with the smallest possible sum of squared residuals, so no other line can beat it. The best you can do is equal it.' },
  { title: 'Compare with least squares', text: 'Tick "Least-squares line" under Show.',
    question: 'The least-squares line always passes through which point?', options: ['(0, 0)', 'The point (mean of x, mean of y)', 'The first data point'], answer: 1,
    explain: 'The intercept is a = mean(y) − b × mean(x), so at x = mean(x) the line gives exactly mean(y).' },
  { title: 'One unusual point', text: 'You are about to press "Add an outlier", which adds one low point at the far right (x = 11).',
    question: 'What will happen to the least-squares slope?', options: ['It gets steeper', 'It gets flatter', 'It stays the same'], answer: 1,
    explain: 'A point far from the mean of x has high leverage: it pulls the line towards itself. A low point at the right-hand end drags the slope down. Press the button to check.' },
  { title: 'Where the slope comes from', text: 'Open "Least-squares solution" below the chart.',
    question: 'If every y value were doubled, the slope would…', options: ['halve', 'double', 'stay the same'], answer: 1,
    explain: 'Doubling y doubles cov(x, y) but leaves var(x) unchanged, so b = cov(x, y) / var(x) doubles. The slope depends only on the variances and covariance.' }
]);

  const X_RANGE = [0, 12], Y_RANGE = [-4, 16];
  const state = { a: 1, b: 1, seed: 7, pts: [], outlier: false, showRes: true, showSq: false, showLS: false };

  function makeData() {
    const r = S.rng(state.seed), pts = [];
    for (let i = 0; i < 15; i++) {
      const x = 0.5 + r() * 10;
      pts.push([+(x).toFixed(2), +(2 + 0.6 * x + r.normal() * 1.3).toFixed(2)]);
    }
    pts.sort((p, q) => p[0] - q[0]);
    state.pts = pts;
  }
  function data() { return state.outlier ? state.pts.concat([[11, -1.5]]) : state.pts; }

  function lsFit(pts) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const b = S.cov(xs, ys) / S.variance(xs), a = S.mean(ys) - b * S.mean(xs);
    return { a, b, cov: S.cov(xs, ys), varx: S.variance(xs), mx: S.mean(xs), my: S.mean(ys), r: S.cor(xs, ys) };
  }
  function sse(pts, a, b) { return pts.reduce((s, p) => s + Math.pow(p[1] - (a + b * p[0]), 2), 0); }

  // Controls
  const fmt2 = v => S.fmt(v, 2);
  const aS = UI.slider({ label: 'Intercept (a)', min: -4, max: 10, step: 0.05, value: state.a, format: fmt2, onInput: v => { state.a = v; render(); } });
  const bS = UI.slider({ label: 'Slope (b)', min: -1.5, max: 2.5, step: 0.01, value: state.b, format: fmt2, onInput: v => { state.b = v; render(); } });
  document.getElementById('line-controls').append(aS.el, bS.el);

  const showBox = document.getElementById('show-controls');
  showBox.append(
    UI.checkbox({ label: 'Residuals', checked: true, onChange: v => { state.showRes = v; render(); } }).el,
    UI.checkbox({ label: 'Squared residuals as squares', onChange: v => { state.showSq = v; render(); } }).el,
    UI.checkbox({ label: 'Least-squares line', onChange: v => { state.showLS = v; render(true); } }).el
  );

  const outlierBtn = UI.button('Add an outlier', () => {
    state.outlier = !state.outlier;
    outlierBtn.textContent = state.outlier ? 'Remove the outlier' : 'Add an outlier';
    rebuildPointSelect(); render(true);
  }, 'secondary');
  document.getElementById('data-buttons').append(
    UI.button('New data', () => { state.seed = S.newSeed(); state.outlier = false; outlierBtn.textContent = 'Add an outlier'; makeData(); rebuildPointSelect(); render(true); }, 'secondary'),
    outlierBtn,
    UI.button('Snap my line to least squares', () => { const f = lsFit(data()); state.a = f.a; state.b = f.b; aS.set(+f.a.toFixed(2), true); bS.set(+f.b.toFixed(2), true); state.a = aS.value; state.b = bS.value; render(true); }, 'secondary')
  );

  // Keyboard-accessible way to move a point
  const pc = document.getElementById('point-controls');
  let pointSel, pointY;
  function rebuildPointSelect() {
    pc.innerHTML = '';
    const pts = data();
    pointSel = UI.select({ label: 'Move a point', options: pts.map((p, i) => ({ value: String(i), label: `Point ${i + 1} (x = ${S.fmt(p[0], 1)})` })), value: '0',
      onChange: () => pointY.set(pts[+pointSel.value][1], true) });
    pointY = UI.slider({ label: 'Its y value', min: Y_RANGE[0], max: Y_RANGE[1], step: 0.1, value: pts[0][1], format: v => S.fmt(v, 1), onInput: v => setPointY(+pointSel.value, v) });
    pc.append(pointSel.el, pointY.el);
  }
  function setPointY(i, v) {
    if (state.outlier && i === state.pts.length) return; // the outlier is fixed
    state.pts[i][1] = v; render();
  }

  // Dragging (pointer) for handles and points
  const chartBox = document.getElementById('chart');
  let drag = null, chart = null;
  const HX = [1, 11];
  function svgPoint(ev) {
    const svg = chartBox.querySelector('svg'); const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  chartBox.addEventListener('pointerdown', ev => {
    const t = ev.target.closest('[data-drag]'); if (!t) return;
    drag = t.getAttribute('data-drag'); chartBox.setPointerCapture(ev.pointerId); ev.preventDefault();
  });
  chartBox.addEventListener('pointermove', ev => {
    if (!drag || !chart) return;
    const p = svgPoint(ev), yv = Math.max(Y_RANGE[0], Math.min(Y_RANGE[1], chart.y.invert(p.y)));
    if (drag === 'h0' || drag === 'h1') {
      const other = drag === 'h0' ? 1 : 0, xo = HX[other], yo = state.a + state.b * xo, xd = HX[drag === 'h0' ? 0 : 1];
      const b = (yv - yo) / (xd - xo), a = yo - b * xo;
      state.a = Math.max(-4, Math.min(10, a)); state.b = Math.max(-1.5, Math.min(2.5, b));
      aS.set(+state.a.toFixed(2), true); bS.set(+state.b.toFixed(2), true);
    } else if (drag.startsWith('p')) {
      const i = +drag.slice(1); setPointY(i, +yv.toFixed(1)); return;
    }
    render();
  });
  const endDrag = () => { if (drag) { drag = null; render(true); } };
  chartBox.addEventListener('pointerup', endDrag);
  chartBox.addEventListener('pointercancel', endDrag);

  function render(announce) {
    const pts = data(), f = lsFit(pts);
    const mine = sse(pts, state.a, state.b), best = sse(pts, f.a, f.b);
    const ratio = mine / best;
    chart = Chart.create(chartBox, {
      width: 640, height: 420, x: X_RANGE, y: Y_RANGE, xLabel: 'x', yLabel: 'y',
      title: 'Scatterplot with your line',
      desc: `${pts.length} points. Your line has intercept ${S.fmt(state.a)} and slope ${S.fmt(state.b)}, with a sum of squared residuals of ${S.fmt(mine, 1)}. ` +
        `The least-squares line has intercept ${S.fmt(f.a)} and slope ${S.fmt(f.b)}, with a sum of squared residuals of ${S.fmt(best, 1)}.`
    });
    const lineY = x => state.a + state.b * x;
    if (state.showSq) {
      for (const p of pts) {
        const e = p[1] - lineY(p[0]); const side = Math.abs(chart.y(p[1]) - chart.y(lineY(p[0])));
        chart.el('rect', { x: chart.x(p[0]), y: Math.min(chart.y(p[1]), chart.y(lineY(p[0]))), width: side, height: side, fill: e >= 0 ? 'var(--s1)' : 'var(--s2)', opacity: 0.16, stroke: e >= 0 ? 'var(--s1)' : 'var(--s2)', 'stroke-width': 1 });
      }
    }
    if (state.showRes) {
      for (const p of pts) chart.el('line', { x1: chart.x(p[0]), x2: chart.x(p[0]), y1: chart.y(p[1]), y2: chart.y(lineY(p[0])), stroke: 'var(--muted)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' });
    }
    if (state.showLS) chart.line([[X_RANGE[0], f.a + f.b * X_RANGE[0]], [X_RANGE[1], f.a + f.b * X_RANGE[1]]], { color: 'var(--s3)', dash: '8 5', width: 3 });
    chart.line([[X_RANGE[0], lineY(X_RANGE[0])], [X_RANGE[1], lineY(X_RANGE[1])]], { color: 'var(--s2)', width: 3 });
    // points (draggable)
    pts.forEach((p, i) => {
      const isOut = state.outlier && i === pts.length - 1;
      const c = chart.el('circle', { cx: chart.x(p[0]), cy: chart.y(p[1]), r: 6, fill: isOut ? 'var(--bg)' : 'var(--s1)', stroke: 'var(--s1)', 'stroke-width': 2, 'data-drag': isOut ? null : 'p' + i, style: isOut ? null : 'cursor:grab' }, chart.overlay);
      if (isOut) chart.text(p[0], p[1], ' outlier', { dy: -10, size: 12 });
      return c;
    });
    // handles
    HX.forEach((hx, i) => {
      chart.el('circle', { cx: chart.x(hx), cy: chart.y(lineY(hx)), r: 10, fill: 'var(--bg)', stroke: 'var(--s2)', 'stroke-width': 3, 'data-drag': 'h' + i, style: 'cursor:grab' }, chart.overlay);
    });
    const items = [{ label: 'Data', color: 'var(--s1)', shape: 'point' }, { label: 'Your line', color: 'var(--s2)' }];
    if (state.showLS) items.push({ label: 'Least-squares line', color: 'var(--s3)', dash: '8 5' });
    if (state.outlier) items.push({ label: 'Outlier', color: 'var(--s1)', shape: 'point', hollow: true });
    Chart.legend(document.getElementById('legend'), items);

    UI.stats(document.getElementById('stats'), [
      { k: 'Your SSE', v: S.fmt(mine, 1) },
      { k: 'Least-squares SSE', v: S.fmt(best, 1) },
      { k: 'Yours ÷ best', v: S.fmt(ratio, 2) },
      { k: 'R² (least squares)', v: S.fmtNoZero(f.r * f.r, 2) }
    ]);
    const v = document.getElementById('verdict');
    v.textContent = ratio < 1.02 ? 'Your line is as good as the least-squares line (within 2%).'
      : ratio < 1.2 ? 'Close: your line\'s SSE is within 20% of the minimum.'
        : 'Your line\'s SSE is well above the minimum. Try changing the slope first, then the intercept.';

    const det = document.getElementById('ls-detail'); det.innerHTML = '';
    det.append(
      h('p', { text: 'The least-squares slope and intercept come from the covariance and variances alone:' }),
      h('p', { class: 'formula', text: `b = cov(x, y) / var(x) = ${S.fmt(f.cov, 3)} / ${S.fmt(f.varx, 3)} = ${S.fmt(f.b, 3)}\na = mean(y) − b × mean(x) = ${S.fmt(f.my, 3)} − ${S.fmt(f.b, 3)} × ${S.fmt(f.mx, 3)} = ${S.fmt(f.a, 3)}` }),
      h('p', { text: `The correlation is r = ${S.fmt(f.r, 3)}, so R² = ${S.fmt(f.r * f.r, 3)}.` })
    );
    UI.table(document.getElementById('data-table'), {
      caption: 'Data and residuals from your line', head: ['Point', 'x', 'y', 'Residual (your line)'], rowHeader: true,
      rows: pts.map((p, i) => [String(i + 1), S.fmt(p[0], 2), S.fmt(p[1], 2), S.fmt(p[1] - lineY(p[0]), 2)])
    });
    if (announce !== false) UI.announce(`Your sum of squared residuals is ${S.fmt(mine, 1)}; the minimum is ${S.fmt(best, 1)}. ${v.textContent}`);
  }

  document.addEventListener('appresize', () => render(false));
  makeData(); rebuildPointSelect(); render(false);
})();
