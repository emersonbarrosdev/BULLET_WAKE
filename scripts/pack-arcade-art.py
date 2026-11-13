"""Mechanical atlas extraction only. Native image generation owns all painting and alpha."""
from pathlib import Path
from PIL import Image
import json
ROOT=Path('C:/Users/emers/.codex/generated_images/01a1c229-53c7-79d2-a601-586148e85ea7')
OUT=Path('public/assets/arcade');OUT.mkdir(parents=True,exist_ok=True)
SOURCES={
 'rivet':('exec-802d44dd-28f6-4eb4-8272-917090389af1.png',4,2,256),
 'enemies':('exec-1f073135-3eab-46d9-b60d-2a1be2b0967e.png',4,4,256),
 'pilots':('exec-b5370296-8477-4faf-b078-7686008d2220.png',4,2,256),
 'boss':('exec-241975d1-db91-4966-8eaf-cd5c8c9ccd05.png',4,2,512),
 'scenery':('exec-68a65d44-badb-4c9f-8b1b-0b49ec0667dc.png',4,2,256),
 'explosion':('exec-a3bc1f87-960f-4e3e-a68a-d42ae093a4a6.png',4,4,256),
 'ufo':('exec-1acc06f7-0259-4e2f-9c14-4afc84aaf3b3.png',2,2,256),
}
report={}
for name,(source,cols,rows,size) in SOURCES.items():
 im=Image.open(ROOT/source).convert('RGBA');sheet=Image.new('RGBA',(size*cols,size*rows))
 for row in range(rows):
  for col in range(cols):
   top,bottom=round(row*im.height/rows),round((row+1)*im.height/rows)
   if name=='enemies':top,bottom=[(0,319),(327,674),(697,923),(956,1236)][row]
   cell=im.crop((round(col*im.width/cols),top,round((col+1)*im.width/cols),bottom))
   if name=='enemies':
    # Registration/cropping only: preserve the native alpha and original proportions.
    # Ignore disconnected neighbouring objects when finding a crop, without altering pixels.
    alpha=cell.getchannel('A');cw,ch=cell.size;seen=set();largest=[]
    for sy in range(ch):
     for sx in range(cw):
      key=sy*cw+sx
      if key in seen or alpha.getpixel((sx,sy))<128:continue
      todo=[(sx,sy)];seen.add(key);component=[]
      while todo:
       x,y=todo.pop();component.append((x,y))
       for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
        k=ny*cw+nx
        if 0<=nx<cw and 0<=ny<ch and k not in seen and alpha.getpixel((nx,ny))>=128:seen.add(k);todo.append((nx,ny))
      if len(component)>len(largest):largest=component
    xs,ys=zip(*largest);bounds=(max(0,min(xs)-3),max(0,min(ys)-3),min(cw,max(xs)+4),min(ch,max(ys)+4))
    cell=cell.crop(bounds);scale=size*.92/max(cell.size);cell=cell.resize((round(cell.width*scale),round(cell.height*scale)),Image.Resampling.LANCZOS)
    sheet.paste(cell,(col*size+(size-cell.width)//2,row*size+(size-cell.height)//2))
   else:sheet.paste(cell.resize((size,size),Image.Resampling.LANCZOS),(col*size,row*size))
 sheet.save(OUT/f'{name}.webp',quality=94,method=6)
 report[name]={'nativeSource':source,'columns':cols,'rows':rows,'frame':size,'alpha':sheet.getchannel('A').getextrema(),'bytes':(OUT/f'{name}.webp').stat().st_size}
(OUT/'manifest.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))
