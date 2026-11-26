import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Clock, ArrowDown2, Music, Play, Pause, SearchNormal1, Link21, Magicpen, Refresh2, Driver, Monitor, Folder2, FolderOpen, ArrowUp2, VideoSquare, CloseCircle, TickSquare, Box1, Keyboard, Add, InfoCircle, ArrowRight2, TickCircle, Copy } from 'iconsax-reactjs';
import { api } from './lib.js';
import { markTour } from './Tour.jsx';
import { VERSION, CHANGELOG } from './version.js';
import { preview, usePreview, PreviewBar } from './Preview.jsx';

function Item({ it, run }) {
  return (
    <button className="menu-item" disabled={it.disabled} title={it.why || ''} onClick={() => run(it.run)}>
      <span className="menu-icon">{it.check != null ? (it.check ? <TickSquare size={16} /> : null) : it.icon}</span>
      <span className="grow">{it.label}</span>
      {it.keys && <span className="menu-keys">{it.keys}</span>}
      {it.hint && <span className="menu-hint mono">{it.hint}</span>}
    </button>
  );
}

// A submenu is placed in fixed coordinates next to its row and pushed back inside the window when it would not fit.
function SubItem({ it, run }) {
  const row = useRef(null);
  const pop = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const timer = useRef(0);
  useLayoutEffect(() => {
    if (!open || !row.current || !pop.current) return;
    const r = row.current.getBoundingClientRect();
    const w = pop.current.offsetWidth, h = pop.current.offsetHeight;
    let left = r.right + 4;
    if (left + w > innerWidth - 8) left = Math.max(8, r.left - w - 4);
    let top = r.top - 7;
    if (top + h > innerHeight - 8) top = Math.max(8, innerHeight - h - 8);
    setPos({ left, top });
  }, [open]);
  const enter = () => { clearTimeout(timer.current); setOpen(true); };
  const leave = () => { timer.current = setTimeout(() => { setOpen(false); setPos(null); }, 140); };
  return (
    <div className={`menu-item has-sub ${open ? 'on' : ''}`} ref={row} onPointerEnter={enter} onPointerLeave={leave} onClick={enter}>
      <span className="menu-icon">{it.icon}</span><span className="grow">{it.label}</span><ArrowRight2 size={14} />
      {open && (
        <div className="menu-pop sub" ref={pop} style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }} onPointerEnter={enter} onPointerLeave={leave}>
          {it.sub.length ? <MenuList items={it.sub} run={run} />
            : <div className="menu-item disabled"><span className="menu-icon" /><span className="grow dim">Nothing yet</span></div>}
        </div>
      )}
    </div>
  );
}

function MenuList({ items, run }) {
  return items.map((it, i) => it === '-' ? <div key={i} className="menu-sep" />
    : it.header ? <div key={i} className="menu-header">{it.header}</div>
      : it.sub ? <SubItem key={i} it={it} run={run} />
        : <Item key={i} it={it} run={run} />);
}


// Popups are placed in fixed coordinates next to their trigger, so they never grow or get clipped by a scrolling parent.
export function useFloating(open, ref, { width = 380, gap = 6, align = 'left', min = 220 } = {}) {
  const [style, setStyle] = useState(null);
  useLayoutEffect(() => {
    if (!open || !ref.current) { setStyle(null); return; }
    const place = () => {
      const r = ref.current.getBoundingClientRect();
      const w = Math.min(width, innerWidth - 16);
      const below = innerHeight - r.bottom - gap - 8, above = r.top - gap - 8;
      const down = below >= min || below >= above;
      const left = Math.max(8, Math.min(align === 'right' ? r.right - w : r.left, innerWidth - w - 8));
      setStyle({ position: 'fixed', left, width: w, maxHeight: Math.max(160, down ? below : above), ...(down ? { top: r.bottom + gap } : { bottom: innerHeight - r.top + gap }), transformOrigin: `${align === 'right' ? 'right' : 'left'} ${down ? 'top' : 'bottom'}` });
    };
    place();
    addEventListener('resize', place); addEventListener('scroll', place, true);
    return () => { removeEventListener('resize', place); removeEventListener('scroll', place, true); };
  }, [open]);
  return style;
}

export function MenuBar({ menus }) {
  const [open, setOpen] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(null); };
    const esc = e => { if (e.key === 'Escape') setOpen(null); };
    addEventListener('pointerdown', close, true); addEventListener('keydown', esc); addEventListener('blur', () => setOpen(null), { once: true });
    return () => { removeEventListener('pointerdown', close, true); removeEventListener('keydown', esc); };
  }, [open]);
  const run = fn => { setOpen(null); fn(); };
  return (
    <nav className="menubar" ref={ref}>
      {menus.map(m => (
        <div key={m.label} className="menu">
          <button className={`menu-btn ${open === m.label ? 'on' : ''}`} onClick={() => setOpen(o => o === m.label ? null : m.label)} onPointerEnter={() => open && setOpen(m.label)}>{m.label}</button>
          {open === m.label && <div className="menu-pop"><MenuList items={m.items} run={run} /></div>}
        </div>
      ))}
    </nav>
  );
}

export function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    setPos({ left: Math.max(8, Math.min(x, innerWidth - w - 8)), top: Math.max(8, Math.min(y, innerHeight - h - 8)) });
  }, [x, y]);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const el = ref.current;
    const shut = () => closeRef.current();
    const close = e => { if (!el.contains(e.target) && !e.target.closest?.('.menu-pop')) shut(); };
    const esc = e => { if (e.key === 'Escape') shut(); };
    const wheel = e => { if (!e.target.closest?.('.menu-pop')) shut(); };
    const id = setTimeout(() => { addEventListener('pointerdown', close, true); addEventListener('contextmenu', close, true); }, 0);
    addEventListener('keydown', esc); addEventListener('blur', shut); addEventListener('resize', shut); addEventListener('wheel', wheel, true);
    return () => { clearTimeout(id); removeEventListener('pointerdown', close, true); removeEventListener('contextmenu', close, true); removeEventListener('keydown', esc); removeEventListener('blur', shut); removeEventListener('resize', shut); removeEventListener('wheel', wheel, true); };
  }, []);
  const run = fn => { onClose(); fn(); };
  return (
    <div className="menu-pop context" ref={ref} style={pos || { left: x, top: y, visibility: 'hidden' }} onContextMenu={e => e.preventDefault()}>
      <MenuList items={items} run={run} />
    </div>
  );
}

export function Modal({ title, icon, onClose, children, wide }) {
  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="modal-scrim" onPointerDown={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onPointerDown={e => e.stopPropagation()}>
        <div className="modal-head">{icon}<span className="grow">{title}</span><button className="icon-btn" onClick={onClose}><CloseCircle size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}

// The browser's own folder picker is the real Windows dialog and always opens in front.
// It only gives the folder name and its files, so the server finds the matching folder on disk.
export async function nativePick(tipo) {
  if (!window.showDirectoryPicker) throw new Error('This browser has no folder picker.');
  let handle;
  try { handle = await window.showDirectoryPicker({ id: tipo === 'carpeta' ? 'estudio-destino' : 'estudio-video', mode: 'read' }); }
  catch { return { cancelado: true }; }
  const archivos = [];
  let indice = null;
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind === 'file') {
      const size = (await entry.getFile()).size;
      archivos.push({ n: name, s: size });
      if (name === 'index.html') indice = { nombre: name, tam: size };
    } else archivos.push({ n: name, s: null });
    if (archivos.length > 60) break;
  }
  if (tipo !== 'carpeta' && !indice) throw new Error(`"${handle.name}" has no index.html.`);
  const r = await api('localizar', { method: 'POST', body: { nombre: handle.name, archivos, indice } });
  if (!r.rutas.length) throw new Error(`Couldn't find "${handle.name}" on disk.`);
  return { ruta: r.rutas[0] };
}

export function FolderPicker({ title, onClose, onPick, pickLabel = 'Open', requireVideo = true, recents = [] }) {
  const [data, setData] = useState(null);
  const [places, setPlaces] = useState({ lugares: [], unidades: [] });
  const [error, setError] = useState(null);
  const [native, setNative] = useState(false);
  const go = dir => api(`carpetas${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`).then(d => { setData(d); setError(null); }).catch(e => setError(e.message));
  useEffect(() => { go(null); api('lugares').then(setPlaces).catch(() => { }); }, []);
  const explore = async () => {
    setNative(true);
    try {
      const r = await nativePick(requireVideo ? 'video' : 'carpeta');
      if (!r.cancelado) onPick(r.ruta);
    } catch (e) { setError(e.message); }
    finally { setNative(false); }
  };
  return (
    <Modal title={title} icon={<FolderOpen size={20} />} onClose={onClose} wide>
      <div className="picker">
        <div className="picker-side">
          {recents.length > 0 && <>
            <div className="section-title">Recent</div>
            {recents.slice(0, 6).map(r => <button key={r.dir} className="picker-recent" onClick={() => onPick(r.dir)} title={r.dir}><VideoSquare size={17} /><span>{r.name}</span></button>)}
          </>}
          <div className="section-title">Places</div>
          {places.lugares.map(l => <button key={l.ruta} className={`picker-place ${data?.dir === l.ruta ? 'on' : ''}`} onClick={() => go(l.ruta)}><Folder2 size={17} /><span>{l.nombre}</span></button>)}
          {places.unidades.length > 0 && <div className="section-title">Drives</div>}
          {places.unidades.map(l => <button key={l.ruta} className="picker-place" onClick={() => go(l.ruta)}><Driver size={17} /><span>{l.nombre}</span></button>)}
        </div>
        <div className="picker-main">
          <div className="picker-path">
            <button className="icon-btn" disabled={!data?.parent} onClick={() => go(data.parent)} title="Up"><ArrowUp2 size={18} /></button>
            <input className="path-input mono" value={data?.dir || ''} onChange={e => setData(d => ({ ...d, dir: e.target.value }))} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') go(e.currentTarget.value); }} />
          </div>
          <div className="picker-list">
            {error && <div className="error picker-empty">{error}</div>}
            {data?.dirs.map(d => (
              <button key={d.path} className={`picker-row ${d.video ? 'video' : ''}`} onClick={() => (d.video && requireVideo ? onPick(d.path) : go(d.path))}>
                {d.video ? <VideoSquare size={18} /> : <Folder2 size={18} />}<span>{d.name}</span>
              </button>
            ))}
            {data && !data.dirs.length && <div className="dim picker-empty">No folders</div>}
          </div>
        </div>
      </div>
      <div className="modal-foot">
        <button className="ghost" onClick={explore} disabled={native}><Monitor size={18} />{native ? 'Finding the folder' : 'Browse in Windows'}</button>
        <span className="grow" />
        <button className="ghost" onClick={onClose}>Cancel</button>
        <button className="primary" disabled={!data || (requireVideo && !data.video)} title={requireVideo && data && !data.video ? 'This folder has no index.html' : ''} onClick={() => onPick(data.dir)}>{pickLabel}</button>
      </div>
    </Modal>
  );
}

export function NewVideo({ onClose, onDone }) {
  const [name, setName] = useState('');
  const [parent, setParent] = useState(null);
  const [fmt, setFmt] = useState('16:9');
  const [secs, setSecs] = useState(15);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { api('carpetas').then(d => setParent(d.dir)); }, []);
  const sizes = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
  const create = async () => {
    try {
      const [ancho, alto] = sizes[fmt];
      await api('nuevo', { method: 'POST', body: { nombre: name, carpeta: parent, ancho, alto, segundos: secs } });
      onDone();
    } catch (e) { setError(e.message); }
  };
  if (picking) return <FolderPicker title="Where to create the video" requireVideo={false} pickLabel="Choose this folder" onClose={() => setPicking(false)} onPick={d => { setParent(d); setPicking(false); }} />;
  return (
    <Modal title="New video" icon={<Add size={20} />} onClose={onClose}>
      <div className="form">
        <label className="field"><span>Name</span><input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && name.trim()) create(); }} /></label>
        <label className="field"><span>Folder</span><button className="field-btn mono" onClick={() => setPicking(true)}><Folder2 size={16} /><span className="ellipsis">{parent || '...'}</span></button></label>
        <div className="field"><span>Format</span>
          <div className="seg">{Object.keys(sizes).map(k => <button key={k} className={fmt === k ? 'on' : ''} onClick={() => setFmt(k)}>{k}</button>)}</div>
        </div>
        <label className="field"><span>Duration</span><div className="row"><input type="range" min={5} max={60} value={secs} onChange={e => setSecs(+e.target.value)} /><b className="mono">{secs} s</b></div></label>
        {error && <div className="error">{error}</div>}
      </div>
      <div className="modal-foot">
        <span className="dim">OpusCut engine</span>
        <span className="grow" />
        <button className="ghost" onClick={onClose}>Cancel</button>
        <button className="primary" disabled={!name.trim() || !parent} onClick={create}>Create</button>
      </div>
    </Modal>
  );
}

export function Skills({ onClose }) {
  const [list, setList] = useState(null);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const load = () => api('skills').then(setList);
  useEffect(() => { load(); }, []);
  const toggle = async s => {
    const activas = list.filter(x => (x.name === s.name ? !x.activa : x.activa) && !x.fija).map(x => x.name);
    setList(await api('skills', { method: 'POST', body: { activas } }));
  };
  if (adding) return <FolderPicker title="Add a skill" requireVideo={false} pickLabel="Add" onClose={() => setAdding(false)} onPick={async d => { try { await api('skills/agregar', { method: 'POST', body: { dir: d } }); } catch (e) { alert(e.message); } setAdding(false); load(); }} />;
  const groups = list ? [...new Set(list.map(s => s.origen))] : [];
  return (
    <Modal title="Skills and plugins" icon={<Box1 size={20} />} onClose={onClose} wide>
      <div className="skills">
        {!list && <div className="dim">Loading</div>}
        {groups.map(g => (
          <div key={g} className="skill-group">
            <div className="section-title">{g}</div>
            {list.filter(s => s.origen === g).map(s => (
              <div key={s.name} className={`skill ${s.activa ? 'on' : ''}`}>
                <button className="skill-main" onClick={() => setOpen(o => o === s.name ? null : s.name)}>
                  <Box1 size={20} variant={s.activa ? 'Bold' : 'Linear'} />
                  <span className="skill-name">{s.name}</span>
                  <InfoCircle size={16} className="dim" />
                </button>
                <label className={`switch ${s.fija ? 'locked' : ''}`} title={s.fija ? 'Always on' : s.activa ? 'Turn off' : 'Turn on'}>
                  <input type="checkbox" checked={s.activa} disabled={s.fija} onChange={() => toggle(s)} /><i />
                </label>
                {open === s.name && <div className="skill-desc">{s.description}<div className="mono dim">{s.dir}</div></div>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="modal-foot">
        <button className="ghost" onClick={() => setAdding(true)}><Add size={18} />Add folder</button>
        <span className="grow" />
        <button className="primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

const SHORTCUTS = [
  ['Play or pause', 'Space'], ['Previous or next frame', '← →'], ['One second back or forward', 'Shift ← →'], ['Start and end', 'Home  End'],
  ['Inspect', 'V'], ['Note on a point', 'P'], ['Note on an area', 'R'], ['Loop', 'L'], ['Video only', 'F'],
  ['Undo', 'Ctrl Z'], ['Redo', 'Ctrl Shift Z'], ['Open', 'Ctrl O'], ['New video', 'Ctrl N'], ['Export', 'Ctrl E'],
  ['Move an element', 'Drag it'], ['Move in a straight line', 'Shift while dragging'], ['Finer number', 'Alt while dragging'], ['Zoom the timeline', 'Ctrl wheel'],
];
export function Shortcuts({ onClose }) {
  return (
    <Modal title="Shortcuts" icon={<Keyboard size={20} />} onClose={onClose} wide>
      <div className="shortcuts">
        {SHORTCUTS.map(([a, k]) => <div key={a} className="shortcut"><span>{a}</span><span className="keys">{k.split('  ').map(x => <kbd key={x}>{x}</kbd>)}</span></div>)}
      </div>
    </Modal>
  );
}

export function About({ onClose, onWelcome }) {
  const [open, setOpen] = useState(CHANGELOG[0].version);
  return (
    <Modal title="About Kinora" icon={<InfoCircle size={20} />} onClose={onClose} wide>
      <div className="about-grid">
      <div className="about">
        <div className="about-mark"><VideoSquare size={40} variant="Bold" /></div>
        <div className="about-name">Kinora</div>
        <div className="about-tag">Kinora</div>
        <div className="about-version mono">Version {VERSION}</div>
        <div className="dim">A video editor for motion made with code, with Claude inside.</div>
      </div>
      <div className="about-log">
        <div className="section-title"><Clock size={16} />Versions</div>
        {CHANGELOG.map(v => (
          <div key={v.version} className={`log-item ${open === v.version ? 'open' : ''}`}>
            <button className="log-head" aria-expanded={open === v.version} onClick={() => setOpen(o => o === v.version ? null : v.version)}>
              <span className="mono log-v">{v.version}</span><span className="grow">{v.title}</span><span className="dim mono small">{v.date}</span><ArrowDown2 size={13} className="log-caret" />
            </button>
            <div className="log-body" aria-hidden={open !== v.version}>
              <div className="log-inner"><ul className="log-list">{v.items.map((it, i) => <li key={i} style={{ '--i': i }}>{it}</li>)}</ul></div>
            </div>
          </div>
        ))}
      </div>
      </div>
      <div className="modal-foot about-foot">
        <span className="by">by Sebastián Atanes</span>
        <span className="grow" />
        <button className="ghost" onClick={onWelcome}><VideoSquare size={16} />Welcome</button>
        <button className="primary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function Command({ text }) {
  const [done, setDone] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); };
  return (
    <button className="cmd mono" onClick={copy} title="Copy">
      <span className="grow ellipsis">{text}</span>
      {done ? <TickCircle size={16} /> : <Copy size={16} />}
    </button>
  );
}

function Check({ ok, warn, label, detail, children }) {
  return (
    <div className={`wel-check ${ok ? 'ok' : warn ? 'warn' : 'bad'}`}>
      <span className="wel-check-icon">{ok ? <TickCircle size={20} variant="Bold" /> : <InfoCircle size={20} variant="Bold" />}</span>
      <div className="grow">
        <div className="wel-check-label">{label}{detail && <span className="dim mono small"> {detail}</span>}</div>
        {children}
      </div>
    </div>
  );
}

const PLAN = { max: 'Max', pro: 'Pro', team: 'Team', enterprise: 'Enterprise' };

export function Welcome({ onClose, onNew, onOpen, onConnections, preview }) {
  const [st, setSt] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const load = fresh => { setBusy(true); api(`bienvenida?${fresh ? 'fresco=1&' : ''}${preview ? 'vista=nuevo' : ''}`).then(setSt).finally(() => setBusy(false)); };
  useEffect(() => load(false), []);
  const close = () => { if (!preview) api('bienvenida', { method: 'POST' }).catch(() => { }); onClose(); };
  const [installing, setInstalling] = useState(false);
  const [installErr, setInstallErr] = useState(null);
  const install = async () => {
    setInstalling(true); setInstallErr(null);
    try { setSt(await api('instalar', { method: 'POST' })); } catch (e) { setInstallErr(e.message); }
    setInstalling(false);
  };
  const toggleSounds = async on => { await api('conexiones', { method: 'POST', body: { openverse: on } }); load(true); };
  const example = async () => {
    setBusy(true); setError(null);
    try { markTour(true); await api('ejemplo', { method: 'POST', body: {} }); close(); } catch (e) { markTour(false); setError(e.message); setBusy(false); }
  };
  const c = st?.claude, py = st?.python;
  const claudeOk = !!(c?.instalado && c?.conectado);
  const toolsOk = !!(py?.ok && py?.faltan && !py.faltan.length && st?.ffmpeg);
  const steps = [
    { title: 'Claude', ok: claudeOk },
    { title: 'This computer', ok: toolsOk },
    { title: 'Images and sounds', ok: !!st?.sonidos },
    { title: 'Start', ok: false },
  ];
  return (
    <Modal title="Welcome to Kinora" icon={<VideoSquare size={20} />} onClose={close} wide>
      <div className="welcome">
        <ol className="wel-steps">
          {steps.map((s, i) => (
            <li key={s.title}>
              <button className={`wel-step ${step === i ? 'on' : ''} ${s.ok ? 'done' : ''}`} onClick={() => setStep(i)}>
                <span className="wel-num mono">{s.ok ? <TickCircle size={16} variant="Bold" /> : i + 1}</span>
                <span className="grow">{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="wel-body" key={step}>
          {step === 0 && <>
            <h3>Connect Claude</h3>
            <p className="dim">Kinora runs Claude Code on this computer with your own account. No key is stored in Kinora.</p>
            {!st ? <div className="wel-loading"><Refresh2 size={18} className="spin" /></div> : <>
              <Check ok={c.instalado} label="Claude Code" detail={c.version}>
                {!c.instalado && <Command text="npm install -g @anthropic-ai/claude-code" />}
              </Check>
              <Check ok={c.conectado} label={c.conectado ? 'Signed in' : 'Not signed in'} detail={c.conectado ? [PLAN[c.plan] && `${PLAN[c.plan]} plan`, c.metodo === 'claude.ai' ? 'claude.ai account' : c.metodo].filter(Boolean).join(' · ') : null}>
                {!c.conectado && <Command text="claude auth login" />}
              </Check>
            </>}
          </>}
          {step === 1 && <>
            <h3>This computer</h3>
            <p className="dim">Sound, export and frame capture run locally.</p>
            {!st ? <div className="wel-loading"><Refresh2 size={18} className="spin" /></div> : <>
              <Check ok={py.ok} label="Python" detail={py.version}>
                {!py.ok && <a className="link" href="https://www.python.org/downloads/" target="_blank" rel="noreferrer">python.org/downloads</a>}
              </Check>
              <Check ok={py.ok && py.faltan && !py.faltan.length} warn={!py.ok} label="Python packages" detail={py.faltan?.length ? `missing ${py.faltan.join(', ')}` : null}>
                {py.ok && py.faltan?.length > 0 && <>
                  <button className="primary small-btn" disabled={installing} onClick={install}>{installing ? <><Refresh2 size={16} className="spin" />Installing, this takes a minute</> : 'Install'}</button>
                  {installErr && <div className="error mono small">{installErr}</div>}
                </>}
              </Check>
              <Check ok={st.ffmpeg} label="ffmpeg" detail={st.ffmpeg ? null : 'needed to export'}>
                {!st.ffmpeg && <Command text={{ win32: 'winget install ffmpeg', darwin: 'brew install ffmpeg' }[st.plataforma] || 'sudo apt install ffmpeg'} />}
              </Check>
            </>}
          </>}
          {step === 2 && <>
            <h3>Images and sounds</h3>
            <p className="dim">Both are optional.</p>
            {!st ? <div className="wel-loading"><Refresh2 size={18} className="spin" /></div> : <>
              <Check ok={st.sonidos} warn label="Free sounds and music" detail={st.sonidos ? 'included' : 'off'}>
                <label className="switch wel-switch" title={st.sonidos ? 'Turn off' : 'Turn on'}><input type="checkbox" checked={st.sonidos} onChange={e => toggleSounds(e.target.checked)} /><i /></label>
              </Check>
              <Check ok={!!st.imagenes} warn label="Image generation" detail={st.imagenes === 'openrouter' ? 'OpenRouter' : st.imagenes === 'gateway' ? 'Vercel AI Gateway' : 'not connected'}>
                <button className="ghost small-btn" onClick={onConnections}><Link21 size={16} />{st.imagenes ? 'Change' : 'Connect'}</button>
              </Check>
            </>}
          </>}
          {step === 3 && <>
            <h3>Start</h3>
            <div className="wel-cards">
              <button className="wel-card" disabled={busy} onClick={example}>
                <Play size={26} variant="Bulk" />
                <b>Example video</b>
                <span className="dim">8 seconds, ready to edit</span>
              </button>
              <button className="wel-card" onClick={() => { close(); onNew(); }}>
                <Add size={26} />
                <b>New video</b>
                <span className="dim">Empty, any format</span>
              </button>
              <button className="wel-card" onClick={() => { close(); onOpen(); }}>
                <FolderOpen size={26} variant="Bulk" />
                <b>Open a folder</b>
                <span className="dim">A video made with code</span>
              </button>
            </div>
            {error && <div className="error">{error}</div>}
          </>}
        </div>
      </div>
      <div className="modal-foot">
        {step < 3 && <button className="ghost" disabled={busy} onClick={() => load(true)}><Refresh2 size={16} className={busy ? 'spin' : ''} />Check again</button>}
        <span className="grow" />
        {step > 0 && <button className="ghost" onClick={() => setStep(step - 1)}>Back</button>}
        {step < 3 ? <button className="primary" onClick={() => setStep(step + 1)}>Next</button> : <button className="ghost" onClick={close}>Close</button>}
      </div>
    </Modal>
  );
}

export function Connections({ onClose }) {
  const [c, setC] = useState(null);
  const [edit, setEdit] = useState({});
  const [models, setModels] = useState([]);
  useEffect(() => { api('conexiones').then(setC); api('modelos-imagen').then(setModels).catch(() => { }); }, []);
  const save = async patch => { setC(await api('conexiones', { method: 'POST', body: patch })); if ('openrouter' in patch || 'gateway' in patch) api('modelos-imagen').then(setModels).catch(() => { }); };
  const rows = [
    { k: 'openrouter', name: 'OpenRouter', what: 'Images: GPT Image, Gemini and the other image models OpenRouter offers.' },
    { k: 'gateway', name: 'Vercel AI Gateway', what: 'Images: GPT Image 2, FLUX, Imagen, Grok Imagine, Recraft, Nano Banana and the other image models in the Gateway.' },
    { k: 'tripo', name: 'Tripo', what: '3D models from an image or a sentence. Coming in the next version.', later: true },
  ];
  return (
    <Modal title="Connections" icon={<Link21 size={20} />} onClose={onClose} wide>
      <div className="conns">
        <div className="conn">
          <div className="conn-head">
            <span className="conn-name">Free sounds</span>
            {c?.openverse ? <span className="pill ok">Connected</span> : <span className="pill">Not connected</span>}
            <span className="grow" />
            <label className="switch" title={c?.openverse ? 'Disconnect' : 'Allow'}><input type="checkbox" checked={!!c?.openverse} onChange={e => save({ openverse: e.target.checked })} /><i /></label>
          </div>
          <div className="conn-what">Sound effects and music with free licenses for commercial use, from Freesound, Wikimedia Commons and Jamendo through Openverse. No account or key needed, up to 200 searches a day.</div>
        </div>
        {rows.map(r => (
          <div key={r.k} className="conn">
            <div className="conn-head">
              <span className="conn-name">{r.name}</span>
              {c?.[r.k] ? <span className="pill ok">Connected</span> : <span className="pill">Not connected</span>}
              {r.later && <span className="pill work">Coming soon</span>}
              <span className="grow" />
              <span className="mono dim">{c?.[r.k] || ''}</span>
            </div>
            <div className="conn-what">{r.what}</div>
            <div className="row">
              <input className="path-input mono" type="password" placeholder="API key" value={edit[r.k] || ''} onChange={e => setEdit(v => ({ ...v, [r.k]: e.target.value }))} onKeyDown={e => e.stopPropagation()} />
              <button className="ghost" disabled={!edit[r.k]} onClick={async () => { await save({ [r.k]: edit[r.k].trim() }); setEdit(v => ({ ...v, [r.k]: '' })); }}>Save</button>
              {c?.[r.k] && <button className="ghost" onClick={() => save({ [r.k]: null })}>Remove</button>}
            </div>
            {r.k === 'gateway' && models.length > 0 && (
              <label className="field"><span>Default image model</span>
                <ModelSelect models={models} value={c?.modeloImagen} onChange={v => save({ modeloImagen: v })} />
              </label>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function GenerateImage({ onClose, refs, assets, stamp, onDone }) {
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('1:1');
  const [fondo, setFondo] = useState('normal');
  const [chosen, setChosen] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [out, setOut] = useState(null);
  const [con, setCon] = useState(null);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState(null);
  useEffect(() => { api('conexiones').then(c => { setCon(c); setModel(m => m || (c.modeloImagen.includes(':') ? c.modeloImagen : `openrouter:${c.modeloImagen}`)); }); api('modelos-imagen').then(setModels).catch(() => { }); }, []);
  const current = models.find(m => m.id === model);
  const connected = con && (con.openrouter || con.gateway);
  const pool = [...refs, ...assets].filter((f, i, a) => a.indexOf(f) === i && /\.(png|jpe?g|webp)$/i.test(f) && !/\/\d{5}\.(jpe?g|png)$/.test(f)).slice(0, 30);
  const go = async () => {
    setBusy(true); setError(null);
    try { const r = await api('generar', { method: 'POST', body: { prompt, refs: chosen, ratio, fondo, modelo: model } }); setOut(r); onDone?.(r); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="Generate image" icon={<Magicpen size={20} />} onClose={onClose} wide>
      <div className="form gen">
        {con && !connected && <div className="error">Connect OpenRouter or AI Gateway in Tools, Connections.</div>}
        <textarea className="gen-prompt" rows={4} autoFocus placeholder="Describe the image you want" value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.stopPropagation()} />
        <div className="row wrap">
          <div className="seg">{['1:1', '16:9', '9:16', '4:3', '3:4'].map(r => <button key={r} className={ratio === r ? 'on' : ''} onClick={() => setRatio(r)}>{r}</button>)}</div>
          <div className="seg"><button className={fondo === 'normal' ? 'on' : ''} onClick={() => setFondo('normal')}>With background</button><button className={fondo === 'transparente' ? 'on' : ''} onClick={() => setFondo('transparente')}>No background</button></div>
          <span className="grow" />
          {models.length > 0 && <ModelSelect models={models} value={model} onChange={setModel} />}
        </div>
        {current && chosen.length > 0 && !current.referencias && <div className="dim">This model doesn't use reference images. They will be ignored.</div>}
        {pool.length > 0 && (
          <div className="field"><span>References {chosen.length ? `(${chosen.length})` : ''}</span>
            <div className="ref-pick">
              {pool.map(f => (
                <button key={f} className={`ref-tile ${chosen.includes(f) ? 'on' : ''}`} title={f} onClick={() => setChosen(c => c.includes(f) ? c.filter(x => x !== f) : [...c, f].slice(-4))}>
                  <img src={`/proyecto/${f}?v=${stamp}`} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}
        {out && <div className="gen-out"><img src={`/proyecto/${out.archivo}?v=${Date.now()}`} alt="" /><div className="mono dim">{out.archivo}{out.costo != null ? ` · US$ ${Number(out.costo).toFixed(3)}` : ''}</div></div>}
        {error && <div className="error">{error}</div>}
      </div>
      <div className="modal-foot">
        <span className="dim">Saved in assets/gen</span>
        <span className="grow" />
        <button className="ghost" onClick={onClose}>{out ? 'Done' : 'Cancel'}</button>
        <button className="primary" disabled={!prompt.trim() || busy || (con && !connected)} onClick={go}>{busy ? <><Refresh2 size={17} className="spin" />Generating</> : <><Magicpen size={17} />{out ? 'Another' : 'Generate'}</>}</button>
      </div>
    </Modal>
  );
}

export function SoundSearch({ onClose, preset, onAdded }) {
  const [con, setCon] = useState(null);
  const [q, setQ] = useState(preset?.q || '');
  const [tipo, setTipo] = useState(preset?.tipo || 'efecto');
  const [largo, setLargo] = useState(preset?.tipo === 'musica' ? 'medium' : 'shortest');
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState({});
  const pv = usePreview();
  const playing = pv.playing ? pv.item?.key : null;
  const [reco, setReco] = useState(null);
  useEffect(() => { api('conexiones').then(setCon); return () => preview.close(); }, []);
  useEffect(() => { if (con?.openverse && preset?.q) search(preset.q); }, [con]);
  const [touched, setTouched] = useState(false);
  const [stale, setStale] = useState(false);
  const [gen, setGen] = useState(0);
  useEffect(() => {
    if (!con?.openverse) return;
    let on = true;
    setStale(true); setError(null);
    api(`sonidos/recomendados?tipo=${tipo}${touched ? `&largo=${largo}` : ''}`).then(r => { if (on) { setReco(r); setStale(false); setGen(g => g + 1); } }).catch(e => { if (on) { setError(e.message); setStale(false); } });
    if (list && q.trim()) search();
    return () => { on = false; };
  }, [con, tipo, largo]);
  const search = async (text = q) => {
    if (!text.trim()) return;
    setBusy(true); setError(null);
    try { setList(await api(`sonidos/buscar?q=${encodeURIComponent(text)}&tipo=${tipo}&largo=${largo}`)); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const play = x => preview.play({ ...x, added: !!added[x.id] && added[x.id] !== 'bajando', onAdd: () => add(x) });
  const add = async x => {
    setAdded(a => ({ ...a, [x.id]: 'bajando' }));
    try {
      const r = await api('sonidos/bajar', { method: 'POST', body: x });
      setAdded(a => ({ ...a, [x.id]: r.archivo }));
      if (pv.item?.key === x.url) preview.markAdded();
      onAdded?.(r, x);
    } catch (e) { setAdded(a => ({ ...a, [x.id]: null })); setError(e.message); throw e; }
  };
  if (con && !con.openverse) {
    return (
      <Modal title="Free sounds" icon={<Music size={20} />} onClose={onClose}>
        <div className="form">
          <div className="conn-what">Sound effects and music with free licenses for commercial use, from Freesound, Wikimedia Commons and Jamendo. No account or key needed.</div>
        </div>
        <div className="modal-foot"><span className="grow" /><button className="ghost" onClick={onClose}>Not now</button><button className="primary" onClick={async () => setCon(await api('conexiones', { method: 'POST', body: { openverse: true } }))}>Allow the connection</button></div>
      </Modal>
    );
  }
  return (
    <Modal title={preset?.t != null ? `Sound for ${preset.t.toFixed(2)} s${preset.bus ? ` · ${preset.bus}` : ''}` : 'Free sounds'} icon={<Music size={20} />} onClose={onClose} wide>
      <div className="form snd">
        <div className="row">
          <input className="path-input" autoFocus placeholder={tipo === 'musica' ? 'cinematic, lofi, ambient piano' : 'whoosh, sword slash, rain, ui click'} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') search(); }} />
          <button className="primary" disabled={!q.trim() || busy} onClick={() => search()}>{busy ? <Refresh2 size={17} className="spin" /> : <SearchNormal1 size={17} />}Search</button>
        </div>
        <div className="row wrap">
          <div className="seg"><button className={tipo === 'efecto' ? 'on' : ''} onClick={() => { setTipo('efecto'); if (!touched) setLargo('shortest'); }}>Effects</button><button className={tipo === 'musica' ? 'on' : ''} onClick={() => { setTipo('musica'); if (!touched) setLargo('medium'); }}>Music</button></div>
          <div className="seg">{[['shortest', 'Short'], ['short', 'Medium'], ['medium', 'Long'], ['long', 'Very long']].map(([k, l]) => <button key={k} className={largo === k ? 'on' : ''} onClick={() => { setTouched(true); setLargo(k); }}>{l}</button>)}</div>
        </div>
        {error && <div className="error">{error}</div>}
        {!list && (
          <div className={`reco ${stale && reco ? 'stale' : ''}`} key={gen}>
            {!reco && !error && <div className="dim reco-loading"><Refresh2 size={16} className="spin" />Finding recommendations</div>}
            {reco?.map((g, gi) => (
              <div key={g.q} className="reco-group" style={{ '--i': gi }}>
                <button className="reco-title" onClick={() => { setQ(g.q); search(g.q); }}>
                  {g.delVideo && <span className="pill work">From this video</span>}
                  <span>{g.titulo}</span><ArrowRight2 size={14} />
                </button>
                <div className="reco-row">
                  {g.items.map(x => (
                    <div key={x.id} className={`reco-card ${playing === x.url ? 'on' : ''}`}>
                      <button className={`play-sm ${playing === x.url ? 'on' : ''}`} onClick={() => play(x)}>{playing === x.url ? <Pause size={15} variant="Bold" /> : <Play size={15} variant="Bold" />}</button>
                      <div className="reco-info">
                        <div className="snd-title" title={x.titulo}>{x.titulo}</div>
                        <div className="snd-meta"><span className="mono">{x.duracion ? `${x.duracion.toFixed(1)} s` : ''}</span>{!x.cc0 && <span className="credit" title={x.licencia}>needs credit</span>}</div>
                      </div>
                      {added[x.id] && added[x.id] !== 'bajando'
                        ? <span className="reco-ok"><TickSquare size={17} /></span>
                        : <button className="icon-btn sm" title="Add" disabled={added[x.id] === 'bajando'} onClick={() => add(x)}>{added[x.id] === 'bajando' ? <Refresh2 size={15} className="spin" /> : <Add size={16} />}</button>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="snd-list">
          {list && <button className="ghost sm back" onClick={() => setList(null)}><ArrowRight2 size={14} style={{ transform: 'rotate(180deg)' }} />Recommended</button>}
          {list && !list.length && <div className="dim">No results</div>}
          {list?.map(x => (
            <div key={x.id} className="snd-row">
              <button className={`play-sm ${playing === x.url ? 'on' : ''}`} onClick={() => play(x)}>{playing === x.url ? <Pause size={15} variant="Bold" /> : <Play size={15} variant="Bold" />}</button>
              <div className="snd-info">
                <div className="snd-title">{x.titulo}</div>
                <div className="snd-meta"><span className="mono">{x.duracion ? `${x.duracion.toFixed(1)} s` : ''}</span>{!x.cc0 && <span className="credit" title={x.licencia}>needs credit</span>}<span className="dim">{x.fuente}{x.autor ? ` · ${x.autor}` : ''}</span></div>
              </div>
              {added[x.id] && added[x.id] !== 'bajando'
                ? <span className="pill ok"><TickSquare size={14} />Added</span>
                : <button className="ghost sm" disabled={added[x.id] === 'bajando'} onClick={() => add(x)}>{added[x.id] === 'bajando' ? <Refresh2 size={15} className="spin" /> : <Add size={15} />}Add</button>}
            </div>
          ))}
        </div>
      </div>
      <div className="modal-foot pv-foot"><PreviewBar /><button className="primary" onClick={onClose}>Done</button></div>
    </Modal>
  );
}

export function ModelSelect({ models, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const pop = useRef(null);
  const current = models.find(m => m.id === value);
  const float = useFloating(open, ref, { width: 380, align: 'right' });
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    addEventListener('pointerdown', close, true); addEventListener('keydown', esc, true);
    return () => { removeEventListener('pointerdown', close, true); removeEventListener('keydown', esc, true); };
  }, [open]);
  useLayoutEffect(() => { if (open && float) pop.current?.querySelector('.ms-row.on')?.scrollIntoView({ block: 'nearest' }); }, [open, !!float]);
  const text = q.trim().toLowerCase();
  const list = models.filter(m => !text || `${m.nombre} ${m.autor} ${m.id}`.toLowerCase().includes(text));
  const groups = {};
  for (const x of list) (groups[x.proveedor] ||= []).push(x);
  return (
    <div className="ms" ref={ref}>
      <button className={`ms-btn ${open ? 'on' : ''}`} onClick={() => setOpen(o => !o)}>
        <span className="ms-name">{current ? current.nombre : 'Choose a model'}</span>
        {current && <span className="ms-prov">{current.proveedor}</span>}
        <ArrowDown2 size={14} className="ms-caret" />
      </button>
      {open && (
        <div className="ms-pop floating" ref={pop} style={float || { visibility: 'hidden' }}>
          <div className="ms-search"><SearchNormal1 size={15} /><input autoFocus placeholder="Search model" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.stopPropagation()} /></div>
          <div className="ms-list">
            {Object.entries(groups).map(([prov, items]) => (
              <div key={prov}>
                <div className="ms-group">{prov}<span>{items.length}</span></div>
                {items.slice().sort((a, b) => a.autor.localeCompare(b.autor) || a.nombre.localeCompare(b.nombre)).map(x => (
                  <button key={x.id} className={`ms-row ${x.id === value ? 'on' : ''}`} onClick={() => { onChange(x.id); setOpen(false); setQ(''); }}>
                    <span className="ms-row-name">{x.nombre}</span>
                    <span className="ms-row-meta">{x.autor}{x.referencias ? ' · uses references' : ''}</span>
                    {x.id === value && <TickSquare size={16} className="ms-check" />}
                  </button>
                ))}
              </div>
            ))}
            {!list.length && <div className="dim ms-empty">No models match</div>}
          </div>
        </div>
      )}
    </div>
  );
}
