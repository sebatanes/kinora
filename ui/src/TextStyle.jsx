import { useEffect, useRef, useState } from 'react';
import { More, Text as TextIcon, TextalignLeft, TextalignCenter, TextalignRight, MagicStar, CloseCircle, InfoCircle, ArrowDown2, Clock, Colorfilter, Link21 } from 'iconsax-reactjs';
import { literals, formatNumber } from './lib.js';
import { sourceOf } from './Inspector.jsx';
import { quoteFor } from './Texts.jsx';
import { useFloating } from './Menus.jsx';

const cssCache = new Map();
// Families and weights the project ships in its CSS (@font-face), so the picker only offers fonts that will render.
export async function projectFonts(files, stamp) {
  const key = files.join('|') + stamp;
  if (cssCache.has(key)) return cssCache.get(key);
  const out = new Map();
  for (const f of files.filter(x => /\.css$/i.test(x))) {
    const text = (await sourceOf(f, stamp)).join('\n');
    for (const block of text.match(/@font-face\s*{[^}]*}/g) || []) {
      const fam = (block.match(/font-family:\s*['"]?([^;'"]+)/) || [])[1]?.trim();
      const w = +((block.match(/font-weight:\s*(\d+)/) || [])[1] || 400);
      if (!fam) continue;
      if (!out.has(fam)) out.set(fam, new Set());
      out.get(fam).add(w);
    }
  }
  const list = [...out.entries()].map(([familia, pesos]) => ({ familia, pesos: [...pesos].sort((a, b) => a - b) }));
  cssCache.set(key, list);
  return list;
}

// Reads, from the code around a fillText, where each style of that text is decided.
export async function analyzeText(loc, stamp) {
  const lines = await sourceOf(loc.file, stamp);
  const idx = loc.line - 1;
  if (lines[idx] == null) return { lines, palette: [] };
  let start = idx;
  for (let i = idx - 1; i >= Math.max(0, idx - 60); i--) {
    start = i;
    if (/\bfunction\b[^(]*\(|=>\s*\{\s*$|^\s*(const|let)\s+\w+\s*=\s*\([^)]*\)\s*=>/.test(lines[i])) break;
  }
  const upto = (i) => (i === idx ? lines[i].slice(0, loc.lit.col) : lines[i]);
  const lastMatch = (re) => {
    for (let i = idx; i >= start; i--) {
      const seg = upto(i);
      let m, found = null; const r = new RegExp(re.source, 'g');
      while ((m = r.exec(seg))) found = m;
      if (found) return { i, m: found };
    }
    return null;
  };
  const style = { lines };

  // Font
  const f = lastMatch(/\.font\s*=\s*/);
  if (f) {
    const line = lines[f.i], rhsCol = f.m.index + f.m[0].length;
    const call = line.slice(rhsCol).match(/^([A-Za-z_$][\w$]*)\(([^)]*)\)/);
    const lit = literals(line).find(l => l.col === rhsCol && l.kind === 'texto');
    if (call) {
      const nums = literals(line).filter(l => l.kind === 'numero' && l.col > rhsCol + call[1].length && l.col < rhsCol + call[0].length);
      const peso = nums.find(n => n.value >= 100 && n.value <= 900 && n.value % 100 === 0 && nums.length > 1);
      const tam = nums.find(n => n !== peso);
      const defIdx = lines.findIndex(l => new RegExp(`(const|let|var)\\s+${call[1]}\\s*=|function\\s+${call[1]}\\s*\\(`).test(l));
      let familia = null;
      if (defIdx >= 0) {
        const fm = lines[defIdx].match(/(["'])([^"'$]+)\1\s*,?\s*(sans-serif|serif|monospace|cursive|system-ui)?/);
        if (fm) familia = { line: defIdx + 1, col: fm.index + 1, old: fm[2], value: fm[2] };
        if (!peso) {
          const wm = lines[defIdx].match(/`(\d{3})\s/);
          if (wm) style.pesoFijo = { line: defIdx + 1, col: wm.index + 1, old: wm[1], value: +wm[1] };
        }
      }
      const usos = lines.filter(l => new RegExp(`\\b${call[1]}\\(`).test(l)).length;
      style.font = { tipo: 'helper', helper: call[1], usos, line: f.i + 1, familia, peso: peso && { line: f.i + 1, lit: peso }, tam: tam && { line: f.i + 1, lit: tam } };
    } else if (lit) {
      const pm = lit.value.match(/^(italic\s+)?(?:(\d{3})\s+)?([\d.]+)px\s+(.+)$/);
      if (pm) style.font = { tipo: 'literal', line: f.i + 1, lit, italic: !!pm[1], peso: pm[2] ? +pm[2] : 400, tam: +pm[3], familia: pm[4].split(',')[0].replace(/["']/g, '').trim(), resto: pm[4] };
    }
  }

  // Color
  const c = lastMatch(/\.fillStyle\s*=\s*/);
  if (c) {
    const line = lines[c.i], rhsCol = c.m.index + c.m[0].length;
    const lit = literals(line).find(l => l.col === rhsCol && (l.kind === 'color' || l.kind === 'rgba' || l.kind === 'texto'));
    const ref = line.slice(rhsCol).match(/^([A-Za-z_$][\w$]*(?:\.[\w$]+)+)/);
    if (lit && lit.kind === 'color') style.color = { tipo: 'literal', line: c.i + 1, lit };
    else if (ref) {
      const keyName = ref[1].split('.').pop();
      const di = lines.findIndex(l => new RegExp(`\\b${keyName}\\s*:\\s*(['"])#[0-9a-fA-F]{3,8}\\1`).test(l));
      let def = null;
      if (di >= 0) { const dm = lines[di].match(new RegExp(`\\b${keyName}\\s*:\\s*(['"])(#[0-9a-fA-F]{3,8})\\1`)); def = { line: di + 1, col: dm.index + dm[0].indexOf(dm[1]), old: `${dm[1]}${dm[2]}${dm[1]}`, value: dm[2], quote: dm[1] }; }
      const usos = lines.filter(l => l.includes(ref[1])).length;
      style.color = { tipo: 'paleta', nombre: ref[1], line: c.i + 1, refCol: rhsCol, def, usos };
    }
  }

  // Alignment
  const a = lastMatch(/\.textAlign\s*=\s*(['"])(left|center|right|start|end)\1/);
  if (a) style.align = { line: a.i + 1, col: a.m.index + a.m[0].indexOf(a.m[1]), old: `${a.m[1]}${a.m[2]}${a.m[1]}`, value: a.m[2], quote: a.m[1] };

  // Position: the literal numbers in the x and y arguments of the fillText call
  const line = lines[idx];
  let depth = 0, argStart = loc.lit.col + loc.lit.text.length, args = [], cur = argStart;
  for (let i = argStart; i < line.length; i++) {
    const ch = line[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') { if (depth === 0) { args.push([cur, i]); break; } depth--; }
    else if (ch === ',' && depth === 0) { args.push([cur, i]); cur = i + 1; }
  }
  args = args.filter(([s, e]) => line.slice(s, e).trim());
  const argNums = ([s, e]) => literals(line).filter(l => l.kind === 'numero' && l.col >= s && l.col < e);
  if (args[0]) style.x = argNums(args[0])[0] && { line: idx + 1, lit: argNums(args[0])[0], expr: line.slice(...args[0]).trim() };
  if (args[1]) style.y = argNums(args[1])[0] && { line: idx + 1, lit: argNums(args[1])[0], expr: line.slice(...args[1]).trim() };
  // Palette: objects of named hex colors, like const C = { cream: '#f2e8d5' }
  style.palette = [];
  lines.forEach(l => {
    const m = l.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{(.*)\}/);
    if (!m) return;
    for (const e of m[2].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(['"])(#[0-9a-fA-F]{3,8})\2/g)) style.palette.push({ nombre: e[1], ref: `${m[1]}.${e[1]}`, value: e[3] });
  });
  return style;
}

// Finds the same text literal again after an edit moved it along its line.
export async function relocate(loc, stamp, value) {
  const lines = await sourceOf(loc.file, stamp);
  const lits = literals(lines[loc.line - 1] || '').filter(l => l.kind !== 'numero');
  const want = value ?? loc.lit.value;
  const hit = lits.filter(l => l.value === want).sort((a, b) => Math.abs(a.col - loc.lit.col) - Math.abs(b.col - loc.lit.col))[0];
  return hit ? { ...loc, lit: hit } : loc;
}

function Row({ label, off, children, shared }) {
  return (
    <div className={`ts-row ${off ? 'off' : ''}`}>
      <div className="ts-label">{label}{off && <span className="exp-why" title={off}><InfoCircle size={13} /></span>}{shared && <span className="ts-shared" title={shared}><Link21 size={13} /></span>}</div>
      <div className="ts-ctrl">{children}</div>
    </div>
  );
}

function Scrub({ value, min, max, step = 1, onChange, onCommit, unit = '' }) {
  const ref = useRef(null);
  const down = e => {
    e.preventDefault();
    const x0 = e.clientX, v0 = value; let last = value;
    ref.current.setPointerCapture(e.pointerId);
    const move = ev => { const v = Math.max(min, Math.min(max, Math.round((v0 + (ev.clientX - x0) / 2 * step) / step) * step)); if (v !== last) { last = v; onChange(v); } };
    const up = () => { ref.current.removeEventListener('pointermove', move); ref.current.removeEventListener('pointerup', up); onCommit(last); };
    ref.current.addEventListener('pointermove', move); ref.current.addEventListener('pointerup', up);
  };
  return <span className="ts-scrub mono" ref={ref} onPointerDown={down} title="Drag to change">{value}{unit}</span>;
}

function FontPick({ fonts, value, onPick, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const float = useFloating(open, ref, { width: 300 });
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target) && !e.target.closest?.('.ts-font-pop')) setOpen(false); };
    addEventListener('pointerdown', close, true);
    return () => removeEventListener('pointerdown', close, true);
  }, [open]);
  return (
    <div ref={ref} className="ts-font">
      <button className={`ms-btn ${open ? 'on' : ''}`} disabled={disabled} onClick={() => setOpen(o => !o)} style={{ width: '100%' }}>
        <span className="ms-name" style={{ fontFamily: `"${value}"` }}>{value}</span><ArrowDown2 size={14} className="ms-caret" />
      </button>
      {open && (
        <div className="ms-pop floating ts-font-pop" style={float || { visibility: 'hidden' }}>
          <div className="ms-list">
            {fonts.map(f => (
              <button key={f.familia} className={`ms-row ${f.familia === value ? 'on' : ''}`} onClick={() => { onPick(f.familia); setOpen(false); }}>
                <span className="ms-row-name ts-font-sample" style={{ fontFamily: `"${f.familia}"` }}>{f.familia}</span>
                <span className="ms-row-meta">{f.pesos.join(' · ')}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function useTextModel({ sel, stamp, files, onEdit, onRelocate }) {
  const [st, setSt] = useState(null);
  const [fonts, setFonts] = useState([]);
  const [value, setValue] = useState(sel.loc.lit.value);
  const [live, setLive] = useState({});
  const pending = useRef({});
  useEffect(() => { setValue(sel.loc.lit.value); }, [sel.key, sel.loc.lit.value]);
  useEffect(() => { let on = true; analyzeText(sel.loc, stamp).then(s => { if (on) { setSt(s); setLive({}); } }); return () => { on = false; }; }, [sel.loc.line, sel.loc.lit.col, sel.loc.lit.value, stamp]);
  useEffect(() => { projectFonts(files, stamp).then(setFonts); }, [files.join('|'), stamp]);

  const write = async (key, edit) => {
    if (pending.current[key]) return;
    pending.current[key] = true;
    try { await onEdit(edit); } finally { pending.current[key] = false; }
  };
  const saveText = async v => {
    if (v === sel.loc.lit.value) return;
    await onEdit({ file: sel.loc.file, line: sel.loc.line, col: sel.loc.lit.col, old: sel.loc.lit.text, value: quoteFor(sel.loc.lit, v) });
    onRelocate(v);
  };
  const numEdit = (target, v, final) => {
    const val = formatNumber(v, target.lit.text);
    setLive(l => ({ ...l, [target.lit.col + ':' + target.line]: v }));
    onEdit({ file: sel.loc.file, line: target.line, col: target.lit.col, old: target.lit.text, value: val, live: !final });
  };
  const font = st?.font;
  const famValue = font ? (font.tipo === 'helper' ? font.familia?.value : font.familia) : null;
  const pesoValue = font ? (font.tipo === 'helper' ? (font.peso?.lit.value ?? st.pesoFijo?.value ?? 400) : font.peso) : null;
  const tamValue = font ? (font.tipo === 'helper' ? font.tam?.lit.value : font.tam) : null;
  const familyInfo = fonts.find(f => f.familia === famValue);

  const setFamily = fam => {
    if (!font) return;
    if (font.tipo === 'helper' && font.familia) onEdit({ file: sel.loc.file, line: font.familia.line, col: font.familia.col, old: font.familia.old, value: fam });
    if (font.tipo === 'literal') onEdit({ file: sel.loc.file, line: font.line, col: font.lit.col, old: font.lit.text, value: quoteFor(font.lit, `${font.italic ? 'italic ' : ''}${font.peso} ${font.tam}px "${fam}", ${font.resto.split(',').slice(1).join(',').trim() || 'sans-serif'}`) });
  };
  const setWeight = w => {
    if (!font) return;
    if (font.tipo === 'helper') {
      if (font.peso) onEdit({ file: sel.loc.file, line: font.peso.line, col: font.peso.lit.col, old: font.peso.lit.text, value: String(w) });
      else if (st.pesoFijo) onEdit({ file: sel.loc.file, line: st.pesoFijo.line, col: st.pesoFijo.col, old: st.pesoFijo.old, value: String(w) });
    } else onEdit({ file: sel.loc.file, line: font.line, col: font.lit.col, old: font.lit.text, value: quoteFor(font.lit, `${font.italic ? 'italic ' : ''}${w} ${font.tam}px ${font.resto}`) });
  };
  const setSize = (v, final) => {
    if (!font) return;
    if (font.tipo === 'helper' && font.tam) return numEdit(font.tam, v, final);
    if (font.tipo === 'literal' && final) onEdit({ file: sel.loc.file, line: font.line, col: font.lit.col, old: font.lit.text, value: quoteFor(font.lit, `${font.italic ? 'italic ' : ''}${font.peso} ${v}px ${font.resto}`) });
  };
  const color = st?.color;
  const colorValue = color ? (color.tipo === 'literal' ? color.lit.value : color.def?.value) : (sel.color || null);
  const setColor = hex => {
    if (!color) return;
    if (color.tipo === 'literal') return onEdit({ file: sel.loc.file, line: color.line, col: color.lit.col, old: color.lit.text, value: color.lit.quote + hex + color.lit.quote });
    if (color.def) onEdit({ file: sel.loc.file, line: color.def.line, col: color.def.col, old: color.def.old, value: color.def.quote + hex + color.def.quote });
  };
  const detach = hex => color?.tipo === 'paleta' && onEdit({ file: sel.loc.file, line: color.line, col: color.refCol, old: color.nombre, value: `'${hex}'` });
  const usePalette = name => {
    if (!color) return;
    if (color.tipo === 'literal') onEdit({ file: sel.loc.file, line: color.line, col: color.lit.col, old: color.lit.text, value: name });
    else onEdit({ file: sel.loc.file, line: color.line, col: color.refCol, old: color.nombre, value: name });
  };
  const setAlign = v => st?.align && onEdit({ file: sel.loc.file, line: st.align.line, col: st.align.col, old: st.align.old, value: st.align.quote + v + st.align.quote });

  return { st, fonts, value, setValue, live, saveText, numEdit, font, famValue, pesoValue, tamValue, familyInfo, setFamily, setWeight, setSize, color, colorValue, setColor, detach, usePalette, setAlign };
}

export default function TextStyle({ sel, stamp, files, onEdit, onClose, onSeek, onAsk, onRelocate }) {
  const { st, fonts, value, setValue, live, saveText, font, famValue, pesoValue, tamValue, familyInfo, setFamily, setWeight, setSize, color, colorValue, setColor, detach, usePalette, setAlign, numEdit } = useTextModel({ sel, stamp, files, onEdit, onRelocate });
  const computed = 'Computed in the code. Ask Claude to change it.';

  return (
    <div className="inspector ts">
      <div className="insp-head">
        <TextIcon size={22} />
        <div className="grow"><div className="insp-title">Text</div><div className="insp-sub mono">{sel.loc.file}:{sel.loc.line}</div></div>
        <button className="icon-btn" onClick={onClose}><CloseCircle size={20} /></button>
      </div>
      <div className="section">
        <textarea className="ts-content" rows={2} value={value} onChange={e => setValue(e.target.value)} onBlur={() => saveText(value)}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } if (e.key === 'Escape') { setValue(sel.loc.lit.value); } }} />
        {sel.ranges?.length > 0 && <div className="chips-t"><Clock size={14} />{sel.ranges.slice(0, 4).map(([a, b], i) => <button key={i} className="tchip" onClick={() => onSeek(a + 0.01)}>{a.toFixed(1)}–{b.toFixed(1)} s</button>)}</div>}
      </div>
      {!st ? <div className="section dim">Reading the style…</div> : <>
        <div className="section">
          <div className="section-title"><TextIcon size={16} />Typography</div>
          <Row label="Family" off={!famValue && computed} shared={font?.tipo === 'helper' && font.usos > 1 ? `It's the font of ${font.helper}(): changes the ${font.usos} texts that use it.` : null}>
            <FontPick fonts={fonts.length ? fonts : famValue ? [{ familia: famValue, pesos: [] }] : []} value={famValue || '—'} onPick={setFamily} disabled={!famValue || (font?.tipo === 'helper' && !font.familia)} />
          </Row>
          <Row label="Weight" off={!font && computed}>
            <div className="seg ts-weights">{(familyInfo?.pesos.length ? familyInfo.pesos : [300, 400, 500, 700, 900]).map(w => <button key={w} className={+pesoValue === w ? 'on' : ''} onClick={() => setWeight(w)} style={{ fontWeight: w }}>{w}</button>)}</div>
          </Row>
          <Row label="Size" off={(!font || tamValue == null) && computed}>
            {tamValue != null && <div className="ts-size">
              <input type="range" min={8} max={Math.max(400, tamValue * 2)} value={live[font.tam?.lit?.col + ':' + font.tam?.line] ?? tamValue} onChange={e => setSize(+e.target.value, false)} onPointerUp={e => setSize(+e.currentTarget.value, true)} />
              <Scrub value={live[font.tam?.lit?.col + ':' + font.tam?.line] ?? tamValue} min={6} max={1000} unit=" px" onChange={v => setSize(v, false)} onCommit={v => setSize(v, true)} />
            </div>}
          </Row>
        </div>
        <div className="section">
          <div className="section-title"><Colorfilter size={16} />Color</div>
          <Row label="Color" off={!colorValue && computed} shared={color?.tipo === 'paleta' && color.usos > 1 ? `It's ${color.nombre} from the palette: changes everything that uses it (${color.usos} places).` : null}>
            {colorValue && <div className="ts-color">
              <label className="ts-swatch" style={{ background: colorValue }}><input type="color" value={colorValue.slice(0, 7)} onChange={e => setColor(e.target.value)} /></label>
              <span className="mono">{colorValue}</span>
              {color?.tipo === 'paleta' && <button className="ghost sm" onClick={() => detach(colorValue)} title="Use its own color only in this text">Only this text</button>}
            </div>}
          </Row>
          {st.palette.length > 0 && color && (
            <Row label="Palette">
              <div className="ts-palette">{st.palette.map(p => <button key={p.nombre} title={`${p.nombre} ${p.value}`} className={`ts-chip ${color.nombre === p.ref ? 'on' : ''}`} style={{ background: p.value }} onClick={() => usePalette(p.ref)} />)}</div>
            </Row>
          )}
        </div>
        <div className="section">
          <div className="section-title"><TextalignCenter size={16} />Position</div>
          <Row label="Alignment" off={!st.align && 'The alignment is not written near this text.'}>
            <div className="seg">{[['left', TextalignLeft], ['center', TextalignCenter], ['right', TextalignRight]].map(([k, I]) => <button key={k} className={st.align?.value === k ? 'on' : ''} onClick={() => setAlign(k)}><I size={16} /></button>)}</div>
          </Row>
          {['x', 'y'].map(k => (
            <Row key={k} label={k === 'x' ? 'Horizontal' : 'Vertical'} off={!st[k] && computed}>
              {st[k] && <div className="ts-pos"><Scrub value={live[st[k].lit.col + ':' + st[k].line] ?? st[k].lit.value} min={-4000} max={8000} onChange={v => numEdit(st[k], v, false)} onCommit={v => numEdit(st[k], v, true)} /><span className="dim mono small ellipsis" title={st[k].expr}>{st[k].expr}</span></div>}
            </Row>
          ))}
        </div>
        <div className="section">
          <div className="section-title"><MagicStar size={16} />More styles</div>
          <div className="ts-asks">
            {[['Shadow', 'add a soft shadow to'], ['Outline', 'add a thin outline to'], ['Spacing', 'adjust the letter spacing so it breathes, in'], ['Animated entrance', 'make an entrance animation that fits the style for'], ['Another font', 'suggest and load another Google Fonts typeface that works with the style, and apply it to']].map(([l, v]) => (
              <button key={l} className="ghost sm" onClick={() => onAsk(`Please ${v} the text "${value}" (${sel.loc.file}:${sel.loc.line}). Keep the values as literals so I can edit them in the editor.`, { texto: value, linea: sel.loc.line })}>{l}</button>
            ))}
          </div>
        </div>
      </>}
    </div>
  );
}

function MiniPop({ open, anchor, children, width = 260 }) {
  const style = useFloating(open, anchor, { width, align: 'left' });
  if (!open) return null;
  return <div className="ms-pop floating tb-pop" style={style || { visibility: 'hidden' }} onPointerDown={e => e.stopPropagation()}>{children}</div>;
}

export function TextToolbar({ sel, stamp, files, onEdit, onRelocate, onEditText, onMore, style }) {
  const m = useTextModel({ sel, stamp, files, onEdit, onRelocate });
  const [pop, setPop] = useState(null);
  const famRef = useRef(null), colRef = useRef(null);
  useEffect(() => {
    if (!pop) return;
    const close = e => { if (!e.target.closest?.('.tb-pop') && !e.target.closest?.('.tb-trigger')) setPop(null); };
    addEventListener('pointerdown', close, true);
    return () => removeEventListener('pointerdown', close, true);
  }, [pop]);
  const sizeKey = m.font?.tam?.lit ? m.font.tam.lit.col + ':' + m.font.tam.line : null;
  const size = sizeKey ? (m.live[sizeKey] ?? m.tamValue) : m.tamValue;
  const weights = m.familyInfo?.pesos.length ? m.familyInfo.pesos : [300, 400, 500, 700, 900];
  const align = m.st?.align?.value;
  return (
    <div className="tb" style={style} onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
      <button className="tb-btn tb-edit" title="Edit the text (double click)" onClick={onEditText}><TextIcon size={16} />Edit</button>
      <span className="tb-sep" />
      <button ref={famRef} className={`tb-btn tb-trigger tb-font ${pop === 'fam' ? 'on' : ''}`} disabled={!m.famValue} title={m.font?.tipo === 'helper' && m.font.usos > 1 ? `Changes the ${m.font.usos} texts that use ${m.font.helper}()` : 'Font'} onClick={() => setPop(p => p === 'fam' ? null : 'fam')}>
        <span style={{ fontFamily: `"${m.famValue}"` }}>{m.famValue || 'Font'}</span><ArrowDown2 size={12} />
      </button>
      <MiniPop open={pop === 'fam'} anchor={famRef} width={280}>
        <div className="ms-list">
          {(m.fonts.length ? m.fonts : [{ familia: m.famValue, pesos: [] }]).map(f => (
            <button key={f.familia} className={`ms-row ${f.familia === m.famValue ? 'on' : ''}`} onClick={() => { m.setFamily(f.familia); setPop(null); }}>
              <span className="ms-row-name ts-font-sample" style={{ fontFamily: `"${f.familia}"` }}>{f.familia}</span><span className="ms-row-meta">{f.pesos.join(' · ')}</span>
            </button>
          ))}
        </div>
      </MiniPop>
      <div className="tb-weights">
        {weights.map(w => <button key={w} className={`tb-btn ${+m.pesoValue === w ? 'on' : ''}`} style={{ fontWeight: w }} disabled={!m.font} onClick={() => m.setWeight(w)} title={`Weight ${w}`}>{w}</button>)}
      </div>
      <span className="tb-sep" />
      {size != null
        ? <Scrub value={size} min={6} max={1000} unit="" onChange={v => m.setSize(v, false)} onCommit={v => m.setSize(v, true)} />
        : <span className="tb-off" title="The size is computed in the code">—</span>}
      <span className="tb-sep" />
      <button ref={colRef} className="tb-btn tb-trigger tb-color" disabled={!m.colorValue} title={m.color?.tipo === 'paleta' ? `${m.color.nombre} from the palette` : 'Color'} onClick={() => setPop(p => p === 'col' ? null : 'col')}>
        <i style={{ background: m.colorValue || 'transparent' }} />
      </button>
      <MiniPop open={pop === 'col'} anchor={colRef} width={236}>
        <div className="tb-colors">
          <label className="tb-native"><span className="ts-swatch" style={{ background: m.colorValue }}><input type="color" value={(m.colorValue || '#ffffff').slice(0, 7)} onChange={e => m.setColor(e.target.value)} /></span><span className="mono">{m.colorValue}</span></label>
          {m.color?.tipo === 'paleta' && <div className="dim small">It's {m.color.nombre}: changes everything that uses it.</div>}
          <div className="ts-palette">{(m.st?.palette || []).map(p => <button key={p.nombre} title={`${p.nombre} ${p.value}`} className={`ts-chip ${m.color?.nombre === p.ref ? 'on' : ''}`} style={{ background: p.value }} onClick={() => m.usePalette(p.ref)} />)}</div>
          {m.color?.tipo === 'paleta' && <button className="ghost sm" onClick={() => { m.detach(m.colorValue); setPop(null); }}>Own color for this text only</button>}
        </div>
      </MiniPop>
      <span className="tb-sep" />
      <div className="tb-align">
        {[['left', TextalignLeft], ['center', TextalignCenter], ['right', TextalignRight]].map(([k, I]) => <button key={k} className={`tb-btn ${align === k ? 'on' : ''}`} disabled={!m.st?.align} title={m.st?.align ? '' : 'The alignment is not written near this text'} onClick={() => m.setAlign(k)}><I size={16} /></button>)}
      </div>
      <span className="tb-sep" />
      <button className="tb-btn" title="All options" onClick={onMore}><More size={16} /></button>
    </div>
  );
}
