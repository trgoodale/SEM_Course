(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'A clean solution', text: 'The starting correlations are r12 = .56, r13 = .48 and r23 = .42.',
    question: 'Are all three error variances positive?', options: ['Yes', 'No'], answer: 0,
    explain: 'The loadings are .80, .70 and .60, so the error variances are .36, .51 and .64. Every item has some variance the factor does not explain, as it should.' },
  { title: 'Weaken the link between items 2 and 3', text: 'Lower r23 to .30, leaving the other two correlations as they are.',
    question: 'Which loading grows?', options: ['Item 1', 'Item 2', 'Item 3'], answer: 0,
    explain: 'λ1² = r12 × r13 / r23. Item 1 is now the only thing linking items 2 and 3, so the factor leans on it: its loading rises to about .95.' },
  { title: 'A Heywood case', text: 'Lower r23 further, to .25.',
    question: 'The error variance of item 1 is now…', options: ['negative', 'zero', 'still positive'], answer: 0,
    explain: 'λ1² = .56 × .48 / .25 = 1.08, so the standardised loading is 1.04 and the error variance is −0.08: an impossible solution. The correlations themselves are perfectly possible; it is the one-factor model that cannot fit them properly.' },
  { title: 'Sampling error alone', text: 'Press "High loadings", set the sample size to 50 and press "Draw 1,000 samples". In this population, every error variance is positive.',
    question: 'Roughly how often does a sample of 50 give a Heywood case?', options: ['Almost never (under 1%)', 'Sometimes (around 5–15%)', 'Most of the time'], answer: 1,
    explain: 'With a true loading near .96, sampling error pushes the estimate above 1 in a noticeable share of small samples. Try N = 200: it becomes rare. A small negative error variance in a small sample may be sampling error rather than a wrong model.' }
  ], { done: 'That is the end of the guided tour. Try making each item in turn the "odd one out", and check the formulas under "Why this happens".' });

  const st = { r12: 0.56, r13: 0.48, r23: 0.42, n: 50, seed: 21 };
  const f2 = v => S.fmtNoZero(v, 2);
  const sl = {};
  const mk = (k, label) => (sl[k] = UI.slider({ label, min: 0.05, max: 0.95, step: 0.01, value: st[k], format: f2, onInput: v => { st[k] = v; render(); } }));
  document.getElementById('controls').append(mk('r12', 'r12: item 1 with item 2').el, mk('r13', 'r13: item 1 with item 3').el, mk('r23', 'r23: item 2 with item 3').el);
  const presets = [['Clean solution', 0.56, 0.48, 0.42], ['Heywood case', 0.56, 0.48, 0.25], ['High loadings', 0.87, 0.82, 0.77]];
  const pbox = document.getElementById('presets');
  for (const [label, a, b, c] of presets) pbox.appendChild(UI.button(label, () => {
    st.r12 = a; st.r13 = b; st.r23 = c; sl.r12.set(a, true); sl.r13.set(b, true); sl.r23.set(c, true); render(); clearSim();
  }, 'secondary'));

  const nS = UI.slider({ label: 'Sample size (N)', min: 30, max: 1000, step: 10, value: st.n, format: v => String(v), onInput: v => { st.n = v; clearSim(); } });
  document.getElementById('sim-controls').append(nS.el);
  const simRes = document.getElementById('sim-result');
  function clearSim() { simRes.innerHTML = ''; }

  // One-factor solution for three standardised items
  function solve(r12, r13, r23) {
    const l2 = [r12 * r13 / r23, r12 * r23 / r13, r13 * r23 / r12];
    return l2.map(v => ({ l: Math.sign(v) * Math.sqrt(Math.abs(v)), l2: v, err: 1 - v }));
  }
  const validR = () => {
    const R = [[1, st.r12, st.r13], [st.r12, 1, st.r23], [st.r13, st.r23, 1]];
    return S.isPositiveDefinite(R) ? R : null;
  };

  function render() {
    const R = validR(), status = document.getElementById('status');
    status.innerHTML = '';
    if (!R) {
      status.appendChild(h('div', { class: 'callout bad', role: 'alert', text: 'These three correlations cannot all occur together (the correlation matrix is not positive definite). Move one of the sliders.' }));
      document.getElementById('table').innerHTML = ''; document.getElementById('diagram').innerHTML = '';
      return;
    }
    const sol = solve(st.r12, st.r13, st.r23);
    const bad = sol.map((s, i) => s.err < 0 ? i : -1).filter(i => i >= 0);
    status.appendChild(bad.length
      ? h('div', { class: 'callout warn' }, [h('p', { html: `<strong>Heywood case.</strong> The error variance of item ${bad.map(i => i + 1).join(' and ')} is negative, so its standardised loading is above 1. The solution is not admissible.` })])
      : h('div', { class: 'callout' }, [h('p', { text: 'All error variances are positive: an admissible solution.' })]));
    UI.table(document.getElementById('table'), {
      caption: 'Standardised one-factor solution', rowHeader: true,
      head: ['Item', 'Loading λ', 'λ² (R² of the item)', 'Error variance (1 − λ²)', 'Status'],
      rows: sol.map((s, i) => [`Item ${i + 1}`, S.fmt(s.l, 2), S.fmt(s.l2, 2), S.fmt(s.err, 2), s.err < 0 ? UI.badge('Negative', 'bad') : UI.badge('OK', 'good')])
    });
    const pos = [[90, 170], [220, 170], [350, 170]];
    document.getElementById('diagram').innerHTML = Diagram.svg({
      id: 'hw', width: 440, height: 300, title: 'One-factor model with three items',
      desc: sol.map((s, i) => `Item ${i + 1}: loading ${S.fmt(s.l, 2)}, error variance ${S.fmt(s.err, 2)}${s.err < 0 ? ' (negative)' : ''}`).join('. ') + '.',
      nodes: [{ id: 'F', label: 'Factor', x: 220, y: 50, shape: 'ellipse', w: 100, h: 46 }]
        .concat(pos.map((p, i) => ({ id: 'x' + i, label: 'Item ' + (i + 1), x: p[0], y: p[1], w: 78, h: 36, emph: sol[i].err < 0 })))
        .concat(pos.map((p, i) => ({ id: 'e' + i, label: 'e' + (i + 1), x: p[0], y: 262, shape: 'circle', r: 18, emph: sol[i].err < 0 }))),
      edges: pos.map((p, i) => ({ from: 'F', to: 'x' + i, label: S.fmt(sol[i].l, 2), emph: sol[i].err < 0, labelAt: 0.45, labelOffset: i === 1 ? 14 : (i === 0 ? -14 : 14) }))
        .concat(pos.map((p, i) => ({ from: 'e' + i, to: 'x' + i }))),
      notes: pos.map((p, i) => ({ x: p[0] + 34, y: 266, text: S.fmt(sol[i].err, 2), anchor: 'start', size: 13 }))
    });
    UI.announce(bad.length ? `Heywood case: error variance of item ${bad.map(i => i + 1).join(' and ')} is negative.` : `Loadings ${sol.map(s => S.fmt(s.l, 2)).join(', ')}. All error variances positive.`);
  }

  function simulate() {
    const R = validR(); if (!R) return;
    const r = S.rng(st.seed++), reps = 1000;
    let count = 0, done = 0;
    for (let k = 0; k < reps; k++) {
      const X = S.mvnSample(st.n, [0, 0, 0], R, r); if (!X) break;
      const cols = [0, 1, 2].map(j => X.map(row => row[j]));
      const c12 = S.cor(cols[0], cols[1]), c13 = S.cor(cols[0], cols[2]), c23 = S.cor(cols[1], cols[2]);
      done++;
      if (c12 <= 0 || c13 <= 0 || c23 <= 0) { count++; continue; }
      if (solve(c12, c13, c23).some(s => s.err < 0)) count++;
    }
    const pop = solve(st.r12, st.r13, st.r23).some(s => s.err < 0);
    simRes.innerHTML = '';
    simRes.appendChild(h('p', { html: `<strong>${(100 * count / done).toFixed(1)}%</strong> of ${done.toLocaleString('en-GB')} samples of N = ${st.n} gave a Heywood case (or a correlation pattern with no admissible solution). ` +
      (pop ? 'In this population the model itself is inadmissible, so most samples will be too.' : 'In this population every error variance is positive, so these are caused by sampling error alone.') }));
  }
  document.getElementById('sim-buttons').append(UI.button('Draw 1,000 samples', simulate));

  document.addEventListener('appresize', render);
  render();
})();
