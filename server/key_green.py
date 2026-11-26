"""Turns a pure green background transparent: python key_green.py <in.png> <out.png>"""
import sys

import numpy as np
from PIL import Image

img = np.asarray(Image.open(sys.argv[1]).convert("RGBA")).astype(np.float32)
r, g, b = img[..., 0], img[..., 1], img[..., 2]
greenness = g - np.maximum(r, b)
alpha = np.clip(1 - (greenness - 40) / 80, 0, 1)
spill = np.clip(greenness, 0, None) * (1 - alpha)
img[..., 1] = g - np.clip(greenness, 0, None) * np.where(alpha < 1, 1, 0.5) * (alpha > 0)
img[..., 3] = img[..., 3] * alpha
Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(sys.argv[2])
