/* Statistical helpers for the course apps. Classic script: defines window.Stats. */
(function (global) {
  'use strict';

  // ---------- Random numbers ----------
  function rng(seed) {
    // mulberry32: small, fast, seedable
    let a = (seed >>> 0) || 1;
    const next = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    let spare = null;
    next.normal = function () {
      if (spare !== null) { const s = spare; spare = null; return s; }
      let u = 0, v = 0;
      while (u === 0) u = next();
      v = next();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(2 * Math.PI * v);
      return r * Math.cos(2 * Math.PI * v);
    };
    next.int = function (n) { return Math.floor(next() * n); };
    return next;
  }
  function newSeed() { return Math.floor(Math.random() * 2147483647) + 1; }

  // ---------- Descriptives ----------
  function sum(x) { let s = 0; for (let i = 0; i < x.length; i++) s += x[i]; return s; }
  function mean(x) { return sum(x) / x.length; }
  function variance(x, m) {
    if (m === undefined) m = mean(x);
    let s = 0; for (let i = 0; i < x.length; i++) { const d = x[i] - m; s += d * d; }
    return s / (x.length - 1);
  }
  function sd(x) { return Math.sqrt(variance(x)); }
  function cov(x, y) {
    const mx = mean(x), my = mean(y); let s = 0;
    for (let i = 0; i < x.length; i++) s += (x[i] - mx) * (y[i] - my);
    return s / (x.length - 1);
  }
  function cor(x, y) { return cov(x, y) / Math.sqrt(variance(x) * variance(y)); }
  function skewness(x) {
    const m = mean(x), n = x.length; let m2 = 0, m3 = 0;
    for (const v of x) { const d = v - m; m2 += d * d; m3 += d * d * d; }
    m2 /= n; m3 /= n; return m3 / Math.pow(m2, 1.5);
  }
  function quantile(sorted, p) {
    const h = (sorted.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
  }
  function covMatrix(cols) {
    const k = cols.length, S = zeros(k, k);
    for (let i = 0; i < k; i++) for (let j = 0; j <= i; j++) { S[i][j] = S[j][i] = cov(cols[i], cols[j]); }
    return S;
  }
  function corFromCov(S) {
    const k = S.length, R = zeros(k, k);
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) R[i][j] = S[i][j] / Math.sqrt(S[i][i] * S[j][j]);
    return R;
  }

  // ---------- Matrices (arrays of rows) ----------
  function zeros(r, c) { const m = []; for (let i = 0; i < r; i++) m.push(new Array(c).fill(0)); return m; }
  function identity(n) { const m = zeros(n, n); for (let i = 0; i < n; i++) m[i][i] = 1; return m; }
  function transpose(A) { return A[0].map((_, j) => A.map(r => r[j])); }
  function matmul(A, B) {
    const n = A.length, m = B[0].length, p = B.length, C = zeros(n, m);
    for (let i = 0; i < n; i++) for (let k = 0; k < p; k++) { const a = A[i][k]; if (a === 0) continue; for (let j = 0; j < m; j++) C[i][j] += a * B[k][j]; }
    return C;
  }
  function matvec(A, v) { return A.map(r => r.reduce((s, a, j) => s + a * v[j], 0)); }
  function add(A, B) { return A.map((r, i) => r.map((v, j) => v + B[i][j])); }
  function sub(A, B) { return A.map((r, i) => r.map((v, j) => v - B[i][j])); }
  function trace(A) { let s = 0; for (let i = 0; i < A.length; i++) s += A[i][i]; return s; }
  function copy(A) { return A.map(r => r.slice()); }

  // LU decomposition with partial pivoting; returns null if singular
  function lu(A) {
    const n = A.length, M = copy(A), piv = []; let sign = 1;
    for (let i = 0; i < n; i++) piv.push(i);
    for (let k = 0; k < n; k++) {
      let p = k, max = Math.abs(M[k][k]);
      for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > max) { max = Math.abs(M[i][k]); p = i; }
      if (max < 1e-13) return null;
      if (p !== k) { [M[p], M[k]] = [M[k], M[p]]; [piv[p], piv[k]] = [piv[k], piv[p]]; sign = -sign; }
      for (let i = k + 1; i < n; i++) {
        M[i][k] /= M[k][k];
        const f = M[i][k];
        for (let j = k + 1; j < n; j++) M[i][j] -= f * M[k][j];
      }
    }
    return { M, piv, sign };
  }
  function det(A) {
    const d = lu(A); if (!d) return 0;
    let s = d.sign; for (let i = 0; i < A.length; i++) s *= d.M[i][i]; return s;
  }
  function logdet(A) {
    const d = lu(A); if (!d) return NaN;
    let s = 0, sign = d.sign;
    for (let i = 0; i < A.length; i++) { const v = d.M[i][i]; if (v < 0) sign = -sign; s += Math.log(Math.abs(v)); }
    return sign > 0 ? s : NaN;
  }
  function solve(A, b) {
    const d = lu(A); if (!d) return null;
    const n = A.length, x = new Array(n);
    for (let i = 0; i < n; i++) { let s = b[d.piv[i]]; for (let j = 0; j < i; j++) s -= d.M[i][j] * x[j]; x[i] = s; }
    for (let i = n - 1; i >= 0; i--) { let s = x[i]; for (let j = i + 1; j < n; j++) s -= d.M[i][j] * x[j]; x[i] = s / d.M[i][i]; }
    return x;
  }
  function inverse(A) {
    const n = A.length, d = lu(A); if (!d) return null;
    const inv = zeros(n, n);
    for (let c = 0; c < n; c++) {
      const e = new Array(n).fill(0); e[c] = 1;
      const x = new Array(n);
      for (let i = 0; i < n; i++) { let s = e[d.piv[i]]; for (let j = 0; j < i; j++) s -= d.M[i][j] * x[j]; x[i] = s; }
      for (let i = n - 1; i >= 0; i--) { let s = x[i]; for (let j = i + 1; j < n; j++) s -= d.M[i][j] * x[j]; x[i] = s / d.M[i][i]; }
      for (let i = 0; i < n; i++) inv[i][c] = x[i];
    }
    return inv;
  }
  function cholesky(A) {
    const n = A.length, L = zeros(n, n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let s = A[i][j];
        for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
        if (i === j) { if (s <= 1e-12) return null; L[i][i] = Math.sqrt(s); }
        else L[i][j] = s / L[j][j];
      }
    }
    return L;
  }
  function isPositiveDefinite(A) { return cholesky(A) !== null; }

  // Draw n rows from N(mu, Sigma)
  function mvnSample(n, mu, Sigma, r) {
    const L = cholesky(Sigma); if (!L) return null;
    const k = mu.length, rows = [];
    for (let i = 0; i < n; i++) {
      const z = []; for (let j = 0; j < k; j++) z.push(r.normal());
      const x = mu.slice();
      for (let a = 0; a < k; a++) for (let b = 0; b <= a; b++) x[a] += L[a][b] * z[b];
      rows.push(x);
    }
    return rows;
  }

  // OLS: y on columns of X (intercept added). Returns coefficients, SEs, covariance, R2, residuals, fitted.
  function ols(y, Xcols) {
    const n = y.length, k = Xcols.length + 1;
    const X = []; for (let i = 0; i < n; i++) { const row = [1]; for (const c of Xcols) row.push(c[i]); X.push(row); }
    const XtX = zeros(k, k), Xty = new Array(k).fill(0);
    for (let i = 0; i < n; i++) for (let a = 0; a < k; a++) { Xty[a] += X[i][a] * y[i]; for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b]; }
    const inv = inverse(XtX); if (!inv) return null;
    const b = matvec(inv, Xty);
    const fitted = X.map(r => r.reduce((s, v, j) => s + v * b[j], 0));
    const resid = y.map((v, i) => v - fitted[i]);
    const sse = resid.reduce((s, e) => s + e * e, 0);
    const my = mean(y); const sst = y.reduce((s, v) => s + (v - my) * (v - my), 0);
    const df = n - k, s2 = sse / df;
    const vcov = inv.map(r => r.map(v => v * s2));
    const se = vcov.map((r, i) => Math.sqrt(r[i]));
    return { b, se, vcov, fitted, resid, sse, sst, r2: 1 - sse / sst, df, sigma: Math.sqrt(s2), n, X, XtXinv: inv };
  }

  // ---------- Special functions and distributions ----------
  function lnGamma(z) {
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
    z -= 1; let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  // Regularised lower incomplete gamma P(a, x)
  function gammaP(a, x) {
    if (x <= 0) return 0;
    if (x < a + 1) {
      let ap = a, s = 1 / a, d = s;
      for (let n = 0; n < 1000; n++) { ap += 1; d *= x / ap; s += d; if (Math.abs(d) < Math.abs(s) * 1e-15) break; }
      return s * Math.exp(-x + a * Math.log(x) - lnGamma(a));
    }
    return 1 - gammaQcf(a, x);
  }
  function gammaQcf(a, x) {
    let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
    for (let i = 1; i < 1000; i++) {
      const an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
  }
  function chisqCdf(x, df) { return x <= 0 ? 0 : gammaP(df / 2, x / 2); }
  function chisqSf(x, df) {
    if (x <= 0) return 1;
    const a = df / 2, xx = x / 2;
    return xx < a + 1 ? 1 - gammaP(a, xx) : gammaQcf(a, xx);
  }
  function chisqPdf(x, df) {
    if (x <= 0) return df === 2 ? 0.5 : 0;
    const k = df / 2; return Math.exp((k - 1) * Math.log(x) - x / 2 - k * Math.log(2) - lnGamma(k));
  }
  // Noncentral chi-square CDF (Poisson mixture, summed outward from the mode)
  function ncChisqCdf(x, df, lambda) {
    if (lambda <= 0) return chisqCdf(x, df);
    if (x <= 0) return 0;
    const h = lambda / 2, mode = Math.floor(h);
    const logw = j => -h + j * Math.log(h) - lnGamma(j + 1);
    let total = 0;
    for (let j = mode; j < mode + 100000; j++) {
      const w = Math.exp(logw(j)); total += w * chisqCdf(x, df + 2 * j);
      if (w < 1e-14 && j > mode + 10) break;
    }
    for (let j = mode - 1; j >= 0; j--) {
      const w = Math.exp(logw(j)); total += w * chisqCdf(x, df + 2 * j);
      if (w < 1e-14) break;
    }
    return Math.min(1, Math.max(0, total));
  }
  // Regularised incomplete beta I_x(a, b)
  function betacf(a, b, x) {
    let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; let h = d;
    for (let m = 1; m <= 1000; m++) {
      const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-15) break;
    }
    return h;
  }
  function betaInc(x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function tCdf(t, df) {
    const x = df / (df + t * t), p = 0.5 * betaInc(x, df / 2, 0.5);
    return t >= 0 ? 1 - p : p;
  }
  function tTwoSided(t, df) { return betaInc(df / (df + t * t), df / 2, 0.5); }
  function tQuantile(p, df) {
    // bisection on the CDF
    let lo = -1000, hi = 1000;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (tCdf(mid, df) < p) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  function fSf(F, d1, d2) { if (F <= 0) return 1; return betaInc(d2 / (d2 + d1 * F), d2 / 2, d1 / 2); }
  function fPdf(x, d1, d2) {
    if (x <= 0) return 0;
    return Math.exp(0.5 * (d1 * Math.log(d1 * x) + d2 * Math.log(d2) - (d1 + d2) * Math.log(d1 * x + d2)) - Math.log(x) - (lnGamma(d1 / 2) + lnGamma(d2 / 2) - lnGamma((d1 + d2) / 2)));
  }
  function normPdf(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }
  function normCdf(x) {
    // Cody-style via erfc
    return 0.5 * erfc(-x / Math.SQRT2);
  }
  function erfc(x) {
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
      t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function normQuantile(p) {
    // Acklam's algorithm
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425; let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  // Bivariate standard normal CDF P(X < h, Y < k) with correlation r (Genz's BVND, Drezner–Wesolowsky approach)
  function bvnCdf(h, k, r) {
    if (h === -Infinity || k === -Infinity) return 0;
    if (h === Infinity) return normCdf(k);
    if (k === Infinity) return normCdf(h);
    return bvnu(-h, -k, r);
  }
  function bvnu(dh, dk, r) {
    const tp = 2 * Math.PI;
    let w, x, lg;
    if (Math.abs(r) < 0.3) { lg = 3; w = [0.1713244923791705, 0.3607615730481384, 0.4679139345726904]; x = [0.9324695142031522, 0.6612093864662647, 0.2386191860831970]; }
    else if (Math.abs(r) < 0.75) { lg = 6; w = [0.04717533638651177, 0.1069393259953183, 0.1600783285433464, 0.2031674267230659, 0.2334925365383547, 0.2491470458134029]; x = [0.9815606342467191, 0.9041172563704750, 0.7699026741943050, 0.5873179542866171, 0.3678314989981802, 0.1252334085114692]; }
    else { lg = 10; w = [0.01761400713915212, 0.04060142980038694, 0.06267204833410906, 0.08327674157670475, 0.1019301198172404, 0.1181945319615184, 0.1316886384491766, 0.1420961093183821, 0.1491729864726037, 0.1527533871307259]; x = [0.9931285991850949, 0.9639719272779138, 0.9122344282513259, 0.8391169718222188, 0.7463319064601508, 0.6360536807265150, 0.5108670019508271, 0.3737060887154196, 0.2277858511416451, 0.07652652113349733]; }
    let h = dh, k = dk, hk = h * k, bvn = 0;
    if (Math.abs(r) < 0.925) {
      const hs = (h * h + k * k) / 2, asr = Math.asin(r);
      for (let i = 0; i < lg; i++) {
        let sn = Math.sin(asr * (1 - x[i]) / 2); bvn += w[i] * Math.exp((sn * hk - hs) / (1 - sn * sn));
        sn = Math.sin(asr * (1 + x[i]) / 2); bvn += w[i] * Math.exp((sn * hk - hs) / (1 - sn * sn));
      }
      bvn = bvn * asr / (2 * tp) + normCdf(-h) * normCdf(-k);
    } else {
      if (r < 0) { k = -k; hk = -hk; }
      if (Math.abs(r) < 1) {
        const as = (1 - r) * (1 + r); let a = Math.sqrt(as); const bs = (h - k) * (h - k);
        const c = (4 - hk) / 8, d = (12 - hk) / 16;
        bvn = a * Math.exp(-(bs / as + hk) / 2) * (1 - c * (bs - as) * (1 - d * bs / 5) / 3 + c * d * as * as / 5);
        if (hk > -160) {
          const b = Math.sqrt(bs);
          bvn -= Math.exp(-hk / 2) * Math.sqrt(tp) * normCdf(-b / a) * b * (1 - c * bs * (1 - d * bs / 5) / 3);
        }
        a = a / 2;
        for (let i = 0; i < lg; i++) {
          for (const sgn of [-1, 1]) {
            let xs = (a * (1 + sgn * x[i])); xs = xs * xs;
            const rs = Math.sqrt(1 - xs);
            bvn += a * w[i] * (Math.exp(-bs / (2 * xs) - hk / (1 + rs)) / rs - Math.exp(-(bs / xs + hk) / 2) * (1 + c * xs * (1 + d * xs)));
          }
        }
        bvn = -bvn / tp;
      }
      if (r > 0) bvn += normCdf(-Math.max(h, k));
      else { bvn = -bvn; if (k > h) bvn += normCdf(k) - normCdf(h); }
    }
    return Math.max(0, Math.min(1, bvn));
  }

  // ---------- Optimisation ----------
  // BFGS with numerical gradient and backtracking line search
  function minimize(f, x0, opts) {
    opts = opts || {};
    const maxIter = opts.maxIter || 300, tol = opts.tol || 1e-9, n = x0.length;
    let x = x0.slice(), fx = f(x);
    const grad = (p) => {
      const g = new Array(n);
      for (let i = 0; i < n; i++) {
        const h = 1e-6 * Math.max(1, Math.abs(p[i]));
        const a = p.slice(), b = p.slice(); a[i] += h; b[i] -= h;
        g[i] = (f(a) - f(b)) / (2 * h);
      }
      return g;
    };
    let g = grad(x), H = identity(n), iter = 0;
    for (; iter < maxIter; iter++) {
      const d = matvec(H, g).map(v => -v);
      let slope = d.reduce((s, v, i) => s + v * g[i], 0);
      if (!(slope < 0)) { H = identity(n); for (let i = 0; i < n; i++) d[i] = -g[i]; slope = -g.reduce((s, v) => s + v * v, 0); }
      let step = 1, xn, fn;
      for (let k = 0; k < 40; k++) {
        xn = x.map((v, i) => v + step * d[i]); fn = f(xn);
        if (isFinite(fn) && fn <= fx + 1e-4 * step * slope) break;
        step *= 0.5;
      }
      if (!isFinite(fn) || fn > fx) break;
      const gn = grad(xn);
      const s = xn.map((v, i) => v - x[i]), y = gn.map((v, i) => v - g[i]);
      const sy = s.reduce((a, v, i) => a + v * y[i], 0);
      const done = Math.abs(fx - fn) < tol * (1 + Math.abs(fx)) && Math.sqrt(gn.reduce((a, v) => a + v * v, 0)) < 1e-5;
      x = xn; fx = fn; g = gn;
      if (done) break;
      if (sy > 1e-12) {
        const Hy = matvec(H, y), yHy = y.reduce((a, v, i) => a + v * Hy[i], 0);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          H[i][j] += ((sy + yHy) * s[i] * s[j]) / (sy * sy) - (Hy[i] * s[j] + s[i] * Hy[j]) / sy;
        }
      }
    }
    return { x, value: fx, iterations: iter };
  }
  // Golden-section search on [a, b]
  function goldenMin(f, a, b, tol) {
    tol = tol || 1e-7; const gr = (Math.sqrt(5) - 1) / 2;
    let c = b - gr * (b - a), d = a + gr * (b - a), fc = f(c), fd = f(d);
    while (Math.abs(b - a) > tol) {
      if (fc < fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = f(c); }
      else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = f(d); }
    }
    return (a + b) / 2;
  }
  // Root of monotone function on [lo, hi]
  function bisect(f, lo, hi, iters) {
    let flo = f(lo);
    for (let i = 0; i < (iters || 200); i++) {
      const mid = (lo + hi) / 2, fm = f(mid);
      if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid;
    }
    return (lo + hi) / 2;
  }

  // ---------- SEM helpers ----------
  // ML discrepancy F = ln|Sigma| + tr(S Sigma^-1) - ln|S| - p
  function mlDiscrepancy(S, Sigma) {
    const inv = inverse(Sigma); if (!inv) return Infinity;
    const ld = logdet(Sigma); if (!isFinite(ld)) return Infinity;
    return ld + trace(matmul(S, inv)) - logdet(S) - S.length;
  }
  // RMSEA, CI and PCLOSE, following Amos conventions (n = N - 1)
  function rmsea(chisq, df, N) {
    const n = N - 1;
    const point = df > 0 ? Math.sqrt(Math.max((chisq - df) / (df * n), 0)) : NaN;
    if (!(df > 0)) return { point, lo: NaN, hi: NaN, pclose: NaN };
    const lambdaFor = (target) => {
      // find lambda such that ncChisqCdf(chisq; df, lambda) = target
      if (chisqCdf(chisq, df) < target) return 0;
      let hi = Math.max(10, chisq * 2);
      while (ncChisqCdf(chisq, df, hi) > target) hi *= 2;
      return bisect(l => ncChisqCdf(chisq, df, l) - target, 0, hi, 80);
    };
    const lamLo = lambdaFor(0.95), lamHi = lambdaFor(0.05);
    const lo = Math.sqrt(lamLo / (df * n)), hi = Math.sqrt(lamHi / (df * n));
    const lam0 = 0.05 * 0.05 * df * n;
    const pclose = 1 - ncChisqCdf(chisq, df, lam0);
    return { point, lo, hi, pclose };
  }
  function cfi(chisq, df, chisqB, dfB) {
    const d = Math.max(chisq - df, 0), dB = Math.max(chisqB - dfB, chisq - df, 0);
    return dB === 0 ? 1 : 1 - d / dB;
  }
  function tli(chisq, df, chisqB, dfB) { return ((chisqB / dfB) - (chisq / df)) / ((chisqB / dfB) - 1); }

  // ---------- Formatting ----------
  function fmt(x, d) {
    if (x === null || x === undefined || Number.isNaN(x)) return '–';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    const s = x.toFixed(d === undefined ? 2 : d);
    return s.replace('-', '−');
  }
  function fmtNoZero(x, d) { return fmt(x, d).replace(/^(−?)0\./, '$1.'); }
  function fmtP(p) {
    if (Number.isNaN(p)) return '–';
    if (p < 0.001) return '< .001';
    return fmtNoZero(p, 3);
  }

  global.Stats = {
    rng, newSeed, sum, mean, variance, sd, cov, cor, skewness, quantile, covMatrix, corFromCov,
    zeros, identity, transpose, matmul, matvec, add, sub, trace, copy, det, logdet, solve, inverse, cholesky,
    isPositiveDefinite, mvnSample, ols,
    lnGamma, gammaP, chisqCdf, chisqSf, chisqPdf, ncChisqCdf, betaInc, tCdf, tTwoSided, tQuantile, fSf, fPdf,
    normPdf, normCdf, normQuantile, bvnCdf,
    minimize, goldenMin, bisect,
    mlDiscrepancy, rmsea, cfi, tli,
    fmt, fmtNoZero, fmtP
  };
})(window);
