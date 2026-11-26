export async function api(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: body instanceof Blob || body instanceof ArrayBuffer ? headers : { 'content-type': 'application/json', ...headers },
    body: body == null ? undefined : body instanceof Blob || body instanceof ArrayBuffer ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export function connect(onMessage) {
  let ws, closed = false;
  const open = () => {
    ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onmessage = e => { try { onMessage(JSON.parse(e.data), ws); } catch (err) { console.error(err); } };
    ws.onclose = () => { if (!closed) setTimeout(open, 800); };
  };
  open();
  return {
    send: msg => ws && ws.readyState === 1 && ws.send(JSON.stringify(msg)),
    close: () => { closed = true; ws && ws.close(); },
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function tc(t, fps = 30) {
  if (!Number.isFinite(t)) t = 0;
  const m = Math.floor(t / 60), s = Math.floor(t % 60), f = Math.floor((t % 1) * fps + 1e-6);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}
export const secs = t => `${t.toFixed(2)} s`;

// Literals in one line of code: numbers, strings and colors, with their column.
const TOKEN = /(\/\/.*$)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|((?<![\w$.#])(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?![\w$]))/gi;
export function literals(line) {
  const out = [];
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line))) {
    if (m[1]) break;
    if (m[2]) {
      const inner = m[2].slice(1, -1);
      const kind = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(inner) ? 'color' : /^rgba?\(/i.test(inner) ? 'rgba' : 'texto';
      out.push({ kind, col: m.index, text: m[2], value: inner, quote: m[2][0] });
    } else if (m[3]) {
      out.push({ kind: 'numero', col: m.index, text: m[3], value: parseFloat(m[3]) });
    }
  }
  return out;
}

export function formatNumber(v, like) {
  const dec = like.includes('.') ? Math.max(1, like.split('.')[1].length) : 0;
  const s = v.toFixed(dec);
  return dec ? s : String(Math.round(v));
}

export function step(like, fine) {
  const dec = like.includes('.') ? like.split('.')[1].length : 0;
  const base = dec ? 10 ** -dec : 1;
  return fine ? base / 10 : base;
}

export const frameKey = f => f ? `${f.file}:${f.line}:${f.col}` : '';

export function chainOf(op) {
  if (!op) return [];
  const frames = [...op.stack];
  if (op.capa) for (const f of op.capa) if (!frames.some(g => frameKey(g) === frameKey(f))) frames.push(f);
  return frames.map((f, i) => ({ ...f, caller: frames[i + 1] || null, depth: i }));
}

export function groupBox(ops, key) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
  for (const op of ops) {
    const all = [...op.stack, ...(op.capa || [])];
    if (!all.some(f => frameKey(f) === key)) continue;
    n++;
    x0 = Math.min(x0, op.box.x); y0 = Math.min(y0, op.box.y);
    x1 = Math.max(x1, op.box.x + op.box.w); y1 = Math.max(y1, op.box.y + op.box.h);
  }
  return n ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0, n } : null;
}

export function hit(ops, x, y, W, H) {
  const under = ops.filter(o => x >= o.box.x && x <= o.box.x + o.box.w && y >= o.box.y && y <= o.box.y + o.box.h);
  under.sort((a, b) => b.i - a.i);
  const small = under.filter(o => o.box.w * o.box.h < W * H * 0.85);
  return small.length ? [...small, ...under.filter(o => !small.includes(o))] : under;
}

export function describeOp(op) {
  if (!op) return '';
  if (op.kind === 'texto') return `Text “${op.texto}”`;
  if (op.kind === 'imagen') return `Image ${op.src ? op.src.split('/').pop() : ''}`;
  if (op.kind === 'rectángulo') return 'Rectangle';
  if (op.kind === 'relleno') return 'Shape';
  if (op.kind === 'trazo') return 'Stroke';
  return op.kind;
}

export class Sound {
  constructor() {
    this.ctx = null; this.buffers = {}; this.gains = {}; this.sources = []; this.master = null;
    this.state = {}; this.volume = 0.9; this.startedAt = 0; this.offset = 0; this.playing = false; this.stamp = 0;
  }
  ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }
  async load(buses, stamp) {
    const ctx = this.ensure();
    const next = {};
    await Promise.all(Object.entries(buses).map(async ([name, info]) => {
      const res = await fetch(`/proyecto/${info.archivo}?v=${stamp}`);
      next[name] = await ctx.decodeAudioData(await res.arrayBuffer());
    }));
    const was = this.playing ? this.now() : null;
    if (was != null) this.stop();
    this.buffers = next;
    for (const name of Object.keys(next)) if (!this.gains[name]) { const g = ctx.createGain(); g.connect(this.master); this.gains[name] = g; }
    this.apply();
    if (was != null) this.play(was);
  }
  setBus(name, patch) { this.state[name] = { ...(this.state[name] || { mute: false, solo: false, gain: 1 }), ...patch }; this.apply(); }
  apply() {
    const solo = Object.values(this.state).some(s => s.solo);
    for (const [name, g] of Object.entries(this.gains)) {
      const s = this.state[name] || { mute: false, solo: false, gain: 1 };
      g.gain.value = (s.mute || (solo && !s.solo)) ? 0 : s.gain;
    }
    if (this.master) this.master.gain.value = this.volume;
  }
  play(from) {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') ctx.resume();
    this.stop();
    this.offset = from; this.startedAt = ctx.currentTime + 0.03; this.playing = true;
    for (const [name, buf] of Object.entries(this.buffers)) {
      if (from >= buf.duration) continue;
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(this.gains[name]);
      src.start(this.startedAt, from);
      this.sources.push(src);
    }
  }
  stop() { for (const s of this.sources) { try { s.stop(); } catch { } } this.sources = []; this.playing = false; }
  now() { return this.ctx && this.playing ? this.offset + Math.max(0, this.ctx.currentTime - this.startedAt) : this.offset; }
  blip(from, dur = 0.12) {
    if (!Object.keys(this.buffers).length || this.playing) return;
    const ctx = this.ensure(); if (ctx.state === 'suspended') ctx.resume();
    for (const [name, buf] of Object.entries(this.buffers)) {
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(this.gains[name]);
      src.start(ctx.currentTime, Math.min(from, buf.duration - 0.01), dur);
    }
  }
}
