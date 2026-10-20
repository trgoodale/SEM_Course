(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'What "no problem" looks like', text: 'In explore mode, choose "No problem".',
    question: 'In the residuals-against-fitted plot, the running mean should be…', options: ['flat, near zero', 'sloping upwards', 'U-shaped'], answer: 0,
    explain: 'If the model is right, residuals average zero at every fitted value and spread evenly. This is your reference picture.' },
  { title: 'A curved relationship', text: 'Choose "Non-linearity".',
    question: 'At low and at high fitted values, the residuals are mostly…', options: ['positive', 'negative'], answer: 0,
    explain: 'A straight line through a U-shaped relationship sits too high in the middle and too low at the ends, so residuals are positive at both ends. The "Mean residual" column shows the same pattern in numbers.' },
  { title: 'Changing spread', text: 'Choose "Heteroscedasticity".',
    question: 'Which number in the summary shows it?', options: ['Mean residual by third', 'SD of residuals by third', 'Skewness'], answer: 1,
    explain: 'The spread of residuals grows from the low to the high third. The coefficients are still unbiased, but their standard errors are wrong.' },
  { title: 'One influential case', text: 'Choose "An influential, high-leverage case".',
    question: 'Which statistic flags it?', options: ['Skewness', "Largest Cook's distance", 'Mean residual'], answer: 1,
    explain: "Cook's distance combines how unusual a case's x value is (leverage) with how far it is from the line. Now switch to quiz mode and identify problems in random datasets." }
]);

  const SCEN = {
    ok: { label: 'No problem: assumptions look reasonable', explain: 'Residuals scatter evenly around zero at every fitted value and follow the Q–Q line. The data were generated from a straight line with normal, constant-variance errors.' },
    nonlinear: { label: 'Non-linearity: the relationship is curved', explain: 'Residuals are positive at low and high fitted values and negative in the middle: a U-shape in the residuals-versus-fitted plot. The data were generated with a quadratic term, so a straight line is the wrong model.' },
    hetero: { label: 'Heteroscedasticity: residual spread changes', explain: 'The spread of residuals grows with the fitted values, giving a funnel shape. The error SD was made to increase with x. Coefficients are still unbiased, but their standard errors are wrong.' },
    skew: { label: 'Non-normal (skewed) residuals', explain: 'Most residuals are slightly negative with a long tail of large positive ones, so the Q–Q plot curves away from the line at the top. Errors were drawn from a right-skewed distribution.' },
    leverage: { label: 'An influential, high-leverage case', explain: 'One case has an extreme predictor value and lies far from the trend of the other cases. Its Cook\'s distance is far larger than the rest, and removing it would change the slope noticeably.' }
  };
  const KEYS = Object.keys(SCEN);
  const st = { mode: 'explore', scen: 'ok', seed: 11, answered: false, right: 0, tried: 0 };

  function generate(scen, seed) {
    const r = S.rng(seed), n = 80, x = [], y = [];
    for (let i = 0; i < n; i++) {
      const xi = r() * 10; let e = r.normal();
      if (scen === 'hetero') e *= 0.25 + 0.3 * xi;
      if (scen === 'skew') { const a = r.normal(), b = r.normal(); e = (a * a + b * b - 2) / 1.6; }
      let yi = 2 + 0.5 * xi + e;
      if (scen === 'nonlinear') yi = 2 + 0.5 * xi + 0.16 * Math.pow(xi - 5, 2) - 1.3 + e * 0.8;
      x.push(xi); y.push(yi);
    }
    if (scen === 'leverage') { x.push(17); y.push(2 + 0.5 * 17 - 7); }
    return { x, y };
  }

  function analyse(d) {
    const fit = S.ols(d.y, [d.x]), n = d.x.length, mx = S.mean(d.x);
    const sxx = d.x.reduce((s, v) => s + (v - mx) * (v - mx), 0);
    const lev = d.x.map(v => 1 / n + (v - mx) * (v - mx) / sxx);
    const s2 = fit.sse / fit.df;
    const stdres = fit.resid.map((e, i) => e / Math.sqrt(s2 * (1 - lev[i])));
    const cook = fit.resid.map((e, i) => (e * e / (2 * s2)) * lev[i] / Math.pow(1 - lev[i], 2));
    return { fit, lev, stdres, cook };
  }

  // Mode switch
  const modeSel = UI.select({ label: 'How do you want to use the gallery?', value: 'explore', options: [
    { value: 'explore', label: 'Explore: choose a problem and see what it looks like' }, { value: 'quiz', label: 'Quiz: identify the problem in a random dataset' }],
    onChange: v => { st.mode = v; document.getElementById('quiz-box').hidden = v !== 'quiz'; document.getElementById('explore-box').hidden = v !== 'explore'; if (v === 'quiz') newQuiz(); else render(); } });
  document.getElementById('mode').appendChild(modeSel.el);

  const exploreSel = UI.select({ label: 'Problem to show', value: 'ok', options: KEYS.map(k => ({ value: k, label: SCEN[k].label })),
    onChange: v => { st.scen = v; render(); } });
  const exploreBox = document.getElementById('explore-box');
  exploreBox.append(exploreSel.el, UI.button('New sample', () => { st.seed = S.newSeed(); render(); }, 'secondary'), h('p', { id: 'explore-text' }));

  const answers = document.getElementById('answers');
  KEYS.forEach((k, i) => {
    const id = 'ans-' + k;
    answers.appendChild(h('div', { class: 'check' }, [h('input', { type: 'radio', name: 'ans', id, value: k }), h('label', { for: id, text: SCEN[k].label })]));
  });
  const fb = document.getElementById('feedback');
  document.getElementById('check').addEventListener('click', () => {
    const sel = answers.querySelector('input:checked');
    if (!sel) { fb.innerHTML = ''; fb.appendChild(h('p', { class: 'error-text', text: 'Choose an answer first.' })); return; }
    if (!st.answered) { st.tried++; if (sel.value === st.scen) st.right++; st.answered = true; }
    const ok = sel.value === st.scen;
    fb.innerHTML = '';
    fb.append(h('div', { class: 'callout ' + (ok ? '' : 'warn') }, [
      h('p', null, [h('strong', { text: ok ? 'Correct. ' : `Not quite. The answer is: ${SCEN[st.scen].label.toLowerCase()}. ` }), SCEN[st.scen].explain])
    ]));
    document.getElementById('score').textContent = `Score: ${st.right} of ${st.tried}`;
  });
  document.getElementById('next').addEventListener('click', newQuiz);

  function newQuiz() {
    let k; do { k = KEYS[Math.floor(Math.random() * KEYS.length)]; } while (k === st.scen && Math.random() < 0.7);
    st.scen = k; st.seed = S.newSeed(); st.answered = false;
    answers.querySelectorAll('input').forEach(i => { i.checked = false; });
    fb.innerHTML = '';
    render();
    UI.announce('New dataset loaded. Review the plots and summary, then choose an answer.');
  }

  function render() {
    const d = generate(st.scen, st.seed), a = analyse(d), fit = a.fit, n = d.x.length;
    const fitted = fit.fitted, res = fit.resid;
    // residuals vs fitted
    const fx = Chart.extent(fitted), ry = Chart.extent(a.stdres, 0.1);
    const rlim = Math.max(Math.abs(ry[0]), Math.abs(ry[1]), 3.2);
    const c1 = Chart.create(document.getElementById('rvf'), { width: 420, height: 320, x: fx, y: [-rlim, rlim], xLabel: 'Fitted value', yLabel: 'Standardised residual',
      title: 'Residuals against fitted values', desc: 'Scatterplot of standardised residuals against fitted values. See the numerical summary for the same information in numbers.' });
    c1.hline(0, { color: 'var(--text)', width: 1 });
    c1.points(fitted.map((f, i) => [f, a.stdres[i]]), { r: 3.5 });
    // smooth: running mean in 8 bins
    const order = fitted.map((f, i) => i).sort((p, q) => fitted[p] - fitted[q]);
    const bins = 8, sm = [];
    for (let b = 0; b < bins; b++) { const idx = order.slice(Math.floor(b * n / bins), Math.floor((b + 1) * n / bins)); sm.push([S.mean(idx.map(i => fitted[i])), S.mean(idx.map(i => a.stdres[i]))]); }
    c1.line(sm, { color: 'var(--s2)', width: 2.5 });
    Chart.legend(document.getElementById('rvf').appendChild(document.createElement('div')), [{ label: 'Case', color: 'var(--s1)', shape: 'point' }, { label: 'Running mean', color: 'var(--s2)' }]);
    // Q-Q
    const sr = a.stdres.slice().sort((p, q) => p - q), qs = sr.map((_, i) => S.normQuantile((i + 0.5) / n));
    const lim = Math.max(3.2, Math.abs(sr[0]), Math.abs(sr[n - 1]));
    const c2 = Chart.create(document.getElementById('qq'), { width: 420, height: 320, x: [-3.2, 3.2], y: [-lim, lim], xLabel: 'Theoretical normal quantile', yLabel: 'Standardised residual',
      title: 'Normal Q–Q plot', desc: 'Standardised residuals plotted against the quantiles expected under normality, with a reference diagonal. See the numerical summary for skewness.' });
    c2.line([[-lim, -lim], [lim, lim]], { color: 'var(--s2)', width: 2, dash: '6 4' });
    c2.points(qs.map((q, i) => [q, sr[i]]), { r: 3.5 });

    // Numerical summary
    const thirds = [0, 1, 2].map(t => order.slice(Math.floor(t * n / 3), Math.floor((t + 1) * n / 3)));
    const rows = thirds.map((idx, t) => [['Low', 'Middle', 'High'][t] + ' fitted values', S.fmt(S.mean(idx.map(i => res[i])), 2), S.fmt(S.sd(idx.map(i => res[i])), 2)]);
    UI.table(document.getElementById('summary'), { caption: 'Residuals by third of the fitted values', rowHeader: true, head: ['Group', 'Mean residual', 'SD of residuals'], rows });
    let maxC = 0, maxI = 0; a.cook.forEach((c, i) => { if (c > maxC) { maxC = c; maxI = i; } });
    const box = document.getElementById('summary');
    box.appendChild(h('ul', null, [
      h('li', { text: `Skewness of the residuals: ${S.fmt(S.skewness(res), 2)} (about 0 if symmetric).` }),
      h('li', { text: `Largest absolute standardised residual: ${S.fmt(Math.max(...a.stdres.map(Math.abs)), 2)}.` }),
      h('li', { text: `Largest Cook's distance: ${S.fmt(maxC, 2)} (case ${maxI + 1}, leverage ${S.fmt(a.lev[maxI], 2)}). Values above about 1, or far above the rest, deserve a look.` })
    ]));
    // Scatter
    const c3 = Chart.create(document.getElementById('scatter'), { width: 560, height: 320, x: Chart.extent(d.x), y: Chart.extent(d.y), xLabel: 'Predictor (x)', yLabel: 'Outcome (y)',
      title: 'Scatterplot with fitted line', desc: `Scatterplot of ${n} cases with the least-squares line, slope ${S.fmt(fit.b[1], 2)}.` });
    c3.points(d.x.map((v, i) => [v, d.y[i]]), { r: 3.5 });
    const xe = Chart.extent(d.x); c3.line([[xe[0], fit.b[0] + fit.b[1] * xe[0]], [xe[1], fit.b[0] + fit.b[1] * xe[1]]], { color: 'var(--s2)' });

    if (st.mode === 'explore') document.getElementById('explore-text').textContent = SCEN[st.scen].explain;
  }

  document.addEventListener('appresize', render);
  document.querySelector('details').addEventListener('toggle', e => { if (e.target.open) render(); });
  render();
})();
