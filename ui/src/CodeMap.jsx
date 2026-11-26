import { useEffect, useMemo, useRef, useState } from 'react';
import { Code, Eye, MagicStar, Refresh2, Clock, Text, Image as ImageIcon, Music, Play, Grid5, DocumentText, Setting4, Hierarchy, Add, Minus } from 'iconsax-reactjs';
import { api, literals, formatNumber, step, clamp } from './lib.js';
import { sourceOf, CodeWindow } from './Inspector.jsx';
import { Renderer } from './Stage.jsx';

// Functions declared in a JS or HTML file, with their line range.
function parseFunctions(lines) {
  const out = [];
  const re = /(?:^|[\s;(])(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/;
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i]);
    if (!m) continue;
    const name = m[1] || m[2];
    let depth = 0, seen = false, end = i;
    for (let j = i; j < lines.length; j++) {
      const l = lines[j].replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '').replace(/\/\/.*$/, '');
      for (const ch of l) { if (ch === '{') { depth++; seen = true; } else if (ch === '}') depth--; }
      end = j;
      if (seen && depth <= 0) break;
      if (!seen && j > i && /;\s*$/.test(lines[j])) break;
      if (!seen && j === i && !/\{/.test(l) && /;\s*$/.test(lines[i])) break;
    }
    out.push({ name, from: i + 1, to: end + 1 });
  }
  return out;
}

// A readable label for a literal: the name it is assigned to, or the call and argument it goes into.
function labelFor(line, col) {
  const before = line.slice(0, col);
  const assign = before.match(/([A-Za-z_$][\w$.]*)\s*[:=]\s*$/);
  if (assign) return assign[1].split('.').pop();
  let depth = 0, commas = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    const ch = before[i];
    if (ch === ')' || ch === ']') depth++;
    else if (ch === '(' || ch === '[') {
      if (depth === 0) {
        const fn = before.slice(0, i).match(/([A-Za-z_$][\w$]*)\s*$/);
        return fn ? `${fn[1]} · #${commas + 1}` : `value ${commas + 1}`;
      }
      depth--;
    } else if (ch === ',' && depth === 0) commas++;
  }
  return null;
}

function Knob({ lit, label, onEdit, file, line }) {
  const [val, setVal] = useState(lit.text);
  useEffect(() => setVal(lit.text), [lit.text]);
  const ref = useRef(null);
  if (lit.kind === 'color') {
    const hex = lit.value.length === 4 ? '#' + [...lit.value.slice(1)].map(c => c + c).join('') : lit.value.slice(0, 7);
    return (
      <label className="param color" title={`line ${line}`}>
        <span className="param-name">{label}</span>
        <span className="param-color" style={{ background: lit.value }} />
        <span className="mono">{lit.value}</span>
        <input type="color" defaultValue={hex} onChange={e => onEdit({ file, line, col: lit.col, old: lit.text, value: lit.quote + e.target.value + lit.quote })} />
      </label>
    );
  }
  if (lit.kind !== 'numero') {
    return (
      <label className="param text" title={`line ${line}`}>
        <span className="param-name">{label}</span>
        <input defaultValue={lit.value} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); }}
          onBlur={e => { if (e.target.value !== lit.value) onEdit({ file, line, col: lit.col, old: lit.text, value: lit.quote + e.target.value.replaceAll(lit.quote, '\\' + lit.quote) + lit.quote }); }} />
      </label>
    );
  }
  const down = e => {
    e.preventDefault();
    const x0 = e.clientX, v0 = lit.value;
    let last = lit.text;
    const el = ref.current; el.setPointerCapture(e.pointerId);
    const move = ev => {
      const k = step(lit.text, ev.altKey) * (ev.shiftKey ? 10 : 1);
      const next = formatNumber(v0 + Math.round((ev.clientX - x0) / 3) * k, lit.text);
      if (next !== last) { last = next; setVal(next); onEdit({ file, line, col: lit.col, old: lit.text, value: next, live: true }); }
    };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); if (last !== lit.text) onEdit({ file, line, col: lit.col, old: lit.text, value: last }); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
  };
  return (
    <div className="param num" title={`line ${line} · drag to change`}>
      <span className="param-name">{label}</span>
      <span className="param-scrub mono" ref={ref} onPointerDown={down}>{val}</span>
    </div>
  );
}

function params(lines, fn, file) {
  const out = [];
  for (let n = fn.from; n <= fn.to; n++) {
    const line = lines[n - 1] || '';
    for (const lit of literals(line)) {
      if (lit.kind === 'numero' && (lit.value === 0 || lit.value === 1) && !/[:=]\s*$/.test(line.slice(0, lit.col))) continue;
      if (lit.kind === 'texto' && (lit.value.length < 2 || /^[\w-]+$/.test(lit.value) && lit.value.length < 4)) continue;
      out.push({ lit, line: n, label: labelFor(line, lit.col) || `line ${n}`, file });
    }
  }
  const rank = p => (p.lit.kind === 'color' ? 0 : p.lit.kind === 'texto' ? 1 : p.lit.kind === 'rgba' ? 2 : 3);
  return out.sort((a, b) => rank(a) - rank(b) || a.line - b.line);
}

function ranges(times, stepT) {
  const out = [];
  for (const t of times) {
    const last = out[out.length - 1];
    if (last && t - last[1] <= stepT * 1.6) last[1] = t; else out.push([t, t]);
  }
  return out.map(([a, b]) => [a, b + stepT]);
}

function Thumb({ src, box, ancho, alto }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c || !src) return;
    const img = new Image();
    img.onload = () => {
      const g = c.getContext('2d');
      const pad = 24;
      const x = clamp(box.x - pad, 0, ancho), y = clamp(box.y - pad, 0, alto);
      const w = clamp(box.w + pad * 2, 1, ancho - x), h = clamp(box.h + pad * 2, 1, alto - y);
      const k = Math.min(c.width / w, c.height / h);
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(img, x, y, w, h, (c.width - w * k) / 2, (c.height - h * k) / 2, w * k, h * k);
    };
    img.src = src;
  }, [src, box, ancho, alto]);
  return <canvas ref={ref} className="node-thumb" width={560} height={300} />;
}

export default function CodeMap({ file, entry, stamp, info, audio, onEdit, onSeek, onShow, onAsk, onContext, onClose, busState }) {
  const [lines, setLines] = useState(null);
  const [view, setView] = useState(/\.(js|mjs|html|py)$/i.test(file) ? 'visual' : 'codigo');
  const [data, setData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [openNode, setOpenNode] = useState(null);
  const [cam, setCam] = useState({ x: 32, y: 24, z: 0.8 });
  const [showAll, setShowAll] = useState(false);
  const [heights, setHeights] = useState({});
  const [moved, setMoved] = useState(() => { try { return JSON.parse(localStorage.getItem(`estudio.mapa.${file}`) || '{}'); } catch { return {}; } });
  useEffect(() => { try { localStorage.setItem(`estudio.mapa.${file}`, JSON.stringify(moved)); } catch { } }, [moved, file]);
  const observer = useRef(null);
  const measure = useRef(new Map());
  if (!observer.current && typeof ResizeObserver !== 'undefined') {
    observer.current = new ResizeObserver(entries => {
      setHeights(h => {
        let changed = false; const n = { ...h };
        for (const e of entries) { const k = e.target.dataset.node; const v = Math.round(e.target.offsetHeight); if (k && n[k] !== v) { n[k] = v; changed = true; } }
        return changed ? n : h;
      });
    });
  }
  const nodeRef = name => el => {
    const prev = measure.current.get(name);
    if (prev && prev !== el) observer.current?.unobserve(prev);
    if (el) { measure.current.set(name, el); observer.current?.observe(el); }
  };
  const dragNode = (e, name, start) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, y0 = e.clientY, z = cam.z;
    const move = ev => setMoved(m => ({ ...m, [name]: { x: start.x + (ev.clientX - x0) / z, y: start.y + (ev.clientY - y0) / z } }));
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  };
  const board = useRef(null);

  useEffect(() => { let on = true; sourceOf(file, stamp).then(l => on && setLines(l)); return () => { on = false; }; }, [file, stamp]);
  const fns = useMemo(() => (lines && /\.(js|mjs|html)$/i.test(file) ? parseFunctions(lines) : []), [lines, file]);
  const isSound = /(^|\/)sound\.py$/.test(file);

  // Sample the whole video offscreen: which function draws what, where and when.
  useEffect(() => {
    if (view !== 'visual' || !info || !fns.length || isSound) return;
    let on = true;
    const r = new Renderer(entry);
    (async () => {
      try {
        await r.open(stamp);
        const dur = info.duracion, stepT = Math.max(0.1, dur / 90);
        const acc = new Map();
        const edges = new Map();
        let ancho = info.ancho, alto = info.alto;
        for (let t = 0, k = 0; t < dur && on; t += stepT, k++) {
          const res = await r.inspect(t);
          if (!res) continue;
          ancho = res.ancho; alto = res.alto;
          const seenHere = new Set();
          for (const op of res.ops) {
            const frames = [...op.stack, ...(op.capa || [])].filter(f => f.file === file);
            frames.forEach((f, i) => {
              let a = acc.get(f.fn);
              if (!a) { a = { times: [], boxes: new Map(), x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9, textos: new Set(), imagenes: new Set(), ops: 0 }; acc.set(f.fn, a); }
              a.ops++;
              if (!seenHere.has(f.fn)) { seenHere.add(f.fn); a.times.push(t); }
              const b = a.boxes.get(t) || { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
              b.x0 = Math.min(b.x0, op.box.x); b.y0 = Math.min(b.y0, op.box.y); b.x1 = Math.max(b.x1, op.box.x + op.box.w); b.y1 = Math.max(b.y1, op.box.y + op.box.h);
              a.boxes.set(t, b);
              if (op.texto && a.textos.size < 6) a.textos.add(op.texto);
              if (op.src && op.src !== 'capa' && a.imagenes.size < 4) a.imagenes.add(op.src.split('/').pop().split('?')[0]);
              const caller = frames[i + 1];
              if (caller && caller.fn !== f.fn) edges.set(`${caller.fn}>${f.fn}`, [caller.fn, f.fn]);
            });
          }
          if (k % 10 === 0) setProgress(t / dur);
        }
        const nodes = [...acc.entries()].map(([name, a]) => {
          const rs = ranges(a.times, stepT);
          const longest = rs.slice().sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))[0];
          const mid = longest ? a.times.reduce((best, t) => Math.abs(t - (longest[0] + longest[1]) / 2) < Math.abs(best - (longest[0] + longest[1]) / 2) ? t : best, a.times[0]) : 0;
          const bb = a.boxes.get(mid);
          return { name, ranges: rs, mid, box: bb ? { x: bb.x0, y: bb.y0, w: bb.x1 - bb.x0, h: bb.y1 - bb.y0 } : null, textos: [...a.textos], imagenes: [...a.imagenes], ops: a.ops, cover: rs.reduce((s, q) => s + q[1] - q[0], 0) };
        });
        if (!on) return;
        setData({ nodes, edges: [...edges.values()], ancho, alto, thumbs: {} });
        setProgress(1);
        for (const n of nodes.sort((a, b) => a.mid - b.mid)) {
          if (!on) break;
          const iso = await r.isolated(n.mid, `fn:${file}:${n.name}`);
          if (iso?.only) setData(d => d && { ...d, thumbs: { ...d.thumbs, [n.name]: iso.only } });
        }
      } catch (e) { console.warn(e); }
      r.close();
    })();
    return () => { on = false; r.close(); };
  }, [view, info, fns, file, entry, stamp, isSound]);

  const layout = useMemo(() => {
    if (!data) return null;
    const drawn = new Map(data.nodes.map(n => [n.name, n]));
    const known = new Set(fns.map(f => f.name));
    const nodes = data.nodes.filter(n => n.name !== '(anonymous)' && n.name !== '(anónima)' && !['renderFrame', 'preview', 'tick'].includes(n.name));
    const shown = new Set(nodes.map(n => n.name));
    const parents = new Map();
    for (const [a, b] of data.edges) { if (!parents.has(b)) parents.set(b, new Set()); parents.get(b).add(a); }
    const depth = new Map();
    const d = n => {
      if (depth.has(n)) return depth.get(n);
      depth.set(n, 0);
      const ps = [...(parents.get(n) || [])].filter(p => drawn.has(p) && shown.has(p));
      const v = ps.length ? Math.min(...ps.map(p => d(p) + 1)) : 0;
      depth.set(n, v);
      return v;
    };
    nodes.forEach(n => d(n.name));
    const cols = new Map();
    for (const n of nodes) { const k = depth.get(n.name) || 0; if (!cols.has(k)) cols.set(k, []); cols.get(k).push(n); }
    const W = 330, GAP = 150, ROW = 44, pos = new Map();
    for (const [k, list] of [...cols.entries()].sort((a, b) => a[0] - b[0])) {
      list.sort((a, b) => a.mid - b.mid);
      let y = 0;
      for (const n of list) { pos.set(n.name, { x: k * (W + GAP), y, w: W }); y += (heights[n.name] || 380) + ROW; }
    }
    return { nodes, pos, W };
  }, [data, fns, heights]);

  const idle = useMemo(() => fns.filter(f => !data?.nodes.some(n => n.name === f.name)), [fns, data]);

  const onWheel = e => {
    const el = board.current; if (!el) return;
    const r = el.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const z = clamp(cam.z * Math.exp(-e.deltaY * 0.0015), 0.25, 2);
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      setCam(c => ({ z, x: mx - (mx - c.x) * z / c.z, y: my - (my - c.y) * z / c.z }));
    } else setCam(c => ({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY }));
  };
  useEffect(() => {
    const el = board.current; if (!el) return;
    const h = e => { if (e.ctrlKey || e.metaKey) e.preventDefault(); };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  });
  const pan = e => {
    if (e.button !== 0 || e.target.closest('.node')) return;
    const x0 = e.clientX, y0 = e.clientY, c0 = cam;
    const move = ev => setCam({ ...c0, x: c0.x + ev.clientX - x0, y: c0.y + ev.clientY - y0 });
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  };

  const soundGroups = useMemo(() => {
    if (!isSound || !audio) return [];
    const m = new Map();
    for (const ev of audio.eventos) { const g = m.get(ev.line) || { line: ev.line, code: ev.code, bus: ev.bus, evs: [] }; g.evs.push(ev); m.set(ev.line, g); }
    return [...m.values()].sort((a, b) => a.evs[0].t - b.evs[0].t);
  }, [isSound, audio]);

  const fnOf = name => fns.find(f => f.name === name);
  const human = n => {
    const parts = [];
    if (n.textos.length) parts.push(`Writes ${n.textos.slice(0, 2).map(t => `"${t.length > 22 ? t.slice(0, 22) + '…' : t}"`).join(', ')}`);
    if (n.imagenes.length) parts.push(`Uses ${n.imagenes.slice(0, 2).join(', ')}`);
    if (!parts.length) parts.push(`${n.ops} ${n.ops === 1 ? 'shape' : 'shapes'} in the video`);
    return parts.join(' · ');
  };

  return (
    <div className="codemap">
      <div className="map-bar">
        <DocumentText size={18} />
        <span className="map-file">{file}</span>
        <div className="seg">
          <button className={view === 'visual' ? 'on' : ''} onClick={() => setView('visual')}><Grid5 size={16} />Visual</button>
          <button className={view === 'codigo' ? 'on' : ''} onClick={() => setView('codigo')}><Code size={16} />Code</button>
        </div>
        <span className="grow" />
        {view === 'visual' && progress < 1 && !isSound && fns.length > 0 && <span className="status"><Refresh2 size={16} className="spin" />Scanning the video {Math.round(progress * 100)}%</span>}
        <button className="ghost" onClick={() => onAsk(`Explain in plain language, without code, what ${file} does in this video: what parts it has, when each one appears and what can be changed.`, { archivo: file })}><MagicStar size={17} />Explain it</button>
        {view === 'visual' && !isSound && <>
          {Object.keys(moved).length > 0 && <button className="ghost sm" onClick={() => setMoved({})}><Grid5 size={15} />Tidy up</button>}
          <button className="icon-btn" title="Zoom out" onClick={() => setCam(c => ({ ...c, z: clamp(c.z / 1.2, 0.25, 2) }))}><Minus size={18} /></button>
          <button className="icon-btn" title="Zoom in" onClick={() => setCam(c => ({ ...c, z: clamp(c.z * 1.2, 0.25, 2) }))}><Add size={18} /></button>
        </>}
      </div>

      {view === 'codigo' && <div className="map-code"><CodeWindow file={file} line={1} stamp={stamp} around={100000} onEdit={onEdit} /></div>}

      {view === 'visual' && isSound && (
        <div className="sound-map">
          {soundGroups.map(g => (
            <div key={g.line} className="snode" onContextMenu={e => onContext(e, { tipo: 'sonido', ev: g.evs[0] })}>
              <div className="snode-head">
                <button className="play-sm" onClick={() => onSeek(g.evs[0].t, true, g.evs[0])}><Play size={16} variant="Bold" /></button>
                <span className="snode-bus" style={{ '--c': `var(--bus-${g.bus}, var(--accent))` }}>{g.bus}</span>
                <span className="grow" />
                <span className="mono dim">line {g.line}</span>
              </div>
              <code className="snode-code">{g.code}</code>
              <div className="chips-t">
                {g.evs.slice(0, 12).map((ev, i) => <button key={i} className="tchip" onClick={() => onSeek(ev.t, true, ev)}>{ev.t.toFixed(2)}s</button>)}
                {g.evs.length > 12 && <span className="dim">+{g.evs.length - 12}</span>}
              </div>
              <div className="params">
                {literals(lines?.[g.line - 1] || '').filter(l => l.kind === 'numero').slice(0, 6).map((lit, i) => <Knob key={i} lit={lit} label={labelFor(lines[g.line - 1], lit.col) || 'value'} file={file} line={g.line} onEdit={onEdit} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'visual' && !isSound && (
        <div className="board" ref={board} onPointerDown={pan} onWheel={onWheel}>
          {!fns.length && lines && <div className="board-empty">This file has no functions that draw. <button className="ghost" onClick={() => setView('codigo')}>View the code</button></div>}
          {layout && (
            <div className="board-inner" style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})` }}>
              <svg className="edges" width="6000" height="6000">
                {data.edges.map(([a, b]) => {
                  const pa = moved[a] ? { ...layout.pos.get(a), ...moved[a] } : layout.pos.get(a);
                  const pb = moved[b] ? { ...layout.pos.get(b), ...moved[b] } : layout.pos.get(b);
                  if (!pa || !pb) return null;
                  const x1 = pa.x + pa.w, y1 = pa.y + 60, x2 = pb.x, y2 = pb.y + 60;
                  return <path key={a + b} d={`M${x1},${y1} C${x1 + 45},${y1} ${x2 - 45},${y2} ${x2},${y2}`} />;
                })}
              </svg>
              {layout.nodes.map(n => {
                const base = layout.pos.get(n.name);
                const p = moved[n.name] ? { ...base, ...moved[n.name] } : base;
                const f = fnOf(n.name);
                const ps = f && lines ? params(lines, f, file) : [];
                const open = openNode === n.name;
                return (
                  <div key={n.name} ref={nodeRef(n.name)} data-node={n.name} className={`node ${open ? 'open' : ''}`} style={{ left: p.x, top: p.y, width: p.w }}
                    onContextMenu={e => onContext(e, { tipo: 'funcion', node: n, fn: f })}>
                    <div className="node-media" onClick={() => onShow(n)}>
                      {data.thumbs[n.name] && n.box ? <Thumb src={data.thumbs[n.name]} box={n.box} ancho={data.ancho} alto={data.alto} /> : <div className="node-thumb loading" />}
                      <span className="node-eye"><Eye size={16} />See in the video</span>
                    </div>
                    <div className="node-body">
                      <div className="node-title" onPointerDown={e => dragNode(e, n.name, { x: p.x, y: p.y })} title="Drag to move it"><Hierarchy size={16} /><span className="mono">{n.name}</span><span className="grow" />{f && <span className="mono dim">{f.from}–{f.to}</span>}</div>
                      <div className="node-what">{human(n)}</div>
                      <div className="chips-t">
                        <Clock size={14} />
                        {n.ranges.slice(0, 5).map(([a, b], i) => <button key={i} className="tchip" onClick={() => onSeek(a + 0.01)}>{a.toFixed(1)}–{b.toFixed(1)} s</button>)}
                        {n.ranges.length > 5 && <span className="dim">+{n.ranges.length - 5}</span>}
                      </div>
                      {ps.length > 0 && (
                        <div className="params">
                          {(open ? ps : ps.slice(0, 4)).map((x, i) => <Knob key={`${x.line}:${x.lit.col}`} lit={x.lit} label={x.label} file={file} line={x.line} onEdit={onEdit} />)}
                          {ps.length > 4 && <button className="more" onClick={() => setOpenNode(open ? null : n.name)}>{open ? 'Less' : `${ps.length - 4} more values`}</button>}
                        </div>
                      )}
                      <div className="node-actions">
                        <button className="ghost sm" onClick={() => onAsk(`Explain in plain language what the "${n.name}" part of ${file} does and what I can change in it.`, { archivo: file, funcion: n.name, lineas: f ? `${f.from}-${f.to}` : null })}><MagicStar size={15} />What it does</button>
                        <button className="ghost sm" onClick={e => onContext(e, { tipo: 'funcion', node: n, fn: f })}><Setting4 size={15} />Change</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {data && idle.length > 0 && (
            <div className="idle">
              <button className="idle-toggle" onClick={() => setShowAll(v => !v)}>{idle.length} functions that draw nothing of their own {showAll ? '▾' : '▸'}</button>
              {showAll && <div className="idle-list">{idle.map(f => <span key={f.name} className="mono">{f.name}</span>)}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
