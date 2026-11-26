---
name: kinora
description: Kinora, a local editor for motion videos made in code, connected live with Claude. Use it to open, review, fix or finish a video made with code (OpusCut, canvas, three.js, any animated page), when the user leaves notes on frames, or when they ask to see or edit a video "in the editor".
---

# Kinora

Video editor.

A local video editor where the video is code. The user watches the video, steps through it frame by frame, clicks anything to see which function drew it, changes numbers and colors by dragging, and leaves notes on points, zones or ranges. You see exactly the same through the tools of the `kinora` MCP.

Reply in the language the user writes in.

## Open

`open` with the video folder. It starts the editor if it is not running and opens it in the browser. If a tool says no browser tab is connected, call `open` with no folder. Never ask the user to run a command.

## Units

Times are seconds. Positions and boxes are video pixels (the canvas size that `status` reports, origin top-left), never pixels of a returned image: `get_frame` says the scale in its caption. Code locations are project-relative paths, 1-based lines and 0-based columns.

## See what the user sees

- `status`: playhead, video size and fps, selection, open notes and the editor view. Start here when the user talks about "this" or "here".
- `get_selection`: what they have selected, with the function chain and the code line of each one.
- `get_frame`: the image at a time. It moves their playhead (unless `keep_playhead`): they see what you are looking at. `region` zooms into a detail; `boxes` numbers every element group on the image with a legend.
- `contact_sheet`: evenly spaced frames of the whole video in one image, to see what happens over time without moving the playhead.
- `list_elements`: what is drawn in a frame, grouped by function, or every draw call with id, z order, color, font and alpha.
- `inspect_point`: what is at a point (x, y), top to bottom, with the code.
- `find_element`: when and where a text, a function or an image appears across the whole video.
- `timeline`, `project_info`, `list_texts`: duration, scenes and sounds; files and the brief; every visible text with its literal.

## Change it

- `edit_literal` changes one exact value; `element_literals` lists the values on the lines that draw an element and can move it with `dx`, `dy`.
- `edit_text` changes a text by its value; `text_style` and `set_text_style` read and change its font, weight, size, color, alignment and position, following helpers like `title(g, 'Hi', ...)`.
- Anything else: edit the source file. Check with `get_frame`. `undo`, `redo` and `history` cover your changes and the user's.
- `select`, `highlight`, `seek`, `play`, `pause`, `set_track` and `set_view` drive the editor itself.

## Notes

Notes are the user's requests. Each one has a time, position, text, the code element it marked and the image of the frame with the mark.

1. `list_notes` to read them all.
2. `resolve_note` with status `in_progress` when you start each one.
3. Make the change in the code. The editor reloads on its own and keeps the playhead.
4. `get_frame` at that time to check with your own eyes that it looks as requested. If not, keep going.
5. `resolve_note` with `solved` and what you did in one sentence.

If a note is ambiguous, do not guess: `add_note` with your question on that frame and go on with the others.

A note of type `move` was created by the user dragging an element in the video. It has `dx` and `dy` in video pixels and the `scope`: `whole_path` moves the element along its whole path and `only_at_t` moves it only around that time, without changing the rest of its animation. Follow the `origin` to where the position is defined (`element_literals` at the note's point lists the candidates); if it is inside a transform with scale or rotation, convert the offset to those coordinates. Check with `get_frame` that it ended up where it was dropped.

## Ask

If you need a decision from the user, use `ask_user` with short options and continue with their answer. Do not end the turn with a question in the text.

## Point things out

`highlight` moves their playhead to a time and highlights a zone with a label. Use it when you explain something visual ("this is the shadow that gets cut") instead of describing coordinates.

## Sound

If the project has `sound.py` with `synth.Mix`, the editor instruments it: every `m.add` shows up in the timeline with its track and its line. Saving `sound.py` rebuilds the sound on its own. `sound_events` returns the events or the error. `search_sounds`, `recommended_sounds` and `download_sound` bring free sounds and music into `assets/sounds`.

A note of type `image` was created by the user dragging an asset onto the video: it has `file`, the box `x`, `y`, `w`, `h` in video pixels and the range `t` to `t1`. Draw it on top of everything, in a function with its own name, with a short entrance and exit.

Requests about a whole track ("the whole Music track") are about that entire bus in `sound.py`, not about one moment. The names the user gave to tracks and sounds are in `timeline` (and `rename` sets them); use them when you talk to them.

## Texts and export

The user edits texts on their own: double click on the text in the video or the Texts tab, which write the literal into the code. For that to work, every visible text has to be a string literal in the call that draws it, not built from pieces. If you build it letter by letter, pass the whole text as a literal to the function.

Export is done with the project's `render.py` plus ffmpeg (MP4, WebM, GIF, PNG, ranges, sizes, platform presets like `yt-shorts` or `x-gif`) through `export`. You do not need to export unless the user asks.

## Generate images

`generate_image` creates characters, backgrounds, objects or textures with an image model through OpenRouter or Vercel AI Gateway and saves them in `assets/gen`. With `background: "transparent"` it comes out cut out. `import_file` brings a file from the computer or a URL into the project; `reference_video_frames` lets you look at a video file. Pass as reference the project images that define the style or the character so everything comes out consistent. Illustrated characters and painted worlds are generated; the code does the compositing and the motion.

## Code the editor understands best

The inspector follows the call stack of every draw call, so the code becomes editable by hand when:

- Each visible thing has its own named function (`logo`, `phone`, `leapShot`), not one giant function.
- The values someone would want to tweak (position, size, color, text, timing) are literals in the call or in the function, not hidden calculations.
- The page exposes `window.renderFrame(n)` and `window.__ready` (the OpusCut contract) so every frame is exact. Any other animated page also works, with a virtual clock.

When you write or rewrite a video that the user is going to edit, follow those three things.

## What not to do

- Do not restart the server or reload the browser: everything reloads on its own when you save.
- Do not render the whole video to check a change: `get_frame` is enough.
- Do not change what the user did not mark.
