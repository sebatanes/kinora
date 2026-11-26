import { useState } from 'react';
import { TickCircle, Trash, Send2, Location, Crop, Timer1, MagicStar, RecordCircle } from 'iconsax-reactjs';
import { secs } from './lib.js';

const TIPO = { punto: Location, zona: Crop, tramo: Timer1 };

export default function Notes({ notes, current, onPick, onResolve, onDelete, onSend, busy, stamp }) {
  const [filter, setFilter] = useState('abiertas');
  const open = notes.filter(n => n.estado !== 'resuelta');
  const list = (filter === 'abiertas' ? open : notes).slice().sort((a, b) => a.t - b.t);
  return (
    <div className="notes">
      <div className="panel-bar">
        <div className="seg">
          <button className={filter === 'abiertas' ? 'on' : ''} onClick={() => setFilter('abiertas')}>Open <b>{open.length}</b></button>
          <button className={filter === 'todas' ? 'on' : ''} onClick={() => setFilter('todas')}>All <b>{notes.length}</b></button>
        </div>
      </div>
      <div className="notes-list">
        {list.length === 0 && (
          <div className="empty small">
            <RecordCircle size={34} variant="Bulk" />
            <div className="empty-title">No notes</div>
            <div className="keys"><kbd>P</kbd> point <kbd>R</kbd> area</div>
          </div>
        )}
        {list.map(n => {
          const Icon = n.autor === 'claude' ? MagicStar : TIPO[n.tipo] || Location;
          return (
            <div key={n.id} className={`note ${n.estado} ${current === n.id ? 'on' : ''} ${n.autor === 'claude' ? 'claude' : ''}`} onClick={() => onPick(n)}>
              {n.cuadro && <img className="note-thumb" src={`/proyecto/${n.cuadro}?v=${stamp}`} alt="" />}
              <div className="note-body">
                <div className="note-meta">
                  <Icon size={16} />
                  <span className="mono">{n.tipo === 'tramo' ? `${secs(n.t)} to ${secs(n.t1)}` : secs(n.t)}</span>
                  {n.elemento ? <span className="note-el mono">{n.elemento.split(' ← ')[0]}</span> : null}
                  <span className="grow" />
                  {n.estado === 'en curso' && <span className="pill work">Claude</span>}
                  {n.estado === 'resuelta' && <span className="pill ok">Solved</span>}
                </div>
                <div className="note-text">{n.texto}</div>
                {n.respuesta && <div className="note-reply"><MagicStar size={14} />{n.respuesta}</div>}
              </div>
              <div className="note-actions" onClick={e => e.stopPropagation()}>
                {n.estado !== 'resuelta' && <button className="icon-btn" title="Mark as solved" onClick={() => onResolve(n)}><TickCircle size={18} /></button>}
                <button className="icon-btn" title="Delete" onClick={() => onDelete(n)}><Trash size={18} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="panel-foot">
        <button className="primary wide" disabled={!open.length || busy} onClick={onSend}>
          <Send2 size={18} />{busy ? 'Claude is working' : open.length ? `Solve ${open.length === 1 ? 'the note' : `the ${open.length} notes`} with Claude` : 'Solve with Claude'}
        </button>
      </div>
    </div>
  );
}
