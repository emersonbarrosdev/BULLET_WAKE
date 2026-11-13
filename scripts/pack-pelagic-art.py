"""Mechanical atlas registration only; native image generation owns all painting/alpha edits.
Usage: uv run --with pillow python scripts/pack-pelagic-art.py --source-dir <native output folder>
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--source-dir', type=Path, required=True)
args = parser.parse_args()
destination = Path(__file__).resolve().parents[1] / 'public/assets/arcade'
sources = {
    'pelagic-coast': 'exec-42da8451-8f58-475a-84b3-1df164ded0e8.png',
    'pelagic-water': 'exec-32e6c8b2-8036-4590-98a3-0657c5d2d1a7.png',
    'stage1-hud-left': 'exec-05a05c7c-b7d9-4f3d-bc35-11a0c78e2f35.png',
    'stage1-hud-right': 'exec-f2a0d3f8-a00a-4092-a94f-5796c51ca014.png',
}
manifest = {'generation': 'native image_gen', 'processing': 'crop, resize, atlas packing; no painted pixels or alpha removal', 'assets': {}}
for name, source in sources.items():
    path = args.source_dir / source
    image = Image.open(path).convert('RGBA' if name == 'pelagic-coast' else 'RGB')
    if name == 'pelagic-coast':
        packed = Image.new('RGBA', (2048, 1024))
        for index in range(8):
            x, y = index % 4, index // 4
            cell = image.crop((round(x*image.width/4), round(y*image.height/2), round((x+1)*image.width/4), round((y+1)*image.height/2)))
            cell.thumbnail((480, 480), Image.Resampling.LANCZOS)
            packed.alpha_composite(cell, (x*512+(512-cell.width)//2, y*512+(512-cell.height)//2))
        packed.save(destination / (name+'.webp'), quality=95)
    else:
        packed = image.resize((1024, 1024) if name == 'pelagic-water' else (416, 864), Image.Resampling.LANCZOS)
        packed.save(destination / (name+'.webp'), lossless=name == 'pelagic-water', quality=96)
    output = destination / (name+'.webp')
    manifest['assets'][name] = {'nativeSource': source, 'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'size': packed.size, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}
(destination / 'pelagic-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
