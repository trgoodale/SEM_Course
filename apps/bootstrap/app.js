(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'The shape of a × b', text: 'Look at the histogram of the bootstrap estimates of a × b.',
    question: 'With a and b both positive, the distribution is usually…', options: ['symmetric', 'skewed to the right'], answer: 1,
    explain: 'The product of two estimates is not normally distributed, especially in small samples. A symmetric, normal-theory interval therefore puts its limits in the wrong places.' },
  { title: 'Detecting a small effect', text: 'Set a = 0.20, b = 0.20 and N = 60, then press "Run 200 replications".',
    question: 'Which interval detects the effect (excludes 0) more often?', options: ['Normal theory (Sobel)', 'Percentile bootstrap'], answer: 1,
    explain: 'The Sobel interval is too wide on one side for a skewed distribution, so it misses real effects more often.' },
  { title: 'No effect', text: 'Set a = 0 and run the replications again.',
    question: 'How often should an interval wrongly exclude 0?', options: ['About 5% of samples or fewer', 'About half the time'], answer: 0,
    explain: 'With no true indirect effect, a good 95% interval should exclude zero in at most about 5% of samples.' },
  { title: 'Non-normal data', text: 'Set the distributions to "Heavily skewed".',
    question: 'Is the percentile bootstrap still appropriate?', options: ['Yes, it does not assume normality', 'No'], answer: 0,
    explain: 'The bootstrap builds the sampling distribution from the data themselves. This is why Amos offers it for non-normal data (Byrne, chapter 12).' }
]);

  const st = { a: 0.3, b: 0.3, c: 0.1, n: 100, dist: 'normal', B: 1000, seed: 12 };
  const f2 = v => S.fmt(v, 2);
  const re = UI.debounce(() => render(), 150);
  const mk = (k, label, min, max, step, fmt) => UI.slider({ label, min, max, step, value: st[k], format: fmt || f2, onInput: v => { st[k] = v; re(); } });
  document.getElementById('controls').append(
    mk('a', 'a: X → M', -0.6, 0.6, 0.05).el,
    mk('b', 'b: M → Y (controlling for X)', -0.6, 0.6, 0.05).el,
    mk('c', "c′: direct effect X → Y", -0.6, 0.6, 0.05).el,
    mk('n', 'Sample size (N)', 30, 500, 10, v => String(v)).el,
    UI.select({ label: 'Shape of the variables\' distributions', value: st.dist, options: [{ value: 'normal', label: 'Normal' }, { value: 'moderate', label: 'Moderately skewed' }, { value: 'heavy', label: 'Heavily skewed' }], onChange: v => { st.dist = v; render(); } }).el,
    UI.select({ label: 'Bootstrap resamples', value: String(st.B), options: [{ value: '500', label: '500' }, { value: '1000', label: '1,000' }, { value: '2000', label: '2,000' }, { value: '5000', label: '5,000' }], onChange: v => { st.B = +v; render(); } }).el
  );
  document.getElementById('buttons').append(UI.button('New sample', () => { st.seed = S.newSeed(); render(); }, 'secondary'));

  function draw(r) {
    if (st.dist === 'normal') return r.normal();
    const df = st.dist === 'moderate' ? 8 : 1; let s = 0;
    for (let i = 0; i < df; i++) { const z = r.normal(); s += z * z; }
    return (s - df) / Math.sqrt(2 * df);
  }
  function simulate(r) {
    const n = st.n, X = new Float64Array(n), M = new Float64Array(n), Y = new Float64Array(n);
    const eM = Math.sqrt(Math.max(1 - st.a * st.a, 0.05));
    for (let i = 0; i < n; i++) { X[i] = draw(r); M[i] = st.a * X[i] + eM * draw(r); Y[i] = st.c * X[i] + st.b * M[i] + draw(r); }
    return { X, M, Y };
  }
  // a from M ~ X, b from Y ~ X + M, for the cases listed in idx; also SEs
  function est(d, idx, withSE) {
    const n = idx.length; let sx = 0, sm = 0, sy = 0;
    for (let k = 0; k < n; k++) { const i = idx[k]; sx += d.X[i]; sm += d.M[i]; sy += d.Y[i]; }
    const mx = sx / n, mm = sm / n, my = sy / n;
    let xx = 0, mmv = 0, xm = 0, xy = 0, my2 = 0, yy = 0;
    for (let k = 0; k < n; k++) { const i = idx[k], x = d.X[i] - mx, m = d.M[i] - mm, y = d.Y[i] - my; xx += x * x; mmv += m * m; xm += x * m; xy += x * y; my2 += m * y; yy += y * y; }
    const a = xm / xx, det = xx * mmv - xm * xm;
    const c = (mmv * xy - xm * my2) / det, b = (xx * my2 - xm * xy) / det;
    if (!withSE) return { a, b };
    const sseM = mmv - a * xm, seA = Math.sqrt(sseM / (n - 2) / xx);
    const sseY = yy - c * xy - b * my2, seB = Math.sqrt(sseY / (n - 3) * xx / det);
    return { a, b, c, seA, seB };
  }
  function boot(d, B, r) {
    const n = d.X.length, out = new Float64Array(B), idx = new Int32Array(n);
    for (let k = 0; k < B; k++) { for (let i = 0; i < n; i++) idx[i] = Math.floor(r() * n); const e = est(d, idx); out[k] = e.a * e.b; }
    return Array.from(out).sort((p, q) => p - q);
  }
  const all = n => { const a = new Int32Array(n); for (let i = 0; i < n; i++) a[i] = i; return a; };

  function render() {
    const r = S.rng(st.seed), d = simulate(r), e = est(d, all(st.n), true);
    const ab = e.a * e.b, seSobel = Math.sqrt(e.b * e.b * e.seA * e.seA + e.a * e.a * e.seB * e.seB);
    const norm = [ab - 1.96 * seSobel, ab + 1.96 * seSobel];
    const bs = boot(d, st.B, S.rng(st.seed + 1));
    const pct = [S.quantile(bs, 0.025), S.quantile(bs, 0.975)];
    const truth = st.a * st.b;
    UI.stats(document.getElementById('stats'), [
      { k: 'a', v: S.fmt(e.a, 3) }, { k: 'b', v: S.fmt(e.b, 3) }, { k: 'a × b', v: S.fmt(ab, 3) }, { k: 'True a × b', v: S.fmt(truth, 3) }
    ]);
    const excl = ci => ci[0] > 0 || ci[1] < 0;
    UI.table(document.getElementById('ci'), { caption: '95% confidence intervals for the indirect effect', rowHeader: true, head: ['Method', 'Lower', 'Upper', 'Excludes 0?'], rows: [
      ['Normal theory (Sobel)', S.fmt(norm[0], 3), S.fmt(norm[1], 3), excl(norm) ? 'Yes' : 'No'],
      [`Percentile bootstrap (${st.B.toLocaleString('en-GB')} resamples)`, S.fmt(pct[0], 3), S.fmt(pct[1], 3), excl(pct) ? 'Yes' : 'No']] });

    const lo = Math.min(bs[0], norm[0]), hi = Math.max(bs[bs.length - 1], norm[1]);
    const bins = 36, w = (hi - lo) / bins || 1, counts = new Array(bins).fill(0);
    bs.forEach(v => { counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++; });
    const maxC = Math.max(...counts);
    const ch = Chart.create(document.getElementById('hist'), { width: 600, height: 300, x: [lo - w, hi + w], y: [0, maxC * 1.25], xLabel: 'a × b', yLabel: 'Number of resamples',
      title: 'Bootstrap distribution of the indirect effect', desc: `Skewness of the bootstrap distribution ${S.fmt(S.skewness(bs), 2)}. Percentile interval ${S.fmt(pct[0], 3)} to ${S.fmt(pct[1], 3)}; normal-theory interval ${S.fmt(norm[0], 3)} to ${S.fmt(norm[1], 3)}.` });
    counts.forEach((c, i) => ch.rect(lo + i * w, 0, lo + (i + 1) * w, c, { color: 'var(--s1)', opacity: 0.55, stroke: 'var(--bg)', strokeWidth: 0.5 }));
    const yTop = maxC * 1.15;
    ch.line([[pct[0], yTop], [pct[1], yTop]], { color: 'var(--s2)', width: 4, parent: ch.overlay });
    ch.line([[norm[0], yTop * 0.93], [norm[1], yTop * 0.93]], { color: 'var(--s4)', width: 4, dash: '6 4', parent: ch.overlay });
    pct.forEach(v => ch.vline(v, { color: 'var(--s2)', dash: '3 3', width: 1.5 }));
    if (lo - w < 0 && hi + w > 0) ch.vline(0, { color: 'var(--text)', width: 1.5 });
    Chart.legend(document.getElementById('hist-legend'), [{ label: 'Bootstrap a × b', color: 'var(--s1)', shape: 'band' }, { label: 'Percentile 95% CI', color: 'var(--s2)' }, { label: 'Normal-theory 95% CI', color: 'var(--s4)', dash: '6 4' }, { label: 'Zero', color: 'var(--text)' }]);
    UI.announce(`a times b equals ${S.fmt(ab, 3)}. Percentile interval ${S.fmt(pct[0], 3)} to ${S.fmt(pct[1], 3)}.`);
  }

  const runBtn = document.getElementById('run');
  runBtn.addEventListener('click', () => {
    const R = 200, B = 500, truth = st.a * st.b, res = { covN: 0, covP: 0, sigN: 0, sigP: 0 }, r = S.rng(S.newSeed());
    const pb = document.getElementById('progress'), pbBox = document.getElementById('progress-box'), out = document.getElementById('sim');
    pbBox.hidden = false; pb.value = 0; runBtn.disabled = true; out.textContent = 'Running…';
    let k = 0;
    const step = () => {
      const end = Math.min(R, k + 10);
      for (; k < end; k++) {
        const d = simulate(r), e = est(d, all(st.n), true), ab = e.a * e.b;
        const se = Math.sqrt(e.b * e.b * e.seA * e.seA + e.a * e.a * e.seB * e.seB), n = [ab - 1.96 * se, ab + 1.96 * se];
        const bs = boot(d, B, r), p = [S.quantile(bs, 0.025), S.quantile(bs, 0.975)];
        if (n[0] <= truth && truth <= n[1]) res.covN++; if (p[0] <= truth && truth <= p[1]) res.covP++;
        if (n[0] > 0 || n[1] < 0) res.sigN++; if (p[0] > 0 || p[1] < 0) res.sigP++;
      }
      pb.value = k;
      if (k < R) { setTimeout(step, 0); return; }
      runBtn.disabled = false; pbBox.hidden = true; out.innerHTML = '';
      const pc = x => Math.round(100 * x / R) + '%';
      UI.table(out, { caption: `Results over ${R} samples (N = ${st.n}, true a × b = ${S.fmt(truth, 3)})`, rowHeader: true, head: ['Method', 'Coverage (target 95%)', truth === 0 ? 'False positives (excludes 0)' : 'Power (excludes 0)'], rows: [
        ['Normal theory (Sobel)', pc(res.covN), pc(res.sigN)], ['Percentile bootstrap', pc(res.covP), pc(res.sigP)]] });
      UI.announceNow(`Done. Coverage: Sobel ${pc(res.covN)}, bootstrap ${pc(res.covP)}. ${truth === 0 ? 'False positives' : 'Power'}: Sobel ${pc(res.sigN)}, bootstrap ${pc(res.sigP)}.`);
    };
    setTimeout(step, 30);
  });
  document.addEventListener('appresize', render);
  render();
})();
