import { useEffect, useRef, useState } from 'react';
import { MessageQuestion, ArrowRight2, Box1, Folder2, Paperclip2, VideoPlay, Music, Send2, Stop, MagicStar, Edit2, Eye, DocumentText, SearchNormal1, Code1, Camera, CloseCircle, Add, Location, Timer1, Setting4, Refresh, MessageAdd } from 'iconsax-reactjs';

const MODELS = [{ id: 'opus', name: 'Opus 5.5' }, { id: 'fable', name: 'Fable 5.1' }];

function toolLabel(name, input = {}) {
  const file = (input.file_path || input.path || '').split(/[\\/]/).pop();
  const n = name.replace(/^mcp__.*__/, '');
  const map = {
    Edit: [Edit2, `Editing ${file}`], Write: [Edit2, `Writing ${file}`], MultiEdit: [Edit2, `Editing ${file}`], Read: [DocumentText, `Reading ${file}`],
    Grep: [SearchNormal1, `Searching "${input.pattern || ''}"`], Glob: [SearchNormal1, 'Finding files'], Bash: [Code1, (input.description || input.command || '').slice(0, 80)],
    get_frame: [Eye, `Looking at the frame${input.t != null ? ` at ${Number(input.t).toFixed(2)} s` : ''}`], inspect_point: [Eye, `Inspecting ${input.t != null ? Number(input.t).toFixed(2) + ' s' : ''}`],
    contact_sheet: [Eye, 'Looking over the whole video'], find_element: [SearchNormal1, `Finding ${input.text || input.function || input.image ? `“${input.text || input.function || input.image}”` : 'an element'} in the video`],
    list_elements: [Eye, 'Reading what is in the frame'], list_notes: [DocumentText, 'Reading the notes'], resolve_note: [MagicStar, 'Answering a note'],
    add_note: [Location, 'Adding a note'], delete_note: [DocumentText, 'Deleting a note'], highlight: [Location, `Showing you ${input.t != null ? Number(input.t).toFixed(2) + ' s' : ''}`],
    status: [Eye, 'Checking what you see'], sound_events: [Setting4, 'Regenerating the sound'], timeline: [Timer1, 'Reading the timeline'], seek: [Timer1, 'Moving the playhead'],
    play: [Timer1, 'Playing the video'], pause: [Timer1, 'Pausing'], set_track: [Music, 'Adjusting a track'], set_view: [Eye, 'Arranging the view'],
    get_selection: [Eye, 'Reading your selection'], select: [Eye, 'Selecting an element'], element_literals: [Code1, 'Reading the element\'s values'],
    list_texts: [DocumentText, 'Reading the texts'], edit_text: [Edit2, 'Editing a text'], text_style: [DocumentText, 'Reading a text\'s style'], set_text_style: [Edit2, 'Styling a text'],
    edit_literal: [Edit2, `Changing a value${input.file ? ` in ${input.file.split('/').pop()}` : ''}`], undo: [Refresh, 'Undoing'], redo: [Refresh, 'Redoing'], history: [Refresh, 'Reading the history'],
    export: [VideoPlay, 'Exporting'], export_status: [VideoPlay, 'Checking the export'], cancel_export: [Stop, 'Canceling the export'], export_history: [VideoPlay, 'Reading past exports'], open_export: [VideoPlay, 'Opening an export'],
    ask_user: [MessageQuestion, 'Asking you'], ToolSearch: [Setting4, 'Preparing its tools'], generate_image: [MagicStar, 'Generating an image'],
    search_sounds: [Music, 'Searching sounds'], recommended_sounds: [Music, 'Finding sounds for the video'], download_sound: [Music, 'Downloading a sound'],
    open: [Eye, 'Opening the video'], open_example: [Eye, 'Opening the example'], new_video: [Add, 'Creating a video'], recent_projects: [Folder2, 'Reading recent videos'], rename: [Edit2, 'Renaming'],
    project_info: [Folder2, 'Reading the project'], import_file: [Paperclip2, 'Importing a file'], reference_video_frames: [VideoPlay, 'Watching a reference video'],
    list_skills: [Box1, 'Reading the skills'], set_skills: [Box1, 'Changing the skills'], connections: [Setting4, 'Checking connections'], set_connections: [Setting4, 'Saving connections'],
    TodoWrite: [DocumentText, 'Planning its tasks'],
    WebSearch: [SearchNormal1, `Searching the web for "${input.query || ''}"`], WebFetch: [Eye, 'Reading a page'], Task: [MagicStar, 'Delegating a part'], Agent: [MagicStar, 'Delegating a part'],
  };
  const [Icon, label] = map[n] || map[name] || [Setting4, n.replace(/^mcp__.*__/, '').replace(/_/g, ' ')];
  return { Icon, label };
}

// A skill in use: the Skill tool, or reading a skill's SKILL.md (how project skills are loaded).
function skillOf(h) {
  if (h.nombre === 'Skill') return (h.entrada?.skill || h.entrada?.name || 'skill').split(':').pop();
  const p = h.entrada?.file_path || '';
  if (h.nombre === 'Read' && /[\\/]SKILL\.md$/i.test(p)) return p.split(/[\\/]/).slice(-2, -1)[0];
  return null;
}

function Tools({ list, live }) {
  const items = list.filter(h => h.nombre !== 'ToolSearch');
  const skills = [...new Set(items.map(skillOf).filter(Boolean))];
  return (
    <>
      {skills.length > 0 && (
        <div className="skill-use">
          {skills.map((s, i) => <span key={s} className={`skill-pill ${live && i === skills.length - 1 ? 'live' : ''}`}><Box1 size={14} variant="Bold" />{live && i === skills.length - 1 ? 'Using' : 'Used'} the skill <b>{s}</b></span>)}
        </div>
      )}
      <Steps list={items.filter(h => !skillOf(h))} live={live} />
    </>
  );
}

// Steps fold into one line, like shell output in the terminal: the count and the latest step, open on click.
function Steps({ list, live }) {
  const [open, setOpen] = useState(false);
  if (!list.length) return null;
  const last = toolLabel(list[list.length - 1].nombre, list[list.length - 1].entrada);
  const LastIcon = last.Icon;
  return (
    <div className={`steps ${open ? 'open' : ''}`}>
      <button className="steps-head" onClick={() => setOpen(o => !o)}>
        <ArrowRight2 size={13} className="steps-caret" />
        <span className="steps-count">{list.length} {list.length === 1 ? 'step' : 'steps'}</span>
        {!open && <span className="steps-last">{live ? <Refresh size={13} className="spin" /> : <LastIcon size={13} />}<span className="ellipsis">{last.label}</span></span>}
      </button>
      {open && (
        <div className="tools">
          {list.map((h, i) => { const { Icon, label } = toolLabel(h.nombre, h.entrada); return <div key={i} className="tool"><Icon size={15} />{label}</div>; })}
        </div>
      )}
    </div>
  );
}

function Attachment({ a, onRemove, big }) {
  const src = a.preview || (a.path ? `/proyecto/${a.path}` : null);
  if (a.tipo === 'imagen') return <span className={`att img ${big ? 'big' : ''}`} title={a.nombre}>{src && <img src={src} alt="" />}{a.subiendo && <i className="att-busy"><Refresh size={14} className="spin" /></i>}{onRemove && <button onClick={onRemove}><CloseCircle size={14} /></button>}</span>;
  if (a.tipo === 'video') return (
    <span className={`att vid ${big ? 'big' : ''}`} title={a.nombre}>
      {a.info?.hoja ? <img src={`/proyecto/${a.info.hoja}`} alt="" /> : <span className="att-ph"><VideoPlay size={18} /></span>}
      <span className="att-badge">{a.subiendo ? <><Refresh size={12} className="spin" />Analyzing</> : <><VideoPlay size={12} variant="Bold" />{a.info?.duracion ? `${a.info.duracion.toFixed(1)} s · ${a.info.cuadros?.length || 0} frames` : 'Video'}</>}</span>
      {onRemove && <button onClick={onRemove}><CloseCircle size={14} /></button>}
    </span>
  );
  const Icon = a.tipo === 'audio' ? Music : a.tipo === 'carpeta' ? Folder2 : DocumentText;
  return <span className="att file" title={a.nombre}><Icon size={16} /><span className="ellipsis">{a.nombre}</span>{a.subiendo && <Refresh size={13} className="spin" />}{onRemove && <button onClick={onRemove}><CloseCircle size={14} /></button>}</span>;
}
const VERB = { pensando: 'Thinking', escribiendo: 'Writing', esperando: 'Waiting for your answer' };
function stateLabel(st) {
  if (!st) return 'Thinking';
  if (st.tipo === 'herramienta') return toolLabel(st.nombre, st.entrada || {}).label || 'Working';
  return VERB[st.tipo] || 'Working';
}
const kfmt = n => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n || 0));

// Minimal Markdown: paragraphs, lists, **bold** and `code`.
function inline(t, key) {
  const out = []; let last = 0; const re = /(\*\*[^*]+\*\*|`[^`]+`)/g; let m;
  while ((m = re.exec(t))) {
    if (m.index > last) out.push(t.slice(last, m.index));
    out.push(m[0].startsWith('**') ? <b key={key + m.index}>{m[0].slice(2, -2)}</b> : <code key={key + m.index} className="md-code">{m[0].slice(1, -1)}</code>);
    last = m.index + m[0].length;
  }
  if (last < t.length) out.push(t.slice(last));
  return out;
}
function Md({ text }) {
  const blocks = (text || '').trim().split(/\n{2,}/);
  return blocks.map((b, i) => {
    const lines = b.split('\n');
    if (lines.every(l => /^\s*([-*]|\d+\.)\s+/.test(l))) {
      const ordered = /^\s*\d+\./.test(lines[0]);
      const L = ordered ? 'ol' : 'ul';
      return <L key={i} className="md-list">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ''), `${i}-${j}-`)}</li>)}</L>;
    }
    return <p key={i} className="md-p">{lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l, `${i}-${j}-`)}</span>)}</p>;
  });
}

function Question({ q, onAnswer }) {
  const [picked, setPicked] = useState([]);
  const [other, setOther] = useState('');
  const [sent, setSent] = useState(false);
  const send = v => { if (sent || !v) return; setSent(true); onAnswer(q.id, v); };
  return (
    <div className={`question ${sent ? 'sent' : ''}`}>
      <div className="q-title"><MessageQuestion size={18} variant="Bold" />{q.pregunta}</div>
      {q.opciones?.length > 0 && (
        <div className="q-options">
          {q.opciones.map((o, i) => {
            const on = picked.includes(o.etiqueta);
            return (
              <button key={i} className={`q-opt ${on ? 'on' : ''}`} disabled={sent} onClick={() => q.multiple ? setPicked(p => on ? p.filter(x => x !== o.etiqueta) : [...p, o.etiqueta]) : send(o.etiqueta)}>
                <span className="q-num mono">{i + 1}</span>
                <span className="q-text"><b>{o.etiqueta}</b>{o.detalle && <span>{o.detalle}</span>}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="q-other">
        <input placeholder="Other answer" value={other} disabled={sent} onChange={e => setOther(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') send(other.trim()); }} />
        {(q.multiple && picked.length > 0) || other.trim()
          ? <button className="primary sm-btn" disabled={sent} onClick={() => send(other.trim() || picked.join(', '))}><Send2 size={15} />Reply</button>
          : null}
      </div>
    </div>
  );
}

const cleanText = t => (t || '').replace(/\n*\[(?:Contexto del editor|Editor context):[\s\S]*\]\s*$/, '');
function Elapsed({ since }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const s = Math.max(0, Math.round((now - since) / 1000));
  return <>{s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`}</>;
}
const asAttachment = a => typeof a === 'string' ? { path: a, tipo: /\.(png|jpe?g|webp|gif)$/i.test(a) ? 'imagen' : 'archivo', nombre: a.split('/').pop() } : a;

export default function Chat({ onAnswer, messages, live, busy, onSend, onStop, onNew, context, clearContext, model, setModel, onAttachFrame, onAttachFiles, onAttachPaths, attachments, removeAttachment }) {
  const [over, setOver] = useState(false);
  const fileRef = useRef(null);
  const [text, setText] = useState('');
  const list = useRef(null);
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [messages, live]);
  const uploading = attachments.some(a => a.subiendo);
  const send = () => { if ((!text.trim() && !attachments.length) || busy || uploading) return; onSend(text.trim() || 'Look at what I attached and tell me what you see.'); setText(''); };
  return (
    <div className="chat">
      <div className="panel-bar">
        <div className="seg">
          {MODELS.map(m => <button key={m.id} className={model === m.id ? 'on' : ''} onClick={() => setModel(m.id)}>{m.name}</button>)}
        </div>
        <span className="grow" />
        <button className="ghost sm" title={busy ? 'Wait for Claude to finish' : 'Start a clean conversation'} onClick={onNew} disabled={busy || (messages.length === 0 && !live)}><MessageAdd size={16} />New chat</button>
      </div>
      <div className="chat-list" ref={list}>
        {messages.length === 0 && !live && (
          <div className="empty small">
            <MagicStar size={34} variant="Bulk" />
            <div className="empty-title">Claude sees what you see</div>
          </div>
        )}
        {messages.map((m, i) => m.tipo === 'pregunta' ? (
          <div key={i} className="q-done"><MessageQuestion size={15} /><span className="ellipsis">{m.pregunta}</span><b>{m.respuesta ?? 'No answer'}</b></div>
        ) : m.tipo === 'usuario' ? (
          <div key={i} className="msg user">
            <div className="bubble">{cleanText(m.texto)}</div>
            {m.adjuntos?.length ? <div className="attach-row">{m.adjuntos.map(asAttachment).map((a, j) => <Attachment key={j} a={a} big />)}</div> : null}
          </div>
        ) : (
          <div key={i} className="msg claude">
            <div className="who"><MagicStar size={16} variant="Bold" />Claude</div>
            {m.herramientas?.length ? <Tools list={m.herramientas} /> : null}
            {m.texto ? <div className="text"><Md text={m.texto} /></div> : null}
            {m.detenido ? <div className="stopped"><Stop size={14} />Stopped</div> : null}
            {m.error ? <div className="error">{m.error}</div> : null}
          </div>
        ))}
        {live && (
          <div className="msg claude">
            <div className="who"><MagicStar size={16} variant="Bold" />Claude</div>
            {live.herramientas.length ? <Tools list={live.herramientas} live /> : null}
            {live.texto ? <div className="text"><Md text={live.texto} /></div> : null}
            {live.pregunta && <Question q={live.pregunta} onAnswer={onAnswer} />}
            <div className="live-status"><MagicStar size={14} variant="Bold" className="pulse" /><span className="ls-verb">{stateLabel(live.estado)}…</span><span className="ls-meta mono">{live.inicio && <Elapsed since={live.inicio} />}{live.tokens ? ` · ↓ ${kfmt(live.tokens)} tokens` : ''}</span></div>
          </div>
        )}
      </div>
      <div className={`composer ${over ? 'over' : ''}`} onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)} onDrop={e => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setOver(false); onAttachFiles([...e.dataTransfer.files]); }}>
        {(context || attachments.length > 0) && (
          <div className="chips">
            {context && <span className="chip"><Location size={14} />{context.label}<button onClick={clearContext}><CloseCircle size={14} /></button></span>}
            {attachments.map((a, i) => <Attachment key={a.id || a.path || i} a={asAttachment(a)} onRemove={() => removeAttachment(a)} />)}
          </div>
        )}
        <textarea
          value={text}
          rows={3}
          placeholder={attachments.length ? 'Tell Claude what to look at' : 'Ask Claude for a change'}
          onPaste={e => {
            const files = [...(e.clipboardData?.files || [])];
            if (files.length) { e.preventDefault(); onAttachFiles(files); return; }
            const text = e.clipboardData?.getData('text') || '';
            const lines = text.split(/\r?\n/).map(l => l.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
            if (lines.length && lines.length <= 20 && lines.every(l => /^([A-Za-z]:[\\/]|\\\\|~[\\/])/.test(l))) { e.preventDefault(); onAttachPaths(lines); }
          }}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <div className="composer-bar">
          <button className="icon-btn" title="Attach files: images, videos, audio (you can also paste or drag)" onClick={() => fileRef.current?.click()}><Paperclip2 size={19} /></button>
          <input ref={fileRef} type="file" multiple hidden accept="image/*,video/*,audio/*,.pdf,.txt,.md,.json,.csv" onChange={e => { onAttachFiles([...e.target.files]); e.target.value = ''; }} />
          <button className="icon-btn" title="Attach the current video frame" onClick={onAttachFrame}><Camera size={19} /></button>
          <span className="grow" />
          {busy
            ? <button className="ghost" onClick={onStop}><Stop size={18} />Stop</button>
            : <button className="primary" disabled={(!text.trim() && !attachments.length) || uploading} onClick={send}>{uploading ? <Refresh size={18} className="spin" /> : <Send2 size={18} />}Send</button>}
        </div>
      </div>
    </div>
  );
}
