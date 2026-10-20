(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'The starting scenario', text: 'Item 3 has a higher intercept in Group B; everything else is equal. Look at the ladder.',
    question: 'Which level of invariance fails?', options: ['Metric (loadings)', 'Scalar (intercepts)'], answer: 1,
    explain: 'The loadings are equal, so metric invariance holds. One intercept differs, so full scalar invariance fails; with three invariant items, partial scalar invariance is possible.' },
  { title: 'Consequences for mean comparisons', text: 'Look at "Comparing the groups\' scale scores".',
    question: 'By how much does the observed total overstate Group B?', options: ['About 0.40 scale points', 'Not at all', 'About 0.87 scale points'], answer: 0,
    explain: 'Item 3 adds 0.40 points to Group B\'s total for reasons unrelated to the construct. The latent difference alone would produce 0.87.' },
  { title: 'Full invariance', text: 'Choose the scenario "Full invariance".',
    question: 'Now the observed difference…', options: ['matches what the latent mean difference produces', 'is still biased'], answer: 0,
    explain: 'With equal loadings and intercepts, every item reflects the construct in the same way in both groups, so observed totals can be compared fairly.' },
  { title: 'A trap', text: 'Choose "All intercepts higher in Group B, no latent difference".',
    question: 'Without equality constraints on the intercepts, could you tell this apart from a real latent mean difference?', options: ['Yes', 'No'], answer: 1,
    explain: 'If every intercept shifts by the same amount, the data look exactly like a latent mean difference. Latent means are only identified relative to invariant intercepts, which is why scalar invariance is tested first.' }
]);

  const LA = [0.8, 0.7, 0.75, 0.65], TA = [3.0, 3.2, 2.8, 3.1];
  const st = { lb: LA.slice(), tb: TA.slice(), kappa: 0.3 };
  const SCEN = {
    full: { label: 'Full invariance', apply: () => {} },
    oneInt: { label: 'Item 3 intercept higher in Group B', apply: () => { st.tb[2] += 0.4; } },
    oneLoad: { label: 'Item 2 loading lower in Group B', apply: () => { st.lb[1] = 0.4; } },
    allInt: { label: 'All intercepts higher in Group B, no latent difference', apply: () => { st.tb = st.tb.map(t => t + 0.3); st.kappa = 0; } },
    mixed: { label: 'Item 1 loading and item 4 intercept differ', apply: () => { st.lb[0] = 1.0; st.tb[3] -= 0.35; } }
  };
  const sliders = [];
  const scen = UI.select({ label: 'Start from a scenario', value: 'oneInt', options: Object.keys(SCEN).map(k => ({ value: k, label: SCEN[k].label })), onChange: v => applyScenario(v) });
  document.getElementById('scenario').appendChild(scen.el);
  const kS = UI.slider({ label: 'Latent mean of Group B (A = 0)', min: -1, max: 1, step: 0.05, value: st.kappa, format: v => S.fmt(v, 2), onInput: v => { st.kappa = v; render(); } });
  document.getElementById('kappa').appendChild(kS.el);
  const itemsBox = document.getElementById('items');
  for (let i = 0; i < 4; i++) {
    const fs = h('details', { class: 'more-settings item-box' }, [h('summary', { text: `Item ${i + 1} in Group B (Group A: loading ${S.fmt(LA[i], 2)}, intercept ${S.fmt(TA[i], 2)})` })]);
    const l = UI.slider({ label: 'Loading in Group B', min: 0.2, max: 1.2, step: 0.05, value: st.lb[i], format: v => S.fmt(v, 2), onInput: v => { st.lb[i] = v; render(); } });
    const t = UI.slider({ label: 'Intercept in Group B', min: 2, max: 4, step: 0.05, value: st.tb[i], format: v => S.fmt(v, 2), onInput: v => { st.tb[i] = v; render(); } });
    sliders.push([l, t]); fs.append(l.el, t.el); itemsBox.appendChild(fs);
  }
  function applyScenario(k) {
    st.lb = LA.slice(); st.tb = TA.slice(); st.kappa = 0.3;
    SCEN[k].apply();
    sliders.forEach(([l, t], i) => { l.set(+st.lb[i].toFixed(2), true); t.set(+st.tb[i].toFixed(2), true); });
    // open only the items that differ in this scenario
    itemsBox.querySelectorAll('details.item-box').forEach((d, i) => { d.open = Math.abs(st.lb[i] - LA[i]) > 0.001 || Math.abs(st.tb[i] - TA[i]) > 0.001; });
    kS.set(st.kappa, true);
    render();
  }

  const eq = (a, b) => Math.abs(a - b) < 0.026;
  function render() {
    const loadDiff = [0, 1, 2, 3].filter(i => !eq(LA[i], st.lb[i]));
    const intDiff = [0, 1, 2, 3].filter(i => !eq(TA[i], st.tb[i]));
    const names = ix => ix.map(i => `item ${i + 1}`).join(', ');
    const level = (ok, partialOk, diffs) => ok ? UI.badge('Holds', 'good') : partialOk ? UI.badge('Partial only', 'warn') : UI.badge('Does not hold', 'bad');
    const metricOk = !loadDiff.length, metricPartial = 4 - loadDiff.length >= 2;
    const scalarDiff = [...new Set(loadDiff.concat(intDiff))];
    const scalarOk = metricOk && !intDiff.length, scalarPartial = 4 - scalarDiff.length >= 2;
    UI.table(document.getElementById('ladder'), {
      caption: 'Measurement invariance, step by step', rowHeader: true, head: ['Level', 'Constraint added', 'Status', 'What it allows / what to do'], leftCols: [1, 3],
      rows: [
        ['Configural', 'Same pattern of loadings in both groups', UI.badge('Holds', 'good'), 'The same construct structure applies in both groups.'],
        ['Metric (weak)', 'Loadings equal across groups', level(metricOk, metricPartial), metricOk ? 'Compare correlations, variances and structural paths.' : metricPartial ? `Free the loadings of ${names(loadDiff)} for partial metric invariance.` : 'Too few invariant items for a meaningful comparison.'],
        ['Scalar (strong)', 'Intercepts also equal', level(scalarOk, scalarPartial && metricPartial), scalarOk ? 'Compare latent means.' : scalarPartial ? `Free the parameters of ${names(scalarDiff)} for partial scalar invariance, then compare latent means.` : 'Too few invariant items to compare means.']
      ]
    });
    const sumA = TA.reduce((a, b) => a + b, 0), sumB = st.tb.reduce((a, b) => a + b, 0) + st.kappa * st.lb.reduce((a, b) => a + b, 0);
    const obs = sumB - sumA, due = st.kappa * LA.reduce((a, b) => a + b, 0), bias = obs - due;
    UI.table(document.getElementById('means'), { caption: 'Expected scale totals (sum of the four items)', rowHeader: true, head: ['Quantity', 'Value'], rows: [
      ['Group A mean total', S.fmt(sumA, 2)], ['Group B mean total', S.fmt(sumB, 2)], ['Observed difference (B − A)', S.fmt(obs, 2)],
      ['Difference the latent mean alone would produce', S.fmt(due, 2)], ['Bias from non-invariant items', S.fmt(bias, 2)]] });
    document.getElementById('mean-text').textContent = Math.abs(bias) < 0.03
      ? 'The observed difference reflects the latent difference: comparing scale scores is fair here.'
      : `Comparing observed scale totals would ${bias > 0 ? 'overstate' : 'understate'} Group B's standing by ${S.fmt(Math.abs(bias), 2)} scale points, because some items work differently in the two groups.`;

    const box = document.getElementById('plots'); box.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const fig = h('figure', { class: 'chart' }); const div = h('div'); fig.appendChild(div);
      fig.appendChild(h('figcaption', { text: `Item ${i + 1}${loadDiff.includes(i) ? ': loading differs' : ''}${intDiff.includes(i) ? (loadDiff.includes(i) ? ' and' : ':') + ' intercept differs' : ''}${!loadDiff.includes(i) && !intDiff.includes(i) ? ': invariant' : ''}` }));
      box.appendChild(fig);
      const ch = Chart.create(div, { width: 300, height: 220, fixed: false, x: [-2.5, 2.5], y: [0.5, 5.5], xLabel: 'Latent factor', yLabel: 'Expected score', margin: { l: 48, b: 46 },
        title: `Item ${i + 1} response lines`, desc: `Group A: intercept ${S.fmt(TA[i], 2)}, loading ${S.fmt(LA[i], 2)}. Group B: intercept ${S.fmt(st.tb[i], 2)}, loading ${S.fmt(st.lb[i], 2)}.` });
      ch.line([[-2.5, TA[i] - 2.5 * LA[i]], [2.5, TA[i] + 2.5 * LA[i]]], { color: 'var(--s1)', width: 3 });
      ch.line([[-2.5, st.tb[i] - 2.5 * st.lb[i]], [2.5, st.tb[i] + 2.5 * st.lb[i]]], { color: 'var(--s2)', width: 3, dash: '7 5' });
    }
    Chart.legend(document.getElementById('plots-legend'), [{ label: 'Group A', color: 'var(--s1)' }, { label: 'Group B', color: 'var(--s2)', dash: '7 5' }]);
    UI.announce(`Metric invariance ${metricOk ? 'holds' : 'does not hold'}; scalar invariance ${scalarOk ? 'holds' : 'does not hold'}. ${document.getElementById('mean-text').textContent}`);
  }
  document.addEventListener('appresize', render);
  const wanted = UI.param('scenario');
  applyScenario(wanted && SCEN[wanted] ? wanted : 'oneInt');
  if (wanted && SCEN[wanted]) scen.input.value = wanted;
})();
