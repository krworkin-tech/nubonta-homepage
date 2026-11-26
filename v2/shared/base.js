/* Nubonta shared behaviour: reveals, parallax, video controls, lattice texture.
   Plain JS + GSAP/ScrollTrigger (loaded with defer). Everything degrades to a static page. */
(function () {
  var NB = (window.NB = window.NB || {});
  NB.RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  NB.gsap = function () { return window.gsap && window.ScrollTrigger ? window.gsap : null; };

  /* ---- lattice: seeded jittered grid joined by slightly curved struts (trabecular bone) ---- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  NB.lattice = function (el, seed) {
    var w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
    var cell = 48, rand = rng(seed || 7), cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1, pts = [], i, j;
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) pts.push({ x: i * cell + (rand() - 0.5) * cell * 0.7, y: j * cell + (rand() - 0.5) * cell * 0.7, i: i, j: j });
    var at = function (a, b) { return (a >= 0 && b >= 0 && a < cols && b < rows) ? pts[b * cols + a] : null; };
    var d = '', dots = '', links = [[1, 0], [0, 1], [1, 1], [-1, 1]];
    pts.forEach(function (p) {
      links.forEach(function (l) {
        var q = at(p.i + l[0], p.j + l[1]); if (!q || rand() < 0.35) return;
        var mx = (p.x + q.x) / 2 + (rand() - 0.5) * 14, my = (p.y + q.y) / 2 + (rand() - 0.5) * 14;
        d += 'M' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + 'Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + q.x.toFixed(1) + ' ' + q.y.toFixed(1);
      });
      if (rand() < 0.28) dots += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (1.5 + rand() * 1.5).toFixed(1) + '"/>';
    });
    el.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><g fill="currentColor">' + dots + '</g></svg>';
  };
  function lattices() { [].forEach.call(document.querySelectorAll('.lattice'), function (el, k) { NB.lattice(el, 7 + k * 13); }); }

  /* ---- video controls (WCAG 2.2.2: autoplaying motion can be paused) ---- */
  function videos() {
    [].forEach.call(document.querySelectorAll('[data-nb-video]'), function (wrap) {
      var v = wrap.querySelector('video'), btn = wrap.querySelector('.video-toggle'); if (!v) return;
      function sync() { if (!btn) return; var playing = !v.paused && !v.ended; btn.setAttribute('aria-label', playing ? 'Pause video' : 'Play video'); btn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-' + (playing ? 'pause' : 'play') + '"/></svg>'; }
      if (NB.RM) { v.removeAttribute('autoplay'); v.pause(); try { v.currentTime = 0; } catch (e) {} }
      ['play', 'pause', 'ended'].forEach(function (ev) { v.addEventListener(ev, sync); });
      if (btn) btn.addEventListener('click', function () { if (v.paused || v.ended) { if (v.ended) v.currentTime = 0; v.play(); } else { v.pause(); } });
      sync();
    });
  }

  /* ---- scroll reveals + parallax ---- */
  function reveals(g) {
    var els = [].slice.call(document.querySelectorAll('[data-reveal]')); if (!els.length) return;
    g.registerPlugin(window.ScrollTrigger);
    window.ScrollTrigger.batch(els, {
      start: 'top 88%', once: true,
      onEnter: function (batch) { g.to(batch, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08, overwrite: true }); }
    });
  }
  function parallax(g) {
    [].forEach.call(document.querySelectorAll('.parallax'), function (box) {
      var img = box.querySelector('img'); if (!img) return;
      var amt = parseFloat(box.getAttribute('data-parallax') || '8');
      g.fromTo(img, { yPercent: -amt / 2 }, { yPercent: amt / 2, ease: 'none', scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  /* ---- image-sequence player for scroll-scrubbed 3D (Apple-style canvas) ----
     NB.sequence(canvas, { path: '../shared/media/seq/tub/', count: 90, fit: 'contain' }) -> { set(frameFloat) } */
  NB.sequence = function (canvas, opts) {
    var ctx = canvas.getContext('2d'), n = opts.count, imgs = [], api = { frame: opts.start || 0 };
    function src(i) { var m = window.NB_SEQ && window.NB_SEQ[opts.path]; return m ? m[i] : opts.path + String(i + 1).padStart(4, '0') + '.webp'; }   /* NB_SEQ: inlined frames in standalone exports */
    function size() { var r = canvas.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.max(1, Math.round(r.width * d)); canvas.height = Math.max(1, Math.round(r.height * d)); }
    function pick(i) { if (imgs[i] && imgs[i].naturalWidth) return imgs[i]; for (var k = 1; k < n; k++) { if (imgs[i - k] && imgs[i - k].naturalWidth) return imgs[i - k]; if (imgs[i + k] && imgs[i + k].naturalWidth) return imgs[i + k]; } return null; }
    function draw() {
      var i = Math.max(0, Math.min(n - 1, Math.round(api.frame))), img = pick(i); if (!img) return;
      var cw = canvas.width, ch = canvas.height, iw = img.naturalWidth, ih = img.naturalHeight;
      var s = (opts.fit === 'contain' ? Math.min(cw / iw, ch / ih) : Math.max(cw / iw, ch / ih)) * (opts.scale || 1), w = iw * s, h = ih * s;
      ctx.clearRect(0, 0, cw, ch); ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    }
    for (var i = 0; i < n; i++) { (function (k) { var im = new Image(); im.decoding = 'async'; im.onload = function () { if (Math.round(api.frame) === k || k === 0) draw(); }; imgs.push(im); })(i); }
    imgs[opts.start || 0].src = src(opts.start || 0);                     /* first frame first, then the rest */
    setTimeout(function () { imgs.forEach(function (im, k) { if (!im.src) im.src = src(k); }); }, 50);
    size(); window.addEventListener('resize', function () { size(); draw(); });
    api.set = function (f) { api.frame = f; draw(); };
    return api;
  };

  /* ---- count-up numbers: <span data-count="2000">2,000</span> (final value stays in the HTML for no-JS) ---- */
  function counters(g) {
    [].forEach.call(document.querySelectorAll('[data-count]'), function (el) {
      var end = parseFloat(el.getAttribute('data-count')), o = { v: 0 };
      el.textContent = '0';
      g.to(o, { v: end, duration: 1.4, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        onUpdate: function () { el.textContent = Math.round(o.v).toLocaleString('en-US'); } });
    });
  }
  /* ---- self-drawing lines: <path data-draw> ---- */
  function lines(g) {
    [].forEach.call(document.querySelectorAll('[data-draw]'), function (p) {
      var len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
      g.to(p, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: p, start: 'top 90%', once: true } });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    lattices(); videos();
    var g = NB.gsap();
    if (!g || NB.RM) { document.documentElement.classList.remove('motion'); return; }
    reveals(g); parallax(g); counters(g); lines(g);
    document.fonts && document.fonts.ready.then(function () { window.ScrollTrigger.refresh(); });
    window.addEventListener('load', function () { window.ScrollTrigger.refresh(); });
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(lattices, 150); });
  });
})();

/* ---- dropdowns (2026-11-26, user: one designed dropdown everywhere). Every <select> keeps its own trigger look and stays the real form
   field (value, validation, change events); with a mouse or keyboard it opens a Nubonta list instead of the browser's grey one.
   On touch screens the phone's own picker opens (it's what people expect there and it's the most accessible). ---- */
(function () {
  var dd, sel, opts, active = -1, typed = '', typedT;
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function list(s) { return [].filter.call(s.options, function (o) { return !(o.disabled && o.value === ''); }); }
  function place() {
    if (!dd || !sel) return;
    var r = sel.getBoundingClientRect(), h = dd.offsetHeight, below = innerHeight - r.bottom - 8;
    dd.style.minWidth = r.width + 'px';
    dd.style.left = Math.min(r.left, innerWidth - dd.offsetWidth - 8) + 'px';
    dd.style.top = (below < h && r.top - 8 > below ? r.top - h - 8 : r.bottom + 8) + 'px';
  }
  function setActive(i) {
    if (!opts.length) return;
    active = (i + opts.length) % opts.length;
    [].forEach.call(dd.children, function (li, k) { li.classList.toggle('is-active', k === active); });
    var li = dd.children[active]; li.scrollIntoView({ block: 'nearest' });
    dd.setAttribute('aria-activedescendant', li.id);
  }
  function open(s) {
    close(); sel = s; opts = list(s);
    dd = document.createElement('ul'); dd.className = 'nb-dd'; dd.setAttribute('role', 'listbox');
    var lab = s.labels && s.labels[0]; dd.setAttribute('aria-label', (lab ? lab.textContent : s.getAttribute('aria-label') || 'Options').replace('*', '').trim());
    opts.forEach(function (o, k) {
      var li = document.createElement('li'); li.className = 'nb-dd__opt'; li.id = 'nb-dd-' + k; li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', o.selected && o.value !== '' ? 'true' : 'false');
      li.innerHTML = '<span></span>' + CHECK; li.firstChild.textContent = o.textContent;
      li.addEventListener('mousedown', function (e) { e.preventDefault(); });
      li.addEventListener('click', function () { choose(k); });
      li.addEventListener('mousemove', function () { if (active !== k) setActive(k); });
      dd.appendChild(li);
    });
    document.body.appendChild(dd); place();
    s.setAttribute('aria-expanded', 'true');
    var cur = opts.indexOf(s.options[s.selectedIndex]); setActive(cur < 0 ? 0 : cur);
    requestAnimationFrame(function () { dd && dd.classList.add('is-open'); });
  }
  function close() {
    if (!dd) return;
    sel.setAttribute('aria-expanded', 'false'); dd.remove(); dd = null; sel = null; active = -1;
  }
  function choose(k) {
    var s = sel, o = opts[k]; if (!o || o.disabled) return;
    if (s.value !== o.value) { s.value = o.value; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }
    close(); s.focus();
  }
  var touchAt = 0;
  document.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') touchAt = Date.now(); }, true);
  document.addEventListener('mousedown', function (e) {
    if (Date.now() - touchAt < 800) return;   /* touch: leave the phone's own picker */
    var s = e.target.closest && e.target.closest('select');
    if (s && !s.multiple && !(s.size > 1) && !s.disabled) {
      e.preventDefault(); s.focus();
      if (sel === s) close(); else open(s);
      return;
    }
    if (dd && !dd.contains(e.target)) close();
  }, true);
  document.addEventListener('keydown', function (e) {
    var s = e.target.closest && e.target.closest('select');
    if (!dd) {
      if (s && !s.multiple && !s.disabled && (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); open(s); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(opts.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); var t = sel; close(); t.focus(); }
    else if (e.key === 'Tab') { close(); }
    else if (e.key.length === 1) {   /* type to jump */
      typed += e.key.toLowerCase(); clearTimeout(typedT); typedT = setTimeout(function () { typed = ''; }, 600);
      var hit = opts.findIndex(function (o) { return o.textContent.trim().toLowerCase().indexOf(typed) === 0; }); if (hit > -1) setActive(hit);
    }
  }, true);
  addEventListener('resize', close);
  addEventListener('scroll', function (e) { if (dd && !dd.contains(e.target)) close(); }, true);
})();
