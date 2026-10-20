(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'No interaction', text: 'Set b3 to 0.',
    question: 'The three simple-slopes lines are now…', options: ['parallel', 'fanning out'], answer: 0,
    explain: 'With no interaction, the effect of X is the same at every value of W, so the lines have the same slope and differ only in height.' },
  { title: 'What centring changes', text: 'Set b3 back to 0.25 and look at the coefficient table, which fits the model with raw and with centred predictors.',
    question: 'Which coefficients differ between the two columns?', options: ['Only b3', 'b1 and b2 (and the intercept), but not b3', 'None of them'], answer: 1,
    explain: 'Without centring, b1 is the effect of X when W = 0. After centring it is the effect of X at the mean of W. The interaction b3 is identical either way.' },
  { title: 'When W = 0 is meaningful', text: 'Move the mean of W to 0.',
    question: 'Now the raw and centred values of b1 are…', options: ['very different', 'about the same'], answer: 1,
    explain: 'If W already has a mean of zero, centring hardly changes anything. Centring matters when zero is far from the data, as with most psychological scales.' },
  { title: 'Extension: regions of significance', text: 'Open the Johnson–Neyman panel at the bottom.',
    question: 'The green shaded region shows where…', options: ['the effect of X on Y is significant', 'W has a significant effect', 'the interaction is significant'], answer: 0,
    explain: 'The Johnson–Neyman technique finds the values of W at which the conditional effect of X (b1 + b3 × W) differs significantly from zero.' }
]);

  const st = { b0: 1, b1: 0.2, b2: 0.3, b3: 0.25, sigma: 2, n: 200, mx: 5, sx: 1.5, mw: 3, sw: 1, seed: 21 };
  const f2 = v => S.fmt(v, 2);
  const mk = (key, label, min, max, step, hint, fmt) => UI.slider({ label, min, max, step, value: st[key], format: fmt || f2, hint, onInput: v => { st[key] = v; render(); } });
  const moreBox = UI.more('More settings');
  moreBox.body.append(
    mk('b1', 'b1: effect of X when W = 0', -1, 1, 0.05).el,
    mk('b2', 'b2: effect of W when X = 0', -1, 1, 0.05).el,
    mk('mx', 'Mean of X', 0, 10, 0.5, null, v => S.fmt(v, 1)).el,
    mk('sigma', 'Residual SD', 0.5, 5, 0.1).el,
    mk('n', 'Sample size (N)', 30, 1000, 10, null, v => String(v)).el
  );
  document.getElementById('controls').append(
    mk('b3', 'b3: interaction X × W', -0.6, 0.6, 0.01, 'How much the slope of X changes per unit of W.').el,
    mk('mw', 'Mean of W (the moderator)', 0, 10, 0.5, 'A moderator mean far from 0 makes uncentred b1 hard to interpret.', v => S.fmt(v, 1)).el,
    moreBox.el
  );
  document.getElementById('buttons').append(UI.button('New sample', () => { st.seed = S.newSeed(); render(); }, 'secondary'));

  function simulate() {
    const r = S.rng(st.seed), X = [], W = [], Y = [];
    for (let i = 0; i < st.n; i++) {
      const x = st.mx + st.sx * r.normal(), w = st.mw + st.sw * r.normal();
      X.push(x); W.push(w); Y.push(st.b0 + st.b1 * x + st.b2 * w + st.b3 * x * w + st.sigma * r.normal());
    }
    return { X, W, Y };
  }

  function render() {
    const d = simulate();
    const raw = S.ols(d.Y, [d.X, d.W, d.X.map((x, i) => x * d.W[i])]);
    const mx = S.mean(d.X), mw = S.mean(d.W), sw = S.sd(d.W), sx = S.sd(d.X);
    const Xc = d.X.map(x => x - mx), Wc = d.W.map(w => w - mw);
    const cen = S.ols(d.Y, [Xc, Wc, Xc.map((x, i) => x * Wc[i])]);
    const tcrit = S.tQuantile(0.975, raw.df);
    const row = (name, i) => {
      const cell = f => { const t = f.b[i] / f.se[i]; return [S.fmt(f.b[i], 2), S.fmt(f.se[i], 2), S.fmtP(S.tTwoSided(t, f.df))]; };
      return [name].concat(cell(raw), cell(cen));
    };
    UI.table(document.getElementById('coef'), {
      caption: `Coefficients (N = ${st.n})`, rowHeader: true,
      head: ['Term', 'b (raw)', 'SE (raw)', 'p (raw)', 'b (centred)', 'SE (centred)', 'p (centred)'],
      rows: [row('Intercept', 0), row('X', 1), row('W', 2), row('X × W', 3)]
    });
    document.getElementById('diagram').innerHTML = Diagram.svg({
      id: 'ix', width: 420, height: 230, title: 'Path diagram of the moderated regression',
      desc: `X, W and the product X × W each predict Y. Unstandardised coefficients: b1 = ${S.fmt(raw.b[1], 2)}, b2 = ${S.fmt(raw.b[2], 2)}, b3 = ${S.fmt(raw.b[3], 2)}.`,
      nodes: [{ id: 'x', label: 'X', x: 70, y: 40 }, { id: 'w', label: 'W', x: 70, y: 115 }, { id: 'xw', label: 'X × W', x: 70, y: 190, emph: true }, { id: 'y', label: 'Y', x: 300, y: 115 }, { id: 'e', label: 'e', x: 385, y: 115, shape: 'circle' }],
      edges: [{ from: 'x', to: 'y', label: 'b1 = ' + S.fmt(raw.b[1], 2) }, { from: 'w', to: 'y', label: 'b2 = ' + S.fmt(raw.b[2], 2), labelAt: 0.45 }, { from: 'xw', to: 'y', label: 'b3 = ' + S.fmt(raw.b[3], 2), emph: true, labelOffset: -12 }, { from: 'e', to: 'y' }]
    });
    document.getElementById('centre-note').textContent =
      `Centring changes b1 from ${S.fmt(raw.b[1], 3)} (the effect of X when W = 0) to ${S.fmt(cen.b[1], 3)} (the effect of X at the mean of W, ${S.fmt(mw, 2)}). ` +
      `The interaction coefficient is unchanged (${S.fmt(raw.b[3], 3)} both times), and so is R² (${S.fmtNoZero(raw.r2, 3)}).`;

    // Conditional effect of X at W = w (raw model)
    const V = raw.vcov;
    const eff = w => raw.b[1] + raw.b[3] * w;
    const se = w => Math.sqrt(Math.max(V[1][1] + 2 * w * V[1][3] + w * w * V[3][3], 0));
    const levels = [['Low W (mean − 1 SD)', mw - sw, 'var(--s1)', '7 5'], ['Average W (mean)', mw, 'var(--s3)', null], ['High W (mean + 1 SD)', mw + sw, 'var(--s2)', '2 4']];
    const xr = [mx - 2.2 * sx, mx + 2.2 * sx];
    const pred = (x, w) => raw.b[0] + raw.b[1] * x + raw.b[2] * w + raw.b[3] * x * w;
    const ys = []; levels.forEach(l => { ys.push(pred(xr[0], l[1]), pred(xr[1], l[1])); });
    const c1 = Chart.create(document.getElementById('slopes-chart'), {
      width: 600, height: 340, x: xr, y: Chart.extent(ys, 0.15), xLabel: 'X', yLabel: 'Predicted Y',
      title: 'Simple slopes', desc: levels.map(l => `${l[0]}: slope ${S.fmt(eff(l[1]), 3)}`).join('; ') + '.'
    });
    levels.forEach(l => {
      c1.line([[xr[0], pred(xr[0], l[1])], [xr[1], pred(xr[1], l[1])]], { color: l[2], dash: l[3], width: 3 });
      c1.text(xr[1], pred(xr[1], l[1]), ['Low W', 'Mean W', 'High W'][levels.indexOf(l)], { anchor: 'end', dy: -8, size: 12, weight: 600 });
    });
    Chart.legend(document.getElementById('slopes-legend'), levels.map(l => ({ label: l[0], color: l[2], dash: l[3] })));
    UI.table(document.getElementById('simple-table'), {
      caption: 'Simple slopes of X', rowHeader: true, head: ['Value of W', 'W', 'Slope of X', 'SE', 't', 'p'],
      rows: levels.map(l => { const t = eff(l[1]) / se(l[1]); return [l[0], S.fmt(l[1], 2), S.fmt(eff(l[1]), 2), S.fmt(se(l[1]), 2), S.fmt(t, 2), S.fmtP(S.tTwoSided(t, raw.df))]; })
    });

    // Johnson–Neyman
    const wr = [mw - 3 * sw, mw + 3 * sw], grid = [];
    for (let i = 0; i <= 120; i++) grid.push(wr[0] + (wr[1] - wr[0]) * i / 120);
    const up = grid.map(w => [w, eff(w) + tcrit * se(w)]), lo = grid.map(w => [w, eff(w) - tcrit * se(w)]);
    const A = raw.b[3] * raw.b[3] - tcrit * tcrit * V[3][3], B = 2 * (raw.b[1] * raw.b[3] - tcrit * tcrit * V[1][3]), C = raw.b[1] * raw.b[1] - tcrit * tcrit * V[1][1];
    const disc = B * B - 4 * A * C;
    let roots = [];
    if (Math.abs(A) > 1e-12 && disc >= 0) roots = [(-B - Math.sqrt(disc)) / (2 * A), (-B + Math.sqrt(disc)) / (2 * A)].sort((p, q) => p - q);
    const yv = up.concat(lo).map(p => p[1]).concat([0]);
    const c2 = Chart.create(document.getElementById('jn-chart'), {
      width: 600, height: 320, x: wr, y: Chart.extent(yv, 0.08), xLabel: 'Moderator W', yLabel: 'Conditional effect of X',
      title: 'Johnson–Neyman plot', desc: 'Conditional effect of X across W with a 95% confidence band. ' + (roots.length ? `Boundaries of significance at W = ${roots.map(v => S.fmt(v, 2)).join(' and ')}.` : 'No boundaries of significance within the range shown.')
    });
    // Shade the ranges of W where the effect of X is / is not significant
    const isSig = w => Math.abs(eff(w)) / se(w) > tcrit;
    const runs = []; let start = wr[0], cur = isSig(wr[0]);
    for (let i = 1; i <= 240; i++) {
      const w = wr[0] + (wr[1] - wr[0]) * i / 240, s2 = isSig(w);
      if (s2 !== cur || i === 240) { const end = s2 !== cur ? (roots.find(r => r > start && r <= w + 1e-9) || w) : w; runs.push([start, end, cur]); start = end; cur = s2; }
    }
    const yr = [c2.y.invert(c2.margin.t + c2.ph), c2.y.invert(c2.margin.t)];
    runs.forEach(([a, b, sg]) => {
      c2.rect(a, yr[0], b, yr[1], { color: sg ? 'var(--s3)' : 'var(--muted)', opacity: sg ? 0.16 : 0.07 });
      if (c2.x(b) - c2.x(a) > 90) c2.text((a + b) / 2, yr[0], sg ? 'Significant' : 'Not significant', { anchor: 'middle', dy: -8, size: 12, weight: 600, color: sg ? 'var(--s3)' : 'var(--muted)' });
    });
    c2.area(up, lo, { color: 'var(--s1)', opacity: 0.2 });
    c2.hline(0, { color: 'var(--text)', width: 1 });
    c2.line(grid.map(w => [w, eff(w)]), { color: 'var(--s1)', width: 3 });
    roots.filter(v => v > wr[0] && v < wr[1]).forEach(v => { c2.vline(v, { color: 'var(--s2)', dash: '6 4', width: 2 }); c2.text(v, c2.y.invert(c2.margin.t), ` W = ${S.fmt(v, 2)}`, { dy: 14, size: 12 }); });
    Chart.legend(document.getElementById('jn-legend'), [{ label: 'Effect of X', color: 'var(--s1)' }, { label: '95% confidence band', color: 'var(--s1)', shape: 'band' }, { label: 'Johnson–Neyman boundary', color: 'var(--s2)', dash: '6 4' }, { label: 'Effect of X significant (p < .05)', color: 'var(--s3)', shape: 'band' }, { label: 'Not significant', color: 'var(--muted)', shape: 'band' }]);

    const sig = w => Math.abs(eff(w)) / se(w) > tcrit;
    let jn;
    const inRange = roots.filter(v => v > wr[0] && v < wr[1]);
    if (!inRange.length) jn = sig(mw) ? 'The effect of X is significant across the whole range of W shown.' : 'The effect of X is not significant anywhere in the range of W shown.';
    else jn = `The effect of X changes significance at W = ${inRange.map(v => S.fmt(v, 2)).join(' and ')}. ` +
      `It is significant where W is ${sig(wr[0]) ? 'below ' + S.fmt(inRange[0], 2) : ''}${sig(wr[0]) && sig(wr[1]) ? ' or ' : ''}${sig(wr[1]) ? 'above ' + S.fmt(inRange[inRange.length - 1], 2) : ''}${!sig(wr[0]) && !sig(wr[1]) ? 'between these values' : ''}.`;
    document.getElementById('jn-text').textContent = jn;
    UI.announce(`Interaction coefficient ${S.fmt(raw.b[3], 3)}, p ${S.fmtP(S.tTwoSided(raw.b[3] / raw.se[3], raw.df))}. ${jn}`);
  }
  document.addEventListener('appresize', render);
  document.getElementById('jn-details').addEventListener('toggle', e => { if (e.target.open) render(); });
  render();
  // ?panel=jn opens the Johnson–Neyman panel
  if (UI.param('panel') === 'jn') document.getElementById('jn-details').open = true;
})();
