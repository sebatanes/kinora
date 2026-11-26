import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight2, CloseCircle } from 'iconsax-reactjs';

// A short guided tour over the editor. Each step points at one element and may switch the view first.
const KEY = 'kinora-tour';
export const tourPending = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const markTour = on => { try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch { } };

export default function Tour({ steps, onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [card, setCard] = useState({ w: 320, h: 160 });
  const cardRef = useRef(null);
  const step = steps[i];

  useEffect(() => { step.enter?.(); }, [i]);
  useEffect(() => {
    let raf;
    const tick = () => {
      const el = document.querySelector(step.target);
      const r = el?.getBoundingClientRect();
      setRect(prev => {
        if (!r) return null;
        const next = { x: r.left, y: r.top, w: r.width, h: r.height };
        return prev && ['x', 'y', 'w', 'h'].every(k => Math.abs(prev[k] - next[k]) < 0.5) ? prev : next;
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [i]);
  useLayoutEffect(() => { const r = cardRef.current?.getBoundingClientRect(); if (r) setCard({ w: r.width, h: r.height }); }, [i, rect?.w]);
  useEffect(() => {
    const key = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' && i > 0) setI(i - 1);
    };
    addEventListener('keydown', key, true);
    return () => removeEventListener('keydown', key, true);
  }, [i]);
  const next = () => (i < steps.length - 1 ? setI(i + 1) : onClose());

  const pad = 8, gap = 14, vw = innerWidth, vh = innerHeight;
  let pos = { left: vw / 2 - card.w / 2, top: vh / 2 - card.h / 2 }, side = 'none';
  if (rect) {
    const room = { below: vh - (rect.y + rect.h), above: rect.y, right: vw - (rect.x + rect.w), left: rect.x };
    side = step.side || (room.below > card.h + gap * 2 ? 'below' : room.right > card.w + gap * 2 ? 'right' : room.left > card.w + gap * 2 ? 'left' : 'above');
    const cx = rect.x + rect.w / 2 - card.w / 2, cy = rect.y + rect.h / 2 - card.h / 2;
    pos = side === 'below' ? { left: cx, top: rect.y + rect.h + pad + gap }
      : side === 'above' ? { left: cx, top: rect.y - pad - gap - card.h }
      : side === 'right' ? { left: rect.x + rect.w + pad + gap, top: cy }
      : { left: rect.x - pad - gap - card.w, top: cy };
    pos.left = Math.max(16, Math.min(vw - card.w - 16, pos.left));
    pos.top = Math.max(16, Math.min(vh - card.h - 16, pos.top));
  }
  const hole = rect ? (() => {
    const x0 = Math.max(4, rect.x - pad), y0 = Math.max(4, rect.y - pad);
    const x1 = Math.min(vw - 4, rect.x + rect.w + pad), y1 = Math.min(vh - 4, rect.y + rect.h + pad);
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  })() : { left: vw / 2, top: vh / 2, width: 0, height: 0 };
  return (
    <div className="tour" onPointerDown={e => e.stopPropagation()}>
      <div className="tour-hole" style={hole} />
      <div ref={cardRef} key={i} className={`tour-card side-${side}`} style={pos} role="dialog" aria-label={step.title}>
        <div className="tour-head">
          <span className="tour-count mono">{i + 1} / {steps.length}</span>
          <span className="grow" />
          <button className="icon-btn sm" title="Close" onClick={onClose}><CloseCircle size={18} /></button>
        </div>
        <div className="tour-title">{step.title}</div>
        <div className="tour-text">{step.text}</div>
        <div className="tour-foot">
          <div className="tour-dots">{steps.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
          <span className="grow" />
          {i > 0 && <button className="ghost" onClick={() => setI(i - 1)}>Back</button>}
          <button className="primary" onClick={next}>{i < steps.length - 1 ? <>Next<ArrowRight2 size={15} /></> : 'Done'}</button>
        </div>
      </div>
    </div>
  );
}
