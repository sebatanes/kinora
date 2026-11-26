(() => {
  'use strict';
  if (window.__estudio) return;

  const real = {
    raf: window.requestAnimationFrame.bind(window),
    caf: window.cancelAnimationFrame.bind(window),
    perfNow: performance.now.bind(performance),
    dateNow: Date.now,
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
  };

  // Virtual clock: runs at real speed until the editor takes control, then only moves when asked.
  const clock = { now: real.perfNow(), controlled: false, origin: 0, lastReal: real.perfNow() };
  const rafQ = new Map();
  const timers = new Map();
  let rafSeq = 0, timerSeq = 0;
  const dateBase = real.dateNow() - real.perfNow();

  performance.now = () => clock.now;
  Date.now = () => Math.floor(dateBase + clock.now);
  window.requestAnimationFrame = cb => { const id = ++rafSeq; rafQ.set(id, cb); return id; };
  window.cancelAnimationFrame = id => { rafQ.delete(id); };
  window.setTimeout = (cb, ms = 0, ...a) => { const id = ++timerSeq; timers.set(id, { cb, at: clock.now + Math.max(0, +ms || 0), a }); return id; };
  window.clearTimeout = id => { timers.delete(id); };
  window.setInterval = (cb, ms = 0, ...a) => { const id = ++timerSeq; const every = Math.max(1, +ms || 0); timers.set(id, { cb, at: clock.now + every, every, a }); return id; };
  window.clearInterval = id => { timers.delete(id); };

  function runTimers() {
    for (let guard = 0; guard < 10000; guard++) {
      let next = null;
      for (const [id, tm] of timers) if (tm.at <= clock.now && (!next || tm.at < next[1].at)) next = [id, tm];
      if (!next) return;
      const [id, tm] = next;
      if (tm.every) tm.at += tm.every; else timers.delete(id);
      try { typeof tm.cb === 'function' ? tm.cb(...tm.a) : (0, eval)(tm.cb); } catch (e) { console.error(e); }
    }
  }
  function runRaf() {
    const q = [...rafQ.values()]; rafQ.clear();
    for (const cb of q) { try { cb(clock.now); } catch (e) { console.error(e); } }
  }
  function step(ms) { clock.now += ms; runTimers(); runRaf(); }
  function pump() {
    const r = real.perfNow();
    if (!clock.controlled) step(r - clock.lastReal);
    clock.lastReal = r;
    real.raf(pump);
  }
  real.raf(pump);

  // Canvas instrumentation: while recording, every draw call is logged with its box and the project call stack.
  const P = CanvasRenderingContext2D.prototype;
  const orig = {};
  for (const k of ['fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'drawImage', 'fill', 'stroke', 'putImageData',
    'beginPath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'closePath', 'getTransform', 'measureText']) orig[k] = P[k];
  const P2 = window.Path2D && Path2D.prototype;
  const origPath = {};
  if (P2) for (const k of ['moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect']) origPath[k] = P2[k];

  let recording = false;
  let isolate = null;
  const skip = () => {
    const k = isolate.key;
    const has = k.startsWith('fn:') ? stack().some(f => `fn:${f.file}:${f.fn}` === k) : stack().some(f => `${f.file}:${f.line}:${f.col}` === k);
    return isolate.mode === 'only' ? !has : has;
  };
  const canvasOps = new WeakMap();
  const pathBox = new WeakMap();
  const path2dBox = new WeakMap();
  const here = location.href.split('#')[0].split('?')[0];
  const base = here.slice(0, here.lastIndexOf('/') + 1);

  // Each inspection is a generation: a canvas drawn into again starts a fresh list, so ops never pile up across frames.
  let gen = 0;
  const opsOf = c => { let l = canvasOps.get(c); if (!l || l.gen !== gen) { l = []; l.gen = gen; canvasOps.set(c, l); } return l; };
  const emptyBox = () => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const grow = (b, x, y) => { if (x < b.x0) b.x0 = x; if (y < b.y0) b.y0 = y; if (x > b.x1) b.x1 = x; if (y > b.y1) b.y1 = y; };
  const hasBox = b => b && b.x1 >= b.x0 && b.y1 >= b.y0;

  function addPt(ctx, x, y, r = 0) {
    let b = pathBox.get(ctx); if (!b) { b = emptyBox(); pathBox.set(ctx, b); }
    const m = orig.getTransform.call(ctx);
    for (const [dx, dy] of r ? [[-r, -r], [r, -r], [r, r], [-r, r]] : [[0, 0]]) {
      const px = x + dx, py = y + dy;
      grow(b, m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f);
    }
  }
  function rectBox(ctx, x, y, w, h) {
    const m = orig.getTransform.call(ctx); const b = emptyBox();
    for (const [px, py] of [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]) grow(b, m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f);
    return b;
  }

  Error.stackTraceLimit = 60;
  function stack() {
    const lines = (new Error().stack || '').split('\n').slice(1);
    const frames = [];
    for (const l of lines) {
      const m = l.match(/^\s*at (?:async )?(?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/);
      if (!m) continue;
      const url = m[2];
      if (url.includes('/__estudio/') || !url.startsWith(base)) continue;
      frames.push({ fn: (m[1] || '(anonymous)').replace(/^Object\./, '').replace(/^window\./, ''), file: url.slice(base.length).split('?')[0], line: +m[3], col: +m[4] });
    }
    return frames;
  }
  const colorOf = v => typeof v === 'string' ? v : v && v.constructor ? v.constructor.name : String(v);

  function record(ctx, kind, box, extra) {
    if (!hasBox(box) || ctx.globalAlpha === 0) return;
    const c = ctx.canvas;
    const cw = c.width, ch = c.height;
    const clipped = { x0: Math.max(0, box.x0), y0: Math.max(0, box.y0), x1: Math.min(cw, box.x1), y1: Math.min(ch, box.y1) };
    if (!hasBox(clipped)) return;
    opsOf(c).push({ kind, box: clipped, stack: stack(), alpha: ctx.globalAlpha, blend: ctx.globalCompositeOperation, ...extra });
  }

  const wrapPath = name => function (...a) {
    if (recording) {
      if (name === 'arc') addPt(this, a[0], a[1], a[2]);
      else if (name === 'ellipse') addPt(this, a[0], a[1], Math.max(a[2], a[3]));
      else if (name === 'rect' || name === 'roundRect') { addPt(this, a[0], a[1]); addPt(this, a[0] + a[2], a[1] + a[3]); }
      else if (name === 'arcTo') { addPt(this, a[0], a[1]); addPt(this, a[2], a[3]); }
      else for (let i = 0; i + 1 < a.length; i += 2) addPt(this, a[i], a[i + 1]);
    }
    return orig[name].apply(this, a);
  };
  for (const k of ['moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect']) P[k] = wrapPath(k);
  P.beginPath = function () { if (recording) pathBox.set(this, emptyBox()); return orig.beginPath.call(this); };

  if (P2) {
    const wrap2 = name => function (...a) {
      let b = path2dBox.get(this); if (!b) { b = emptyBox(); path2dBox.set(this, b); }
      if (name === 'arc') { grow(b, a[0] - a[2], a[1] - a[2]); grow(b, a[0] + a[2], a[1] + a[2]); }
      else if (name === 'ellipse') { const r = Math.max(a[2], a[3]); grow(b, a[0] - r, a[1] - r); grow(b, a[0] + r, a[1] + r); }
      else if (name === 'rect' || name === 'roundRect') { grow(b, a[0], a[1]); grow(b, a[0] + a[2], a[1] + a[3]); }
      else for (let i = 0; i + 1 < a.length; i += 2) grow(b, a[i], a[i + 1]);
      return origPath[name].apply(this, a);
    };
    for (const k of Object.keys(origPath)) if (origPath[k]) P2[k] = wrap2(k);
  }

  function pathOrArg(ctx, a) {
    if (P2 && a[0] instanceof Path2D) {
      const pb = path2dBox.get(a[0]);
      return pb && hasBox(pb) ? rectBox(ctx, pb.x0, pb.y0, pb.x1 - pb.x0, pb.y1 - pb.y0) : null;
    }
    const b = pathBox.get(ctx);
    return b ? { ...b } : null;
  }
  P.fill = function (...a) {
    if (recording) record(this, 'relleno', pathOrArg(this, a), { color: colorOf(this.fillStyle) });
    if (isolate && skip()) return;
    return orig.fill.apply(this, a);
  };
  P.stroke = function (...a) {
    if (recording) {
      const b = pathOrArg(this, a);
      if (b) { const m = orig.getTransform.call(this); const w = this.lineWidth * Math.hypot(m.a, m.b) / 2; b.x0 -= w; b.y0 -= w; b.x1 += w; b.y1 += w; }
      record(this, 'trazo', b, { color: colorOf(this.strokeStyle), ancho: this.lineWidth });
    }
    if (isolate && skip()) return;
    return orig.stroke.apply(this, a);
  };
  P.fillRect = function (x, y, w, h) {
    if (recording) {
      const b = rectBox(this, x, y, w, h);
      record(this, 'rectángulo', b, { color: colorOf(this.fillStyle) });
    }
    if (isolate && skip()) return;
    return orig.fillRect.call(this, x, y, w, h);
  };
  P.strokeRect = function (x, y, w, h) {
    if (recording) record(this, 'trazo', rectBox(this, x, y, w, h), { color: colorOf(this.strokeStyle) });
    if (isolate && skip()) return;
    return orig.strokeRect.call(this, x, y, w, h);
  };
  P.clearRect = function (x, y, w, h) {
    if (recording) {
      const b = rectBox(this, x, y, w, h);
      if (b.x0 <= 0 && b.y0 <= 0 && b.x1 >= this.canvas.width && b.y1 >= this.canvas.height) canvasOps.set(this.canvas, []);
    }
    return orig.clearRect.call(this, x, y, w, h);
  };
  function textBox(ctx, text, x, y) {
    const m = orig.measureText.call(ctx, text);
    const l = m.actualBoundingBoxLeft || 0, r = m.actualBoundingBoxRight || m.width;
    const up = m.actualBoundingBoxAscent || 0, down = m.actualBoundingBoxDescent || 0;
    return rectBox(ctx, x - l, y - up, l + r, up + down);
  }
  P.fillText = function (text, x, y, ...rest) {
    if (recording) record(this, 'texto', textBox(this, String(text), x, y), { texto: String(text), fuente: this.font, color: colorOf(this.fillStyle) });
    if (isolate && skip()) return;
    return orig.fillText.call(this, text, x, y, ...rest);
  };
  P.strokeText = function (text, x, y, ...rest) {
    if (recording) record(this, 'texto', textBox(this, String(text), x, y), { texto: String(text), fuente: this.font, color: colorOf(this.strokeStyle) });
    if (isolate && skip()) return;
    return orig.strokeText.call(this, text, x, y, ...rest);
  };
  const srcName = img => {
    if (img instanceof HTMLImageElement) return (img.currentSrc || img.src || '').replace(base, '');
    if (img instanceof HTMLVideoElement) return (img.currentSrc || img.src || '').replace(base, '');
    if (img instanceof HTMLCanvasElement) return 'capa';
    return img && img.constructor ? img.constructor.name : 'imagen';
  };
  P.drawImage = function (img, ...a) {
    if (recording) {
      const iw = img.naturalWidth || img.videoWidth || img.width, ih = img.naturalHeight || img.videoHeight || img.height;
      let sx = 0, sy = 0, sw = iw, sh = ih, dx, dy, dw, dh;
      if (a.length === 2) [dx, dy, dw, dh] = [a[0], a[1], iw, ih];
      else if (a.length === 4) [dx, dy, dw, dh] = a;
      else[sx, sy, sw, sh, dx, dy, dw, dh] = a;
      const b = rectBox(this, dx, dy, dw, dh);
      const inner = img instanceof HTMLCanvasElement || (window.OffscreenCanvas && img instanceof OffscreenCanvas) ? canvasOps.get(img) : null;
      if (inner && inner.length) {
        const m = orig.getTransform.call(this);
        const kx = dw / sw, ky = dh / sh;
        const map = (x, y) => { const px = dx + (x - sx) * kx, py = dy + (y - sy) * ky; return [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f]; };
        const via = stack();
        const list = opsOf(this.canvas);
        for (const op of inner) {
          const nb = emptyBox();
          for (const [x, y] of [[op.box.x0, op.box.y0], [op.box.x1, op.box.y0], [op.box.x1, op.box.y1], [op.box.x0, op.box.y1]]) { const [X, Y] = map(x, y); grow(nb, X, Y); }
          nb.x0 = Math.max(nb.x0, b.x0, 0); nb.y0 = Math.max(nb.y0, b.y0, 0); nb.x1 = Math.min(nb.x1, b.x1, this.canvas.width); nb.y1 = Math.min(nb.y1, b.y1, this.canvas.height);
          if (hasBox(nb)) list.push({ ...op, box: nb, capa: via });
        }
      } else record(this, 'imagen', b, { src: srcName(img) });
    }
    if (isolate && !(img instanceof HTMLCanvasElement) && skip()) return;
    return orig.drawImage.call(this, img, ...a);
  };
  P.putImageData = function (data, x, y, ...rest) {
    if (recording) record(this, 'píxeles', rectBox(this, x, y, data.width, data.height), {});
    if (isolate && skip()) return;
    return orig.putImageData.call(this, data, x, y, ...rest);
  };

  const pageEval = src => { try { return (0, eval)(src); } catch { return undefined; } };
  function mainCanvas() {
    let best = null, area = 0;
    for (const c of document.querySelectorAll('canvas')) { const a = c.width * c.height; if (a > area) { best = c; area = a; } }
    return best;
  }
  function mode() {
    if (typeof window.renderFrame === 'function' && pageEval('typeof TL !== "undefined" && TL && TL.fps')) return 'opuscut';
    return 'libre';
  }
  function info() {
    const c = mainCanvas();
    if (mode() === 'opuscut') {
      const TL = pageEval('TL');
      return { modo: 'opuscut', fps: TL.fps, duracion: TL.beats * 60 / TL.bpm, ancho: TL.width, alto: TL.height, bpm: TL.bpm, beats: TL.beats, compas: TL.beats_per_bar || 4 };
    }
    const fps = 30;
    return { modo: 'libre', fps, duracion: +(new URLSearchParams(location.search).get('__dur')) || 20, ancho: c ? c.width : innerWidth, alto: c ? c.height : innerHeight };
  }

  let fast = false, savedBlur = null;
  function setFast(on) {
    if (mode() !== 'opuscut' || on === fast) return;
    const TL = pageEval('TL');
    if (on) { savedBlur = TL.blur; TL.blur = null; } else TL.blur = savedBlur;
    fast = on;
  }

  let rendering = Promise.resolve();
  let libreT = 0;
  async function seek(t) {
    const m = mode();
    if (m === 'opuscut') {
      const TL = pageEval('TL');
      const n = Math.max(0, Math.min(Math.round(t * TL.fps), Math.round(TL.beats * 60 / TL.bpm * TL.fps) - 1));
      await (rendering = rendering.then(() => window.renderFrame(n, 'none')).catch(e => console.error(e)));
      return { n, t: n / TL.fps };
    }
    if (!clock.controlled) { clock.controlled = true; clock.origin = clock.now; libreT = 0; }
    if (t < libreT - 1e-6) return { recargar: true };
    const dt = 1000 / 30;
    while (libreT + 1e-6 < t) { const s = Math.min(dt, (t - libreT) * 1000); step(s); libreT += s / 1000; }
    return { t: libreT };
  }

  async function inspect(t) {
    const TL = mode() === 'opuscut' ? pageEval('TL') : null;
    const blur = TL ? TL.blur : null;
    if (TL) TL.blur = null;
    recording = true;
    gen++;
    try {
      canvasOps.set(mainCanvas(), []);
      for (const c of document.querySelectorAll('canvas')) canvasOps.set(c, []);
      if (TL) {
        const n = Math.round(t * TL.fps);
        await (rendering = rendering.then(() => window.renderFrame(n, 'none')));
      } else step(0.0001);
    } finally {
      recording = false;
      if (TL) TL.blur = fast ? null : blur;
    }
    const c = mainCanvas();
    const ops = (canvasOps.get(c) || []).map((op, i) => ({ i, ...op, box: { x: Math.round(op.box.x0), y: Math.round(op.box.y0), w: Math.round(op.box.x1 - op.box.x0), h: Math.round(op.box.y1 - op.box.y0) } }));
    if (TL && fast) await seek(t);
    else if (TL) await seek(t);
    return { ancho: c.width, alto: c.height, ops };
  }

  function capture(type = 'image/png', q = 0.92) {
    const c = mainCanvas();
    return c ? c.toDataURL(type, q) : null;
  }

  // The element alone is the difference between the frame with it and without it.
  async function isolated(t, key) {
    const TL = mode() === 'opuscut' ? pageEval('TL') : null;
    if (!TL) return null;
    const blur = TL.blur; TL.blur = null;
    const c = mainCanvas();
    const n = Math.round(t * TL.fps);
    const grab = () => { const k = document.createElement('canvas'); k.width = c.width; k.height = c.height; const g = k.getContext('2d'); orig.drawImage.call(g, c, 0, 0); return { k, d: g.getImageData(0, 0, k.width, k.height) }; };
    let without, full;
    try {
      isolate = { key, mode: 'without' };
      try { await (rendering = rendering.then(() => window.renderFrame(n, 'none'))); } finally { isolate = null; }
      without = grab();
      await (rendering = rendering.then(() => window.renderFrame(n, 'none')));
      full = grab();
    } finally { TL.blur = fast ? null : blur; }
    const a = without.d.data, f = full.d.data;
    for (let i = 0; i < f.length; i += 4) {
      const diff = Math.max(Math.abs(f[i] - a[i]), Math.abs(f[i + 1] - a[i + 1]), Math.abs(f[i + 2] - a[i + 2]));
      f[i + 3] = diff < 6 ? 0 : Math.min(255, diff * 12);
    }
    full.k.getContext('2d').putImageData(full.d, 0, 0);
    await seek(t);
    return { without: without.k.toDataURL('image/jpeg', 0.92), only: full.k.toDataURL('image/png') };
  }
  const mode_ = () => mode();

  window.__estudio = { info, seek, inspect, capture, setFast, mode, isolated, ready: () => typeof window.renderFrame === 'function' ? window.__ready === true : document.readyState === 'complete' };
})();
