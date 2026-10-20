/* Path diagrams as SVG markup strings. Works in the browser (window.Diagram) and in Node (module.exports),
   so the same code draws the live diagrams in the apps and the static diagrams in the book.

   Conventions (as in Amos): rectangles = observed variables, circles/ovals = latent variables and error terms,
   single-headed arrows = regression paths, double-headed curved arrows = correlations/covariances.

   spec = {
     id, width, height, title, desc,
     nodes: [{ id, label, x, y, shape: 'rect' | 'circle' | 'ellipse', w, h, r, emph, sub }],
     edges: [{ from, to, toEdge (index of edge whose midpoint is the target), kind: 'path' | 'cov',
               label, bend (cov curvature, px), dashed, emph, faint, labelOffset, labelAt (0–1) }],
     notes: [{ x, y, text, anchor, size }]
   }
   Colours come from CSS custom properties defined by the page:
   --pd-line, --pd-fill, --pd-text, --pd-emph, --pd-bg (with fallbacks). */
(function (root) {
  'use strict';
  let uid = 0;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const f = v => (Math.round(v * 10) / 10).toString();

  // Point on the boundary of a node, in the direction of (tx, ty)
  function boundary(n, tx, ty, pad) {
    const dx = tx - n.x, dy = ty - n.y, L = Math.hypot(dx, dy) || 1;
    pad = pad || 0;
    if (n.shape === 'rect') {
      const hw = n.w / 2 + pad, hh = n.h / 2 + pad;
      const s = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
      return [n.x + dx * s, n.y + dy * s];
    }
    const rx = (n.shape === 'circle' ? n.r : n.w / 2) + pad, ry = (n.shape === 'circle' ? n.r : n.h / 2) + pad;
    const t = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    return [n.x + dx * t, n.y + dy * t];
  }

  function svg(spec) {
    const id = spec.id || 'pd' + (++uid);
    const W = spec.width || 480, H = spec.height || 240;
    const nodes = {};
    for (const n of spec.nodes) {
      const m = Object.assign({ shape: 'rect' }, n);
      if (m.shape === 'rect') { m.w = m.w || Math.max(56, 12 + 9 * String(m.label).length); m.h = m.h || 40; }
      if (m.shape === 'circle') m.r = m.r || 16;
      if (m.shape === 'ellipse') { m.w = m.w || Math.max(80, 18 + 9 * String(m.label).length); m.h = m.h || 46; }
      nodes[m.id] = m;
    }
    const line = 'var(--pd-line, currentColor)', fill = 'var(--pd-fill, transparent)', text = 'var(--pd-text, currentColor)', emph = 'var(--pd-emph, #b3470b)', bg = 'var(--pd-bg, #fff)';
    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t ${id}-d" class="path-diagram" style="max-width:${W}px;width:100%;height:auto;display:block;margin:0 auto">`);
    out.push(`<title id="${id}-t">${esc(spec.title || 'Path diagram')}</title><desc id="${id}-d">${esc(spec.desc || '')}</desc>`);
    out.push('<defs>');
    for (const [k, c] of [['n', line], ['e', emph]]) {
      out.push(`<marker id="${id}-a${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10Z" style="fill:${c}"/></marker>`);
    }
    out.push('</defs>');
    const mids = [], labels = [];
    spec.edges.forEach((e, i) => {
      const A = nodes[e.from];
      const color = e.emph ? emph : line;
      const mk = `url(#${id}-a${e.emph ? 'e' : 'n'})`;
      const style = `stroke:${color};fill:none;stroke-width:${e.width || (e.emph ? 2.6 : 1.8)};${e.dashed ? 'stroke-dasharray:6 4;' : ''}${e.faint ? 'opacity:.45;' : ''}`;
      let mid, x1, y1, x2, y2;
      if (e.kind === 'cov') {
        const B = nodes[e.to];
        const bend = e.bend === undefined ? 40 : e.bend;
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
        const cx = mx + (-dy / L) * bend * 2, cy = my + (dx / L) * bend * 2;
        [x1, y1] = boundary(A, cx, cy, 2); [x2, y2] = boundary(B, cx, cy, 3);
        out.push(`<path d="M${f(x1)},${f(y1)} Q${f(cx)},${f(cy)} ${f(x2)},${f(y2)}" style="${style}" marker-start="${mk}" marker-end="${mk}"/>`);
        mid = [0.25 * x1 + 0.5 * cx + 0.25 * x2, 0.25 * y1 + 0.5 * cy + 0.25 * y2];
      } else {
        let tx, ty;
        if (e.toEdge !== undefined) { [tx, ty] = mids[e.toEdge]; }
        else { const B = nodes[e.to]; tx = B.x; ty = B.y; }
        [x1, y1] = boundary(A, tx, ty, 2);
        if (e.toEdge !== undefined) { const dx = tx - x1, dy = ty - y1, L = Math.hypot(dx, dy); x2 = tx - dx / L * 3; y2 = ty - dy / L * 3; }
        else [x2, y2] = boundary(nodes[e.to], A.x, A.y, 3);
        out.push(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" style="${style}" marker-end="${mk}"/>`);
        const t = e.labelAt === undefined ? 0.5 : e.labelAt;
        mid = [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
      }
      mids[i] = e.kind === 'cov' ? mid : [(x1 + x2) / 2, (y1 + y2) / 2];
      if (e.label !== undefined && e.label !== '') {
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, off = e.labelOffset === undefined ? 12 : e.labelOffset;
        const lx = mid[0] + (-dy / L) * off, ly = mid[1] + (dx / L) * off;
        labels.push(`<text x="${f(lx)}" y="${f(ly + 4.5)}" text-anchor="middle" style="fill:${e.emph ? emph : text};font-size:14px;font-weight:600;paint-order:stroke;stroke:${bg};stroke-width:4px;stroke-linejoin:round">${esc(e.label)}</text>`);
      }
    });
    for (const k in nodes) {
      const n = nodes[k], st = `stroke:${n.emph ? emph : line};stroke-width:${n.emph ? 2.6 : 1.8};fill:${fill}`;
      if (n.shape === 'rect') out.push(`<rect x="${f(n.x - n.w / 2)}" y="${f(n.y - n.h / 2)}" width="${f(n.w)}" height="${f(n.h)}" rx="3" style="${st}"/>`);
      else if (n.shape === 'circle') out.push(`<circle cx="${f(n.x)}" cy="${f(n.y)}" r="${f(n.r)}" style="${st}"/>`);
      else out.push(`<ellipse cx="${f(n.x)}" cy="${f(n.y)}" rx="${f(n.w / 2)}" ry="${f(n.h / 2)}" style="${st}"/>`);
      const size = n.shape === 'circle' ? 13 : 15;
      out.push(`<text x="${f(n.x)}" y="${f(n.y + size * 0.35)}" text-anchor="middle" style="fill:${text};font-size:${size}px;font-weight:600">${esc(n.label)}</text>`);
      if (n.sub) out.push(`<text x="${f(n.x)}" y="${f(n.y + (n.h || 2 * n.r) / 2 + 16)}" text-anchor="middle" style="fill:${text};font-size:12px">${esc(n.sub)}</text>`);
    }
    out.push(...labels);
    for (const t of spec.notes || []) {
      out.push(`<text x="${f(t.x)}" y="${f(t.y)}" text-anchor="${t.anchor || 'middle'}" style="fill:${t.emph ? emph : text};font-size:${t.size || 13}px;${t.italic ? 'font-style:italic;' : ''}">${esc(t.text)}</text>`);
    }
    out.push('</svg>');
    return out.join('');
  }

  const api = { svg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Diagram = api;
})(typeof window !== 'undefined' ? window : this);
