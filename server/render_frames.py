"""Renders an OpusCut page at any frame rate without touching the project: timeline.json is served with the fps overridden.

  python render_frames.py <project> --fps 60 [--from 2.0] [--to 6.5] [--workers 6] --out master.mp4

Prints "N/M frames  Xs" as it goes. Output is silent; the editor adds the sound.
"""
import argparse
import asyncio
import base64
import functools
import http.server
import json
import os
import shutil
import subprocess
import threading
import time

from playwright.async_api import async_playwright


def serve(root, timeline):
    body = json.dumps(timeline).encode()

    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass

        def do_GET(self):
            if self.path.split("?")[0] == "/timeline.json":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            return super().do_GET()

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=root))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/index.html"


async def open_page(browser, url, w, h):
    page = await browser.new_page(viewport={"width": w, "height": h})
    page.on("pageerror", lambda e: print("[page error]", e, flush=True))
    await page.goto(url)
    for _ in range(1200):
        if await page.evaluate("window.__ready === true"):
            return page
        await asyncio.sleep(0.1)
    raise SystemExit("the page never became ready")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--fps", type=float, required=True)
    ap.add_argument("--from", dest="start", type=float, default=0.0)
    ap.add_argument("--to", dest="end", type=float)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    root = os.path.abspath(args.project)
    with open(os.path.join(root, "timeline.json"), encoding="utf-8") as fh:
        tl = json.load(fh)
    base_fps = tl["fps"]
    fps = args.fps
    tl["fps"] = fps
    # A held pose ("on twos") keeps its duration in seconds at the new rate.
    if tl.get("hold", 1) > 1:
        tl["hold"] = max(1, round(tl["hold"] * fps / base_fps))
    w, h = tl["width"], tl["height"]
    duration = tl["beats"] * 60 / tl["bpm"]
    first = round(args.start * fps)
    last = round((args.end if args.end is not None else duration) * fps)
    total = last - first

    srv, url = serve(root, tl)
    ff = subprocess.Popen(
        [shutil.which("ffmpeg"), "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
         "-vf", "scale=in_range=full:out_range=tv,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "14",
         "-color_range", "tv", "-r", str(fps), "-movflags", "+faststart", args.out],
        stdin=subprocess.PIPE,
    )
    t0 = time.time()
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(channel="chromium", headless=True, args=["--enable-gpu", "--ignore-gpu-blocklist"])
        except Exception:
            browser = await p.chromium.launch(headless=True)
        pages = await asyncio.gather(*[open_page(browser, url, w, h) for _ in range(max(1, args.workers))])
        results, nxt, lock = {}, first, asyncio.Lock()

        async def worker(page):
            nonlocal nxt
            while True:
                async with lock:
                    n = nxt
                    nxt += 1
                if n >= last:
                    return
                while len(results) > 60:
                    await asyncio.sleep(0.01)
                data = await page.evaluate("([n]) => window.renderFrame(n, 'jpeg')", [n])
                results[n] = base64.b64decode(data.split(",", 1)[1])

        async def writer():
            n = first
            while n < last:
                if n in results:
                    ff.stdin.write(results.pop(n))
                    n += 1
                    if (n - first) % max(1, int(fps // 2)) == 0 or n == last:
                        print(f"  {n - first}/{total} frames  {time.time() - t0:5.1f}s", flush=True)
                else:
                    await asyncio.sleep(0.005)

        await asyncio.gather(writer(), *[worker(pg) for pg in pages])
        await browser.close()
    ff.stdin.close()
    ff.wait()
    srv.shutdown()
    print(f"picture: {total} frames at {fps:g} fps in {time.time() - t0:.1f}s -> {args.out}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
