import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Export pipeline: the project's render.py makes the master (full quality, motion blur, mixed sound),
// then ffmpeg turns it into the chosen format, size, frame rate and range.

const PY = process.env.PYTHON || 'python';
const readJson = async (f, d) => { try { return JSON.parse(await fsp.readFile(f, 'utf8')); } catch { return d; } };

function killTree(child) {
  if (!child || child.exitCode != null) return;
  if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => { });
  else child.kill('SIGTERM');
}

function scaleFilter(o, srcW, srcH) {
  const W = o.ancho || srcW, H = o.alto || srcH;
  if (W === srcW && H === srcH) return null;
  const even = v => Math.max(2, Math.round(v / 2) * 2);
  const w = even(W), h = even(H);
  if (Math.abs(W / H - srcW / srcH) < 0.01) return `scale=${w}:${h}:flags=lanczos`;
  return o.ajuste === 'recortar'
    ? `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}`
    : `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${o.fondo || 'black'}`;
}

export function createExporter({ broadcast, project, buildAudio }) {
  let job = null;

  const emit = patch => {
    job = { ...job, ...patch, actualizado: Date.now() };
    broadcast({ type: 'exportar', job: publicJob() });
  };
  const publicJob = () => job && { id: job.id, estado: job.estado, etapa: job.etapa, etapas: job.etapas, pct: job.pct, etapaPct: job.etapaPct, cuadros: job.cuadros, total: job.total, velocidad: job.velocidad, inicio: job.inicio, restante: job.restante, resultado: job.resultado, error: job.error, opciones: job.opciones, log: job.log.slice(-14) };

  function run(cmd, args, { cwd, onLine } = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { cwd, windowsHide: true });
      job.child = child;
      let buf = '', tail = '';
      const feed = chunk => {
        const s = chunk.toString('utf8'); tail = (tail + s).slice(-4000); buf += s;
        let i;
        while ((i = buf.search(/[\r\n]/)) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (line) { onLine?.(line); if (!/^(frame|fps|stream_|bitrate|total_size|out_time|dup|drop|speed|progress)=/.test(line)) job.log.push(line); }
        }
      };
      child.stdout.on('data', feed); child.stderr.on('data', feed);
      child.on('close', code => { job.child = null; if (job.cancelado) reject(new Error('Canceled')); else if (code) reject(new Error(tail.trim().split('\n').slice(-4).join('\n') || `${cmd} exited with ${code}`)); else resolve(tail); });
      child.on('error', reject);
    });
  }

  const setStage = (etapa, pct = 0) => {
    const idx = job.etapas.indexOf(etapa);
    const overall = (idx + pct) / job.etapas.length;
    const elapsed = (Date.now() - job.inicio) / 1000;
    const restante = overall > 0.03 ? Math.max(0, elapsed / overall - elapsed) : null;
    emit({ etapa, etapaPct: pct, pct: overall, restante });
  };

  async function destination(o, ext) {
    const p = project();
    const base = (o.nombre || p.name || 'video').replace(/[<>:"/\\|?*]+/g, '-').trim() || 'video';
    const dir = o.destino === 'descargas' ? path.join(os.homedir(), 'Downloads') : path.join(p.dir, 'out', 'exports');
    await fsp.mkdir(dir, { recursive: true });
    let file = path.join(dir, ext ? `${base}.${ext}` : base), n = 2;
    while (fs.existsSync(file)) file = path.join(dir, ext ? `${base}-v${n++}.${ext}` : `${base}-v${n++}`);
    return file;
  }

  async function start(o) {
    if (job && job.estado === 'exportando') throw new Error('An export is already running.');
    const p = project();
    if (!fs.existsSync(path.join(p.dir, 'render.py'))) throw new Error('This project has no render.py.');
    const tl = await readJson(path.join(p.dir, 'timeline.json'), null);
    if (!tl) throw new Error('Could not find timeline.json.');
    const spb = 60 / tl.bpm, total = tl.beats * spb;
    const desde = Math.max(0, +o.desde || 0), hasta = Math.min(total, o.hasta != null ? +o.hasta : total);
    const entero = desde <= 0.001 && hasta >= total - 0.001;
    const formato = o.formato || 'mp4';
    const cuadro = formato === 'cuadro';
    const high = !cuadro && o.fps && o.fps > tl.fps;
    const etapas = cuadro ? ['imagen', 'guardado'] : ['imagen', ...(o.audio !== false && ['mp4', 'webm'].includes(formato) && (!entero || high) ? ['sonido'] : []), 'formato', 'guardado'];
    job = { id: Date.now().toString(36), estado: 'exportando', etapas, etapa: etapas[0], pct: 0, etapaPct: 0, inicio: Date.now(), log: [], opciones: o, cuadros: 0, total: 0, velocidad: null };
    emit({});
    work(o, tl, { spb, total, desde, hasta, entero, formato, cuadro, high }).catch(e => emit({ estado: job.cancelado ? 'cancelado' : 'error', error: e.message }));
    return publicJob();
  }

  async function work(o, tl, x) {
    const p = project();
    const out = path.join(p.dir, 'out');
    const name = tl.name || 'video';

    if (x.cuadro) {
      const n = Math.round((o.t ?? x.desde) * tl.fps);
      setStage('imagen', 0.1);
      await run(PY, ['render.py', '--frames', String(n)], { cwd: p.dir });
      const src = path.join(out, 'frames', `f${String(n).padStart(5, '0')}.png`);
      setStage('guardado', 0.5);
      const dst = await destination({ ...o, nombre: o.nombre || `${name}-${(n / tl.fps).toFixed(2)}s` }, 'png');
      const vf = scaleFilter(o, tl.width, tl.height);
      if (vf) await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', vf, dst]);
      else await fsp.copyFile(src, dst);
      return finish(dst);
    }

    // 1. Master from render.py
    if (o.audio !== false && fs.existsSync(path.join(p.dir, 'sound.py'))) { job.log.push('Preparing the sound'); await buildAudio().catch(() => { }); }
    const t0 = Date.now();
    const highOut = path.join(out, `${name}-${o.fps}fps.mp4`);
    const args = x.high
      ? [path.join(HERE, 'render_frames.py'), p.dir, '--fps', String(o.fps), '--from', String(x.desde), '--to', String(x.hasta), '--workers', String(o.workers || 6), '--out', highOut]
      : ['render.py', '--workers', String(o.workers || 6), ...(x.entero ? [] : ['--from', String(x.desde / x.spb), '--to', String(x.hasta / x.spb)])];
    setStage('imagen', 0);
    await run(PY, args, {
      cwd: p.dir,
      onLine: line => {
        const m = line.match(/(\d+)\/(\d+) frames\s+([\d.]+)s/);
        if (m) {
          const done = +m[1], all = +m[2];
          job.cuadros = done; job.total = all; job.velocidad = done / Math.max(0.1, (Date.now() - t0) / 1000);
          setStage('imagen', done / all);
        }
        if (/^final:/.test(line)) setStage('imagen', 1);
      },
    });
    let master = x.high ? highOut : x.entero ? path.join(out, `${name}.mp4`) : path.join(out, `${name}-range.mp4`);
    if (!fs.existsSync(master)) master = path.join(out, `${name}-silent.mp4`);
    // A high frame rate master starts at the range start, so its sound is cut from the same point.
    const soundFrom = x.high ? x.desde : x.desde;
    const hasSound = fs.existsSync(path.join(out, 'sound.wav'));

    // 2. Sound for a range
    if (job.etapas.includes('sonido')) {
      setStage('sonido', 0.2);
      if (hasSound) {
        const muxed = path.join(out, `${name}-range-sound.mp4`);
        const dur = x.hasta - x.desde;
        await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', master, '-ss', soundFrom.toFixed(3), '-t', dur.toFixed(3), '-i', path.join(out, 'sound.wav'),
          '-map', '0:v', '-map', '1:a', '-af', `loudnorm=I=-14:TP=-2.5:LRA=11,afade=t=in:d=0.05,afade=t=out:st=${Math.max(0, dur - 0.3).toFixed(3)}:d=0.3`,
          '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', muxed]);
        master = muxed;
      }
      setStage('sonido', 1);
    }

    // 3. Format
    setStage('formato', 0);
    const durOut = x.hasta - x.desde;
    const vf = [scaleFilter(o, tl.width, tl.height)].filter(Boolean);
    const fps = o.fps && o.fps < tl.fps ? o.fps : null;
    const q = { alta: 0, media: 1, liviana: 2 }[o.calidad || 'alta'];
    const progress = ['-progress', 'pipe:1', '-nostats'];
    const onLine = line => { const m = line.match(/^out_time_(?:ms|us)=(\d+)/); if (m) setStage('formato', Math.min(0.99, +m[1] / 1e6 / Math.max(0.1, durOut))); };
    const withAudio = o.audio !== false;
    let dst;
    if (x.formato === 'mp4') {
      dst = await destination(o, 'mp4');
      const same = !vf.length && !fps && q === 0 && withAudio;
      if (same) { await fsp.copyFile(master, dst); setStage('formato', 1); }
      else await run('ffmpeg', ['-y', '-loglevel', 'error', ...progress, '-i', master, ...(vf.length ? ['-vf', vf.join(',')] : []), ...(fps ? ['-r', String(fps)] : []),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', String([17, 21, 26][q]), '-pix_fmt', 'yuv420p', ...(withAudio ? ['-c:a', 'aac', '-b:a', ['256k', '192k', '128k'][q]] : ['-an']), '-movflags', '+faststart', dst], { onLine });
    } else if (x.formato === 'webm') {
      dst = await destination(o, 'webm');
      await run('ffmpeg', ['-y', '-loglevel', 'error', ...progress, '-i', master, ...(vf.length ? ['-vf', vf.join(',')] : []), ...(fps ? ['-r', String(fps)] : []),
        '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String([28, 33, 38][q]), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', ...(withAudio ? ['-c:a', 'libopus', '-b:a', '128k'] : ['-an']), dst], { onLine });
    } else if (x.formato === 'gif') {
      dst = await destination(o, 'gif');
      const gfps = fps || 20, colors = [256, 160, 96][q];
      const chain = [...vf, `fps=${gfps}`].join(',');
      await run('ffmpeg', ['-y', '-loglevel', 'error', ...progress, '-i', master, '-filter_complex', `[0:v]${chain},split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`, '-loop', '0', dst], { onLine });
    } else if (x.formato === 'png') {
      dst = await destination(o, null);
      await fsp.mkdir(dst, { recursive: true });
      await run('ffmpeg', ['-y', '-loglevel', 'error', ...progress, '-i', master, ...(vf.length || fps ? ['-vf', [...vf, ...(fps ? [`fps=${fps}`] : [])].join(',')] : []), path.join(dst, '%05d.png')], { onLine });
    } else throw new Error(`Unknown format: ${x.formato}`);
    setStage('formato', 1);
    return finish(dst);
  }

  async function finish(dst) {
    setStage('guardado', 0.5);
    const st = await fsp.stat(dst);
    let tamano = st.size;
    if (st.isDirectory()) { tamano = 0; for (const f of await fsp.readdir(dst)) tamano += (await fsp.stat(path.join(dst, f))).size; }
    const p = project();
    const rel = dst.startsWith(p.dir) ? path.relative(p.dir, dst).split(path.sep).join('/') : null;
    const resultado = { ruta: dst, rel, nombre: path.basename(dst), tamano, carpeta: st.isDirectory(), formato: job.opciones.formato, segundos: (Date.now() - job.inicio) / 1000 };
    const histFile = path.join(p.dir, '.estudio', 'exportaciones.json');
    const hist = await readJson(histFile, []);
    hist.unshift({ ...resultado, fecha: new Date().toISOString(), opciones: job.opciones });
    await fsp.writeFile(histFile, JSON.stringify(hist.slice(0, 30), null, 2));
    emit({ estado: 'listo', pct: 1, etapa: 'guardado', etapaPct: 1, restante: 0, resultado });
    return resultado;
  }

  return {
    start,
    cancel() { if (job?.estado === 'exportando') { job.cancelado = true; killTree(job.child); emit({ estado: 'cancelado' }); } },
    state: publicJob,
    async history() { const p = project(); return (await readJson(path.join(p.dir, '.estudio', 'exportaciones.json'), [])).filter(h => fs.existsSync(h.ruta)); },
    async known(ruta) { return (await this.history()).some(h => h.ruta === ruta); },
  };
}
