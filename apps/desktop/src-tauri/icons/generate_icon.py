#!/usr/bin/env python3
"""
Generate a custom app icon PNG without external dependencies.
Output: apps/desktop/src-tauri/icons/icon.png
"""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path


SIZE = 1024
OUT_PATH = Path(__file__).resolve().parent / "icon.png"


def clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    if value < lo:
        return lo
    if value > hi:
        return hi
    return value


def rounded_rect_sd(px: float, py: float, w: float, h: float, r: float) -> float:
    qx = abs(px) - (w * 0.5 - r)
    qy = abs(py) - (h * 0.5 - r)
    ox = max(qx, 0.0)
    oy = max(qy, 0.0)
    outside = math.hypot(ox, oy)
    inside = min(max(qx, qy), 0.0)
    return outside + inside - r


def mix(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[float, float, float]:
    t = clamp(t)
    return (
        c1[0] + (c2[0] - c1[0]) * t,
        c1[1] + (c2[1] - c1[1]) * t,
        c1[2] + (c2[2] - c1[2]) * t,
    )


class Canvas:
    def __init__(self, size: int) -> None:
        self.size = size
        self.pixels = bytearray(size * size * 4)

    def blend(self, x: int, y: int, r: float, g: float, b: float, a: float) -> None:
        if x < 0 or y < 0 or x >= self.size or y >= self.size:
            return
        a = clamp(a)
        if a <= 0:
            return
        idx = (y * self.size + x) * 4
        dr = self.pixels[idx] / 255.0
        dg = self.pixels[idx + 1] / 255.0
        db = self.pixels[idx + 2] / 255.0
        da = self.pixels[idx + 3] / 255.0
        out_a = a + da * (1.0 - a)
        if out_a <= 0:
            return
        sr = clamp(r / 255.0)
        sg = clamp(g / 255.0)
        sb = clamp(b / 255.0)
        out_r = (sr * a + dr * da * (1.0 - a)) / out_a
        out_g = (sg * a + dg * da * (1.0 - a)) / out_a
        out_b = (sb * a + db * da * (1.0 - a)) / out_a
        self.pixels[idx] = int(clamp(out_r) * 255 + 0.5)
        self.pixels[idx + 1] = int(clamp(out_g) * 255 + 0.5)
        self.pixels[idx + 2] = int(clamp(out_b) * 255 + 0.5)
        self.pixels[idx + 3] = int(clamp(out_a) * 255 + 0.5)

    def write_png(self, path: Path) -> None:
        raw = bytearray()
        row_bytes = self.size * 4
        for y in range(self.size):
            raw.append(0)  # filter type 0
            start = y * row_bytes
            raw.extend(self.pixels[start : start + row_bytes])

        compressed = zlib.compress(bytes(raw), level=9)

        def chunk(tag: bytes, data: bytes) -> bytes:
            return (
                struct.pack(">I", len(data))
                + tag
                + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
            )

        ihdr = struct.pack(">IIBBBBB", self.size, self.size, 8, 6, 0, 0, 0)
        png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")
        path.write_bytes(png)


def draw_background(canvas: Canvas) -> None:
    cx = cy = SIZE * 0.5
    w = h = SIZE * 0.88
    r = SIZE * 0.2
    c0 = (5, 16, 36)
    c1 = (15, 89, 182)

    for y in range(SIZE):
        py = y + 0.5 - cy
        for x in range(SIZE):
            px = x + 0.5 - cx
            sd = rounded_rect_sd(px, py, w, h, r)
            if sd > 1.0:
                continue
            edge = clamp(0.5 - sd)

            t = clamp((x * 0.62 + y * 0.38) / (SIZE - 1))
            cr, cg, cb = mix(c0, c1, t)

            glow_x = (x - SIZE * 0.28) / (SIZE * 0.5)
            glow_y = (y - SIZE * 0.24) / (SIZE * 0.5)
            glow = max(0.0, 1.0 - glow_x * glow_x - glow_y * glow_y) ** 2.2
            cr += 42.0 * glow
            cg += 32.0 * glow
            cb += 24.0 * glow

            vignette = 0.9 - clamp(y / SIZE) * 0.14
            canvas.blend(x, y, cr * vignette, cg * vignette, cb * vignette, edge)


def draw_card(canvas: Canvas) -> tuple[float, float]:
    cx = SIZE * 0.5
    cy = SIZE * 0.53
    w = SIZE * 0.58
    h = SIZE * 0.7
    r = SIZE * 0.08

    half_w = w * 0.5
    half_h = h * 0.5
    pad = int(r + 6)
    min_x = max(0, int(cx - half_w - pad))
    max_x = min(SIZE - 1, int(cx + half_w + pad))
    min_y = max(0, int(cy - half_h - pad))
    max_y = min(SIZE - 1, int(cy + half_h + pad))

    # soft shadow
    for y in range(min_y, max_y + 1):
        sy = y + 0.5 - (cy + SIZE * 0.02)
        for x in range(min_x, max_x + 1):
            sx = x + 0.5 - cx
            sd = rounded_rect_sd(sx, sy, w, h, r)
            if sd > 18.0:
                continue
            fade = clamp((18.0 - sd) / 18.0)
            canvas.blend(x, y, 0, 6, 16, fade * 0.22)

    # frame
    for y in range(min_y, max_y + 1):
        py = y + 0.5 - cy
        for x in range(min_x, max_x + 1):
            px = x + 0.5 - cx
            sd = rounded_rect_sd(px, py, w, h, r)
            if sd > 1.0:
                continue
            edge = clamp(0.5 - sd)
            canvas.blend(x, y, 242, 248, 255, edge * 0.94)

    # inner panel
    iw = w - 26
    ih = h - 26
    ir = max(8.0, r - 11.0)
    half_iw = iw * 0.5
    half_ih = ih * 0.5
    min_x = max(0, int(cx - half_iw - 2))
    max_x = min(SIZE - 1, int(cx + half_iw + 2))
    min_y = max(0, int(cy - half_ih - 2))
    max_y = min(SIZE - 1, int(cy + half_ih + 2))

    for y in range(min_y, max_y + 1):
        py = y + 0.5 - cy
        for x in range(min_x, max_x + 1):
            px = x + 0.5 - cx
            sd = rounded_rect_sd(px, py, iw, ih, ir)
            if sd > 0.8:
                continue
            edge = clamp(0.5 - sd)

            u = clamp((px + half_iw) / iw)
            v = clamp((py + half_ih) / ih)
            base = mix((8, 22, 52), (15, 44, 96), v)
            highlight = max(0.0, 1.0 - abs((px + py * 1.2) / (iw * 0.5))) ** 2.0

            cr = base[0] + 18.0 * u + 42.0 * highlight
            cg = base[1] + 10.0 * u + 36.0 * highlight
            cb = base[2] + 6.0 * u + 50.0 * highlight
            canvas.blend(x, y, cr, cg, cb, edge)

    return cx, cy


def draw_monogram(canvas: Canvas, cx: float, cy: float) -> None:
    cx -= SIZE * 0.02
    cy -= SIZE * 0.01
    min_x = max(0, int(cx - 170))
    max_x = min(SIZE - 1, int(cx + 170))
    min_y = max(0, int(cy - 170))
    max_y = min(SIZE - 1, int(cy + 170))

    for y in range(min_y, max_y + 1):
        dy = y + 0.5 - cy
        for x in range(min_x, max_x + 1):
            dx = x + 0.5 - cx

            stem = (-134.0 <= dx <= -84.0) and (abs(dy) <= 112.0)
            outer = (dx * dx) / (140.0 * 140.0) + (dy * dy) / (112.0 * 112.0) <= 1.0 and dx > -28.0
            inner = (dx * dx) / (90.0 * 90.0) + (dy * dy) / (70.0 * 70.0) <= 1.0 and dx > -18.0
            ring = outer and not inner
            shape = stem or ring
            if not shape:
                continue

            # slight diagonal trim for motion
            if dx + dy * 0.45 > 118.0:
                continue

            t = clamp((dy + 112.0) / 224.0)
            cr, cg, cb = mix((244, 249, 255), (184, 219, 255), t)
            canvas.blend(x, y, cr, cg, cb, 0.96)


def main() -> None:
    canvas = Canvas(SIZE)
    draw_background(canvas)
    card_center = draw_card(canvas)
    draw_monogram(canvas, *card_center)
    canvas.write_png(OUT_PATH)
    print(f"Icon generated: {OUT_PATH}")


if __name__ == "__main__":
    main()
