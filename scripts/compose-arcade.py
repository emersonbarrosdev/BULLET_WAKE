"""Original arcade arrangements; sampled GM instruments, distinct motifs and loop-tail wrap.
uv run --with mido --with numpy --with soundfile python scripts/compose-arcade.py
Uses the project's licensed GeneralUser GS installation; never borrows game recordings.
"""
from pathlib import Path
import json, subprocess, shutil
import mido, numpy as np, soundfile as sf

OUT=Path('public/assets/audio/arcade');OUT.mkdir(parents=True,exist_ok=True)
TMP=Path('tmp/arcade-score');TMP.mkdir(parents=True,exist_ok=True)
FLUID=next(Path('tmp/audio-tools/fluid').rglob('fluidsynth.exe'))
SF=Path('tmp/audio-tools/GeneralUser-GS.sf2')
FFMPEG=shutil.which('ffmpeg')
# Each has a separate key, chord movement, rhythm, instrumentation and melodic contour.
SCORES={
 'menu':(132,60,[0,5,9,7],[12,16,19,21,19,16,14,12],80,32,48),
 'select':(118,62,[0,7,5,9],[12,14,19,16,14,12,9,7],10,34,89),
 'stage1':(142,60,[0,5,7,0,9,5,2,7],[12,16,19,16,21,19,17,14],114,33,81),
 'boss1':(154,62,[0,3,7,5],[12,15,19,22,19,17,15,14],81,38,62),
 'stage2':(148,65,[0,9,5,7],[12,19,16,14,21,19,16,17],80,38,88),
 'boss2':(162,57,[0,5,3,7],[12,15,19,24,22,19,17,15],62,39,81),
 'victory':(136,60,[0,5,7,0],[12,16,19,24,19,21,23,24],61,33,48),
 'defeat':(96,60,[9,5,7,0],[19,17,16,14,12,9,7,12],10,32,48),
}
metadata={}
for theme,(bpm,root,changes,motif,lead,bass,pad) in SCORES.items():
 bars=4 if theme in ('victory','defeat') else 32
 events={c:[] for c in [0,1,2,3,9]};programs={0:lead,1:bass,2:pad,3:11 if theme=='stage1' else 98,9:25}
 def note(c,n,t,d,v):
  events[c].append((round(t*480),mido.Message('note_on',channel=c,note=int(n),velocity=int(v))))
  events[c].append((round((t+d)*480),mido.Message('note_off',channel=c,note=int(n),velocity=0)))
 for bar in range(bars):
  chord=root+changes[bar%len(changes)];section=(bar//8)%4;bridge=section==2
  # A/B/bridge/reprise; varied rests leave room for gameplay effects.
  for eighth in range(8):
   t=bar*4+eighth/2
   if eighth in ([0,2,3,5,6] if theme=='stage1' else [0,1,3,4,6,7]) and not(bridge and eighth%2):
    p=root+motif[(eighth+bar%4)%8]+(12 if section==3 and bar%4==3 else 0)
    note(0,p,t,.32 if eighth!=6 else .7,64+(eighth*3+bar)%13)
   note(1,chord-24+([0,0,7,12,0,7,10,7][eighth]),t,.35,84 if eighth%2==0 else 68)
   if eighth%2==1:
    for interval in (0,4 if changes[bar%len(changes)]!=9 else 3,7):note(2,chord+interval,t,.19,35 if bridge else 44)
   if section in (1,3) and eighth in (1,4,7):note(3,chord+12+[0,7,12][eighth%3],t+.25,.13,44)
   note(9,42 if eighth!=7 or bar%4!=3 else 46,t,.1,34+(eighth%3)*6)
   if eighth in (0,4) or theme.startswith('boss') and eighth in (3,7):note(9,36,t,.16,100)
   if eighth in (2,6):note(9,38,t+.008,.13,86)
   if theme=='stage1' and eighth in (1,3,5,7):note(9,[64,63,62,63][eighth//2],t+.12,.16,56)
   if bar%8==7 and eighth>=6:note(9,45+(eighth-6)*2,t+.25,.14,72)
  if bar%8==0:note(9,49,bar*4,.8,55)
 midi=mido.MidiFile(ticks_per_beat=480)
 tempo=mido.MidiTrack();tempo.append(mido.MetaMessage('set_tempo',tempo=mido.bpm2tempo(bpm)));midi.tracks.append(tempo)
 for c in events:
  tr=mido.MidiTrack();midi.tracks.append(tr);tr.append(mido.Message('program_change',channel=c,program=programs[c]))
  for control,value in [(7,100),(10,{0:58,1:64,2:76,3:42,9:64}[c]),(91,22),(93,12)]:tr.append(mido.Message('control_change',channel=c,control=control,value=value))
  last=0
  for at,event in sorted(events[c],key=lambda e:(e[0],e[1].type=='note_on')):tr.append(event.copy(time=at-last));last=at
  tr.append(mido.MetaMessage('end_of_track',time=max(0,bars*4*480-last)))
 mid=TMP/f'{theme}.mid';wav=TMP/f'{theme}.wav';midi.save(mid)
 subprocess.run([str(FLUID),'-ni','-F',str(wav),'-r','44100','-g','.6',str(SF),str(mid)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 audio,rate=sf.read(wav);length=round(bars*4*60/bpm*rate);tail=audio[length:];audio=audio[:length]
 if theme not in ('victory','defeat'):
  n=min(len(tail),len(audio));audio[:n]+=tail[:n]
 else:audio[-round(rate*.8):]*=np.linspace(1,0,round(rate*.8))[:,None]
 # Peak limiting + conservative normalization; transport supplies additional quiet background gain.
 audio=np.tanh(audio*1.15);audio*=.78/max(.001,np.max(np.abs(audio)))
 sf.write(wav,audio,rate,subtype='PCM_16')
 subprocess.run([FFMPEG,'-y','-hide_banner','-loglevel','error','-i',str(wav),'-c:a','libvorbis','-q:a','5',str(OUT/f'{theme}.ogg')],check=True)
 metadata[theme]={'bpm':bpm,'bars':bars,'seconds':len(audio)/rate,'peak':float(np.max(np.abs(audio))),'rms':float(np.sqrt(np.mean(audio**2))),'programs':programs,'original':True}
 print(theme,metadata[theme]['seconds'],flush=True)
(OUT/'score.json').write_text(json.dumps(metadata,indent=2),encoding='utf8')
