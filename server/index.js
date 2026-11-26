#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createExporter } from './export.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const PORT = Number(flag('--port', process.env.ESTUDIO_PORT || 4870));
const PROD = args.includes('--prod') || globalThis.KINORA_BUNDLE === true;
const OPEN = args.includes('--open');
const positional = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--port'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.md': 'text/markdown; charset=utf-8',
  '.py': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};
const SOURCE_EXT = new Set(['.html', '.js', '.mjs', '.jsx', '.ts', '.tsx', '.py', '.json', '.md', '.css']);
const IGNORED = /(^|[\\/])(\.estudio|out|node_modules|__pycache__|\.git)([\\/]|$)/;

let project = null;
let live = { t: 0, playing: false, seleccion: null, herramienta: 'inspeccionar', vista: null, actualizado: 0 };
const clients = new Set();
const pending = new Map();
let reqId = 0;
let watcher = null;
let chat = { proc: null, sessionId: null, busy: false };
const exporter = createExporter({ broadcast: m => broadcast(m), project: () => project, buildAudio: () => buildAudio() });

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(msg) { for (const ws of clients) send(ws, msg); }

function uiRequest(cmd, payload = {}, timeout = 20000) {
  const ui = [...clients].find(c => c.readyState === 1);
  if (!ui) return Promise.reject(new Error('The editor is not open in any browser tab. Call the open tool (no folder needed) to open the tab, then try again.'));
  const id = ++reqId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`The editor did not respond to ${cmd}.`)); }, timeout);
    pending.set(id, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } });
    send(ui, { type: 'cmd', id, cmd, ...payload });
  });
}

const dataDir = () => path.join(project.dir, '.estudio');
const notesPath = () => path.join(dataDir(), 'notas.json');

async function readJson(file, fallback) {
  try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(value, null, 2));
}

async function listFiles(dir, base = dir, out = []) {
  for (const ent of await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, ent.name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (IGNORED.test(rel)) continue;
    if (ent.isDirectory()) await listFiles(full, base, out);
    else out.push(rel);
  }
  return out;
}

async function openProject(dir) {
  dir = path.resolve(dir);
  const stat = await fsp.stat(dir).catch(() => null);
  if (!stat || !stat.isDirectory()) throw new Error(`Folder not found: ${dir}`);
  const entry = fs.existsSync(path.join(dir, 'index.html')) ? 'index.html' : (await listFiles(dir)).find(f => f.endsWith('.html'));
  if (!entry) throw new Error('The folder has no HTML page.');
  project = { dir, name: path.basename(dir) === 'video' ? path.basename(path.dirname(dir)) : path.basename(dir), entry };
  await fsp.mkdir(dataDir(), { recursive: true });
  history = { undo: [], redo: [], known: new Map() };
  for (const f of await listFiles(dir)) if (SOURCE_EXT.has(path.extname(f).toLowerCase())) history.known.set(f, await fsp.readFile(path.join(dir, f), 'utf8').catch(() => null));
  const rec = (await readJson(RECENTS, [])).filter(r => r.dir !== dir);
  rec.unshift({ dir, name: project.name, abierto: new Date().toISOString() });
  await writeJson(RECENTS, rec.slice(0, 12));
  const saved = await readJson(path.join(dataDir(), 'chat.json'), {});
  chat.sessionId = saved.sessionId || null;
  // If the editor restarted while Claude was working, the chat says where it stopped instead of hanging.
  if (!chat.busy) {
    const histFile = path.join(dataDir(), 'mensajes.json');
    const hist = await readJson(histFile, []);
    if (hist.length && hist[hist.length - 1].tipo === 'usuario') {
      hist.push({ tipo: 'claude', texto: '', herramientas: [], t: Date.now(), error: 'Interrupted: the editor restarted while Claude was working. You can ask again.' });
      await writeJson(histFile, hist);
    }
  }
  watch();
  buildAudio().catch(e => console.warn('audio:', e.message));
  broadcast({ type: 'proyecto', name: project.name });
  console.log(`project: ${dir}`);
}

const HOME_DIR = path.join(os.homedir(), '.estudio');
const RECENTS = path.join(HOME_DIR, 'recientes.json');
const CONFIG = path.join(HOME_DIR, 'config.json');
let history = { undo: [], redo: [], known: new Map() };
let restoring = new Map();
const pendingTrack = new Set();
let chatRun = 0;
const preguntas = new Map();

// Undo steps. Each step holds every file it changed. Everything Claude does in one request is one step;
// your own quick edits of the same file (dragging a number) merge into one step too.
async function track(rel) {
  pendingTrack.delete(rel);
  if (!SOURCE_EXT.has(path.extname(rel).toLowerCase())) return;
  const now = await fsp.readFile(path.join(project.dir, rel), 'utf8').catch(() => null);
  const before = history.known.get(rel) ?? null;
  history.known.set(rel, now);
  if (restoring.has(rel)) {
    const expected = restoring.get(rel); restoring.delete(rel);
    if (now === expected) return;
  }
  if (now === before) return;
  const autor = chat.busy ? 'claude' : 'vos';
  const grupo = chat.busy ? `claude-${chatRun}` : `vos-${rel}`;
  const last = history.undo[history.undo.length - 1];
  const merge = last && last.grupo === grupo && (autor === 'claude' || Date.now() - last.t < 2500);
  if (merge) {
    const f = last.files.find(x => x.file === rel);
    if (f) f.after = now; else last.files.push({ file: rel, before, after: now });
    last.t = Date.now();
  } else history.undo.push({ files: [{ file: rel, before, after: now }], autor, grupo, t: Date.now() });
  if (history.undo.length > 300) history.undo.shift();
  history.redo = [];
  broadcast({ type: 'historial', ...historySummary() });
}
function describeStep(st) {
  if (!st) return null;
  return { file: st.files.length === 1 ? st.files[0].file : `${st.files.length} files`, autor: st.autor, archivos: st.files.map(f => f.file) };
}
function historySummary() {
  return { deshacer: describeStep(history.undo[history.undo.length - 1]), rehacer: describeStep(history.redo[history.redo.length - 1]), pasos: history.undo.length };
}
async function stepHistory(dir) {
  // Record any change the watcher has not seen yet, so undo never overwrites unsaved history.
  for (const rel of [...pendingTrack]) await track(rel);
  const from = dir === 'deshacer' ? history.undo : history.redo;
  const to = dir === 'deshacer' ? history.redo : history.undo;
  const step = from.pop();
  if (!step) return null;
  for (const f of step.files) {
    const content = dir === 'deshacer' ? f.before : f.after;
    const full = path.join(project.dir, f.file);
    restoring.set(f.file, content);
    if (content == null) await fsp.rm(full, { force: true }); else await fsp.writeFile(full, content);
    history.known.set(f.file, content);
  }
  to.push(step);
  broadcast({ type: 'historial', ...historySummary() });
  return { ...step, file: describeStep(step).file };
}

function frontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  const out = {};
  if (!m) return out;
  let key = null;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) { key = kv[1]; out[key] = kv[2].replace(/^["']|["']$/g, ''); }
    else if (key && /^\s+/.test(line)) out[key] += ' ' + line.trim();
  }
  return out;
}

async function skillDirs() {
  const cfg = await readJson(CONFIG, {});
  const home = os.homedir();
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude');
  const roots = [
    { dir: path.join(ROOT, 'skills'), origen: 'Kinora' },
    ...(cfg.skills || []).map(d => ({ dir: d, origen: 'Added', single: true })),
    { dir: path.join(configDir, 'skills'), origen: 'Claude Code' },
    { dir: path.join(home, '.claude', 'skills'), origen: 'Claude Code' },
    { dir: path.join(home, '.agents', 'skills'), origen: 'Agents' },
  ];
  const seen = new Map();
  for (const r of roots) {
    const dirs = r.single ? [r.dir] : (await fsp.readdir(r.dir, { withFileTypes: true }).catch(() => [])).filter(e => e.isDirectory()).map(e => path.join(r.dir, e.name));
    for (const d of dirs) {
      const md = await fsp.readFile(path.join(d, 'SKILL.md'), 'utf8').catch(() => null);
      if (!md) continue;
      const fm = frontmatter(md);
      const name = fm.name || path.basename(d);
      if (seen.has(name)) continue;
      seen.set(name, { name, description: fm.description || '', dir: d, origen: r.origen, fija: r.origen === 'Kinora' });
    }
  }
  return [...seen.values()];
}
async function activeSkills() {
  const all = await skillDirs();
  const conf = await readJson(path.join(dataDir(), 'config.json'), {});
  const on = conf.skills || all.filter(s => s.fija || s.name === 'opuscut').map(s => s.name);
  return all.map(s => ({ ...s, activa: s.fija || on.includes(s.name) }));
}

const VERSION_SEEN = 1;
const runOnce = (cmd, args, timeout, shell) => new Promise(resolve => execFile(cmd, args, { timeout, windowsHide: true, shell }, (err, stdout, stderr) => resolve({ ok: !err, missing: err?.code === 'ENOENT', out: String(stdout || '').trim(), err: String(stderr || '').trim() })));
const run = async (cmd, args, timeout = 15000) => {
  const r = await runOnce(cmd, args, timeout, false);
  return r.missing && process.platform === 'win32' ? runOnce(cmd, args, timeout, true) : r;
};
let setupCache = null;
async function setupStatus(fresh) {
  if (setupCache && !fresh && Date.now() - setupCache.t < 60e3) return setupCache.v;
  const PYBIN = process.env.PYTHON || 'python';
  const [ver, auth, py, mods, ff] = await Promise.all([
    run(process.env.CLAUDE_BIN || 'claude', ['--version']),
    run(process.env.CLAUDE_BIN || 'claude', ['auth', 'status']),
    run(PYBIN, ['--version']),
    run(PYBIN, ['-c', 'import importlib.util as u;print(",".join(m for m in ["numpy","scipy","PIL","playwright"] if not u.find_spec(m)))']),
    run('ffmpeg', ['-version']),
  ]);
  let a = {};
  try { a = JSON.parse(auth.out); } catch { }
  const cfg = await readJson(CONFIG, {});
  const con = await connections();
  const v = {
    visto: cfg.bienvenida === VERSION_SEEN,
    claude: {
      instalado: ver.ok,
      version: ver.ok ? ver.out.split(/\s/)[0] : null,
      conectado: !!a.loggedIn,
      metodo: a.authMethod || null,
      plan: a.subscriptionType || null,
    },
    python: { ok: py.ok, version: py.ok ? (py.out || py.err).replace(/^Python\s*/i, '') : null, faltan: mods.ok ? mods.out.split(',').filter(Boolean).map(m => (m === 'PIL' ? 'Pillow' : m)) : null },
    ffmpeg: ff.ok,
    sonidos: cfg.openverse !== false,
    imagenes: con.openrouter ? 'openrouter' : con.gateway ? 'gateway' : null,
    requisitos: path.join(ROOT, 'skills', 'opuscut', 'requirements.txt'),
    plataforma: process.platform,
  };
  setupCache = { t: Date.now(), v };
  return v;
}

async function connections() {
  const cfg = await readJson(CONFIG, {});
  return {
    openrouter: cfg.openrouter || process.env.OPENROUTER_API_KEY || null,
    gateway: cfg.gateway || process.env.AI_GATEWAY_API_KEY || null,
    tripo: cfg.tripo || process.env.TRIPO_API_KEY || null,
    modeloImagen: cfg.modeloImagen || 'openrouter:openai/gpt-5.4-image-2',
  };
}
const mask = k => (k ? `${k.slice(0, 6)}…${k.slice(-4)}` : null);

let imageModels = { t: 0, key: '', list: [] };
async function listImageModels() {
  const con = await connections();
  const key = `${!!con.openrouter}:${!!con.gateway}`;
  if (imageModels.key === key && Date.now() - imageModels.t < 3600e3) return imageModels.list;
  const list = [];
  if (con.openrouter) {
    try {
      const d = await (await fetch('https://openrouter.ai/api/v1/models')).json();
      for (const m of d.data || []) if ((m.architecture?.output_modalities || []).includes('image') && !m.id.startsWith('openrouter/'))
        list.push({ id: `openrouter:${m.id}`, nombre: m.name.replace(/^[^:]+:\s*/, ''), proveedor: 'OpenRouter', autor: m.id.split('/')[0], via: 'chat', referencias: (m.architecture?.input_modalities || []).includes('image') });
    } catch { }
  }
  if (con.gateway) {
    try {
      const d = await (await fetch('https://ai-gateway.vercel.sh/v1/models')).json();
      for (const m of d.data || []) {
        const only = m.type === 'image';
        const multi = m.type === 'language' && (m.tags || []).includes('image-generation');
        if (!only && !multi) continue;
        list.push({ id: `gateway:${m.id}`, nombre: m.name, proveedor: 'AI Gateway', autor: m.owned_by || m.id.split('/')[0], via: only ? 'images' : 'chat', referencias: (m.modalities?.input || []).includes('image') || multi });
      }
    } catch { }
  }
  imageModels = { t: Date.now(), key, list };
  return list;
}

async function saveGenerated(buf, prompt, nombre, fondo) {
  const base = (nombre || prompt).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'imagen';
  const dir = path.join(project.dir, 'assets', 'gen');
  await fsp.mkdir(dir, { recursive: true });
  let file = path.join(dir, `${base}.png`), n = 2;
  while (fs.existsSync(file)) file = path.join(dir, `${base}-${n++}.png`);
  await fsp.writeFile(file, buf);
  if (fondo === 'transparente') await new Promise((resolve, reject) => execFile(process.env.PYTHON || 'python', [path.join(HERE, 'key_green.py'), file, file], { windowsHide: true }, e => (e ? reject(e) : resolve())));
  broadcast({ type: 'archivos' });
  return path.relative(project.dir, file).split(path.sep).join('/');
}

async function generateImage({ prompt, refs = [], ratio = '1:1', fondo = 'normal', nombre, modelo }) {
  const con = await connections();
  let id = modelo || con.modeloImagen;
  if (!id.includes(':')) id = `openrouter:${id}`;
  const [prov, model] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
  const key = prov === 'gateway' ? con.gateway : con.openrouter;
  if (!key) throw new Error(`${prov === 'gateway' ? 'AI Gateway' : 'OpenRouter'} is not connected.`);
  const text = `${prompt}${fondo === 'transparente' ? '\n\nIsolated subject on a flat pure chroma green background (#00FF00), no shadow on the background, nothing else in frame.' : ''}\nAspect ratio ${ratio}. No text or watermark unless asked.`;
  const images = [];
  for (const ref of refs.slice(0, 4)) {
    const full = safeJoin(project.dir, ref);
    const ext = path.extname(full).slice(1).toLowerCase().replace('jpg', 'jpeg');
    images.push(`data:image/${ext};base64,${(await fsp.readFile(full)).toString('base64')}`);
  }
  const headers = { authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  const models = await listImageModels();
  const info = models.find(m => m.id === id);
  let buf, cost = null;
  if (prov === 'gateway' && (info?.via === 'images')) {
    const url = images.length ? 'https://ai-gateway.vercel.sh/v1/images/edits' : 'https://ai-gateway.vercel.sh/v1/images/generations';
    const body = { model, prompt: text, n: 1, response_format: 'b64_json', ...(images.length ? { images: images.map(u => ({ image_url: u })) } : {}) };
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error?.message || `AI Gateway returned ${r.status}`);
    const img = d.data?.[0];
    if (img?.b64_json) buf = Buffer.from(img.b64_json, 'base64');
    else if (img?.url) buf = Buffer.from(await (await fetch(img.url)).arrayBuffer());
  } else {
    const content = [{ type: 'text', text }, ...images.map(u => ({ type: 'image_url', image_url: { url: u } }))];
    const url = prov === 'gateway' ? 'https://ai-gateway.vercel.sh/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
    const body = { model, modalities: ['image', 'text'], messages: [{ role: 'user', content }], ...(prov === 'openrouter' ? { image_config: { aspect_ratio: ratio } } : {}), stream: false };
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error?.message || `${prov === 'gateway' ? 'AI Gateway' : 'OpenRouter'} returned ${r.status}`);
    const u = d.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (u) buf = Buffer.from(u.split(',')[1], 'base64');
    cost = d.usage?.cost ?? null;
  }
  if (!buf) throw new Error('The model did not return an image.');
  const archivo = await saveGenerated(buf, prompt, nombre, fondo);
  return { archivo, costo: cost, modelo: id };
}

// Free sounds through Openverse: no key, commercial-friendly licenses only, searches cached on disk.
const SOUND_CACHE = path.join(HOME_DIR, 'sonidos-cache');
async function searchSounds({ q, largo = 'shortest', tipo = 'efecto', pagina = 1 }) {
  const cfg = await readJson(CONFIG, {});
  if (cfg.openverse === false) throw new Error('Free sounds are turned off.');
  const params = new URLSearchParams({ q, license_type: 'commercial', page_size: '20', page: String(pagina) });
  if (largo) params.set('length', largo);
  if (tipo === 'musica') params.set('source', 'jamendo');
  const key = params.toString();
  const cacheFile = path.join(SOUND_CACHE, Buffer.from(key).toString('base64url') + '.json');
  const cached = await readJson(cacheFile, null);
  if (cached && Date.now() - cached.t < 7 * 864e5) return cached.data;
  const r = await fetch(`https://api.openverse.org/v1/audio/?${key}`, { headers: { 'user-agent': 'Kinora/0.5 (local video editor)' } });
  if (r.status === 429) throw new Error('Openverse asked to wait: the limit without a key is 20 searches per minute.');
  const d = await r.json();
  const data = (d.results || []).map(x => ({
    id: x.id, titulo: x.title, autor: x.creator, licencia: `${(x.license || '').toUpperCase()} ${x.license_version || ''}`.trim(),
    duracion: x.duration ? x.duration / 1000 : null, url: x.url, fuente: x.source, pagina: x.foreign_landing_url, atribucion: x.attribution, cc0: x.license === 'cc0' || x.license === 'pdm',
  })).filter(x => x.url);
  await writeJson(cacheFile, { t: Date.now(), data });
  return data;
}

const GENERIC_SOUNDS = [
  ['Whoosh', 'whoosh'], ['Hits', 'punch'], ['Impacts', 'cinematic impact'], ['Interface clicks', 'ui click'],
  ['Risers', 'riser'], ['Bells', 'bell chime'], ['Ambience', 'ambience'], ['Transitions', 'swoosh transition'],
];
const GENERIC_MUSIC = [
  ['Cinematic', 'cinematic'], ['Ambient', 'ambient'], ['Electronic', 'electronic'], ['Lo-fi', 'lofi'],
  ['Epic', 'epic'], ['Piano', 'piano'], ['Suspense', 'suspense'], ['Upbeat', 'upbeat'],
];
const STOP = new Set(['a', 'an', 'the', 'and', 'of', 'in', 'on', 'that', 'with', 'final', 'soft', 'low', 'high', 'big', 'small', 'then', 'silence', 'concept', 'cues', 'up', 'pile', 'minor', 'major']);
async function videoSoundIdeas() {
  const md = await fsp.readFile(path.join(project.dir, 'video.md'), 'utf8').catch(() => '');
  const sec = (md.match(/##\s*Sound[^\n]*\n([\s\S]*?)(\n##\s|$)/i) || [])[1] || '';
  const phrases = sec.replace(/^[-*]\s*(Concept|Cues)\s*:/gim, '').replace(/\bin [A-G][#b]? (minor|major)\b/gi, '')
    .split(/[,;.\n]| and /i).map(x => x.replace(/^[-*\s]+/, '').trim().toLowerCase()).filter(Boolean);
  const out = [];
  for (const ph of phrases) {
    const words = ph.split(/\s+/).filter(w => /^[a-z][a-z-]+$/.test(w) && !STOP.has(w)).slice(0, 2);
    if (!words.length) continue;
    const q = words.join(' ');
    if (!out.includes(q)) out.push(q);
    if (out.length >= 6) break;
  }
  return out;
}
async function recommendSounds({ tipo = 'efecto', largo } = {}) {
  const music = tipo === 'musica';
  const ideas = music ? [] : await videoSoundIdeas();
  const groups = [
    ...ideas.map(q => ({ titulo: q, q, delVideo: true })),
    ...(music ? GENERIC_MUSIC : GENERIC_SOUNDS).map(([titulo, q]) => ({ titulo, q })),
  ];
  const len = largo || (music ? 'medium' : 'shortest');
  const out = [];
  for (let i = 0; i < groups.length; i += 4) {
    const chunk = await Promise.all(groups.slice(i, i + 4).map(async g => {
      try {
        const list = await searchSounds({ q: g.q, largo: len, tipo });
        return { ...g, items: list.sort((a, b) => (b.cc0 - a.cc0)).slice(0, 6) };
      } catch (e) { return { ...g, items: [], error: e.message }; }
    }));
    out.push(...chunk);
  }
  return out.filter(g => g.items.length || g.error);
}

async function downloadSound({ url, titulo, atribucion, cc0 }) {
  const base = (titulo || 'sonido').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'sonido';
  const dir = path.join(project.dir, 'assets', 'sounds');
  await fsp.mkdir(dir, { recursive: true });
  let file = path.join(dir, `${base}.wav`), n = 2;
  while (fs.existsSync(file)) file = path.join(dir, `${base}-${n++}.wav`);
  const r = await fetch(url, { headers: { 'user-agent': 'Kinora/0.5 (local video editor)' } });
  if (!r.ok) throw new Error(`Could not download (${r.status}).`);
  const tmp = file + '.src';
  await fsp.writeFile(tmp, Buffer.from(await r.arrayBuffer()));
  await new Promise((resolve, reject) => execFile('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ar', '48000', '-ac', '2', file], { windowsHide: true }, e => (e ? reject(new Error('ffmpeg could not convert the sound.')) : resolve())));
  await fsp.rm(tmp, { force: true });
  const rel = path.relative(project.dir, file).split(path.sep).join('/');
  if (!cc0 && atribucion) {
    const credits = path.join(dir, 'CREDITS.md');
    const prev = await fsp.readFile(credits, 'utf8').catch(() => '# Sound credits\n');
    await fsp.writeFile(credits, `${prev}\n- ${path.basename(file)}: ${atribucion}`);
  }
  broadcast({ type: 'archivos' });
  return { archivo: rel, atribucion: cc0 ? null : atribucion };
}

function watch() {
  if (watcher) watcher.close();
  const timers = new Map();
  watcher = fs.watch(project.dir, { recursive: true }, (_ev, file) => {
    if (!file) return;
    const rel = file.split(path.sep).join('/');
    if (IGNORED.test(rel)) return;
    clearTimeout(timers.get(rel));
    pendingTrack.add(rel);
    timers.set(rel, setTimeout(() => {
      timers.delete(rel);
      track(rel);
      broadcast({ type: 'archivo', file: rel });
      if (/(^|\/)(sound|synth)\.py$/.test(rel) || rel === 'timeline.json') buildAudio().catch(e => broadcast({ type: 'audio', error: e.message }));
    }, 120));
  });
}

let audioRun = null;
function buildAudio() {
  if (!project || !fs.existsSync(path.join(project.dir, 'sound.py'))) return Promise.resolve(null);
  if (audioRun) { audioRun.again = true; return audioRun.promise; }
  const run = { again: false };
  run.promise = new Promise((resolve, reject) => {
    broadcast({ type: 'audio', estado: 'generando' });
    execFile(process.env.PYTHON || 'python', [path.join(HERE, 'audio.py'), project.dir], { cwd: project.dir, maxBuffer: 1 << 24, windowsHide: true }, (err, stdout, stderr) => {
      audioRun = null;
      if (run.again) { buildAudio().then(resolve, reject); return; }
      if (err) {
        const msg = (stderr || err.message).trim().split('\n').slice(-6).join('\n');
        broadcast({ type: 'audio', error: msg });
        reject(new Error(msg));
        return;
      }
      broadcast({ type: 'audio', estado: 'listo', stamp: Date.now() });
      resolve(stdout);
    });
  });
  audioRun = run;
  return run.promise;
}

function readBody(req, limit = 64 << 20) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const json = (res, code, value) => { res.writeHead(code, { 'content-type': MIME['.json'], 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };

function safeJoin(base, rel) {
  const full = path.resolve(base, decodeURIComponent(rel).replace(/^\/+/, ''));
  if (full !== base && !full.startsWith(base + path.sep)) throw new Error('Path outside the project');
  return full;
}

async function serveProject(req, res, rel) {
  const full = safeJoin(project.dir, rel || project.entry);
  const st = await fsp.stat(full).catch(() => null);
  if (!st || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
  const ext = path.extname(full).toLowerCase();
  const headers = { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' };
  if (ext === '.html') {
    let html = await fsp.readFile(full, 'utf8');
    const tag = '<script src="/__estudio/probe.js"></script>';
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + tag) : tag + html;
    res.writeHead(200, headers); res.end(html); return;
  }
  const range = req.headers.range;
  if (range && /^bytes=/.test(range)) {
    const [a, b] = range.slice(6).split('-');
    const start = Number(a) || 0, end = b ? Number(b) : st.size - 1;
    res.writeHead(206, { ...headers, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': end - start + 1 });
    fs.createReadStream(full, { start, end }).pipe(res); return;
  }
  res.writeHead(200, { ...headers, 'content-length': st.size });
  fs.createReadStream(full).pipe(res);
}

async function notes() { return readJson(notesPath(), []); }
async function saveNotes(list) { await writeJson(notesPath(), list); broadcast({ type: 'notas', notas: list }); }

async function api(req, res, url) {
  const route = url.pathname.slice(5);
  const method = req.method;
  const body = method === 'GET' ? null : await readBody(req);
  const data = body && req.headers['content-type']?.includes('json') ? JSON.parse(body.toString('utf8') || '{}') : null;

  if (route === 'abrir' && method === 'POST') { await openProject(data.dir); return json(res, 200, { ok: true, dir: project.dir }); }
  if (route === 'bienvenida' && method === 'GET') {
    const st = await setupStatus(url.searchParams.has('fresco'));
    // Preview as a new user would see it: no Claude Code, nothing connected.
    if (url.searchParams.get('vista') === 'nuevo') return json(res, 200, { ...st, visto: false, claude: { instalado: false, version: null, conectado: false, metodo: null, plan: null }, imagenes: null });
    return json(res, 200, st);
  }
  if (route === 'bienvenida' && method === 'POST') {
    const cfg = await readJson(CONFIG, {});
    cfg.bienvenida = VERSION_SEEN;
    await writeJson(CONFIG, cfg);
    setupCache = null;
    return json(res, 200, { ok: true });
  }
  if (route === 'instalar' && method === 'POST') {
    // Python packages for sound, export and capture, then the browser Playwright drives. Takes a minute or two.
    const PYBIN = process.env.PYTHON || 'python';
    const steps = [[PYBIN, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', path.join(ROOT, 'skills', 'opuscut', 'requirements.txt')]], [PYBIN, ['-m', 'playwright', 'install', 'chromium']]];
    for (const [cmd, a] of steps) {
      const r = await run(cmd, a, 15 * 60e3);
      if (!r.ok) { setupCache = null; return json(res, 500, { error: (r.err || r.out).split('\n').slice(-4).join('\n') || 'The install failed.' }); }
    }
    setupCache = null;
    return json(res, 200, await setupStatus(true));
  }
  if (route === 'ejemplo' && method === 'POST') {
    const base = data.carpeta ? path.resolve(data.carpeta) : path.join(os.homedir(), 'Documents', 'Kinora');
    let target = path.join(base, 'Example'), i = 2;
    while (fs.existsSync(target)) target = path.join(base, `Example ${i++}`);
    await fsp.mkdir(base, { recursive: true });
    await fsp.cp(path.join(ROOT, 'templates', 'example'), target, { recursive: true, filter: src => !/__pycache__|[\\/]out([\\/]|$)/.test(src) });
    await openProject(target);
    return json(res, 200, { ok: true, dir: target });
  }
  if (route === 'recientes') return json(res, 200, (await readJson(RECENTS, [])).filter(r => fs.existsSync(r.dir)));
  if (route === 'carpetas') {
    let dir = url.searchParams.get('dir');
    if (!dir) {
      const rec = await readJson(RECENTS, []);
      dir = rec[0] ? path.dirname(rec[0].dir) : os.homedir();
    }
    dir = path.resolve(dir);
    const ents = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
    const dirs = [];
    for (const e of ents) {
      if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules' || e.name === '__pycache__') continue;
      const full = path.join(dir, e.name);
      dirs.push({ name: e.name, path: full, video: fs.existsSync(path.join(full, 'index.html')) });
    }
    dirs.sort((a, b) => (b.video - a.video) || a.name.localeCompare(b.name));
    const parent = path.dirname(dir);
    return json(res, 200, { dir, parent: parent !== dir ? parent : null, video: fs.existsSync(path.join(dir, 'index.html')), dirs });
  }
  if (route === 'elegir' && method === 'POST') {
    const folder = data.tipo === 'carpeta';
    const start = (data.desde || '').replace(/'/g, "''");
    const ps = folder
      ? `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = 'Choose a folder'; $d.ShowNewFolderButton = $true; if ('${start}') { $d.SelectedPath = '${start}' }; $o = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false }; if ($d.ShowDialog($o) -eq 'OK') { [Console]::OutputEncoding = [Text.Encoding]::UTF8; $d.SelectedPath }`
      : `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Title = 'Open a video'; $d.Filter = 'Video page (*.html)|*.html|All files (*.*)|*.*'; if ('${start}') { $d.InitialDirectory = '${start}' }; $o = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false }; if ($d.ShowDialog($o) -eq 'OK') { [Console]::OutputEncoding = [Text.Encoding]::UTF8; $d.FileName }`;
    const out = await new Promise(resolve => execFile('powershell', ['-NoProfile', '-STA', '-Command', ps], { windowsHide: false, maxBuffer: 1 << 20 }, (err, stdout) => resolve(err ? '' : stdout.trim())));
    if (!out) return json(res, 200, { cancelado: true });
    return json(res, 200, { ruta: folder ? out : path.dirname(out), archivo: folder ? null : path.basename(out) });
  }
  if (route === 'localizar' && method === 'POST') {
    // The browser picker only reveals the folder's name and its files; find that folder on disk.
    const { nombre, archivos = [], indice } = data;
    const want = new Map(archivos.map(a => (typeof a === 'string' ? [a, null] : [a.n, a.s])));
    const home = os.homedir();
    const rec = (await readJson(RECENTS, [])).map(r => path.dirname(r.dir));
    const roots = [...new Set([...rec, path.join(home, 'Desktop'), path.join(home, 'Documents'), path.join(home, 'Downloads'), path.join(home, 'OneDrive'), home, ...(process.platform === 'win32' ? 'CDEFGH'.split('').map(l => l + ':/').filter(d => fs.existsSync(d)) : ['/'])])].filter(d => fs.existsSync(d));
    const skip = /^(node_modules|\.git|AppData|\$Recycle\.Bin|Windows|Program Files.*|ProgramData|System Volume Information|__pycache__)$/i;
    const found = [];
    const seen = new Set();
    let visited = 0;
    const score = async dir => {
      const names = await fsp.readdir(dir).catch(() => []);
      let hits = 0;
      for (const n of names) {
        if (!want.has(n)) continue;
        const size = want.get(n);
        if (size == null) { hits++; continue; }
        const st = await fsp.stat(path.join(dir, n)).catch(() => null);
        if (st && st.size === size) hits++;
      }
      let size = true;
      if (indice?.nombre) { const st = await fsp.stat(path.join(dir, indice.nombre)).catch(() => null); size = !!st && (!indice.tam || st.size === indice.tam); }
      return size ? hits / Math.max(1, want.size) : 0;
    };
    for (const r of roots) {
      const queue = [[r, 0]];
      while (queue.length && visited < 40000 && found.length < 3) {
        const [dir, depth] = queue.shift();
        if (seen.has(dir)) continue; seen.add(dir); visited++;
        if (path.basename(dir).toLowerCase() === String(nombre).toLowerCase()) {
          const sc = await score(dir);
          if (sc >= 0.98) found.push({ dir, sc });
        }
        if (depth >= 6) continue;
        const ents = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const e of ents) if (e.isDirectory() && !e.name.startsWith('.') && !skip.test(e.name)) queue.push([path.join(dir, e.name), depth + 1]);
      }
      if (found.length) break;
    }
    found.sort((a, b) => b.sc - a.sc);
    return json(res, 200, { rutas: found.map(f => f.dir) });
  }
  if (route === 'lugares') {
    const home = os.homedir();
    const lugares = [
      { nombre: 'Home', ruta: home }, { nombre: 'Desktop', ruta: path.join(home, 'Desktop') }, { nombre: 'Documents', ruta: path.join(home, 'Documents') },
      { nombre: 'Downloads', ruta: path.join(home, 'Downloads') },
    ].filter(l => fs.existsSync(l.ruta));
    const unidades = [];
    if (process.platform === 'win32') for (const l of 'CDEFGHIJKLMNOPQRSTUVWXYZ') if (fs.existsSync(l + ':/')) unidades.push({ nombre: `${l}:`, ruta: l + ':/' });
    return json(res, 200, { lugares, unidades });
  }
  if (route === 'conexiones' && method === 'GET') {
    const c = await connections();
    return json(res, 200, { openrouter: mask(c.openrouter), gateway: mask(c.gateway), tripo: mask(c.tripo), modeloImagen: c.modeloImagen, openverse: (await readJson(CONFIG, {})).openverse !== false });
  }
  if (route === 'conexiones' && method === 'POST') {
    const cfg = await readJson(CONFIG, {});
    for (const k of ['openrouter', 'gateway', 'tripo', 'modeloImagen']) if (k in data) { if (data[k]) cfg[k] = data[k]; else delete cfg[k]; }
    if ('openverse' in data) { if (data.openverse) delete cfg.openverse; else cfg.openverse = false; }
    await writeJson(CONFIG, cfg);
    setupCache = null;
    const c = await connections();
    return json(res, 200, { openrouter: mask(c.openrouter), gateway: mask(c.gateway), tripo: mask(c.tripo), modeloImagen: c.modeloImagen, openverse: cfg.openverse !== false });
  }
  if (route === 'modelos-imagen') {
    try { return json(res, 200, await listImageModels()); } catch (e) { return json(res, 502, { error: e.message }); }
  }
  if (route === 'nuevo' && method === 'POST') {
    const cfg = await readJson(CONFIG, {});
    const engine = cfg.motor || path.join(ROOT, 'skills', 'opuscut', 'engine');
    if (!fs.existsSync(path.join(engine, 'index.html'))) return json(res, 409, { error: 'Could not find the OpusCut engine for the template.' });
    const name = String(data.nombre || '').trim().replace(/[<>:"/\\|?*]+/g, '-');
    if (!name) return json(res, 400, { error: 'The name is missing.' });
    const target = path.join(path.resolve(data.carpeta), name);
    if (fs.existsSync(target)) return json(res, 409, { error: 'A folder with that name already exists.' });
    await fsp.cp(engine, target, { recursive: true, filter: src => !/__pycache__|[\\/]out([\\/]|$)/.test(src) });
    const tl = await readJson(path.join(target, 'timeline.json'), {});
    tl.name = name.toLowerCase().replace(/\s+/g, '-');
    if (data.ancho) tl.width = +data.ancho; if (data.alto) tl.height = +data.alto;
    if (data.segundos) tl.beats = Math.max(4, Math.round(+data.segundos * tl.bpm / 60));
    await writeJson(path.join(target, 'timeline.json'), tl);
    await openProject(target);
    return json(res, 200, { ok: true, dir: target });
  }
  if (route === 'skills' && method === 'GET') {
    if (!project) return json(res, 200, (await skillDirs()).map(s => ({ ...s, activa: s.fija })));
    return json(res, 200, await activeSkills());
  }
  if (route === 'skills/agregar' && method === 'POST') {
    const dir = path.resolve(data.dir);
    if (!fs.existsSync(path.join(dir, 'SKILL.md'))) return json(res, 400, { error: 'That folder has no SKILL.md.' });
    const cfg = await readJson(CONFIG, {});
    cfg.skills = [...new Set([...(cfg.skills || []), dir])];
    await writeJson(CONFIG, cfg);
    return json(res, 200, { ok: true });
  }
  if (!project) return json(res, 409, { error: 'No project is open.' });

  if (route === 'etiquetas') {
    const file = path.join(dataDir(), 'config.json');
    const conf = await readJson(file, {});
    if (method === 'POST') {
      conf.etiquetas = conf.etiquetas || { pistas: {}, sonidos: {} };
      const group = data.tipo === 'pista' ? 'pistas' : 'sonidos';
      if (data.nombre && data.nombre.trim()) conf.etiquetas[group][data.clave] = data.nombre.trim(); else delete conf.etiquetas[group][data.clave];
      await writeJson(file, conf);
      broadcast({ type: 'etiquetas', etiquetas: conf.etiquetas });
    }
    return json(res, 200, conf.etiquetas || { pistas: {}, sonidos: {} });
  }
  if (route === 'skills' && method === 'POST') {
    const conf = await readJson(path.join(dataDir(), 'config.json'), {});
    conf.skills = data.activas;
    await writeJson(path.join(dataDir(), 'config.json'), conf);
    return json(res, 200, await activeSkills());
  }
  if ((route === 'deshacer' || route === 'rehacer') && method === 'POST') {
    const step = await stepHistory(route);
    return json(res, 200, { ok: !!step, file: step?.file, ...historySummary() });
  }
  if (route === 'historial' && url.searchParams.has('todo')) {
    for (const rel of [...pendingTrack]) await track(rel);
    const list = steps => steps.map(st => ({ ...describeStep(st), t: new Date(st.t).toISOString() })).reverse();
    return json(res, 200, { deshacer: list(history.undo), rehacer: list(history.redo) });
  }
  if (route === 'historial') return json(res, 200, historySummary());
  if (route === 'explorador' && method === 'POST') {
    spawn('explorer', [project.dir], { detached: true, windowsHide: false }).unref();
    return json(res, 200, { ok: true });
  }
  if (route === 'proyecto') {
    const files = await listFiles(project.dir);
    const timeline = await readJson(path.join(project.dir, 'timeline.json'), null);
    const videoMd = await fsp.readFile(path.join(project.dir, 'video.md'), 'utf8').catch(() => null);
    const tastePath = [path.join(project.dir, '.opuscut', 'taste.md'), path.join(project.dir, '..', '.opuscut', 'taste.md')].find(p => fs.existsSync(p));
    return json(res, 200, {
      dir: project.dir, name: project.name, entry: project.entry, timeline, files,
      fuentes: files.filter(f => SOURCE_EXT.has(path.extname(f).toLowerCase())),
      videoMd, gusto: tastePath ? await fsp.readFile(tastePath, 'utf8') : null,
      sonido: fs.existsSync(path.join(project.dir, 'sound.py')),
      chat: { sessionId: chat.sessionId, ocupado: chat.busy },
    });
  }
  if (route === 'fuente') {
    const full = safeJoin(project.dir, url.searchParams.get('file'));
    return json(res, 200, { file: url.searchParams.get('file'), text: await fsp.readFile(full, 'utf8') });
  }
  if (route === 'literal' && method === 'POST') {
    const full = safeJoin(project.dir, data.file);
    const text = await fsp.readFile(full, 'utf8');
    const lines = text.split('\n');
    const line = lines[data.line - 1];
    if (line == null || line.slice(data.col, data.col + data.old.length) !== data.old) return json(res, 409, { error: 'The code changed. Select it again.' });
    lines[data.line - 1] = line.slice(0, data.col) + data.value + line.slice(data.col + data.old.length);
    await fsp.writeFile(full, lines.join('\n'));
    return json(res, 200, { ok: true });
  }
  if (route === 'notas' && method === 'GET') return json(res, 200, await notes());
  if (route === 'notas' && method === 'POST') {
    const list = await notes();
    const id = 'n' + Date.now().toString(36);
    let cuadro = null;
    if (data.imagen) {
      const dir = path.join(dataDir(), 'cuadros');
      await fsp.mkdir(dir, { recursive: true });
      const ext = /^data:image\/jpe?g/.test(data.imagen) ? 'jpg' : /^data:image\/webp/.test(data.imagen) ? 'webp' : 'png';
      cuadro = `.estudio/cuadros/${id}.${ext}`;
      await fsp.writeFile(path.join(project.dir, cuadro), Buffer.from(data.imagen.split(',')[1], 'base64'));
    }
    const nota = { id, estado: 'abierta', creada: new Date().toISOString(), autor: data.autor || 'Sebastián', ...data, imagen: undefined, cuadro };
    list.push(nota);
    await saveNotes(list);
    return json(res, 200, nota);
  }
  if (route.startsWith('notas/') && (method === 'PATCH' || method === 'DELETE')) {
    const id = route.slice(6);
    let list = await notes();
    if (method === 'DELETE') list = list.filter(n => n.id !== id);
    else list = list.map(n => n.id === id ? { ...n, ...data, id } : n);
    await saveNotes(list);
    return json(res, 200, list.find(n => n.id === id) || { ok: true });
  }
  if (route === 'estado' && method === 'GET') return json(res, 200, { proyecto: project.dir, ...live, conectado: [...clients].some(c => c.readyState === 1) });
  if (route === 'ui' && method === 'POST') {
    try { return json(res, 200, await uiRequest(data.cmd, data, data.timeout || 30000)); }
    catch (e) { return json(res, 503, { error: e.message }); }
  }
  if (route === 'audio' && method === 'POST') {
    try { await buildAudio(); return json(res, 200, { ok: true }); }
    catch (e) { return json(res, 500, { error: e.message }); }
  }
  if (route === 'archivos' && method === 'POST') {
    const name = path.basename(decodeURIComponent(req.headers['x-nombre'] || 'archivo'));
    const where = { assets: 'assets', capturas: '.estudio/capturas', adjuntos: '.estudio/adjuntos' }[url.searchParams.get('destino')] || '.estudio/referencias';
    const full = safeJoin(project.dir, `${where}/${name}`);
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, body);
    broadcast({ type: 'archivos' });
    return json(res, 200, { ok: true, file: `${where}/${name}` });
  }
  if (route === 'linea') {
    const tl = await readJson(path.join(project.dir, 'timeline.json'), null);
    const ev = await readJson(path.join(dataDir(), 'audio', 'events.json'), null);
    const conf = await readJson(path.join(dataDir(), 'config.json'), {});
    const et = conf.etiquetas || { pistas: {}, sonidos: {} };
    const pistas = {};
    for (const e of ev?.eventos || []) (pistas[e.bus] ||= { nombre: et.pistas[e.bus] || e.bus, eventos: [] }).eventos.push({ t: e.t, dur: e.dur, ganancia: e.gain, linea: e.line, nombre: et.sonidos[e.line] });
    if (!tl) {
      // Pages without timeline.json: what the editor measured on the page itself.
      const v = live.video || {};
      return json(res, 200, { duracion: live.duracion || ev?.duracion || null, fps: v.fps || null, ancho: v.ancho || null, alto: v.alto || null, modo: v.modo || 'libre', bpm: null, compases: null, escenas: [], silencios: ev?.silencios || [], pistas, sinTimeline: true });
    }
    return json(res, 200, { duracion: tl.beats * 60 / tl.bpm, fps: tl.fps, ancho: tl.width, alto: tl.height, modo: 'opuscut', bpm: tl.bpm, compases: tl.beats / (tl.beats_per_bar || 4), escenas: (tl.scenes || []).map(s => ({ id: s.id, desde: s.from * 60 / tl.bpm, hasta: s.to * 60 / tl.bpm })), silencios: ev?.silencios || [], pistas });
  }
  if (route === 'textos/editar' && method === 'POST') {
    // Changes a visible text by its current value, wherever it is written, if there is exactly one match.
    const want = String(data.actual ?? ''), next = String(data.nuevo ?? '');
    const hits = [];
    for (const f of (await listFiles(project.dir)).filter(f => /\.(html|js|mjs|jsx|ts|tsx)$/i.test(f))) {
      const lines = (await fsp.readFile(path.join(project.dir, f), 'utf8')).split('\n');
      lines.forEach((l, i) => {
        for (const m of l.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) if (m[2] === want && !(m[1] === '`' && m[2].includes('${'))) hits.push({ archivo: f, linea: i + 1, columna: m.index, quote: m[1] });
      });
    }
    const pick = data.linea ? hits.filter(h => h.linea === +data.linea && (!data.archivo || h.archivo === data.archivo)) : hits;
    if (!pick.length) return json(res, 404, { error: `Could not find the text "${want}" written in the code.`, coincidencias: hits });
    if (pick.length > 1) return json(res, 409, { error: 'There are several matches. Say which one with file and line.', coincidencias: pick });
    const h = pick[0], full = path.join(project.dir, h.archivo);
    const lines = (await fsp.readFile(full, 'utf8')).split('\n');
    const esc = next.replaceAll('\\', '\\\\').replaceAll(h.quote, '\\' + h.quote);
    lines[h.linea - 1] = lines[h.linea - 1].slice(0, h.columna) + h.quote + esc + h.quote + lines[h.linea - 1].slice(h.columna + want.length + 2);
    await fsp.writeFile(full, lines.join('\n'));
    return json(res, 200, { ok: true, ...h });
  }
  if (route === 'ruta' && method === 'POST') {
    const ruta = path.resolve(String(data.ruta || '').trim().replace(/^["']|["']$/g, '').replace(/^~(?=[\\/]|$)/, os.homedir()));
    const st = await fsp.stat(ruta).catch(() => null);
    return json(res, 200, st ? { existe: true, ruta, tipo: st.isDirectory() ? 'carpeta' : 'archivo', nombre: path.basename(ruta), tamano: st.size } : { existe: false, ruta });
  }
  if (route === 'adjunto/ruta' && method === 'POST') {
    // A file somewhere on the PC is copied next to the project so Claude and the editor can use it.
    const ruta = path.resolve(String(data.ruta || '').trim().replace(/^["']|["']$/g, ''));
    const st = await fsp.stat(ruta).catch(() => null);
    if (!st || !st.isFile()) return json(res, 404, { error: `Could not find ${ruta}` });
    const dir = path.join(dataDir(), 'adjuntos');
    await fsp.mkdir(dir, { recursive: true });
    const ext = path.extname(ruta), stem = path.basename(ruta, ext);
    let dst = path.join(dir, stem + ext), n = 2;
    while (fs.existsSync(dst)) dst = path.join(dir, `${stem}-${n++}${ext}`);
    await fsp.copyFile(ruta, dst);
    return json(res, 200, { file: path.relative(project.dir, dst).split(path.sep).join('/'), origen: ruta });
  }
  if (route === 'importar' && method === 'POST') {
    // A file from the PC or the web goes into the project: assets for the video, references or attachments for Claude.
    const where = { assets: 'assets', referencias: '.estudio/referencias', adjuntos: '.estudio/adjuntos' }[data.destino] || 'assets';
    const src = String(data.ruta || '').trim().replace(/^["']|["']$/g, '');
    let buf, name;
    if (/^https?:\/\//i.test(src)) {
      const r = await fetch(src, { headers: { 'user-agent': 'Kinora/0.5 (local video editor)' } });
      if (!r.ok) return json(res, 502, { error: `Could not download (${r.status}).` });
      buf = Buffer.from(await r.arrayBuffer());
      name = decodeURIComponent(new URL(src).pathname.split('/').pop() || 'archivo');
    } else {
      const full = path.resolve(src.replace(/^~(?=[\\/]|$)/, os.homedir()));
      const st = await fsp.stat(full).catch(() => null);
      if (!st || !st.isFile()) return json(res, 404, { error: `Could not find ${full}` });
      buf = await fsp.readFile(full);
      name = path.basename(full);
    }
    name = path.basename(data.nombre || name).replace(/[<>:"/\\|?*]+/g, '-') || 'archivo';
    const sub = data.carpeta ? String(data.carpeta).replace(/^[\\/]+|\.\./g, '') : '';
    const dir = safeJoin(project.dir, path.posix.join(where, sub));
    await fsp.mkdir(dir, { recursive: true });
    const ext = path.extname(name), stem = path.basename(name, ext);
    let dst = path.join(dir, name), n = 2;
    while (fs.existsSync(dst)) dst = path.join(dir, `${stem}-${n++}${ext}`);
    await fsp.writeFile(dst, buf);
    broadcast({ type: 'archivos' });
    return json(res, 200, { file: path.relative(project.dir, dst).split(path.sep).join('/'), tamano: buf.length });
  }
  if (route === 'adjunto/video' && method === 'POST') {
    // Claude cannot watch a video, so it gets evenly spaced frames and a contact sheet of the whole clip.
    const full = safeJoin(project.dir, data.file);
    const probe = await new Promise(r => execFile('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', full], { windowsHide: true }, (e, out) => r(e ? null : JSON.parse(out))));
    if (!probe) return json(res, 400, { error: 'Could not read the video.' });
    const dur = +probe.format?.duration || 0, st = probe.streams?.[0] || {};
    const base = full.replace(/\.[^.]+$/, '');
    const dir = `${base}-cuadros`;
    await fsp.mkdir(dir, { recursive: true });
    const n = dur > 30 ? 12 : dur > 8 ? 10 : 8;
    const cuadros = [];
    for (let i = 0; i < n; i++) {
      const t = dur * (i + 0.5) / n;
      const out = path.join(dir, `${String(i + 1).padStart(2, '0')}-${t.toFixed(2)}s.jpg`);
      await new Promise(r => execFile('ffmpeg', ['-y', '-loglevel', 'error', '-ss', t.toFixed(3), '-i', full, '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '3', out], { windowsHide: true }, () => r()));
      if (fs.existsSync(out)) cuadros.push({ t: +t.toFixed(2), path: path.relative(project.dir, out).split(path.sep).join('/') });
    }
    const hoja = path.join(dir, 'hoja.jpg');
    const cols = n > 8 ? 4 : 4, rows = Math.ceil(n / cols);
    await new Promise(r => execFile('ffmpeg', ['-y', '-loglevel', 'error', '-i', full, '-vf', `fps=${(n / Math.max(0.1, dur)).toFixed(4)},scale=480:-2,tile=${cols}x${rows}:padding=6:color=black`, '-frames:v', '1', '-q:v', '3', hoja], { windowsHide: true }, () => r()));
    return json(res, 200, { duracion: dur, ancho: st.width, alto: st.height, cuadros, hoja: fs.existsSync(hoja) ? path.relative(project.dir, hoja).split(path.sep).join('/') : null });
  }
  if (route === 'referencias') {
    const dir = path.join(dataDir(), 'referencias');
    const list = await fsp.readdir(dir).catch(() => []);
    return json(res, 200, list.map(f => `.estudio/referencias/${f}`));
  }
  if (route === 'sonidos/buscar') {
    try { return json(res, 200, await searchSounds({ q: url.searchParams.get('q') || '', largo: url.searchParams.get('largo') ?? 'shortest', tipo: url.searchParams.get('tipo') || 'efecto', pagina: +(url.searchParams.get('pagina') || 1) })); }
    catch (e) { return json(res, 502, { error: e.message }); }
  }
  if (route === 'sonidos/proxy') {
    const target = new URL(url.searchParams.get('url'));
    if (!/(^|\.)(freesound\.org|wikimedia\.org|jamendo\.com|incompetech\.com|openverse\.org)$/.test(target.hostname)) return json(res, 403, { error: 'Source not allowed' });
    const r = await fetch(target, { headers: { 'user-agent': 'Kinora/0.5 (local video editor)', ...(req.headers.range ? { range: req.headers.range } : {}) } });
    const headers = { 'content-type': r.headers.get('content-type') || 'audio/mpeg', 'cache-control': 'max-age=86400', 'accept-ranges': 'bytes' };
    for (const h of ['content-length', 'content-range']) if (r.headers.get(h)) headers[h] = r.headers.get(h);
    res.writeHead(r.status, headers);
    const reader = r.body.getReader();
    for (;;) { const { done, value } = await reader.read(); if (done) break; res.write(value); }
    res.end();
    return;
  }
  if (route === 'sonidos/recomendados') {
    try { return json(res, 200, await recommendSounds({ tipo: url.searchParams.get('tipo') || 'efecto', largo: url.searchParams.get('largo') || null })); } catch (e) { return json(res, 502, { error: e.message }); }
  }
  if (route === 'sonidos/bajar' && method === 'POST') {
    try { return json(res, 200, await downloadSound(data)); } catch (e) { return json(res, 500, { error: e.message }); }
  }
  if (route === 'generar' && method === 'POST') {
    try { return json(res, 200, await generateImage(data)); } catch (e) { return json(res, 500, { error: e.message }); }
  }
  if (route === 'exportar' && method === 'POST') {
    try { return json(res, 200, await exporter.start(data || {})); } catch (e) { return json(res, 409, { error: e.message }); }
  }
  if (route === 'exportar/cancelar' && method === 'POST') { exporter.cancel(); return json(res, 200, { ok: true }); }
  if (route === 'exportar/estado') return json(res, 200, exporter.state());
  if (route === 'exportar/historial') return json(res, 200, await exporter.history());
  if (route === 'exportar/abrir' && method === 'POST') {
    if (!(await exporter.known(data.ruta))) return json(res, 403, { error: 'Unknown path' });
    if (data.carpeta) spawn('explorer', ['/select,', data.ruta], { detached: true }).unref();
    else spawn('cmd', ['/c', 'start', '', data.ruta], { detached: true, windowsHide: true }).unref();
    return json(res, 200, { ok: true });
  }
  if (route === 'exportar/archivo') {
    const ruta = url.searchParams.get('ruta');
    if (!(await exporter.known(ruta))) { res.writeHead(403); res.end(); return; }
    const st = await fsp.stat(ruta);
    const ext = path.extname(ruta).toLowerCase();
    const headers = { 'content-type': MIME[ext] || 'application/octet-stream', 'accept-ranges': 'bytes' };
    const range = req.headers.range;
    if (range) {
      const [x, y] = range.slice(6).split('-'); const start = +x || 0, end = y ? +y : st.size - 1;
      res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': end - start + 1 });
      fs.createReadStream(ruta, { start, end }).pipe(res); return;
    }
    res.writeHead(200, { ...headers, 'content-length': st.size }); fs.createReadStream(ruta).pipe(res); return;
  }
  if (route === 'chat' && method === 'POST') { startChat(data.texto, data.modelo, data.adjuntos || [], data.contexto || null); return json(res, 200, { ok: true }); }
  if (route === 'chat/vivo') return json(res, 200, chat.busy ? chat.live : null);
  if (route === 'pregunta' && method === 'POST') {
    // Claude asks through the MCP; the request waits here until you answer in the chat.
    const id = 'q' + Date.now().toString(36);
    const q = { id, pregunta: data.pregunta, opciones: data.opciones || [], multiple: !!data.multiple, t: Date.now() };
    if (chat.live) { chat.live.pregunta = q; chat.live.estado = { tipo: 'esperando' }; }
    broadcast({ type: 'chat', evento: { tipo: 'pregunta', ...q } });
    const answer = await new Promise(resolve => {
      preguntas.set(id, resolve);
      setTimeout(() => { if (preguntas.has(id)) { preguntas.delete(id); resolve(null); } }, 30 * 60e3);
    });
    if (chat.live) { chat.live.pregunta = null; chat.live.estado = { tipo: 'pensando' }; }
    broadcast({ type: 'chat', evento: { tipo: 'respondida', id, respuesta: answer } });
    await appendHistory({ tipo: 'pregunta', ...q, respuesta: answer, t: Date.now() });
    return json(res, 200, answer == null ? { sinRespuesta: true } : { respuesta: answer });
  }
  if (route === 'pregunta/responder' && method === 'POST') {
    const resolve = preguntas.get(data.id);
    if (!resolve) return json(res, 404, { error: 'That question is no longer open.' });
    preguntas.delete(data.id); resolve(data.respuesta);
    return json(res, 200, { ok: true });
  }
  if (route === 'chat/parar' && method === 'POST') {
    if (chat.proc) {
      chat.stopped = true;
      if (process.platform === 'win32') execFile('taskkill', ['/pid', String(chat.proc.pid), '/T', '/F'], { windowsHide: true }, () => { });
      else chat.proc.kill('SIGTERM');
    }
    return json(res, 200, { ok: true });
  }
  if (route === 'chat/nuevo' && method === 'POST') { chat.sessionId = null; await writeJson(path.join(dataDir(), 'chat.json'), {}); await writeJson(path.join(dataDir(), 'mensajes.json'), []); broadcast({ type: 'chat', evento: { tipo: 'nuevo' } }); return json(res, 200, { ok: true }); }
  if (route === 'chat/historial') return json(res, 200, await readJson(path.join(dataDir(), 'mensajes.json'), []));
  return json(res, 404, { error: 'not found' });
}

const MODELOS = { opus: 'claude-opus-5-5', fable: 'claude-fable-5-1', sonnet: 'claude-sonnet-5-5' };

async function appendHistory(entry) {
  const file = path.join(dataDir(), 'mensajes.json');
  const list = await readJson(file, []);
  list.push(entry);
  await writeJson(file, list);
}

async function startChat(texto, modelo = 'opus', adjuntos = [], ctxData = null) {
  if (chat.busy) { broadcast({ type: 'chat', evento: { tipo: 'error', texto: 'Claude is still working.' } }); return; }
  chat.busy = true;
  chatRun++;
  // What you wrote is kept clean; the editor context only travels to Claude.
  const user = { tipo: 'usuario', texto, adjuntos, contexto: ctxData, t: Date.now() };
  chat.live = { inicio: Date.now(), modelo, texto: '', herramientas: [], estado: { tipo: 'pensando' }, tokens: 0, pregunta: null };
  await appendHistory(user);
  broadcast({ type: 'chat', evento: user });

  const mcpConfig = path.join(dataDir(), 'mcp.json');
  await writeJson(mcpConfig, { mcpServers: { kinora: { command: process.execPath, args: [path.join(HERE, globalThis.KINORA_BUNDLE ? 'kinora-mcp.js' : 'mcp.js')], env: { ESTUDIO_URL: `http://127.0.0.1:${PORT}` } } } });
  const skill = await fsp.readFile(path.join(ROOT, 'skills', 'kinora', 'SKILL.md'), 'utf8').catch(() => '');
  const skills = (await activeSkills()).filter(x => x.activa && !x.fija);
  const contexto = [
    skill.replace(/^---[\s\S]*?---\s*/, ''),
    skills.length ? `\n## Active skills in this project\n${skills.map(x => `- ${x.name}: ${x.description} Read ${path.join(x.dir, 'SKILL.md')} before using it.`).join('\n')}` : '',
    `\n## Current session\nProject: ${project.dir}\nThe editor is open. What you see with the kinora tools is what the user sees right now. Reply in the language the user writes in, briefly.`,
  ].join('\n');
  const argv = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--model', MODELOS[modelo] || modelo, '--mcp-config', mcpConfig, '--strict-mcp-config', '--append-system-prompt', contexto,
    '--permission-mode', 'acceptEdits',
    '--allowedTools', 'mcp__kinora', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash(python:*)', 'Bash(ffmpeg:*)', 'Bash(ffprobe:*)', 'Bash(node:*)', 'Bash(ls:*)'];
  for (const x of skills) argv.push('--add-dir', x.dir);
  // Paths on the PC mentioned in the message or attached as folders become readable for Claude, like in the terminal.
  const extra = new Set();
  for (const m of texto.matchAll(/(?:[A-Za-z]:[\\/]|\\\\)[^\s"'<>|*?]+/g)) {
    const p = m[0].replace(/[.,;:)\]]+$/, '');
    const st = await fsp.stat(p).catch(() => null);
    if (st) extra.add(st.isDirectory() ? p : path.dirname(p));
  }
  for (const a of adjuntos) if (a && typeof a === 'object' && a.tipo === 'carpeta' && a.ruta) extra.add(a.ruta);
  for (const d of extra) if (!d.startsWith(project.dir)) argv.push('--add-dir', d);
  if (chat.sessionId) argv.push('--resume', chat.sessionId);
  let prompt = texto + (ctxData ? `\n\n[Editor context: ${JSON.stringify(ctxData)}]` : '');
  if (adjuntos.length) {
    const lines = adjuntos.map(a => {
      if (typeof a === 'string') return `- ${a}: look at it with Read.`;
      if (a.tipo === 'imagen') return `- Image ${a.path}: look at it with Read.`;
      if (a.tipo === 'video') return `- Video ${a.path}, ${a.info?.duracion ? a.info.duracion.toFixed(1) + ' s' : ''}${a.info?.ancho ? `, ${a.info.ancho}×${a.info.alto}` : ''}. You cannot play it: use Read on the contact sheet ${a.info?.hoja || ''} and the frames in order (${(a.info?.cuadros || []).map(c => `${c.path} at ${c.t} s`).join(', ')}). If you need more detail, extract frames with ffmpeg.`;
      if (a.tipo === 'audio') return `- Audio ${a.path}: you can measure it with ffprobe or ffmpeg.`;
      if (a.tipo === 'carpeta') return `- Folder ${a.ruta}: you have read access. Explore it with Glob, Grep and Read if needed.`;
      return `- File ${a.path}: read it with Read.`;
    });
    prompt += `\n\nThe user attached (paths relative to the project):\n${lines.join('\n')}`;
  }

  const proc = spawn(process.env.CLAUDE_BIN || 'claude', argv, { cwd: project.dir, windowsHide: true, env: { ...process.env, ESTUDIO_URL: `http://127.0.0.1:${PORT}`, MCP_TOOL_TIMEOUT: '1900000' } });
  chat.proc = proc;
  proc.stdin.end(prompt);
  let buf = '', texto_ = '', herramientas = [], msgId = 'm0';
  const tokensBy = new Map();
  const setState = st => {
    if (!chat.live) return;
    if (st) chat.live.estado = st;
    chat.live.tokens = [...tokensBy.values()].reduce((a, b) => a + b, 0);
    broadcast({ type: 'chat', evento: { tipo: 'estado', estado: chat.live.estado, tokens: chat.live.tokens } });
  };
  broadcast({ type: 'chat', evento: { tipo: 'inicio', modelo } });
  proc.stdout.on('data', chunk => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      if (ev.type === 'system' && ev.subtype === 'init' && ev.session_id) chat.sessionId = ev.session_id;
      // What Claude is doing right now, like the status line of the terminal.
      if (ev.type === 'stream_event') {
        const e = ev.event || {};
        if (e.type === 'content_block_start') {
          const b = e.content_block || {};
          if (b.type === 'thinking' || b.type === 'redacted_thinking') setState({ tipo: 'pensando' });
          else if (b.type === 'text') setState({ tipo: 'escribiendo' });
          else if (b.type === 'tool_use') setState({ tipo: 'herramienta', nombre: b.name });
        }
        if (e.type === 'message_start' && e.message?.id) msgId = e.message.id;
        if (e.type === 'message_delta' && e.usage?.output_tokens != null) { tokensBy.set(msgId, e.usage.output_tokens); setState(null); }
      }
      if (ev.type === 'user' && (ev.message?.content || []).some(c => c.type === 'tool_result')) setState({ tipo: 'pensando' });
      if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') {
        if (chat.live) chat.live.texto += ev.event.delta.text;
        broadcast({ type: 'chat', evento: { tipo: 'delta', texto: ev.event.delta.text } });
      }
      if (ev.type === 'assistant') {
        for (const block of ev.message?.content || []) {
          if (block.type === 'text') { texto_ += (texto_ ? '\n\n' : '') + block.text; if (chat.live) chat.live.texto = texto_ + '\n\n'; broadcast({ type: 'chat', evento: { tipo: 'texto', texto: block.text } }); }
          if (block.type === 'tool_use') {
            const h = { nombre: block.name, entrada: block.input };
            setState({ tipo: 'herramienta', nombre: block.name, entrada: block.input });
            herramientas.push(h);
            if (chat.live) chat.live.herramientas = herramientas.slice();
            broadcast({ type: 'chat', evento: { tipo: 'herramienta', ...h } });
          }
        }
      }
      if (ev.type === 'result') {
        broadcast({ type: 'chat', evento: { tipo: 'costo', usd: ev.total_cost_usd, ms: ev.duration_ms, turnos: ev.num_turns } });
        // The turn is over once the result arrives; the process can take minutes to exit while its MCP servers shut down.
        finish(ev.is_error ? 1 : 0, ev.is_error ? String(ev.result || '') : '');
        setTimeout(() => { if (proc.exitCode === null) { if (process.platform === 'win32') execFile('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true }, () => { }); else proc.kill(); } }, 3000);
      }
    }
  });
  let err = '';
  proc.stderr.on('data', c => { err += c.toString('utf8'); });
  let finished = false;
  const finish = async (code, why = '') => {
    if (finished) return;
    finished = true;
    const stopped = chat.stopped; chat.stopped = false;
    chat.busy = false; chat.proc = null; chat.live = null;
    for (const [id, resolve] of preguntas) { preguntas.delete(id); resolve(null); }
    await writeJson(path.join(dataDir(), 'chat.json'), { sessionId: chat.sessionId });
    const fin = { tipo: 'claude', texto: texto_, herramientas, t: Date.now(), detenido: stopped || undefined, error: !stopped && code ? (why || err.trim().split('\n').slice(-3).join('\n') || `exited with ${code}`) : null };
    await appendHistory(fin);
    broadcast({ type: 'chat', evento: { ...fin, tipo: 'fin' } });
  };
  proc.on('close', code => finish(code));
}

async function main() {
  const target = positional[0] || process.env.ESTUDIO_PROYECTO;
  if (target) await openProject(target).catch(e => console.warn(e.message));

  let vite = null;
  if (!PROD || !fs.existsSync(path.join(ROOT, 'ui', 'dist', 'index.html'))) {
    const { createServer } = await import('vite');
    vite = await createServer({ root: path.join(ROOT, 'ui'), configFile: path.join(ROOT, 'ui', 'vite.config.js'), server: { middlewareMode: true, hmr: { port: PORT + 1 } }, appType: 'spa' });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname === '/__estudio/probe.js') {
        res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' });
        res.end(await fsp.readFile(path.join(HERE, 'probe.js')));
        return;
      }
      if (url.pathname === '/llms.txt' || url.pathname === '/AGENTS.md') {
        res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
        res.end(await fsp.readFile(path.join(ROOT, url.pathname === '/llms.txt' ? 'llms.txt' : 'AGENTS.md')).catch(() => ''));
        return;
      }
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (url.pathname.startsWith('/proyecto/')) {
        if (!project) { res.writeHead(404); res.end(); return; }
        return await serveProject(req, res, url.pathname.slice('/proyecto/'.length));
      }
      if (vite) return vite.middlewares(req, res);
      const file = safeJoin(path.join(ROOT, 'ui', 'dist'), url.pathname === '/' ? 'index.html' : url.pathname);
      const ok = fs.existsSync(file) && fs.statSync(file).isFile();
      const f = ok ? file : path.join(ROOT, 'ui', 'dist', 'index.html');
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    } catch (e) {
      console.error(e);
      json(res, 500, { error: e.message });
    }
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', ws => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
    ws.on('message', raw => {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      if (msg.type === 'estado') live = { ...live, ...msg.estado, actualizado: Date.now() };
      if (msg.type === 'respuesta' && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.data);
      }
    });
  });

  server.listen(PORT, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${PORT}`;
    console.log(`Kinora at ${url}`);
    if (OPEN) spawn('cmd', ['/c', 'start', '', url], { detached: true, windowsHide: true }).unref();
  });
}

main();
