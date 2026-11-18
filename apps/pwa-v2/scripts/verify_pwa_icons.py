#!/usr/bin/env python3
"""Validate PWA asset dimensions from PNG IHDR without third-party modules."""
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1] / "public" / "icons"
EXPECTED = {"icon-192.png": 192, "icon-512.png": 512, "maskable-512.png": 512, "apple-touch-icon.png": 180}

for filename, size in EXPECTED.items():
    path = ROOT / filename
    data = path.read_bytes()
    assert data[:8] == bytes((137, 80, 78, 71, 13, 10, 26, 10)), f"{filename} is not a PNG"
    assert data[12:16] == b"IHDR", f"{filename} has no IHDR"
    width, height = struct.unpack(">II", data[16:24])
    assert (width, height) == (size, size), f"{filename} has size {width}x{height}"
    assert len(data) > 500, f"{filename} unexpectedly small"
    print(f"OK {filename}: {width}x{height}, {len(data)} bytes")
