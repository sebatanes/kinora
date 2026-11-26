import { useEffect, useState } from 'react';
import { preview, usePreview } from './Preview.jsx';
import { Text as TextIcon, Gallery, Music, DocumentText, Code, DocumentUpload, Magicpen, Paperclip2, Folder2, ArrowDown2, Play, Pause, Video, MagicStar } from 'iconsax-reactjs';

const IMG = /\.(png|jpe?g|webp|gif|svg)$/i;
const AUD = /\.(wav|mp3|ogg|m4a)$/i;
const VID = /\.(mp4|webm|mov)$/i;
const CODE = /\.(html|js|mjs|py|json|md|css)$/i;

function Group({ id, icon, title, count, children, empty }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(`estudio.grupo.${id}`) !== 'cerrado'; } catch { return true; } });
  const toggle = () => setOpen(o => { try { localStorage.setItem(`estudio.grupo.${id}`, o ? 'cerrado' : 'abierto'); } catch { } return !o; });
  return (
    <div className={`group ${open ? 'open' : ''}`}>
      <button className="group-head" onClick={toggle}>
        <ArrowDown2 size={14} className="group-caret" />
        {icon}<span className="grow">{title}</span><span className="count">{count}</span>
      </button>
      {open && (count ? children : empty)}
    </div>
  );
}

export default function Files({ files, refs, stamp, onUpload, onAttach, onOpenCode, onGenerate, onSounds, textos }) {
  const [over, setOver] = useState(false);
  const [tab, setTab] = useState(() => { try { return localStorage.getItem('estudio.archivos') || 'assets'; } catch { return 'assets'; } });
  const pv = usePreview();
  const playing = pv.playing ? pv.item?.key : null;
  useEffect(() => { try { localStorage.setItem('estudio.archivos', tab); } catch { } }, [tab]);

  const own = files.filter(f => !f.startsWith('.estudio/') && !/(^|\/)(plates?|out)\//.test(f) && !/\/\d{5}\.(jpe?g|png)$/.test(f));
  const generated = own.filter(f => IMG.test(f) && f.startsWith('assets/gen/'));
  const images = own.filter(f => IMG.test(f) && !f.startsWith('assets/gen/'));
  const sounds = own.filter(f => AUD.test(f));
  const videos = own.filter(f => VID.test(f));
  const code = own.filter(f => CODE.test(f));
  const refImages = refs.filter(f => IMG.test(f));
  const refOther = refs.filter(f => !IMG.test(f));
  const dest = tab === 'referencias' ? 'referencias' : 'assets';

  const drop = async e => {
    e.preventDefault(); setOver(false);
    for (const file of e.dataTransfer.files) await onUpload(file, dest);
  };
  const play = f => preview.play({ titulo: f.split('/').pop(), local: f });

  const grid = list => (
    <div className="file-grid">
      {list.map(f => (
        <button key={f} className="file-tile" title={`${f}\nClick to attach it to the chat. Drag it onto the video to place it on top`} draggable onDragStart={e => { e.dataTransfer.setData('text/estudio-asset', f); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => onAttach(f)}>
          <img src={`/proyecto/${f}?v=${stamp}`} alt="" loading="lazy" />
          <span className="attach"><Paperclip2 size={15} /></span>
        </button>
      ))}
    </div>
  );
  const soundRows = list => list.map(f => (
    <div key={f} className="file-row sound">
      <button className={`play-xs ${playing === f ? 'on' : ''}`} onClick={() => play(f)}>{playing === f ? <Pause size={13} variant="Bold" /> : <Play size={13} variant="Bold" />}</button>
      <span className="grow ellipsis" title={f}>{f.split('/').pop()}</span>
      <span className="dim mono small">{f.split('/').slice(0, -1).join('/')}</span>
    </div>
  ));

  return (
    <div className={`files ${over ? 'over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
      <div className="tabs file-tabs">
        {[['assets', 'Assets', Gallery], ['textos', 'Texts', TextIcon], ['referencias', 'References', Folder2], ['codigo', 'Code', Code]].map(([k, l, I]) => (
          <button key={k} className={tab === k ? 'on' : ''} title={l} onClick={() => setTab(k)}>
            <I size={18} /><span className="tab-label">{l}</span>{k === 'referencias' && refs.length ? <b>{refs.length}</b> : null}
          </button>
        ))}
      </div>
      <div className="files-scroll">
        {tab === 'assets' && <>
          <div className="quick">
            <button className="quick-btn" onClick={onGenerate}><Magicpen size={18} />Generate image</button>
            <button className="quick-btn" onClick={onSounds}><Music size={18} />Free sounds</button>
            <label className="quick-btn"><DocumentUpload size={18} />Upload files<input type="file" multiple hidden onChange={async e => { for (const x of e.target.files) await onUpload(x, 'assets'); e.target.value = ''; }} /></label>
          </div>
          <Group id="imagenes" icon={<Gallery size={18} />} title="Images" count={images.length} empty={<div className="drop-hint small"><DocumentUpload size={22} />Drop images here</div>}>{grid(images)}</Group>
          <Group id="generadas" icon={<MagicStar size={18} />} title="Generated" count={generated.length} empty={<div className="dim empty-line">None yet</div>}>{grid(generated)}</Group>
          <Group id="sonidos" icon={<Music size={18} />} title="Sounds" count={sounds.length} empty={<div className="dim empty-line">None yet</div>}>{soundRows(sounds)}</Group>
          {videos.length > 0 && <Group id="videos" icon={<Video size={18} />} title="Video" count={videos.length}>{videos.map(f => <div key={f} className="file-row"><Video size={16} /><span className="ellipsis">{f}</span></div>)}</Group>}
        </>}

        {tab === 'referencias' && <>
          <div className="tab-note"><Folder2 size={16} />For Claude and for generating. They don't go into the video</div>
          <div className="quick"><label className="quick-btn"><DocumentUpload size={18} />Upload references<input type="file" multiple hidden onChange={async e => { for (const x of e.target.files) await onUpload(x, 'referencias'); e.target.value = ''; }} /></label></div>
          <Group id="ref-img" icon={<Gallery size={18} />} title="Images" count={refImages.length} empty={<div className="drop-hint"><DocumentUpload size={26} />Drop reference images or videos</div>}>{grid(refImages)}</Group>
          {refOther.length > 0 && <Group id="ref-otros" icon={<DocumentText size={18} />} title="Other" count={refOther.length}>{refOther.map(f => <div key={f} className="file-row" onClick={() => onAttach(f)}><DocumentText size={16} /><span className="ellipsis">{f.split('/').pop()}</span></div>)}</Group>}
        </>}

        {tab === 'textos' && textos}
        {tab === 'codigo' && (
          <Group id="codigo" icon={<Code size={18} />} title="Files" count={code.length}>
            {code.map(f => <div key={f} className="file-row" onClick={() => onOpenCode(f)}><Code size={16} /><span className="ellipsis">{f}</span></div>)}
          </Group>
        )}
      </div>
    </div>
  );
}
