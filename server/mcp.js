#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.ESTUDIO_URL || 'http://127.0.0.1:4870';

async function call(route, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api/${route}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const matches = data.coincidencias?.length ? `\nMatches: ${data.coincidencias.map(c => `${c.archivo}:${c.linea} (column ${c.columna})`).join(', ')}` : '';
    throw new Error((data.error || `${res.status} ${res.statusText}`) + matches);
  }
  return data;
}
const ui = (cmd, args = {}) => call('ui', { method: 'POST', body: { cmd, ...args } });
const up = async () => { try { await fetch(`${BASE}/api/recientes`); return true; } catch { return false; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const text = value => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });
const image = (dataUrl, caption) => {
  const [head, b64] = dataUrl.split(',');
  return [{ type: 'image', data: b64, mimeType: head.slice(5, head.indexOf(';')) }, ...(caption ? [{ type: 'text', text: caption }] : [])];
};
const mimeOf = buf => buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg' : buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png' : buf.slice(8, 12).toString() === 'WEBP' ? 'image/webp' : buf.slice(0, 3).toString() === 'GIF' ? 'image/gif' : 'image/png';
const guard = fn => async args => {
  try { return await fn(args || {}); }
  catch (e) { return { isError: true, content: [{ type: 'text', text: e.message.includes('fetch failed') ? 'The editor is not running. Use the open tool with the video folder.' : e.message }] }; }
};

// A smaller JPEG for the model to look at; the full file stays in the project.
function preview(file, max = 768) {
  return new Promise(resolve => execFile('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale='min(${max},iw)':-2`, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-q:v', '4', '-'], { encoding: 'buffer', maxBuffer: 1 << 26, windowsHide: true }, (err, out) => resolve(err || !out?.length ? null : out)));
}

function openBrowser(url) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

let projectDir = null;
async function project() {
  if (!projectDir) projectDir = (await call('estado')).proyecto;
  return projectDir;
}
const fileCache = new Map();
async function readLines(rel) {
  const dir = await project();
  if (!fileCache.has(rel)) fileCache.set(rel, fs.readFile(path.join(dir, rel), 'utf8').then(s => s.split('\n')).catch(() => []));
  return fileCache.get(rel);
}
async function sourceLines(frames) {
  fileCache.clear();
  const out = [];
  for (const f of frames.slice(0, 6)) {
    const m = f.match(/^(.*) \((.+):(\d+)\)$/);
    if (!m) { out.push(f); continue; }
    const lines = await readLines(m[2]);
    out.push(`${m[1]}  ${m[2]}:${m[3]}  │ ${(lines[+m[3] - 1] || '').trim()}`);
  }
  return out;
}

// Literals in one line of code, like the inspector reads them: numbers, strings and colors with their 0-based column.
const TOKEN = /(\/\/.*$)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|((?<![\w$.#])-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?![\w$]))/gi;
function literals(line) {
  const out = [];
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line))) {
    if (m[1]) break;
    if (m[2]) {
      const inner = m[2].slice(1, -1);
      out.push({ kind: /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(inner) ? 'color' : /^rgba?\(/i.test(inner) ? 'rgba' : 'text', col: m.index, text: m[2], value: inner });
    } else if (m[3]) {
      let col = m.index, txt = m[3];
      if (txt.startsWith('-') && /[\w$)\]]\s*$/.test(line.slice(0, col))) { col++; txt = txt.slice(1); }
      out.push({ kind: 'number', col, text: txt, value: parseFloat(txt) });
    }
  }
  return out;
}
const formatNumber = (v, like) => { const dec = like.includes('.') ? Math.max(1, like.split('.')[1].length) : 0; return dec ? v.toFixed(dec) : String(Math.round(v)); };
function callAt(line, col) {
  const before = line.slice(0, col);
  const assign = before.match(/([A-Za-z_$][\w$.]*)\s*[:=]\s*$/);
  if (assign) return { name: assign[1].split('.').pop() };
  let depth = 0, commas = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    const ch = before[i];
    if (ch === ')' || ch === ']') depth++;
    else if (ch === '(' || ch === '[') {
      if (depth === 0) {
        const fn = before.slice(0, i).match(/([A-Za-z_$][\w$]*)\s*$/);
        let d = 0, n = 1;
        for (let j = i + 1; j < line.length; j++) {
          const c = line[j];
          if (c === '(' || c === '[') d++;
          else if (c === ')' || c === ']') { if (d === 0) break; d--; } else if (c === ',' && d === 0) n++;
        }
        return { fn: fn?.[1] || null, arg: commas + 1, args: n };
      }
      depth--;
    } else if (ch === ',' && depth === 0) commas++;
  }
  return {};
}
const XY_ARGS = { fillText: [2, 3], strokeText: [2, 3], fillRect: [1, 2], strokeRect: [1, 2], clearRect: [1, 2], rect: [1, 2], roundRect: [1, 2], translate: [1, 2], moveTo: [1, 2], lineTo: [1, 2], arc: [1, 2], ellipse: [1, 2], arcTo: [1, 2], setTransform: [5, 6] };
const axisOfName = n => /^(x|x0|cx|px|left|posX|startX|offsetX|dx)$/i.test(n) ? 'x' : /^(y|y0|cy|py|top|posY|startY|offsetY|dy)$/i.test(n) ? 'y' : null;
async function paramNames(fn, files) {
  const re = new RegExp(`function\\s+${fn}\\s*\\(([^)]*)\\)|\\b${fn}\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*=>|\\b${fn}\\s*\\(([^)]*)\\)\\s*\\{`);
  for (const f of files) {
    for (const l of await readLines(f)) {
      const m = l.match(re);
      if (m) return (m[1] ?? m[2] ?? m[3]).split(',').map(p => p.trim().replace(/[=\s].*$/, '').replace(/^\.\.\./, ''));
    }
  }
  return null;
}

const KIND = { texto: 'text', imagen: 'image', 'rectángulo': 'rectangle', relleno: 'fill', trazo: 'stroke', 'píxeles': 'pixels' };
const elementOut = d => ({
  id: d.id ? d.id.replace(/^[^@]+/, KIND[d.kind] || d.kind) : undefined, z: d.i, kind: KIND[d.kind] || d.kind, what: d.que, box: d.caja,
  text: d.texto, image: d.imagen, color: d.color, font: d.fuente, alpha: d.alpha, blend: d.blend && d.blend !== 'source-over' ? d.blend : undefined, line_width: d.ancho, chain: d.cadena,
});
const selectionOut = s => s && ({
  t: s.t, x: s.x, y: s.y, what: s.que, box: s.caja, chain: s.cadena, text: s.texto, image: s.imagen, color: s.color, font: s.fuente,
  level: s.nivel, level_function: s.funcion_nivel, level_box: s.caja_nivel, element: s.elemento ? elementOut(s.elemento) : undefined,
  selected_text: s.texto_seleccionado && { file: s.texto_seleccionado.archivo, line: s.texto_seleccionado.linea, column: s.texto_seleccionado.columna, text: s.texto_seleccionado.texto },
});
const TOOL_IN = { inspect: 'inspeccionar', point_note: 'punto', zone_note: 'zona' };
const TOOL_OUT = Object.fromEntries(Object.entries(TOOL_IN).map(([a, b]) => [b, a]));
const PANEL_IN = { inspector: 'inspector', notes: 'notas', chat: 'claude' };
const PANEL_OUT = Object.fromEntries(Object.entries(PANEL_IN).map(([a, b]) => [b, a]));
const PLAYER_IN = { docked: 'dock', floating: 'flotante', mini: 'mini' };
const PLAYER_OUT = Object.fromEntries(Object.entries(PLAYER_IN).map(([a, b]) => [b, a]));
const viewOut = v => v && ({
  right_panel: PANEL_OUT[v.panel] || v.panel, zoom: v.zoom, tool: v.herramienta ? TOOL_OUT[v.herramienta] || v.herramienta : undefined, code_file: v.archivo_codigo,
  center_tab: v.pestana === 'mapa' ? 'code' : 'video', panels: v.paneles && { files: v.paneles.left, right: v.paneles.right, timeline: v.paneles.timeline },
  video_only: v.foco, player: PLAYER_OUT[v.reproductor] || v.reproductor, loop: v.bucle, master_volume: v.volumen, master_muted: v.silencio,
  tracks: v.pistas,
});
const NOTE_TYPE = { punto: 'point', zona: 'zone', tramo: 'range', mover: 'move', imagen: 'image' };
const NOTE_STATUS = { abierta: 'open', 'en curso': 'in_progress', resuelta: 'solved' };
const STATUS_IN = { open: 'abierta', in_progress: 'en curso', solved: 'resuelta' };
const noteOut = n => ({
  id: n.id, status: NOTE_STATUS[n.estado] || n.estado, type: NOTE_TYPE[n.tipo] || n.tipo, author: n.autor === 'claude' ? 'agent' : 'user', created: n.creada,
  t: n.t, t1: n.t1, x: n.x, y: n.y, w: n.w, h: n.h, text: n.texto, reply: n.respuesta,
  element: n.elemento, what: n.que, origin: n.origen, level: n.nivel,
  dx: n.dx, dy: n.dy, scope: n.alcance ? (n.alcance === 'solo' ? 'only_at_t' : 'whole_path') : undefined, file: n.archivo,
  sound: n.sonido, frame_image: n.cuadro,
});
const JOB_STATE = { exportando: 'running', listo: 'done', error: 'error', cancelado: 'canceled' };
const STAGE = { imagen: 'picture', sonido: 'sound', formato: 'format', guardado: 'saving' };
const OPTION = { formato: 'format', calidad: 'quality', ancho: 'width', alto: 'height', ajuste: 'fit', fondo: 'pad_color', desde: 'from', hasta: 'to', destino: 'destination', nombre: 'name' };
const OPTION_VALUE = { cuadro: 'frame', alta: 'high', media: 'medium', liviana: 'light', encajar: 'fit', recortar: 'crop', proyecto: 'project', descargas: 'downloads' };
const optionsOut = o => o && Object.fromEntries(Object.entries(o).map(([k, val]) => [OPTION[k] || k, OPTION_VALUE[val] || val]));
const jobOut = j => j && ({
  id: j.id, state: JOB_STATE[j.estado] || j.estado, stage: STAGE[j.etapa] || j.etapa, stages: j.etapas?.map(x => STAGE[x] || x), options: optionsOut(j.opciones), progress: j.pct, stage_progress: j.etapaPct, frames: j.cuadros, total_frames: j.total,
  frames_per_second: j.velocidad, seconds_left: j.restante, result: j.resultado && resultOut(j.resultado), error: j.error, log: j.log,
});
const resultOut = r => ({ path: r.ruta, project_path: r.rel, name: r.nombre, size_bytes: r.tamano, is_folder: r.carpeta, format: r.formato === 'cuadro' ? 'frame' : r.formato, seconds: r.segundos, date: r.fecha });

const pxNote = 'x, y, w, h are VIDEO pixels (the page canvas size, origin top-left), not pixels of the images returned by get_frame.';

const server = new McpServer({ name: 'kinora', version: '0.5.0' }, {
  instructions: [
    'Kinora: a live motion video editor where the video is code. What these tools return is exactly what the user is seeing in the editor, and tools that look at a time move the user\'s playhead there unless they say otherwise.',
    'Conventions: times are seconds from the start of the video. Positions and boxes are video pixels (the canvas size reported by status and get_frame, origin top-left). Images from get_frame and contact_sheet are scaled; their caption gives the factor. Code locations use 1-based lines and 0-based columns, project-relative paths.',
    'Typical flow: status, then get_frame or contact_sheet to see, list_elements or find_element to know what is where, inspect_point or element_literals to get to the code, edit_literal / edit_text / set_text_style or a direct file edit to change it, then get_frame to check. Saving a file reloads the editor; never restart it.',
    'Tools that need the editor tab (frames, elements, inspection, playback, view) fail if no browser tab is connected: call open without arguments to open one.',
  ].join('\n'),
});

server.registerTool('open', {
  description: 'Opens a video folder in the editor and makes sure a browser tab shows it, starting the editor if it is not running. Without folder it only opens the editor tab on the current project: use that when another tool says no browser tab is connected.',
  inputSchema: { folder: z.string().optional().describe('Absolute path of the video folder (an index.html with window.renderFrame, or any animated canvas page). Omit to keep the current project.') },
}, guard(async ({ folder }) => {
  if (!(await up())) {
    if (!folder) throw new Error('The editor is not running. Pass the video folder to start it.');
    const port = new URL(BASE).port || '4870';
    const cfg = JSON.parse(await fs.readFile(path.join(os.homedir(), '.estudio', 'config.json'), 'utf8').catch(() => '{}'));
    const entry = cfg.raiz ? path.join(cfg.raiz, 'server', 'index.js') : path.join(HERE, globalThis.KINORA_BUNDLE ? 'kinora-server.js' : 'index.js');
    spawn(process.execPath, [entry, folder, '--port', port, '--open'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    for (let i = 0; i < 60 && !(await up()); i++) await sleep(250);
  } else {
    if (folder) await call('abrir', { method: 'POST', body: { dir: folder } });
    const st = await call('estado').catch(() => null);
    if (!st?.conectado) openBrowser(BASE);
  }
  projectDir = null;
  let st = null;
  for (let i = 0; i < 40; i++) {
    st = await call('estado').catch(() => null);
    if (!st || st.conectado) break;
    await sleep(400);
  }
  return text({ url: BASE, project: st?.proyecto || null, browser_tab_connected: !!st?.conectado });
}));

server.registerTool('status', {
  description: 'What the user is looking at now: project, playhead time, playing or not, duration, video size and fps, the active tool, the selected element, open notes count, and the editor view (right panel, zoom, open code file, panels, loop, master volume, track mute/solo).',
}, guard(async () => {
  const s = await call('estado');
  return text({
    project: s.proyecto, t: s.t, playing: s.playing, duration: s.duracion, open_notes: s.notas_abiertas,
    video: s.video && { width: s.video.ancho, height: s.video.alto, fps: s.video.fps, mode: s.video.modo, bpm: s.video.bpm },
    tool: TOOL_OUT[s.herramienta] || s.herramienta, selection: selectionOut(s.seleccion), view: viewOut(s.vista),
    browser_tab_connected: s.conectado, updated_ms_ago: s.actualizado ? Date.now() - s.actualizado : null,
  });
}));

server.registerTool('get_frame', {
  description: 'Image of the frame at time t. Without t, the frame the user has on screen. Moves the user\'s playhead to t unless keep_playhead is true. Can crop a region (zoomed in), and can draw numbered boxes over every element group with a legend, to see what is where.',
  inputSchema: {
    t: z.number().optional().describe('Time in seconds. Omit for the current playhead.'),
    width: z.number().int().min(160).max(3840).optional().describe('Width of the returned image in pixels. Default 1280 for the full frame, or twice the region width (320 to 1280) for a region.'),
    region: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional().describe('Crop in VIDEO pixels (top-left x, y and size) to look at a detail.'),
    boxes: z.boolean().optional().describe('Draw numbered boxes over the element groups (by drawing function) and return the legend. Default false.'),
    keep_playhead: z.boolean().optional().describe('Do not move the user\'s playhead. Default false.'),
  },
}, guard(async ({ t, width, region, boxes, keep_playhead }) => {
  const r = await ui('cuadro', { t, ancho: width, region, cajas: boxes, mantener: keep_playhead });
  const iw = Math.round(r.region.w * r.escala), ih = Math.round(r.region.h * r.escala);
  const inv = +(1 / r.escala).toFixed(4);
  const where = region ? `Region x ${r.region.x}, y ${r.region.y}, ${r.region.w}x${r.region.h} of a ${r.ancho}x${r.alto} px video` : `Video ${r.ancho}x${r.alto} px`;
  let caption = `Frame at ${r.t.toFixed(3)} s. ${where}; image ${iw}x${ih} px. To convert: video x = ${r.region.x} + image x * ${inv}, video y = ${r.region.y} + image y * ${inv}.`;
  if (r.cajas) caption += `\nBoxes (number, function chain, box in video px, z = draw order, higher on top; invisible groups with alpha under 0.02 are left out):\n${r.cajas.map(b => `${b.n}. ${b.funcion}  ${b.origen}  x ${b.caja.x} y ${b.caja.y} w ${b.caja.w} h ${b.caja.h}  z ${b.z}${b.textos.length ? `  texts: ${b.textos.map(x => JSON.stringify(x)).join(', ')}` : ''}${b.imagenes.length ? `  images: ${b.imagenes.join(', ')}` : ''}`).join('\n') || 'none'}`;
  return { content: image(r.imagen, caption) };
}));

server.registerTool('contact_sheet', {
  description: 'One image with evenly spaced frames of the whole video (or a range), each labeled with its time. The quickest way to see what happens across the video. Rendered offscreen: it does not move the user\'s playhead.',
  inputSchema: {
    count: z.number().int().min(1).max(48).optional().describe('Number of frames, default 12'),
    from: z.number().optional().describe('Start of the range in seconds, default 0'),
    to: z.number().optional().describe('End of the range in seconds, default the end of the video'),
    columns: z.number().int().min(1).max(12).optional().describe('Columns of the grid; default depends on the aspect ratio'),
    cell_width: z.number().int().min(120).max(960).optional().describe('Width of each cell in pixels'),
  },
}, guard(async ({ count, from, to, columns, cell_width }) => {
  const r = await ui('hoja', { n: count, desde: from, hasta: to, columnas: columns, ancho_celda: cell_width, timeout: 180000 });
  return { content: image(r.imagen, `Contact sheet of ${r.tiempos.length} frames, ${r.columnas} columns by ${r.filas} rows, left to right then top to bottom. Video ${r.ancho}x${r.alto} px, ${r.duracion.toFixed(2)} s. Times (s): ${r.tiempos.join(', ')}`) };
}));

server.registerTool('list_elements', {
  description: `What is drawn in the frame at t. Mode "groups" (default) groups draw calls by the code function that drew them, with the union box, call count, highest alpha (near 0 means invisible), texts and images. Mode "elements" lists every draw call topmost first, with a stable id (kind@file:line:col of the drawing line, #n for repeats), z (draw order, higher is on top), kind, box, color, font, alpha, text or image and the call chain. ${pxNote} Moves the user's playhead to t.`,
  inputSchema: {
    t: z.number().optional().describe('Time in seconds. Omit for the current playhead.'),
    mode: z.enum(['groups', 'elements']).optional().describe('groups (default) or elements'),
    limit: z.number().int().min(1).max(1000).optional().describe('Maximum items returned. Default 200 groups or 150 elements.'),
    with_source: z.boolean().optional().describe('In elements mode, add the code line of the innermost frame. Default true.'),
  },
}, guard(async ({ t, mode, limit, with_source = true }) => {
  const r = await ui('elementos', { t, modo: mode === 'elements' ? 'elementos' : 'grupos', limite: limit });
  const head = { t: r.t, video_width: r.ancho, video_height: r.alto, total: r.total };
  if (mode !== 'elements') return text({ ...head, groups: r.grupos.map(g => ({ function: g.funcion, origin: g.origen, calls: g.llamadas, z: g.z, max_alpha: g.alpha, box: g.caja, texts: g.textos, images: g.imagenes })) });
  fileCache.clear();
  const out = [];
  for (const d of r.elementos) {
    const e = elementOut(d);
    const f = d.marcos?.[0];
    if (with_source && f) e.source = `${f.file}:${f.line}  │ ${((await readLines(f.file))[f.line - 1] || '').trim()}`;
    out.push(e);
  }
  return text({ ...head, elements: out });
}));

server.registerTool('inspect_point', {
  description: `What is at point (x, y) of the video at time t, topmost first, with each element's call chain and the code line of each frame. ${pxNote} Moves the user's playhead to t and, unless select is false, selects the topmost element in their editor.`,
  inputSchema: {
    x: z.number().describe('Video pixels from the left edge'), y: z.number().describe('Video pixels from the top edge'),
    t: z.number().optional().describe('Time in seconds. Omit for the current playhead.'),
    count: z.number().int().min(1).max(30).optional().describe('How many elements under the point to return, default 6'),
    select: z.boolean().optional().describe('Select the topmost element in the user\'s editor. Default true.'),
  },
}, guard(async ({ x, y, t, count, select }) => {
  const r = await ui('inspeccionar', { x, y, t, cuantos: count, seleccionar: select });
  const under = [];
  for (const d of r.bajo_el_punto) under.push({ ...elementOut(d), chain: await sourceLines(d.cadena) });
  return text({ t: r.t, x, y, video_width: r.ancho, video_height: r.alto, under_point: under });
}));

server.registerTool('select', {
  description: `Selects in the user's editor the element under (x, y) at time t, like clicking it. level picks a function of its call chain (0 is the draw call itself, 1 its caller, and so on), which selects the whole group that function draws. index picks a deeper element under the point (0 is the topmost). clear removes the selection. ${pxNote}`,
  inputSchema: {
    x: z.number().optional().describe('Video pixels from the left edge'), y: z.number().optional().describe('Video pixels from the top edge'),
    t: z.number().optional().describe('Time in seconds. Omit for the current playhead.'),
    level: z.number().int().min(0).optional().describe('Level of the call chain to select, 0 by default'),
    index: z.number().int().min(0).optional().describe('Which element under the point, 0 (topmost) by default'),
    clear: z.boolean().optional().describe('Clear the selection instead'),
  },
}, guard(async ({ x, y, t, level, index, clear }) => {
  if (!clear && (x == null || y == null)) throw new Error('Pass x and y, or clear: true.');
  const r = await ui('seleccionar', { x, y, t, nivel: level, indice: index, limpiar: clear });
  if (clear) return text('Selection cleared.');
  return text({ t: r.t, level: r.nivel, level_function: r.funcion, level_box: r.caja, elements_under_point: r.debajo, element: { ...elementOut(r.elemento), chain: await sourceLines(r.elemento.cadena) } });
}));

server.registerTool('get_selection', {
  description: 'The element or text the user has selected in the editor: what it is, its box in video pixels, the selected level of its call chain, and the code line of each frame.',
}, guard(async () => {
  const r = await ui('seleccion');
  if (!r) return text('The user has nothing selected.');
  const s = selectionOut(r);
  if (s.chain) s.chain = await sourceLines(s.chain);
  if (s.element) delete s.element.chain;
  return text(s);
}));

server.registerTool('element_literals', {
  description: 'The literal values (numbers, colors, texts) written in the code lines that draw the element under (x, y), for each level of its call chain, with file, line (1-based), column (0-based), a label (the variable or "call · #argument") and, when it can tell, the axis it controls. Use it to move or restyle an element by editing one exact value with edit_literal. With dx and/or dy it moves the element directly: it adds them to the single x and y literals of the chosen level and reports what it changed; if that is ambiguous it changes nothing and returns the candidates. Offsets are added to the code numbers as they are, so check with get_frame when the element is drawn inside a scaled or rotated transform, and keep in mind a line inside a loop moves every copy.',
  inputSchema: {
    x: z.number().describe('Video pixels from the left edge'), y: z.number().describe('Video pixels from the top edge'),
    t: z.number().optional().describe('Time in seconds. Omit for the current playhead.'),
    index: z.number().int().min(0).optional().describe('Which element under the point, 0 (topmost) by default'),
    level: z.number().int().min(0).optional().describe('Level of the call chain to move: 0 is the draw call line, 1 the line that calls that function, and so on. Default: the lowest level with clear x and y literals.'),
    dx: z.number().optional().describe('Horizontal offset in video pixels to add (positive moves right)'),
    dy: z.number().optional().describe('Vertical offset in video pixels to add (positive moves down)'),
  },
}, guard(async ({ x, y, t, index = 0, level, dx, dy }) => {
  const r = await ui('inspeccionar', { x, y, t, cuantos: index + 1, seleccionar: false });
  const el = r.bajo_el_punto[index];
  if (!el) throw new Error('Nothing is drawn at that point.');
  fileCache.clear();
  const frames = el.marcos.slice(0, 8);
  const files = [...new Set(frames.map(f => f.file))];
  const levels = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const line = (await readLines(f.file))[f.line - 1] || '';
    const items = [];
    for (const lit of literals(line)) {
      const c = callAt(line, lit.col);
      let axis = null, label = c.name || (c.fn ? `${c.fn} · #${c.arg}` : null);
      if (c.name) axis = axisOfName(c.name);
      else if (c.fn && lit.kind === 'number') {
        let xy = XY_ARGS[c.fn];
        if (c.fn === 'drawImage') xy = c.args >= 9 ? [6, 7] : [2, 3];
        if (xy) axis = c.arg === xy[0] ? 'x' : c.arg === xy[1] ? 'y' : null;
        else if (i > 0 && c.fn === frames[i - 1].fn) {
          const names = await paramNames(c.fn, files);
          const pn = names?.[c.arg - 1];
          if (pn) { label = `${c.fn} · ${pn}`; axis = axisOfName(pn); }
        }
      }
      items.push({ file: f.file, line: f.line, column: lit.col, kind: lit.kind, value: lit.value, text: lit.text, label, axis: axis || undefined });
    }
    levels.push({ level: i, function: f.fn, file: f.file, line: f.line, code: line.trim(), literals: items });
  }
  const result = { t: r.t, element: elementOut(el), levels };
  if (dx == null && dy == null) return text(result);
  const want = [dx ? 'x' : null, dy ? 'y' : null].filter(Boolean);
  const fits = lv => want.every(a => lv.literals.filter(l => l.axis === a && l.kind === 'number').length === 1);
  const lv = level != null ? levels[level] : levels.find(fits);
  if (!lv || !fits(lv)) return text({ moved: false, reason: level != null ? `Level ${level} does not have exactly one x and one y literal for that move.` : 'No level of the call chain has a single literal for each axis. Pick the values from the list and use edit_literal.', ...result });
  const edits = want.map(a => { const l = lv.literals.find(q => q.axis === a && q.kind === 'number'); const d = a === 'x' ? dx : dy; return { file: l.file, line: l.line, col: l.column, old: l.text, value: formatNumber(l.value + d, l.text) }; }).sort((a, b) => b.col - a.col);
  for (const e of edits) await call('literal', { method: 'POST', body: e });
  return text({ moved: true, level: lv.level, function: lv.function, changes: edits.map(e => ({ file: e.file, line: e.line, column: e.col, from: e.old, to: e.value })), note: 'Check the result with get_frame; undo reverts it.' });
}));

server.registerTool('find_element', {
  description: 'Finds when and where something appears across the whole video: a visible text (substring, case-insensitive), a code function by name (exact or substring), or an image file name. Returns each match with its time ranges, the box at its middle time and the union box (video pixels), and the code location. Walks the video offscreen without moving the user\'s playhead; it can take several seconds.',
  inputSchema: {
    text: z.string().optional().describe('Text to find in what is drawn'),
    function: z.string().optional().describe('Name of a drawing function in the code'),
    image: z.string().optional().describe('Part of an image file name that is drawn'),
    step: z.number().min(0.02).optional().describe('Sampling step in seconds. Default: duration / 120, at least 0.1.'),
    limit: z.number().int().min(1).max(200).optional().describe('Maximum matches, default 30'),
  },
}, guard(async ({ text: q, function: fn, image: img, step, limit }) => {
  const r = await ui('buscar', { texto: q, funcion: fn, imagen: img, paso: step, limite: limit, timeout: 300000 });
  return text({
    step: r.paso, duration: r.duracion, total: r.total,
    matches: r.resultados.map(m => ({ kind: m.tipo === 'texto' ? 'text' : m.tipo === 'imagen' ? 'image' : 'function', text: m.texto, image: m.imagen, function: m.funcion, origin: m.origen, shows: m.aparece, mid_t: m.t_medio, box_at_mid: m.caja_medio, box_union: m.caja_total })),
  });
}));

server.registerTool('list_notes', {
  description: 'The notes the user left on the video: type (point, zone, range, move or image), time, position in video pixels, text, the code element it marked with its origin lines, and the image of the frame with the mark. Type "move" carries dx, dy in video pixels and scope (whole_path or only_at_t); type "image" carries the asset file, its box and the range t to t1.',
  inputSchema: { include_solved: z.boolean().optional().describe('Include solved notes. Default false.'), images: z.boolean().optional().describe('Attach the image of each note. Default true.') },
}, guard(async ({ include_solved, images = true }) => {
  const dir = await project();
  const list = (await call('notas')).filter(n => include_solved || n.estado !== 'resuelta');
  if (!list.length) return text('There are no open notes.');
  const content = [];
  for (const n of list) {
    const o = noteOut(n);
    if (n.origen) o.origin = await sourceLines(n.origen.map((x, i) => `${(n.elemento || '').split(' ← ')[i] || ''} (${x})`));
    content.push({ type: 'text', text: JSON.stringify(o, null, 2) });
    if (images && n.cuadro) {
      const buf = await fs.readFile(path.join(dir, n.cuadro)).catch(() => null);
      if (buf) content.push({ type: 'image', data: buf.toString('base64'), mimeType: mimeOf(buf) });
    }
  }
  return { content };
}));

server.registerTool('resolve_note', {
  description: 'Answers a note and changes its status. Use in_progress when you start on it and solved once the change is done and checked.',
  inputSchema: {
    id: z.string().describe('Note id from list_notes'),
    reply: z.string().describe('What you did, in one or two sentences'),
    status: z.enum(['in_progress', 'solved', 'open']).optional().describe('Default solved'),
  },
}, guard(async ({ id, reply, status = 'solved' }) => text(noteOut(await call(`notas/${id}`, { method: 'PATCH', body: { respuesta: reply, estado: STATUS_IN[status] } })))));

server.registerTool('add_note', {
  description: `Leaves your own note on the video for the user: a question, a proposal or something to review. A point with x, y; a zone with x, y, w, h; a range with t and t1. ${pxNote} It can link the element under the point (or the zone center) and a sound.py line, so the note shows what it is about. Moves the user's playhead to t.`,
  inputSchema: {
    t: z.number().describe('Time in seconds'), text: z.string().describe('The note'),
    x: z.number().optional(), y: z.number().optional(), w: z.number().optional(), h: z.number().optional(),
    t1: z.number().optional().describe('End of the range in seconds, for a range note'),
    link_element: z.boolean().optional().describe('Attach the element under the point or zone center. Default true when x and y are given.'),
    sound_line: z.number().int().optional().describe('Attach the sound at this sound.py line (1-based)'),
  },
}, guard(async ({ t, text: texto, x, y, w, h, t1, link_element, sound_line }) => {
  const tipo = t1 != null ? 'tramo' : w != null ? 'zona' : x != null ? 'punto' : 'tramo';
  const body = { tipo, t, t1: tipo === 'tramo' ? t1 ?? t + 0.5 : undefined, x, y, w, h, texto, autor: 'claude' };
  if (x != null && y != null && link_element !== false) {
    const px = w != null ? x + w / 2 : x, py = h != null ? y + h / 2 : y;
    const r = await ui('inspeccionar', { x: px, y: py, t, cuantos: 1, seleccionar: false }).catch(() => null);
    const el = r?.bajo_el_punto?.[0];
    if (el) Object.assign(body, { elemento: el.marcos.map(f => f.fn).join(' ← '), origen: el.marcos.map(f => `${f.file}:${f.line}`).slice(0, 4), que: el.que });
  }
  if (sound_line) {
    const dir = await project();
    const ev = JSON.parse(await fs.readFile(path.join(dir, '.estudio', 'audio', 'events.json'), 'utf8').catch(() => '{}'));
    const e = (ev.eventos || []).find(e => e.line === sound_line);
    const code = ((await fs.readFile(path.join(dir, 'sound.py'), 'utf8').catch(() => '')).split('\n')[sound_line - 1] || '').trim();
    Object.assign(body, { elemento: `sound ${e?.bus || ''}`.trim(), origen: [`sound.py:${sound_line}`], que: code, ...(e ? { sonido: { t: e.t, dur: e.dur, bus: e.bus, line: e.line } } : {}) });
  }
  try { body.imagen = (await ui('cuadro', { t, ancho: 1280, marca: tipo === 'tramo' ? undefined : { x, y, w, h } })).imagen; } catch { }
  return text(noteOut(await call('notas', { method: 'POST', body })));
}));

server.registerTool('delete_note', {
  description: 'Deletes a note for good. To close a note that was handled, use resolve_note instead.',
  inputSchema: { id: z.string().describe('Note id from list_notes') },
}, guard(async ({ id }) => { await call(`notas/${id}`, { method: 'DELETE' }); return text(`Deleted note ${id}.`); }));

server.registerTool('highlight', {
  description: `Moves the user's playhead to t and highlights a point (x, y) or a zone (x, y, w, h) with a label for a few seconds. Use it to point something out while you explain. ${pxNote}`,
  inputSchema: {
    t: z.number().describe('Time in seconds'), text: z.string().optional().describe('Label shown next to the highlight'),
    x: z.number().optional(), y: z.number().optional(), w: z.number().optional(), h: z.number().optional(),
    seconds: z.number().optional().describe('How long it stays, default 6'),
  },
}, guard(async ({ t, text: texto, x, y, w, h, seconds }) => { await ui('mostrar', { t, texto, x, y, w, h, segundos: seconds }); return text('Highlighted.'); }));

server.registerTool('seek', {
  description: 'Moves the editor playhead to time t (it snaps to the nearest frame).',
  inputSchema: { t: z.number().describe('Time in seconds') },
}, guard(async ({ t }) => text(await ui('ir', { t }))));

server.registerTool('play', {
  description: 'Starts playback in the editor, from t if given. The browser may keep the sound muted until the user clicks the page; the picture plays anyway.',
  inputSchema: { t: z.number().optional().describe('Start time in seconds; default the current playhead'), loop: z.boolean().optional().describe('Loop at the end; omit to keep the current setting') },
}, guard(async ({ t, loop }) => {
  const r = await ui('reproducir', { t, bucle: loop });
  return text({ playing: true, t: r.t, loop: r.bucle, audio: r.sonido === 'running' ? 'playing' : r.sonido === 'none' ? 'no sound' : 'waiting for a click on the page' });
}));

server.registerTool('pause', {
  description: 'Pauses playback and returns the time it stopped at.',
}, guard(async () => text(await ui('pausar'))));

server.registerTool('set_track', {
  description: 'Mute, solo or change the monitoring gain of an audio track, and the master volume, in the editor. This only changes what the user hears in the editor; it does not change sound.py or exports. Returns every track with its state.',
  inputSchema: {
    track: z.string().optional().describe('Bus name as in timeline (for example music, fx)'),
    mute: z.boolean().optional(), solo: z.boolean().optional(),
    gain: z.number().min(0).max(4).optional().describe('Track monitoring gain, 1 is unchanged'),
    master_volume: z.number().min(0).max(1).optional().describe('Editor master volume from 0 to 1'),
    master_mute: z.boolean().optional(),
  },
}, guard(async ({ track, mute, solo, gain, master_volume, master_mute }) => {
  const r = await ui('pista', { pista: track, mute, solo, ganancia: gain, volumen: master_volume, silencio: master_mute });
  return text({ tracks: r.pistas.map(p => ({ track: p.pista, name: p.nombre, mute: p.mute, solo: p.solo, gain: p.gain })), master_volume: r.volumen, master_muted: r.silencio });
}));

server.registerTool('set_view', {
  description: 'Changes what the user sees in the editor: the right panel tab, the video zoom, the active tool, the code file open in the center (its visual map), which panels show, video-only mode and the player window. Returns the resulting view.',
  inputSchema: {
    right_panel: z.enum(['inspector', 'notes', 'chat']).optional(),
    zoom: z.number().min(0.1).max(1).optional().describe('Video size inside the player: 1 fits it, 0.5 is half'),
    tool: z.enum(['inspect', 'point_note', 'zone_note']).optional(),
    code_file: z.string().optional().describe('Project-relative file to open in the center code map; empty string closes it'),
    center_tab: z.enum(['video', 'code']).optional().describe('Which center tab shows when a code file is open'),
    panels: z.object({ files: z.boolean().optional(), right: z.boolean().optional(), timeline: z.boolean().optional() }).optional().describe('Show or hide the side panels and the timeline'),
    video_only: z.boolean().optional().describe('Hide everything but the video'),
    player: z.enum(['docked', 'floating', 'mini']).optional().describe('Player window mode'),
  },
}, guard(async ({ right_panel, zoom, tool, code_file, center_tab, panels, video_only, player }) => {
  const r = await ui('vista', {
    panel: right_panel && PANEL_IN[right_panel], zoom, herramienta: tool && TOOL_IN[tool], archivo_codigo: code_file,
    pestana: center_tab && (center_tab === 'code' ? 'mapa' : 'video'), paneles: panels && { left: panels.files, right: panels.right, timeline: panels.timeline },
    foco: video_only, reproductor: player && PLAYER_IN[player],
  });
  for (const k of Object.keys(r.paneles || {})) if (r.paneles[k] === undefined) delete r.paneles[k];
  return text(viewOut(r));
}));

server.registerTool('sound_events', {
  description: 'Rebuilds the sound from sound.py and returns its events per track: time, duration, gain and sound.py line. The editor already does it when sound.py is saved; use this to see the result or the error.',
}, guard(async () => {
  await call('audio', { method: 'POST' });
  const dir = await project();
  const ev = JSON.parse(await fs.readFile(path.join(dir, '.estudio', 'audio', 'events.json'), 'utf8'));
  const tracks = {};
  for (const e of ev.eventos) (tracks[e.bus] ||= []).push(`${e.t.toFixed(2)} s  dur ${e.dur.toFixed(2)}  gain ${e.gain}  sound.py:${e.line}`);
  return text({ duration: ev.duracion, silences: ev.silencios, tracks });
}));

server.registerTool('timeline', {
  description: 'Duration, fps, size, tempo, scenes, silences and every sound per track (time, duration, gain, sound.py line and the name the user gave it). Works for pages without timeline.json too, with what the editor measured.',
}, guard(async () => {
  const r = await call('linea');
  return text({
    duration: r.duracion, fps: r.fps, width: r.ancho, height: r.alto, mode: r.modo, bpm: r.bpm, bars: r.compases, has_timeline_json: !r.sinTimeline,
    scenes: (r.escenas || []).map(s => ({ id: s.id, from: s.desde, to: s.hasta })), silences: r.silencios,
    tracks: Object.fromEntries(Object.entries(r.pistas || {}).map(([k, v]) => [k, { name: v.nombre, events: v.eventos.map(e => ({ t: e.t, dur: e.dur, gain: e.ganancia, line: e.linea, name: e.nombre })) }])),
  });
}));

server.registerTool('list_texts', {
  description: 'Every visible text in the video: its value, file, line (1-based), column (0-based), the time ranges when it shows, its box in video pixels, font and color. Separately, texts that are built in code and cannot be edited as one literal. Walks the video offscreen; it can take several seconds.',
}, guard(async () => {
  const r = await ui('textos', { timeout: 120000 });
  return text({
    texts: r.textos.map(x => ({ text: x.texto, file: x.archivo, line: x.linea, column: x.columna, shows: x.aparece, box: x.caja, font: x.fuente, color: x.color })),
    built_in_code: r.calculados.map(x => ({ text: x.texto, shows: x.aparece })),
  });
}));

server.registerTool('edit_text', {
  description: 'Changes a visible text by its current value, wherever it is written as a string literal. If several literals match it returns them; repeat with file and line.',
  inputSchema: {
    current: z.string().describe('The exact current text'), new: z.string().describe('The new text'),
    file: z.string().optional().describe('Project-relative file, to pick among several matches'),
    line: z.number().int().optional().describe('1-based line, to pick among several matches'),
  },
}, guard(async ({ current, new: nuevo, file, line }) => {
  const r = await call('textos/editar', { method: 'POST', body: { actual: current, nuevo, archivo: file, linea: line } });
  return text({ ok: true, file: r.archivo, line: r.linea, column: r.columna });
}));

const locator = {
  file: z.string().optional().describe('Project-relative file of the text literal'),
  line: z.number().int().optional().describe('1-based line of the text literal'),
  column: z.number().int().optional().describe('0-based column of the literal, to pick among several on the line'),
  text: z.string().optional().describe('The exact text, to find its literal when file and line are not given'),
};
const styleOut = r => ({ ...r, palette: (r.palette || []).map(p => ({ name: p.nombre, ref: p.ref, value: p.value })) });

server.registerTool('text_style', {
  description: 'Where each style of a drawn text is decided in the code: font family, weight, size and italic (a literal font string or a font helper), fill color (literal or palette entry), alignment and the x, y arguments, each with file, line (1-based), column (0-based) and current value. When the text goes through a helper like title(g, "Hi", x, y, size), it follows the helper and maps its parameters back to this call. Each location has a scope: this_call (only this text), helper or helper_default (every text drawn by that helper) or shared (a palette entry). x or y without a location are expressions, not literals. Also lists the palette entries and the fonts the project ships. Locate the text by file and line, or by its exact text.',
  inputSchema: locator,
}, guard(async ({ file, line, column, text: texto }) => text(styleOut(await ui('estilo_texto', { archivo: file, linea: line, columna: column, texto })))));

server.registerTool('set_text_style', {
  description: 'Changes the style of a drawn text in the code, like the editor\'s text toolbar: family, weight, size, italic, color, palette color, alignment, x, y and the text itself. Locate it like text_style. A palette color is shared by every text that uses it: color_scope "shared" (default) changes the palette entry, "only_this" writes the color here instead. Returns each code change and what could not be applied.',
  inputSchema: {
    ...locator,
    family: z.string().optional().describe('Font family, ideally one of the project_fonts'),
    weight: z.number().int().min(100).max(900).optional().describe('100 to 900'),
    size: z.number().positive().optional().describe('Font size in video pixels'),
    italic: z.boolean().optional(),
    color: z.string().optional().describe('Hex color like #ffcc00'),
    color_scope: z.enum(['shared', 'only_this']).optional(),
    palette_color: z.string().optional().describe('Use a palette entry by its ref, like C.cream'),
    align: z.enum(['left', 'center', 'right', 'start', 'end']).optional(),
    x: z.number().optional().describe('New x argument of the draw call, in code units (usually video pixels)'),
    y: z.number().optional().describe('New y argument of the draw call, in code units (usually video pixels)'),
    new_text: z.string().optional().describe('Replace the text itself'),
  },
}, guard(async ({ file, line, column, text: texto, family, weight, size, italic, color, color_scope, palette_color, align, x, y, new_text }) => {
  const cambios = { familia: family, peso: weight, tamano: size, italica: italic, color, color_alcance: color_scope === 'only_this' ? 'solo_este' : 'compartido', paleta: palette_color, alineacion: align, x, y, texto: new_text };
  const r = await ui('estilo_texto', { archivo: file, linea: line, columna: column, texto, cambios });
  return text({ applied: r.aplicados.map(e => ({ file: e.archivo, line: e.linea, column: e.columna, from: e.antes, to: e.despues })), not_applied: r.no_aplicado });
}));

server.registerTool('edit_literal', {
  description: 'Changes one exact literal value in the code (number, color or string), like dragging a control in the inspector. "old" must match the text at that position, quotes included for strings.',
  inputSchema: {
    file: z.string().describe('Project-relative path'),
    line: z.number().int().min(1).describe('1-based line number'),
    column: z.number().int().min(0).describe('0-based column where the literal starts (for strings, the opening quote)'),
    old: z.string().describe('Current literal text exactly as written, for example 120, 0.5, \'#ffcc00\' or "Hello"'),
    new: z.string().describe('New literal text, with quotes for strings'),
  },
}, guard(async ({ file, line, column, old, new: value }) => {
  try { await call('literal', { method: 'POST', body: { file, line, col: column, old, value } }); }
  catch (e) {
    if (!e.message.includes('code changed')) throw e;
    fileCache.clear();
    const now = (await readLines(file))[line - 1];
    throw new Error(now == null ? `${file} has no line ${line}.` : `${file}:${line} does not have ${old} at column ${column}. The line now reads: ${now.trim()}${now.indexOf(old) >= 0 ? ` (that text starts at column ${now.indexOf(old)})` : ''}`);
  }
  return text({ ok: true, file, line, column, from: old, to: value });
}));

const stepOut = s => s && { file: s.file, files: s.archivos, author: s.autor === 'claude' ? 'agent' : 'user', at: s.t };
server.registerTool('undo', { description: 'Undoes the last step: a whole agent request, or a change by the user.' }, guard(async () => { const r = await call('deshacer', { method: 'POST' }); return text({ ok: r.ok, file: r.file, next_undo: stepOut(r.deshacer), next_redo: stepOut(r.rehacer), steps: r.pasos }); }));
server.registerTool('redo', { description: 'Redoes the last undone step.' }, guard(async () => { const r = await call('rehacer', { method: 'POST' }); return text({ ok: r.ok, file: r.file, next_undo: stepOut(r.deshacer), next_redo: stepOut(r.rehacer), steps: r.pasos }); }));
server.registerTool('history', { description: 'The undo and redo stacks, newest first: the files each step changed, who made it (agent or user) and when.' }, guard(async () => {
  const r = await call('historial?todo=1');
  return text({ undo: r.deshacer.map(stepOut), redo: r.rehacer.map(stepOut) });
}));

const v = (ancho, alto, extra = {}) => ({ formato: 'mp4', calidad: 'alta', ancho, alto, ajuste: 'encajar', ...extra });
const PRESETS = {
  original: { formato: 'mp4', calidad: 'alta' },
  'yt-1080': v(1920, 1080), 'yt-4k': v(3840, 2160), 'yt-shorts': v(1080, 1920),
  'ig-reels': v(1080, 1920), 'ig-feed': v(1080, 1350), 'ig-square': v(1080, 1080), 'ig-story': v(1080, 1920),
  tiktok: v(1080, 1920),
  'x-h': v(1920, 1080, { calidad: 'media' }), 'x-v': v(1080, 1920, { calidad: 'media' }), 'x-sq': v(1080, 1080, { calidad: 'media' }), 'x-gif': { formato: 'gif', calidad: 'media', ancho: 640, fps: 15 },
  'li-h': v(1920, 1080), 'li-sq': v(1080, 1080), 'li-v': v(1080, 1350),
  'fb-feed': v(1080, 1350), 'fb-reels': v(1080, 1920), threads: v(1080, 1350),
  'pin-std': v(1000, 1500), 'pin-v': v(1080, 1920), snap: v(1080, 1920),
  'wa-estado': v(1080, 1920, { calidad: 'media' }), 'wa-chat': v(1280, 720, { calidad: 'liviana' }), discord: v(1280, 720, { calidad: 'liviana' }),
  twitch: v(1920, 1080), vimeo: v(1920, 1080), dribbble: v(1600, 1200),
  'web-webm': { formato: 'webm', calidad: 'media', ancho: 1280, alto: 720 }, 'web-hero': { formato: 'webm', calidad: 'media', ancho: 1920, alto: 1080 }, 'web-mp4': v(1280, 720, { calidad: 'liviana' }), 'web-gif': { formato: 'gif', calidad: 'liviana', ancho: 480, fps: 12 },
  'r-4k': v(3840, 2160), 'r-1440': v(2560, 1440), 'r-1080': v(1920, 1080), 'r-720': v(1280, 720), 'r-480': v(854, 480),
};
const QUALITY = { high: 'alta', medium: 'media', light: 'liviana' };

server.registerTool('export', {
  description: 'Exports the video with the project\'s render.py and ffmpeg. A preset sets the platform specs (size, quality, fps; for example yt-1080, yt-shorts, ig-reels, ig-feed, tiktok, x-h, x-gif, li-sq, wa-chat, discord, web-webm, r-4k); any other option overrides it. Formats mp4, webm, gif, png (a folder of frames) or frame (the single frame at t). By default it waits until it finishes; with wait false it returns at once and you follow it with export_status.',
  inputSchema: {
    preset: z.enum(Object.keys(PRESETS)).optional().describe('Platform preset'),
    format: z.enum(['mp4', 'webm', 'gif', 'png', 'frame']).optional().describe('Default mp4'),
    quality: z.enum(['high', 'medium', 'light']).optional(),
    width: z.number().int().optional().describe('Output width in pixels; default the video width'),
    height: z.number().int().optional().describe('Output height in pixels'),
    fit: z.enum(['fit', 'crop']).optional().describe('When the aspect ratio changes: fit adds bars, crop fills and cuts'),
    pad_color: z.string().optional().describe('Bar color when fit adds bars, an ffmpeg color like black or #101010'),
    fps: z.number().max(60).optional().describe('Frames per second, up to 60 real frames'),
    from: z.number().optional().describe('Start of the range in seconds'), to: z.number().optional().describe('End of the range in seconds'),
    t: z.number().optional().describe('Time of the frame for format frame'),
    audio: z.boolean().optional().describe('Include sound (mp4 and webm). Default true.'),
    destination: z.enum(['project', 'downloads']).optional().describe('project saves in out/exports; downloads in the user\'s Downloads folder'),
    name: z.string().optional().describe('File name without extension'),
    workers: z.number().int().min(1).max(32).optional().describe('Parallel render workers, default 6'),
    wait: z.boolean().optional().describe('Wait until it finishes. Default true.'),
  },
}, guard(async a => {
  const o = { ...(a.preset ? PRESETS[a.preset] : {}) };
  const set = (k, val) => { if (val !== undefined) o[k] = val; };
  set('formato', a.format === 'frame' ? 'cuadro' : a.format); set('calidad', a.quality && QUALITY[a.quality]);
  set('ancho', a.width); set('alto', a.height); set('ajuste', a.fit && (a.fit === 'crop' ? 'recortar' : 'encajar')); set('fondo', a.pad_color);
  set('fps', a.fps); set('desde', a.from); set('hasta', a.to); set('t', a.t); set('audio', a.audio);
  set('destino', a.destination && (a.destination === 'downloads' ? 'descargas' : 'proyecto')); set('nombre', a.name); set('workers', a.workers);
  const job = await call('exportar', { method: 'POST', body: o });
  if (a.wait === false) return text(jobOut(job));
  for (let i = 0; i < 2400; i++) {
    await sleep(1500);
    const j = await call('exportar/estado');
    if (j && j.estado !== 'exportando') return text(j.estado === 'listo' ? { done: true, ...resultOut(j.resultado) } : { state: JOB_STATE[j.estado] || j.estado, error: j.error });
  }
  return text('The export is still running. Check export_status.');
}));
server.registerTool('export_status', { description: 'State of the running or last export: state (running, done, error, canceled), stage, progress from 0 to 1, frames, time left and result.' }, guard(async () => text(jobOut(await call('exportar/estado')) || 'No export has run since the editor started.')));
server.registerTool('cancel_export', { description: 'Cancels the running export.' }, guard(async () => { await call('exportar/cancelar', { method: 'POST' }); return text('Canceled.'); }));
server.registerTool('export_history', { description: 'Previous exports of this project that still exist on disk, newest first, with path, size, format and options.' }, guard(async () => {
  const list = await call('exportar/historial');
  return text(list.map(h => ({ ...resultOut(h), options: optionsOut(h.opciones) })));
}));
server.registerTool('open_export', {
  description: 'Opens a previous export on the user\'s computer with its default app, or shows it in the file explorer.',
  inputSchema: { path: z.string().describe('Absolute path from export_history or export'), reveal: z.boolean().optional().describe('Show it in the file explorer instead of opening it') },
}, guard(async ({ path: ruta, reveal }) => { await call('exportar/abrir', { method: 'POST', body: { ruta, carpeta: !!reveal } }); return text('Opened.'); }));

server.registerTool('generate_image', {
  description: 'Generates an image with an image model through OpenRouter or Vercel AI Gateway (whichever is connected; see connections) and saves it in the project\'s assets/gen. Useful for characters, backgrounds, objects and textures. With background "transparent" it comes back cut out. References are project images the model uses to keep the style or the character. Returns a downscaled JPEG preview; the saved file is full size.',
  inputSchema: {
    prompt: z.string().describe('Full description of the image, with style, framing and light'),
    references: z.array(z.string()).max(4).optional().describe('Project-relative paths of reference images'),
    aspect_ratio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']).optional().describe('Default 1:1'),
    background: z.enum(['normal', 'transparent']).optional().describe('transparent keys out the background'),
    name: z.string().optional().describe('Short file name'),
    model: z.string().optional().describe('Model id with provider prefix, like openrouter:openai/gpt-5.4-image-2 or gateway:<id>. Default: the one set in connections.'),
  },
}, guard(async ({ prompt, references, aspect_ratio, background, name, model }) => {
  const r = await call('generar', { method: 'POST', body: { prompt, refs: references || [], ratio: aspect_ratio || '1:1', fondo: background === 'transparent' ? 'transparente' : 'normal', nombre: name, modelo: model } });
  const dir = await project();
  const full = path.join(dir, r.archivo);
  const small = await preview(full);
  const buf = small || await fs.readFile(full);
  return { content: [{ type: 'image', data: buf.toString('base64'), mimeType: small ? 'image/jpeg' : mimeOf(buf) }, { type: 'text', text: `Saved in ${r.archivo} with ${r.modelo}${r.costo != null ? ` · US$ ${r.costo}` : ''}` }] };
}));

const soundOut = x => ({ title: x.titulo, author: x.autor, duration: x.duracion, license: x.licencia, cc0: x.cc0, url: x.url, source: x.fuente, page: x.pagina, attribution: x.atribucion });
server.registerTool('search_sounds', {
  description: 'Searches sound effects or music with licenses free for commercial use (CC0, CC BY, CC BY-SA, public domain) on Openverse: Freesound, Wikimedia Commons and Jamendo. Returns title, duration in seconds, license, attribution and the url for download_sound. Search in English.',
  inputSchema: {
    query: z.string().describe('What to search, in English'),
    length: z.enum(['shortest', 'short', 'medium', 'long']).optional().describe('shortest is under 30 s (default)'),
    kind: z.enum(['effect', 'music']).optional().describe('Default effect'),
    page: z.number().int().min(1).optional().describe('Results page, 20 per page'),
    limit: z.number().int().min(1).max(20).optional().describe('How many to return, default 12'),
  },
}, guard(async ({ query, length, kind, page, limit }) => {
  const list = await call(`sonidos/buscar?q=${encodeURIComponent(query)}&largo=${length || 'shortest'}&tipo=${kind === 'music' ? 'musica' : 'efecto'}&pagina=${page || 1}`);
  return text(list.slice(0, limit || 12).map(soundOut));
}));

server.registerTool('recommended_sounds', {
  description: 'Sound or music suggestions grouped by idea: first the ideas from the video\'s video.md Sound section, then common categories. Each group has a few sounds ready for download_sound.',
  inputSchema: {
    kind: z.enum(['effect', 'music']).optional().describe('Default effect'), length: z.enum(['shortest', 'short', 'medium', 'long']).optional(),
    per_group: z.number().int().min(1).max(6).optional().describe('Sounds per group, default 3'),
  },
}, guard(async ({ kind, length, per_group = 3 }) => {
  const groups = await call(`sonidos/recomendados?tipo=${kind === 'music' ? 'musica' : 'efecto'}${length ? `&largo=${length}` : ''}`);
  return text(groups.map(g => ({ title: g.titulo, query: g.q, from_video: !!g.delVideo, error: g.error, items: g.items.slice(0, per_group).map(soundOut) })));
}));

server.registerTool('download_sound', {
  description: 'Downloads a sound found with search_sounds or recommended_sounds into assets/sounds, converted to 48 kHz stereo WAV. If the license requires attribution it is added to assets/sounds/CREDITS.md. From sound.py, load it with the wave module or numpy.',
  inputSchema: {
    url: z.string().describe('The url from the search result'), title: z.string().describe('Used for the file name'),
    attribution: z.string().optional().describe('Attribution text from the search result'), cc0: z.boolean().optional().describe('true when no attribution is needed'),
  },
}, guard(async ({ url, title, attribution, cc0 }) => {
  const r = await call('sonidos/bajar', { method: 'POST', body: { url, titulo: title, atribucion: attribution, cc0 } });
  return text({ file: r.archivo, attribution: r.atribucion });
}));

server.registerTool('ask_user', {
  description: 'Asks the user a question in the editor chat, with options to choose from, and waits for the answer (up to 30 minutes). Use it when you need a decision from them (a style, a direction, a confirmation) instead of ending with a question in the text. The user can always write another answer.',
  inputSchema: {
    question: z.string(),
    options: z.array(z.object({ label: z.string(), detail: z.string().optional() })).max(6).optional(),
    multiple: z.boolean().optional().describe('Whether several options can be chosen'),
  },
}, guard(async ({ question, options, multiple }) => {
  const r = await call('pregunta', { method: 'POST', body: { pregunta: question, opciones: (options || []).map(o => ({ etiqueta: o.label, detalle: o.detail })), multiple } });
  return text(r.sinRespuesta ? 'The user did not answer. Go on with the safest option and tell them which one you chose.' : `The user answered: ${r.respuesta}`);
}));

server.registerTool('project_info', {
  description: 'The open project: folder, entry page, every file, source files, references the user added, the timeline.json, video.md (the brief), taste notes, whether it has sound.py and render.py, and whether the chat is busy.',
}, guard(async () => {
  const [p, refs] = await Promise.all([call('proyecto'), call('referencias').catch(() => [])]);
  return text({
    folder: p.dir, name: p.name, entry: p.entry, has_sound: p.sonido, can_export: p.files.includes('render.py'), chat_busy: p.chat?.ocupado,
    references: refs, source_files: p.fuentes, files: p.files, timeline_json: p.timeline, video_md: p.videoMd, taste: p.gusto,
  });
}));

server.registerTool('import_file', {
  description: 'Copies a file from the user\'s computer (absolute path) or from an http(s) URL into the project. destination assets (default) is for things the video uses; references and attachments go into the project\'s .estudio folder for you to look at. Returns the project-relative path. Use reference_video_frames on a video to see it.',
  inputSchema: {
    source: z.string().describe('Absolute path on the computer, or an http(s) URL'),
    destination: z.enum(['assets', 'references', 'attachments']).optional(),
    subfolder: z.string().optional().describe('Subfolder inside the destination, like img or fonts'),
    name: z.string().optional().describe('File name to save as'),
  },
}, guard(async ({ source, destination, subfolder, name }) => {
  const r = await call('importar', { method: 'POST', body: { ruta: source, destino: { assets: 'assets', references: 'referencias', attachments: 'adjuntos' }[destination || 'assets'], carpeta: subfolder, nombre: name } });
  return text({ file: r.file, size_bytes: r.tamano });
}));

server.registerTool('reference_video_frames', {
  description: 'For a video file inside the project (a reference or an imported clip), extracts evenly spaced frames and a contact sheet, saved next to it, and returns the contact sheet image with the frame paths and times. Use Read on the frame paths for detail.',
  inputSchema: { file: z.string().describe('Project-relative path of the video file') },
}, guard(async ({ file }) => {
  const r = await call('adjunto/video', { method: 'POST', body: { file } });
  const info = { duration: r.duracion, width: r.ancho, height: r.alto, contact_sheet: r.hoja, frames: r.cuadros.map(c => ({ t: c.t, path: c.path })) };
  if (!r.hoja) return text(info);
  const buf = await fs.readFile(path.join(await project(), r.hoja));
  return { content: [{ type: 'image', data: buf.toString('base64'), mimeType: mimeOf(buf) }, { type: 'text', text: JSON.stringify(info, null, 2) }] };
}));

const skillOut = s => ({ name: s.name, description: s.description, folder: s.dir, source: s.origen, built_in: !!s.fija, enabled: !!s.activa });
server.registerTool('list_skills', { description: 'Skills the editor\'s chat agent can use in this project: built-in, added by the user, and from Claude Code or other agents, with which are enabled.' }, guard(async () => text((await call('skills')).map(skillOut))));
server.registerTool('set_skills', {
  description: 'Enables or disables skills for the chat agent of this project, or adds a skill folder (one with a SKILL.md). Built-in skills are always on.',
  inputSchema: {
    enable: z.array(z.string()).optional().describe('Skill names to enable'), disable: z.array(z.string()).optional().describe('Skill names to disable'),
    add_folder: z.string().optional().describe('Absolute path of a skill folder to add to the list'),
  },
}, guard(async ({ enable = [], disable = [], add_folder }) => {
  if (add_folder) await call('skills/agregar', { method: 'POST', body: { dir: add_folder } });
  const all = await call('skills');
  const unknown = [...enable, ...disable].filter(n => !all.some(s => s.name === n));
  if (unknown.length) throw new Error(`Unknown skills: ${unknown.join(', ')}. Available: ${all.map(s => s.name).join(', ')}`);
  const on = new Set(all.filter(s => s.activa && !s.fija).map(s => s.name));
  for (const n of enable) on.add(n);
  for (const n of disable) on.delete(n);
  return text((await call('skills', { method: 'POST', body: { activas: [...on] } })).map(skillOut));
}));

const conOut = c => ({ openrouter: c.openrouter || null, vercel_ai_gateway: c.gateway || null, tripo: c.tripo || null, image_model: c.modeloImagen, free_sounds: c.openverse });
server.registerTool('connections', {
  description: 'Which services are connected (keys shown masked): OpenRouter and Vercel AI Gateway for images, Tripo, the default image model and free sounds. Optionally the image models available with the connected keys.',
  inputSchema: { list_models: z.boolean().optional().describe('Also list the available image models') },
}, guard(async ({ list_models }) => {
  const out = conOut(await call('conexiones'));
  if (list_models) out.image_models = (await call('modelos-imagen').catch(() => [])).map(m => ({ id: m.id, name: m.nombre, provider: m.proveedor, author: m.autor, accepts_references: m.referencias }));
  return text(out);
}));
server.registerTool('set_connections', {
  description: 'Saves API keys and the default image model for this computer (in ~/.estudio/config.json). An empty string removes a key. Only do it with keys the user gave you.',
  inputSchema: {
    openrouter_key: z.string().optional(), vercel_ai_gateway_key: z.string().optional(), tripo_key: z.string().optional(),
    image_model: z.string().optional().describe('Default model id, like openrouter:openai/gpt-5.4-image-2'),
    free_sounds: z.boolean().optional().describe('Turn the Openverse sound search on or off'),
  },
}, guard(async ({ openrouter_key, vercel_ai_gateway_key, tripo_key, image_model, free_sounds }) => {
  const body = {};
  if (openrouter_key !== undefined) body.openrouter = openrouter_key;
  if (vercel_ai_gateway_key !== undefined) body.gateway = vercel_ai_gateway_key;
  if (tripo_key !== undefined) body.tripo = tripo_key;
  if (image_model !== undefined) body.modeloImagen = image_model;
  if (free_sounds !== undefined) body.openverse = free_sounds;
  return text(conOut(await call('conexiones', { method: 'POST', body })));
}));

server.registerTool('new_video', {
  description: 'Creates a new video from the OpusCut engine template in a new folder and opens it in the editor.',
  inputSchema: {
    name: z.string().describe('Video name; also the folder name'), folder: z.string().describe('Absolute path of the folder to create it in'),
    width: z.number().int().optional().describe('Pixels, default from the template'), height: z.number().int().optional(),
    seconds: z.number().optional().describe('Approximate duration'),
  },
}, guard(async ({ name, folder, width, height, seconds }) => { const r = await call('nuevo', { method: 'POST', body: { nombre: name, carpeta: folder, ancho: width, alto: height, segundos: seconds } }); projectDir = null; return text({ ok: true, folder: r.dir }); }));
server.registerTool('open_example', {
  description: 'Copies the bundled example video into a folder (Documents/Kinora by default) and opens it in the editor.',
  inputSchema: { folder: z.string().optional().describe('Absolute path of the parent folder for the copy') },
}, guard(async ({ folder }) => { const r = await call('ejemplo', { method: 'POST', body: { carpeta: folder } }); projectDir = null; return text({ ok: true, folder: r.dir }); }));
server.registerTool('recent_projects', { description: 'Recently opened videos, newest first.' }, guard(async () => text((await call('recientes')).map(r => ({ name: r.name, folder: r.dir, opened: r.abierto })))));

server.registerTool('rename', {
  description: 'Gives a custom name to an audio track (key = bus name, for example music) or to a sound (key = its sound.py line number). An empty name removes it.',
  inputSchema: { kind: z.enum(['track', 'sound']), key: z.string().describe('Bus name or sound.py line'), name: z.string() },
}, guard(async ({ kind, key, name }) => {
  const r = await call('etiquetas', { method: 'POST', body: { tipo: kind === 'track' ? 'pista' : 'sonido', clave: key, nombre: name } });
  return text({ tracks: r.pistas, sounds: r.sonidos });
}));

await server.connect(new StdioServerTransport());
