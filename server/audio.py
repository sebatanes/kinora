"""Runs a project's sound.py with the synth Mix instrumented: writes every sound event and one stem per bus.

  python audio.py <project dir>

Output in <project>/.estudio/audio/: events.json, <bus>.wav per bus, mix.wav, peaks.json.
"""
import json
import os
import runpy
import sys
import traceback
import wave

import numpy as np

project = os.path.abspath(sys.argv[1])
os.chdir(project)
sys.path.insert(0, project)
out = os.path.join(project, ".estudio", "audio")
os.makedirs(out, exist_ok=True)

import synth  # noqa: E402

SR = synth.SR
events = []
sound_py = os.path.join(project, "sound.py")
orig_add = synth.Mix.add
orig_write = synth.Mix.write
orig_silence = synth.Mix.silence
silences = []


def caller():
    for fr in reversed(traceback.extract_stack()[:-2]):
        if os.path.abspath(fr.filename) == sound_py:
            return fr.lineno, (fr.line or "").strip()
    return None, ""


def add(self, sig, sec, bus="main", pan=0.0, gain=1.0):
    line, code = caller()
    arr = np.asarray(sig)
    dur = len(arr) / SR
    peak = float(np.abs(arr).max()) * float(gain) if len(arr) else 0.0
    events.append({"t": round(float(sec), 4), "dur": round(dur, 4), "bus": bus, "gain": round(float(gain), 4),
                   "pan": round(float(pan), 3), "peak": round(peak, 4), "line": line, "code": code})
    return orig_add(self, sig, sec, bus=bus, pan=pan, gain=gain)


def silence(self, start_sec, end_sec, fade=0.004):
    line, code = caller()
    silences.append({"t": float(start_sec), "t1": float(end_sec), "line": line, "code": code})
    return orig_silence(self, start_sec, end_sec, fade)


def write_wav(path, data):
    pcm = (np.clip(data, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def peaks(data, per_sec=200):
    hop = max(1, SR // per_sec)
    mono = np.abs(data).max(axis=1)
    n = len(mono) // hop
    return [round(float(v), 3) for v in mono[: n * hop].reshape(n, hop).max(axis=1)]


def write(self, path, true_peak_db=-2.0):
    result = orig_write(self, path, true_peak_db)
    total = sum(self.buses.values()) if self.buses else np.zeros((self.n, 2))
    shaped = np.tanh(total * 1.1) / np.tanh(1.1)
    from scipy.signal import resample_poly
    tp = np.abs(resample_poly(shaped, 4, 1, axis=0)).max()
    norm = 10 ** (true_peak_db / 20) / (tp + 1e-9)
    buses = {}
    for name, buf in self.buses.items():
        stem = buf * 1.1 / np.tanh(1.1) * norm
        write_wav(os.path.join(out, f"{name}.wav"), stem)
        buses[name] = {"archivo": f".estudio/audio/{name}.wav", "picos": peaks(stem)}
    write_wav(os.path.join(out, "mix.wav"), shaped * norm)
    with open(os.path.join(out, "events.json"), "w", encoding="utf-8") as fh:
        json.dump({"sr": SR, "duracion": self.n / SR, "eventos": events, "silencios": silences, "buses": buses,
                   "mix": {"archivo": ".estudio/audio/mix.wav", "picos": peaks(shaped * norm)}}, fh)
    return result


synth.Mix.add = add
synth.Mix.write = write
synth.Mix.silence = silence
runpy.run_path(sound_py, run_name="__main__")
print(json.dumps({"eventos": len(events)}))
