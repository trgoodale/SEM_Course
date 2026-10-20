(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'Two kinds of answer', text: 'The first example ("Close fit, moderate sample") is loaded.',
    question: 'Is the χ² test significant?', options: ['Yes: exact fit is rejected', 'No'], answer: 0,
    explain: 'χ²(40) = 85.4 gives p < .001. Yet RMSEA is .062 and CFI .967, which most researchers would call reasonable fit. χ² tests whether the model fits exactly; the indices describe how far it is from fitting.' },
  { title: 'More cases, same misfit', text: 'Change N from 300 to 1200, leaving χ² unchanged.',
    question: 'What happens to RMSEA?', options: ['It increases', 'It decreases', 'It stays the same'], answer: 1,
    explain: 'RMSEA divides the excess χ² (χ² − df) by df × (N − 1). With the same χ² and more cases, the misfit per case is smaller. (In practice χ² itself grows with N for a model that is slightly wrong.)' },
  { title: 'Very few degrees of freedom', text: 'Choose the example "Very few degrees of freedom".',
    question: 'How wide is the RMSEA confidence interval?', options: ['Narrow', 'Very wide'], answer: 1,
    explain: 'With df = 2 there is little information about misfit, so RMSEA is estimated very imprecisely. Some authors advise not to interpret RMSEA when df is small.' },
  { title: 'Why χ² rejects', text: 'Scroll to the chart at the bottom and move the population RMSEA slider.',
    question: 'With a small, unimportant misfit (RMSEA .03) and N = 2000, the χ² test will…', options: ['usually reject the model', 'rarely reject the model'], answer: 0,
    explain: 'With enough cases χ² detects even trivial misfit. That is why fit indices and their confidence intervals are reported alongside it.' }
]);

  const PRESETS = {
    close: { label: 'Close fit, moderate sample', chi: 85.4, df: 40, n: 300, chiB: 1450, dfB: 55 },
    large: { label: 'Large sample, small misfit', chi: 412.6, df: 164, n: 1200, chiB: 9800, dfB: 190 },
    fewdf: { label: 'Very few degrees of freedom', chi: 6.2, df: 2, n: 150, chiB: 310, dfB: 10 },
    poor: { label: 'Poor fit', chi: 520.3, df: 98, n: 400, chiB: 3200, dfB: 120 }
  };
  const st = Object.assign({}, PRESETS.close);
  const presetSel = UI.select({ label: 'Start from an example', value: 'close', options: Object.keys(PRESETS).map(k => ({ value: k, label: PRESETS[k].label })),
    onChange: k => { Object.assign(st, PRESETS[k]); for (const key of Object.keys(inputs)) inputs[key].set(st[key]); render(); } });
  document.getElementById('preset').appendChild(presetSel.el);

  const inputs = {
    chi: UI.number({ label: 'Model χ² (CMIN)', min: 0, step: 0.1, value: st.chi, onInput: v => { st.chi = v; render(); } }),
    df: UI.number({ label: 'Model df', min: 1, step: 1, value: st.df, onInput: v => { st.df = v; render(); } }),
    n: UI.number({ label: 'Sample size (N)', min: 10, step: 1, value: st.n, onInput: v => { st.n = v; render(); } }),
    chiB: UI.number({ label: 'Independence model χ²', min: 0, step: 0.1, value: st.chiB, onInput: v => { st.chiB = v; render(); } }),
    dfB: UI.number({ label: 'Independence model df', min: 1, step: 1, value: st.dfB, onInput: v => { st.dfB = v; render(); } })
  };
  document.getElementById('inputs').append(...Object.values(inputs).map(i => i.el));

  const nst = { eps: 0.04 };
  const epsS = UI.slider({ label: 'Population RMSEA (amount of misfit)', min: 0.01, max: 0.12, step: 0.005, value: nst.eps, format: v => S.fmtNoZero(v, 3), onInput: v => { nst.eps = v; renderN(); } });
  document.getElementById('n-controls').appendChild(epsS.el);

  function judge(val, good, ok, higherBetter) {
    if (!isFinite(val)) return UI.badge('n/a', '');
    const g = higherBetter ? val >= good : val <= good, o = higherBetter ? val >= ok : val <= ok;
    return UI.badge(g ? 'Good' : o ? 'Acceptable' : 'Poor', g ? 'good' : o ? 'warn' : 'bad');
  }

  function render() {
    const err = document.getElementById('error');
    const vals = Object.values(inputs).map(i => i.validate());
    let msg = '';
    if (vals.some(v => v === null)) msg = 'Fix the highlighted entries.';
    else if (st.dfB <= st.df) msg = 'The independence model should have more degrees of freedom than your model.';
    else if (st.chiB < st.chi) msg = 'The independence model should fit worse (larger χ²) than your model.';
    err.textContent = msg;
    if (msg) { document.getElementById('stats').innerHTML = ''; document.getElementById('table').innerHTML = ''; return; }
    const p = S.chisqSf(st.chi, st.df), rm = S.rmsea(st.chi, st.df, st.n);
    const cfi = S.cfi(st.chi, st.df, st.chiB, st.dfB), tli = S.tli(st.chi, st.df, st.chiB, st.dfB), nfi = 1 - st.chi / st.chiB;
    UI.stats(document.getElementById('stats'), [
      { k: 'χ²/df', v: S.fmt(st.chi / st.df, 2) }, { k: 'p (exact fit)', v: S.fmtP(p) },
      { k: 'RMSEA [90% CI]', v: `${S.fmtNoZero(rm.point, 3)} [${S.fmtNoZero(rm.lo, 3)}, ${S.fmtNoZero(rm.hi, 3)}]` },
      { k: 'CFI', v: S.fmtNoZero(cfi, 3) }
    ]);
    const rows = [
      ['χ² test', `χ²(${st.df}) = ${S.fmt(st.chi, 2)}, p ${p < 0.001 ? '< .001' : '= ' + S.fmtNoZero(p, 3)}`, 'p > .05', p > 0.05 ? UI.badge('Not rejected', 'good') : UI.badge('Rejected', 'warn')],
      ['RMSEA', `${S.fmtNoZero(rm.point, 3)}, 90% CI [${S.fmtNoZero(rm.lo, 3)}, ${S.fmtNoZero(rm.hi, 3)}]`, '≤ .06 good; ≤ .08 acceptable', judge(rm.point, 0.06, 0.08, false)],
      ['PCLOSE', S.fmtP(rm.pclose), '> .05 (test of RMSEA ≤ .05)', rm.pclose > 0.05 ? UI.badge('Close fit not rejected', 'good') : UI.badge('Close fit rejected', 'warn')],
      ['CFI', S.fmtNoZero(cfi, 3), '≥ .95 good; ≥ .90 acceptable', judge(cfi, 0.95, 0.90, true)],
      ['TLI', S.fmtNoZero(tli, 3), '≥ .95 good; ≥ .90 acceptable', judge(tli, 0.95, 0.90, true)],
      ['NFI', S.fmtNoZero(nfi, 3), 'Rewards complexity; rarely recommended now', UI.badge('Not judged', '')]
    ];
    UI.table(document.getElementById('table'), { caption: 'Indices and conventional benchmarks', rowHeader: true, head: ['Index', 'Value', 'Rough benchmark', 'Judgement'], leftCols: [1, 2, 3], rows });
    const f = document.getElementById('formulas'); f.innerHTML = '';
    const n = st.n - 1;
    f.append(h('p', { class: 'formula', text:
      `RMSEA = √( max(χ² − df, 0) / (df × (N − 1)) )\n      = √( max(${S.fmt(st.chi, 2)} − ${st.df}, 0) / (${st.df} × ${n}) ) = ${S.fmt(rm.point, 4)}\n\n` +
      `CFI = 1 − max(χ² − df, 0) / max(χ²_B − df_B, χ² − df, 0)\n    = 1 − ${S.fmt(Math.max(st.chi - st.df, 0), 2)} / ${S.fmt(Math.max(st.chiB - st.dfB, st.chi - st.df, 0), 2)} = ${S.fmt(cfi, 4)}\n\n` +
      `TLI = (χ²_B/df_B − χ²/df) / (χ²_B/df_B − 1)\n    = (${S.fmt(st.chiB / st.dfB, 3)} − ${S.fmt(st.chi / st.df, 3)}) / (${S.fmt(st.chiB / st.dfB, 3)} − 1) = ${S.fmt(tli, 4)}` }),
      h('p', { text: 'χ² − df estimates how much misfit there is beyond what sampling error alone would produce. RMSEA scales it per degree of freedom and per case; CFI and TLI compare it with the misfit of the independence model, in which no variables are related.' }));
    UI.announce(`RMSEA ${S.fmtNoZero(rm.point, 3)}, CFI ${S.fmtNoZero(cfi, 3)}, TLI ${S.fmtNoZero(tli, 3)}, chi-square p ${S.fmtP(p)}.`);
    renderN();
  }

  function power(N, df, eps) {
    const crit = S.bisect(x => S.chisqCdf(x, df) - 0.95, 0, df * 10 + 100);
    const lam = (N - 1) * df * eps * eps;
    return 1 - S.ncChisqCdf(crit, df, lam);
  }
  function renderN() {
    const df = st.df > 0 ? st.df : 40;
    const Ns = []; for (let N = 50; N <= 3000; N += 50) Ns.push(N);
    const pw = Ns.map(N => [N, power(N, df, nst.eps)]);
    const marks = [100, 200, 500, 1000, 2000];
    const ch = Chart.create(document.getElementById('n-chart'), {
      width: 600, height: 300, x: [0, 3000], y: [0, 1], xLabel: 'Sample size (N)', yLabel: 'Probability of rejecting', yTickFormat: v => Math.round(v * 100) + '%',
      title: 'Probability that the χ² test rejects a slightly wrong model',
      desc: `For df = ${df} and population RMSEA ${S.fmtNoZero(nst.eps, 3)}: ` + marks.map(N => `N = ${N}: ${Math.round(power(N, df, nst.eps) * 100)}%`).join('; ') + '.'
    });
    ch.hline(0.05, { color: 'var(--muted)', dash: '4 4', width: 1 });
    ch.line(pw, { color: 'var(--s1)', width: 3 });
    if (st.n >= 50 && st.n <= 3000) { ch.vline(st.n, { color: 'var(--s2)', dash: '6 4', width: 2 }); ch.text(st.n, 0.04, ` your N = ${st.n} `, { dy: -4, anchor: st.n > 2000 ? 'end' : 'start' }); }
    UI.table(document.getElementById('n-table'), { caption: `Probability of rejecting the model (df = ${df}, population RMSEA = ${S.fmtNoZero(nst.eps, 3)})`, head: ['N'].concat(marks.map(String)), rowHeader: true,
      rows: [['Rejection rate'].concat(marks.map(N => Math.round(power(N, df, nst.eps) * 100) + '%'))] });
  }
  document.addEventListener('appresize', render);
  render();
})();
