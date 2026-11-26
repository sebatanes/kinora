import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Play, Pause, Repeat, VolumeHigh, VolumeSlash, CloseCircle, Add, TickSquare, Refresh2, Music } from 'iconsax-reactjs';

// One shared preview player for every sound the editor lets you listen to.
const listeners = new Set();
let state = { item: null, playing: false, t: 0, dur: 0, peaks: null, loop: false, volume: 0.9, added: false, adding: false };
const audio = typeof Audio !== 'undefined' ? new Audio() : null;
const set = patch => { state = { ...state, ...patch }; listeners.forEach(l => l()); };

const srcOf = item => item.local ? `/proyecto/${item.local}` : `/api/sonidos/proxy?url=${encodeURIComponent(item.url)}`;

async function loadPeaks(item) {
  try {
    const buf = await (await fetch(srcOf(item))).arrayBuffer();
    const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 2, 44100);
    const data = await ctx.decodeAudioData(buf);
    const ch = data.getChannelData(0);
    const n = 900, hop = Math.max(1, Math.floor(ch.length / n)), peaks = new Float32Array(n);
    for (let i = 0; i < n; i++) { let m = 0; for (let j = i * hop, e = Math.min(ch.length, j + hop); j < e; j++) { const v = Math.abs(ch[j]); if (v > m) m = v; } peaks[i] = m; }
    if (state.item?.key === item.key) set({ peaks, dur: data.duration });
  } catch { if (state.item?.key === item.key) set({ peaks: new Float32Array(0) }); }
}

if (audio) {
  audio.addEventListener('timeupdate', () => set({ t: audio.currentTime }));
  audio.addEventListener('loadedmetadata', () => set({ dur: audio.duration || state.dur }));
  audio.addEventListener('ended', () => { if (!state.loop) set({ playing: false, t: 0 }); });
  audio.addEventListener('pause', () => set({ playing: false }));
  audio.addEventListener('play', () => set({ playing: true }));
}

export const preview = {
  play(item) {
    const key = item.local || item.url;
    if (state.item?.key === key) { audio.paused ? audio.play() : audio.pause(); return; }
    const it = { ...item, key };
    set({ item: it, t: 0, dur: item.duracion || 0, peaks: null, playing: true, added: !!item.added, adding: false });
    audio.src = srcOf(it); audio.loop = state.loop; audio.volume = state.volume; audio.play().catch(() => set({ playing: false }));
    loadPeaks(it);
  },
  toggle() { if (!state.item) return; audio.paused ? audio.play() : audio.pause(); },
  seek(t) { audio.currentTime = Math.max(0, Math.min(state.dur || audio.duration || 0, t)); set({ t: audio.currentTime }); },
  loop() { audio.loop = !state.loop; set({ loop: !state.loop }); },
  volume(v) { audio.volume = v; set({ volume: v }); },
  close() { audio.pause(); audio.removeAttribute('src'); set({ item: null, playing: false }); },
  markAdded() { set({ added: true, adding: false }); },
  isPlaying(key) { return state.item?.key === key && state.playing; },
};

export function usePreview() {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

function Wave({ peaks, t, dur, onSeek }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
    if (!peaks) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, h / 2 - 1, w, 2); return; }
    const max = Math.max(0.001, ...peaks), at = dur ? t / dur : 0;
    const bars = Math.floor(w / 3);
    for (let i = 0; i < bars; i++) {
      const a = Math.floor(i / bars * peaks.length), b = Math.max(a + 1, Math.floor((i + 1) / bars * peaks.length));
      let v = 0; for (let j = a; j < b; j++) v = Math.max(v, peaks[j]);
      const bh = Math.max(2, Math.sqrt(v / max) * (h - 4));
      g.fillStyle = i / bars <= at ? '#0c0a09' : 'rgba(12,10,9,0.18)';
      g.fillRect(i * 3, (h - bh) / 2, 2, bh);
    }
  }, [peaks, t, dur]);
  const seek = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const go = ev => onSeek(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * dur);
    go(e);
    const up = () => { removeEventListener('pointermove', go); removeEventListener('pointerup', up); };
    addEventListener('pointermove', go); addEventListener('pointerup', up);
  };
  return <canvas ref={ref} className="pv-wave" onPointerDown={seek} />;
}

const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;

export function PreviewBar() {
  const s = usePreview();
  const [muted, setMuted] = useState(false);
  const idle = !s.item;
  const it = s.item || { titulo: 'Choose a sound to listen to it' };
  const add = async () => {
    if (!it.onAdd || s.added) return;
    state = { ...state, adding: true }; listeners.forEach(l => l());
    try { await it.onAdd(); preview.markAdded(); } catch { state = { ...state, adding: false }; listeners.forEach(l => l()); }
  };
  return (
    <div className={`pv ${idle ? 'pv-off' : ''}`} onPointerDown={e => e.stopPropagation()}>
      <button className="pv-play" disabled={idle} onClick={preview.toggle}>{s.playing ? <Pause size={22} variant="Bold" /> : <Play size={22} variant="Bold" />}</button>
      <div className="pv-info">
        <div className="pv-title"><Music size={15} />{it.titulo}</div>
        <div className="pv-meta">
          {it.licencia && !it.cc0 && <span className="credit" title={it.licencia}>needs credit</span>}
          <span className="dim ellipsis">{[it.fuente, it.autor].filter(Boolean).join(' · ') || it.local}</span>
        </div>
      </div>
      <span className="mono pv-time">{fmt(s.t)}</span>
      <Wave peaks={s.peaks} t={s.t} dur={s.dur} onSeek={preview.seek} />
      <span className="mono pv-time dim">{fmt(s.dur || 0)}</span>
      <button className={`icon-btn ${s.loop ? 'on' : ''}`} title="Loop" disabled={idle} onClick={preview.loop}><Repeat size={19} /></button>
      <button className="icon-btn" title={muted ? 'Unmute' : 'Mute'} onClick={() => { preview.volume(muted ? 0.9 : 0); setMuted(!muted); }}>{muted ? <VolumeSlash size={19} /> : <VolumeHigh size={19} />}</button>
      <input className="pv-vol" type="range" min={0} max={1} step={0.01} value={s.volume} onChange={e => { preview.volume(+e.target.value); setMuted(+e.target.value === 0); }} />
      {it.onAdd && (s.added
        ? <span className="pill ok pv-added"><TickSquare size={15} />Added</span>
        : <button className="primary pv-add" disabled={s.adding} onClick={add}>{s.adding ? <Refresh2 size={16} className="spin" /> : <Add size={16} />}Add</button>)}

    </div>
  );
}
