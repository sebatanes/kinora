import { useEffect, useRef, useState } from 'react';
import { Text, Clock, Eye, MagicStar, Refresh2, TickCircle } from 'iconsax-reactjs';
import { literals } from './lib.js';
import { sourceOf } from './Inspector.jsx';
import { Renderer } from './Stage.jsx';

// Where a drawn text lives in the code: the string literal, in the call stack, that holds it.
export async function findTextLiteral(op, stamp) {
  const want = (op.texto || '').trim();
  if (!want) return null;
  const frames = [...op.stack, ...(op.capa || [])];
  let partial = null;
  for (const f of frames) {
    const lines = await sourceOf(f.file, stamp);
    for (const ln of [f.line, f.line - 1, f.line + 1]) {
      const line = lines[ln - 1];
      if (!line) continue;
      for (const lit of literals(line)) {
        if (lit.kind === 'numero') continue;
        if (lit.value === want) return { file: f.file, line: ln, lit };
        if (!partial && want.length > 0 && lit.value.includes(want) && lit.value.length > want.length) partial = { file: f.file, line: ln, lit };
      }
    }
  }
  return partial;
}

export const quoteFor = (lit, value) => lit.quote + value.replaceAll('\\', '\\\\').replaceAll(lit.quote, '\\' + lit.quote) + lit.quote;

function ranges(times, step) {
  const out = [];
  for (const t of times.sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && t - last[1] <= step * 1.6) last[1] = t; else out.push([t, t]);
  }
  return out.map(([a, b]) => [a, b + step]);
}

// Walks the video offscreen and returns every drawn text with where it lives in the code and when it shows.
export async function scanTexts(entry, info, stamp, onProgress, alive = () => true) {
  const r = new Renderer(entry);
  try {
    await r.open(stamp);
    const dur = info.duracion, step = Math.max(0.1, dur / 80);
    const found = new Map(), loose = new Map();
    for (let t = 0, k = 0; t < dur && alive(); t += step, k++) {
      const res = await r.inspect(t);
      for (const op of res?.ops || []) {
        if (op.kind !== 'texto' || !op.texto?.trim()) continue;
        const loc = await findTextLiteral(op, stamp);
        if (loc) {
          const key = `${loc.file}:${loc.line}:${loc.lit.col}`;
          const it = found.get(key) || { key, ...loc, times: new Set(), box: op.box, fuente: op.fuente, color: op.color, mid: t };
          it.times.add(+t.toFixed(3));
          found.set(key, it);
        } else {
          const it = loose.get(op.texto) || { texto: op.texto, times: new Set(), box: op.box };
          it.times.add(+t.toFixed(3)); loose.set(op.texto, it);
        }
      }
      if (k % 8 === 0) onProgress?.(t / dur);
    }
    if (!alive()) return null;
    return {
      items: [...found.values()].map(it => ({ ...it, ranges: ranges([...it.times], step) })).sort((a, b) => a.ranges[0][0] - b.ranges[0][0]),
      computed: [...loose.values()].map(it => ({ ...it, ranges: ranges([...it.times], step) })).filter(it => it.texto.trim().length > 1).slice(0, 12),
    };
  } finally { r.close(); }
}

export default function Texts({ entry, stamp, info, onEdit, onSeek, onShow, onAsk, selectedKey, onSelect }) {
  const [items, setItems] = useState(null);
  const [computed, setComputed] = useState([]);
  const [progress, setProgress] = useState(0);
  const [saved, setSaved] = useState(null);
  const [scanStamp, setScanStamp] = useState(stamp);
  const listRef = useRef(null);
  // After an edit, the values refresh right away; the full walk through the video waits until edits settle.
  useEffect(() => { const id = setTimeout(() => setScanStamp(stamp), items ? 2500 : 0); return () => clearTimeout(id); }, [stamp]);
  useEffect(() => {
    if (!items) return;
    let on = true;
    (async () => {
      const next = await Promise.all(items.map(async it => {
        const lines = await sourceOf(it.file, stamp);
        const lits = literals(lines[it.line - 1] || '').filter(l => l.kind !== 'numero');
        const hit = lits.sort((a, b) => Math.abs(a.col - it.lit.col) - Math.abs(b.col - it.lit.col))[0];
        return hit ? { ...it, lit: hit, key: `${it.file}:${it.line}:${hit.col}` } : it;
      }));
      if (on) setItems(next);
    })();
    return () => { on = false; };
  }, [stamp]);
  useEffect(() => {
    if (!selectedKey || !listRef.current) return;
    listRef.current.querySelector(`[data-key="${CSS.escape(selectedKey)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedKey]);

  useEffect(() => {
    if (!info || !entry) return;
    let on = true;
    (async () => {
      const res = await scanTexts(entry, info, scanStamp, p => on && setProgress(p), () => on);
      if (!on || !res) return;
      setItems(res.items); setComputed(res.computed); setProgress(1);
    })();
    return () => { on = false; };
  }, [entry, scanStamp, info?.duracion]);

  const save = async (it, value) => {
    if (value === it.lit.value) return;
    await onEdit({ file: it.file, line: it.line, col: it.lit.col, old: it.lit.text, value: quoteFor(it.lit, value) });
    setSaved(it.key); setTimeout(() => setSaved(null), 1400);
  };

  return (
    <div className="texts" ref={listRef}>
      {!items && <div className="dim reco-loading"><Refresh2 size={16} className="spin" />Finding the video's texts {Math.round(progress * 100)}%</div>}
      {items && !items.length && !computed.length && <div className="empty small"><Text size={30} variant="Bulk" /><div className="empty-title">The video has no texts</div></div>}
      {items?.map(it => (
        <div key={it.key} data-key={it.key} className={`text-item ${selectedKey === it.key ? 'on' : ''}`} onPointerDown={() => onSelect?.(it)}>
          <textarea
            key={it.lit.value}
            className="text-edit"
            defaultValue={it.lit.value}
            rows={Math.min(4, Math.ceil(it.lit.value.length / 28) || 1)}
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } if (e.key === 'Escape') { e.currentTarget.value = it.lit.value; e.currentTarget.blur(); } }}
            onBlur={e => save(it, e.target.value)}
          />
          <div className="text-meta">
            {saved === it.key ? <span className="saved"><TickCircle size={14} variant="Bold" />Saved</span> : null}
            <span className="grow" />
            {it.ranges.slice(0, 3).map(([a, b], i) => <button key={i} className="tchip" onClick={() => onSeek(a + 0.01)}>{a.toFixed(1)}–{b.toFixed(1)} s</button>)}
            <button className="icon-btn sm" title="See in the video" onClick={() => onShow(it)}><Eye size={16} /></button>
          </div>
        </div>
      ))}
      {computed.length > 0 && (
        <div className="group open">
          <div className="section-title"><MagicStar size={16} />Built in the code</div>
          {computed.map(it => (
            <div key={it.texto} className="text-item computed">
              <div className="text-static">{it.texto}</div>
              <div className="text-meta">
                <span className="grow" />
                <button className="tchip" onClick={() => onSeek(it.ranges[0][0] + 0.01)}>{it.ranges[0][0].toFixed(1)} s</button>
                <button className="ghost sm" onClick={() => onAsk(`I want to change the text "${it.texto}" that shows at ${it.ranges[0][0].toFixed(2)} s. It's built in the code. Tell me how it's generated and make it editable as a literal string.`, { texto: it.texto })}><MagicStar size={14} />Ask Claude</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
