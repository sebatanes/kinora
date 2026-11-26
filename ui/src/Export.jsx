import { useEffect, useMemo, useState } from 'react';
import { ArrowDown2, SearchNormal1, InfoCircle, Export, CloseCircle, TickCircle, Refresh2, Warning2, FolderOpen, Copy, VideoPlay, Gallery, DocumentText, Music, VolumeHigh, VolumeSlash, Timer1, Image as ImageIcon, ArrowRotateLeft, Clock } from 'iconsax-reactjs';
import { useRef, useLayoutEffect } from 'react';
import { api, clamp } from './lib.js';
import { ALL, MAIN, SHORT, DESTINOS, PlatformIcon } from './platforms.jsx';
import { useFloating } from './Menus.jsx';

const FORMATS = [['mp4', 'MP4'], ['webm', 'WebM'], ['gif', 'GIF'], ['png', 'PNG'], ['cuadro', 'Frame']];
const STAGES = { imagen: 'Image', sonido: 'Sound', formato: 'Format', guardado: 'Saving' };

const mb = b => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
const secs = s => (s == null ? '' : s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);

export default function ExportModal({ info, t, name, job, frame, onClose }) {
  const [preset, setPreset] = useState('original');
  const [o, setO] = useState({ formato: 'mp4', calidad: 'alta', ajuste: 'encajar', audio: true, destino: 'proyecto', tramo: 'todo', desde: 0, hasta: info.duracion, nombre: name });
  const [hist, setHist] = useState([]);
  const [error, setError] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [dismissed, setDismissed] = useState(null);
  useEffect(() => { api('exportar/historial').then(setHist).catch(() => { }); }, [job?.estado]);

  const set = patch => setO(v => ({ ...v, ...patch }));
  const choose = p => {
    setPreset(p.id);
    const base = { ancho: undefined, alto: undefined, fps: undefined, ajuste: 'encajar' };
    const next = { ...base, ...p.o };
    if (next.ancho && !next.alto) next.alto = Math.round(next.ancho * info.alto / info.ancho / 2) * 2;
    if (next.ancho === info.ancho && next.alto === info.alto) { next.ancho = undefined; next.alto = undefined; }
    set(next);
  };
  const chosen = ALL.find(x => x.id === preset);

  const W = o.ancho || info.ancho, H = o.alto || info.alto;
  const fps = o.fps || info.fps;
  const dur = o.tramo === 'todo' ? info.duracion : Math.max(0, o.hasta - o.desde);
  const aspectChanged = Math.abs(W / H - info.ancho / info.alto) > 0.01;
  const q = { alta: 0, media: 1, liviana: 2 }[o.calidad];
  const size = useMemo(() => {
    if (o.formato === 'cuadro') return W * H * 1.1;
    if (o.formato === 'png') return W * H * 1.1 * fps * dur;
    const bpp = { mp4: [0.09, 0.055, 0.03], webm: [0.06, 0.035, 0.02], gif: [0.5, 0.35, 0.22] }[o.formato][q];
    const audio = o.audio && o.formato !== 'gif' ? [256, 192, 128][q] * 1000 / 8 * dur : 0;
    return W * H * fps * dur * bpp / 8 + audio;
  }, [o, W, H, fps, dur, q]);

  const start = async () => {
    setError(null);
    const body = {
      formato: o.formato, calidad: o.calidad, ajuste: o.ajuste, audio: o.audio, destino: o.destino, nombre: o.nombre,
      ...(o.ancho ? { ancho: W, alto: H } : {}), ...(o.fps && o.fps !== info.fps ? { fps: o.fps } : {}),
      ...(o.tramo === 'tramo' ? { desde: o.desde, hasta: o.hasta } : {}), ...(o.formato === 'cuadro' ? { t } : {}),
    };
    try { await api('exportar', { method: 'POST', body }); } catch (e) { setError(e.message); }
  };

  const running = job?.estado === 'exportando';
  const finished = job && ['listo', 'error', 'cancelado'].includes(job.estado);
  const view = running ? 'progreso' : finished && dismissed !== job.id ? 'fin' : 'form';

  return (
    <div className="modal-scrim" onPointerDown={() => !running && onClose()}>
      <div className="modal wide exp" onPointerDown={e => e.stopPropagation()}>
        <div className="modal-head"><Export size={20} /><span className="grow">Export</span><button className="icon-btn" onClick={onClose} title={running ? 'Keep running in the background' : 'Close'}><CloseCircle size={20} /></button></div>

        {view === 'form' && (
          <div className="exp-body">
            <div className="exp-form">
              <div className="exp-presets">
                {MAIN.map(id => ALL.find(x => x.id === id)).map(p => (
                  <button key={p.id} className={`exp-preset ${preset === p.id ? 'on' : ''}`} onClick={() => choose(p)}>
                    <span className="exp-preset-icon"><PlatformIcon id={p.icon} size={20} /></span>
                    <span className="exp-preset-text"><b>{SHORT[p.id][0]}</b><span>{SHORT[p.id][1]}</span></span>
                  </button>
                ))}
                <DestinoPicker value={preset} onPick={choose} highlighted={chosen && !MAIN.includes(chosen.id) ? chosen : null} />
              </div>

              <div className="exp-row"><span className="exp-label">Format</span>
                <div className="seg">{FORMATS.map(([k, l]) => <button key={k} className={o.formato === k ? 'on' : ''} onClick={() => { setPreset(null); set({ formato: k }); }}>{l}</button>)}</div>
              </div>

              <div className="exp-row"><span className="exp-label">Size</span>
                <div className="exp-size">
                  <input className="mono" type="number" value={W} onChange={e => { setPreset(null); const w = clamp(+e.target.value || 2, 2, 7680); set({ ancho: w, alto: o.ancho && aspectChanged ? H : Math.round(w * info.alto / info.ancho / 2) * 2 }); }} onKeyDown={e => e.stopPropagation()} />
                  <span className="dim">×</span>
                  <input className="mono" type="number" value={H} onChange={e => { setPreset(null); set({ ancho: W, alto: clamp(+e.target.value || 2, 2, 7680) }); }} onKeyDown={e => e.stopPropagation()} />
                  <div className="seg">{[[1, '100%'], [0.75, '75%'], [0.5, '50%']].map(([k, l]) => <button key={l} className={!aspectChanged && Math.round(info.ancho * k) === W ? 'on' : ''} onClick={() => { setPreset(null); set(k === 1 ? { ancho: undefined, alto: undefined } : { ancho: Math.round(info.ancho * k / 2) * 2, alto: Math.round(info.alto * k / 2) * 2 }); }}>{l}</button>)}</div>
                </div>
              </div>

              <Row label="Aspect ratio" off={!aspectChanged && 'The size has the same aspect ratio as the video, so there is nothing to fit or crop.'}>
                <div className="seg"><button className={o.ajuste !== 'recortar' ? 'on' : ''} onClick={() => set({ ajuste: 'encajar' })}>Fit with borders</button><button className={o.ajuste === 'recortar' ? 'on' : ''} onClick={() => set({ ajuste: 'recortar' })}>Crop</button></div>
              </Row>

              <Row label="Frames per second" off={o.formato === 'cuadro' && 'A single frame has no frame rate.'}>
                <div className="seg">{[60, 50, info.fps, 24, 15, 12].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a).map(v => <button key={v} className={fps === v ? 'on' : ''} onClick={() => { setPreset(null); set({ fps: v === info.fps ? undefined : v }); }}>{v}</button>)}</div>
              </Row>

              <Row label="Quality" off={['cuadro', 'png'].includes(o.formato) && 'PNG saves every frame losslessly, so it has no quality levels.'}>
                <div className="seg">{[['alta', 'High'], ['media', 'Medium'], ['liviana', 'Light']].map(([k, l]) => <button key={k} className={o.calidad === k ? 'on' : ''} onClick={() => { setPreset(null); set({ calidad: k }); }}>{l}</button>)}</div>
              </Row>

              <Row label="What to export" off={o.formato === 'cuadro' && `Exports the frame on screen, at ${t.toFixed(2)} s.`}>
                <div className="exp-range">
                  <div className="seg"><button className={o.tramo === 'todo' ? 'on' : ''} onClick={() => set({ tramo: 'todo' })}>All</button><button className={o.tramo === 'tramo' ? 'on' : ''} onClick={() => set({ tramo: 'tramo' })}>A range</button></div>
                  <div className={`exp-range-fields ${o.tramo === 'tramo' ? '' : 'off'}`}>
                    <input className="mono" type="number" step="0.1" disabled={o.tramo !== 'tramo'} value={o.desde} onChange={e => set({ desde: clamp(+e.target.value, 0, o.hasta - 0.1) })} onKeyDown={e => e.stopPropagation()} />
                    <span className="dim">to</span>
                    <input className="mono" type="number" step="0.1" disabled={o.tramo !== 'tramo'} value={o.hasta} onChange={e => set({ hasta: clamp(+e.target.value, o.desde + 0.1, info.duracion) })} onKeyDown={e => e.stopPropagation()} />
                    <button className="icon-btn sm" title="Start at the playhead" disabled={o.tramo !== 'tramo'} onClick={() => set({ desde: +t.toFixed(2) })}><Timer1 size={16} /></button>
                  </div>
                </div>
              </Row>

              <Row label="Sound" off={!['mp4', 'webm'].includes(o.formato) && ({ gif: 'GIFs have no sound.', png: 'Frame sequences have no sound.', cuadro: 'A frame has no sound.' })[o.formato]}>
                <div className="seg"><button className={o.audio ? 'on' : ''} onClick={() => set({ audio: true })}><VolumeHigh size={15} />With sound</button><button className={!o.audio ? 'on' : ''} onClick={() => set({ audio: false })}><VolumeSlash size={15} />Muted</button></div>
              </Row>

              <div className="exp-row"><span className="exp-label">Save as</span>
                <div className="exp-save">
                  <input value={o.nombre} onChange={e => set({ nombre: e.target.value })} onKeyDown={e => e.stopPropagation()} />
                  <div className="seg"><button className={o.destino === 'proyecto' ? 'on' : ''} onClick={() => set({ destino: 'proyecto' })}>In the project</button><button className={o.destino === 'descargas' ? 'on' : ''} onClick={() => set({ destino: 'descargas' })}>Downloads</button></div>
                </div>
              </div>
            </div>

            <div className="exp-side">
              <div className="exp-frame" style={{ aspectRatio: `${W} / ${H}` }}>
                {frame && <img src={frame} alt="" className={aspectChanged && o.ajuste === 'recortar' ? 'crop' : ''} />}
              </div>
              <div className="exp-summary">
                <div><span>Output</span><b>{({ mp4: 'MP4', webm: 'WebM', gif: 'GIF', png: 'PNG sequence', cuadro: 'PNG' })[o.formato]} · {W}×{H}</b></div>
                {o.formato !== 'cuadro' && <div><span>Duration</span><b>{dur.toFixed(1)} s · {fps} fps</b></div>}
                <div><span>Estimated size</span><b>≈ {mb(size)}</b></div>
                <div><span>Folder</span><b className="ellipsis">{o.destino === 'descargas' ? 'Downloads' : 'out/exports'}</b></div>
              </div>
              {chosen?.limiteMB && size > chosen.limiteMB * 1e6 && <div className="exp-warn"><InfoCircle size={16} />It may go over the {chosen.limiteMB} MB limit of {chosen.grupo}. Lower the quality, the size or the range.</div>}
              {chosen?.maxSeg && dur > chosen.maxSeg && <div className="exp-warn"><InfoCircle size={16} />{chosen.nombre} accepts up to {chosen.maxSeg} s and the video is {dur.toFixed(1)} s. Export a range.</div>}
              {o.formato === 'gif' && !chosen?.limiteMB && size > 15e6 && <div className="exp-warn"><InfoCircle size={16} />A GIF this size is heavy: most networks accept up to 15 MB. Try 640 px and 15 fps.</div>}
              {fps > info.fps && o.formato !== 'cuadro' && <div className="exp-warn soft"><InfoCircle size={16} />Renders {fps} real frames per second, computed by the engine: motion comes out smoother and takes about {Math.round(fps / info.fps * 10) / 10} times longer.</div>}
              {(W > info.ancho || H > info.alto) && !aspectChanged && <div className="exp-warn soft"><InfoCircle size={16} />The project is {info.ancho}×{info.alto} and will be scaled up to {W}×{H}.</div>}
              {error && <div className="error">{error}</div>}
              {hist.length > 0 && (
                <div className="exp-hist">
                  <div className="section-title"><Clock size={16} />Recent</div>
                  {hist.slice(0, 4).map(h => (
                    <button key={h.ruta} className="exp-hist-row" title={h.ruta} onClick={() => api('exportar/abrir', { method: 'POST', body: { ruta: h.ruta, carpeta: true } })}>
                      <span className="ellipsis">{h.nombre}</span><span className="dim mono">{mb(h.tamano)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'progreso' && <Progress job={job} showLog={showLog} setShowLog={setShowLog} />}
        {view === 'fin' && <Done job={job} />}

        <div className="modal-foot">
          {view === 'form' && <>
            <span className="dim">Rendered with the project's engine, with full motion blur</span>
            <span className="grow" />
            <button className="ghost" onClick={onClose}>Cancel</button>
            <button className="primary" onClick={start}><Export size={17} />Export</button>
          </>}
          {view === 'progreso' && <>
            <span className="dim">You can close this window. Progress stays at the top</span>
            <span className="grow" />
            <button className="ghost" onClick={() => api('exportar/cancelar', { method: 'POST' })}>Cancel export</button>
          </>}
          {view === 'fin' && <>
            <span className="grow" />
            <button className="ghost" onClick={() => { setDismissed(job.id); onClose(); }}>Close</button>
            <button className="primary" onClick={() => { setDismissed(job.id); setShowLog(false); }}><ArrowRotateLeft size={17} />Export another</button>
          </>}
        </div>
      </div>
    </div>
  );
}

function Progress({ job, showLog, setShowLog }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, []);
  const elapsed = (now - job.inicio) / 1000;
  return (
    <div className="exp-progress">
      <div className="exp-big">
        <span className="exp-pct mono">{Math.floor((job.pct || 0) * 100)}<small>%</small></span>
        <div className="exp-bar"><i style={{ transform: `scaleX(${job.pct || 0})` }} /></div>
        <div className="exp-times"><span>{secs(elapsed)} elapsed</span>{job.restante != null && <span>≈ {secs(job.restante)} left</span>}</div>
      </div>
      <div className="exp-stages">
        {job.etapas.map(s => {
          const idx = job.etapas.indexOf(s), cur = job.etapas.indexOf(job.etapa);
          const state = idx < cur ? 'ok' : idx === cur ? 'on' : '';
          const pct = idx < cur ? 1 : idx === cur ? job.etapaPct : 0;
          return (
            <div key={s} className={`exp-stage ${state}`}>
              <div className="exp-stage-head">{state === 'ok' ? <TickCircle size={17} variant="Bold" /> : state === 'on' ? <Refresh2 size={17} className="spin" /> : <span className="dot" />}<b>{STAGES[s]}</b><span className="mono">{Math.round(pct * 100)}%</span></div>
              <div className="exp-mini"><i style={{ transform: `scaleX(${pct})` }} /></div>
              {s === 'imagen' && state === 'on' && <div className="dim mono small">{job.total > 0 ? <>{job.cuadros}/{job.total} frames · {job.velocidad ? job.velocidad.toFixed(1) : '…'} frames/s</> : 'Starting the engine'}</div>}
            </div>
          );
        })}
      </div>
      <button className="exp-log-toggle" onClick={() => setShowLog(v => !v)}>{showLog ? 'Hide details' : 'Show details'}</button>
      {showLog && <pre className="exp-log">{(job.log || []).join('\n')}</pre>}
    </div>
  );
}

function Done({ job }) {
  const r = job.resultado;
  if (job.estado !== 'listo') {
    return (
      <div className="exp-done bad">
        <Warning2 size={36} />
        <div className="exp-done-title">{job.estado === 'cancelado' ? 'Export canceled' : 'The export failed'}</div>
        {job.error && job.estado !== 'cancelado' && <pre className="exp-log">{job.error}</pre>}
      </div>
    );
  }
  const src = `/api/exportar/archivo?ruta=${encodeURIComponent(r.ruta)}`;
  return (
    <div className="exp-done">
      <div className="exp-media">
        {['mp4', 'webm'].includes(r.formato) && <video src={src} controls autoPlay muted loop />}
        {['gif', 'cuadro'].includes(r.formato) && <img src={src} alt="" />}
        {r.formato === 'png' && <div className="exp-folder"><Gallery size={40} />Frame sequence</div>}
      </div>
      <div className="exp-file">
        <div className="exp-done-title"><TickCircle size={20} variant="Bold" />{r.nombre}</div>
        <div className="dim mono">{mb(r.tamano)} · done in {secs(r.segundos)}</div>
        <div className="dim mono ellipsis small" title={r.ruta}>{r.ruta}</div>
        <div className="exp-actions">
          {!r.carpeta && <button className="primary" onClick={() => api('exportar/abrir', { method: 'POST', body: { ruta: r.ruta } })}><VideoPlay size={17} />Open</button>}
          <button className="ghost" onClick={() => api('exportar/abrir', { method: 'POST', body: { ruta: r.ruta, carpeta: true } })}><FolderOpen size={17} />Show in folder</button>
          <button className="ghost" onClick={() => navigator.clipboard.writeText(r.ruta)}><Copy size={17} />Copy path</button>
        </div>
      </div>
    </div>
  );
}

function DestinoPicker({ value, onPick, highlighted }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const float = useFloating(open, ref, { width: 440 });
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    addEventListener('pointerdown', close, true); addEventListener('keydown', esc, true);
    return () => { removeEventListener('pointerdown', close, true); removeEventListener('keydown', esc, true); };
  }, [open]);

  const text = q.trim().toLowerCase();
  const groups = DESTINOS.map(g => ({ ...g, items: g.items.filter(i => !text || `${g.grupo} ${i.nombre} ${i.detalle}`.toLowerCase().includes(text)) })).filter(g => g.items.length);
  return (
    <div className="dp" ref={ref}>
      <button className={`exp-preset more ${highlighted ? 'on' : ''} ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span className="exp-preset-icon">{highlighted ? <PlatformIcon id={highlighted.icon} size={20} /> : <SearchNormal1 size={20} />}</span>
        <span className="exp-preset-text"><b>{highlighted ? highlighted.nombre : 'More destinations'}</b><span>{highlighted ? highlighted.detalle : `${ALL.length} presets by platform`}</span></span>
        <ArrowDown2 size={14} className="ms-caret" />
      </button>
      {open && (
        <div className="ms-pop dp-pop floating" style={float || { visibility: 'hidden' }}>
          <div className="ms-search"><SearchNormal1 size={15} /><input autoFocus placeholder="Search platform or format" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.stopPropagation()} /></div>
          <div className="ms-list dp-list">
            {groups.map(g => (
              <div key={g.grupo}>
                <div className="ms-group dp-group"><span className="dp-gicon"><PlatformIcon id={g.icon} size={15} /></span>{g.grupo}</div>
                {g.items.map(i => (
                  <button key={i.id} className={`ms-row ${i.id === value ? 'on' : ''}`} onClick={() => { onPick({ ...i, grupo: g.grupo, icon: g.icon }); setOpen(false); setQ(''); }}>
                    <span className="ms-row-name">{i.nombre}</span>
                    <span className="ms-row-meta">{i.detalle}</span>
                  </button>
                ))}
              </div>
            ))}
            {!groups.length && <div className="dim ms-empty">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, off, children }) {
  return (
    <div className={`exp-row ${off ? 'off' : ''}`}>
      <span className="exp-label">{label}{off && <span className="exp-why" title={off}><InfoCircle size={14} /></span>}</span>
      <div className="exp-ctrl" aria-disabled={!!off}>{children}</div>
    </div>
  );
}
