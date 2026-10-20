(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'Nothing to add', text: 'Set the effects of X1 and X2 to 0.',
    question: 'In this sample, will ΔR² be exactly zero?', options: ['Yes, exactly zero', 'Small but above zero', 'Large'], answer: 1,
    explain: 'Adding predictors can never lower R² in the sample: they always pick up a little chance variation. That is why we need a test rather than just looking at whether R² went up.' },
  { title: 'How often is it significant by chance?', text: 'Keep both effects at 0 and press "New sample" ten or twenty times, noting each Sig. F change.',
    question: 'In the long run, how often should p be below .05?', options: ['About 5% of samples', 'About 50% of samples', 'Never'], answer: 0,
    explain: 'When the null hypothesis is true, p-values below .05 happen in about 5% of samples: that is what the .05 level means.' },
  { title: 'Sample size', text: 'Set the effect of X1 to 0.15 and X2 to 0.10. Compare N = 50 with N = 500.',
    question: 'As N grows, the p-value for the F change…', options: ['grows', 'shrinks', 'is unaffected'], answer: 1,
    explain: 'The same ΔR² is estimated more precisely with more cases, so F grows and p shrinks.' },
  { title: 'Overlapping predictors', text: 'With the effects unchanged, move the correlation among the predictors up to .7.',
    question: 'What happens to ΔR²?', options: ['It rises', 'It falls', 'It stays the same'], answer: 1,
    explain: 'Model 1 already contains C1 and C2. Variance that X1 and X2 share with the controls is credited to the controls first, so less is left over for X1 and X2. This links back to unique and shared variance in R2.' }
]);

  const st = { gc: 0.3, b1: 0.25, b2: 0.1, rho: 0.3, n: 150, seed: 31 };
  const f2 = v => S.fmt(v, 2);
  const re = () => render(true);
  const mk = (k, label, min, max, step, hint, fmt) => UI.slider({ label, min, max, step, value: st[k], hint, format: fmt || f2, onInput: v => { st[k] = v; re(); } });
  document.getElementById('controls').append(
    mk('gc', 'Effect of each control (C1, C2)', 0, 0.5, 0.05).el,
    mk('b1', 'Effect of X1', -0.5, 0.5, 0.05).el,
    mk('b2', 'Effect of X2', -0.5, 0.5, 0.05).el,
    mk('rho', 'Correlation among all four predictors', 0, 0.8, 0.05, 'Overlap between the controls and the new predictors.').el,
    mk('n', 'Sample size (N)', 30, 1000, 10, null, v => String(v)).el
  );
  document.getElementById('buttons').append(UI.button('New sample', () => { st.seed = S.newSeed(); re(); }, 'secondary'));

  function simulate() {
    const r = S.rng(st.seed), R = S.zeros(4, 4);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) R[i][j] = i === j ? 1 : st.rho;
    const rows = S.mvnSample(st.n, [0, 0, 0, 0], R, r);
    const cols = [0, 1, 2, 3].map(j => rows.map(x => x[j]));
    const y = rows.map(x => st.gc * x[0] + st.gc * x[1] + st.b1 * x[2] + st.b2 * x[3] + r.normal());
    return { cols, y };
  }

  function modelDiagram(fit, full) {
    const names = full ? ['C1', 'C2', 'X1', 'X2'] : ['C1', 'C2'];
    const H = 250, top = full ? 35 : 75, gap = full ? 60 : 100;
    const nodes = names.map((n, i) => ({ id: n, label: n, x: 50, y: top + i * gap, emph: full && i >= 2 }));
    nodes.push({ id: 'Y', label: 'Y', x: 270, y: 125 }, { id: 'e', label: 'e', x: 330, y: 125, shape: 'circle', r: 14 });
    // labels sit on the arrows near the predictors, where the arrows are furthest apart
    const edges = names.map((n, i) => ({ from: n, to: 'Y', label: S.fmt(fit.b[i + 1], 2), emph: full && i >= 2, labelAt: 0.3, labelOffset: 0 }));
    edges.push({ from: 'e', to: 'Y' });
    return Diagram.svg({
      id: full ? 'm2' : 'm1', width: 350, height: H, title: full ? 'Model 2' : 'Model 1',
      desc: (full ? 'Model 2: C1, C2, X1 and X2 predict Y. ' : 'Model 1: C1 and C2 predict Y. ') + names.map((n, i) => `b for ${n} = ${S.fmt(fit.b[i + 1], 2)}`).join(', ') + `. R² = ${S.fmtNoZero(fit.r2, 3)}.`,
      nodes, edges, notes: [{ x: 270, y: 168, text: `R² = ${S.fmtNoZero(fit.r2, 3)}`, size: 13 }]
    });
  }

  function fTest(r2a, r2b, ka, kb, n) {
    const df1 = kb - ka, df2 = n - kb - 1;
    const F = ((r2b - r2a) / df1) / ((1 - r2b) / df2);
    return { F, df1, df2, p: S.fSf(F, df1, df2) };
  }

  function fChart(box, F, df1, df2, p) {
    const xmax = Math.max(6, Math.min(F * 1.3, 40));
    const pts = []; for (let i = 1; i <= 200; i++) { const x = xmax * i / 200; pts.push([x, S.fPdf(x, df1, df2)]); }
    const ymax = Math.max(...pts.map(q => q[1]).filter(v => isFinite(v) && v < 5)) * 1.15 || 1;
    const ch = Chart.create(box, { width: 600, height: 260, x: [0, xmax], y: [0, ymax], xLabel: `F (${df1}, ${df2})`, yLabel: 'Density', yTickFormat: () => '', margin: { l: 36 },
      title: 'F distribution under the null hypothesis', desc: `Observed F = ${S.fmt(F, 2)}; the area to its right, the p-value, is ${S.fmtP(p)}.` });
    const tail = pts.filter(q => q[0] >= F).map(q => [q[0], Math.min(q[1], ymax)]);
    if (tail.length) ch.area([[F, Math.min(S.fPdf(F, df1, df2), ymax)]].concat(tail), [[F, 0], [xmax, 0]], { color: 'var(--s2)', opacity: 0.35 });
    ch.line(pts.map(q => [q[0], Math.min(q[1], ymax)]), { color: 'var(--s1)' });
    if (F <= xmax) { ch.vline(F, { color: 'var(--s2)', width: 2.5 }); ch.text(F, ymax, ` observed F = ${S.fmt(F, 2)} `, { dy: 14, anchor: F > xmax * 0.6 ? 'end' : 'start' }); }
    else ch.text(xmax, ymax, `observed F = ${S.fmt(F, 2)} (off the scale) `, { anchor: 'end', dy: 14 });
  }

  function render(announce) {
    const d = simulate();
    const m1 = S.ols(d.y, d.cols.slice(0, 2)), m2 = S.ols(d.y, d.cols);
    const t = fTest(m1.r2, m2.r2, 2, 4, st.n), dR2 = m2.r2 - m1.r2;
    document.getElementById('d1').innerHTML = modelDiagram(m1, false);
    document.getElementById('d2').innerHTML = modelDiagram(m2, true);
    const pTxt = t.p < 0.001 ? '< .001' : S.fmtNoZero(t.p, 3);
    UI.table(document.getElementById('summary'), { caption: `Model summary (N = ${st.n})`, rowHeader: true,
      head: ['Model', 'Predictors', 'R²', 'R² change', 'F change', 'df1', 'df2', 'Sig. F change'], leftCols: [1],
      rows: [
        ['1', 'C1, C2', S.fmtNoZero(m1.r2, 3), S.fmtNoZero(m1.r2, 3), S.fmt(fTest(0, m1.r2, 0, 2, st.n).F, 2), '2', String(st.n - 3), S.fmtP(fTest(0, m1.r2, 0, 2, st.n).p)],
        ['2', 'C1, C2, X1, X2', S.fmtNoZero(m2.r2, 3), S.fmtNoZero(dR2, 3), S.fmt(t.F, 2), String(t.df1), String(t.df2), S.fmtP(t.p)]
      ] });
    document.getElementById('verdict').textContent = `Adding X1 and X2 increased R² by ${S.fmtNoZero(dR2, 3)}, F(${t.df1}, ${t.df2}) = ${S.fmt(t.F, 2)}, p ${t.p < 0.001 ? '< .001' : '= ' + pTxt}. ` +
      (t.p < 0.05 ? 'X1 and X2 explain significantly more variance than the controls alone, so Model 2 is preferred.' : 'X1 and X2 do not explain significantly more variance; the simpler Model 1 is adequate.');

    // R² bars
    const ymax = Math.max(0.1, m2.r2 * 1.25);
    const c = Chart.create(document.getElementById('r2chart'), { width: 520, height: 240, x: [-0.6, 1.6], y: [0, ymax], xTickValues: [0, 1], xTickFormat: v => v === 0 ? 'Model 1' : 'Model 2', yLabel: 'R²', margin: { l: 56 },
      title: 'R² for the two models', desc: `Model 1 R² = ${S.fmtNoZero(m1.r2, 3)}. Model 2 R² = ${S.fmtNoZero(m2.r2, 3)}, of which ${S.fmtNoZero(dR2, 3)} is the change.` });
    c.rect(-0.3, 0, 0.3, m1.r2, { color: 'var(--s1)', opacity: 0.8 });
    c.rect(0.7, 0, 1.3, m1.r2, { color: 'var(--s1)', opacity: 0.8 });
    c.rect(0.7, m1.r2, 1.3, m2.r2, { color: 'var(--s2)', opacity: 0.85 });
    c.text(0, m1.r2, S.fmtNoZero(m1.r2, 3), { anchor: 'middle', dy: -6, weight: 600, size: 13 });
    c.text(1, m2.r2, `${S.fmtNoZero(m2.r2, 3)} (ΔR² = ${S.fmtNoZero(dR2, 3)})`, { anchor: 'middle', dy: -6, weight: 600, size: 13 });

    fChart(document.getElementById('fchart'), t.F, t.df1, t.df2, t.p);

    const coefRow = (name, fit, i) => i < fit.b.length ? [S.fmt(fit.b[i], 2), S.fmt(fit.se[i], 2), S.fmtP(S.tTwoSided(fit.b[i] / fit.se[i], fit.df))] : ['', '', ''];
    UI.table(document.getElementById('coefs'), { caption: 'Unstandardised coefficients', rowHeader: true, head: ['Term', 'b (Model 1)', 'SE', 'p', 'b (Model 2)', 'SE', 'p'],
      rows: ['Intercept', 'C1', 'C2', 'X1', 'X2'].map((n, i) => [n].concat(coefRow(n, m1, i), coefRow(n, m2, i))) });
    if (announce) UI.announce(document.getElementById('verdict').textContent);
  }

  // Calculator for the student's own SPSS output
  const calc = { r2a: 0.2, r2b: 0.26, ka: 2, kb: 4, n: 120 };
  const ins = {
    r2a: UI.number({ label: 'R² for Model 1', min: 0, max: 0.99, step: 0.001, value: calc.r2a, onInput: v => { calc.r2a = v; runCalc(); } }),
    r2b: UI.number({ label: 'R² for Model 2', min: 0, max: 0.99, step: 0.001, value: calc.r2b, onInput: v => { calc.r2b = v; runCalc(); } }),
    ka: UI.number({ label: 'Number of predictors in Model 1', min: 0, max: 50, step: 1, value: calc.ka, onInput: v => { calc.ka = v; runCalc(); } }),
    kb: UI.number({ label: 'Number of predictors in Model 2', min: 1, max: 60, step: 1, value: calc.kb, onInput: v => { calc.kb = v; runCalc(); } }),
    n: UI.number({ label: 'Sample size (N)', min: 5, max: 100000, step: 1, value: calc.n, onInput: v => { calc.n = v; runCalc(); } })
  };
  document.getElementById('calc').append(...Object.values(ins).map(i => i.el));
  function runCalc() {
    const out = document.getElementById('calc-out'); out.innerHTML = '';
    if (Object.values(ins).some(i => i.validate() === null)) return;
    let msg = '';
    if (calc.kb <= calc.ka) msg = 'Model 2 must have more predictors than Model 1.';
    else if (calc.r2b < calc.r2a) msg = 'Model 2 contains Model 1, so its R² cannot be smaller.';
    else if (calc.n <= calc.kb + 1) msg = 'N must be larger than the number of predictors in Model 2 plus 1.';
    if (msg) { out.appendChild(h('p', { class: 'error-text', text: msg })); return; }
    const t = fTest(calc.r2a, calc.r2b, calc.ka, calc.kb, calc.n);
    out.appendChild(h('p', { text: `ΔR² = ${S.fmtNoZero(calc.r2b - calc.r2a, 3)}, F(${t.df1}, ${t.df2}) = ${S.fmt(t.F, 2)}, p ${t.p < 0.001 ? '< .001' : '= ' + S.fmtNoZero(t.p, 3)}.` }));
  }
  document.addEventListener('appresize', () => render(false));
  document.getElementById('f-details').addEventListener('toggle', e => { if (e.target.open) render(false); });
  render(false); runCalc();
})();
