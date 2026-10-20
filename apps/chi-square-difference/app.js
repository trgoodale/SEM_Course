(function () {
  'use strict';
  const S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'Which model has more df?', text: 'The example compares a constrained model (for example, loadings equal in two groups) with a less constrained one.',
    question: 'Why does the constrained model have more degrees of freedom?', options: ['It has fewer free parameters', 'It has more data'], answer: 0,
    explain: 'Each equality constraint replaces two free parameters with one, so the model estimates fewer parameters from the same data and gains a degree of freedom.' },
  { title: 'Read the test', text: 'Look at the result for the example values.',
    question: 'Δχ²(4) = 14.30, p = .006. Which model do you prefer?', options: ['The constrained model', 'The less constrained model'], answer: 1,
    explain: 'The constraints make fit significantly worse, so at least one of them is not supported. In an invariance test you would then look for the parameter that differs.' },
  { title: 'Looking back to R3', text: 'Read the comparison box below the chart.',
    question: 'In R3\'s hierarchical regression, which model plays the role of the constrained model?', options: ['Model 1 (fewer predictors)', 'Model 2 (more predictors)'], answer: 0,
    explain: 'Model 1 is Model 2 with some paths fixed at zero: a constrained version of it, just as an invariance model is a constrained version of the free multigroup model.' }
]);
  const st = { chiC: 112.4, dfC: 52, chiF: 98.1, dfF: 48 };
  const ins = {
    chiC: UI.number({ label: 'χ² of the constrained model', min: 0, step: 0.01, value: st.chiC, onInput: v => { st.chiC = v; render(true); } }),
    dfC: UI.number({ label: 'df of the constrained model', min: 1, step: 1, value: st.dfC, onInput: v => { st.dfC = v; render(true); } }),
    chiF: UI.number({ label: 'χ² of the less constrained model', min: 0, step: 0.01, value: st.chiF, onInput: v => { st.chiF = v; render(true); } }),
    dfF: UI.number({ label: 'df of the less constrained model', min: 0, step: 1, value: st.dfF, onInput: v => { st.dfF = v; render(true); } })
  };
  document.getElementById('inputs').append(...Object.values(ins).map(i => i.el));
  function render(announce) {
    const text = document.getElementById('text'), stats = document.getElementById('stats'), box = document.getElementById('chart');
    let msg = '';
    if (Object.values(ins).some(i => i.validate() === null)) msg = 'Fix the highlighted entries.';
    else if (st.dfC <= st.dfF) msg = 'The constrained model must have more degrees of freedom than the less constrained model.';
    else if (st.chiC < st.chiF) msg = 'A constrained model cannot fit better than the model it is nested in, so its χ² should not be smaller. Check the values.';
    if (msg) { stats.innerHTML = ''; box.innerHTML = ''; text.textContent = msg; text.className = 'error-text'; return; }
    text.className = '';
    const d = st.chiC - st.chiF, ddf = st.dfC - st.dfF, p = S.chisqSf(d, ddf);
    UI.stats(stats, [{ k: 'Δχ²', v: S.fmt(d, 2) }, { k: 'Δdf', v: String(ddf) }, { k: 'p', v: S.fmtP(p) }]);
    text.textContent = `Δχ²(${ddf}) = ${S.fmt(d, 2)}, p ${p < 0.001 ? '< .001' : '= ' + S.fmtNoZero(p, 3)}. ` +
      (p < 0.05 ? 'The constraints significantly worsen fit, so they are not supported.' : 'The constraints do not significantly worsen fit, so the simpler constrained model is retained.');
    const xmax = Math.max(ddf * 3 + 10, Math.min(d * 1.3, ddf * 8 + 40));
    const pts = []; for (let i = 1; i <= 200; i++) { const x = xmax * i / 200; pts.push([x, S.chisqPdf(x, ddf)]); }
    const ymax = Math.max(...pts.map(q => q[1]).filter(v => v < 5)) * 1.15;
    const ch = Chart.create(box, { width: 600, height: 280, x: [0, xmax], y: [0, ymax], xLabel: 'χ²', yLabel: 'Density', yTickFormat: () => '', margin: { l: 36 },
      title: 'χ² distribution under the null hypothesis', desc: `Observed Δχ² = ${S.fmt(d, 2)} on ${ddf} df; the area to its right, the p-value, is ${S.fmtP(p)}.` });
    const tail = pts.filter(q => q[0] >= d).map(q => [q[0], Math.min(q[1], ymax)]);
    if (tail.length) ch.area([[d, Math.min(S.chisqPdf(d, ddf), ymax)]].concat(tail), [[d, 0], [xmax, 0]], { color: 'var(--s2)', opacity: 0.35 });
    ch.line(pts.map(q => [q[0], Math.min(q[1], ymax)]), { color: 'var(--s1)' });
    if (d <= xmax) { ch.vline(d, { color: 'var(--s2)', width: 2.5 }); ch.text(d, ymax, ` observed = ${S.fmt(d, 2)} `, { dy: 14, anchor: d > xmax * 0.6 ? 'end' : 'start' }); }
    if (announce) UI.announce(text.textContent);
  }
  document.addEventListener('appresize', () => render(false));
  render(false);
})();
