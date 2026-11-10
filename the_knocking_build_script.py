import math, os, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = "/workspace/knocking"
FRAMES = f"{ROOT}/frames_png"
SEGS = f"{ROOT}/segs"
os.makedirs(FRAMES, exist_ok=True)
os.makedirs(SEGS, exist_ok=True)
W, H = 1080, 1920
FONT = "/home/appuser/.local/lib/python3.12/site-packages/matplotlib/mpl-data/fonts/ttf/DejaVuSans-Bold.ttf"
FFMPEG = "/home/appuser/.local/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2"
rng = np.random.default_rng(42)

def bg(seed, brightness=14):
    r = np.random.default_rng(seed)
    base = r.integers(0, brightness, (H // 4, W // 4, 3), dtype=np.uint8)
    im = Image.fromarray(base, "RGB").resize((W, H), Image.BILINEAR)
    n = r.integers(0, 26, (H // 3, W // 3), dtype=np.uint8)
    noise = Image.fromarray(np.stack([n] * 3, -1), "RGB").resize((W, H), Image.BILINEAR)
    im = Image.blend(im, noise, 0.45)
    vig = Image.new("L", (W, H), 0)
    dv = ImageDraw.Draw(vig)
    dv.ellipse([-W // 3, -H // 5, W + W // 3, H + H // 5], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(240))
    black = Image.new("RGB", (W, H), (2, 2, 4))
    im = Image.composite(im, black, vig)
    return im

def wrap(draw, text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= maxw:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def caption(im, text, tag=None, seed=1, red=True, bright=14):
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, 62)
    ftag = ImageFont.truetype(FONT, 54)
    lines = wrap(d, text, f, 880)
    total = len(lines) * 82
    y0 = int(H * 0.62) - total // 2
    if tag:
        tw = d.textlength(tag, font=ftag)
        d.text(((W - tw) / 2 + 4, y0 - 120 + 4), tag, font=ftag, fill=(120, 0, 0))
        d.text(((W - tw) / 2, y0 - 120), tag, font=ftag, fill=(255, 40, 40))
    for i, ln in enumerate(lines):
        x = (W - d.textlength(ln, font=f)) / 2
        y = y0 + i * 82
        if red:
            d.text((x + 5, y + 5), ln, font=f, fill=(160, 10, 10))
        d.text((x, y), ln, font=f, fill=(240, 240, 240))
    return im

SEGS_DEF = [
    ("f1", 5.0,  "The knocking saved my life. Because whoever — or whatever — was knocking... wasn't trying to get in.", "TRUE STORY.", 11),
    ("f2", 10.0, "It was 2 AM. Home alone. Three knocks on the front door. Slow. Heavy. The peephole: nobody there.", None, 22),
    ("f3", 15.0, "A text from Sara: \"I'm five minutes away.\" Then three more knocks — from INSIDE the apartment. Her bedroom door.", None, 33),
    ("f4", 15.0, "I called Sara, whispering. She said: \"Look at your window.\" Across the street, on the 4th floor of the parking garage... someone was waving. In Sara's uniform.", None, 44),
    ("f5", 1.5,  None, None, 55),
    ("f6", 5.5,  "...Then who's knocking inside my apartment?", None, 66),
    ("f7", 6.0,  "Sara found me on the kitchen floor. Her bedroom door — still swinging. And two words in the fog on the window: \"NEXT TIME.\"", None, 77),
    ("f8", 2.0,  "PART 2 TOMORROW", "FOLLOW — IF YOU DARE", 88),
]

for name, dur, text, tag, seed in SEGS_DEF:
    if text is None:
        im = Image.new("RGB", (W, H), (0, 0, 0))
    else:
        im = bg(seed)
        caption(im, text, tag, seed)
    im.save(f"{FRAMES}/{name}.png")
    print("frame", name)

# ---------- AUDIO ----------
SR = 44100
T = 60.0
N = int(SR * T)
t = np.arange(N) / SR
audio = np.zeros(N)

def lowpass(x, cutoff):
    dt = 1.0 / SR
    rc = 1.0 / (2 * math.pi * cutoff)
    a = dt / (rc + dt)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc)
        y[i] = acc
    return y

# drone
lfo = 0.75 + 0.25 * np.sin(2 * math.pi * 0.08 * t)
drone = 0.42 * np.sin(2 * math.pi * 42 * t) + 0.18 * np.sin(2 * math.pi * 84 * t + 0.5) + 0.10 * np.sin(2 * math.pi * 63 * t)
brown = lowpass(np.cumsum(rng.standard_normal(N)), 220)
brown = brown / (np.abs(brown).max() + 1e-9)
drone = (drone * lfo + 0.22 * brown) * 0.55

# envelope: full -> hard silence at 45.0 -> back at 46.5
env = np.ones(N)
env[int(44.7 * SR):int(45.0 * SR)] = np.linspace(1, 0, int(0.3 * SR))
env[int(45.0 * SR):int(46.5 * SR)] = 0.0
ramp = np.linspace(0, 1, int(0.4 * SR))
env[int(46.5 * SR):int(46.9 * SR)] = ramp
fade = np.linspace(1, 0, int(1.2 * SR))
env[int(58.8 * SR):] = fade

def add(buf, start, x):
    i = int(start * SR)
    j = min(N, i + len(x))
    if i < N:
        buf[i:j] += x[: j - i]

def knock(vol=1.0, dur=0.35):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    body = lowpass(np.cumsum(rng.standard_normal(n)), 260) * np.exp(-tt * 16)
    thump = np.sin(2 * math.pi * 55 * tt) * np.exp(-tt * 10)
    x = (body / (np.abs(body).max() + 1e-9) * 0.7 + thump * 0.8) * vol
    return x

def heartbeat():
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    def th(vol, f=48):
        return np.sin(2 * math.pi * f * tt) * np.exp(-tt * 22) * vol
    return th(0.9) + np.concatenate([np.zeros(int(0.18 * SR)), th(0.6)])[:n]

hb = heartbeat()
tt2 = 0.0
while tt2 < 40.0:
    add(audio, tt2, hb * 0.30)
    tt2 += 1.5
tt2 = 47.0
while tt2 < 58.5:
    add(audio, tt2, hb * 0.42)
    tt2 += 1.1

for st in (10.0, 10.6, 11.2):
    add(audio, st, knock(0.75))
for st in (18.0, 18.6, 19.2):
    add(audio, st, knock(0.95))
add(audio, 30.5, knock(0.5, 0.25))
add(audio, 46.5, knock(1.6, 0.5))

audio += drone
audio *= env
audio = audio / (np.abs(audio).max() + 1e-9) * 0.85
pcm = (audio * 32767).astype(np.int16)
with wave.open(f"{ROOT}/audio.wav", "wb") as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(pcm.tobytes())
print("audio done")

# ---------- VIDEO ----------
for name, dur, text, tag, seed in SEGS_DEF:
    out = f"{SEGS}/{name}.mp4"
    vf = (
        "scale=1134:2016,"
        f"crop=1080:1920:x='27+(54-27)*t/{dur}':y='48*(t/{dur})',"
        "noise=alls=7:allf=t+u,vignette=PI/5,format=yuv420p"
    )
    cmd = [FFMPEG, "-y", "-loop", "1", "-framerate", "30", "-t", str(dur),
           "-i", f"{FRAMES}/{name}.png", "-vf", vf,
           "-r", "30", "-c:v", "libx264", "-preset", "fast", "-crf", "20", out]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-1500:])
        raise SystemExit(1)
    print("seg", name)

with open(f"{SEGS}/list.txt", "w") as f:
    for name, dur, *_ in SEGS_DEF:
        f.write(f"file '{name}.mp4'\n")

r = subprocess.run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", f"{SEGS}/list.txt",
                    "-i", f"{ROOT}/audio.wav", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
                    "-shortest", "-movflags", "+faststart", f"{ROOT}/the_knocking.mp4"],
                   capture_output=True, text=True)
if r.returncode != 0:
    print(r.stderr[-1500:])
    raise SystemExit(1)
print("FINAL OK")
