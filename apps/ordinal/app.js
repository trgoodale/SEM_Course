(function () {
  'use strict';
  const S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'Two categories', text: 'Set the latent correlation to .50 and the number of categories to 2.',
    question: 'How does the Pearson correlation of the 0/1 scores compare with .50?', options: ['Lower', 'Equal', 'Higher'], answer: 0,
    explain: 'Cutting a continuous response into two categories throws away information, so the Pearson correlation of the categories understates the latent correlation (here it is about .33).' },
  { title: 'More categories', text: 'Increase the number of categories to 7.',
    question: 'The gap between the Pearson and latent correlations…', options: ['shrinks', 'grows'], answer: 0,
    explain: 'With more categories the observed scores track the latent response more closely. Look at the line chart: by five categories the gap is small when thresholds are symmetric.' },
  { title: 'Skewed items', text: 'Set five categories, then make item 1 "Strong skew (most answers low)" and item 2 "Strong skew (most answers high)".',
    question: 'What happens to the Pearson correlation?', options: ['It falls further', 'It rises'], answer: 0,
    explain: 'Items skewed in opposite directions cannot correlate strongly as category scores, whatever the latent correlation. This is when treating items as continuous is riskiest.' },
  { title: 'The polychoric correlation', text: 'Compare the two sample estimates in the tiles.',
    question: 'The polychoric correlation estimates…', options: ['the latent correlation', 'the Pearson correlation of the scores'], answer: 0,
    explain: 'It estimates the correlation between the underlying continuous responses, assuming they are normally distributed.' }
]);

  const st = { rho: 0.5, k: 4, skew1: 'symmetric', skew2: 'symmetric', n: 300, seed: 9 };
  const SKEW = { symmetric: 0, mild: 0.7, strong: 1.4, mildneg: -0.7, strongneg: -1.4 };
  const SKEW_LABELS = [{ value: 'symmetric', label: 'Symmetric' }, { value: 'mild', label: 'Mild skew (most answers low)' }, { value: 'strong', label: 'Strong skew (most answers low)' },
    { value: 'mildneg', label: 'Mild skew (most answers high)' }, { value: 'strongneg', label: 'Strong skew (most answers high)' }];

  document.getElementById('controls').append(
    UI.slider({ label: 'Latent correlation', min: 0, max: 0.95, step: 0.05, value: st.rho, format: v => S.fmtNoZero(v, 2), onInput: v => { st.rho = v; render(); } }).el,
    UI.slider({ label: 'Number of response categories', min: 2, max: 7, step: 1, value: st.k, format: v => String(v), onInput: v => { st.k = v; render(); } }).el,
    UI.select({ label: 'Item 1 thresholds', value: st.skew1, options: SKEW_LABELS, onChange: v => { st.skew1 = v; render(); } }).el,
    UI.select({ label: 'Item 2 thresholds', value: st.skew2, options: SKEW_LABELS, onChange: v => { st.skew2 = v; render(); } }).el,
    UI.slider({ label: 'Sample size for the simulated sample', min: 100, max: 2000, step: 100, value: st.n, format: v => String(v), onInput: v => { st.n = v; render(); } }).el
  );
  document.getElementById('buttons').append(UI.button('New sample', () => { st.seed = S.newSeed(); render(); }, 'secondary'));

  function thresholds(k, shift) {
    const t = []; for (let i = 1; i < k; i++) t.push(S.normQuantile(i / k) + shift); return t;
  }
  function cellProbs(t1, t2, rho) {
    const a = [-Infinity].concat(t1, [Infinity]), b = [-Infinity].concat(t2, [Infinity]);
    const P = [];
    for (let i = 0; i < a.length - 1; i++) { P.push([]); for (let j = 0; j < b.length - 1; j++) {
      const v = S.bvnCdf(a[i + 1], b[j + 1], rho) - S.bvnCdf(a[i], b[j + 1], rho) - S.bvnCdf(a[i + 1], b[j], rho) + S.bvnCdf(a[i], b[j], rho);
      P[i].push(Math.max(v, 0));
    } }
    return P;
  }
  function pearsonFromTable(P) {
    let ex = 0, ey = 0, exx = 0, eyy = 0, exy = 0;
    P.forEach((row, i) => row.forEach((p, j) => { const x = i + 1, y = j + 1; ex += p * x; ey += p * y; exx += p * x * x; eyy += p * y * y; exy += p * x * y; }));
    return (exy - ex * ey) / Math.sqrt((exx - ex * ex) * (eyy - ey * ey));
  }
  function popPearson(k, rho) { return pearsonFromTable(cellProbs(thresholds(k, SKEW[st.skew1]), thresholds(k, SKEW[st.skew2]), rho)); }

  function polychoric(counts, k) {
    const n = counts.flat().reduce((a, b) => a + b, 0);
    const marg = (rows) => { const c = []; let cum = 0; for (let i = 0; i < k - 1; i++) { cum += rows[i]; c.push(S.normQuantile(Math.min(Math.max(cum / n, 1e-6), 1 - 1e-6))); } return c; };
    const r1 = counts.map(r => r.reduce((a, b) => a + b, 0)), r2 = counts[0].map((_, j) => counts.reduce((a, r) => a + r[j], 0));
    const t1 = marg(r1), t2 = marg(r2);
    const nll = rho => { const P = cellProbs(t1, t2, rho); let s = 0; counts.forEach((row, i) => row.forEach((c, j) => { if (c) s -= c * Math.log(Math.max(P[i][j], 1e-12)); })); return s; };
    return S.goldenMin(nll, -0.99, 0.99, 1e-4);
  }

  function render() {
    const t1 = thresholds(st.k, SKEW[st.skew1]), t2 = thresholds(st.k, SKEW[st.skew2]);
    const P = cellProbs(t1, t2, st.rho), pop = pearsonFromTable(P);
    // sample
    const r = S.rng(st.seed), counts = S.zeros(st.k, st.k), xs = [], ys = [];
    const cat = (v, t) => { let c = 0; while (c < t.length && v > t[c]) c++; return c; };
    for (let i = 0; i < st.n; i++) {
      const z1 = r.normal(), z2 = st.rho * z1 + Math.sqrt(1 - st.rho * st.rho) * r.normal();
      const a = cat(z1, t1), b = cat(z2, t2); counts[a][b]++; xs.push(a + 1); ys.push(b + 1);
    }
    const samplePearson = S.cor(xs, ys), samplePoly = polychoric(counts, st.k);
    UI.stats(document.getElementById('stats'), [
      { k: 'Latent (true) r', v: S.fmtNoZero(st.rho, 3) },
      { k: 'Pearson r of scores (population)', v: S.fmtNoZero(pop, 3) },
      { k: 'Pearson r (your sample)', v: isFinite(samplePearson) ? S.fmtNoZero(samplePearson, 3) : '–' },
      { k: 'Polychoric r (your sample)', v: S.fmtNoZero(samplePoly, 3) }
    ]);
    document.getElementById('summary').textContent = st.rho === 0 ? 'With no latent correlation, both estimates are near zero.'
      : `Treating the ${st.k} categories as numbers gives a correlation ${Math.round(100 * (1 - pop / st.rho))}% smaller than the latent correlation. The polychoric correlation estimates the latent value directly.`;

    // latent density with thresholds and category proportions for item 1
    const marg = P.map(row => row.reduce((a, b) => a + b, 0));
    const c1 = Chart.create(document.getElementById('latent'), { width: 600, height: 260, x: [-3.5, 3.5], y: [0, 0.45], xLabel: 'Latent response (item 1)', yLabel: 'Density',
      title: 'Latent distribution and thresholds for item 1', desc: `Thresholds at ${t1.map(v => S.fmt(v, 2)).join(', ')}. Category proportions: ${marg.map((p, i) => `${i + 1}: ${Math.round(p * 100)}%`).join(', ')}.` });
    const edges = [-3.5].concat(t1.map(v => Math.max(-3.5, Math.min(3.5, v))), [3.5]);
    marg.forEach((p, i) => {
      const seg = []; for (let x = edges[i]; x <= edges[i + 1] + 1e-9; x += 0.02) seg.push([x, S.normPdf(x)]);
      if (seg.length > 1) c1.area(seg, seg.map(q => [q[0], 0]), { color: i % 2 ? 'var(--s1)' : 'var(--s4)', opacity: i % 2 ? 0.35 : 0.22 });
      const mid = (edges[i] + edges[i + 1]) / 2;
      if (edges[i + 1] - edges[i] > 0.3) c1.text(mid, S.normPdf(mid) * 0.35, String(i + 1), { anchor: 'middle', size: 14, weight: 700 });
    });
    const dens = []; for (let x = -3.5; x <= 3.5; x += 0.05) dens.push([x, S.normPdf(x)]);
    c1.line(dens, { color: 'var(--s1)', width: 2.5 });
    t1.forEach(t => { if (t > -3.5 && t < 3.5) c1.vline(t, { color: 'var(--s2)', dash: '5 4', width: 2 }); });
    const pbox = document.createElement('div'); document.getElementById('latent').appendChild(pbox);
    UI.table(pbox, { caption: 'Proportion choosing each category (item 1)', head: marg.map((_, i) => `Category ${i + 1}`), rows: [marg.map(p => Math.round(p * 100) + '%')] });

    // Pearson by number of categories
    const ks = [2, 3, 4, 5, 6, 7];
    const curve = ks.map(k => [k, popPearson(k, st.rho)]);
    const c2 = Chart.create(document.getElementById('bycat'), { width: 600, height: 280, x: [1.8, 7.2], y: [0, Math.max(0.1, st.rho * 1.1)], xTickValues: ks, xLabel: 'Number of categories', yLabel: 'Correlation',
      title: 'Pearson correlation by number of categories', desc: curve.map(p => `${p[0]} categories: ${S.fmtNoZero(p[1], 3)}`).join('; ') + `. Latent correlation ${S.fmtNoZero(st.rho, 2)}.` });
    c2.hline(st.rho, { color: 'var(--s3)', width: 2.5 });
    c2.line(curve, { color: 'var(--s2)', width: 3, dash: '8 4' });
    c2.points(curve, { color: 'var(--s2)', r: 5 });
    c2.points([[st.k, pop]], { color: 'var(--s2)', r: 8, hollow: true });
    Chart.legend(document.getElementById('bycat-legend'), [{ label: 'Latent (polychoric) correlation', color: 'var(--s3)' }, { label: 'Pearson r of scores', color: 'var(--s2)', dash: '8 4' }, { label: 'Your current setting', color: 'var(--s2)', shape: 'point', hollow: true }]);

    UI.table(document.getElementById('crosstab'), { caption: 'Proportion of people in each combination of responses', rowHeader: true, cornerLabel: 'Item 1 response',
      head: [''].concat(P[0].map((_, j) => `Item 2 = ${j + 1}`)), rows: P.map((row, i) => [`Item 1 = ${i + 1}`].concat(row.map(p => S.fmtNoZero(p, 3)))) });
    UI.announce(`Pearson correlation of scores ${S.fmtNoZero(pop, 3)} against a latent correlation of ${S.fmtNoZero(st.rho, 2)}. Sample polychoric ${S.fmtNoZero(samplePoly, 3)}.`);
  }
  document.addEventListener('appresize', render);
  render();
})();
