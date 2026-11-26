import { useEffect, useMemo, useRef, useState } from 'react';
import { VolumeHigh, VolumeSlash, Headphone, Scissor, Messages3, Video, Music, Magicpen } from 'iconsax-reactjs';
import { clamp } from './lib.js';

const HEAD = 214;

function Wave({ peaks, pps, dur, color, height }) {
  const ref = useRef(null);
  const width = Math.max(1, Math.round(dur * pps));
  useEffect(() => {
    const c = ref.current; if (!c || !peaks) return;
    const dpr = devicePixelRatio || 1;
    c.width = Math.min(32000, width * dpr); c.height = height * dpr;
    const g = c.getContext('2d');
    g.setTransform(c.width / width, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);
    g.fillStyle = color;
    const per = peaks.length / dur;
    const mid = height / 2;
    for (let x = 0; x < width; x++) {
      const a = Math.floor(x / pps * per), b = Math.max(a + 1, Math.floor((x + 1) / pps * per));
      let v = 0; for (let i = a; i < b && i < peaks.length; i++) v = Math.max(v, peaks[i]);
      const h = Math.max(0.5, Math.sqrt(Math.min(1, v)) * (height / 2 - 2));
      g.fillRect(x, mid - h, 1, h * 2);
    }
  }, [peaks, pps, dur, color, height, width]);
  return <canvas ref={ref} className="wave" style={{ width, height }} />;
}

function Strip({ thumbs, pps, dur, height }) {
  const ref = useRef(null);
  const width = Math.max(1, Math.round(dur * pps));
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = devicePixelRatio || 1;
    c.width = Math.min(32000, width * dpr); c.height = height * dpr;
    const g = c.getContext('2d');
    g.setTransform(c.width / width, 0, 0, dpr, 0, 0);
    g.fillStyle = '#131417'; g.fillRect(0, 0, width, height);
    if (!thumbs.length) return;
    const first = thumbs.find(x => x.canvas);
    if (!first) return;
    const tw = height * first.canvas.width / first.canvas.height;
    for (let x = 0; x < width; x += tw) {
      const t = (x + tw / 2) / pps;
      let best = null;
      for (const th of thumbs) if (th.canvas && (!best || Math.abs(th.t - t) < Math.abs(best.t - t))) best = th;
      if (best) g.drawImage(best.canvas, x, 0, tw, height);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + tw - 1, 0, 1, height);
    }
  }, [thumbs, pps, dur, height, width]);
  return <canvas ref={ref} className="strip" style={{ width, height }} />;
}

const BUS_COLOR = { music: '#3b82f6', fx: '#10b981', drums: '#f97316', voice: '#a855f7', main: '#78716c' };
const busColor = name => BUS_COLOR[name] || `hsl(${[...name].reduce((h, c) => h + c.charCodeAt(0) * 37, 0) % 360} 70% 70%)`;
const BUS_NAME = { music: 'Music', fx: 'Effects', drums: 'Percussion', voice: 'Voice', main: 'Main' };

export default function Timeline({ labels = { pistas: {}, sonidos: {} }, onRename, onContext, info, timeline, t, onSeek, onScrubEnd, audio, sound, notes, onNoteRange, onPickEvent, pickedEvent, onPickNote, thumbs, busState, setBusState }) {
  const dur = info?.duracion || 10;
  const [pps, setPps] = useState(60);
  const scroller = useRef(null);
  const [drag, setDrag] = useState(null);
  const fit = useRef(false);

  useEffect(() => {
    const el = scroller.current; if (!el || !info || fit.current) return;
    fit.current = true;
    setPps(clamp((el.clientWidth - HEAD - 40) / dur, 8, 400));
  }, [info, dur]);

  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const onWheel = e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - HEAD + el.scrollLeft;
      const at = x / pps;
      const next = clamp(pps * Math.exp(-e.deltaY * 0.0022), 6, 1200);
      setPps(next);
      requestAnimationFrame(() => { el.scrollLeft = at * next - (e.clientX - r.left - HEAD); });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [pps]);

  const [heights, setHeights] = useState(() => { try { return JSON.parse(localStorage.getItem('estudio.pistas') || '{}'); } catch { return {}; } });
  const save = h => { try { localStorage.setItem('estudio.pistas', JSON.stringify(h)); } catch { } };
  const hOf = key => heights[key] ?? (key === 'cuadros' ? 58 : key.startsWith('bus-') ? 48 : key === 'notas' ? 40 : 34);
  const resizeLane = (e, key) => {
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget; el.setPointerCapture(e.pointerId); el.classList.add('on');
    const y0 = e.clientY, h0 = hOf(key);
    const move = ev => setHeights(h => { const n = { ...h, [key]: clamp(h0 + ev.clientY - y0, 24, 260) }; save(n); return n; });
    const up = () => { el.classList.remove('on'); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
  };

  const width = Math.round(dur * pps);
  const timeAt = e => {
    const el = scroller.current; const r = el.getBoundingClientRect();
    return clamp((e.clientX - r.left - HEAD + el.scrollLeft) / pps, 0, dur);
  };

  const beats = useMemo(() => {
    if (!info?.bpm) return [];
    const spb = 60 / info.bpm, out = [];
    const every = pps * spb < 7 ? info.compas : 1;
    for (let b = 0; b * spb <= dur + 1e-6; b += every) out.push({ b, x: b * spb * pps, bar: b % info.compas === 0 });
    return out;
  }, [info, pps, dur]);

  const seconds = useMemo(() => {
    const step = pps > 160 ? 0.5 : pps > 40 ? 1 : pps > 16 ? 2 : 5;
    const out = [];
    for (let s = 0; s <= dur + 1e-6; s += step) out.push(s);
    return out;
  }, [pps, dur]);

  const startScrub = e => {
    e.preventDefault();
    const move = ev => onSeek(timeAt(ev), true);
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); onScrubEnd?.(); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
    move(e);
  };

  const startRange = e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const t0 = timeAt(e);
    setDrag({ t0, t1: t0 });
    const move = ev => setDrag({ t0, t1: timeAt(ev) });
    const up = ev => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up);
      const t1 = timeAt(ev);
      setDrag(null);
      if (Math.abs(t1 - t0) * pps > 6) onNoteRange(Math.min(t0, t1), Math.max(t0, t1));
      else onSeek(t0, false);
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  };

  const scenes = (timeline?.scenes || []).filter(s => !(timeline.scenes.length === 1 && s.from === 0));
  const spb = info?.bpm ? 60 / info.bpm : 1;
  const buses = audio ? Object.entries(audio.buses) : [];
  const eventsBy = useMemo(() => {
    const m = {};
    for (const ev of audio?.eventos || []) (m[ev.bus] ||= []).push(ev);
    return m;
  }, [audio]);

  const [editing, setEditing] = useState(null);
  const lane = (key, label, icon, content, extra, cls = '', renameKey = null) => (
    <div className={`lane ${cls}`} key={key}>
      <div className="lane-head">
        <span className="lane-icon">{icon}</span>
        {editing === key
          ? <input className="lane-edit" autoFocus defaultValue={label} onFocus={e => e.target.select()}
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = label; e.currentTarget.blur(); } }}
            onBlur={e => { setEditing(null); if (e.target.value.trim() !== label) onRename?.('pista', renameKey, e.target.value); }} />
          : <span className="lane-name" title={renameKey ? 'Double click to rename' : undefined} onDoubleClick={() => renameKey && setEditing(key)}>{label}</span>}
        {extra}
      </div>
      <div className="lane-body" style={{ width, height: hOf(key) }}>{content}</div>
      <div className="lane-grip" onPointerDown={e => resizeLane(e, key)} onDoubleClick={() => setHeights(h => { const n = { ...h }; delete n[key]; save(n); return n; })} />
    </div>
  );

  return (
    <div className="timeline">
      <div className="tl-scroll" ref={scroller}>
        <div className="tl-inner" style={{ width: width + HEAD + 40 }}>
          <div className="ruler-row">
            <div className="lane-head ruler-head">
              <span className="mono">{info ? `${info.fps} fps` : ''}</span>
              {info?.bpm ? <span className="mono dim">{Math.round(info.bpm)} bpm</span> : null}
            </div>
            <div className="ruler" style={{ width }} onPointerDown={startScrub} onContextMenu={e => onContext(e, 'regla', timeAt(e))}>
              {beats.map(b => <div key={'b' + b.b} className={`beat ${b.bar ? 'bar' : ''}`} style={{ left: b.x }}>{b.bar && pps * spb * info.compas > 34 ? <span>{b.b / info.compas + 1}</span> : null}</div>)}
              {seconds.map(s => <div key={'s' + s} className="sec" style={{ left: s * pps }}><span>{s % 1 ? s.toFixed(1) : s}s</span></div>)}
            </div>
          </div>

          {scenes.length > 0 && lane('escenas', 'Scenes', <Scissor size={18} />,
            scenes.map(s => (
              <div key={s.id} className="scene" style={{ left: s.from * spb * pps, width: (s.to - s.from) * spb * pps }} onPointerDown={e => { e.stopPropagation(); onSeek(s.from * spb, false); }}>
                <span>{s.id}</span>
              </div>
            )))}

          {lane('cuadros', 'Image', <Video size={18} />, <div className="strip-hit" onPointerDown={e => { if (e.button === 0) onSeek(timeAt(e), false); }} onContextMenu={e => onContext(e, 'imagen', timeAt(e))}><Strip thumbs={thumbs} pps={pps} dur={dur} height={hOf('cuadros') - 2} /></div>, null, 'lane-strip')}

          {buses.map(([name, b]) => {
            const st = busState[name] || {};
            return lane('bus-' + name, labels.pistas[name] || BUS_NAME[name] || name, <Music size={18} color={busColor(name)} />,
              <div className="bus-hit" onPointerDown={e => { if (e.button === 0) onSeek(timeAt(e), true); }} onContextMenu={e => onContext(e, 'pista', { bus: name, t: timeAt(e), rename: () => setEditing('bus-' + name), setHeight: v => setHeights(h => { const n = { ...h, ['bus-' + name]: v }; save(n); return n; }) })}>
                <Wave peaks={b.picos} pps={pps} dur={audio.duracion} color={busColor(name) + (st.mute ? '44' : 'bb')} height={hOf('bus-' + name) - 4} />
                {(audio.silencios || []).map((s, i) => <div key={'sil' + i} className="silence" style={{ left: s.t * pps, width: (s.t1 - s.t) * pps }} />)}
                {(eventsBy[name] || []).map((ev, i) => (
                  <button
                    key={i}
                    className={`ev ${pickedEvent === ev ? 'on' : ''}`}
                    style={{ left: ev.t * pps, '--h': `${Math.round((hOf('bus-' + name) - 8) * (0.2 + 0.8 * Math.min(1, Math.sqrt(ev.peak))))}px`, '--c': busColor(name) }}
                    title={`${labels.sonidos[ev.line] ? labels.sonidos[ev.line] + ' · ' : ''}${ev.t.toFixed(2)} s · line ${ev.line}\n${ev.code}`}
                    onPointerDown={e => { e.stopPropagation(); if (e.button === 0) onPickEvent(ev); }}
                    onContextMenu={e => { e.stopPropagation(); onContext(e, 'evento', ev); }}
                  />
                ))}
              </div>,
              <div className="bus-tools">
                <button className="mini" title="Replace, improve or rename the track" onClick={e => onContext(e, 'pista-entera', { bus: name, rename: () => setEditing('bus-' + name) })}><Magicpen size={16} /></button>
                <button className={`mini ${st.solo ? 'on' : ''}`} title="Solo" onClick={() => setBusState(name, { solo: !st.solo })}><Headphone size={16} /></button>
                <button className={`mini ${st.mute ? 'on' : ''}`} title={st.mute ? 'Unmute' : 'Mute'} onClick={() => setBusState(name, { mute: !st.mute })}>{st.mute ? <VolumeSlash size={16} /> : <VolumeHigh size={16} />}</button>
              </div>, 'lane-audio', name);
          })}

          {lane('notas', 'Notes', <Messages3 size={18} />,
            <div className="notes-lane" onPointerDown={startRange} onContextMenu={e => onContext(e, 'imagen', timeAt(e))}>
              {notes.map(n => n.tipo === 'tramo'
                ? <div key={n.id} className={`note-range ${n.estado}`} style={{ left: n.t * pps, width: Math.max(4, (n.t1 - n.t) * pps) }} onPointerDown={e => { e.stopPropagation(); if (e.button === 0) onPickNote(n); }} onContextMenu={e => onContext(e, 'nota', n)} title={n.texto} />
                : <div key={n.id} className={`note-pin ${n.estado} ${n.autor === 'claude' ? 'claude' : ''}`} style={{ left: n.t * pps }} onPointerDown={e => { e.stopPropagation(); if (e.button === 0) onPickNote(n); }} onContextMenu={e => onContext(e, 'nota', n)} title={n.texto} />)}
              {drag && <div className="note-range draft" style={{ left: Math.min(drag.t0, drag.t1) * pps, width: Math.abs(drag.t1 - drag.t0) * pps }} />}
            </div>, null, 'lane-notes')}

          <div className="playhead" style={{ left: HEAD + t * pps }}><div className="playhead-cap" /></div>
        </div>
      </div>
    </div>
  );
}
