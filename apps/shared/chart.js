/* Minimal accessible SVG charts for the course apps. Classic script: defines window.Chart. */
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    let style = '';
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v === undefined || v === null) continue;
      // CSS custom properties only work through style, not presentation attributes
      if ((k === 'fill' || k === 'stroke') && String(v).indexOf('var(') >= 0) style += `${k}:${v};`;
      else e.setAttribute(k, v);
    }
    if (style) { const prev = e.getAttribute('style'); e.setAttribute('style', (prev ? prev.replace(/;?\s*$/, ';') : '') + style); }
    if (parent) parent.appendChild(e);
    return e;
  }

  function niceStep(range, count) {
    const raw = range / Math.max(1, count), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  }
  function ticks(lo, hi, count) {
    const step = niceStep(hi - lo, count || 5), out = [];
    const start = Math.ceil(lo / step - 1e-9) * step;
    for (let v = start; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
  }
  function tickFormat(v, step) {
    const d = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step) - 1e-9));
    return v.toFixed(d).replace('-', '−');
  }
  function extent(values, pad) {
    let lo = Infinity, hi = -Infinity;
    for (const v of values) if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (lo === hi) { lo -= 1; hi += 1; }
    const p = (hi - lo) * (pad === undefined ? 0.05 : pad);
    return [lo - p, hi + p];
  }

  /**
   * Create a chart inside `container` (emptied first).
   * opts: width, height, margin {t,r,b,l}, x:[lo,hi], y:[lo,hi], xLabel, yLabel, title, desc,
   *       xTicks, yTicks (counts), xTickValues, xTickFormat(v), yTickFormat(v), grid (bool)
   */
  function create(container, opts) {
    container.innerHTML = '';
    // Size the drawing to the space available so text stays readable on phones
    const prefW = opts.width || 640, prefH = opts.height || 380;
    const avail = container.clientWidth || prefW;
    const W = opts.fixed ? prefW : Math.round(Math.max(300, Math.min(prefW, avail)));
    const H = opts.fixed ? prefH : Math.round(prefH * Math.max(0.72, W / prefW));
    const m = Object.assign({ t: 16, r: 16, b: 52, l: 60 }, opts.margin || {});
    const id = 'chart' + (++uid);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-labelledby': `${id}-t ${id}-d`, class: 'chart', preserveAspectRatio: 'xMidYMid meet' }, container);
    const title = el('title', { id: `${id}-t` }, svg); title.textContent = opts.title || 'Chart';
    const desc = el('desc', { id: `${id}-d` }, svg); desc.textContent = opts.desc || '';
    const [x0, x1] = opts.x, [y0, y1] = opts.y;
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const x = v => m.l + (v - x0) / (x1 - x0) * pw;
    const y = v => m.t + ph - (v - y0) / (y1 - y0) * ph;
    x.invert = px => x0 + (px - m.l) / pw * (x1 - x0);
    y.invert = py => y0 + (m.t + ph - py) / ph * (y1 - y0);

    const gridG = el('g', { class: 'grid', 'aria-hidden': 'true' }, svg);
    const axisG = el('g', { class: 'axis', 'aria-hidden': 'true' }, svg);
    const xt = opts.xTickValues || ticks(x0, x1, opts.xTicks || 6);
    const yt = ticks(y0, y1, opts.yTicks || 5);
    const xstep = xt.length > 1 ? xt[1] - xt[0] : 1, ystep = yt.length > 1 ? yt[1] - yt[0] : 1;
    for (const v of xt) {
      if (opts.grid !== false) el('line', { x1: x(v), x2: x(v), y1: m.t, y2: m.t + ph }, gridG);
      el('line', { x1: x(v), x2: x(v), y1: m.t + ph, y2: m.t + ph + 5 }, axisG);
      const t = el('text', { x: x(v), y: m.t + ph + 19, 'text-anchor': 'middle', class: 'tick-label' }, axisG);
      t.textContent = opts.xTickFormat ? opts.xTickFormat(v) : tickFormat(v, xstep);
    }
    for (const v of yt) {
      if (opts.grid !== false) el('line', { x1: m.l, x2: m.l + pw, y1: y(v), y2: y(v) }, gridG);
      el('line', { x1: m.l - 5, x2: m.l, y1: y(v), y2: y(v) }, axisG);
      const t = el('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'tick-label' }, axisG);
      t.textContent = opts.yTickFormat ? opts.yTickFormat(v) : tickFormat(v, ystep);
    }
    el('line', { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph }, axisG);
    el('line', { x1: m.l, x2: m.l, y1: m.t, y2: m.t + ph }, axisG);
    if (opts.xLabel) { const t = el('text', { x: m.l + pw / 2, y: H - 10, 'text-anchor': 'middle', class: 'axis-title' }, axisG); t.textContent = opts.xLabel; }
    if (opts.yLabel) { const t = el('text', { x: 16, y: m.t + ph / 2, 'text-anchor': 'middle', class: 'axis-title', transform: `rotate(-90 16 ${m.t + ph / 2})` }, axisG); t.textContent = opts.yLabel; }

    const clipId = id + '-clip';
    const defs = el('defs', null, svg);
    const cp = el('clipPath', { id: clipId }, defs);
    el('rect', { x: m.l, y: m.t, width: pw, height: ph }, cp);
    const plot = el('g', { 'clip-path': `url(#${clipId})`, 'aria-hidden': 'true' }, svg);
    const overlay = el('g', { 'aria-hidden': 'true' }, svg);

    const api = {
      svg, x, y, plot, overlay, defs, width: W, height: H, margin: m, pw, ph,
      setDesc(text) { desc.textContent = text; },
      line(points, o) {
        o = o || {};
        const d = points.filter(p => isFinite(p[0]) && isFinite(p[1])).map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(2) + ',' + y(p[1]).toFixed(2)).join('');
        return el('path', { d, fill: 'none', stroke: o.color || 'var(--s1)', 'stroke-width': o.width || 2.5, 'stroke-dasharray': o.dash, opacity: o.opacity, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, o.parent || plot);
      },
      area(upper, lower, o) {
        o = o || {};
        const pts = upper.map(p => x(p[0]).toFixed(2) + ',' + y(p[1]).toFixed(2)).concat(lower.slice().reverse().map(p => x(p[0]).toFixed(2) + ',' + y(p[1]).toFixed(2)));
        return el('polygon', { points: pts.join(' '), fill: o.color || 'var(--s1)', opacity: o.opacity === undefined ? 0.18 : o.opacity }, o.parent || plot);
      },
      points(points, o) {
        o = o || {};
        const g = el('g', null, o.parent || plot);
        const r = o.r || 3.5;
        for (const p of points) {
          if (!isFinite(p[0]) || !isFinite(p[1])) continue;
          const cx = x(p[0]), cy = y(p[1]);
          if (o.shape === 'square') el('rect', { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, fill: o.hollow ? 'none' : (o.color || 'var(--s1)'), stroke: o.color || 'var(--s1)', 'stroke-width': 1.5, opacity: o.opacity }, g);
          else if (o.shape === 'triangle') el('path', { d: `M${cx},${cy - r * 1.2}L${cx + r * 1.1},${cy + r * 0.8}L${cx - r * 1.1},${cy + r * 0.8}Z`, fill: o.hollow ? 'none' : (o.color || 'var(--s1)'), stroke: o.color || 'var(--s1)', 'stroke-width': 1.5, opacity: o.opacity }, g);
          else el('circle', { cx, cy, r, fill: o.hollow ? 'none' : (o.color || 'var(--s1)'), stroke: o.color || 'var(--s1)', 'stroke-width': o.hollow ? 1.5 : 0.75, opacity: o.opacity === undefined ? 0.85 : o.opacity }, g);
        }
        return g;
      },
      vline(v, o) {
        o = o || {};
        return el('line', { x1: x(v), x2: x(v), y1: m.t, y2: m.t + ph, stroke: o.color || 'var(--muted)', 'stroke-width': o.width || 1.5, 'stroke-dasharray': o.dash }, o.parent || overlay);
      },
      hline(v, o) {
        o = o || {};
        return el('line', { x1: m.l, x2: m.l + pw, y1: y(v), y2: y(v), stroke: o.color || 'var(--muted)', 'stroke-width': o.width || 1.5, 'stroke-dasharray': o.dash }, o.parent || overlay);
      },
      rect(xa, ya, xb, yb, o) {
        o = o || {};
        return el('rect', { x: Math.min(x(xa), x(xb)), y: Math.min(y(ya), y(yb)), width: Math.abs(x(xb) - x(xa)), height: Math.abs(y(yb) - y(ya)), fill: o.color || 'var(--s1)', opacity: o.opacity === undefined ? 0.8 : o.opacity, stroke: o.stroke, 'stroke-width': o.strokeWidth }, o.parent || plot);
      },
      text(px, py, str, o) {
        o = o || {};
        const t = el('text', { x: o.raw ? px : x(px), y: o.raw ? py : y(py), 'text-anchor': o.anchor || 'start', 'font-size': o.size || 12, 'font-weight': o.weight, fill: o.color || 'var(--text)', dy: o.dy }, o.parent || overlay);
        t.textContent = str; return t;
      },
      el: (name, attrs, parent) => el(name, attrs, parent || plot)
    };
    return api;
  }

  // A small legend swatch list (HTML), each item: {label, color, dash, shape}
  function legend(container, items) {
    const ul = document.createElement('ul'); ul.className = 'legend';
    for (const it of items) {
      const li = document.createElement('li');
      const sw = el('svg', { viewBox: '0 0 28 14', 'aria-hidden': 'true' });
      if (it.shape === 'point') el('circle', { cx: 14, cy: 7, r: 4.5, fill: it.hollow ? 'none' : it.color, stroke: it.color, 'stroke-width': 1.5 }, sw);
      else if (it.shape === 'square') el('rect', { x: 9, y: 2, width: 10, height: 10, fill: it.hollow ? 'none' : it.color, stroke: it.color, 'stroke-width': 1.5 }, sw);
      else if (it.shape === 'triangle') el('path', { d: 'M14,2L19,12L9,12Z', fill: it.hollow ? 'none' : it.color, stroke: it.color, 'stroke-width': 1.5 }, sw);
      else if (it.shape === 'band') el('rect', { x: 1, y: 2, width: 26, height: 10, fill: it.color, opacity: 0.25 }, sw);
      else el('line', { x1: 1, x2: 27, y1: 7, y2: 7, stroke: it.color, 'stroke-width': 3, 'stroke-dasharray': it.dash }, sw);
      li.appendChild(sw);
      const span = document.createElement('span'); span.textContent = it.label; li.appendChild(span);
      ul.appendChild(li);
    }
    container.innerHTML = ''; container.appendChild(ul);
  }

  global.Chart = { create, legend, ticks, extent, svgEl: el };
})(window);
