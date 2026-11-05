"""Génère une icône PNG 32x32 (carré rouge arrondi) pour la tray/le launcher."""

from __future__ import annotations

import os
import struct
import zlib

SIZE = 32
OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "launcher",
    "assets",
    "icon.png",
)


def png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def main() -> None:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    radius = 7
    pixels = bytearray()
    for y in range(SIZE):
        pixels.append(0)  # filtre
        for x in range(SIZE):
            # Distance au bord pour arrondir les coins.
            dx = min(x, SIZE - 1 - x)
            dy = min(y, SIZE - 1 - y)
            inside = True
            if dx < radius and dy < radius:
                cx = radius - dx
                cy = radius - dy
                inside = cx * cx + cy * cy <= radius * radius
            if not inside:
                pixels += bytes((0, 0, 0, 0))
                continue
            # Dégradé rouge.
            t = (x + y) / (2 * SIZE)
            r = int(226 - 30 * t)
            g = int(58 + 20 * t)
            b = int(58 + 20 * t)
            pixels += bytes((r, g, b, 255))

    raw = b"".join(
        [struct.pack(">I", SIZE) + b"\x08\x06\x00\x00\x00"] and []
    )
    ihdr = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)
    data = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(bytes(pixels), 9))
        + png_chunk(b"IEND", b"")
    )
    with open(OUT, "wb") as handle:
        handle.write(data)
    print(f"icône : {OUT} ({len(data)} octets)")


if __name__ == "__main__":
    main()
