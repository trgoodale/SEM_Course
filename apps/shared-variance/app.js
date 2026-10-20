(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'Uncorrelated predictors', text: 'Press the "Independent predictors" scenario. Here r(X1, X2) = 0.',
    question: 'What is β for X1 now?', options: ['Its simple correlation with Y (.50)', 'Zero', 'The R² of the model'], answer: 0,
    explain: 'When the predictors do not overlap, controlling for X2 changes nothing, so each β equals the simple correlation with Y and the two parts of R² simply add up.' },
  { title: 'Let the predictors overlap', text: 'Keep r(Y, X1) = .50 and r(Y, X2) = .40, and move r(X1, X2) up to .60.',
    question: 'What happens to β for X1?', options: ['It increases', 'It decreases', 'It stays at .50'], answer: 1,
    explain: 'Part of what X1 shares with Y is also shared with X2. Holding X2 constant removes that shared part, so β for X1 falls (to about .41).' },
  { title: 'Unique and shared variance', text: 'Look at the bar chart as r(X1, X2) rises.',
    question: 'What happens to the variance unique to X1?', options: ['It grows', 'It shrinks', 'It does not change'], answer: 1,
    explain: 'The more the predictors overlap, the more of their explained variance is shared and the less belongs to either alone. This is also why the VIF rises.' },
  { title: 'Extension: suppression', text: 'Press "Suppression". X2 is now completely uncorrelated with Y.',
    question: 'What sign will β for X2 have?', options: ['Zero', 'Negative', 'Positive'], answer: 1,
    explain: 'X2 is related to the part of X1 that does not predict Y. Controlling for X2 removes that irrelevant variance from X1, so X2 gets a negative weight and R² goes up. This is suppression.' }
]);

  const st = { ry1: 0.5, ry2: 0.4, r12: 0.3, last: 'r12' };
  const f2 = v => S.fmt(v, 2);
  const sY1 = UI.slider({ label: 'r(Y, X1)', min: -0.95, max: 0.95, step: 0.05, value: st.ry1, format: f2, onInput: v => { st.ry1 = v; st.last = 'ry1'; render(); } });
  const sY2 = UI.slider({ label: 'r(Y, X2)', min: -0.95, max: 0.95, step: 0.05, value: st.ry2, format: f2, onInput: v => { st.ry2 = v; st.last = 'ry2'; render(); } });
  const s12 = UI.slider({ label: 'r(X1, X2)', min: -0.95, max: 0.95, step: 0.05, value: st.r12, format: f2, hint: 'How much the two predictors overlap.', onInput: v => { st.r12 = v; st.last = 'r12'; render(); } });
  document.getElementById('controls').append(sY1.el, sY2.el, s12.el);
  // A live note under each slider giving the values it can take, given the other two
  const rangeNotes = {};
  [['ry1', sY1], ['ry2', sY2], ['r12', s12]].forEach(([k, sl]) => {
    const n = h('span', { class: 'hint', id: 'range-' + k }); sl.el.appendChild(n); rangeNotes[k] = n;
    sl.input.setAttribute('aria-describedby', ((sl.input.getAttribute('aria-describedby') || '') + ' range-' + k).trim());
  });
  // Allowed range for a correlation c between two variables that correlate a and b with a third
  const range = (a, b) => { const r = Math.sqrt(Math.max((1 - a * a) * (1 - b * b), 0)); return [Math.max(-1, a * b - r), Math.min(1, a * b + r)]; };
  const ranges = () => ({ ry1: range(st.ry2, st.r12), ry2: range(st.ry1, st.r12), r12: range(st.ry1, st.ry2) });
  const fr = v => S.fmtNoZero(v, 2);

  const presets = [
    ['Independent predictors', 0.5, 0.4, 0],
    ['Redundant predictors', 0.6, 0.55, 0.85],
    ['Suppression', 0.5, 0, 0.6],
    ['Opposite signs', 0.4, -0.3, 0.5]
  ];
  const pbox = document.getElementById('presets');
  for (const [label, a, b, c] of presets) pbox.appendChild(UI.button(label, () => {
    st.ry1 = a; st.ry2 = b; st.r12 = c; sY1.set(a, true); sY2.set(b, true); s12.set(c, true); render();
  }, 'secondary'));

  function compute() {
    const { ry1, ry2, r12 } = st;
    const R = [[1, ry1, ry2], [ry1, 1, r12], [ry2, r12, 1]];
    const valid = S.det(R) > 1e-6 && S.isPositiveDefinite(R);
    const d = 1 - r12 * r12;
    const b1 = (ry1 - ry2 * r12) / d, b2 = (ry2 - ry1 * r12) / d;
    const R2 = b1 * ry1 + b2 * ry2;
    const sr1 = (ry1 - ry2 * r12) / Math.sqrt(d), sr2 = (ry2 - ry1 * r12) / Math.sqrt(d);
    const pr1 = sr1 / Math.sqrt(1 - ry2 * ry2), pr2 = sr2 / Math.sqrt(1 - ry1 * ry1);
    const u1 = sr1 * sr1, u2 = sr2 * sr2, shared = R2 - u1 - u2;
    return { valid, b1, b2, R2, sr1, sr2, pr1, pr2, u1, u2, shared, vif: 1 / d, d };
  }

  function drawDiagram(c) {
    const box = document.getElementById('diagram');
    const ok = c.valid, v = x => ok ? S.fmt(x, 2) : '?';
    box.innerHTML = Diagram.svg({
      id: 'sv', width: 440, height: 230, title: 'Path diagram of the regression of Y on X1 and X2',
      desc: ok ? `Standardised path from X1 to Y ${v(c.b1)}, from X2 to Y ${v(c.b2)}; X1 and X2 correlate ${S.fmt(st.r12, 2)}; the error term carries ${S.fmtNoZero(1 - c.R2, 2)} of the variance of Y.` : 'The current correlations are impossible, so no paths can be estimated.',
      nodes: [{ id: 'x1', label: 'X1', x: 90, y: 60 }, { id: 'x2', label: 'X2', x: 90, y: 170 }, { id: 'y', label: 'Y', x: 300, y: 115 }, { id: 'e', label: 'e', x: 400, y: 115, shape: 'circle' }],
      edges: [
        { from: 'x1', to: 'y', label: 'β = ' + v(c.b1) }, { from: 'x2', to: 'y', label: 'β = ' + v(c.b2), labelOffset: -14 },
        { from: 'x1', to: 'x2', kind: 'cov', label: 'r = ' + S.fmt(st.r12, 2), bend: 26, labelOffset: 34 },
        { from: 'e', to: 'y' }
      ],
      notes: ok ? [{ x: 400, y: 155, text: `${Math.round(100 * (1 - c.R2))}% of Y`, size: 12 }, { x: 400, y: 170, text: 'unexplained', size: 12 }] : []
    });
  }

  function render() {
    const c = compute(), inv = document.getElementById('invalid'), rg = ranges();
    for (const k of Object.keys(rg)) rangeNotes[k].textContent = `Possible values, given the other two: ${fr(rg[k][0])} to ${fr(rg[k][1])}.`;
    drawDiagram(c);
    if (!c.valid) {
      inv.hidden = false;
      const name = { ry1: 'r(Y, X1)', ry2: 'r(Y, X2)', r12: 'r(X1, X2)' }[st.last], r = rg[st.last];
      let why = 'Correlations have to be consistent with each other: if X1 and X2 both correlate strongly with Y, they must also correlate with each other.';
      if (Math.abs(st.r12) < 0.025) why = `If X1 and X2 were uncorrelated, together they would explain ${fr(st.ry1 * st.ry1)} + ${fr(st.ry2 * st.ry2)} = ${Math.round(100 * (st.ry1 * st.ry1 + st.ry2 * st.ry2))}% of the variance of Y, which is impossible.`;
      inv.textContent = `This combination cannot occur. ${why} With the other two sliders where they are, ${name} must be between ${fr(r[0])} and ${fr(r[1])}.`;
      UI.announce(inv.textContent);
      document.getElementById('stats').innerHTML = ''; document.getElementById('coef-table').innerHTML = '';
      document.getElementById('chart').innerHTML = ''; document.getElementById('note').textContent = '';
      return;
    }
    inv.hidden = true;
    UI.stats(document.getElementById('stats'), [
      { k: 'R²', v: S.fmtNoZero(c.R2, 3) },
      { k: 'β for X1', v: S.fmt(c.b1, 3) },
      { k: 'β for X2', v: S.fmt(c.b2, 3) },
      { k: 'VIF (each predictor)', v: S.fmt(c.vif, 2) }
    ]);
    UI.table(document.getElementById('coef-table'), {
      caption: 'Each predictor\'s contribution', rowHeader: true,
      head: ['Predictor', 'Simple r with Y', 'Variance explained alone (r²)', 'Standardised β', 'Semipartial r', 'Unique variance (sr²)', 'Partial r'],
      rows: [
        ['X1', S.fmt(st.ry1, 2), S.fmtNoZero(st.ry1 * st.ry1, 3), S.fmt(c.b1, 3), S.fmt(c.sr1, 3), S.fmtNoZero(c.u1, 3), S.fmt(c.pr1, 3)],
        ['X2', S.fmt(st.ry2, 2), S.fmtNoZero(st.ry2 * st.ry2, 3), S.fmt(c.b2, 3), S.fmt(c.sr2, 3), S.fmtNoZero(c.u2, 3), S.fmt(c.pr2, 3)]
      ]
    });
    let note;
    if (Math.abs(st.r12) < 0.025) note = 'The predictors are uncorrelated, so each β equals its simple correlation and nothing is shared.';
    else if (c.shared < -0.005) note = `Suppression: the unique parts add up to more than R², so the "shared" part is negative (${S.fmt(c.shared, 3)}). Controlling for one predictor removes irrelevant variance from the other.`;
    else if (c.vif > 2.5) note = `The predictors overlap a lot (VIF = ${S.fmt(c.vif, 2)}). Much of what they explain is shared, so each has little unique variance and its β is estimated less precisely.`;
    else note = `The predictors overlap, so ${S.fmtNoZero(Math.max(c.shared, 0), 3)} of the explained variance cannot be credited to either one alone.`;
    if (Math.sign(c.b1) !== Math.sign(st.ry1) && Math.abs(st.ry1) > 0.02) note += ' Note that β for X1 has the opposite sign to its simple correlation.';
    if (Math.sign(c.b2) !== Math.sign(st.ry2) && Math.abs(st.ry2) > 0.02) note += ' Note that β for X2 has the opposite sign to its simple correlation.';
    document.getElementById('note').textContent = note;

    const bars = [['X1 only', c.u1, 'var(--s1)'], ['X2 only', c.u2, 'var(--s2)'], ['Shared', c.shared, 'var(--s4)'], ['Total R²', c.R2, 'var(--s3)']];
    const lo = Math.min(0, ...bars.map(b => b[1])) - 0.02, hi = Math.max(0.1, ...bars.map(b => b[1])) * 1.12;
    const ch = Chart.create(document.getElementById('chart'), {
      width: 640, height: 340, x: [-0.5, 3.5], y: [lo, hi], yLabel: 'Proportion of variance in Y',
      xTickValues: [0, 1, 2, 3], xTickFormat: v => bars[v] ? bars[v][0] : '', grid: true, margin: { l: 64 },
      title: 'Decomposition of R²',
      desc: bars.map(b => `${b[0]}: ${S.fmt(b[1], 3)}`).join('; ') + '.'
    });
    bars.forEach((b, i) => {
      ch.rect(i - 0.32, 0, i + 0.32, b[1], { color: b[2], opacity: 0.85 });
      ch.text(i, b[1], S.fmt(b[1], 3), { anchor: 'middle', dy: b[1] >= 0 ? -6 : 16, size: 13, weight: 600 });
    });
    ch.hline(0, { color: 'var(--text)', width: 1.5 });

    const fm = document.getElementById('formulas'); fm.innerHTML = '';
    fm.append(h('p', { class: 'formula', text:
      `β1 = (r(Y,X1) − r(Y,X2)·r(X1,X2)) / (1 − r(X1,X2)²) = ${S.fmt(c.b1, 3)}\n` +
      `β2 = (r(Y,X2) − r(Y,X1)·r(X1,X2)) / (1 − r(X1,X2)²) = ${S.fmt(c.b2, 3)}\n` +
      `R² = β1·r(Y,X1) + β2·r(Y,X2) = ${S.fmt(c.R2, 3)}\n` +
      `VIF = 1 / (1 − r(X1,X2)²) = ${S.fmt(c.vif, 2)}` }),
      h('p', { text: 'You do not need to compute these; SPSS reports β, the part (semipartial) and partial correlations, and the VIF when you ask for them.' }));
    UI.announce(`R squared ${S.fmt(c.R2, 3)}. Beta for X1 ${S.fmt(c.b1, 2)}, beta for X2 ${S.fmt(c.b2, 2)}. ${note}`);
  }
  document.addEventListener('appresize', render);
  render();
  // A link such as ?scenario=suppression opens the app on that scenario
  const want = (UI.param('scenario') || '').toLowerCase();
  const preset = presets.find(p => p[0].toLowerCase().replace(/\s+/g, '-') === want);
  if (preset) { const [, a, b, c] = preset; st.ry1 = a; st.ry2 = b; st.r12 = c; sY1.set(a, true); sY2.set(b, true); s12.set(c, true); render(); }
})();
