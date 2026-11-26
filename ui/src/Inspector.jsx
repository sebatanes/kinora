import { useEffect, useMemo, useRef, useState } from 'react';
import { Code, Layer, Music, ArrowRight2, ColorSwatch, Mouse, Text, Image as ImageIcon, Shapes, MessageAdd } from 'iconsax-reactjs';
import { api, literals, formatNumber, step, describeOp, chainOf, frameKey } from './lib.js';

const sources = new Map();
export async function sourceOf(file, stamp) {
  const key = file + '@' + stamp;
  if (!sources.has(key)) sources.set(key, api(`fuente?file=${encodeURIComponent(file)}`).then(r => r.text.split('\n')).catch(() => []));
  return sources.get(key);
}

function NumberKnob({ lit, onChange, onCommit }) {
  const [val, setVal] = useState(lit.text);
  const [edit, setEdit] = useState(false);
  useEffect(() => setVal(lit.text), [lit.text]);
  if (edit) {
    return (
      <input
        className="knob-input num"
        autoFocus
        defaultValue={val}
        size={Math.max(3, val.length + 1)}
        onFocus={e => e.target.select()}
        onBlur={e => { setEdit(false); const v = e.target.value.trim(); if (v && v !== lit.text && !Number.isNaN(Number(v))) { setVal(v); onCommit(v); } }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = lit.text; e.currentTarget.blur(); } }}
      />
    );
  }
  const down = e => {
    e.preventDefault();
    const x0 = e.clientX, v0 = lit.value;
    let last = lit.text, moved = false;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = ev => {
      const dx = ev.clientX - x0;
      if (Math.abs(dx) > 2) moved = true;
      if (!moved) return;
      const k = step(lit.text, ev.altKey) * (ev.shiftKey ? 10 : 1);
      const next = formatNumber(v0 + Math.round(dx / 3) * k, lit.text);
      if (next !== last) { last = next; setVal(next); onChange(next); }
    };
    const up = () => {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up);
      if (moved) onCommit(last);
      else setEdit(true);
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
  };
  return <span className="knob num" onPointerDown={down} title="Drag to change · Shift ×10 · Alt fine">{val}</span>;
}

function ColorKnob({ lit, onCommit }) {
  const ref = useRef(null);
  const hex = lit.value.length === 4 ? '#' + [...lit.value.slice(1)].map(c => c + c).join('') : lit.value.slice(0, 7);
  return (
    <span className="knob color" onClick={() => ref.current?.click()}>
      <i style={{ background: lit.value }} />
      {lit.text}
      <input ref={ref} type="color" defaultValue={hex} onChange={e => onCommit(lit.quote + e.target.value + lit.quote, true)} />
    </span>
  );
}

function TextKnob({ lit, onCommit }) {
  const [edit, setEdit] = useState(false);
  if (edit) {
    return (
      <input
        className="knob-input"
        autoFocus
        defaultValue={lit.value}
        size={Math.max(4, lit.value.length)}
        onBlur={e => { setEdit(false); if (e.target.value !== lit.value) onCommit(lit.quote + e.target.value.replace(new RegExp(lit.quote, 'g'), '\\' + lit.quote) + lit.quote); }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = lit.value; e.currentTarget.blur(); } }}
      />
    );
  }
  return <span className="knob str" onClick={() => setEdit(true)}>{lit.text}</span>;
}

export function CodeLine({ file, lineNo, text, onEdit, current }) {
  const lits = useMemo(() => literals(text), [text]);
  const parts = [];
  let at = 0;
  lits.forEach((lit, i) => {
    if (lit.col > at) parts.push(<span key={'t' + i}>{text.slice(at, lit.col)}</span>);
    const commit = (value, isColor) => onEdit({ file, line: lineNo, col: lit.col, old: lit.text, value, isColor });
    if (lit.kind === 'numero') parts.push(<NumberKnob key={'k' + i} lit={lit} onChange={v => onEdit({ file, line: lineNo, col: lit.col, old: lit.text, value: v, live: true })} onCommit={v => commit(v)} />);
    else if (lit.kind === 'color') parts.push(<ColorKnob key={'k' + i} lit={lit} onCommit={commit} />);
    else parts.push(<TextKnob key={'k' + i} lit={lit} onCommit={commit} />);
    at = lit.col + lit.text.length;
  });
  if (at < text.length) parts.push(<span key="end">{text.slice(at)}</span>);
  return (
    <div className={`code-line ${current ? 'current' : ''}`}>
      <span className="ln">{lineNo}</span>
      <code>{parts}</code>
    </div>
  );
}

export function CodeWindow({ file, line, stamp, around = 0, onEdit }) {
  const [lines, setLines] = useState(null);
  useEffect(() => { let on = true; sourceOf(file, stamp).then(l => on && setLines(l)); return () => { on = false; }; }, [file, stamp]);
  if (!lines) return <div className="code-block loading" />;
  const from = Math.max(1, line - around), to = Math.min(lines.length, line + around);
  const rows = [];
  for (let n = from; n <= to; n++) rows.push(<CodeLine key={n} file={file} lineNo={n} text={lines[n - 1] || ''} current={n === line && around > 0} onEdit={onEdit} />);
  return <div className="code-block">{rows}</div>;
}

const KIND_ICON = { texto: Text, imagen: ImageIcon, relleno: Shapes, trazo: Shapes, 'rectángulo': Shapes };

export default function Inspector({ selection, stamp, onEdit, onPickLevel, onNote, audioEvent, info }) {
  const [open, setOpen] = useState({});
  useEffect(() => setOpen({}), [selection?.op?.i, selection?.t]);

  if (audioEvent) {
    return (
      <div className="inspector">
        <div className="insp-head">
          <Music size={22} />
          <div>
            <div className="insp-title">Sound at {audioEvent.t.toFixed(2)} s</div>
            <div className="insp-sub mono">{audioEvent.bus} · lasts {audioEvent.dur.toFixed(2)} s · gain {audioEvent.gain}</div>
          </div>
        </div>
        <div className="section">
          <div className="section-title"><Code size={18} />sound.py</div>
          <CodeWindow file="sound.py" line={audioEvent.line} stamp={stamp} around={2} onEdit={onEdit} />
        </div>
      </div>
    );
  }

  if (!selection) {
    return (
      <div className="inspector empty">
        <Mouse size={40} variant="Bulk" />
        <div className="empty-title">Click on the video</div>
      </div>
    );
  }

  const { op, under, level } = selection;
  const chain = chainOf(op);
  const Icon = KIND_ICON[op.kind] || Layer;
  return (
    <div className="inspector">
      <div className="insp-head">
        <Icon size={22} />
        <div className="grow">
          <div className="insp-title">{describeOp(op)}</div>
          <div className="insp-sub mono">
            {op.box.w}×{op.box.h} at {op.box.x},{op.box.y}
            {op.color && typeof op.color === 'string' && op.color.length < 40 ? <> · <i className="sw" style={{ background: op.color }} />{op.color}</> : null}
          </div>
          {op.fuente ? <div className="insp-sub mono">{op.fuente}</div> : null}
        </div>
        <button className="icon-btn" title="Note on this" onClick={onNote}><MessageAdd size={20} /></button>
      </div>

      {op.src && /\.(png|jpe?g|webp|gif)$/i.test(op.src) && (
        <div className="section asset-preview"><img src={`/proyecto/${op.src}?v=${stamp}`} alt="" /><span className="mono">{op.src}</span></div>
      )}

      <div className="section">
        <div className="section-title"><Layer size={18} />Where it comes from</div>
        <div className="chain">
          {chain.map((f, i) => {
            const key = frameKey(f.caller || f);
            const active = level === i;
            return (
              <div key={i} className={`chain-row ${active ? 'on' : ''}`}>
                <button className="chain-name" onClick={() => onPickLevel(i, key)}>
                  <span className="fn">{f.fn}</span>
                  <span className="where mono">{f.file}:{f.line}</span>
                  <ArrowRight2 size={14} className={`caret ${open[i] ? 'open' : ''}`} onClick={e => { e.stopPropagation(); setOpen(o => ({ ...o, [i]: !o[i] })); }} />
                </button>
                <CodeWindow file={f.file} line={f.line} stamp={stamp} around={open[i] ? 6 : 0} onEdit={onEdit} />
              </div>
            );
          })}
        </div>
      </div>

      {under.length > 1 && (
        <div className="section">
          <div className="section-title"><ColorSwatch size={18} />Under the cursor</div>
          <div className="under">
            {under.slice(0, 8).map(o => (
              <button key={o.i} className={`under-row ${o.i === op.i ? 'on' : ''}`} onClick={() => selection.pick(o)}>
                <span>{describeOp(o)}</span>
                <span className="mono dim">{o.stack[0]?.fn || ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
