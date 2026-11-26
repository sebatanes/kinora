# Kinora: agents guide

Kinora (Kinora) is a local video editor for motion videos written as code (OpusCut projects, canvas or three.js pages, any animated page). Everything a person can do in its interface can also be done by an agent, through MCP. The editor runs on the person's machine; nothing here is a hosted service.

- Interface: `http://127.0.0.1:4870`
- MCP server: `server/kinora-mcp.js` (stdio, built from `server/mcp.js`), name `kinora`
- Short index for models: `/llms.txt`

## Connect

Claude Code (installed as a plugin, or by hand):

```
claude mcp add kinora -- node /path/to/kinora/server/kinora-mcp.js
```

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.kinora]
command = "node"
args = ["/path/to/kinora/server/kinora-mcp.js"]
```

Cursor, Windsurf and other MCP clients (`mcp.json`):

```json
{ "mcpServers": { "kinora": { "command": "node", "args": ["/path/to/kinora/server/kinora-mcp.js"] } } }
```

If the editor is not running, the `open` tool starts it and opens the folder; with no folder it opens a browser tab on the running editor (tools that read the picture need one). Set `ESTUDIO_URL` if it runs on another port.

## Conventions

- Times are seconds from the start of the video.
- Positions and boxes are video pixels: the canvas size `status` reports, origin top-left. Images from `get_frame` and `contact_sheet` are scaled; their caption gives the factor.
- Code locations are project-relative paths with 1-based lines and 0-based columns.

## What an agent sees

The editor shares its live state: what the person is looking at is what the tools return. Looking at a frame moves the person's playhead there (`get_frame` can keep it).

| Tool | What it gives |
|---|---|
| `status` | playhead, playing or not, video size and fps, selection, open notes, editor view |
| `get_frame` | the frame at a time as an image; a region crop, numbered boxes over the elements |
| `contact_sheet` | evenly spaced frames of the whole video or a range in one image |
| `list_elements` | what is drawn in a frame: groups by function, or every draw call with id, z order, color, font, alpha |
| `inspect_point` | what is under a point, top to bottom, with the call chain and code lines |
| `find_element` | when and where a text, function or image appears across the video |
| `get_selection` | the element or text the person selected |
| `element_literals` | the literal values on the lines that draw an element, with the axis they control |
| `timeline` | duration, fps, size, tempo, scenes, silences, every sound per track |
| `list_texts` | every visible text with file, line, when it shows, font and color |
| `text_style` | where a text's font, weight, size, color, alignment and position are decided |
| `list_notes` | the person's notes on frames, zones and ranges, with marked images |
| `project_info` | folder, files, references, timeline.json, video.md |
| `history` | the undo and redo steps |
| `export_status`, `export_history` | the running or past exports |
| `list_skills`, `connections` | skills of the editor's chat agent; connected services and image models |

## What an agent can change

| Tool | Effect |
|---|---|
| `edit_literal` | changes an exact literal (number, color, text) at file, line, column |
| `edit_text` | changes a visible text by its current value |
| `set_text_style` | changes a text's family, weight, size, color, alignment, position or content |
| `element_literals` with `dx`, `dy` | moves an element by editing its x and y literals |
| `resolve_note`, `add_note`, `delete_note` | answers a note; leaves the agent's own note, linked to an element or a sound |
| `highlight` | moves the person's playhead and highlights a zone with a label |
| `select`, `seek`, `play`, `pause` | selects an element or a level of its call chain; moves or plays the playhead |
| `set_track` | mutes, solos or sets the monitoring gain of a track, and the master volume |
| `set_view` | right panel, zoom, tool, code file on screen, panels, video-only mode, player window |
| `ask_user` | asks the person a question with options and waits for the answer |
| `sound_events` | rebuilds sound from `sound.py` and returns the events |
| `search_sounds`, `recommended_sounds`, `download_sound` | free sounds and music (CC0, CC BY) through Openverse, downloaded as WAV with credits |
| `generate_image` | images through OpenRouter or Vercel AI Gateway, saved in `assets/gen` |
| `import_file`, `reference_video_frames` | brings a file or URL into the project; frames and a contact sheet of a video file |
| `rename` | names a track or a sound |
| `undo`, `redo` | undo and redo; one agent request is one step |
| `export` | renders MP4, WebM, GIF, PNG sequence or a single frame; platform presets, sizes, crop or fit, up to 60 real fps, ranges |
| `cancel_export`, `open_export` | stops an export; opens a past one |
| `set_skills`, `set_connections` | enables skills for the chat agent; saves keys the person gave |
| `open`, `new_video`, `open_example`, `recent_projects` | opens a folder, creates a video from the OpusCut engine, opens the bundled example, lists recent ones |

Source files can also be edited directly; the editor reloads on save and keeps the playhead.

## Code the editor understands best

The inspector follows the call stack of every draw call, so a video becomes editable by hand when:

- each visible thing has its own named function;
- values a person would tweak (position, size, color, text, timing) are literals in the call or the function;
- visible text is a string literal in the call that draws it, not built letter by letter;
- the page exposes `window.renderFrame(n)` and `window.__ready` (the OpusCut contract). Any other animated page also works through a virtual clock.

## Rules

- Do not restart the editor or reload the browser; saving a file is enough.
- To check a change, look at one frame with `get_frame`; do not render the whole video.
- Change only what the person asked for.
- When a decision is the person's, use `ask_user` instead of ending with a question in text.
