"""Generate dependency-free PNG app icons from the LocalBeat record motif."""
import math
import struct
import zlib
from pathlib import Path

for size in (192, 512):
    pixels = bytearray()
    for y in range(size):
        pixels.append(0)
        for x in range(size):
            dx, dy = (x + .5) * 512 / size - 256, (y + .5) * 512 / size - 256
            radius = math.hypot(dx, dy)
            color = (24, 18, 37)
            if 112 < radius <= 164 or 17 < radius <= 60:
                color = (167, 139, 250)
            angle = math.degrees(math.atan2(dy, dx)) % 360
            if 154 < radius < 164 and (220 < angle < 270 or 40 < angle < 90):
                color = (233, 221, 255)
            pixels.extend(color)
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes(pixels))) + chunk(b'IEND', b'')
    Path(f'public/icon-{size}.png').write_bytes(png)
