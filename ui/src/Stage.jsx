import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';

const waitReady = (win, timeout = 60000) => new Promise((resolve, reject) => {
  const t0 = performance.now();
  const tick = () => {
    try {
      if (win.__estudio && win.__estudio.ready()) return resolve(win.__estudio);
    } catch { }
    if (performance.now() - t0 > timeout) return reject(new Error('The page did not finish loading.'));
    setTimeout(tick, 40);
  };
  tick();
});

let frameSeq = 0;

// Offscreen page used for thumbnails, so the main view is never disturbed.
export class Renderer {
  constructor(entry) {
    this.entry = entry; this.iframe = null; this.api = null; this.queue = Promise.resolve();
  }
  async open(stamp) {
    this.close();
    const f = document.createElement('iframe');
    Object.assign(f.style, { position: 'fixed', left: '-10000px', top: '0', width: '1920px', height: '1080px', border: '0', visibility: 'hidden', pointerEvents: 'none' });
    f.src = `/proyecto/${this.entry}?r=${stamp}`;
    document.body.appendChild(f);
    this.iframe = f;
    await new Promise(r => f.addEventListener('load', r, { once: true }));
    this.api = await waitReady(f.contentWindow);
    const info = this.api.info();
    f.style.width = info.ancho + 'px'; f.style.height = info.alto + 'px';
    this.api.setFast(true);
    return info;
  }
  frame(t, width = 320) {
    return (this.queue = this.queue.then(async () => {
      if (!this.api) return null;
      await this.api.seek(t);
      const src = this.iframe.contentWindow.document.querySelector('canvas');
      if (!src) return null;
      const c = document.createElement('canvas');
      c.width = width; c.height = Math.round(width * src.height / src.width);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      return c;
    }).catch(() => null));
  }
  inspect(t) { return (this.queue = this.queue.then(() => this.api ? this.api.inspect(t) : null).catch(() => null)); }
  isolated(t, key) { return (this.queue = this.queue.then(() => this.api ? this.api.isolated(t, key) : null).catch(() => null)); }
  close() { if (this.iframe) this.iframe.remove(); this.iframe = null; this.api = null; }
}

const Stage = forwardRef(function Stage({ entry, stamp, onInfo, onLoading, children, overlay, factor = 1, pad = 28 }, ref) {
  const wrap = useRef(null);
  const [frames, setFrames] = useState([]);
  const active = useRef(null);
  const infoRef = useRef(null);
  const tRef = useRef(0);
  const busy = useRef(false);
  const want = useRef(null);
  const fastRef = useRef(false);
  const [box, setBox] = useState({ scale: 1, left: 0, top: 0, w: 1920, h: 1080 });

  const layout = useCallback(() => {
    const el = wrap.current; const info = infoRef.current;
    if (!el || !info) return;
    const r = el.getBoundingClientRect();
    const scale = Math.max(0.02, Math.min((r.width - pad * 2) / info.ancho, (r.height - pad * 2) / info.alto) * factor);
    const w = info.ancho * scale, h = info.alto * scale;
    setBox({ scale, left: (r.width - w) / 2, top: (r.height - h) / 2, w, h });
  }, [factor, pad]);

  useLayoutEffect(() => {
    const ro = new ResizeObserver(layout);
    if (wrap.current) ro.observe(wrap.current);
    layout();
    return () => ro.disconnect();
  }, [layout]);

  useEffect(() => {
    if (!entry) return;
    const key = ++frameSeq;
    onLoading?.(true);
    setFrames(list => [...list.filter(f => f.state !== 'cargando'), { key, src: `/proyecto/${entry}?v=${stamp}`, state: 'cargando' }]);
  }, [entry, stamp]);

  const doSeek = useCallback(async t => {
    const api = active.current?.api;
    if (!api) return;
    want.current = t;
    if (busy.current) return;
    busy.current = true;
    try {
      while (want.current != null) {
        const next = want.current; want.current = null;
        const r = await api.seek(next);
        if (r && r.recargar) { setFrames(list => list.map(f => f)); }
      }
    } finally { busy.current = false; }
  }, []);

  const onFrameLoad = useCallback(async (key, el) => {
    try {
      const api = await waitReady(el.contentWindow);
      const info = api.info();
      if (fastRef.current) api.setFast(true);
      await api.seek(tRef.current);
      infoRef.current = info;
      active.current = { key, el, api };
      setFrames(list => list.filter(f => f.key >= key).map(f => f.key === key ? { ...f, state: 'activo' } : f));
      layout();
      onInfo?.(info);
    } catch (e) {
      console.error(e);
      setFrames(list => list.map(f => f.key === key ? { ...f, state: 'error', error: e.message } : f));
    } finally {
      onLoading?.(false);
    }
  }, [layout, onInfo, onLoading]);

  useImperativeHandle(ref, () => ({
    seek(t) { tRef.current = t; return doSeek(t); },
    async inspect(t) {
      const api = active.current?.api; if (!api) return null;
      while (busy.current) await new Promise(r => setTimeout(r, 5));
      busy.current = true;
      try { return await api.inspect(t); } finally { busy.current = false; }
    },
    async capture(t, { type = 'image/png', quality = 0.92, width } = {}) {
      const a = active.current; if (!a) return null;
      if (t != null) { tRef.current = t; while (busy.current) await new Promise(r => setTimeout(r, 5)); busy.current = true; try { await a.api.seek(t); } finally { busy.current = false; } }
      const src = a.el.contentWindow.document.querySelector('canvas');
      if (!width || width >= src.width) return a.api.capture(type, quality);
      const c = document.createElement('canvas');
      c.width = width; c.height = Math.round(width * src.height / src.width);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL(type, quality);
    },
    async isolated(t, key) {
      const api = active.current?.api; if (!api?.isolated) return null;
      while (busy.current) await new Promise(r => setTimeout(r, 5));
      busy.current = true;
      try { return await api.isolated(t, key); } finally { busy.current = false; }
    },
    canvas() { return active.current?.el.contentWindow.document.querySelector('canvas') || null; },
    setFast(on) { fastRef.current = on; active.current?.api.setFast(on); },
    info() { return infoRef.current; },
    box() { return box; },
    toCanvas(clientX, clientY) {
      const r = wrap.current.getBoundingClientRect();
      return { x: (clientX - r.left - box.left) / box.scale, y: (clientY - r.top - box.top) / box.scale };
    },
  }), [box, doSeek]);

  const info = infoRef.current || { ancho: 1920, alto: 1080 };
  return (
    <div className="stage" ref={wrap}>
      {frames.map(f => (
        <iframe
          key={f.key}
          title="video"
          src={f.src}
          className={`stage-frame ${f.state}`}
          style={{ width: info.ancho, height: info.alto, left: box.left, top: box.top, transform: `scale(${box.scale})` }}
          onLoad={e => onFrameLoad(f.key, e.currentTarget)}
        />
      ))}
      {frames.some(f => f.state === 'error') && (
        <div className="stage-error">{frames.find(f => f.state === 'error').error}</div>
      )}
      <div className="stage-overlay" style={{ left: box.left, top: box.top, width: box.w, height: box.h }}>
        {overlay?.(box.scale)}
      </div>
      {children}
    </div>
  );
});

export default Stage;
