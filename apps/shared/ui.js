/* UI helpers for the course apps. Classic script: defines window.UI. */
(function (global) {
  'use strict';
  let uid = 0;
  const nextId = p => (p || 'ui') + '-' + (++uid);

  function h(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    if (children) for (const c of [].concat(children)) if (c !== null && c !== undefined) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return e;
  }

  function debounce(fn, ms) {
    let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); };
  }

  // Polite live region for summaries after a change (debounced so slider drags are not chatty)
  let live;
  const announceNow = msg => { if (!live) return; live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); };
  const t0 = Date.now();
  const announceLater = debounce(announceNow, 700);
  // Skip announcements while the app first draws itself
  const announce = msg => { if (Date.now() - t0 > 1500) announceLater(msg); };

  /**
   * Labelled range slider with visible value.
   * opts: label, min, max, step, value, format(v), hint, onInput(v), id
   */
  function slider(opts) {
    const id = opts.id || nextId('s');
    const fmt = opts.format || (v => String(v));
    const input = h('input', { type: 'range', id, min: opts.min, max: opts.max, step: opts.step, value: opts.value });
    const out = h('output', { for: id, 'aria-hidden': 'true' });
    const hintId = opts.hint ? id + '-hint' : null;
    if (hintId) input.setAttribute('aria-describedby', hintId);
    const wrap = h('div', { class: 'control' }, [
      h('div', { class: 'control-label' }, [h('label', { for: id, text: opts.label }), out]),
      input,
      opts.hint ? h('span', { class: 'hint', id: hintId, text: opts.hint }) : null
    ]);
    const update = () => {
      const v = parseFloat(input.value);
      out.textContent = fmt(v);
      input.setAttribute('aria-valuetext', fmt(v));
    };
    input.addEventListener('input', () => { update(); if (opts.onInput) opts.onInput(parseFloat(input.value)); });
    update();
    return {
      el: wrap, input,
      get value() { return parseFloat(input.value); },
      set(v, silent) { input.value = v; update(); if (!silent && opts.onInput) opts.onInput(parseFloat(input.value)); },
      setLabel(t) { wrap.querySelector('label').textContent = t; }
    };
  }

  // Labelled select. options: [{value, label}]
  function select(opts) {
    const id = opts.id || nextId('sel');
    const s = h('select', { id });
    for (const o of opts.options) s.appendChild(h('option', { value: o.value, text: o.label, selected: o.value === opts.value ? true : null }));
    s.addEventListener('change', () => opts.onChange && opts.onChange(s.value));
    const wrap = h('div', { class: 'control' }, [h('label', { for: id, text: opts.label, style: 'display:block;font-weight:500' }), s,
      opts.hint ? h('span', { class: 'hint', text: opts.hint }) : null]);
    return { el: wrap, input: s, get value() { return s.value; }, set(v) { s.value = v; } };
  }

  // Labelled number input
  function number(opts) {
    const id = opts.id || nextId('n');
    const input = h('input', { type: 'number', id, min: opts.min, max: opts.max, step: opts.step || 'any', value: opts.value, inputmode: 'decimal' });
    const err = h('div', { class: 'error-text', id: id + '-err', role: 'alert', hidden: true });
    input.setAttribute('aria-describedby', id + '-err' + (opts.hint ? ' ' + id + '-hint' : ''));
    const wrap = h('div', { class: 'control' }, [
      h('label', { for: id, text: opts.label, style: 'display:block;font-weight:500' }), input,
      opts.hint ? h('span', { class: 'hint', id: id + '-hint', text: opts.hint }) : null, err
    ]);
    const validate = () => {
      const v = parseFloat(input.value);
      let msg = '';
      if (input.value.trim() === '' || !isFinite(v)) msg = 'Enter a number.';
      else if (opts.min !== undefined && v < opts.min) msg = `Enter a value of at least ${opts.min}.`;
      else if (opts.max !== undefined && v > opts.max) msg = `Enter a value of at most ${opts.max}.`;
      else if (opts.validate) msg = opts.validate(v) || '';
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      err.hidden = !msg; err.textContent = msg;
      return msg ? null : v;
    };
    input.addEventListener('input', () => { const v = validate(); if (v !== null && opts.onInput) opts.onInput(v); });
    return { el: wrap, input, validate, get value() { return parseFloat(input.value); }, set(v) { input.value = v; validate(); } };
  }

  function checkbox(opts) {
    const id = opts.id || nextId('c');
    const input = h('input', { type: 'checkbox', id, checked: opts.checked ? true : null });
    input.addEventListener('change', () => opts.onChange && opts.onChange(input.checked));
    const wrap = h('div', { class: 'check' }, [input, h('label', { for: id, text: opts.label })]);
    return { el: wrap, input, get checked() { return input.checked; }, set(v) { input.checked = v; } };
  }

  function button(label, onClick, cls) {
    return h('button', { type: 'button', class: cls || null, text: label, onclick: onClick });
  }

  // Render key results as a list of stat tiles: items [{k, v}]
  function stats(container, items) {
    // Briefly highlight tiles whose value changed since the last render (signalling)
    const prev = container._prevStats || null, now = {};
    container.innerHTML = '';
    const ul = h('ul', { class: 'stats' });
    for (const it of items) {
      now[it.k] = it.v;
      const changed = prev && prev[it.k] !== undefined && prev[it.k] !== it.v;
      const li = h('li', { class: 'stat' + (changed ? ' changed' : '') }, [h('span', { class: 'k', text: it.k }), h('span', { class: 'v', text: it.v })]);
      if (changed) setTimeout(() => li.classList.remove('changed'), 1400);
      ul.appendChild(li);
    }
    container._prevStats = now;
    container.appendChild(ul);
  }

  // A collapsed panel for advanced controls (progressive disclosure)
  function more(label) {
    const d = h('details', { class: 'more-settings' }, [h('summary', { text: label || 'More settings' })]);
    const body = h('div', { class: 'more-body' }); d.appendChild(body);
    return { el: d, body };
  }

  /**
   * Guided tour: a short sequence of predict-then-check steps.
   * steps: [{ title, text (HTML allowed), question, options: [..], answer: index, explain (HTML allowed) }]
   * A step without a question is an instruction only.
   */
  /** Read a setting from the page address, e.g. ?scenario=suppression (used by links from the book). */
  function param(name) {
    try { return new URLSearchParams(global.location.search).get(name); } catch (e) { return null; }
  }

  function guide(container, steps, opts) {
    opts = opts || {};
    let i = 0, finished = false;
    const startAt = parseInt(param('step'), 10);
    if (startAt >= 1 && startAt <= steps.length) i = startAt - 1;
    const id = nextId('guide');
    const sec = h('section', { class: 'guide panel', 'aria-labelledby': id + '-h' });
    const head = h('div', { class: 'guide-head' }, [h('h2', { id: id + '-h', text: opts.title || 'Guided tour: start here' }), h('span', { class: 'small', id: id + '-pos' })]);
    const body = h('div', { class: 'guide-body' });
    const nav = h('div', { class: 'btn-row' });
    const prevB = button('Previous step', () => { if (finished) { restart(); return; } if (i > 0) { i--; show(true); } }, 'secondary');
    const nextB = button('Next step', () => { if (i < steps.length - 1) { i++; show(true); } else finish(); });
    nav.append(prevB, nextB);
    sec.append(head, body, nav);
    container.appendChild(sec);
    function finish() {
      body.innerHTML = '';
      body.appendChild(h('p', { html: opts.done || 'That is the end of the guided tour. Now explore freely: change one setting at a time and predict what will happen before you look.' }));
      sec.querySelector('#' + id + '-pos').textContent = 'Finished';
      finished = true; nextB.hidden = true; prevB.disabled = false; prevB.textContent = 'Back to the steps';
    }
    function restart() { finished = false; i = 0; nextB.hidden = false; prevB.textContent = 'Previous step'; show(true); }
    function show(focus) {
      const st = steps[i];
      sec.querySelector('#' + id + '-pos').textContent = `Step ${i + 1} of ${steps.length}`;
      body.innerHTML = '';
      const t = h('h3', { tabindex: '-1', text: st.title || `Step ${i + 1}` });
      body.append(t, h('p', { html: st.text }));
      if (st.question) {
        const name = id + '-q' + i;
        const fs = h('fieldset', null, [h('legend', { text: st.question })]);
        st.options.forEach((o, k) => {
          const oid = name + '-' + k;
          fs.appendChild(h('div', { class: 'check' }, [h('input', { type: 'radio', name, id: oid, value: String(k) }), h('label', { for: oid, text: o })]));
        });
        const fb = h('div', { role: 'status', class: 'guide-feedback' });
        const check = button('Check my prediction', () => {
          const sel = fs.querySelector('input:checked');
          fb.innerHTML = '';
          if (!sel) { fb.appendChild(h('p', { class: 'error-text', text: 'Choose an answer first.' })); return; }
          const ok = +sel.value === st.answer;
          fb.appendChild(h('div', { class: 'callout ' + (ok ? '' : 'warn') }, [h('p', { html: `<strong>${ok ? 'Yes.' : 'Not quite.'}</strong> ${st.explain}` })]));
        }, 'secondary');
        body.append(fs, h('div', { class: 'btn-row' }, [check]), fb);
      }
      prevB.disabled = i === 0;
      nextB.textContent = i === steps.length - 1 ? 'Finish the tour' : 'Next step';
      if (focus) t.focus();
    }
    show(false);
    return sec;
  }

  /**
   * Accessible table. opts: caption, head (array of header labels), rows (array of arrays),
   * rowHeader (bool: first cell of each row is a row header), cellClass(r,c,value) -> class, cellStyle(r,c)->style
   */
  function table(container, opts) {
    container.innerHTML = '';
    const wrap = h('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': opts.caption || 'Table' });
    const t = h('table');
    if (opts.caption) t.appendChild(h('caption', { text: opts.caption }));
    if (opts.head) {
      const tr = h('tr');
      opts.head.forEach((c, i) => {
        const th = h('th', { scope: 'col', class: ((i === 0 && opts.rowHeader) || (opts.leftCols && opts.leftCols.includes(i))) ? 'left' : null, text: c });
        if (c === '') th.appendChild(h('span', { class: 'sr-only', text: opts.cornerLabel || 'Variable' }));
        tr.appendChild(th);
      });
      t.appendChild(h('thead', null, tr));
    }
    const tb = h('tbody');
    opts.rows.forEach((row, r) => {
      const tr = h('tr');
      row.forEach((cell, c) => {
        const isRH = opts.rowHeader && c === 0;
        const node = h(isRH ? 'th' : 'td', { scope: isRH ? 'row' : null });
        if (cell instanceof Node) node.appendChild(cell); else node.textContent = cell;
        if (opts.leftCols && opts.leftCols.includes(c)) node.classList.add('left');
        if (opts.cellClass) { const cl = opts.cellClass(r, c, cell); if (cl) node.className += ' ' + cl; }
        if (opts.cellStyle) { const st = opts.cellStyle(r, c, cell); if (st) node.setAttribute('style', st); }
        if (opts.cellLabel) { const lb = opts.cellLabel(r, c, cell); if (lb) node.appendChild(h('span', { class: 'sr-only', text: ' ' + lb })); }
        tr.appendChild(node);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    container.appendChild(wrap);
    return t;
  }

  function badge(text, kind) { return h('span', { class: 'badge ' + (kind || ''), text }); }

  // Embedding: report height to the parent page and follow its theme
  function initApp() {
    live = document.getElementById('live');
    if (!live) { live = h('div', { id: 'live', class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' }); document.body.appendChild(live); }
    const embedded = window.parent && window.parent !== window;
    if (embedded) {
      document.body.classList.add('embedded');
      const post = () => window.parent.postMessage({ type: 'sem-app-height', height: document.documentElement.scrollHeight }, '*');
      if ('ResizeObserver' in window) new ResizeObserver(post).observe(document.body);
      window.addEventListener('load', post);
      window.parent.postMessage({ type: 'sem-app-ready' }, '*');
      // Links back to the book should replace the book page, not the iframe
      document.querySelectorAll('a[data-book-link]').forEach(a => a.setAttribute('target', '_top'));
    }
    // Opened from a link with settings (e.g. from a Going further page): the page that sent the student
    // has its own log questions, so mark the app's questions as optional extras
    if (!embedded && global.location && global.location.search) {
      const qh = document.getElementById('q-h');
      if (qh) {
        qh.textContent = 'Optional questions';
        const note = h('p', { class: 'small', text: 'The page that linked here has its own questions for your SEM log. These are extra, if you want to go further.' });
        qh.after(note);
      }
    }
    // Charts are drawn to fit their container, so ask apps to redraw when the width changes
    let lastW = window.innerWidth;
    window.addEventListener('resize', debounce(() => {
      if (Math.abs(window.innerWidth - lastW) < 8) return;
      lastW = window.innerWidth; document.dispatchEvent(new CustomEvent('appresize'));
    }, 200));
    window.addEventListener('message', ev => {
      const d = ev.data;
      if (d && d.type === 'sem-theme' && (d.theme === 'dark' || d.theme === 'light')) {
        document.documentElement.setAttribute('data-theme', d.theme);
        document.dispatchEvent(new CustomEvent('themechange'));
      }
    });
  }

  global.UI = { param, h, debounce, announce, announceNow, slider, select, number, checkbox, button, stats, table, badge, initApp, nextId, guide, more };
})(window);
