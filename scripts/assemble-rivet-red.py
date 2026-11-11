"""Register/crop generated atlas cells; preserve their paint and transparency.

Usage: uv run --with pillow python scripts/assemble-rivet-red.py --bank PATH --shot PATH --parachute PATH
No painting, recoloring, background removal or AI generation happens here.
"""
import argparse
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'public/assets/combat-hd'


def cells(path, size):
    image = Image.open(path).convert('RGBA')
    for i in range(8):
        x, y = i % 4, i // 4
        yield image.crop((round(x*image.width/4), round(y*image.height/2),
                          round((x+1)*image.width/4), round((y+1)*image.height/2))).resize((size, size), Image.Resampling.LANCZOS)


def solid_box(image):
    return image.getchannel('A').point(lambda a: 255 if a >= 180 else 0).getbbox()


def atlas(frames, path, size):
    sheet = Image.new('RGBA', (4*size, 2*size))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, ((i % 4)*size, (i // 4)*size))
    sheet.save(path, lossless=True, method=6)
    print(path.relative_to(ROOT))


def main():
    args = argparse.ArgumentParser()
    for name in ['bank', 'shot', 'parachute']:
        args.add_argument('--'+name, type=Path)
    options = args.parse_args()
    if options.bank:
        frames = []
        for frame in cells(options.bank, 256):
            # Anchor the nose, not the asymmetrical wing bounding box.
            box = solid_box(frame.crop((100, 0, 156, 60)))
            assert box, 'Missing nose'
            top = box[1]
            tip = solid_box(frame.crop((100, top, 156, top+2)))
            x = 100+(tip[0]+tip[2])/2
            fixed = Image.new('RGBA', (256, 256))
            fixed.alpha_composite(frame, (round(128-x), 10-top))
            frames.append(fixed)
        atlas(frames, ART/'rivet-bank.webp', 256)
    if options.shot:
        atlas(list(cells(options.shot, 128)), ART/'polish/rivet-red.webp', 128)
    if options.parachute:
        frames = []
        for frame in cells(options.parachute, 256):
            # Keep the cargo at a fixed bottom-center while the cloth moves above it.
            box = solid_box(frame.crop((0, 180, 256, 256)))
            assert box, 'Missing crate'
            fixed = Image.new('RGBA', (256, 256))
            fixed.alpha_composite(frame, (round(128-(box[0]+box[2])/2), 241-180-box[3]))
            frames.append(fixed)
        atlas(frames, ART/'supply-parachute-v2.webp', 256)

    hud = ART/'hud'
    hud.mkdir(exist_ok=True)
    for pilot in ['nolan', 'cora', 'lyra', 'harlan', 'bento']:
        sheet = Image.open(ART/f'review/pickups-life-{pilot}.webp').convert('RGBA')
        for i in range(4):
            frame = sheet.crop((64*i, 0, 64*(i+1), 64))
            box = solid_box(frame)
            fixed = Image.new('RGBA', (64, 64))
            fixed.alpha_composite(frame, (round(32-(box[0]+box[2])/2), 0))
            fixed.save(hud/f'life-{pilot}-{i}.webp', lossless=True, method=6)
    print('HUD life frames registered at x=32, no lateral atlas drift')


if __name__ == '__main__':
    main()
