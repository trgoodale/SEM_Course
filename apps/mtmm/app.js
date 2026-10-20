(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'The validity diagonal', text: 'Look at the bold, shaded cells in the matrix.',
    question: 'Validity values are correlations between…', options: ['the same trait measured by different methods', 'different traits measured by the same method'], answer: 0,
    explain: 'Convergent validity: different ways of measuring the same trait should agree.' },
  { title: 'Strong method effects', text: 'Set the trait loading to .50 and the method loading to .60.',
    question: 'Which Campbell–Fiske criterion fails?', options: ['Criterion 2 only', 'Criterion 3 only', 'Both 2 and 3'], answer: 1,
    explain: 'Different traits measured by the same method now correlate more strongly than the same trait measured by different methods: method variance dominates.' },
  { title: 'What it means', text: 'Think of a study that uses only self-report questionnaires.',
    question: 'What does a failure of criterion 3 suggest?', options: ['Shared method variance inflates correlations', 'The traits are unreliable'], answer: 0,
    explain: 'This is the problem of common method variance (Podsakoff et al., 2003): some of the correlation between two self-reported constructs comes from the shared method.' }
]);

  const st = { lt: 0.7, lm: 0.35, pt: 0.3, pm: 0.2, noise: false, seed: 4 };
  // Settings can be passed in the address, e.g. ?lt=0.5&lm=0.6
  ['lt', 'lm', 'pt', 'pm'].forEach(k => { const v = parseFloat(UI.param(k)); if (isFinite(v)) st[k] = v; });
  const f2 = v => S.fmtNoZero(v, 2);
  const mk = (k, label, min, max, hint) => UI.slider({ label, min, max, step: 0.05, value: st[k], format: f2, hint, onInput: v => { st[k] = v; render(); } });
  document.getElementById('controls').append(
    mk('lt', 'Trait loading', 0.3, 0.9, 'How strongly each measure reflects its trait.').el,
    mk('lm', 'Method loading', 0, 0.7, 'How strongly each measure reflects how it was measured.').el,
    mk('pt', 'Correlation between traits', 0, 0.9).el,
    mk('pm', 'Correlation between methods', 0, 0.8).el,
    UI.checkbox({ label: 'Add sampling error (N = 250)', onChange: v => { st.noise = v; render(); } }).el
  );
  document.getElementById('buttons').append(UI.button('New sample', () => { st.seed = S.newSeed(); render(); }, 'secondary'));

  const M = 3, T = 3, idx = []; for (let m = 0; m < M; m++) for (let t = 0; t < T; t++) idx.push({ m, t, name: `M${m + 1}T${t + 1}` });
  const kind = (a, b) => a === b ? 'rel' : idx[a].t === idx[b].t ? 'val' : idx[a].m === idx[b].m ? 'htmm' : 'hthm';
  const KINDS = {
    rel: { label: 'Reliability (diagonal)', style: 'font-style:italic' },
    val: { label: 'Validity diagonal: same trait, different methods', style: 'font-weight:700; background: rgba(var(--heat-pos), .28)' },
    htmm: { label: 'Heterotrait–monomethod: different traits, same method', style: 'background: rgba(var(--heat-neg), .22)' },
    hthm: { label: 'Heterotrait–heteromethod: different traits and methods', style: '' }
  };

  function matrix() {
    const ok = st.lt * st.lt + st.lm * st.lm <= 0.95;
    const R = idx.map((a, i) => idx.map((b, j) => {
      if (i === j) return 1;
      const tr = a.t === b.t ? 1 : st.pt, me = a.m === b.m ? 1 : st.pm;
      return st.lt * st.lt * tr + st.lm * st.lm * me;
    }));
    const rel = Math.min(0.95, st.lt * st.lt + st.lm * st.lm + 0.08);
    if (!st.noise || !ok) return { R, rel, ok };
    const r = S.rng(st.seed), rows = S.mvnSample(250, new Array(9).fill(0), R, r);
    if (!rows) return { R, rel, ok };
    const cols = []; for (let j = 0; j < 9; j++) cols.push(rows.map(x => x[j]));
    return { R: S.corFromCov(S.covMatrix(cols)), rel, ok };
  }

  function render() {
    const { R, rel, ok } = matrix();
    const key = document.getElementById('key'); key.innerHTML = '';
    if (!ok) { key.appendChild(h('div', { class: 'callout bad', role: 'alert', text: 'Trait loading² + method loading² must not exceed .95. Lower one of them.' })); document.getElementById('matrix').innerHTML = ''; document.getElementById('checks').innerHTML = ''; return; }
    const ul = h('ul', { class: 'legend', style: 'flex-direction:column;gap:0.3rem' });
    for (const k of Object.keys(KINDS)) ul.appendChild(h('li', null, [h('span', { style: `display:inline-block;min-width:3.2rem;padding:0 .3rem;border:1px solid var(--border);text-align:center;${KINDS[k].style}`, text: k === 'rel' ? '(.88)' : '.45' }), h('span', { text: KINDS[k].label })]));
    key.appendChild(ul);
    UI.table(document.getElementById('matrix'), {
      caption: 'Correlations among the nine measures (lower triangle)', rowHeader: true, cornerLabel: 'Measure', head: [''].concat(idx.map(x => x.name)),
      rows: idx.map((a, i) => [a.name].concat(idx.map((b, j) => j > i ? '' : i === j ? `(${S.fmtNoZero(rel, 2)})` : S.fmtNoZero(R[i][j], 2)))),
      cellStyle: (r, c) => c === 0 || c - 1 > r ? null : KINDS[kind(r, c - 1)].style,
      cellLabel: (r, c) => c === 0 || c - 1 > r ? null : `(${KINDS[kind(r, c - 1)].label.split(':')[0].toLowerCase()})`
    });

    // Campbell–Fiske
    const vals = [], c2 = [0, 0], c3 = [0, 0];
    for (let i = 0; i < 9; i++) for (let j = 0; j < i; j++) if (kind(i, j) === 'val') vals.push([i, j, R[i][j]]);
    for (const [i, j, v] of vals) {
      for (let k = 0; k < 9; k++) {
        for (const a of [i, j]) {
          if (k === a) continue;
          const kd = kind(a, k);
          if (kd === 'hthm' && ((a === i && idx[k].m === idx[j].m) || (a === j && idx[k].m === idx[i].m))) { c2[1]++; if (v > R[a][k]) c2[0]++; }
          if (kd === 'htmm') { c3[1]++; if (v > R[a][k]) c3[0]++; }
        }
      }
    }
    const minVal = Math.min(...vals.map(v => v[2]));
    const crit = 1.96 / Math.sqrt(250);
    // pattern: trait-pair correlations within each triangle
    const pairs = [[0, 1], [0, 2], [1, 2]];
    const tri = [];
    for (let m = 0; m < M; m++) tri.push(pairs.map(([a, b]) => R[m * 3 + a][m * 3 + b]));
    const order = v => v.map((x, i) => [x, i]).sort((p, q) => q[0] - p[0]).map(p => p[1]).join('');
    const sameOrder = tri.every(t => order(t) === order(tri[0]));
    const spread = Math.max(...tri[0]) - Math.min(...tri[0]);
    const row = (n, text, ok2) => [n, text, ok2 ? UI.badge('Met', 'good') : UI.badge('Not met', 'bad')];
    UI.table(document.getElementById('checks'), { caption: 'Campbell and Fiske (1959) criteria', rowHeader: true, head: ['Criterion', 'Result', 'Verdict'], leftCols: [1], rows: [
      row('1. Validity values are substantial', `Smallest validity correlation ${S.fmtNoZero(minVal, 2)} (with N = 250, values above ${S.fmtNoZero(crit, 2)} differ from zero).`, minVal > crit),
      row('2. Validity > heterotrait–heteromethod', `${c2[0]} of ${c2[1]} comparisons favour the validity value.`, c2[0] === c2[1]),
      row('3. Validity > heterotrait–monomethod', `${c3[0]} of ${c3[1]} comparisons favour the validity value.`, c3[0] === c3[1]),
      row('4. Same pattern of trait correlations in every triangle', spread < 0.03 ? 'Trait correlations are nearly equal, so the pattern is flat in every triangle.' : sameOrder ? 'The trait pairs are ranked the same way in each monomethod triangle.' : 'The ranking of trait pairs differs between methods.', spread < 0.03 || sameOrder)
    ] });
    UI.announce(`Criterion 2: ${c2[0]} of ${c2[1]}. Criterion 3: ${c3[0]} of ${c3[1]}.`);
  }
  render();
})();
