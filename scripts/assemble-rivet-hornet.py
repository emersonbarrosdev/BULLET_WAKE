"""Slice and register generated fighter/VFX sheets, preserving native RGBA artwork."""
from pathlib import Path
import argparse
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
ART=ROOT/'public/assets/combat-hd'

def box(im):
    return im.getchannel('A').point(lambda a:255 if a>=180 else 0).getbbox()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--ship',type=Path)
    parser.add_argument('--effect',type=Path)
    args=parser.parse_args()
    if args.ship:
        src=Image.open(args.ship).convert('RGBA')
        neutral=Image.new('RGBA',(1024,256));bank=Image.new('RGBA',(1024,512))
        for i in range(12):
            x,y=i%4,i//4
            f=src.crop((round(x*src.width/4),round(y*src.height/3),round((x+1)*src.width/4),round((y+1)*src.height/3))).resize((256,256),Image.Resampling.LANCZOS)
            top=box(f.crop((100,0,156,60)))[1]
            tip=box(f.crop((100,top,156,top+2)))
            fixed=Image.new('RGBA',(256,256));fixed.alpha_composite(f,(round(128-100-(tip[0]+tip[2])/2),10-top))
            (neutral if y==0 else bank).alpha_composite(fixed,(x*256,0 if y==0 else (y-1)*256))
        neutral.save(ART/'rivet-hornet.webp',lossless=True,method=6)
        bank.save(ART/'rivet-hornet-bank.webp',lossless=True,method=6)
        print('Fighter atlas: neutral / right-wing-down / left-wing-down, fixed nose x128/y10')
    if args.effect:
        src=Image.open(args.effect).convert('RGBA');sheet=Image.new('RGBA',(1024,512))
        assert src.getchannel('A').getextrema()[0]==0, 'VFX must have a truly transparent background'
        for i in range(8):
            x,y=i%4,i//4
            f=src.crop((round(x*src.width/4),round(y*src.height/2),round((x+1)*src.width/4),round((y+1)*src.height/2))).resize((256,256),Image.Resampling.LANCZOS)
            bottom=box(f.crop((90,180,166,256)))
            fixed=Image.new('RGBA',(256,256));fixed.alpha_composite(f,(0,246-180-bottom[3]))
            sheet.alpha_composite(fixed,(x*256,y*256))
        sheet.save(ART/'polish/scarlet-storm.webp',lossless=True,method=6)
        print('Scarlet Storm: eight 256px frames, emitter at y246, original alpha preserved')

if __name__=='__main__':main()
