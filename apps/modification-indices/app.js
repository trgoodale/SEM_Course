(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'Look before you leap', text: 'The population contains a hidden problem. Look at the residual table and the list of modification indices (MIs).',
    question: 'The two largest MIs are equal. What does that tell you?', options: ['The app has a bug', 'Two different changes would improve fit equally: the data cannot choose between them', 'Both must be freed'], answer: 1,
    explain: 'These are equivalent modifications. Only theory can decide which one is right; here, x4 is an F2 item, and a cross-loading on F1 is one candidate.' },
  { title: 'Free a parameter', text: 'Press "Free" next to x4 ← F1.',
    question: 'How much will χ² fall?', options: ['About the value of the MI', 'Not at all', 'About twice the MI'], answer: 0,
    explain: 'An MI estimates the drop in χ² from freeing that one parameter. Here the app refits the model exactly, so the drop matches.' },
  { title: 'Capitalising on chance', text: 'Set the population to "Correctly specified". Press "Free the largest MI" three times, then "Test on a new sample".',
    question: 'In the new sample, the freed parameters will mostly…', options: ['replicate', 'not replicate'], answer: 1,
    explain: 'With a correct model every MI reflects chance features of this sample. Freeing them improves fit here but not in new data (MacCallum et al., 1992).' },
  { title: 'A defensible rule', text: 'Think about what you would do with your own data.',
    question: 'Which is the best protection against capitalising on chance?', options: ['Free only changes you can justify by theory, and check they replicate', 'Free every MI above 4', 'Use a higher MI threshold'], answer: 0,
    explain: 'A threshold only changes how many chance effects you pick up. Substantive justification, few changes, and replication (or cross-validation) are what protect you.' }
]);

  const P = 6, FAC = [0, 0, 0, 1, 1, 1];
  const POP_LOAD = [0.7, 0.75, 0.65, 0.7, 0.6, 0.75], POP_PHI = 0.4;
  const st = { mis: 'cross', n: 300, seed: 3, freed: [], resType: 'cor', last: null, history: [] };

  const POPS = {
    none: 'Correctly specified (no hidden problem)',
    cross: 'Hidden cross-loading',
    ecov: 'Hidden error covariance',
    both: 'Both hidden problems'
  };

  function popSigma(mis) {
    const L = S.zeros(P, 2); for (let i = 0; i < P; i++) L[i][FAC[i]] = POP_LOAD[i];
    if (mis === 'cross' || mis === 'both') L[3][0] = 0.35;
    const Phi = [[1, POP_PHI], [POP_PHI, 1]];
    const Sig = S.matmul(S.matmul(L, Phi), S.transpose(L));
    for (let i = 0; i < P; i++) Sig[i][i] += 1 - POP_LOAD[i] * POP_LOAD[i];
    if (mis === 'ecov' || mis === 'both') { Sig[1][2] += 0.2; Sig[2][1] += 0.2; }
    return Sig;
  }
  function sampleS(seed) {
    const r = S.rng(seed), rows = S.mvnSample(st.n, new Array(P).fill(0), popSigma(st.mis), r);
    const cols = []; for (let j = 0; j < P; j++) cols.push(rows.map(x => x[j]));
    return S.covMatrix(cols);
  }

  // Candidate parameters that can be freed
  const CANDS = [];
  for (let i = 0; i < P; i++) CANDS.push({ id: `L${i}`, type: 'load', i, f: 1 - FAC[i], label: `x${i + 1} ← F${2 - FAC[i]} (cross-loading)` });
  for (let i = 0; i < P; i++) for (let j = i + 1; j < P; j++) CANDS.push({ id: `E${i}${j}`, type: 'ecov', i, j, label: `e${i + 1} ↔ e${j + 1} (error covariance)` });
  const cand = id => CANDS.find(c => c.id === id);

  // Build Sigma from a parameter vector
  function spec(freed) {
    const list = [];
    for (let i = 0; i < P; i++) list.push({ type: 'load', i, f: FAC[i], label: `x${i + 1} ← F${FAC[i] + 1}` });
    list.push({ type: 'phi', label: 'F1 ↔ F2 (factor correlation)' });
    for (let i = 0; i < P; i++) list.push({ type: 'err', i, label: `Variance of e${i + 1}` });
    for (const id of freed) list.push(Object.assign({ id }, cand(id)));
    return list;
  }
  function sigmaOf(list, th) {
    const L = S.zeros(P, 2), T = S.zeros(P, P); let phi = 0;
    list.forEach((p, k) => {
      if (p.type === 'load') L[p.i][p.f] = th[k];
      else if (p.type === 'phi') phi = th[k];
      else if (p.type === 'err') T[p.i][p.i] = Math.exp(th[k]);
      else if (p.type === 'ecov') { T[p.i][p.j] = th[k]; T[p.j][p.i] = th[k]; }
    });
    const Sig = S.matmul(S.matmul(L, [[1, phi], [phi, 1]]), S.transpose(L));
    for (let i = 0; i < P; i++) for (let j = 0; j < P; j++) Sig[i][j] += T[i][j];
    return Sig;
  }
  function fit(Smat, freed, start) {
    const list = spec(freed);
    const x0 = list.map((p, k) => {
      if (start && start[k] !== undefined) return start[k];
      if (p.type === 'load') return p.f === FAC[p.i] ? 0.7 * Math.sqrt(Smat[p.i][p.i]) : 0;
      if (p.type === 'phi') return 0.3;
      if (p.type === 'err') return Math.log(0.5 * Smat[p.i][p.i]);
      return 0;
    });
    const f = th => { const Sig = sigmaOf(list, th); if (Math.abs(th[P]) >= 0.999) return Infinity; return S.mlDiscrepancy(Smat, Sig); };
    const res = S.minimize(f, x0, { maxIter: 400 });
    const Sig = sigmaOf(list, res.x);
    const chi = (st.n - 1) * Math.max(res.value, 0), df = 21 - list.length;
    return { list, th: res.x, Sig, chi, df, F: res.value };
  }
  function modIndices(Smat, base) {
    const out = [];
    for (const c of CANDS) {
      if (st.freed.includes(c.id)) continue;
      if (base.df - 1 < 1) { out.push({ c, mi: NaN, epc: NaN }); continue; }
      const r = fit(Smat, st.freed.concat([c.id]), base.th.concat([0]));
      out.push({ c, mi: Math.max(base.chi - r.chi, 0), epc: r.th[r.th.length - 1] });
    }
    return out.sort((a, b) => (b.mi || 0) - (a.mi || 0));
  }

  // Controls
  const popSel = UI.select({ label: 'What is true in the population?', value: st.mis, options: Object.keys(POPS).map(k => ({ value: k, label: POPS[k] })),
    hint: 'In real research you never know this. Try to discover it from the output.', onChange: v => { st.mis = v; reset(); } });
  const nS = UI.slider({ label: 'Sample size (N)', min: 100, max: 1500, step: 50, value: st.n, format: v => String(v), onInput: UI.debounce(v => { st.n = v; reset(); }, 250) });
  document.getElementById('pop').append(popSel.el, nS.el);
  document.getElementById('pop-buttons').append(
    UI.button('New sample', () => { st.seed = S.newSeed(); reset(); }, 'secondary'),
    UI.button('Free the largest MI', () => { const top = st.last && st.last.mis.find(m => isFinite(m.mi)); if (top) { st.freed.push(top.c.id); st.history.push({ id: top.c.id, mi: top.mi }); render(`Freed ${top.c.label}.`); } }, 'secondary')
  );
  const resSel = UI.select({ label: 'Residuals to show', value: 'cor', options: [{ value: 'cor', label: 'Correlation residuals (observed r − implied r)' }, { value: 'norm', label: 'Normalised residuals (approximate z values)' }],
    onChange: v => { st.resType = v; render(); } });
  document.getElementById('res-type').appendChild(resSel.el);
  document.getElementById('validate').addEventListener('click', validate);

  function reset() { st.freed = []; st.history = []; document.getElementById('validation').innerHTML = ''; render(); }

  function render(msg) {
    const Smat = sampleS(st.seed);
    const base = fit(Smat, st.freed);
    const chiB = (st.n - 1) * (Smat.reduce((s, r, i) => s + Math.log(r[i]), 0) - S.logdet(Smat)), dfB = 15;
    const rm = S.rmsea(base.chi, base.df, st.n);
    const mis = modIndices(Smat, base);
    st.last = { Smat, base, mis };

    UI.stats(document.getElementById('fit'), [
      { k: 'χ²', v: S.fmt(base.chi, 2) }, { k: 'df', v: String(base.df) }, { k: 'p', v: S.fmtP(S.chisqSf(base.chi, base.df)) },
      { k: 'RMSEA', v: S.fmtNoZero(rm.point, 3) }, { k: 'CFI', v: S.fmtNoZero(S.cfi(base.chi, base.df, chiB, dfB), 3) }
    ]);
    const fn = document.getElementById('fit-note'); fn.innerHTML = '';
    if (st.freed.length) fn.appendChild(h('p', { text: 'Freed so far: ' + st.freed.map(id => cand(id).label).join('; ') + '.' }));

    // Residuals
    const Sig = base.Sig, names = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6'];
    const R = [];
    for (let i = 0; i < P; i++) { R.push([]); for (let j = 0; j < P; j++) {
      R[i].push(st.resType === 'cor'
        ? Smat[i][j] / Math.sqrt(Smat[i][i] * Smat[j][j]) - Sig[i][j] / Math.sqrt(Sig[i][i] * Sig[j][j])
        : (Smat[i][j] - Sig[i][j]) / Math.sqrt((Sig[i][i] * Sig[j][j] + Sig[i][j] * Sig[i][j]) / st.n));
    } }
    const thr = st.resType === 'cor' ? 0.1 : 2.58;
    let flagged = [];
    UI.table(document.getElementById('residuals'), {
      caption: st.resType === 'cor' ? 'Correlation residuals (lower triangle)' : 'Normalised residuals (lower triangle)',
      rowHeader: true, head: [''].concat(names),
      rows: names.map((n, i) => [n].concat(names.map((_, j) => j > i ? '' : (j === i && st.resType === 'cor') ? '—' : S.fmt(R[i][j], 2) + (j < i && Math.abs(R[i][j]) > thr ? ' *' : '')))),
      cellStyle: (r, c) => {
        const j = c - 1; if (c === 0 || j > r || (j === r)) return null;
        const v = R[r][j], a = Math.min(Math.abs(v) / (thr * 2), 1) * 0.55;
        if (Math.abs(v) > thr && j < r) flagged.push(`${names[r]} with ${names[j]}`);
        return `background: rgba(var(${v >= 0 ? '--heat-pos' : '--heat-neg'}), ${a.toFixed(2)}); font-weight:${Math.abs(v) > thr ? 700 : 400}`;
      }
    });
    flagged = [...new Set(flagged)];
    document.getElementById('res-note').textContent = `* marks residuals beyond ${st.resType === 'cor' ? '±.10' : '±2.58'}. Shading shows size (blue positive: the model under-predicts the association; orange negative: it over-predicts). ` +
      (flagged.length ? `Flagged: ${flagged.join('; ')}.` : 'No residuals are flagged.');

    // MIs
    const top = mis.filter(m => isFinite(m.mi)).slice(0, 8);
    const tbl = UI.table(document.getElementById('mi'), {
      caption: 'Largest modification indices', rowHeader: true, head: ['Parameter', 'MI (Δχ²)', 'Expected value', 'Action'], leftCols: [3],
      rows: top.map(m => [m.c.label, S.fmt(m.mi, 2), S.fmt(m.epc, 3), UI.button('Free', () => { st.freed.push(m.c.id); st.history.push({ id: m.c.id, mi: m.mi }); render(`Freed ${m.c.label}.`); }, 'secondary')])
    });
    tbl.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-label', `Free ${top[i].c.label}`));
    if (base.df <= 1) document.getElementById('mi').appendChild(h('p', { class: 'small', text: 'Freeing another parameter would leave no degrees of freedom to test fit.' }));

    // Freed list with undo
    const fr = document.getElementById('freed'); fr.innerHTML = '';
    if (st.freed.length) {
      fr.appendChild(h('h3', { text: 'Parameters you have freed' }));
      const ul = h('ul');
      st.freed.forEach(id => ul.appendChild(h('li', null, [cand(id).label + ' ', UI.button('Fix to 0 again', () => { st.freed = st.freed.filter(x => x !== id); st.history = st.history.filter(x => x.id !== id); render(`Fixed ${cand(id).label} to 0 again.`); }, 'secondary')])));
      fr.appendChild(ul);
    } else fr.appendChild(h('p', { class: 'small', text: 'You have not freed any parameters yet.' }));

    // Estimates
    UI.table(document.getElementById('estimates'), { caption: 'Unstandardised estimates', rowHeader: true, head: ['Parameter', 'Estimate'],
      rows: base.list.map((p, k) => [p.label, S.fmt(p.type === 'err' ? Math.exp(base.th[k]) : base.th[k], 3)]) });

    const say = (msg ? msg + ' ' : '') + `χ² ${S.fmt(base.chi, 1)} on ${base.df} df.` + (top[0] ? ` Largest modification index: ${top[0].c.label}, ${S.fmt(top[0].mi, 1)}.` : '');
    UI.announce(say);
  }

  function validate() {
    const box = document.getElementById('validation'); box.innerHTML = '';
    if (!st.freed.length) { box.appendChild(h('p', { text: 'Free at least one parameter first.' })); return; }
    const Sv = sampleS(S.newSeed()), full = fit(Sv, st.freed);
    const rows = st.freed.map(id => {
      const without = fit(Sv, st.freed.filter(x => x !== id));
      const d = Math.max(without.chi - full.chi, 0), p = S.chisqSf(d, 1);
      const cal = st.history.find(x => x.id === id);
      return [cand(id).label, cal ? S.fmt(cal.mi, 2) : '–', S.fmt(full.th[full.list.findIndex(q => q.id === id)], 3), S.fmt(d, 2), S.fmtP(p), p < 0.05 ? UI.badge('Replicates', 'good') : UI.badge('Does not replicate', 'warn')];
    });
    UI.table(box, { caption: 'Freed parameters in a new sample of the same size', rowHeader: true, head: ['Parameter', 'MI when freed', 'Estimate (new sample)', 'Δχ² if removed (new sample)', 'p', 'Verdict'], leftCols: [5], rows });
    const truth = { none: 'The population model had no hidden problems, so every freed parameter was capitalising on chance.', cross: 'The population contained a cross-loading of x4 on F1 (.35).', ecov: 'The population contained an error covariance between e2 and e3 (.20).', both: 'The population contained a cross-loading of x4 on F1 (.35) and an error covariance between e2 and e3 (.20).' }[st.mis];
    box.appendChild(h('p', { text: 'The truth: ' + truth }));
    UI.announceNow('Validation complete. ' + rows.map(r => `${r[0]}: ${r[5].textContent}`).join('. '));
  }

  render();
})();
