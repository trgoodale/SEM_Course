(function () {
  'use strict';
  const S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'Missing completely at random', text: 'Choose MCAR.',
    question: 'Is the listwise-deletion estimate of the mean of Y biased?', options: ['No, only less precise', 'Yes'], answer: 0,
    explain: 'Under MCAR the complete cases are a random subset, so listwise deletion is unbiased; it just wastes data.' },
  { title: 'Missing at random', text: 'Choose MAR: Y is more likely to be missing when X is high. X and Y correlate positively.',
    question: 'The listwise mean of Y will be…', options: ['too low', 'too high', 'about right'], answer: 0,
    explain: 'High X goes with high Y, so the cases that drop out tend to have high Y. The complete cases underestimate the mean of Y.' },
  { title: 'The FIML correction', text: 'Compare the row "FIML with X in the model" with the truth.',
    question: 'Under MAR, FIML is…', options: ['approximately unbiased', 'as biased as listwise deletion'], answer: 0,
    explain: 'FIML uses the X values of the incomplete cases, and X carries the information about why Y is missing. This is what Amos does when you estimate means and intercepts.' },
  { title: 'Leave X out of the model', text: 'Compare the row "FIML without X" with listwise deletion.',
    question: 'Without X in the model, FIML\'s estimate of the mean of Y is…', options: ['the same as listwise deletion', 'the same as FIML with X'], answer: 0,
    explain: 'FIML can only use information that is in the model. Here X is what explains why Y is missing; leave it out and FIML has nothing to correct with. This is why auxiliary variables matter.' },
  { title: 'Missing not at random', text: 'Choose MNAR, then press "Repeat 500 times".',
    question: 'Does any of the three methods remove the bias?', options: ['Yes, FIML does', 'No'], answer: 1,
    explain: 'When missingness depends on the missing values themselves, no method that ignores the mechanism is unbiased. FIML is usually less biased than listwise deletion, especially when other variables are related to Y.' }
]);

  const st = { rho: 0.5, pct: 30, mech: 'mar', strength: 2, n: 300, seed: 14 };
  document.getElementById('controls').append(
    UI.select({ label: 'Why are Y values missing?', value: st.mech, options: [
      { value: 'mcar', label: 'MCAR: completely at random' }, { value: 'mar', label: 'MAR: more likely when X is high' }, { value: 'mnar', label: 'MNAR: more likely when Y itself is high' }],
      onChange: v => { st.mech = v; render(); } }).el,
    UI.slider({ label: 'Percentage of Y missing', min: 5, max: 60, step: 5, value: st.pct, format: v => v + '%', onInput: v => { st.pct = v; render(); } }).el,
    UI.slider({ label: 'Strength of the selection', min: 0.5, max: 4, step: 0.25, value: st.strength, format: v => S.fmt(v, 2), hint: 'How sharply missingness depends on X or Y (ignored for MCAR).', onInput: v => { st.strength = v; render(); } }).el,
    UI.slider({ label: 'Correlation between X and Y', min: 0, max: 0.9, step: 0.05, value: st.rho, format: v => S.fmtNoZero(v, 2), onInput: v => { st.rho = v; render(); } }).el,
    UI.slider({ label: 'Sample size (N)', min: 100, max: 2000, step: 100, value: st.n, format: v => String(v), onInput: v => { st.n = v; render(); } }).el
  );
  document.getElementById('buttons').append(UI.button('New sample', () => { st.seed = S.newSeed(); render(); }, 'secondary'));

  function makeData(r) {
    const n = st.n, X = [], Y = [];
    for (let i = 0; i < n; i++) { const x = r.normal(); X.push(x); Y.push(st.rho * x + Math.sqrt(1 - st.rho * st.rho) * r.normal()); }
    const target = st.pct / 100, z = st.mech === 'mar' ? X : Y;
    const logistic = v => 1 / (1 + Math.exp(-v));
    let alpha = 0;
    if (st.mech !== 'mcar') alpha = S.bisect(a => z.reduce((s, v) => s + logistic(a + st.strength * v), 0) / n - target, -30, 30, 60);
    const miss = z.map(v => r() < (st.mech === 'mcar' ? target : logistic(alpha + st.strength * v)));
    return { X, Y, miss };
  }
  function estimates(d) {
    const n = d.X.length;
    const summ = (X, Y) => ({ mean: S.mean(Y), sd: S.sd(Y), r: S.cor(X, Y), slope: S.cov(X, Y) / S.variance(X) });
    const truth = summ(d.X, d.Y);
    const cx = [], cy = []; d.X.forEach((x, i) => { if (!d.miss[i]) { cx.push(x); cy.push(d.Y[i]); } });
    const lw = summ(cx, cy);
    const mY = S.mean(cy), Yimp = d.Y.map((y, i) => d.miss[i] ? mY : y);
    const mi = summ(d.X, Yimp);
    // FIML (closed form for X complete, Y partly missing)
    const b = S.cov(cx, cy) / S.variance(cx), a = S.mean(cy) - b * S.mean(cx);
    const ncc = cx.length, sres = cy.reduce((s, y, i) => s + Math.pow(y - a - b * cx[i], 2), 0) / ncc;
    const mxAll = S.mean(d.X), vx = d.X.reduce((s, x) => s + (x - mxAll) * (x - mxAll), 0) / n;
    const vy = sres + b * b * vx, cxy = b * vx;
    const fiml = { mean: a + b * mxAll, sd: Math.sqrt(vy * n / (n - 1)), r: cxy / Math.sqrt(vx * vy), slope: b };
    return { truth, lw, mi, fiml, ncc };
  }

  function render() {
    const d = makeData(S.rng(st.seed)), e = estimates(d);
    const row = (name, o) => [name, S.fmt(o.mean, 3), S.fmt(o.sd, 3), S.fmt(o.r, 3), S.fmt(o.slope, 3)];
    UI.table(document.getElementById('table'), { caption: `Estimates (N = ${st.n}; ${st.n - e.ncc} values of Y missing)`, rowHeader: true,
      head: ['Method', 'Mean of Y', 'SD of Y', 'r(X, Y)', 'Slope of Y on X'],
      rows: [row('Complete data (truth in this sample)', e.truth), row('Listwise deletion', e.lw), row('Mean imputation', e.mi),
        ['FIML without X (X left out of the model)', S.fmt(e.lw.mean, 3), S.fmt(e.lw.sd, 3), '–', '–'], row('FIML with X in the model', e.fiml)] });
    const dm = (o) => o.mean - e.truth.mean;
    const mechText = { mcar: 'Under MCAR the complete cases are a random subset, so listwise deletion is unbiased but discards information.',
      mar: 'Under MAR the complete cases have lower X, and therefore lower Y, so listwise deletion underestimates the mean of Y. FIML uses the X values of incomplete cases to correct this.',
      mnar: 'Under MNAR the missingness depends on Y itself, which no method can see, so every method is biased; FIML is usually less biased than listwise deletion when X is correlated with Y.' }[st.mech];
    document.getElementById('note').textContent = `${mechText} In this sample, the error in the mean of Y is ${S.fmt(dm(e.lw), 3)} for listwise deletion and ${S.fmt(dm(e.fiml), 3)} for FIML.`;

    const ch = Chart.create(document.getElementById('chart'), { width: 560, height: 380, x: [-3.5, 3.5], y: [-3.5, 3.5], xLabel: 'X (always observed)', yLabel: 'Y',
      title: 'Observed and missing cases', desc: `${e.ncc} complete cases and ${st.n - e.ncc} cases with Y missing. ${mechText}` });
    const pts = d.X.map((x, i) => [x, d.Y[i], d.miss[i]]).slice(0, 800);
    ch.points(pts.filter(p => p[2]).map(p => [p[0], p[1]]), { color: 'var(--s2)', r: 3.2, hollow: true, shape: 'triangle' });
    ch.points(pts.filter(p => !p[2]).map(p => [p[0], p[1]]), { color: 'var(--s1)', r: 3, opacity: 0.6 });
    ch.hline(e.truth.mean, { color: 'var(--text)', width: 1.5 });
    ch.hline(e.lw.mean, { color: 'var(--s1)', width: 2.5, dash: '8 5' });
    Chart.legend(document.getElementById('legend'), [{ label: 'Y observed', color: 'var(--s1)', shape: 'point' }, { label: 'Y missing (true value)', color: 'var(--s2)', shape: 'triangle', hollow: true },
      { label: 'True mean of Y', color: 'var(--text)' }, { label: 'Listwise mean of Y', color: 'var(--s1)', dash: '8 5' }]);
    UI.announce(document.getElementById('note').textContent);
  }

  document.getElementById('repeat').addEventListener('click', () => {
    const out = document.getElementById('rep'); out.textContent = 'Running…';
    setTimeout(() => {
      const r = S.rng(S.newSeed()), R = 500, acc = { lw: [0, 0, 0, 0], mi: [0, 0, 0, 0], fiml: [0, 0, 0, 0] };
      const pop = { mean: 0, sd: 1, r: st.rho, slope: st.rho }, keys = ['mean', 'sd', 'r', 'slope'];
      for (let k = 0; k < R; k++) { const e = estimates(makeData(r)); for (const m of Object.keys(acc)) keys.forEach((q, j) => { acc[m][j] += (e[m][q] - pop[q]) / R; }); }
      out.innerHTML = '';
      const row = (name, m) => [name].concat(acc[m].map(v => S.fmt(v, 3)));
      UI.table(out, { caption: `Average error (estimate − population value) over ${R} samples`, rowHeader: true, head: ['Method', 'Mean of Y', 'SD of Y', 'r(X, Y)', 'Slope'],
        rows: [row('Listwise deletion', 'lw'), row('Mean imputation', 'mi'), row('FIML', 'fiml')] });
      UI.announceNow(`Done. Average error in the mean of Y: listwise ${S.fmt(acc.lw[0], 3)}, FIML ${S.fmt(acc.fiml[0], 3)}.`);
    }, 30);
  });
  document.addEventListener('appresize', render);
  render();
})();
