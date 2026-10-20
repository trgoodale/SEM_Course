(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'Everyone changes at the same rate', text: 'Set the slope SD to 0.',
    question: 'The implied variances across waves are…', options: ['constant', 'increasing'], answer: 0,
    explain: 'With no individual differences in change, people keep their distance from each other, so the variance stays at the intercept variance plus the residual variance.' },
  { title: 'People change at different rates', text: 'Set the slope SD to 0.30. Open "More settings" and set the intercept–slope correlation to 0.',
    question: 'Now the variances across waves…', options: ['increase', 'stay constant'], answer: 0,
    explain: 'Trajectories fan out: variance at wave t is ψI + t²ψS + 2tψIS + θ, which grows with t when ψIS is zero.' },
  { title: 'Where time is zero', text: 'Change "Where is time 0?" to "Last wave".',
    question: 'The intercept mean now describes…', options: ['the average level at the last wave', 'the average level at the first wave'], answer: 0,
    explain: 'The intercept is the expected score where the time code is 0. Moving time 0 changes what the intercept means, not the model\'s fit.' },
  { title: 'The intercept–slope covariance', text: 'Set the correlation back to −0.20 in "More settings" and compare the covariance under first-wave and last-wave coding.',
    question: 'Under last-wave coding the covariance is…', options: ['more positive', 'unchanged'], answer: 0,
    explain: 'Recentring at time c changes the covariance to ψIS + c × ψS. It is a property of where you put time 0, not just of the people.' }
]);

  const st = { waves: 4, mi: 5, ms: 0.5, si: 1, ss: 0.3, ris: -0.2, se: 0.5, centre: 'first', free3: false, l3: 2, seed: 8 };
  const f2 = v => S.fmt(v, 2);
  const mk = (k, label, min, max, step, hint) => UI.slider({ label, min, max, step, value: st[k], format: f2, hint, onInput: v => { st[k] = v; render(); } });
  const free = UI.slider({ label: 'Wave 3 loading', min: 0, max: 5, step: 0.1, value: st.l3, format: v => S.fmt(v, 1), hint: 'With a linear model this is fixed at 2.', onInput: v => { st.l3 = v; render(); } });
  free.input.disabled = true;
  const moreBox = UI.more('More settings');
  moreBox.body.append(
    UI.slider({ label: 'Number of waves', min: 3, max: 6, step: 1, value: st.waves, format: v => String(v), onInput: v => { st.waves = v; render(); } }).el,
    mk('mi', 'Intercept mean (level at wave 1)', 0, 10, 0.1).el,
    mk('si', 'Intercept SD (individual differences in level)', 0, 2, 0.05).el,
    mk('ris', 'Intercept–slope correlation', -0.9, 0.9, 0.05).el,
    mk('se', 'Residual SD at each wave', 0.1, 1.5, 0.05).el,
    UI.checkbox({ label: 'Free the wave 3 loading (non-linear change)', onChange: v => { st.free3 = v; free.input.disabled = !v; render(); } }).el,
    free.el
  );
  document.getElementById('controls').append(
    mk('ms', 'Slope mean (change per wave)', -1, 1.5, 0.05).el,
    mk('ss', 'Slope SD (individual differences in change)', 0, 0.8, 0.02).el
  );
  document.getElementById('coding').append(
    UI.select({ label: 'Where is time 0?', value: st.centre, options: [{ value: 'first', label: 'First wave (0, 1, 2, …)' }, { value: 'middle', label: 'Middle of the study' }, { value: 'last', label: 'Last wave (…, −2, −1, 0)' }], onChange: v => { st.centre = v; render(); } }).el
  );
  document.getElementById('coding').parentNode.after(moreBox.el);
  document.getElementById('buttons').append(UI.button('New people', () => { st.seed = S.newSeed(); render(); }, 'secondary'));

  function render() {
    const W = st.waves;
    const base = []; for (let t = 0; t < W; t++) base.push(t === 2 && st.free3 ? st.l3 : t);
    const c = st.centre === 'first' ? 0 : st.centre === 'last' ? base[W - 1] : (base[0] + base[W - 1]) / 2;
    const codes = base.map(b => b - c);
    // parameters in the base (first-wave) coding
    const psiI = st.si * st.si, psiS = st.ss * st.ss, psiIS = st.ris * st.si * st.ss;
    // re-expressed for the chosen origin (intercept = level at time code 0)
    const muI = st.mi + c * st.ms, pI = psiI + 2 * c * psiIS + c * c * psiS, pIS = psiIS + c * psiS;
    const means = base.map(b => st.mi + b * st.ms);
    const vars = base.map(b => psiI + b * b * psiS + 2 * b * psiIS + st.se * st.se);

    // simulate 30 people
    const r = S.rng(st.seed), L = S.cholesky([[psiI + 1e-9, psiIS], [psiIS, psiS + 1e-9]]);
    const people = [];
    for (let p = 0; p < 30; p++) {
      const z1 = r.normal(), z2 = r.normal();
      const I = st.mi + (L ? L[0][0] * z1 : 0), Sl = st.ms + (L ? L[1][0] * z1 + L[1][1] * z2 : 0);
      people.push(base.map((b, t) => [t + 1, I + b * Sl + st.se * r.normal()]));
    }
    const allY = people.flat().map(p => p[1]).concat(means);
    const ch = Chart.create(document.getElementById('chart'), { width: 600, height: 340, x: [0.8, W + 0.2], y: Chart.extent(allY, 0.05), xTickValues: base.map((_, t) => t + 1), xTickFormat: v => `Wave ${v}`, xLabel: 'Wave', yLabel: 'Score',
      title: 'Individual and mean trajectories', desc: `Mean trajectory: ${means.map((m, t) => `wave ${t + 1}: ${S.fmt(m, 2)}`).join(', ')}. Thirty simulated individuals vary around it.` });
    people.forEach(p => ch.line(p, { color: 'var(--muted)', width: 1, opacity: 0.45 }));
    ch.line(means.map((m, t) => [t + 1, m]), { color: 'var(--s2)', width: 4 });
    ch.points(means.map((m, t) => [t + 1, m]), { color: 'var(--s2)', r: 5 });
    Chart.legend(document.getElementById('legend'), [{ label: 'Individuals', color: 'var(--muted)' }, { label: 'Implied mean', color: 'var(--s2)' }]);

    const box = document.getElementById('table'); box.innerHTML = '';
    const t1 = h('div'), t2 = h('div'); box.append(t1, t2);
    UI.table(t1, { caption: 'By wave', rowHeader: true, head: ['Wave', 'Time code (slope loading)', 'Implied mean', 'Implied variance'],
      rows: base.map((b, t) => [`Wave ${t + 1}`, S.fmt(codes[t], 2), S.fmt(means[t], 2), S.fmt(vars[t], 2)]) });
    UI.table(t2, { caption: 'Growth-factor parameters under this time coding', rowHeader: true, head: ['Parameter', 'Value'], rows: [
      ['Intercept mean', S.fmt(muI, 2)], ['Intercept variance', S.fmt(pI, 3)], ['Slope mean', S.fmt(st.ms, 2)], ['Slope variance', S.fmt(psiS, 3)],
      ['Intercept–slope covariance', S.fmt(pIS, 3)], ['Intercept–slope correlation', pI > 0 && psiS > 0 ? S.fmt(pIS / Math.sqrt(pI * psiS), 2) : '–']] });
    const where = st.centre === 'first' ? 'wave 1' : st.centre === 'last' ? `wave ${W}` : 'the middle of the study';
    document.getElementById('note').textContent = `The intercept is the expected score where the time code is 0, here ${where}. Changing where time 0 falls changes the intercept's mean and variance and its covariance with the slope, but not the fit or the trajectories.` +
      (st.free3 ? ` With the wave 3 loading freed at ${S.fmt(st.l3, 1)}, the slope factor no longer means "change per wave"; it is change scaled by the chosen time codes.` : '');
    UI.announce(`Implied means ${means.map(m => S.fmt(m, 1)).join(', ')}. Intercept–slope covariance under this coding ${S.fmt(pIS, 3)}.`);
  }
  document.addEventListener('appresize', render);
  render();
})();
