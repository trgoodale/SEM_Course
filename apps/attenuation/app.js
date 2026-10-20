(function () {
  'use strict';
  const S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'Perfect measurement', text: 'Set the reliability of X and of Y to 1.00.',
    question: 'How does the observed slope compare with the true slope?', options: ['About the same', 'Much smaller'], answer: 0,
    explain: 'With no measurement error the observed scores are the true scores, so only sampling error separates the two.' },
  { title: 'An unreliable predictor', text: 'Set the reliability of X to .70, a common value for short scales.',
    question: 'The observed slope will be roughly what proportion of the true slope?', options: ['70%', '84%', '100%'], answer: 0,
    explain: 'Error in X adds variance to X but not to its covariance with Y, so the slope shrinks by the reliability of X: observed slope ≈ true slope × .70.' },
  { title: 'An unreliable outcome', text: 'Now set the reliability of X back to 1.00 and the reliability of Y to .60.',
    question: 'What happens?', options: ['The slope is unbiased but the correlation is lower', 'Both are lower', 'Both are unbiased'], answer: 0,
    explain: 'Error in Y just adds noise around the line: the slope stays unbiased on average, but the correlation and R² fall.' },
  { title: 'The remedy', text: 'Think about the methods you will meet in this course.',
    question: 'Which approach removes this bias?', options: ['A bigger sample', 'Latent variables measured by several items', 'Standardising the scores'], answer: 1,
    explain: 'A larger sample only makes the biased estimate more precise. A latent variable separates the shared, true-score variance of several items from their errors, so relationships between latent variables are not attenuated.' }
]);

  const st = { rho: 0.5, rxx: 0.7, ryy: 0.8, n: 300, seed: 5, showTrue: false };
  const f2 = v => S.fmtNoZero(v, 2);
  const mk = (k, label, min, max, step, hint, fmt) => UI.slider({ label, min, max, step, value: st[k], hint, format: fmt || f2, onInput: v => { st[k] = v; render(); } });
  document.getElementById('controls').append(
    mk('rho', 'True correlation (= true standardised slope)', 0, 0.95, 0.05).el,
    mk('rxx', 'Reliability of X', 0.3, 1, 0.05, 'Proportion of observed X variance that is true-score variance.').el,
    mk('ryy', 'Reliability of Y', 0.3, 1, 0.05).el,
    mk('n', 'Sample size (N)', 50, 2000, 50, null, v => String(v)).el
  );
  document.getElementById('toggles').append(UI.checkbox({ label: 'Also plot the true scores', onChange: v => { st.showTrue = v; render(); } }).el);
  document.getElementById('buttons').append(UI.button('New sample', () => { st.seed = S.newSeed(); render(); }, 'secondary'));

  function simulate() {
    const r = S.rng(st.seed), T = [], U = [], X = [], Y = [];
    const ex = Math.sqrt((1 - st.rxx) / st.rxx), ey = Math.sqrt((1 - st.ryy) / st.ryy);
    for (let i = 0; i < st.n; i++) {
      const t = r.normal(), u = st.rho * t + Math.sqrt(1 - st.rho * st.rho) * r.normal();
      T.push(t); U.push(u); X.push(t + ex * r.normal()); Y.push(u + ey * r.normal());
    }
    return { T, U, X, Y };
  }

  function render() {
    const d = simulate();
    const slopeTrue = S.cov(d.T, d.U) / S.variance(d.T), slopeObs = S.cov(d.X, d.Y) / S.variance(d.X);
    const rTrue = S.cor(d.T, d.U), rObs = S.cor(d.X, d.Y);
    const expSlope = st.rho * st.rxx, expR = st.rho * Math.sqrt(st.rxx * st.ryy);
    UI.table(document.getElementById('table'), {
      caption: 'Slope of Y on X and correlation', rowHeader: true,
      head: ['Quantity', 'True scores (population)', 'Observed scores (expected)', 'Observed in this sample'],
      rows: [
        ['Slope', S.fmt(st.rho, 3), S.fmt(expSlope, 3), S.fmt(slopeObs, 3)],
        ['Correlation r', S.fmt(st.rho, 3), S.fmt(expR, 3), S.fmt(rObs, 3)],
        ['R²', S.fmt(st.rho * st.rho, 3), S.fmt(expR * expR, 3), S.fmt(rObs * rObs, 3)]
      ]
    });
    const pct = st.rho > 0 ? Math.round(100 * (1 - st.rxx)) : 0;
    const sum = document.getElementById('summary');
    sum.textContent = st.rho === 0 ? 'With no true relationship there is nothing to attenuate.'
      : `With reliability ${f2(st.rxx)} for X, the observed slope is expected to be ${pct}% smaller than the true slope (${S.fmt(expSlope, 2)} instead of ${S.fmt(st.rho, 2)}). In this sample of the true scores, the slope was ${S.fmt(slopeTrue, 2)}.`;

    const lim = 4;
    const ch = Chart.create(document.getElementById('chart'), {
      width: 560, height: 460, x: [-lim, lim], y: [-lim, lim], xLabel: 'X (standard units)', yLabel: 'Y (standard units)',
      title: 'Observed scores with true and observed regression lines',
      desc: `Scatterplot of ${st.n} observed cases. The observed regression line has slope ${S.fmt(slopeObs, 2)}; the true-score line has slope ${S.fmt(st.rho, 2)}.`
    });
    const sub = Math.min(st.n, 600);
    if (st.showTrue) ch.points(d.T.slice(0, sub).map((t, i) => [t, d.U[i]]), { color: 'var(--s3)', r: 2.6, opacity: 0.5, shape: 'triangle' });
    ch.points(d.X.slice(0, sub).map((x, i) => [x, d.Y[i]]), { r: 2.8, opacity: 0.45 });
    const mx = S.mean(d.X), my = S.mean(d.Y);
    ch.line([[-lim, st.rho * -lim], [lim, st.rho * lim]], { color: 'var(--s3)', width: 3.5 });
    ch.line([[-lim, my + slopeObs * (-lim - mx)], [lim, my + slopeObs * (lim - mx)]], { color: 'var(--s2)', width: 3.5, dash: '9 5' });
    const items = [{ label: 'Observed cases', color: 'var(--s1)', shape: 'point' }];
    if (st.showTrue) items.push({ label: 'True scores', color: 'var(--s3)', shape: 'triangle' });
    items.push({ label: 'True-score line', color: 'var(--s3)' }, { label: 'Observed line', color: 'var(--s2)', dash: '9 5' });
    Chart.legend(document.getElementById('legend'), items);
    UI.announce(`Observed slope ${S.fmt(slopeObs, 2)} against a true slope of ${S.fmt(st.rho, 2)}. Observed correlation ${S.fmt(rObs, 2)}.`);
  }
  document.addEventListener('appresize', render);
  render();
})();
