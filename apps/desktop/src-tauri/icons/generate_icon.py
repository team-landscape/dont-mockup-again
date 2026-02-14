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
    r = SIZE * 0.21
    c0 = (9, 15, 36)
    c1 = (22, 78, 164)
    c2 = (34, 211, 238)

    for y in range(SIZE):
        py = y + 0.5 - cy
        for x in range(SIZE):
            px = x + 0.5 - cx
            sd = rounded_rect_sd(px, py, w, h, r)
            if sd > 1.0:
                continue
            edge = clamp(0.5 - sd)

            t = (x + y) / (2.0 * (SIZE - 1))
            if t < 0.58:
                cr, cg, cb = mix(c0, c1, t / 0.58)
            else:
                cr, cg, cb = mix(c1, c2, (t - 0.58) / 0.42)

            # top-left neon bloom
            hx = (x - SIZE * 0.30) / (SIZE * 0.42)
            hy = (y - SIZE * 0.24) / (SIZE * 0.42)
            bloom = max(0.0, 1.0 - (hx * hx + hy * hy)) ** 1.8
            cr += bloom * 86.0
            cg += bloom * 60.0
            cb += bloom * 38.0

            # subtle bottom vignette
            v = clamp((y / SIZE) * 1.22)
            dark = 0.88 - v * 0.22
            cr *= dark
            cg *= dark
            cb *= dark

            canvas.blend(x, y, cr, cg, cb, edge)


def draw_rotated_card(
    canvas: Canvas,
    cx: float,
    cy: float,
    w: float,
    h: float,
    radius: float,
    angle_deg: float,
    fill: tuple[int, int, int],
    alpha: float,
) -> None:
    angle = math.radians(angle_deg)
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)

    half_w = w * 0.5
    half_h = h * 0.5
    pad = int(radius + 4)
    min_x = max(0, int(cx - half_w - pad))
    max_x = min(SIZE - 1, int(cx + half_w + pad))
    min_y = max(0, int(cy - half_h - pad))
    max_y = min(SIZE - 1, int(cy + half_h + pad))

    for y in range(min_y, max_y + 1):
        dy = y + 0.5 - cy
        for x in range(min_x, max_x + 1):
            dx = x + 0.5 - cx
            lx = dx * cos_a + dy * sin_a
            ly = -dx * sin_a + dy * cos_a
            sd = rounded_rect_sd(lx, ly, w, h, radius)
            if sd > 1.0:
                continue
            edge = clamp(0.5 - sd)
            canvas.blend(x, y, fill[0], fill[1], fill[2], alpha * edge)


def draw_front_card(canvas: Canvas) -> None:
    cx = SIZE * 0.53
    cy = SIZE * 0.55
    w = SIZE * 0.54
    h = SIZE * 0.69
    r = SIZE * 0.075
    angle = -11.0

    # white frame
    draw_rotated_card(canvas, cx, cy, w, h, r, angle, (244, 249, 255), 0.94)
    # inner content
    draw_rotated_card(canvas, cx, cy, w - 24, h - 24, max(8, r - 10), angle, (6, 12, 28), 1.0)

    rad = math.radians(angle)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)

    half_w = w * 0.5
    half_h = h * 0.5
    min_x = max(0, int(cx - half_w - 6))
    max_x = min(SIZE - 1, int(cx + half_w + 6))
    min_y = max(0, int(cy - half_h - 6))
    max_y = min(SIZE - 1, int(cy + half_h + 6))

    iw = w - 24
    ih = h - 24
    ir = max(8, r - 10)

    for y in range(min_y, max_y + 1):
        dy = y + 0.5 - cy
        for x in range(min_x, max_x + 1):
            dx = x + 0.5 - cx
            lx = dx * cos_a + dy * sin_a
            ly = -dx * sin_a + dy * cos_a
            sd = rounded_rect_sd(lx, ly, iw, ih, ir)
            if sd > 0.8:
                continue

            u = clamp((lx + iw * 0.5) / iw)
            v = clamp((ly + ih * 0.5) / ih)
            base = mix((10, 18, 44), (16, 50, 114), v * 0.9 + 0.05)
            glow = mix((24, 171, 242), (125, 211, 252), u)

            # content stripe / lens flare
            flare = max(0.0, 1.0 - abs((lx + ly * 1.7) / (iw * 0.36))) ** 2.0
            grid = 0.0
            if abs((ly + ih * 0.15) % 62.0 - 31.0) < 1.0:
                grid = 0.22

            cr = base[0] * (1.0 - 0.22 * u) + glow[0] * (0.12 + flare * 0.35)
            cg = base[1] * (1.0 - 0.22 * u) + glow[1] * (0.12 + flare * 0.35)
            cb = base[2] * (1.0 - 0.22 * u) + glow[2] * (0.12 + flare * 0.35)

            if grid > 0:
                cr += 255.0 * grid
                cg += 255.0 * grid
                cb += 255.0 * grid

            edge = clamp(0.5 - sd)
            canvas.blend(x, y, cr, cg, cb, edge)

    # symbol: geometric "D"
    sx = cx - 36
    sy = cy - 20
    for y in range(int(sy - 170), int(sy + 170)):
        if y < 0 or y >= SIZE:
            continue
        for x in range(int(sx - 170), int(sx + 170)):
            if x < 0 or x >= SIZE:
                continue
            dx = x + 0.5 - sx
            dy = y + 0.5 - sy

            outer = (dx * dx) / (150 * 150) + (dy * dy) / (126 * 126) <= 1.0 and dx > -98
            inner = (dx * dx) / (98 * 98) + (dy * dy) / (82 * 82) <= 1.0 and dx > -62
            stem = -120 <= dx <= -72 and abs(dy) <= 126
            shape = stem or (outer and not inner)
            if not shape:
                continue

            # diagonal cut for motion
            if (dx + dy * 0.9) > 116:
                continue

            # glossy ramp
            k = clamp((dy + 126) / 252)
            c = mix((238, 246, 255), (123, 229, 255), k)
            alpha = 0.94
            if abs((dx + dy * 0.9) - 32) < 2.0:
                alpha = 0.98
            canvas.blend(x, y, c[0], c[1], c[2], alpha)

    # sparkle accent
    star_cx = cx + 210
    star_cy = cy - 250
    for y in range(int(star_cy - 78), int(star_cy + 79)):
        if y < 0 or y >= SIZE:
            continue
        for x in range(int(star_cx - 78), int(star_cx + 79)):
            if x < 0 or x >= SIZE:
                continue
            dx = abs(x + 0.5 - star_cx)
            dy = abs(y + 0.5 - star_cy)
            d = min(dx + dy * 0.45, dx * 0.45 + dy)
            if d > 44:
                continue
            a = clamp((44 - d) / 44) ** 1.8 * 0.92
            col = mix((188, 250, 255), (255, 255, 255), clamp(d / 44))
            canvas.blend(x, y, col[0], col[1], col[2], a)


def main() -> None:
    canvas = Canvas(SIZE)

    # base
    draw_background(canvas)

    # depth cards
    draw_rotated_card(
        canvas,
        cx=SIZE * 0.45,
        cy=SIZE * 0.58,
        w=SIZE * 0.54,
        h=SIZE * 0.68,
        radius=SIZE * 0.07,
        angle_deg=-18.0,
        fill=(2, 6, 18),
        alpha=0.42,
    )
    draw_front_card(canvas)

    canvas.write_png(OUT_PATH)
    print(f"Icon generated: {OUT_PATH}")


if __name__ == "__main__":
    main()
