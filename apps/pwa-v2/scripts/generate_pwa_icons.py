#!/usr/bin/env python3
"""Generate PWA icons from the canonical FitTracker SVG brand mark."""
from pathlib import Path
import io

import cairosvg

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ICON_DIR = PUBLIC / "icons"
SOURCE = (PUBLIC / "fittracker-mark.svg").read_bytes()

# Render the exact brand on opaque graphite; maskable icon has a 20% inset
# so Android adaptive crops don't remove important mark geometry.
MASKABLE = b"""<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#0F141A"/>
<svg x="102" y="102" width="308" height="308" viewBox="0 0 512 512">""" + SOURCE.replace(
    b'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
    b"", 1
).replace(b"</svg>", b"", 1) + b"</svg></svg>"

def generate() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    images = [
        ("icon-192.png", SOURCE, 192),
        ("icon-512.png", SOURCE, 512),
        ("apple-touch-icon.png", SOURCE, 180),
        ("maskable-512.png", MASKABLE, 512),
    ]
    for filename, svg, size in images:
        destination = ICON_DIR / filename
        cairosvg.svg2png(bytestring=svg, write_to=str(destination), output_width=size, output_height=size)
        print(f"generated {destination.relative_to(ROOT)} ({size}x{size})")

if __name__ == "__main__":
    generate()
