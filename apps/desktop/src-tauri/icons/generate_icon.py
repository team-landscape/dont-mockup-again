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
    w = h = SIZE * 0.8125  # 832 at 1024
    r = SIZE * 0.1836      # ~188 at 1024

    for y in range(SIZE):
        py = y + 0.5 - cy
        for x in range(SIZE):
            px = x + 0.5 - cx
            sd = rounded_rect_sd(px, py, w, h, r)
            if sd > 1.0:
                continue
            edge = clamp(0.5 - sd)

            # Subtle monochrome glow in the same spirit as docs/index.html.
            gx = (x - SIZE * 0.32) / (SIZE * 0.58)
            gy = (y - SIZE * 0.24) / (SIZE * 0.58)
            glow = max(0.0, 1.0 - gx * gx - gy * gy) ** 2.2
            base = 17.0 + glow * 8.0
            canvas.blend(x, y, base, base, base + 1.0, edge)


def point_segment_distance(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    abx = bx - ax
    aby = by - ay
    apx = px - ax
    apy = py - ay
    denom = abx * abx + aby * aby
    if denom <= 1e-6:
        return math.hypot(apx, apy)
    t = clamp((apx * abx + apy * aby) / denom)
    qx = ax + abx * t
    qy = ay + aby * t
    return math.hypot(px - qx, py - qy)


def inside_dma_monogram(x: float, y: float) -> bool:
    outer_stem = 332.0 <= x <= 498.0 and 252.0 <= y <= 772.0
    outer_bowl = ((x - 498.0) ** 2) / (262.0 ** 2) + ((y - 512.0) ** 2) / (260.0 ** 2) <= 1.0 and x >= 498.0

    inner_stem = 420.0 <= x <= 498.0 and 340.0 <= y <= 684.0
    inner_bowl = ((x - 498.0) ** 2) / (174.0 ** 2) + ((y - 512.0) ** 2) / (172.0 ** 2) <= 1.0 and x >= 498.0

    return (outer_stem or outer_bowl) and not (inner_stem or inner_bowl)


def inside_slash(x: float, y: float) -> bool:
    d = point_segment_distance(x, y, 470.0, 666.0, 666.0, 362.0)
    return d <= 31.0


def draw_shape_aa(
    canvas: Canvas,
    min_x: int,
    max_x: int,
    min_y: int,
    max_y: int,
    r: float,
    g: float,
    b: float,
    contains: callable,
) -> None:
    offsets = ((0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75))
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            coverage = 0.0
            for ox, oy in offsets:
                if contains(x + ox, y + oy):
                    coverage += 0.25
            if coverage > 0.0:
                canvas.blend(x, y, r, g, b, coverage)


def draw_dma_icon(canvas: Canvas) -> None:
    draw_shape_aa(
        canvas,
        min_x=280,
        max_x=804,
        min_y=200,
        max_y=824,
        r=245.0,
        g=245.0,
        b=245.0,
        contains=inside_dma_monogram,
    )
    draw_shape_aa(
        canvas,
        min_x=420,
        max_x=716,
        min_y=312,
        max_y=716,
        r=139.0,
        g=141.0,
        b=145.0,
        contains=inside_slash,
    )


def main() -> None:
    canvas = Canvas(SIZE)
    draw_background(canvas)
    draw_dma_icon(canvas)
    canvas.write_png(OUT_PATH)
    print(f"Icon generated: {OUT_PATH}")


if __name__ == "__main__":
    main()
