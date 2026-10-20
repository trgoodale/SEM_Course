(function () {
  'use strict';
  const { h } = UI, S = Stats;
  UI.initApp();
  UI.guide(document.getElementById('guide'), [
  { title: 'Average variance extracted', text: 'Imagine a factor with three items, each with a standardised loading of .70.',
    question: 'What is its AVE?', options: ['.70', '.49', '.84'], answer: 1,
    explain: 'AVE is the mean of the squared loadings: .70² = .49. Even loadings of .70 fall just short of the usual .50 benchmark.' },
  { title: 'Reliability without high AVE', text: 'Composite reliability adds up the loadings, so it grows with the number of items.',
    question: 'When can a factor have CR above .70 but AVE below .50?', options: ['When it has many items with moderate loadings', 'When its loadings are all very high'], answer: 0,
    explain: 'Many moderately loading items add up to a reliable total, even though each item shares less than half its variance with the factor.' },
  { title: 'Discriminant validity', text: 'Press "Load an example" and look at the HTMT table.',
    question: 'An HTMT ratio of .92 between two factors suggests…', options: ['the two factors may not be distinct', 'both factors are highly reliable'], answer: 0,
    explain: 'HTMT compares correlations between items of different factors with correlations within each factor. A ratio near 1 means items correlate almost as strongly across factors as within them.' }
]);

  const EX = { load: 'Anxiety: .78 .82 .71 .69\nAvoidance: .74 .66 .80\nWellbeing: .58 .62 .55 .70', phi: [[0.62], [-0.41, -0.35]] };
  const ta = document.getElementById('loadings'), itemsTa = document.getElementById('items');
  const phiBox = document.getElementById('phi');
  let factors = [], phi = [];

  function parseLoadings() {
    const err = document.getElementById('loadings-err'); err.textContent = ''; ta.setAttribute('aria-invalid', 'false');
    const lines = ta.value.split('\n').map(l => l.trim()).filter(Boolean);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      let name = `F${i + 1}`, rest = lines[i];
      const c = rest.indexOf(':'); if (c >= 0) { name = rest.slice(0, c).trim() || name; rest = rest.slice(c + 1); }
      const nums = rest.split(/[\s,;]+/).filter(Boolean).map(Number);
      if (nums.some(v => !isFinite(v))) { err.textContent = `Line ${i + 1}: every value after the colon must be a number.`; ta.setAttribute('aria-invalid', 'true'); return null; }
      if (nums.some(v => Math.abs(v) > 1)) { err.textContent = `Line ${i + 1}: standardised loadings should be between −1 and 1.`; ta.setAttribute('aria-invalid', 'true'); return null; }
      if (nums.length < 2) { err.textContent = `Line ${i + 1}: each factor needs at least two loadings.`; ta.setAttribute('aria-invalid', 'true'); return null; }
      out.push({ name, l: nums });
    }
    return out;
  }

  function buildPhi(prev) {
    phiBox.innerHTML = '';
    const k = factors.length; phi = [];
    if (k < 2) { phiBox.appendChild(h('p', { class: 'small', text: 'Add at least two factors to enter correlations.' })); return; }
    for (let i = 1; i < k; i++) {
      phi.push([]);
      for (let j = 0; j < i; j++) {
        const val = prev && prev[i - 1] && prev[i - 1][j] !== undefined ? prev[i - 1][j] : 0.3;
        phi[i - 1].push(val);
        const n = UI.number({ label: `${factors[i].name} with ${factors[j].name}`, min: -1, max: 1, step: 0.01, value: val, onInput: v => { phi[i - 1][j] = v; compute(); } });
        phiBox.appendChild(n.el);
      }
    }
  }
  const r = (i, j) => i === j ? 1 : i > j ? phi[i - 1][j] : phi[j - 1][i];

  function parseItems(p) {
    const err = document.getElementById('items-err'); err.textContent = ''; itemsTa.setAttribute('aria-invalid', 'false');
    const txt = itemsTa.value.trim(); if (!txt) return null;
    const rows = txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split(/[\s,;]+/).filter(Boolean).map(Number));
    const fail = m => { err.textContent = m; itemsTa.setAttribute('aria-invalid', 'true'); return undefined; };
    if (rows.length !== p) return fail(`Expected ${p} rows (one per item), found ${rows.length}.`);
    const R = S.zeros(p, p);
    for (let i = 0; i < p; i++) {
      if (rows[i].some(v => !isFinite(v))) return fail(`Row ${i + 1} contains something that is not a number.`);
      if (rows[i].length < i + 1) return fail(`Row ${i + 1} should have at least ${i + 1} values.`);
      for (let j = 0; j <= i; j++) { R[i][j] = R[j][i] = rows[i][j]; }
    }
    return R;
  }

  function compute() {
    const parsed = parseLoadings();
    const results = document.getElementById('results');
    if (!parsed || !parsed.length) { ['rel', 'fl', 'htmt', 'working'].forEach(id => { document.getElementById(id).innerHTML = ''; }); return; }
    if (parsed.length !== factors.length || parsed.some((f, i) => f.name !== factors[i].name)) { const prev = phi; factors = parsed; buildPhi(prev); }
    factors = parsed;
    const k = factors.length;
    const stats = factors.map(f => {
      const sl = f.l.reduce((a, b) => a + b, 0), sl2 = f.l.reduce((a, b) => a + b * b, 0), err = f.l.reduce((a, b) => a + (1 - b * b), 0);
      const cr = sl * sl / (sl * sl + err), ave = sl2 / f.l.length;
      return { cr, ave, sl, sl2, err };
    });
    stats.forEach((s, i) => { s.msv = k > 1 ? Math.max(...factors.map((_, j) => j === i ? 0 : r(i, j) * r(i, j))) : NaN; });
    UI.table(document.getElementById('rel'), {
      caption: 'Per factor', rowHeader: true, head: ['Factor', 'Items', 'CR (≥ .70)', 'AVE (≥ .50)', 'MSV (< AVE)', 'Verdict'], leftCols: [5],
      rows: factors.map((f, i) => {
        const s = stats[i], probs = [];
        if (s.cr < 0.7) probs.push('low CR'); if (s.ave < 0.5) probs.push('AVE below .50'); if (k > 1 && s.msv >= s.ave) probs.push('MSV ≥ AVE');
        return [f.name, String(f.l.length), S.fmtNoZero(s.cr, 3), S.fmtNoZero(s.ave, 3), k > 1 ? S.fmtNoZero(s.msv, 3) : '–', probs.length ? UI.badge(probs.join('; '), 'warn') : UI.badge('Meets all', 'good')];
      })
    });
    // Fornell–Larcker
    const flBox = document.getElementById('fl');
    if (k < 2) flBox.innerHTML = '<p class="small">Needs two or more factors.</p>';
    else {
      const fails = [];
      UI.table(flBox, {
        caption: 'Fornell–Larcker matrix', rowHeader: true, head: [''].concat(factors.map(f => f.name)), cornerLabel: 'Factor',
        rows: factors.map((f, i) => [f.name].concat(factors.map((_, j) => {
          if (j > i) return '';
          if (j === i) return S.fmtNoZero(Math.sqrt(stats[i].ave), 3);
          const bad = Math.abs(r(i, j)) >= Math.min(Math.sqrt(stats[i].ave), Math.sqrt(stats[j].ave));
          if (bad) fails.push(`${factors[i].name} and ${factors[j].name}`);
          return S.fmtNoZero(r(i, j), 2) + (bad ? ' ✗' : '');
        }))),
        cellStyle: (rr, c) => c - 1 === rr ? 'font-weight:700; background: var(--surface-2)' : null,
        cellLabel: (rr, c) => c === 0 ? null : (c - 1 === rr ? '(square root of AVE)' : null)
      });
      flBox.appendChild(h('p', { text: fails.length ? `✗ marks correlations at least as large as a √AVE: discriminant validity is questionable for ${fails.join('; ')}.` : 'Every √AVE exceeds the factor\'s correlations with the others: the criterion is met.' }));
    }
    // HTMT
    const hBox = document.getElementById('htmt'); hBox.innerHTML = '';
    const p = factors.reduce((a, f) => a + f.l.length, 0);
    const R = parseItems(p);
    if (k < 2) hBox.appendChild(h('p', { class: 'small', text: 'Needs two or more factors.' }));
    else if (R === null) hBox.appendChild(h('p', { class: 'small', text: 'Paste the item correlation matrix to compute HTMT. In SPSS: Analyze > Correlate > Bivariate on the items. Or use "Load an example".' }));
    else if (R) {
      const idx = []; let c = 0; factors.forEach(f => { idx.push(f.l.map(() => c++)); });
      const mono = idx.map(ix => { let s = 0, n = 0; for (let a = 0; a < ix.length; a++) for (let b = a + 1; b < ix.length; b++) { s += R[ix[a]][ix[b]]; n++; } return s / n; });
      const ht = (i, j) => { let s = 0, n = 0; for (const a of idx[i]) for (const b of idx[j]) { s += R[a][b]; n++; } return Math.abs(s / n) / Math.sqrt(mono[i] * mono[j]); };
      const fails = [];
      UI.table(hBox, { caption: 'HTMT ratios (below .85 is strict; below .90 is lenient)', rowHeader: true, head: [''].concat(factors.map(f => f.name)), cornerLabel: 'Factor',
        rows: factors.map((f, i) => [f.name].concat(factors.map((_, j) => { if (j >= i) return ''; const v = ht(i, j); if (v >= 0.85) fails.push(`${factors[i].name}–${factors[j].name} (${S.fmtNoZero(v, 2)})`); return S.fmtNoZero(v, 3) + (v >= 0.9 ? ' ✗' : v >= 0.85 ? ' !' : ''); }))) });
      hBox.appendChild(h('p', { text: fails.length ? `Pairs at or above .85: ${fails.join('; ')}. (! = above .85, ✗ = above .90.)` : 'All HTMT ratios are below .85.' }));
    }
    // Working
    const f0 = factors[0], s0 = stats[0], w = document.getElementById('working'); w.innerHTML = '';
    w.append(h('p', { class: 'formula', text:
      `${f0.name}: loadings ${f0.l.map(v => S.fmtNoZero(v, 2)).join(', ')}\n\n` +
      `CR  = (Σλ)² / ((Σλ)² + Σ(1 − λ²))\n    = ${S.fmt(s0.sl, 3)}² / (${S.fmt(s0.sl, 3)}² + ${S.fmt(s0.err, 3)}) = ${S.fmt(s0.cr, 3)}\n\n` +
      `AVE = Σλ² / number of items = ${S.fmt(s0.sl2, 3)} / ${f0.l.length} = ${S.fmt(s0.ave, 3)}\n\n` +
      `MSV = largest squared correlation with another factor` }),
      h('p', { text: 'CR is the same quantity as McDonald\'s omega for a congeneric factor with standardised loadings. HTMT is the average correlation between items of different factors, divided by the geometric mean of the average correlations among items of the same factor.' }));
    UI.announce(factors.map((f, i) => `${f.name}: CR ${S.fmtNoZero(stats[i].cr, 2)}, AVE ${S.fmtNoZero(stats[i].ave, 2)}`).join('. '));
  }

  function loadExample() {
    ta.value = EX.load;
    factors = parseLoadings(); buildPhi(EX.phi);
    // item correlations implied by the example CFA
    const L = []; factors.forEach((f, fi) => f.l.forEach(l => L.push([fi, l])));
    itemsTa.value = L.map((a, i) => L.slice(0, i + 1).map((b, j) => i === j ? '1' : (a[1] * b[1] * r(a[0], b[0])).toFixed(2).replace(/^(-?)0\./, '$1.')).join(' ')).join('\n');
    compute();
  }
  document.getElementById('example').addEventListener('click', loadExample);
  document.getElementById('clear').addEventListener('click', () => { ta.value = ''; itemsTa.value = ''; factors = []; buildPhi(); compute(); ta.focus(); });
  ta.addEventListener('input', UI.debounce(compute, 400));
  itemsTa.addEventListener('input', UI.debounce(compute, 400));
  // ?example=student-life loads efficacy and engagement from the Student Life Survey (five-factor CFA, clean file)
  if (UI.param('example') === 'student-life') {
    ta.value = 'Efficacy: .67 .66 .71 .76\nEngagement: .71 .68 .48 .59 .77';
    factors = parseLoadings(); buildPhi([[0.71]]);
    itemsTa.value = '1\n.46 1\n.46 .46 1\n.51 .50 .54 1\n.37 .35 .36 .40 1\n.34 .32 .31 .40 .50 1\n.17 .24 .26 .22 .36 .29 1\n.27 .24 .31 .35 .42 .42 .33 1\n.35 .36 .39 .40 .54 .53 .36 .43 1';
    compute();
  } else loadExample();
})();
