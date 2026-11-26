import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Pause, Previous, Next, Repeat, Mouse, Location, Crop, MagicStar, Messages3, FolderOpen, Layer, Code, VolumeHigh, VolumeSlash,
  Refresh2, CloseCircle, Warning2, VideoPlay, VolumeLow1, TickCircle, Export, Maximize4, Maximize3, Add, FolderOpen as Open, Clock, ArrowRotateLeft as Undo, ArrowRotateRight as Redo,
  Keyboard, InfoCircle, Box1, Camera, DocumentDownload, Copy, Eye, Headphone, Music, Trash, ArrowSwapHorizontal, Size, Colorfilter, Magicpen,
  AlignHorizontally, AlignVertically, Maximize1, Send2, SidebarLeft, SidebarRight, RowVertical, Hierarchy, Edit2, TickSquare, Setting4, Grid5, Minus, SearchZoomIn, Link21, SearchNormal1, Gallery, ArrowDown2, ExportSquare, ImportSquare,
} from 'iconsax-reactjs';
import Tour, { tourPending, markTour } from './Tour.jsx';
const markTourDone = () => markTour(false);
import { MenuBar, ContextMenu, FolderPicker, nativePick, Connections, GenerateImage, SoundSearch, NewVideo, Skills, Shortcuts, About, Welcome } from './Menus.jsx';
import { sourceOf } from './Inspector.jsx';
import Stage, { Renderer } from './Stage.jsx';
import Timeline from './Timeline.jsx';
import Inspector, { CodeWindow } from './Inspector.jsx';
import Notes from './Notes.jsx';
import Chat from './Chat.jsx';
import Files from './Files.jsx';
import CodeMap from './CodeMap.jsx';
import ExportModal from './Export.jsx';
import Texts, { findTextLiteral, quoteFor, scanTexts } from './Texts.jsx';
import TextStyle, { relocate, TextToolbar, analyzeText, projectFonts } from './TextStyle.jsx';
import { api, connect, clamp, tc, hit, chainOf, groupBox, describeOp, frameKey, literals, formatNumber, Sound } from './lib.js';

const VIEW_EXT = /\.(html|js|mjs|json|css|png|jpe?g|webp|gif|svg|woff2?|ttf|glb|gltf)$/i;

function summarize(op) {
  if (!op) return null;
  const chain = chainOf(op);
  return {
    que: describeOp(op),
    caja: op.box,
    cadena: chain.map(f => `${f.fn} (${f.file}:${f.line})`),
    texto: op.texto, imagen: op.src, color: typeof op.color === 'string' ? op.color : undefined, fuente: op.fuente,
  };
}

// Everything the probe knows about one draw call, for agents.
function detail(op) {
  const chain = chainOf(op);
  const top = op.stack[0];
  return {
    ...summarize(op), i: op.i, kind: op.kind, alpha: op.alpha, blend: op.blend, ancho: op.ancho,
    id: `${op.kind}@${top ? `${top.file}:${top.line}:${top.col}` : 'page'}`,
    marcos: chain.map(f => ({ fn: f.fn, file: f.file, line: f.line, col: f.col })),
  };
}

function groupOps(ops) {
  const groups = new Map();
  for (const op of ops) {
    const ch = chainOf(op).map(f => f.fn);
    const sig = ch.slice(0, Math.min(ch.length, 2)).join(' ← ') || op.kind;
    const g = groups.get(sig) || { funcion: sig, origen: op.stack[0] ? `${op.stack[0].file}:${op.stack[0].line}` : '', llamadas: 0, x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9, z: 0, alpha: 0, textos: new Set(), imagenes: new Set() };
    g.llamadas++; g.x0 = Math.min(g.x0, op.box.x); g.y0 = Math.min(g.y0, op.box.y); g.x1 = Math.max(g.x1, op.box.x + op.box.w); g.y1 = Math.max(g.y1, op.box.y + op.box.h); g.z = Math.max(g.z, op.i); g.alpha = Math.max(g.alpha, op.alpha ?? 1);
    if (op.texto) g.textos.add(op.texto); if (op.src) g.imagenes.add(op.src);
    groups.set(sig, g);
  }
  return [...groups.values()].map(g => ({ funcion: g.funcion, origen: g.origen, llamadas: g.llamadas, z: g.z, alpha: +g.alpha.toFixed(3), caja: { x: g.x0, y: g.y0, w: g.x1 - g.x0, h: g.y1 - g.y0 }, textos: [...g.textos].slice(0, 6), imagenes: [...g.imagenes].slice(0, 6) }));
}

function timeRanges(times, stepT) {
  const out = [];
  for (const t of [...times].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && t - last[1] <= stepT * 1.6) last[1] = t; else out.push([t, t]);
  }
  return out.map(([a, b]) => [+a.toFixed(2), +(b + stepT).toFixed(2)]);
}

// Top-level arguments of the call that opens at column `open` of a line, with their columns.
function callArgs(line, open) {
  const args = []; let d = 0, start = open + 1;
  for (let i = open + 1; i < line.length; i++) {
    const ch = line[i];
    if ('([{'.includes(ch)) d++;
    else if (')]}'.includes(ch)) { if (!d) { args.push([start, i]); break; } d--; }
    else if (ch === ',' && !d) { args.push([start, i]); start = i + 1; }
  }
  return args.map(([a, b]) => { const raw = line.slice(a, b); return { col: a + raw.length - raw.trimStart().length, text: raw.trim() }; }).filter(x => x.text);
}
const pureNumber = s => /^-?(\d+\.?\d*|\.\d+)$/.test(s || '');

// Where each style of a drawn text is decided, following helpers like title(g, 'Hi', x, y, size) into their body
// and mapping their parameters back to the literals at the call site.
async function textStyleModel(loc, stamp) {
  const lines = await sourceOf(loc.file, stamp);
  const st = await analyzeText(loc, stamp);
  const line = lines[loc.line - 1];
  let helper = null;
  let d = 0, open = -1;
  for (let i = loc.lit.col - 1; i >= 0; i--) { const ch = line[i]; if (ch === ')' || ch === ']') d++; else if (ch === '(' || ch === '[') { if (!d) { open = i; break; } d--; } }
  const fn = open >= 0 ? (line.slice(0, open).match(/([A-Za-z_$][\w$]*)\s*$/) || [])[1] : null;
  if (fn && !/^(fillText|strokeText)$/.test(fn)) {
    const def = lines.findIndex(l => new RegExp(`function\\s+${fn}\\s*\\(|\\b${fn}\\s*=\\s*(?:async\\s*)?\\(`).test(l));
    let draw = -1;
    if (def >= 0) for (let i = def; i < Math.min(lines.length, def + 80); i++) if (/\.(fillText|strokeText)\s*\(/.test(lines[i])) { draw = i; break; }
    if (draw >= 0) {
      const m = lines[draw].match(/\.(fillText|strokeText)\s*\(\s*/);
      const col = m.index + m[0].length, first = lines[draw].slice(col).match(/^[^,)]*/)[0];
      const params = ((lines[def].match(/\(([^)]*)\)/) || [])[1] || '').split(',').map(p => p.trim());
      const names = params.map(p => p.replace(/\s*=.*$/, ''));
      const args = callArgs(line, open);
      helper = { fn, line: def + 1, names, params, args, inner: await analyzeText({ file: loc.file, line: draw + 1, lit: { col, text: first, value: first, kind: 'texto' } }, stamp), drawLine: draw + 1 };
      helper.viaParam = expr => { const i = names.indexOf((expr || '').trim()); return i >= 0 ? { i, arg: args[i] || null, name: names[i], def: params[i].includes('=') ? params[i].replace(/^[^=]*=\s*/, '') : null } : null; };
    }
  }
  const at = (ln, col, old, value, extra) => ({ line: ln, col, old, value, ...extra });
  const paletteDef = name => {
    const key = name.split('.').pop();
    const di = lines.findIndex(l => new RegExp(`\\b${key}\\s*:\\s*(['"])#[0-9a-fA-F]{3,8}\\1`).test(l));
    if (di < 0) return null;
    const dm = lines[di].match(new RegExp(`\\b${key}\\s*:\\s*(['"])(#[0-9a-fA-F]{3,8})\\1`));
    return at(di + 1, dm.index + dm[0].indexOf(dm[1]), `${dm[1]}${dm[2]}${dm[1]}`, dm[2], { quote: dm[1] });
  };
  const fontOf = (src, scope) => {
    const f = src.font;
    if (!f) return null;
    if (f.tipo === 'literal') return { scope, literal: { line: f.line, lit: f.lit, italic: f.italic, peso: f.peso, tam: f.tam, familia: f.familia, resto: f.resto } };
    const fl = lines[f.line - 1], fm = fl.match(/\.font\s*=\s*[A-Za-z_$][\w$]*\s*\(/);
    const out = { scope, helper: f.helper, usos: f.usos, familia: f.familia ? at(f.familia.line, f.familia.col, f.familia.old, f.familia.value) : null, peso: null, tam: null };
    const parts = fm ? callArgs(fl, fm.index + fm[0].length - 1) : [];
    const vals = parts.map(p => {
      if (pureNumber(p.text)) return { ...at(f.line, p.col, p.text, +p.text), name: null, scope };
      const vp = scope === 'helper' && helper?.viaParam(p.text);
      if (vp?.arg && pureNumber(vp.arg.text)) return { ...at(loc.line, vp.arg.col, vp.arg.text, +vp.arg.text), name: vp.name, scope: 'this_call' };
      return { name: p.text, value: null };
    });
    const isWeight = v => (v.name && /weight|peso|bold/i.test(v.name)) || (v.value != null && v.value >= 100 && v.value <= 900 && v.value % 100 === 0 && vals.length > 1 && !(v.name && /size|px|tam/i.test(v.name)));
    const w = vals.find(isWeight), s = vals.find(v => v !== w && (v.value != null || /size|px|tam/i.test(v.name || '')));
    out.peso = w && w.value != null ? w : src.pesoFijo ? { ...at(src.pesoFijo.line, src.pesoFijo.col, src.pesoFijo.old, src.pesoFijo.value), scope } : null;
    out.tam = s && s.value != null ? s : null;
    return out;
  };
  const colorOf = (src, scope, ln0) => {
    const c = src.color;
    if (c?.tipo === 'literal') return { scope, literal: at(c.line, c.lit.col, c.lit.text, c.lit.value, { quote: c.lit.quote }) };
    if (c?.tipo === 'paleta') return { scope, paleta: { nombre: c.nombre, ref: at(c.line, c.refCol, c.nombre, c.nombre), def: c.def ? at(c.def.line, c.def.col, c.def.old, c.def.value, { quote: c.def.quote }) : null, usos: c.usos } };
    if (scope !== 'helper') return null;
    for (let i = ln0 - 1; i >= helper.line - 1; i--) {
      const m = lines[i].match(/\.fillStyle\s*=\s*([A-Za-z_$][\w$]*)\s*;?\s*$/);
      if (!m) continue;
      const vp = helper.viaParam(m[1]);
      if (!vp) return null;
      const src2 = vp.arg ? { text: vp.arg.text, line: loc.line, col: vp.arg.col, scope: 'this_call' } : vp.def ? { text: vp.def, line: helper.line, col: lines[helper.line - 1].indexOf(vp.def, lines[helper.line - 1].indexOf(vp.name)), scope: 'helper_default' } : null;
      if (!src2) return null;
      const q = src2.text.match(/^(['"])(#[0-9a-fA-F]{3,8})\1$/);
      if (q) return { scope: src2.scope, literal: at(src2.line, src2.col, src2.text, q[2], { quote: q[1] }) };
      if (/^[A-Za-z_$][\w$]*(\.[\w$]+)+$/.test(src2.text)) return { scope: src2.scope, paleta: { nombre: src2.text, ref: at(src2.line, src2.col, src2.text, src2.text), def: paletteDef(src2.text), usos: lines.filter(l => l.includes(src2.text)).length } };
      return null;
    }
    return null;
  };
  const font = fontOf(st, 'this_call') || (helper && fontOf(helper.inner, 'helper'));
  const color = colorOf(st, 'this_call') || (helper && colorOf(helper.inner, 'helper', helper.drawLine));
  const align = st.align ? { ...st.align, scope: 'this_call' } : helper?.inner.align ? { ...helper.inner.align, scope: 'helper' } : null;
  const xy = k => {
    const v = st[k];
    if (v && pureNumber(v.expr)) return { ...at(v.line, v.lit.col, v.lit.text, v.lit.value), expr: v.expr };
    return v ? { expr: v.expr } : null;
  };
  return { loc, font, color, align, x: xy('x'), y: xy('y'), palette: st.palette, helper: helper && { fn: helper.fn, line: helper.line } };
}

function textStyleEdits(md, c) {
  const { loc, font, color, align } = md;
  const E = [], skip = [];
  const add = (t, value) => E.push({ file: loc.file, line: t.line, col: t.col, old: t.old, value });
  if (c.texto != null) add({ line: loc.line, col: loc.lit.col, old: loc.lit.text }, quoteFor(loc.lit, c.texto));
  if (c.familia || c.peso || c.tamano || c.italica != null) {
    if (!font) skip.push('font: no ctx.font assignment found for this text');
    else if (font.literal) {
      const f = font.literal;
      const fam = c.familia ? `"${c.familia}", ${f.resto.split(',').slice(1).join(',').trim() || 'sans-serif'}` : f.resto;
      add({ line: f.line, col: f.lit.col, old: f.lit.text }, quoteFor(f.lit, `${(c.italica ?? f.italic) ? 'italic ' : ''}${c.peso ?? f.peso} ${c.tamano ?? f.tam}px ${fam}`));
    } else {
      if (c.familia) { if (font.familia) add(font.familia, c.familia); else skip.push('family: the font helper has no literal family'); }
      if (c.peso) { if (font.peso) add(font.peso, String(c.peso)); else skip.push('weight: no literal weight'); }
      if (c.tamano) { if (font.tam) add(font.tam, formatNumber(+c.tamano, font.tam.old)); else skip.push('size: no literal size'); }
      if (c.italica != null) skip.push('italic: only possible when the font is a literal string');
    }
  }
  if (c.color) {
    if (!color) skip.push('color: no fillStyle found for this text');
    else if (color.literal) add(color.literal, color.literal.quote + c.color + color.literal.quote);
    else if (c.color_alcance === 'solo_este') add(color.paleta.ref, `'${c.color}'`);
    else if (color.paleta.def) add(color.paleta.def, color.paleta.def.quote + c.color + color.paleta.def.quote);
    else skip.push('color: the palette entry has no literal definition');
  }
  if (c.paleta) {
    if (!color) skip.push('palette: no fillStyle found for this text');
    else add(color.literal || color.paleta.ref, c.paleta);
  }
  if (c.alineacion) { if (align) add(align, align.quote + c.alineacion + align.quote); else skip.push('align: no textAlign literal for this text'); }
  for (const k of ['x', 'y']) {
    if (c[k] == null) continue;
    if (md[k]?.line) add(md[k], formatNumber(+c[k], md[k].old)); else skip.push(`${k}: the ${k} argument is ${md[k] ? `the expression ${md[k].expr}` : 'missing'}, not a literal number`);
  }
  return { E: E.sort((p, q) => p.line - q.line || q.col - p.col), skip };
}

// ?welcome=new shows the welcome as a first-time user sees it, without this computer's connections.
// ?tour starts the quick tour as soon as a video is open.
let TOUR_NOW = new URLSearchParams(location.search).has('tour');
const WELCOME_PREVIEW = new URLSearchParams(location.search).get('welcome') === 'new';

export default function App() {
  const stage = useRef(null);
  const sound = useRef(new Sound());
  const wsRef = useRef(null);
  const [proj, setProj] = useState(null);
  const [error, setError] = useState(null);
  const [stamp, setStamp] = useState(1);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [t, setT] = useState(0);
  const tRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(() => { try { return +(localStorage.getItem('estudio.volumen') ?? 0.9); } catch { return 0.9; } });
  const [tool, setTool] = useState('inspeccionar');
  const [ops, setOps] = useState(null);
  const [hover, setHover] = useState(null);
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState(null);
  const [notes, setNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState(null);
  const [audio, setAudio] = useState(null);
  const [audioState, setAudioState] = useState(null);
  const [busState, setBus] = useState({});
  const [pickedEvent, setPickedEvent] = useState(null);
  const [thumbs, setThumbs] = useState([]);
  const [sizes, setSizes] = useState(() => { try { return { left: 300, right: 420, tl: 300, ...JSON.parse(localStorage.getItem('estudio.tamanos') || '{}') }; } catch { return { left: 300, right: 420, tl: 300 }; } });
  const setSize = (k, fn) => setSizes(s => { const n = { ...s, [k]: fn(s[k]) }; try { localStorage.setItem('estudio.tamanos', JSON.stringify(n)); } catch { } return n; });
  const [focus, setFocus] = useState(false);
  const [right, setRight] = useState('inspector');
  const [codeFile, setCodeFile] = useState(null);
  const [centerTab, setCenterTab] = useState('video');
  const [playerMode, setPlayerMode] = useState('dock');
  const [zoom, setZoom] = useState(1);
  const [win, setWin] = useState(() => { try { return JSON.parse(localStorage.getItem('estudio.ventana')) || null; } catch { return null; } });
  useEffect(() => { try { if (win) localStorage.setItem('estudio.ventana', JSON.stringify(win)); } catch { } }, [win]);
  const [messages, setMessages] = useState([]);
  const [live, setLive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState(() => { try { return localStorage.getItem('estudio.modelo') || 'opus'; } catch { return 'opus'; } });
  const [context, setContext] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [flash, setFlash] = useState(null);
  const [refs, setRefs] = useState([]);
  const [saving, setSaving] = useState(null);
  const [exp, setExp] = useState(null);
  const edits = useRef({});
  const stampRef = useRef(1);
  const playRef = useRef(null);
  const [modal, setModal] = useState(null);
  const [recents, setRecents] = useState([]);
  const [hist, setHist] = useState({});
  const [confirmMove, setConfirmMove] = useState(() => { try { return localStorage.getItem('estudio.confirmarMover') !== 'no'; } catch { return true; } });
  const [ghost, setGhost] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [panels, setPanels] = useState(() => { try { return { left: true, right: true, timeline: true, ...JSON.parse(localStorage.getItem('estudio.paneles') || '{}') }; } catch { return { left: true, right: true, timeline: true }; } });
  const [toast, setToast] = useState(null);
  const [labels, setLabels] = useState({ pistas: {}, sonidos: {} });
  const [placing, setPlacing] = useState(null);
  const [textEdit, setTextEdit] = useState(null);
  const [textSel, setTextSel] = useState(null);
  const [boot, setBoot] = useState({ on: !WELCOME_PREVIEW, proyecto: false, video: false, sonido: false, cuadros: false });
  useEffect(() => { api('etiquetas').then(setLabels).catch(() => { }); }, []);
  const rename = async (tipo, clave, nombre) => setLabels(await api('etiquetas', { method: 'POST', body: { tipo, clave: String(clave), nombre } }));
  const promptRename = (tipo, clave, actual) => setModal({ tipo: 'renombrar', clase: tipo, clave, actual });
  const queue = useRef([]);
  const busyRef = useRef(false);
  const chatInput = useRef(null);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => { try { localStorage.setItem('estudio.paneles', JSON.stringify(panels)); } catch { } }, [panels]);
  useEffect(() => { try { localStorage.setItem('estudio.confirmarMover', confirmMove ? 'si' : 'no'); } catch { } }, [confirmMove]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 3200); return () => clearTimeout(id); }, [toast]);
  useEffect(() => { api('recientes').then(setRecents).catch(() => { }); api('historial').then(setHist).catch(() => { }); }, []);

  const dur = info?.duracion || 0;
  const fps = info?.fps || 30;

  const loadProject = useCallback(async () => {
    try {
      const p = await api('proyecto');
      setProj(p); setError(null); setBoot(b => ({ ...b, proyecto: true, sonido: b.sonido || !p.sonido }));
      setNotes(await api('notas'));
      setRefs(await api('referencias'));
      setMessages(await api('chat/historial'));
      setBusy(p.chat.ocupado);
      // After a reload, pick up what Claude is doing and any export in progress.
      if (p.chat.ocupado) { const v = await api('chat/vivo').catch(() => null); if (v) { setLive({ texto: v.texto, herramientas: v.herramientas, inicio: v.inicio, estado: v.estado, tokens: v.tokens, pregunta: v.pregunta }); busyRef.current = true; } }
      api('exportar/estado').then(j => j && setExp(j)).catch(() => { });
    } catch (e) { setError(e.message); setBoot(b => ({ ...b, on: false })); }
  }, []);
  useEffect(() => { if (!boot.on) return; const id = setTimeout(() => setBoot(b => ({ ...b, on: false })), 25000); return () => clearTimeout(id); }, [boot.on]);

  const loadAudio = useCallback(async () => {
    try {
      const r = await fetch(`/proyecto/.estudio/audio/events.json?v=${Date.now()}`);
      if (!r.ok) return;
      const data = await r.json();
      setAudio(data);
      await sound.current.load(data.buses, Date.now());
    } catch (e) { console.warn(e); }
    finally { setBoot(b => ({ ...b, sonido: true })); }
  }, []);

  useEffect(() => { loadProject(); loadAudio(); }, [loadProject, loadAudio]);

  const seek = useCallback((nt, scrub = false) => {
    nt = clamp(nt, 0, Math.max(0, dur - 1 / fps));
    tRef.current = nt; setT(nt);
    stage.current?.seek(nt);
    if (scrub) sound.current.blip(nt);
    if (playRef.current) { sound.current.play(nt); playRef.current.t0 = nt; playRef.current.p0 = performance.now(); }
  }, [dur, fps]);

  const pause = useCallback(() => {
    if (!playRef.current) return;
    cancelAnimationFrame(playRef.current.raf);
    playRef.current = null;
    sound.current.stop();
    setPlaying(false);
    stage.current?.setFast(false);
    const snapped = Math.round(tRef.current * fps) / fps;
    tRef.current = snapped; setT(snapped);
    stage.current?.seek(snapped);
  }, [fps]);

  const play = useCallback(() => {
    if (playRef.current || !dur) return;
    let from = tRef.current >= dur - 1 / fps ? 0 : tRef.current;
    stage.current?.setFast(true);
    const hasAudio = Object.keys(sound.current.buffers).length > 0;
    if (hasAudio) sound.current.play(from);
    const st = { t0: from, p0: performance.now(), raf: 0 };
    playRef.current = st;
    setPlaying(true);
    setSel(null); setHover(null);
    const tick = () => {
      if (playRef.current !== st) return;
      // The browser keeps the sound suspended until a click; then the clock is the wall clock.
      let nt = hasAudio && sound.current.ctx?.state === 'running' ? sound.current.now() : st.t0 + (performance.now() - st.p0) / 1000;
      if (nt >= dur) {
        if (loopRef.current) { nt = 0; st.t0 = 0; st.p0 = performance.now(); if (hasAudio) sound.current.play(0); }
        else { tRef.current = dur - 1 / fps; pause(); return; }
      }
      tRef.current = nt; setT(nt);
      stage.current?.seek(nt);
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
  }, [dur, fps, pause]);

  const toggle = useCallback(() => (playRef.current ? pause() : play()), [pause, play]);

  // Inspect the paused frame so hover and clicks answer instantly.
  useEffect(() => {
    if (playing || loading || !info) return;
    let on = true;
    const id = setTimeout(async () => {
      const at = tRef.current;
      const data = await stage.current?.inspect(at).catch(() => null);
      if (on && data && Math.abs(at - tRef.current) < 1e-6) setOps({ t: at, ...data });
    }, 140);
    return () => { on = false; clearTimeout(id); };
  }, [t, playing, loading, info, stamp]);

  const opsNow = ops && Math.abs(ops.t - t) < 1e-6 ? ops : null;

  const pickAt = useCallback((x, y) => {
    if (!opsNow) return null;
    const under = hit(opsNow.ops, x, y, opsNow.ancho, opsNow.alto);
    return under.length ? { under, op: under[0] } : null;
  }, [opsNow]);

  const select = useCallback((op, under, x, y) => {
    setPickedEvent(null);
    setTextSel(null);
    if (op.kind === 'texto' && op.texto?.trim()) { const at = tRef.current; findTextLiteral(op, stampRef.current).then(loc => loc && setTextSel({ key: `${loc.file}:${loc.line}:${loc.lit.col}`, loc, box: op.box, t: at, color: typeof op.color === 'string' ? op.color : null })); }
    const s = { t: tRef.current, x, y, op, under, level: 0, box: op.box };
    setSel(s);
    setRight(r => r === 'claude' ? r : 'inspector');
    setContext({ label: `${describeOp(op)} · ${tRef.current.toFixed(2)} s`, data: { t: tRef.current, x: Math.round(x), y: Math.round(y), ...summarize(op) } });
  }, []);

  useEffect(() => {
    if (!sel || !opsNow) return;
    if (Math.abs(sel.t - t) > 1e-6) return;
    const again = pickAt(sel.x, sel.y);
    if (!again) return;
    const same = again.under.find(o => o.stack[0] && sel.op.stack[0] && o.stack[0].line === sel.op.stack[0].line && o.kind === sel.op.kind) || again.op;
    if (same.i !== sel.op.i || same.box.x !== sel.op.box.x || same.box.w !== sel.op.box.w) setSel(s => s && ({ ...s, op: same, under: again.under, box: s.level ? s.box : same.box }));
  }, [opsNow]);

  const pickLevel = (level, key) => {
    if (!sel || !opsNow) return;
    const chain = chainOf(sel.op);
    const box = level === 0 ? sel.op.box : groupBox(opsNow.ops, key) || sel.op.box;
    setSel({ ...sel, level, box, label: chain[level]?.fn });
  };

  // Stage pointer handling
  const onStageDown = e => {
    if (e.button !== 0 || !info) return;
    const p = stage.current.toCanvas(e.clientX, e.clientY);
    if (p.x < 0 || p.y < 0 || p.x > info.ancho || p.y > info.alto) return;
    e.preventDefault();
    if (playing) pause();
    if (tool === 'inspeccionar') {
      if (ghost && ghost.estado !== 'arrastrando') return;
      const h = pickAt(p.x, p.y);
      const inSel = sel && Math.abs(sel.t - tRef.current) < 1e-6 && p.x >= sel.box.x && p.x <= sel.box.x + sel.box.w && p.y >= sel.box.y && p.y <= sel.box.y + sel.box.h;
      const target = inSel ? sel : h ? { op: h.op, under: h.under, level: 0, box: h.op.box } : null;
      if (!inSel) { if (h) select(h.op, h.under, p.x, p.y); else setSel(null); }
      if (target && target.box.w * target.box.h < info.ancho * info.alto * 0.85) startDrag(e, p, target);
      return;
    }
    if (tool === 'punto') {
      const h = pickAt(p.x, p.y);
      setDraft({ tipo: 'punto', t: tRef.current, x: Math.round(p.x), y: Math.round(p.y), op: h?.op });
      return;
    }
    if (tool === 'zona') {
      const x0 = p.x, y0 = p.y;
      setDraft({ tipo: 'zona', t: tRef.current, x: x0, y: y0, w: 0, h: 0, drawing: true });
      const move = ev => {
        const q = stage.current.toCanvas(ev.clientX, ev.clientY);
        const x = clamp(q.x, 0, info.ancho), y = clamp(q.y, 0, info.alto);
        setDraft(d => d && { ...d, x: Math.min(x0, x), y: Math.min(y0, y), w: Math.abs(x - x0), h: Math.abs(y - y0) });
      };
      const up = () => {
        removeEventListener('pointermove', move); removeEventListener('pointerup', up);
        setDraft(d => d && (d.w < 8 || d.h < 8 ? null : { ...d, x: Math.round(d.x), y: Math.round(d.y), w: Math.round(d.w), h: Math.round(d.h), drawing: false }));
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    }
  };
  const ghostFor = async (target, dx = 0, dy = 0) => {
    const chain = chainOf(target.op);
    const level = target.level || 0;
    const key = level ? frameKey(chain[level].caller || chain[level]) : frameKey(chain[0]);
    const label = level ? chain[level].fn : describeOp(target.op);
    const g = { t: tRef.current, key, label, op: target.op, box: target.box, dx, dy, estado: 'arrastrando' };
    const imgs = await stage.current.isolated(g.t, key);
    return { ...g, ...(imgs || {}) };
  };

  const startDrag = (e, p0, target) => {
    const sx = e.clientX, sy = e.clientY;
    const scale = stage.current.box().scale;
    let started = false, pending = null, last = { dx: 0, dy: 0 };
    const move = ev => {
      if (!started) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
        started = true;
        setHover(null);
        setGhost({ t: tRef.current, label: target.level ? chainOf(target.op)[target.level].fn : describeOp(target.op), op: target.op, box: target.box, dx: 0, dy: 0, estado: 'arrastrando' });
        pending = ghostFor(target).then(g => setGhost(cur => cur && { ...g, dx: cur.dx, dy: cur.dy, estado: cur.estado }));
      }
      let dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale;
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      last = { dx: Math.round(dx), dy: Math.round(dy) };
      setGhost(g => g && { ...g, ...last });
    };
    const up = async () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up);
      if (!started) return;
      if (Math.abs(last.dx) < 2 && Math.abs(last.dy) < 2) { setGhost(null); return; }
      await pending;
      if (confirmMove) setGhost(g => g && { ...g, estado: 'confirmar' });
      else setGhost(g => { if (g) applyMove(g, 'siempre'); return g && { ...g, estado: 'aplicando' }; });
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  };

  const composite = async g => {
    if (!g.without || !g.only) return stage.current.capture(g.t, { type: 'image/jpeg', quality: 0.88, width: 1280 });
    const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const [a, b] = await Promise.all([load(g.without), load(g.only)]);
    const c = document.createElement('canvas'); c.width = 1280; c.height = Math.round(1280 * a.height / a.width);
    const k = c.width / a.width, x = c.getContext('2d');
    x.drawImage(a, 0, 0, c.width, c.height); x.drawImage(b, g.dx * k, g.dy * k, c.width, c.height);
    x.strokeStyle = '#ffb547'; x.lineWidth = 3; x.setLineDash([8, 6]);
    x.strokeRect(g.box.x * k, g.box.y * k, g.box.w * k, g.box.h * k);
    x.setLineDash([]); x.strokeRect((g.box.x + g.dx) * k, (g.box.y + g.dy) * k, g.box.w * k, g.box.h * k);
    return c.toDataURL('image/jpeg', 0.88);
  };

  const applyMove = async (g, alcance) => {
    setGhost(x => x && { ...x, estado: 'aplicando' });
    const chain = chainOf(g.op);
    const where = alcance === 'solo' ? ` only around ${g.t.toFixed(2)} s, without changing the rest of its animation` : ' along its whole path';
    const texto = `Move “${g.label}” ${g.dx} px on x and ${g.dy} px on y${alcance === 'solo' ? ` only at ${g.t.toFixed(2)} s` : ''}`;
    const nota = await api('notas', { method: 'POST', body: {
      tipo: 'mover', t: +g.t.toFixed(3), dx: g.dx, dy: g.dy, alcance, x: g.box.x + g.dx, y: g.box.y + g.dy, w: g.box.w, h: g.box.h, texto,
      elemento: chain.map(f => f.fn).join(' ← '), origen: chain.map(f => `${f.file}:${f.line}`).slice(0, 6), nivel: g.label, imagen: await composite(g),
    } });
    ask(`Apply note ${nota.id}: move “${g.label}” ${g.dx} px on x and ${g.dy} px on y, in video pixels,${where}. The note image shows the previous position (dashed) and the new one. Follow the note's origin to find where its position is defined, change the code (edit_literal is the quickest for a single number), check it with get_frame and close it with resolve_note.`, { t: g.t, nota: nota.id, elemento: nota.elemento });
  };

  const ask = async (texto, data, { silent } = {}) => {
    if (!silent) setRight('claude');
    const item = { texto, contexto: data ?? { t: +tRef.current.toFixed(3) } };
    if (busyRef.current) { queue.current.push(item); setToast('Queued: Claude will do it after the current task'); return; }
    busyRef.current = true;
    try { await api('chat', { method: 'POST', body: { ...item, modelo: model, adjuntos: [] } }); }
    catch (e) { busyRef.current = false; setError(e.message); }
  };

  const quickMove = async (target, dx, dy) => {
    dx = Math.round(dx); dy = Math.round(dy);
    if (!dx && !dy) { setToast('Already there'); return; }
    const g = await ghostFor(target, dx, dy);
    if (confirmMove) setGhost({ ...g, estado: 'confirmar' }); else { setGhost({ ...g, estado: 'aplicando' }); applyMove(g, 'siempre'); }
  };

  const savePng = async () => {
    const url = await stage.current.capture(null, { type: 'image/png' });
    const a = document.createElement('a'); a.href = url; a.download = `${proj?.name || 'cuadro'}-${tRef.current.toFixed(2)}s.png`; a.click();
  };

  const selectLevel = (op, under, p, level) => {
    const chain = chainOf(op);
    const box = level === 0 || !opsNow ? op.box : groupBox(opsNow.ops, frameKey(chain[level].caller || chain[level])) || op.box;
    setSel({ t: tRef.current, x: p.x, y: p.y, op, under, level, box });
    setRight('inspector');
  };

  const claudeAsks = (name, data) => [
    ['Bigger', `Make “${name}” 20% bigger without breaking its animation`],
    ['Smaller', `Make “${name}” 20% smaller without breaking its animation`],
    ['Another color', `Change the color of “${name}” to one that works with the video's palette`],
    ['Animate in', `Make “${name}” enter with an animation that fits the video's style`],
    ['Animate out', `Make “${name}” exit with an animation that fits the video's style`],
    ['Slower', `Make the animation of “${name}” 30% longer`],
    ['Faster', `Make the animation of “${name}” 30% shorter`],
    ['Remove it', `Remove “${name}” from the video`],
  ].map(([label, txt]) => ({ label, run: () => ask(txt, data) })).concat(['-', { label: 'Write a request', icon: <Edit2 size={16} />, run: () => { setContext({ label: `${name} · ${tRef.current.toFixed(2)} s`, data }); setRight('claude'); setTimeout(() => document.querySelector('.composer textarea')?.focus(), 50); } }]);

  const onStageContext = e => {
    e.preventDefault();
    if (!info) return;
    if (playing) pause();
    const p = stage.current.toCanvas(e.clientX, e.clientY);
    if (p.x < 0 || p.y < 0 || p.x > info.ancho || p.y > info.alto) return;
    const h = pickAt(p.x, p.y);
    const items = [];
    if (h) {
      const op = h.op, chain = chainOf(op), name = describeOp(op);
      select(op, h.under, p.x, p.y);
      const target = { op, under: h.under, level: 0, box: op.box };
      const data = { t: +tRef.current.toFixed(3), x: Math.round(p.x), y: Math.round(p.y), ...summarize(op) };
      items.push({ header: name });
      items.push({ label: 'Select', icon: <Hierarchy size={16} />, sub: chain.map((f, i) => ({ label: f.fn, hint: `${f.file}:${f.line}`, run: () => selectLevel(op, h.under, p, i) })) });
      items.push({ label: 'View its code', icon: <Code size={16} />, run: () => { setPickedEvent(null); setRight('inspector'); } });
      items.push('-');
      items.push({ label: 'Center', icon: <AlignHorizontally size={16} />, sub: [
        { label: 'Horizontally', icon: <AlignHorizontally size={16} />, run: () => quickMove(target, (info.ancho - op.box.w) / 2 - op.box.x, 0) },
        { label: 'Vertically', icon: <AlignVertically size={16} />, run: () => quickMove(target, 0, (info.alto - op.box.h) / 2 - op.box.y) },
        { label: 'In the frame', icon: <Maximize1 size={16} />, run: () => quickMove(target, (info.ancho - op.box.w) / 2 - op.box.x, (info.alto - op.box.h) / 2 - op.box.y) },
      ] });
      items.push({ label: 'Ask Claude', icon: <MagicStar size={16} />, sub: claudeAsks(name, data) });
      items.push('-');
      items.push({ label: 'Note on this', icon: <Location size={16} />, run: () => { setTool('punto'); setDraft({ tipo: 'punto', t: tRef.current, x: Math.round(p.x), y: Math.round(p.y), op }); } });
      items.push({ label: 'Note on its area', icon: <Crop size={16} />, run: () => setDraft({ tipo: 'zona', t: tRef.current, x: op.box.x, y: op.box.y, w: op.box.w, h: op.box.h, op }) });
      items.push({ label: 'Copy its location in the code', icon: <Copy size={16} />, run: () => navigator.clipboard.writeText(chain.map(f => `${f.fn} ${f.file}:${f.line}`).join('\n')).then(() => setToast('Copied')) });
    } else {
      items.push({ label: 'Note at this point', icon: <Location size={16} />, run: () => setDraft({ tipo: 'punto', t: tRef.current, x: Math.round(p.x), y: Math.round(p.y) }) });
      items.push({ label: 'Ask Claude', icon: <MagicStar size={16} />, run: () => { setContext({ label: `Frame at ${tRef.current.toFixed(2)} s`, data: { t: +tRef.current.toFixed(3), x: Math.round(p.x), y: Math.round(p.y) } }); setRight('claude'); setTimeout(() => document.querySelector('.composer textarea')?.focus(), 50); } });
    }
    items.push('-');
    items.push({ label: 'Attach the frame to the chat', icon: <Camera size={16} />, run: attachFrame });
    items.push({ label: 'Save the frame as PNG', icon: <DocumentDownload size={16} />, run: savePng });
    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  };

  const setGain = async (ev, factor) => {
    const lines = await sourceOf('sound.py', stamp);
    const line = lines[ev.line - 1] || '';
    const m = /gain\s*=\s*(\d+\.?\d*|\.\d+)(?![\w.])/.exec(line);
    if (!m) return ask(`${factor > 1 ? 'Raise the volume of' : factor === 0 ? 'Mute' : 'Lower the volume of'} the sound at sound.py line ${ev.line} at ${ev.t.toFixed(2)} s${factor ? ` (${factor > 1 ? '+' : ''}${(20 * Math.log10(factor)).toFixed(0)} dB)` : ''}, only that one, without touching the others on the same line if it is a loop.`, { sonido: ev });
    const col = m.index + m[0].indexOf(m[1]);
    const next = +(parseFloat(m[1]) * factor).toFixed(3);
    await onEdit({ file: 'sound.py', line: ev.line, col, old: m[1], value: String(next) });
    setToast(`Gain ${m[1]} → ${next}${ev.code.includes('for ') ? '' : ''}`);
  };

  const trackName = bus => labels.pistas[bus] || ({ music: 'Music', fx: 'Effects', drums: 'Percussion', voice: 'Voice' })[bus] || bus;
  const trackItems = (bus, renameInline) => {
    const name = trackName(bus);
    const data = { pista: bus, nombre: name, eventos: (audio?.eventos || []).filter(e => e.bus === bus).length };
    const music = bus === 'music';
    return [
      { header: `Whole track: ${name}` },
      { label: music ? 'Replace with free music' : 'Replace with free sounds', icon: <SearchNormal1 size={16} />, run: () => setModal({ tipo: 'sonidos', preset: { bus, entera: true, tipo: music ? 'musica' : 'efecto' } }) },
      { label: 'Improve it with Claude', icon: <MagicStar size={16} />, sub: [
        ['More presence', 'give it more presence and clarity'], ['Cleaner', 'clean it up and tidy it'], ['More cinematic', 'make it more cinematic'],
        ['Less busy', 'make it less busy by removing what is not needed'], ['Follow the picture', 'adjust it to follow what happens in the picture more closely, frame by frame'], ['Keep the rhythm', 'align it to the beat and the cuts'],
      ].map(([l, v]) => ({ label: l, run: () => ask(`Rework the whole “${name}” track (bus ${bus}) in sound.py, not just one moment: ${v}. Look at the key frames to decide.`, data) }))
        .concat(['-', { label: 'Write a request', icon: <Edit2 size={16} />, run: () => { setContext({ label: `Whole track: ${name}`, data }); setRight('claude'); setTimeout(() => document.querySelector('.composer textarea')?.focus(), 50); } }]) },
      { label: 'Find similar', icon: <Music size={16} />, run: () => setModal({ tipo: 'sonidos', preset: { bus, tipo: music ? 'musica' : 'efecto' } }) },
      '-',
      { label: 'Rename', icon: <Edit2 size={16} />, run: () => (renameInline ? renameInline() : promptRename('pista', bus, name)) },
    ];
  };

  const onTimelineContext = (e, kind, x) => {
    e.preventDefault(); e.stopPropagation();
    if (playing) pause();
    const items = [];
    if (kind === 'evento') {
      const ev = x;
      const data = { sonido: { t: ev.t, dur: ev.dur, pista: ev.bus, linea: ev.line, codigo: ev.code } };
      items.push({ header: `Sound at ${ev.t.toFixed(2)} s · ${ev.bus}` });
      items.push({ label: 'Listen', icon: <Headphone size={16} />, run: () => sound.current.blip(ev.t, Math.min(1.5, ev.dur + 0.05)) });
      items.push({ label: 'View its code', icon: <Code size={16} />, run: () => { setPickedEvent(ev); setRight('inspector'); } });
      items.push('-');
      items.push({ label: 'Volume', icon: <VolumeHigh size={16} />, sub: [
        { label: 'Raise 3 dB', run: () => setGain(ev, 1.4125) }, { label: 'Lower 3 dB', run: () => setGain(ev, 0.7079) }, { label: 'Lower 6 dB', run: () => setGain(ev, 0.5012) }, '-', { label: 'Mute', run: () => setGain(ev, 0) },
      ] });
      items.push({ label: 'Move', icon: <ArrowSwapHorizontal size={16} />, sub: [
        ...(info?.bpm ? [{ label: 'One beat earlier', run: () => ask(`Move the sound at sound.py line ${ev.line} that plays at ${ev.t.toFixed(2)} s one beat (${(60 / info.bpm).toFixed(3)} s) earlier.`, data) }, { label: 'One beat later', run: () => ask(`Move the sound at sound.py line ${ev.line} that plays at ${ev.t.toFixed(2)} s one beat (${(60 / info.bpm).toFixed(3)} s) later.`, data) }] : []),
        { label: `To the playhead (${tRef.current.toFixed(2)} s)`, run: () => ask(`Move the sound at sound.py line ${ev.line} that plays at ${ev.t.toFixed(2)} s so it plays at ${tRef.current.toFixed(3)} s.`, data) },
      ] });
      items.push({ label: 'Ask Claude', icon: <MagicStar size={16} />, sub: [
        ['Lower pitch', 'make it lower in pitch'], ['Higher pitch', 'make it higher in pitch'], ['Shorter', 'make it shorter'], ['Longer', 'make it longer'], ['More body', 'give it more body and weight'], ['Another sound', 'replace it with another sound that works better at that moment'],
      ].map(([l, v]) => ({ label: l, run: () => ask(`Change the sound at sound.py line ${ev.line} that plays at ${ev.t.toFixed(2)} s (track ${ev.bus}): ${v}.`, data) })) });
      items.push({ label: 'Replace with a free sound', icon: <SearchNormal1 size={16} />, run: () => setModal({ tipo: 'sonidos', preset: { evento: ev, bus: ev.bus, q: labels.sonidos[ev.line] || '' } }) });
      items.push({ label: 'Rename', icon: <Edit2 size={16} />, run: () => promptRename('sonido', ev.line, labels.sonidos[ev.line] || '') });
      items.push({ label: 'Remove it', icon: <Trash size={16} />, run: () => ask(`Remove the sound at sound.py line ${ev.line} that plays at ${ev.t.toFixed(2)} s, only that one.`, data) });
      items.push('-');
      items.push({ label: 'Note on this sound', icon: <Messages3 size={16} />, run: () => { seek(ev.t); setDraft({ tipo: 'tramo', t: ev.t, t1: ev.t + Math.max(0.1, ev.dur), sonido: ev }); } });
    } else if (kind === 'pista-entera') {
      items.push(...trackItems(x.bus, x.rename));
    } else if (kind === 'pista') {
      const { bus, t: at, setHeight } = x;
      const st = busState[bus] || {};
      items.push({ header: `Track ${trackName(bus)}` });
      items.push({ label: st.solo ? 'Unsolo' : 'Solo', icon: <Headphone size={16} />, run: () => setBusState(bus, { solo: !st.solo }) });
      items.push({ label: st.mute ? 'Unmute' : 'Mute', icon: st.mute ? <VolumeHigh size={16} /> : <VolumeSlash size={16} />, run: () => setBusState(bus, { mute: !st.mute }) });
      items.push({ label: 'Height', icon: <RowVertical size={16} />, sub: [['Small', 30], ['Normal', 48], ['Large', 96], ['Extra large', 160]].map(([l, v]) => ({ label: l, run: () => setHeight(v) })) });
      items.push('-');
      items.push({ label: `Add a sound at ${at.toFixed(2)} s`, icon: <Add size={16} />, sub: [
        ['Hit', 'a hit'], ['Whoosh', 'a whoosh'], ['Bell', 'a bell'], ['Riser', 'a riser that ends here'], ['Low impact', 'a low impact'], ['Click', 'a UI click'],
      ].map(([l, v]) => ({ label: l, run: () => ask(`Add ${v} at ${at.toFixed(3)} s on track ${bus} in sound.py, matching the rest of the sound.`, { t: at, pista: bus }) })) });
      items.push({ label: `Find a free sound for ${at.toFixed(2)} s`, icon: <SearchNormal1 size={16} />, run: () => setModal({ tipo: 'sonidos', preset: { t: at, bus } }) });
      items.push({ label: 'Note at this moment', icon: <Messages3 size={16} />, run: () => { seek(at); setDraft({ tipo: 'tramo', t: at, t1: Math.min(dur, at + 0.5) }); } });
      items.push('-');
      items.push({ label: 'Whole track', icon: <Magicpen size={16} />, sub: trackItems(bus, x.rename) });
      items.push({ label: 'Regenerate the sound', icon: <Refresh2 size={16} />, run: () => api('audio', { method: 'POST' }).catch(er => setError(er.message)) });
    } else if (kind === 'imagen' || kind === 'regla') {
      const at = x;
      items.push({ label: `Go to ${at.toFixed(2)} s`, icon: <Clock size={16} />, run: () => seek(at) });
      items.push({ label: 'Note at this moment', icon: <Messages3 size={16} />, run: () => { seek(at); setDraft({ tipo: 'tramo', t: at, t1: Math.min(dur, at + 1) }); } });
      items.push({ label: 'Attach this frame to the chat', icon: <Camera size={16} />, run: async () => { seek(at); await new Promise(r => setTimeout(r, 120)); attachFrame(); } });
    } else if (kind === 'nota') {
      const n = x;
      items.push({ header: n.texto.slice(0, 48) });
      items.push({ label: 'Go to the note', icon: <Eye size={16} />, run: () => pickNote(n) });
      items.push({ label: 'Resolve with Claude', icon: <MagicStar size={16} />, run: () => ask(`Resolve note ${n.id} (read it with the list_notes tool) and close it with resolve_note.`, { nota: n.id }) });
      items.push({ label: 'Mark as resolved', icon: <TickCircle size={16} />, run: () => api(`notas/${n.id}`, { method: 'PATCH', body: { estado: 'resuelta' } }) });
      items.push({ label: 'Delete', icon: <Trash size={16} />, run: () => api(`notas/${n.id}`, { method: 'DELETE' }) });
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  };

  // A panel that sits next to a box without covering it: right, else left, else below, else above.
  const besideBox = (b, scale, pw, ph) => {
    const W = info.ancho * scale, H = info.alto * scale, gap = 14;
    const x = b.x * scale, y = b.y * scale, w = b.w * scale, h = b.h * scale;
    const top = clamp(y, 8, H - ph - 8);
    if (x + w + gap + pw <= W) return { left: x + w + gap, top };
    if (x - gap - pw >= 0) return { left: x - gap - pw, top };
    const left = clamp(x, 8, W - pw - 8);
    if (y + h + gap + ph <= H) return { left, top: y + h + gap };
    return { left, top: Math.max(8, y - gap - ph) };
  };
  const onStageDouble = async e => {
    if (tool !== 'inspeccionar' || !info) return;
    if (playing) pause();
    const p = stage.current.toCanvas(e.clientX, e.clientY);
    const h = pickAt(p.x, p.y);
    const op = h?.under.find(o => o.kind === 'texto' && o.texto?.trim());
    if (!op) return;
    setGhost(null);
    const loc = await findTextLiteral(op, stamp);
    if (!loc) { setToast('That text is built in code: ask Claude from the right-click menu'); return; }
    setTextEdit({ op, loc, value: loc.lit.value });
    setTextSel({ key: `${loc.file}:${loc.line}:${loc.lit.col}`, loc, box: op.box, t: tRef.current, color: typeof op.color === 'string' ? op.color : null });
    setRight('inspector');
  };
  const saveTextEdit = async value => {
    const te = textEdit; setTextEdit(null);
    if (!te || value === te.loc.lit.value) return;
    await onEdit({ file: te.loc.file, line: te.loc.line, col: te.loc.lit.col, old: te.loc.lit.text, value: quoteFor(te.loc.lit, value) });
    setToast('Text saved');
    setTimeout(async () => { const loc = await relocate(te.loc, stampRef.current, value); setTextSel(s => s && s.loc.line === te.loc.line ? { ...s, loc, key: `${loc.file}:${loc.line}:${loc.lit.col}` } : s); }, 400);
  };
  const toolbarPos = (b, scale) => {
    const W = info.ancho * scale, w = 470;
    const left = clamp(b.x * scale + b.w * scale / 2 - w / 2, 4, Math.max(4, W - w - 4));
    const above = b.y * scale - 52;
    return { left, top: above >= 4 ? above : (b.y + b.h) * scale + 10 };
  };
  const onAssetDrop = e => {
    const src = e.dataTransfer.getData('text/estudio-asset');
    if (!src || !info) return;
    e.preventDefault();
    if (playing) pause();
    const p = stage.current.toCanvas(e.clientX, e.clientY);
    const img = new Image();
    img.onload = () => {
      const w0 = Math.min(img.naturalWidth, info.ancho * 0.22, info.alto * 0.4 * img.naturalWidth / img.naturalHeight), w = w0, h = w * img.naturalHeight / img.naturalWidth;
      setPlacing({ src, x: Math.round(clamp(p.x - w / 2, 0, info.ancho - w)), y: Math.round(clamp(p.y - h / 2, 0, info.alto - h)), w: Math.round(w), h: Math.round(h), ratio: img.naturalHeight / img.naturalWidth, t0: +tRef.current.toFixed(2), t1: +Math.min(dur, tRef.current + 3).toFixed(2) });
    };
    img.src = `/proyecto/${src}`;
  };
  const dragPlacing = (e, mode) => {
    e.preventDefault(); e.stopPropagation();
    const scale = stage.current.box().scale, x0 = e.clientX, y0 = e.clientY, s0 = placing;
    const move = ev => {
      const dx = (ev.clientX - x0) / scale, dy = (ev.clientY - y0) / scale;
      if (mode === 'mover') setPlacing(pl => pl && { ...pl, x: Math.round(s0.x + dx), y: Math.round(s0.y + dy) });
      else { const w = Math.max(24, s0.w + dx); setPlacing(pl => pl && { ...pl, w: Math.round(w), h: Math.round(w * s0.ratio) }); }
    };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  };
  const applyPlacing = async pl => {
    setPlacing(x => x && { ...x, estado: 'aplicando' });
    const texto = `Add ${pl.src.split('/').pop()} over the video from ${pl.t0.toFixed(2)} to ${pl.t1.toFixed(2)} s`;
    const nota = await api('notas', { method: 'POST', body: { tipo: 'imagen', t: pl.t0, t1: pl.t1, x: pl.x, y: pl.y, w: pl.w, h: pl.h, texto, archivo: pl.src, imagen: await stage.current.capture(pl.t0, { type: 'image/jpeg', quality: 0.85, width: 1280 }) } });
    ask(`Apply note ${nota.id}: add the image ${pl.src} on top of the whole video, in the box x ${pl.x}, y ${pl.y}, width ${pl.w}, height ${pl.h} (video pixels), visible from ${pl.t0.toFixed(2)} to ${pl.t1.toFixed(2)} s, with a short entrance and exit that fit the style. Draw it in its own named function so it can be edited later. Check it with get_frame and close the note with resolve_note.`, { nota: nota.id, archivo: pl.src });
  };

  const onStageMove = e => {
    if (tool !== 'inspeccionar' || playing || !opsNow) { if (hover) setHover(null); return; }
    const p = stage.current.toCanvas(e.clientX, e.clientY);
    const h = pickAt(p.x, p.y);
    setHover(h ? h.op : null);
  };

  const annotated = async (d) => {
    const url = await stage.current.capture(d.t, { type: 'image/jpeg', quality: 0.9, width: 1280 });
    if (!url) return null;
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const k = img.width / info.ancho;
    g.strokeStyle = '#ffb547'; g.lineWidth = 4; g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 6;
    if (d.tipo === 'punto') { g.beginPath(); g.arc(d.x * k, d.y * k, 22, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#ffb547'; g.beginPath(); g.arc(d.x * k, d.y * k, 5, 0, Math.PI * 2); g.fill(); }
    if (d.tipo === 'zona') g.strokeRect(d.x * k, d.y * k, d.w * k, d.h * k);
    return c.toDataURL('image/jpeg', 0.88);
  };

  const saveDraft = async texto => {
    const d = draft; setDraft(null);
    if (!texto.trim()) return;
    let op = d.op;
    if (!op && d.tipo === 'zona' && opsNow) {
      const inside = opsNow.ops.filter(o => o.box.x >= d.x - 4 && o.box.y >= d.y - 4 && o.box.x + o.box.w <= d.x + d.w + 4 && o.box.y + o.box.h <= d.y + d.h + 4);
      op = inside.sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)[0];
    }
    const chain = op ? chainOf(op) : [];
    const body = {
      tipo: d.tipo, t: +d.t.toFixed(3), texto: texto.trim(),
      ...(d.tipo === 'tramo' ? { t1: +d.t1.toFixed(3) } : {}),
      ...(d.tipo === 'punto' ? { x: d.x, y: d.y } : {}),
      ...(d.tipo === 'zona' ? { x: d.x, y: d.y, w: d.w, h: d.h } : {}),
      ...(op ? { elemento: chain.map(f => f.fn).join(' ← '), origen: chain.map(f => `${f.file}:${f.line}`).slice(0, 4), que: describeOp(op) } : {}),
      ...(d.sonido ? { elemento: `sound ${d.sonido.bus}`, origen: [`sound.py:${d.sonido.line}`], que: d.sonido.code } : {}),
    };
    setSaving('nota');
    try {
      const imagen = d.tipo === 'tramo' ? await stage.current.capture(d.t, { type: 'image/jpeg', quality: 0.88, width: 1280 }) : await annotated(d);
      const n = await api('notas', { method: 'POST', body: { ...body, imagen } });
      setCurrentNote(n.id);
      stage.current.seek(tRef.current);
    } finally { setSaving(null); }
  };

  const onNoteRange = (t0, t1) => { if (playing) pause(); seek(t0); setDraft({ tipo: 'tramo', t: t0, t1 }); };
  const pickNote = n => {
    if (playing) pause();
    setCurrentNote(n.id); setRight('notas');
    seek(n.t);
    if (n.x != null) setFlash({ x: n.x, y: n.y, w: n.w, h: n.h, texto: n.texto, nota: true, until: performance.now() + 2600 });
  };

  // Literal edits from the inspector write straight into the source file.
  const onEdit = useCallback(async ({ file, line, col, old, value, live: isLive }) => {
    const key = `${file}:${line}:${col}`;
    const cur = edits.current[key] ?? old;
    if (cur === value) return;
    edits.current[key] = value;
    try { await api('literal', { method: 'POST', body: { file, line, col, old: cur, value } }); }
    catch (e) { delete edits.current[key]; setError(e.message); setTimeout(() => setError(null), 3000); }
    if (!isLive) setTimeout(() => { delete edits.current[key]; }, 1500);
  }, []);

  // Live connection with the server: file changes, audio, notes, chat and commands from Claude.
  const handlers = useRef({});
  handlers.current = {
    archivo: m => {
      if (m.file.startsWith('.estudio/')) return;
      if (VIEW_EXT.test(m.file)) setStamp(s => s + 1);
      if (/\.(py|md)$/.test(m.file)) setStamp(s => s);
      if (m.file === 'timeline.json') loadProject();
      if (/\.(png|jpe?g|webp|gif|wav|mp3|mp4)$/i.test(m.file)) loadProject();
    },
    audio: m => { setAudioState(m.error ? { error: m.error } : m.estado === 'generando' ? { generando: true } : null); if (m.estado === 'listo') loadAudio(); },
    notas: m => setNotes(m.notas),
    etiquetas: m => setLabels(m.etiquetas),
    exportar: m => setExp(m.job),
    archivos: async () => { setRefs(await api('referencias')); loadProject(); },
    proyecto: m => {
      setBoot({ on: true, proyecto: false, video: false, sonido: false, cuadros: false, name: m.name });
      pause(); setSel(null); setTextSel(null); setTextEdit(null); setGhost(null); setOps(null); setThumbs([]); setAudio(null); setPickedEvent(null); setCodeFile(null); setCenterTab('video'); setContext(null); setModal(null);
      tRef.current = 0; setT(0);
      loadProject(); loadAudio(); setStamp(s => s + 1);
      api('recientes').then(setRecents).catch(() => { }); api('historial').then(setHist).catch(() => { });
    },
    historial: m => setHist(m),
    chat: m => {
      const ev = m.evento;
      if (ev.tipo === 'usuario') { setMessages(l => [...l, ev]); setBusy(true); }
      if (ev.tipo === 'inicio') { setBusy(true); setLive({ texto: '', herramientas: [], inicio: Date.now(), estado: { tipo: 'pensando' }, tokens: 0 }); setRight('claude'); }
      if (ev.tipo === 'estado') setLive(l => l && { ...l, estado: ev.estado || l.estado, tokens: ev.tokens ?? l.tokens });
      if (ev.tipo === 'pregunta') { setLive(l => l && { ...l, pregunta: ev, estado: { tipo: 'esperando' } }); setRight('claude'); setPanels(v => (v.right ? v : { ...v, right: true })); }
      if (ev.tipo === 'respondida') { setLive(l => l && { ...l, pregunta: null, estado: { tipo: 'pensando' } }); setMessages(l => [...l, { tipo: 'pregunta', id: ev.id, respuesta: ev.respuesta, pregunta: live?.pregunta?.pregunta }]); }
      if (ev.tipo === 'delta') setLive(l => l && { ...l, texto: l.texto + ev.texto });
      if (ev.tipo === 'texto') setLive(l => l && { ...l, texto: l.texto.endsWith('\n\n') ? l.texto : l.texto + '\n\n' });
      if (ev.tipo === 'herramienta') setLive(l => l && { ...l, herramientas: [...l.herramientas, { nombre: ev.nombre, entrada: ev.entrada }] });
      if (ev.tipo === 'fin') {
        setLive(null); setBusy(false); busyRef.current = false; setMessages(l => [...l, { ...ev, tipo: 'claude' }]);
        setGhost(g => (g && g.estado === 'aplicando' ? null : g));
        const next = queue.current.shift();
        if (next) { busyRef.current = true; setTimeout(() => api('chat', { method: 'POST', body: { ...(typeof next === 'string' ? { texto: next } : next), modelo: model, adjuntos: [] } }).catch(() => { busyRef.current = false; }), 400); }
      }
      if (ev.tipo === 'nuevo') { setMessages([]); setLive(null); }
      if (ev.tipo === 'error') { setError(ev.texto); setTimeout(() => setError(null), 3000); }
    },
    cmd: async (m, ws) => {
      const reply = (data, err) => ws.send(JSON.stringify({ type: 'respuesta', id: m.id, data, error: err }));
      try {
        if (playRef.current && !['reproducir', 'pista', 'vista', 'seleccion', 'hoja', 'buscar', 'textos', 'estilo_texto'].includes(m.cmd)) pause();
        if (m.cmd === 'ir') { seek(m.t); return reply({ t: tRef.current }); }
        if (m.cmd === 'reproducir') {
          if (m.bucle != null) { setLoop(!!m.bucle); loopRef.current = !!m.bucle; }
          if (m.t != null) seek(m.t);
          play();
          return reply({ t: tRef.current, playing: true, bucle: loopRef.current, sonido: sound.current.ctx?.state || 'none' });
        }
        if (m.cmd === 'pausar') { pause(); return reply({ t: tRef.current, playing: false }); }
        if (m.cmd === 'cuadro') {
          const prev = tRef.current;
          const at = m.t != null ? clamp(m.t, 0, dur - 1 / fps) : tRef.current;
          if (!m.mantener) { tRef.current = at; setT(at); }
          const data = m.cajas ? await stage.current.inspect(at) : null;
          await stage.current.capture(at, { type: 'image/jpeg', width: 8 });
          const src = stage.current.canvas();
          if (!src) return reply(null, 'The video has no canvas yet.');
          const W = src.width, H = src.height;
          const r = m.region ? { x: clamp(Math.round(m.region.x), 0, W - 1), y: clamp(Math.round(m.region.y), 0, H - 1) } : { x: 0, y: 0, w: W, h: H };
          if (m.region) { r.w = clamp(Math.round(m.region.w), 1, W - r.x); r.h = clamp(Math.round(m.region.h), 1, H - r.y); }
          const out = m.ancho || (m.region ? clamp(r.w * 2, 320, 1280) : Math.min(1280, W));
          const k = out / r.w;
          const c = document.createElement('canvas'); c.width = Math.round(out); c.height = Math.max(1, Math.round(r.h * k));
          const g = c.getContext('2d');
          g.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
          const leyenda = [];
          if (data) {
            const groups = groupOps(data.ops).filter(gr => gr.alpha >= 0.02 && gr.caja.w * gr.caja.h < W * H * 0.85).sort((a, b) => b.z - a.z).slice(0, m.max_cajas || 24);
            g.font = `600 ${Math.max(12, Math.round(c.width / 80))}px system-ui, sans-serif`; g.textBaseline = 'top';
            groups.forEach((gr, i) => {
              const hue = (i * 47) % 360, x = (gr.caja.x - r.x) * k, y = (gr.caja.y - r.y) * k;
              g.strokeStyle = `hsl(${hue} 90% 60%)`; g.lineWidth = 2; g.strokeRect(x, y, gr.caja.w * k, gr.caja.h * k);
              const label = String(i + 1), tw = g.measureText(label).width + 8, th = Math.max(12, Math.round(c.width / 80)) + 6;
              g.fillStyle = `hsl(${hue} 90% 60%)`; g.fillRect(x, Math.max(0, y - th), tw, th);
              g.fillStyle = '#000'; g.fillText(label, x + 4, Math.max(0, y - th) + 3);
              leyenda.push({ n: i + 1, ...gr });
            });
          }
          if (m.marca) {
            const d = m.marca;
            g.strokeStyle = '#ffb547'; g.lineWidth = 4; g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 6;
            if (d.w != null) g.strokeRect((d.x - r.x) * k, (d.y - r.y) * k, d.w * k, d.h * k);
            else if (d.x != null) { g.beginPath(); g.arc((d.x - r.x) * k, (d.y - r.y) * k, 22, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#ffb547'; g.beginPath(); g.arc((d.x - r.x) * k, (d.y - r.y) * k, 5, 0, Math.PI * 2); g.fill(); }
          }
          if (m.mantener && Math.abs(prev - at) > 1e-6) stage.current.seek(prev);
          return reply({ t: at, imagen: c.toDataURL('image/jpeg', 0.9), ancho: W, alto: H, region: r, escala: k, cajas: data ? leyenda : undefined });
        }
        if (m.cmd === 'inspeccionar' || m.cmd === 'elementos') {
          const at = m.t != null ? m.t : tRef.current;
          seek(at);
          const data = await stage.current.inspect(at);
          if (m.cmd === 'inspeccionar') {
            const under = hit(data.ops, m.x, m.y, data.ancho, data.alto).slice(0, m.cuantos || 6);
            if (under[0] && m.seleccionar !== false) select(under[0], under, m.x, m.y);
            return reply({ t: at, ancho: data.ancho, alto: data.alto, bajo_el_punto: under.map(detail) });
          }
          if (m.modo === 'elementos') {
            const list = [...data.ops].sort((a, b) => b.i - a.i);
            const seen = new Map();
            const items = list.map(detail).map(d => { const n = (seen.get(d.id) || 0) + 1; seen.set(d.id, n); return n > 1 ? { ...d, id: `${d.id}#${n}` } : d; });
            return reply({ t: at, ancho: data.ancho, alto: data.alto, total: items.length, elementos: items.slice(0, m.limite || 150) });
          }
          const grupos = groupOps(data.ops);
          return reply({ t: at, ancho: data.ancho, alto: data.alto, total: grupos.length, grupos: grupos.slice(0, m.limite || 200) });
        }
        if (m.cmd === 'seleccionar') {
          if (m.limpiar) { setSel(null); setTextSel(null); setContext(null); return reply({ ok: true }); }
          const at = m.t != null ? clamp(m.t, 0, dur - 1 / fps) : tRef.current;
          seek(at);
          const data = await stage.current.inspect(at);
          const under = hit(data.ops, m.x, m.y, data.ancho, data.alto);
          const op = under[m.indice || 0];
          if (!op) return reply(null, under.length ? `There are only ${under.length} elements under that point.` : 'Nothing is drawn at that point.');
          select(op, under, m.x, m.y);
          const chain = chainOf(op);
          const level = clamp(m.nivel || 0, 0, Math.max(0, chain.length - 1));
          const box = level ? groupBox(data.ops, frameKey(chain[level].caller || chain[level])) || op.box : op.box;
          if (level) setSel({ t: at, x: m.x, y: m.y, op, under, level, box });
          setRight('inspector');
          return reply({ t: at, nivel: level, funcion: chain[level]?.fn, caja: box, elemento: detail(op), debajo: under.length });
        }
        if (m.cmd === 'mostrar') {
          if (m.t != null) seek(m.t);
          setFlash({ x: m.x, y: m.y, w: m.w, h: m.h, texto: m.texto, until: performance.now() + (m.segundos || 6) * 1000 });
          return reply({ ok: true });
        }
        if (m.cmd === 'seleccion') {
          if (!context && !sel && !textSel) return reply(null);
          const chain = sel ? chainOf(sel.op) : [];
          return reply({
            ...(context ? context.data : {}),
            ...(sel ? { nivel: sel.level || 0, funcion_nivel: chain[sel.level || 0]?.fn, caja_nivel: sel.box, elemento: detail(sel.op) } : {}),
            ...(textSel ? { texto_seleccionado: { archivo: textSel.loc.file, linea: textSel.loc.line, columna: textSel.loc.lit.col, texto: textSel.loc.lit.value } } : {}),
          });
        }
        if (m.cmd === 'pista') {
          const buses = Object.keys(sound.current.buffers);
          if (m.pista && !buses.includes(m.pista)) return reply(null, `There is no track "${m.pista}". Tracks: ${buses.join(', ') || 'none'}.`);
          if (m.pista) {
            const patch = {};
            if (m.mute != null) patch.mute = !!m.mute;
            if (m.solo != null) patch.solo = !!m.solo;
            if (m.ganancia != null) patch.gain = clamp(+m.ganancia, 0, 4);
            setBusState(m.pista, patch);
          }
          if (m.volumen != null) setVolume(clamp(+m.volumen, 0, 1));
          if (m.silencio != null) setMuted(!!m.silencio);
          return reply({
            pistas: buses.map(b => ({ pista: b, nombre: trackName(b), mute: false, solo: false, gain: 1, ...(sound.current.state[b] || {}) })),
            volumen: m.volumen != null ? clamp(+m.volumen, 0, 1) : volume, silencio: m.silencio != null ? !!m.silencio : muted,
          });
        }
        if (m.cmd === 'vista') {
          if (m.archivo_codigo && !(proj?.files || []).includes(m.archivo_codigo)) return reply(null, `There is no file ${m.archivo_codigo} in the project.`);
          if (m.panel) { setRight(m.panel); setPanels(v => (v.right ? v : { ...v, right: true })); }
          if (m.zoom != null) setZoom(clamp(+m.zoom, 0.1, 1));
          if (m.herramienta) setTool(m.herramienta);
          if (m.archivo_codigo !== undefined) { setCodeFile(m.archivo_codigo || null); setCenterTab(m.archivo_codigo ? 'mapa' : 'video'); }
          if (m.pestana) setCenterTab(m.pestana);
          if (m.paneles) setPanels(v => ({ ...v, ...m.paneles }));
          if (m.foco != null) setFocus(!!m.foco);
          if (m.reproductor) setPlayerMode(m.reproductor);
          const file = m.archivo_codigo !== undefined ? m.archivo_codigo || null : codeFile;
          return reply({
            panel: m.panel || right, zoom: m.zoom != null ? clamp(+m.zoom, 0.1, 1) : zoom, herramienta: m.herramienta || tool, archivo_codigo: file,
            pestana: file ? m.pestana || (m.archivo_codigo ? 'mapa' : centerTab) : 'video', paneles: { ...panels, ...(m.paneles || {}) }, foco: m.foco != null ? !!m.foco : focus, reproductor: m.reproductor || playerMode,
          });
        }
        if (m.cmd === 'hoja') {
          const r = new Renderer(proj.entry);
          try {
            const inf = await r.open(stampRef.current);
            const a = clamp(m.desde ?? 0, 0, inf.duracion), b = clamp(m.hasta ?? inf.duracion, a, inf.duracion);
            const n = clamp(Math.round(m.n || 12), 1, 48);
            const cols = clamp(Math.round(m.columnas || Math.ceil(Math.sqrt(n * (inf.alto / inf.ancho) * 1.6))), 1, n);
            const rows = Math.ceil(n / cols);
            const cw = Math.round(m.ancho_celda || clamp(Math.floor(1600 / cols), 160, 480)), ch = Math.round(cw * inf.alto / inf.ancho), gap = 6;
            const times = Array.from({ length: n }, (_, i) => (n === 1 ? a : a + (b - a) * (i + 0.5) / n));
            const c = document.createElement('canvas'); c.width = cols * cw + (cols + 1) * gap; c.height = rows * ch + (rows + 1) * gap;
            const g = c.getContext('2d');
            g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
            g.font = `600 ${Math.max(11, Math.round(cw / 16))}px system-ui, sans-serif`; g.textBaseline = 'bottom';
            for (let i = 0; i < n; i++) {
              const fr = await r.frame(times[i], cw);
              const x = gap + (i % cols) * (cw + gap), y = gap + Math.floor(i / cols) * (ch + gap);
              if (fr) g.drawImage(fr, x, y, cw, ch);
              const label = `${times[i].toFixed(2)} s`, tw = g.measureText(label).width + 10, th = Math.max(11, Math.round(cw / 16)) + 8;
              g.fillStyle = 'rgba(0,0,0,0.72)'; g.fillRect(x, y + ch - th, tw, th);
              g.fillStyle = '#fff'; g.fillText(label, x + 5, y + ch - 4);
            }
            return reply({ imagen: c.toDataURL('image/jpeg', 0.85), tiempos: times.map(x => +x.toFixed(3)), columnas: cols, filas: rows, ancho: inf.ancho, alto: inf.alto, duracion: inf.duracion });
          } finally { r.close(); }
        }
        if (m.cmd === 'buscar') {
          const q = (m.texto || '').trim().toLowerCase(), fq = (m.funcion || '').trim().toLowerCase(), iq = (m.imagen || '').trim().toLowerCase();
          if (!q && !fq && !iq) return reply(null, 'Say what to find: a text, a function name or an image name.');
          const r = new Renderer(proj.entry);
          try {
            const inf = await r.open(stampRef.current);
            const stepT = m.paso || Math.max(0.1, inf.duracion / 120);
            const acc = new Map();
            const add = (key, base, t, box) => {
              const a = acc.get(key) || { ...base, times: [], boxes: new Map(), x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
              if (!a.boxes.has(t)) a.times.push(t);
              const bb = a.boxes.get(t) || { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
              bb.x0 = Math.min(bb.x0, box.x); bb.y0 = Math.min(bb.y0, box.y); bb.x1 = Math.max(bb.x1, box.x + box.w); bb.y1 = Math.max(bb.y1, box.y + box.h);
              a.boxes.set(t, bb);
              a.x0 = Math.min(a.x0, box.x); a.y0 = Math.min(a.y0, box.y); a.x1 = Math.max(a.x1, box.x + box.w); a.y1 = Math.max(a.y1, box.y + box.h);
              acc.set(key, a);
            };
            for (let t = 0; t < inf.duracion; t += stepT) {
              const res = await r.inspect(t);
              const at = +t.toFixed(3);
              for (const op of res?.ops || []) {
                if ((op.alpha ?? 1) < 0.02) continue;
                const chain = chainOf(op), top = chain[0];
                const where = top ? `${top.file}:${top.line}` : '';
                if (q && op.texto && op.texto.toLowerCase().includes(q)) add(`t:${op.texto}@${where}`, { tipo: 'texto', texto: op.texto, funcion: top?.fn, origen: where }, at, op.box);
                if (iq && op.src && op.src.toLowerCase().includes(iq)) add(`i:${op.src}@${where}`, { tipo: 'imagen', imagen: op.src, funcion: top?.fn, origen: where }, at, op.box);
                if (fq) {
                  const f = chain.find(x => x.fn.toLowerCase() === fq) || chain.find(x => x.fn.toLowerCase().includes(fq));
                  if (f) add(`f:${f.fn}@${f.file}`, { tipo: 'funcion', funcion: f.fn, origen: `${f.file}:${f.line}` }, at, op.box);
                }
              }
            }
            const found = [...acc.values()].map(a => {
              const rs = timeRanges(a.times, stepT).map(([x, y]) => [x, Math.min(y, +inf.duracion.toFixed(2))]);
              const sorted = a.times.slice().sort((x, y) => x - y);
              const mid = sorted[Math.floor(sorted.length / 2)];
              const bb = a.boxes.get(mid);
              const { times, boxes, x0, y0, x1, y1, ...rest } = a;
              return { ...rest, aparece: rs, t_medio: mid, caja_medio: { x: bb.x0, y: bb.y0, w: bb.x1 - bb.x0, h: bb.y1 - bb.y0 }, caja_total: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
            }).sort((x, y) => x.aparece[0][0] - y.aparece[0][0]);
            return reply({ paso: +stepT.toFixed(3), duracion: inf.duracion, resultados: found.slice(0, m.limite || 30), total: found.length });
          } finally { r.close(); }
        }
        if (m.cmd === 'estilo_texto') {
          const stamp0 = stampRef.current;
          let loc = null;
          if (m.archivo && m.linea) {
            const lines = await sourceOf(m.archivo, stamp0);
            const lits = literals(lines[m.linea - 1] || '').filter(l => l.kind === 'texto');
            const lit = m.columna != null ? lits.sort((x, y) => Math.abs(x.col - m.columna) - Math.abs(y.col - m.columna))[0] : (m.texto && lits.find(l => l.value === m.texto)) || lits[0];
            if (lit) loc = { file: m.archivo, line: m.linea, lit };
          } else if (m.texto) {
            const hits = [];
            for (const f of (proj?.fuentes || []).filter(f => /\.(html|js|mjs|jsx|ts|tsx)$/i.test(f))) {
              const lines = await sourceOf(f, stamp0);
              lines.forEach((l, i) => { for (const lit of literals(l)) if (lit.kind === 'texto' && lit.value === m.texto) hits.push({ file: f, line: i + 1, lit }); });
            }
            if (hits.length > 1) return reply(null, `Several literals hold that text: ${hits.map(h => `${h.file}:${h.line}`).join(', ')}. Pass file and line.`);
            loc = hits[0] || null;
          }
          if (!loc) return reply(null, 'Could not find that text as a string literal in the code.');
          const md = await textStyleModel(loc, stamp0);
          if (m.cambios) {
            const { E, skip } = textStyleEdits(md, m.cambios);
            const done = [];
            for (const e of E) {
              if (done.some(d => d.line === e.line && d.col === e.col)) continue;
              await api('literal', { method: 'POST', body: e });
              done.push(e);
            }
            return reply({ aplicados: done.map(e => ({ archivo: e.file, linea: e.line, columna: e.col, antes: e.old, despues: e.value })), no_aplicado: skip });
          }
          const where = (t, scope) => t && t.line ? { file: loc.file, line: t.line, column: t.col, current: t.old, scope: t.scope || scope } : null;
          const { font, color } = md;
          return reply({
            text: loc.lit.value, location: where({ line: loc.line, col: loc.lit.col, old: loc.lit.text }, 'this_call'),
            helper: md.helper && { function: md.helper.fn, line: md.helper.line },
            font: !font ? null : font.literal
              ? { kind: 'literal', family: font.literal.familia, weight: font.literal.peso, size: font.literal.tam, italic: font.literal.italic, location: where({ line: font.literal.line, col: font.literal.lit.col, old: font.literal.lit.text }, font.scope) }
              : { kind: 'helper', helper: font.helper, uses: font.usos, family: font.familia && { value: font.familia.value, location: where(font.familia, font.scope) }, weight: font.peso && { value: font.peso.value, location: where(font.peso, font.scope) }, size: font.tam && { value: font.tam.value, location: where(font.tam, font.scope) } },
            color: !color ? null : color.literal
              ? { kind: 'literal', value: color.literal.value, location: where(color.literal, color.scope) }
              : { kind: 'palette', name: color.paleta.nombre, value: color.paleta.def?.value, uses: color.paleta.usos, reference: where(color.paleta.ref, color.scope), definition: where(color.paleta.def, 'shared') },
            align: md.align && { value: md.align.value, location: where(md.align, md.align.scope) },
            x: md.x && { value: md.x.value, expression: md.x.expr, location: where(md.x, 'this_call') },
            y: md.y && { value: md.y.value, expression: md.y.expr, location: where(md.y, 'this_call') },
            palette: md.palette, project_fonts: (await projectFonts(proj?.files || [], stamp0)).map(f => ({ family: f.familia, weights: f.pesos })),
          });
        }
        if (m.cmd === 'textos') {
          const res = await scanTexts(proj.entry, info, stampRef.current);
          return reply({
            textos: res.items.map(it => ({ texto: it.lit.value, archivo: it.file, linea: it.line, columna: it.lit.col, aparece: it.ranges.map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)]), caja: it.box, fuente: it.fuente, color: typeof it.color === 'string' ? it.color : undefined })),
            calculados: res.computed.map(it => ({ texto: it.texto, aparece: it.ranges.map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)]) })),
          });
        }
        return reply(null, `Unknown command: ${m.cmd}`);
      } catch (e) { reply(null, e.message); }
    },
  };

  useEffect(() => {
    const c = connect((m, ws) => handlers.current[m.type]?.(m, ws));
    wsRef.current = c;
    return () => c.close();
  }, []);

  useEffect(() => {
    wsRef.current?.send({ type: 'estado', estado: {
      t: +t.toFixed(3), playing, herramienta: tool, seleccion: context?.data || null, duracion: dur, notas_abiertas: notes.filter(n => n.estado !== 'resuelta').length,
      video: info ? { ancho: info.ancho, alto: info.alto, fps: info.fps, modo: info.modo, bpm: info.bpm } : null,
      vista: { panel: right, zoom, archivo_codigo: codeFile, pestana: codeFile ? centerTab : 'video', paneles: panels, foco: focus, reproductor: playerMode, bucle: loop, volumen: volume, silencio: muted, pistas: busState },
    } });
  }, [Math.round(t * 10), playing, tool, context, dur, notes, info, right, zoom, codeFile, centerTab, panels, focus, playerMode, loop, volume, muted, busState]);

  useEffect(() => { if (!flash) return; const id = setTimeout(() => setFlash(null), Math.max(0, flash.until - performance.now())); return () => clearTimeout(id); }, [flash]);

  // Thumbnails from an offscreen copy of the page.
  useEffect(() => {
    if (!proj || !info) return;
    let on = true;
    const r = new Renderer(proj.entry);
    const id = setTimeout(async () => {
      try {
        const inf = await r.open(stamp);
        const n = Math.min(64, Math.max(12, Math.ceil(inf.duracion / 0.35)));
        const times = Array.from({ length: n }, (_, i) => (i + 0.5) * inf.duracion / n);
        const next = times.map(tt => ({ t: tt, canvas: null }));
        for (let i = 0; i < times.length && on; i++) {
          next[i] = { t: times[i], canvas: await r.frame(times[i], 240) };
          if (i % 6 === 5 || i === times.length - 1) setThumbs([...next]);
          if (i >= Math.min(times.length - 1, 11)) setBoot(b => (b.cuadros ? b : { ...b, cuadros: true }));
        }
      } catch (e) { console.warn(e); }
      r.close();
    }, 700);
    return () => { on = false; clearTimeout(id); r.close(); };
  }, [proj?.entry, info?.duracion, stamp]);

  // Keyboard
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest('input, textarea, [contenteditable]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); doHist(e.shiftKey ? 'rehacer' : 'deshacer'); return; }
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); doHist('rehacer'); return; }
      if (mod && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); openNative(); return; }
      if (mod && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); setModal('nuevo'); return; }
      if (mod && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); exportNow(); return; }
      if (mod) return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seek(tRef.current + (e.shiftKey ? 1 : 1 / fps)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(tRef.current - (e.shiftKey ? 1 : 1 / fps)); }
      else if (e.key === 'Home') seek(0);
      else if (e.key === 'End') seek(dur);
      else if (e.key === 'v' || e.key === 'V') setTool('inspeccionar');
      else if (e.key === 'p' || e.key === 'P') setTool('punto');
      else if (e.key === 'r' || e.key === 'R') setTool('zona');
      else if (e.key === 'l' || e.key === 'L') setLoop(l => !l);
      else if (e.key === 'f' || e.key === 'F') setFocus(f => !f);
      else if (e.key === 'Escape') { setPlacing(x => (x && x.estado ? x : null)); setDraft(null); setSel(null); setPickedEvent(null); setGhost(g => (g && g.estado === 'aplicando' ? g : null)); setCtxMenu(null); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const sendChat = async texto => {
    const contexto = context ? context.data : { cabezal: +tRef.current.toFixed(2) };
    const adj = attachments.filter(a => !a.subiendo); setAttachments([]);
    await api('chat', { method: 'POST', body: { texto, contexto, modelo: model, adjuntos: adj } });
  };
  const sendNotes = async () => {
    setRight('claude');
    const open = notes.filter(n => n.estado !== 'resuelta');
    await api('chat', { method: 'POST', body: { texto: `Resolve ${open.length === 1 ? 'the open note' : `the ${open.length} open notes`} in the editor. Read them with the list_notes tool, look at each frame, make the changes and close each one with resolve_note.`, modelo: model, adjuntos: [] } });
  };
  const attachFrame = async () => {
    const url = await stage.current.capture(null, { type: 'image/jpeg', quality: 0.9, width: 1280 });
    const blob = await (await fetch(url)).blob();
    const r = await api('archivos?destino=capturas', { method: 'POST', body: blob, headers: { 'x-nombre': `cuadro-${tRef.current.toFixed(2)}s-${Date.now().toString(36)}.jpg` } });
    setAttachments(a => [...a, { path: r.file, tipo: 'imagen', nombre: `Frame ${tRef.current.toFixed(2)} s` }]);
    setRight('claude');
  };
  const kindOf = name => /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(name) ? 'imagen' : /\.(mp4|webm|mov|mkv|m4v|avi)$/i.test(name) ? 'video' : /\.(wav|mp3|ogg|m4a|flac|aac)$/i.test(name) ? 'audio' : 'archivo';
  const attachFiles = async files => {
    setRight('claude');
    for (const file of files) {
      const nombre = file.name && file.name !== 'image.png' ? file.name : `captura-${Date.now().toString(36)}.png`;
      const id = Math.random().toString(36).slice(2);
      const tipo = kindOf(nombre);
      const preview = tipo === 'imagen' ? URL.createObjectURL(file) : null;
      setAttachments(a => [...a, { id, nombre, tipo, subiendo: true, preview }]);
      try {
        const r = await api('archivos?destino=adjuntos', { method: 'POST', body: file, headers: { 'x-nombre': encodeURIComponent(nombre) } });
        let info = null;
        if (tipo === 'video') info = await api('adjunto/video', { method: 'POST', body: { file: r.file } });
        setAttachments(a => a.map(x => x.id === id ? { ...x, path: r.file, info, subiendo: false } : x));
      } catch (e) { setAttachments(a => a.filter(x => x.id !== id)); setError(e.message); }
    }
  };
  const attachPaths = async rutas => {
    setRight('claude');
    for (const ruta of rutas) {
      const info = await api('ruta', { method: 'POST', body: { ruta } }).catch(() => null);
      if (!info?.existe) { setError(`Couldn't find ${ruta}`); setTimeout(() => setError(null), 3000); continue; }
      if (info.tipo === 'carpeta') { setAttachments(a => [...a, { id: info.ruta, tipo: 'carpeta', ruta: info.ruta, nombre: info.nombre }]); continue; }
      const id = Math.random().toString(36).slice(2), tipo = kindOf(info.nombre);
      setAttachments(a => [...a, { id, nombre: info.nombre, tipo, subiendo: true }]);
      try {
        const r = await api('adjunto/ruta', { method: 'POST', body: { ruta: info.ruta } });
        const vinfo = tipo === 'video' ? await api('adjunto/video', { method: 'POST', body: { file: r.file } }) : null;
        setAttachments(a => a.map(x => x.id === id ? { ...x, path: r.file, origen: r.origen, info: vinfo, subiendo: false } : x));
      } catch (e) { setAttachments(a => a.filter(x => x.id !== id)); setError(e.message); }
    }
  };
  const addAttachment = x => setAttachments(a => {
    const obj = typeof x === 'string' ? { path: x, tipo: kindOf(x), nombre: x.split('/').pop() } : x;
    return a.some(y => y.path === obj.path) ? a : [...a, obj];
  });
  const upload = async (file, dest) => {
    await api(`archivos?destino=${dest}`, { method: 'POST', body: file, headers: { 'x-nombre': encodeURIComponent(file.name) } });
  };

  const setBusState = (name, patch) => { sound.current.setBus(name, patch); setBus(s => ({ ...s, [name]: { ...(s[name] || {}), ...patch } })); };
  useEffect(() => { sound.current.volume = muted ? 0 : volume; sound.current.apply(); try { localStorage.setItem('estudio.volumen', String(volume)); } catch { } }, [muted, volume]);
  useEffect(() => { try { localStorage.setItem('estudio.modelo', model); } catch { } }, [model]);

  const beatLabel = useMemo(() => {
    if (!info?.bpm) return null;
    const b = t / (60 / info.bpm);
    return `${Math.floor(b / info.compas) + 1}.${Math.floor(b % info.compas) + 1}`;
  }, [t, info]);

  const visibleNotes = notes.filter(n => n.estado !== 'resuelta' && n.x != null && Math.abs(n.t - t) < 0.2);

  const overlay = scale => (
    <>
      {textSel?.box && !textEdit && !playing && !ghost && !placing && textSel.t != null && Math.abs(textSel.t - t) < 1e-3 && (
        <TextToolbar sel={textSel} stamp={stamp} files={proj?.files || []} onEdit={onEdit}
          onRelocate={async v => { await new Promise(r => setTimeout(r, 400)); const loc = await relocate(textSel.loc, stampRef.current, v); setTextSel(s => s && { ...s, loc, key: `${loc.file}:${loc.line}:${loc.lit.col}` }); }}
          onEditText={() => setTextEdit({ op: { box: textSel.box }, loc: textSel.loc, value: textSel.loc.lit.value })}
          onMore={() => { setRight('inspector'); if (!panels.right) setPanels(v => ({ ...v, right: true })); }}
          style={toolbarPos(textSel.box, scale)} />
      )}
      {textEdit && (
        <input
          className="ov-text-edit" autoFocus defaultValue={textEdit.value}
          style={{ left: textEdit.op.box.x * scale - 6, top: textEdit.op.box.y * scale - 4, minWidth: Math.max(160, textEdit.op.box.w * scale + 12), height: Math.max(30, textEdit.op.box.h * scale + 8), fontSize: clamp(textEdit.op.box.h * scale * 0.72, 13, 60) }}
          onFocus={e => e.target.select()} onPointerDown={e => e.stopPropagation()}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') saveTextEdit(e.currentTarget.value); if (e.key === 'Escape') setTextEdit(null); }}
          onBlur={e => saveTextEdit(e.target.value)}
        />
      )}
      {placing && !playing && (
        <div className={`ov-place ${placing.estado || ''}`} style={{ left: placing.x * scale, top: placing.y * scale, width: placing.w * scale, height: placing.h * scale }} onPointerDown={e => placing.estado ? null : dragPlacing(e, 'mover')}>
          <img src={`/proyecto/${placing.src}`} alt="" draggable={false} />
          {!placing.estado && <span className="ov-place-grip" onPointerDown={e => dragPlacing(e, 'tamano')} />}
          <span className="ov-label">{placing.estado ? <><MagicStar size={13} variant="Bold" /> Claude is adding it</> : <>{placing.src.split('/').pop()} <span className="mono">{placing.w}×{placing.h}</span></>}</span>
        </div>
      )}
      {placing && !placing.estado && (
        <PlaceConfirm pl={placing} dur={dur} now={t}
          style={besideBox(placing, scale, 316, 250)}
          onChange={patch => setPlacing(x => ({ ...x, ...patch }))} onCancel={() => setPlacing(null)} onApply={() => applyPlacing(placing)} />
      )}
      {ghost && !playing && ghost.without && <img className="ov-ghost-bg" src={ghost.without} alt="" />}
      {ghost && !playing && ghost.only && <img className="ov-ghost" src={ghost.only} alt="" style={{ transform: `translate(${ghost.dx * scale}px, ${ghost.dy * scale}px)` }} />}
      {ghost && !playing && (
        <>
          <div className="ov-box from" style={{ left: ghost.box.x * scale, top: ghost.box.y * scale, width: ghost.box.w * scale, height: ghost.box.h * scale }} />
          <div className={`ov-box sel moving ${ghost.estado}`} style={{ left: (ghost.box.x + ghost.dx) * scale, top: (ghost.box.y + ghost.dy) * scale, width: ghost.box.w * scale, height: ghost.box.h * scale }}>
            <span className="ov-label">{ghost.estado === 'aplicando' ? <><MagicStar size={13} variant="Bold" /> Claude is moving it</> : <>{ghost.label} <span className="mono">{ghost.dx >= 0 ? '+' : ''}{ghost.dx}, {ghost.dy >= 0 ? '+' : ''}{ghost.dy}</span></>}</span>
          </div>
        </>
      )}
      {ghost?.estado === 'confirmar' && (
        <MoveConfirm
          g={ghost}
          style={besideBox({ x: ghost.box.x + ghost.dx, y: ghost.box.y + ghost.dy, w: ghost.box.w, h: ghost.box.h }, scale, 316, 230)}
          onCancel={() => setGhost(null)}
          onApply={(alcance, never) => { if (never) setConfirmMove(false); applyMove(ghost, alcance); }}
        />
      )}
      {hover && !playing && !ghost && (!sel || hover.i !== sel.op.i) && (
        <div className="ov-box hover" style={{ left: hover.box.x * scale, top: hover.box.y * scale, width: hover.box.w * scale, height: hover.box.h * scale }} />
      )}
      {sel && !playing && !ghost && Math.abs(sel.t - t) < 1e-6 && (
        <div className="ov-box sel" style={{ left: sel.box.x * scale, top: sel.box.y * scale, width: sel.box.w * scale, height: sel.box.h * scale }}>
          <span className="ov-label">{sel.level ? chainOf(sel.op)[sel.level]?.fn : describeOp(sel.op)}</span>
        </div>
      )}
      {visibleNotes.map(n => n.tipo === 'zona'
        ? <div key={n.id} className={`ov-zone ${n.autor === 'claude' ? 'claude' : ''}`} style={{ left: n.x * scale, top: n.y * scale, width: n.w * scale, height: n.h * scale }} onPointerDown={e => { e.stopPropagation(); pickNote(n); }} />
        : <div key={n.id} className={`ov-pin ${n.autor === 'claude' ? 'claude' : ''}`} style={{ left: n.x * scale, top: n.y * scale }} onPointerDown={e => { e.stopPropagation(); pickNote(n); }}><span>{n.texto}</span></div>)}
      {flash && (flash.w
        ? <div className={`ov-flash ${flash.nota ? 'nota' : ''}`} style={{ left: flash.x * scale, top: flash.y * scale, width: flash.w * scale, height: flash.h * scale }}>{flash.texto && <span className="ov-label">{flash.texto}</span>}</div>
        : flash.x != null ? <div className={`ov-flash dot ${flash.nota ? 'nota' : ''}`} style={{ left: flash.x * scale, top: flash.y * scale }}>{flash.texto && <span className="ov-label">{flash.texto}</span>}</div> : null)}
      {draft && draft.tipo === 'zona' && <div className="ov-zone draft" style={{ left: draft.x * scale, top: draft.y * scale, width: draft.w * scale, height: draft.h * scale }} />}
      {draft && draft.tipo === 'punto' && <div className="ov-pin draft" style={{ left: draft.x * scale, top: draft.y * scale }} />}
      {draft && !draft.drawing && draft.tipo !== 'tramo' && (
        <NoteInput
          style={{ left: clamp((draft.x + (draft.w || 0)) * scale + 14, 0, info.ancho * scale - 340), top: clamp(draft.y * scale, 0, info.alto * scale - 150) }}
          label={draft.op ? describeOp(draft.op) : draft.tipo === 'zona' ? 'Area' : 'Point'}
          onSave={saveDraft} onCancel={() => setDraft(null)}
        />
      )}
    </>
  );

  const openNotes = notes.filter(n => n.estado !== 'resuelta').length;
  // The tab says which project is open, and the export progress while it runs.
  useEffect(() => {
    const base = proj?.name ? `${proj.name} · Kinora` : 'Kinora';
    document.title = exp?.estado === 'exportando' ? `${Math.floor((exp.pct || 0) * 100)}% · ${base}` : base;
  }, [proj?.name, exp?.estado, Math.floor((exp?.pct || 0) * 100)]);
  useEffect(() => { stampRef.current = stamp; }, [stamp]);
  const pmode = playerMode;
  const centerEmpty = !focus && pmode !== 'dock' && !codeFile && (panels.left || panels.right);
  const defaultWin = () => {
    const r = document.querySelector('.center')?.getBoundingClientRect() || { right: innerWidth - 20, bottom: innerHeight - 20 };
    return { w: 460, h: 310, x: Math.max(8, r.right - 480), y: Math.max(60, r.bottom - 330) };
  };
  const W = win || defaultWin();
  const winStyle = pmode === 'mini'
    ? { left: clamp(W.x + W.w - 380, 0, innerWidth - 380), top: clamp(W.y + W.h - 46, 54, innerHeight - 50), width: 380, height: 46 }
    : { left: clamp(W.x, 0, innerWidth - 200), top: clamp(W.y, 54, innerHeight - 120), width: W.w, height: W.h };
  const dragWin = e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY, w0 = W;
    const move = ev => setWin({ ...w0, x: clamp(w0.x + ev.clientX - x0, 0, innerWidth - 120), y: clamp(w0.y + ev.clientY - y0, 54, innerHeight - 44) });
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  };
  const resizeWin = e => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, y0 = e.clientY, w0 = W;
    const move = ev => setWin({ ...w0, w: clamp(w0.w + ev.clientX - x0, 300, innerWidth - 40), h: clamp(w0.h + ev.clientY - y0, 200, innerHeight - 80) });
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  };
  const playerItems = () => [
    { header: 'Video size' },
    ...[[1, 'Fit'], [0.75, '75%'], [0.5, '50%'], [0.35, '35%']].map(([z, l]) => ({ label: l, check: zoom === z, run: () => setZoom(z) })),
    '-',
    pmode === 'dock'
      ? { label: 'Pop out to a floating window', icon: <ExportSquare size={16} />, run: () => { if (!win) setWin(defaultWin()); setPlayerMode('flotante'); } }
      : { label: 'Dock it back', icon: <ImportSquare size={16} />, run: () => setPlayerMode('dock') },
    { label: 'Minimize', icon: <Minus size={16} />, disabled: pmode === 'mini', run: () => { if (!win) setWin(defaultWin()); setPlayerMode('mini'); } },
    { label: 'Video only', icon: <Maximize4 size={16} />, check: focus, keys: 'F', run: () => { setPlayerMode('dock'); setFocus(f => !f); } },
  ];
  const onMapContext = (e, x) => {
    e.preventDefault(); e.stopPropagation();
    if (x.tipo === 'sonido') return onTimelineContext(e, 'evento', x.ev);
    const n = x.node, f = x.fn;
    const data = { archivo: codeFile, funcion: n.name, lineas: f ? `${f.from}-${f.to}` : null, aparece: n.ranges.slice(0, 4).map(([a, b]) => `${a.toFixed(1)}-${b.toFixed(1)} s`) };
    const items = [
      { header: n.name },
      { label: 'Show in the video', icon: <Eye size={16} />, run: () => { seek(n.mid); if (n.box) setFlash({ ...n.box, texto: n.name, until: performance.now() + 3200 }); } },
      { label: 'Explain what it does', icon: <InfoCircle size={16} />, run: () => ask(`Explain in plain language what the “${n.name}” part of ${codeFile} does and what I can change in it.`, data) },
      { label: 'Ask Claude', icon: <MagicStar size={16} />, sub: claudeAsks(n.name, data) },
      '-',
      { label: 'Note on this part', icon: <Crop size={16} />, disabled: !n.box, run: () => { seek(n.mid); setDraft({ tipo: 'zona', t: n.mid, x: n.box.x, y: n.box.y, w: n.box.w, h: n.box.h }); if (pmode === 'mini') setPlayerMode('flotante'); } },
      { label: 'Copy its location', icon: <Copy size={16} />, run: () => navigator.clipboard.writeText(`${n.name} ${codeFile}:${f?.from || ''}`).then(() => setToast('Copied')) },
    ];
    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  };
  useEffect(() => { setGhost(g => (g && g.estado === 'aplicando' ? null : g)); setPlacing(x => (x && x.estado === 'aplicando' ? null : x)); }, [stamp]);

  const openNative = async () => {
    try {
      const r = await nativePick('video');
      if (!r.cancelado) { setToast('Opening…'); openProject(r.ruta); }
    } catch (e) { setError(e.message); setTimeout(() => setError(null), 4000); }
  };
  // First run: the welcome shows once, before anything else.
  useEffect(() => { if (WELCOME_PREVIEW) { setModal('bienvenida'); return; } api('bienvenida').then(w => { if (!w.visto) setModal(m => m || 'bienvenida'); }).catch(() => { }); }, []);
  // The tour runs once, after the example video opens from the welcome.
  const [tour, setTour] = useState(false);
  useEffect(() => { if (info && proj?.name && !modal && (tourPending() || TOUR_NOW)) { markTourDone(); TOUR_NOW = false; setTour(true); } }, [info, proj?.name, modal]);
  const tourSteps = [
    { target: '.viewer', title: 'This is the example video', text: 'Everything in it is code. Click any element to see where it comes from and change it.', enter: () => setRight('inspector') },
    { target: '.menubar .menu:first-child .menu-btn', title: 'Start from scratch', text: 'File, New video creates an empty video in the format you choose.' },
    { target: '[data-tour="claude"]', title: 'Or ask Claude', text: 'Describe the video you want and Claude builds it from zero, right here.', enter: () => { setPanels(v => (v.right ? v : { ...v, right: true })); setRight('claude'); } },
    { target: '.composer', title: 'Add references', text: 'Attach images, videos or audio, paste the path of a file or a folder, or drag them here. Claude looks at them before it starts.', enter: () => setRight('claude') },
  ];
  const openProject = async dir => {
    setModal(null);
    try { await api('abrir', { method: 'POST', body: { dir } }); } catch (e) { setError(e.message); }
  };
  const recentItems = recents.filter(r => r.dir !== proj?.dir).map(r => ({ label: r.name, hint: r.dir.split(/[\\/]/).slice(-2, -1)[0], icon: <VideoPlay size={16} />, run: () => openProject(r.dir) }));
  const undoLabel = h => h ? `${h.autor === 'claude' ? ' Claude\'s change' : ''} in ${h.file}` : '';
  const doHist = async dir => { const r = await api(dir, { method: 'POST' }).catch(e => ({ error: e.message })); if (r.ok) setToast(`${dir === 'deshacer' ? 'Undone' : 'Redone'}: ${r.file}`); };
  const [expFrame, setExpFrame] = useState(null);
  const openExport = async () => {
    if (playRef.current) pause();
    setModal('exportar');
    setExpFrame(await stage.current?.capture(null, { type: 'image/jpeg', quality: 0.85, width: 800 }));
  };
  const exportNow = openExport;
  const menus = [
    { label: 'File', items: [
      { label: 'New video', icon: <Add size={16} />, keys: 'Ctrl N', run: () => setModal('nuevo') },
      { label: 'Open', icon: <Open size={16} />, keys: 'Ctrl O', run: openNative },
      { label: 'Browse folders', icon: <FolderOpen size={16} />, run: () => setModal('abrir') },
      { label: 'Open recent', icon: <Clock size={16} />, sub: recentItems },
      '-',
      { label: 'Show in file explorer', icon: <FolderOpen size={16} />, run: () => api('explorador', { method: 'POST' }) },
      { label: 'Export', icon: <Export size={16} />, keys: 'Ctrl E', disabled: !proj?.files?.includes('render.py'), run: openExport },
      { label: 'Save the frame as PNG', icon: <DocumentDownload size={16} />, run: savePng },
    ] },
    { label: 'Edit', items: [
      { label: `Undo${undoLabel(hist.deshacer)}`, icon: <Undo size={16} />, keys: 'Ctrl Z', disabled: !hist.deshacer, run: () => doHist('deshacer') },
      { label: `Redo${undoLabel(hist.rehacer)}`, icon: <Redo size={16} />, keys: 'Ctrl Shift Z', disabled: !hist.rehacer, run: () => doHist('rehacer') },
      '-',
      { label: 'Confirm before moving', check: confirmMove, run: () => setConfirmMove(c => !c) },
    ] },
    { label: 'View', items: [
      { label: 'Files', check: panels.left, run: () => setPanels(v => ({ ...v, left: !v.left })) },
      { label: 'Right panel', check: panels.right, run: () => setPanels(v => ({ ...v, right: !v.right })) },
      { label: 'Timeline', check: panels.timeline, run: () => setPanels(v => ({ ...v, timeline: !v.timeline })) },
      { label: 'Video only', check: focus, keys: 'F', run: () => setFocus(f => !f) },
      '-',
      { label: 'Reset sizes', icon: <RowVertical size={16} />, run: () => { setSizes({ left: 300, right: 420, tl: 300 }); try { localStorage.removeItem('estudio.tamanos'); localStorage.removeItem('estudio.pistas'); } catch { } setPanels({ left: true, right: true, timeline: true }); setToast('Sizes reset'); } },
    ] },
    { label: 'Tools', items: [
      { label: openNotes ? `Resolve ${openNotes === 1 ? 'the open note' : `the ${openNotes} open notes`}` : 'Resolve notes', icon: <Send2 size={16} />, disabled: !openNotes, run: sendNotes },
      { label: 'New conversation', icon: <Refresh2 size={16} />, disabled: busy, run: () => api('chat/nuevo', { method: 'POST' }) },
      { label: 'Model', icon: <Setting4 size={16} />, sub: [{ label: 'Opus 5.5', check: model === 'opus', run: () => setModel('opus') }, { label: 'Fable 5.1', check: model === 'fable', run: () => setModel('fable') }] },
      '-',
      { label: 'Skills and plugins', icon: <Box1 size={16} />, run: () => setModal('skills') },
      { label: 'Connections', icon: <Link21 size={16} />, run: () => setModal('conexiones') },
      { label: 'Generate image', icon: <Magicpen size={16} />, run: () => setModal('generar') },
      { label: 'Find free sounds', icon: <Music size={16} />, run: () => setModal({ tipo: 'sonidos' }) },
    ] },
    { label: 'Help', items: [
      { label: 'Welcome', icon: <VideoPlay size={16} />, run: () => setModal('bienvenida') },
      { label: 'Quick tour', icon: <InfoCircle size={16} />, disabled: !proj, why: 'Open a video first', run: () => setTour(true) },
      { label: 'Shortcuts', icon: <Keyboard size={16} />, run: () => setModal('atajos') },
      { label: 'About Kinora', icon: <InfoCircle size={16} />, run: () => setModal('acerca') },
    ] },
  ];

  return (
    <div className={`app ${focus ? 'focus' : ''}`} style={{
      gridTemplateRows: focus || !panels.timeline ? '54px minmax(0, 1fr)' : `54px minmax(0, 1fr) 6px ${sizes.tl}px`,
      '--cols': focus ? '60px minmax(0, 1fr)'
        : centerEmpty ? `60px ${panels.left ? `minmax(0, ${sizes.left}fr) 6px ` : ''}0px${panels.right ? ` ${panels.left ? 0 : 6}px minmax(0, ${sizes.right}fr)` : ''}`
          : `60px ${panels.left ? `${sizes.left}px 6px ` : ''}minmax(0, 1fr)${panels.right ? ` 6px ${sizes.right}px` : ''}`,
    }} onContextMenu={e => { if (!e.target.closest('input, textarea')) e.preventDefault(); }}>
      <header className="top">
        <div className="brand" title="Kinora"><VideoPlay size={22} variant="Bold" /><span className="brand-word">Kinora</span></div>
        <MenuBar menus={menus} />
        <div className="proj">
          <span className="proj-name">{proj?.name || '...'}</span>
          {info && <span className="proj-meta mono">{info.ancho}×{info.alto} · {info.fps} fps · {dur.toFixed(1)} s</span>}
          {info && <span className={`badge ${info.modo}`}>{info.modo === 'opuscut' ? 'OpusCut' : 'Free page'}</span>}
        </div>
        <span className="grow" />
        {audioState?.generando && <span className="status"><Refresh2 size={16} className="spin" />Sound</span>}
        {audioState?.error && <span className="status err" title={audioState.error}><Warning2 size={16} />Sound failed</span>}
        {loading && <span className="status"><Refresh2 size={16} className="spin" />Loading</span>}
        {saving && <span className="status"><Refresh2 size={16} className="spin" />Saving</span>}
        {busy && <span className="status claude"><MagicStar size={16} variant="Bold" />Claude is working</span>}
        {error && <span className="status err"><Warning2 size={16} />{error}</span>}
        {toast && <span className="status toast"><TickCircle size={16} />{toast}</span>}
        {exp?.estado === 'exportando'
          ? <button className="export running" onClick={openExport}><Refresh2 size={17} className="spin" />Exporting {Math.floor((exp.pct || 0) * 100)}%<i style={{ transform: `scaleX(${exp.pct || 0})` }} /></button>
          : <button className="export" disabled={!proj?.files?.includes('render.py')} title={proj?.files?.includes('render.py') ? 'Export' : 'This project has no render.py'} onClick={openExport}>{exp?.estado === 'listo' ? <TickCircle size={17} /> : <Export size={17} />}Export</button>}
      </header>

      <div className="main">
        <nav className="rail">
          <button className={tool === 'inspeccionar' ? 'on' : ''} title="Inspect (V)" onClick={() => setTool('inspeccionar')}><Mouse size={22} /></button>
          <button className={tool === 'punto' ? 'on' : ''} title="Note at a point (P)" onClick={() => setTool('punto')}><Location size={22} /></button>
          <button className={tool === 'zona' ? 'on' : ''} title="Note on an area (R)" onClick={() => setTool('zona')}><Crop size={22} /></button>
        </nav>

        {!focus && panels.left && <>
        <aside className="left">
          <Files files={proj?.files || []} refs={refs} stamp={stamp} onUpload={upload}
            onAttach={f => { addAttachment(f); setRight('claude'); }}
            onOpenCode={f => { setCodeFile(f); setCenterTab('mapa'); }} onGenerate={() => setModal('generar')} onSounds={() => setModal({ tipo: 'sonidos' })}
            textos={<Texts entry={proj?.entry} stamp={stamp} info={info} onEdit={onEdit} selectedKey={textSel?.key}
              onSelect={it => { if (playing) pause(); seek(it.mid); setTextSel({ key: it.key, loc: { file: it.file, line: it.line, lit: it.lit }, box: it.box, t: it.mid, ranges: it.ranges, color: typeof it.color === 'string' ? it.color : null }); setSel(null); setRight('inspector'); }}
              onSeek={at => { if (playing) pause(); seek(at); }}
              onShow={it => { if (playing) pause(); seek(it.mid); setFlash({ ...it.box, texto: it.lit.value.slice(0, 40), until: performance.now() + 2600 }); }}
              onAsk={(txt, data) => ask(txt, data)} />} />
        </aside>
        <Splitter axis="x" onDrag={dx => setSize('left', v => clamp(v + dx, 220, 520))} />
        </>}

        <section className="center">
          {codeFile && (
            <div className="center-tabs" key="tabs">
              <button className={centerTab === 'video' ? 'on' : ''} onClick={() => setCenterTab('video')}><VideoPlay size={17} />Video</button>
              <button className={centerTab === 'mapa' ? 'on' : ''} onClick={() => setCenterTab('mapa')}><Grid5 size={17} />{codeFile.split('/').pop()}<span className="tab-x" onClick={e => { e.stopPropagation(); setCodeFile(null); setCenterTab('video'); }}><CloseCircle size={15} /></span></button>
            </div>
          )}
          {codeFile && centerTab === 'mapa' && (
            <CodeMap key={'map:' + codeFile} file={codeFile} entry={proj?.entry} stamp={stamp} info={info} audio={audio} onEdit={onEdit}
              onSeek={(at, blip, ev) => { if (playing) pause(); seek(at); if (blip && ev) sound.current.blip(ev.t, Math.min(1.2, ev.dur + 0.05)); }}
              onShow={n => { if (playing) pause(); seek(n.mid); if (n.box) setFlash({ ...n.box, texto: n.name, until: performance.now() + 3200 }); if (pmode === 'mini') setPlayerMode('flotante'); }}
              onAsk={(txt, data) => ask(txt, data)}
              onContext={onMapContext} />
          )}
          <div key="player" className={`player ${pmode} ${pmode === 'dock' && codeFile && centerTab === 'mapa' ? 'hidden' : ''}`} style={pmode === 'dock' ? undefined : winStyle}>
            {pmode !== 'dock' && (
              <div className="player-bar" onPointerDown={dragWin} onDoubleClick={() => setPlayerMode(m => m === 'mini' ? 'flotante' : 'mini')}>
                <VideoPlay size={16} variant="Bold" />
                <span className="player-title">{proj?.name}</span>
                {pmode === 'mini' && <>
                  <button className="icon-btn sm" onPointerDown={e => e.stopPropagation()} onClick={toggle}>{playing ? <Pause size={17} variant="Bold" /> : <Play size={17} variant="Bold" />}</button>
                  <span className="mono dim">{tc(t, fps)}</span>
                </>}
                <span className="grow" />
                <button className="icon-btn sm" title={pmode === 'mini' ? 'Expand' : 'Minimize'} onPointerDown={e => e.stopPropagation()} onClick={() => setPlayerMode(pmode === 'mini' ? 'flotante' : 'mini')}>{pmode === 'mini' ? <Maximize4 size={16} /> : <Minus size={16} />}</button>
                {<button className="icon-btn sm" title="Dock it back" onPointerDown={e => e.stopPropagation()} onClick={() => setPlayerMode('dock')}><ImportSquare size={16} /></button>}
              </div>
            )}
            <div key="viewer" className={`viewer tool-${tool} ${ghost ? 'dragging' : ''}`} onDragOver={e => { if (e.dataTransfer.types.includes('text/estudio-asset')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }} onDrop={onAssetDrop} onDoubleClick={onStageDouble} onContextMenu={onStageContext} onPointerDown={onStageDown} onPointerMove={onStageMove} onPointerLeave={() => setHover(null)}>
              <Stage ref={stage} entry={proj?.entry} stamp={stamp} onInfo={i => { setInfo(i); setBoot(b => ({ ...b, video: true })); }} onLoading={setLoading} overlay={overlay} factor={zoom} pad={pmode === 'dock' ? 28 : 8} />
            </div>
            <div key="transport" className="transport">
              <div className="tc mono"><b>{tc(t, fps)}</b><span className="dim"> / {tc(dur, fps)}</span></div>
              {beatLabel && <div className="beat-pos mono" title="Bar and beat">{beatLabel}</div>}
              <span className="grow" />
              <button className="icon-btn hide-sm" title="Start" onClick={() => seek(0)}><Previous size={20} /></button>
              <button className="icon-btn" title="Previous frame" onClick={() => seek(tRef.current - 1 / fps)}><Previous size={16} /></button>
              <button className="play" title="Play (Space)" onClick={toggle}>{playing ? <Pause size={24} variant="Bold" /> : <Play size={24} variant="Bold" />}</button>
              <button className="icon-btn" title="Next frame" onClick={() => seek(tRef.current + 1 / fps)}><Next size={16} /></button>
              <button className="icon-btn hide-sm" title="End" onClick={() => seek(dur)}><Next size={20} /></button>
              <span className="grow" />
              <button className={`icon-btn ${loop ? 'on' : ''}`} title="Loop (L)" onClick={() => setLoop(l => !l)}><Repeat size={20} /></button>
              <div className="vol">
                <button className={`icon-btn ${muted ? 'on' : ''}`} title={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(m => !m)}>{muted || volume === 0 ? <VolumeSlash size={20} /> : volume < 0.45 ? <VolumeLow1 size={20} /> : <VolumeHigh size={20} />}</button>
                <input className="vol-slider" type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} title={`Volume ${Math.round((muted ? 0 : volume) * 100)}%`}
                  style={{ '--v': `${(muted ? 0 : volume) * 100}%` }}
                  onChange={e => { const v = +e.target.value; setVolume(v); if (muted && v > 0) setMuted(false); }} />
              </div>
              <button className="zoom-btn mono" title="Size and window" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setCtxMenu({ x: r.left, y: r.bottom + 6, items: playerItems() }); }}>{zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`}<ArrowDown2 size={14} /></button>
              {pmode === 'dock' && <button className={`icon-btn hide-sm ${focus ? 'on' : ''}`} title={focus ? 'Show panels (F)' : 'Video only (F)'} onClick={() => setFocus(f => !f)}>{focus ? <Maximize3 size={20} /> : <Maximize4 size={20} />}</button>}
            </div>
            {pmode === 'flotante' && <div key="grip" className="player-grip" onPointerDown={resizeWin} />}
          </div>
        </section>
        {!focus && panels.right && <>
        <Splitter axis="x" onDrag={dx => setSize('right', v => clamp(v - dx, 320, 720))} />

        <aside className="right">
          <div className="tabs">
            <button className={right === 'inspector' ? 'on' : ''} onClick={() => setRight('inspector')}><Layer size={18} />Inspector</button>
            <button className={right === 'notas' ? 'on' : ''} onClick={() => setRight('notas')}><Messages3 size={18} />Notes{openNotes ? <b>{openNotes}</b> : null}</button>
            <button data-tour="claude" className={right === 'claude' ? 'on' : ''} onClick={() => setRight('claude')}><MagicStar size={18} />Claude{busy ? <span className="dots"><i /><i /><i /></span> : null}</button>
          </div>
          {right === 'inspector' && textSel && (
            <TextStyle sel={textSel} stamp={stamp} files={proj?.files || []} onEdit={onEdit}
              onClose={() => setTextSel(null)}
              onSeek={at => { if (playing) pause(); seek(at); }}
              onAsk={(txt, data) => ask(txt, data)}
              onRelocate={async v => { await new Promise(r => setTimeout(r, 400)); const loc = await relocate(textSel.loc, stampRef.current, v); setTextSel(s => s && { ...s, loc, key: `${loc.file}:${loc.line}:${loc.lit.col}` }); }} />
          )}
          {right === 'inspector' && !textSel && (
            <Inspector
              selection={sel && { ...sel, pick: o => select(o, sel.under, sel.x, sel.y) }}
              stamp={stamp} onEdit={onEdit} onPickLevel={pickLevel} info={info}
              audioEvent={pickedEvent}
              onNote={() => { if (sel) { setTool('punto'); setDraft({ tipo: 'punto', t: sel.t, x: Math.round(sel.x), y: Math.round(sel.y), op: sel.op }); } }}
            />)}
          {right === 'notas' && (
            <Notes notes={notes} current={currentNote} onPick={pickNote} busy={busy} stamp={stamp}
              onResolve={n => api(`notas/${n.id}`, { method: 'PATCH', body: { estado: 'resuelta' } })}
              onDelete={n => api(`notas/${n.id}`, { method: 'DELETE' })}
              onSend={sendNotes} />
          )}
          {right === 'claude' && (
            <Chat onAnswer={(id, respuesta) => api('pregunta/responder', { method: 'POST', body: { id, respuesta } }).catch(e => setError(e.message))} messages={messages} live={live} busy={busy} model={model} setModel={setModel}
              onSend={sendChat} onStop={() => { queue.current = []; api('chat/parar', { method: 'POST' }); setToast('Stopping Claude'); }} onNew={() => api('chat/nuevo', { method: 'POST' })}
              context={context} clearContext={() => setContext(null)}
              onAttachFrame={attachFrame} onAttachFiles={attachFiles} onAttachPaths={attachPaths} attachments={attachments} removeAttachment={a => setAttachments(l => l.filter(x => x !== a))} />
          )}
        </aside>
        </>}
      </div>

      {!focus && panels.timeline && <>
      <Splitter axis="y" onDrag={dy => setSize('tl', v => clamp(v - dy, 120, window.innerHeight - 300))} />
      <Timeline onContext={onTimelineContext} labels={labels} onRename={rename}
        info={info} timeline={proj?.timeline} t={t} onSeek={(nt, scrub) => { if (playing && scrub) pause(); seek(nt, scrub); }}
        audio={audio} notes={notes} onNoteRange={onNoteRange} onPickNote={pickNote}
        onPickEvent={ev => { if (playing) pause(); setPickedEvent(ev); setRight('inspector'); seek(ev.t); sound.current.blip(ev.t, Math.min(0.6, ev.dur + 0.05)); }}
        pickedEvent={pickedEvent} thumbs={thumbs} busState={busState} setBusState={setBusState}
      />
      </>}

      {ctxMenu && <ContextMenu {...ctxMenu} onClose={() => setCtxMenu(null)} />}
      {(proj?.files || []).filter(f => /\.css$/i.test(f) && !f.startsWith('.estudio/')).map(f => <link key={f} rel="stylesheet" href={`/proyecto/${f}`} />)}
      {boot.on && <BootScreen boot={boot} name={boot.name || (WELCOME_PREVIEW ? 'Kinora' : proj?.name)} onDone={() => setBoot(b => ({ ...b, on: false }))} />}
      {modal === 'abrir' && <FolderPicker title="Open a video" recents={recents} onClose={() => setModal(null)} onPick={openProject} />}
      {modal === 'nuevo' && <NewVideo onClose={() => setModal(null)} onDone={() => setModal(null)} />}
      {modal === 'skills' && <Skills onClose={() => setModal(null)} />}
      {modal === 'atajos' && <Shortcuts onClose={() => setModal(null)} />}
      {modal === 'acerca' && <About onClose={() => setModal(null)} onWelcome={() => setModal('bienvenida')} />}
      {modal === 'bienvenida' && <Welcome preview={WELCOME_PREVIEW} onClose={() => setModal(null)} onNew={() => setModal('nuevo')} onOpen={openNative} onConnections={() => setModal('conexiones')} />}
      {tour && <Tour steps={tourSteps} onClose={() => setTour(false)} />}
      {modal === 'exportar' && info && <ExportModal info={info} t={t} name={proj?.name} job={exp} frame={expFrame} onClose={() => setModal(null)} />}
      {modal === 'conexiones' && <Connections onClose={() => setModal(null)} />}
      {modal?.tipo === 'sonidos' && <SoundSearch preset={modal.preset} onClose={() => setModal(null)} onAdded={(r, x) => {
        const pr = modal.preset || {};
        if (pr.entera) ask(`Replace the whole “${trackName(pr.bus)}” track (bus ${pr.bus}) in sound.py with ${r.archivo} (${x.titulo}). Load it from the WAV, fit its length to the video's duration with a fade at the end, and set its level to match the rest. Whatever was on that track is removed.`, { pista: pr.bus, archivo: r.archivo });
        else if (pr.evento) ask(`Replace the sound at sound.py line ${pr.evento.line} that plays at ${pr.evento.t.toFixed(2)} s with ${r.archivo} (${x.titulo}), at the same moment and at a similar level. If that line is in a loop, replace only that one.`, { sonido: pr.evento, archivo: r.archivo });
        else if (pr.t != null) ask(`Add ${r.archivo} (${x.titulo}) to sound.py so it plays at ${pr.t.toFixed(3)} s on track ${pr.bus || 'fx'}, at a level that works with the rest. Load it from the WAV with wave or numpy.`, { t: pr.t, pista: pr.bus, archivo: r.archivo });
        else setToast(`Added ${r.archivo}`);
      }} />}
      {modal?.tipo === 'renombrar' && <RenameModal actual={modal.actual} titulo={modal.clase === 'pista' ? 'Rename the track' : 'Sound name'} onClose={() => setModal(null)} onSave={v => { rename(modal.clase, modal.clave, v); setModal(null); }} />}
      {modal === 'generar' && <GenerateImage onClose={() => setModal(null)} refs={refs} assets={proj?.files || []} stamp={stamp} />}

      {draft && draft.tipo === 'tramo' && (
        <div className="modal-scrim" onPointerDown={() => setDraft(null)}>
          <div onPointerDown={e => e.stopPropagation()}>
            <NoteInput label={`Range ${draft.t.toFixed(2)} to ${draft.t1.toFixed(2)} s`} onSave={saveDraft} onCancel={() => setDraft(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function NoteInput({ style, label, onSave, onCancel }) {
  const [text, setText] = useState('');
  return (
    <div className="note-input" style={style} onPointerDown={e => e.stopPropagation()}>
      <div className="note-input-label"><Location size={15} />{label}</div>
      <textarea
        ref={el => { if (el && !el.dataset.f) { el.dataset.f = '1'; setTimeout(() => el.focus(), 0); } }}
        autoFocus rows={3} value={text} placeholder="What do you want to change?"
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(text); } if (e.key === 'Escape') onCancel(); }}
      />
      <div className="note-input-bar">
        <span className="dim keys"><kbd>Enter</kbd> save</span>
        <span className="grow" />
        <button className="ghost" onClick={onCancel}>Cancel</button>
        <button className="primary" disabled={!text.trim()} onClick={() => onSave(text)}>Save</button>
      </div>
    </div>
  );
}

function Splitter({ axis, onDrag }) {
  const down = e => {
    e.preventDefault();
    let last = axis === 'x' ? e.clientX : e.clientY;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    el.classList.add('on');
    const move = ev => { const v = axis === 'x' ? ev.clientX : ev.clientY; onDrag(v - last); last = v; };
    const up = () => { el.classList.remove('on'); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
  };
  return <div className={`splitter ${axis}`} onPointerDown={down} />;
}

function MoveConfirm({ g, style, onCancel, onApply }) {
  const [alcance, setAlcance] = useState('siempre');
  const [never, setNever] = useState(false);
  const dir = [g.dx ? `${Math.abs(g.dx)} px ${g.dx > 0 ? 'right' : 'left'}` : null, g.dy ? `${Math.abs(g.dy)} px ${g.dy > 0 ? 'down' : 'up'}` : null].filter(Boolean).join(' and ');
  return (
    <div className="note-input move-confirm" style={style} onPointerDown={e => e.stopPropagation()}>
      <div className="note-input-label accent"><ArrowSwapHorizontal size={15} />Move “{g.label}”</div>
      <div className="move-dir">{dir}</div>
      <div className="seg full">
        <button className={alcance === 'siempre' ? 'on' : ''} onClick={() => setAlcance('siempre')}>Across the whole video</button>
        <button className={alcance === 'solo' ? 'on' : ''} onClick={() => setAlcance('solo')}>Only at {g.t.toFixed(2)} s</button>
      </div>
      <label className="check"><input type="checkbox" checked={never} onChange={e => setNever(e.target.checked)} /><i />Don't ask again</label>
      <div className="note-input-bar">
        <span className="grow" />
        <button className="ghost" onClick={onCancel}>Cancel</button>
        <button className="primary" onClick={() => onApply(alcance, never)}><MagicStar size={16} />Move</button>
      </div>
    </div>
  );
}

function PlaceConfirm({ pl, dur, now, style, onChange, onCancel, onApply }) {
  const num = (k, v) => onChange({ [k]: Math.max(0, Math.min(dur, +(+v).toFixed(2))) });
  return (
    <div className="note-input move-confirm" style={style} onPointerDown={e => e.stopPropagation()}>
      <div className="note-input-label accent"><Gallery size={15} />Image over the video</div>
      <div className="row place-times">
        <label className="mini-field"><span>From</span><input className="mono" type="number" step="0.1" value={pl.t0} onChange={e => num('t0', e.target.value)} onKeyDown={e => e.stopPropagation()} /></label>
        <label className="mini-field"><span>To</span><input className="mono" type="number" step="0.1" value={pl.t1} onChange={e => num('t1', e.target.value)} onKeyDown={e => e.stopPropagation()} /></label>
      </div>
      <div className="seg full">
        <button onClick={() => onChange({ t0: +now.toFixed(2) })}>From the playhead</button>
        <button onClick={() => onChange({ t1: +dur.toFixed(2) })}>To the end</button>
      </div>
      <div className="dim small">Drag to move it; drag the corner to resize.</div>
      <div className="note-input-bar">
        <span className="grow" />
        <button className="ghost" onClick={onCancel}>Cancel</button>
        <button className="primary" disabled={pl.t1 <= pl.t0} onClick={onApply}><MagicStar size={16} />Add</button>
      </div>
    </div>
  );
}

function RenameModal({ actual, titulo, onClose, onSave }) {
  const [v, setV] = useState(actual || '');
  return (
    <div className="modal-scrim" onPointerDown={onClose}>
      <div className="note-input rename" onPointerDown={e => e.stopPropagation()}>
        <div className="note-input-label accent"><Edit2 size={15} />{titulo}</div>
        <input className="path-input" autoFocus value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') onSave(v); if (e.key === 'Escape') onClose(); }} />
        <div className="note-input-bar"><span className="grow" /><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" onClick={() => onSave(v)}>Save</button></div>
      </div>
    </div>
  );
}

function BootScreen({ boot, name, onDone }) {
  const steps = [['proyecto', 'Project'], ['video', 'Video'], ['sonido', 'Sound'], ['cuadros', 'Frames']];
  const done = steps.filter(([k]) => boot[k]).length;
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (done < steps.length) return;
    const a = setTimeout(() => setLeaving(true), 250);
    const b = setTimeout(onDone, 520);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [done]);
  return (
    <div className={`boot ${leaving ? 'out' : ''}`}>
      <div className="boot-card">
        <div className="boot-mark"><VideoPlay size={34} variant="Bold" /></div>
        <div className="boot-name">{name || 'Opening'}</div>
        <div className="boot-bar"><i style={{ transform: `scaleX(${Math.max(0.06, done / steps.length)})` }} /></div>
        <div className="boot-steps">
          {steps.map(([k, l]) => <span key={k} className={boot[k] ? 'ok' : ''}>{boot[k] ? <TickCircle size={15} variant="Bold" /> : <Refresh2 size={15} className="spin" />}{l}</span>)}
        </div>
      </div>
    </div>
  );
}
