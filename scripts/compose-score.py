"""Original 48-bar nu-metal compositions. Guitar MIDI drives the METAL-GTX sampler.
Bass and acoustic drums render with FluidSynth + GeneralUser GS.

uv run --with mido python scripts/compose-score.py
No melodies or recordings from existing games/films are used.
"""
from pathlib import Path
import json,sys
import mido

OUT = Path('tmp/audio-tools/score')
OUT.mkdir(parents=True, exist_ok=True)
SCORES = {
 'menu':(118,47,[0,0,3,1,0,5,3,1],[12,15,14,10,12,19,17,13]),
 'stage1':(138,45,[0,7,3,10,5,0,8,7],[0,7,10,12,15,12,10,7]),
 'victory':(126,47,[0,5,7,0],[12,16,19,24,19,16,14,12]),
 'boss':(156,42,[0,0,1,0,6,5,1,0],[12,13,12,18,17,13,12,10]),
}

metadata = json.loads(Path('public/assets/audio/score.json').read_text(encoding='utf-8')) if Path('public/assets/audio/score.json').exists() else {}
for theme,(bpm,root,progression,phrases) in SCORES.items():
    bars=4 if theme=='victory' else 48
    events={c:[] for c in [1,2,3,5,9]}
    programs={1:27,2:28,3:38 if theme=='stage1' else 33,5:28,9:24 if theme=='stage1' else 0}
    def note(c,pitch,at,length,velocity):
        if pitch<0:return
        events[c].append((round(at*480),mido.Message('note_on',channel=c,note=pitch,velocity=velocity)))
        events[c].append((round((at+length)*480),mido.Message('note_off',channel=c,note=pitch,velocity=0)))
    for bar in range(bars):
        section=bar//8;bridge=section==4;intro=theme=='menu' and bar<4
        chord=root+progression[bar%8];guitar=chord-12
        # Drop-register syncopated riffs; double tracking has independent pick timing/velocity.
        pattern=[0,None,0,0,None,1,0,None,0,0,None,0,6,None,1,None]
        if theme=='stage1':pattern=[0,None,7,None,0,3,None,0,None,10,None,7,0,None,5,None]
        if theme=='victory':pattern=[0,None,None,7,None,None,12,None,0,None,7,None,12,None,None,None]
        if theme=='boss':pattern=[0,0,0,None,1,None,0,0,0,None,6,5,0,0,None,1]
        for sixteenth,pitch in enumerate(pattern):
            if pitch is None or intro and sixteenth not in (0,8):continue
            t=bar*4+sixteenth/4
            duration=.48 if intro or bridge else .16 if pitch==0 else .26
            for c,delay in [(2,0),(5,.019)]:
                for interval in [0,7]:note(c,guitar+pitch+interval,t+delay,duration,94+(bar*7+sixteenth*3+c)%12)
        for eighth in range(8):
            t=bar*4+eighth/2;human=((bar*11+eighth*7)%9)-4
            if not intro or eighth%2==0:note(3,chord-12+(7 if eighth==7 else 0),t,.43,82+human if intro else 94+human)
            # Low rhythmic replies reinforce the riff; no upper-register sustained solo.
            if (eighth in (3,6) and section in (1,3,5)) or theme=='stage1' and eighth in (0,3,5,7) or theme=='victory' and eighth%2==0:
                reply=root+phrases[(bar+eighth//3)%8]-12
                note(1,reply,t,.60 if bar%4==3 else .42,96+human)
            if not intro or eighth%2==0:note(9,51 if bridge else 42 if eighth!=7 or bar%4!=3 else 46,t,.12,(37 if intro else 45 if bridge else 53)+human)
            if eighth in (0,4) or theme=='boss' and eighth==7:note(9,36,t,.17,108)
            if eighth in (2,6):note(9,38,t+.009,.17,102+human)
            if theme=='stage1' and section in (1,3,5) and eighth==5:note(9,38,t+.25,.12,46)
            if bar%8==7 and eighth>=5:note(9,[50,47,45][eighth-5],t+.21,.15,88)
        if bar%8==0:note(9,49,bar*4,.9,85)
    buses={'guitar-left':[2],'guitar-right':[5],'lead':[1],'rhythm':[3,9]}
    for bus,channels in buses.items():
        midi=mido.MidiFile(ticks_per_beat=480);tempo=mido.MidiTrack();tempo.append(mido.MetaMessage('set_tempo',tempo=mido.bpm2tempo(bpm)));midi.tracks.append(tempo)
        for c in channels:
            track=mido.MidiTrack();midi.tracks.append(track)
            track.append(mido.Message('program_change',channel=c,program=programs[c],time=0))
            for control,value in [(7,100 if c!=9 else 88),(10,64),(91,0),(93,0)]:track.append(mido.Message('control_change',channel=c,control=control,value=value,time=0))
            previous=0
            for at,event in sorted(events[c],key=lambda e:(e[0],e[1].type=='note_on')):
                event=event.copy(time=at-previous);track.append(event);previous=at
            track.append(mido.MetaMessage('end_of_track',time=max(0,bars*4*480-previous)))
        midi.save(OUT/f'{theme}-{bus}.mid')
    metadata[theme]={**metadata.get(theme,{}),'arrangement':'low B/F# nu-metal riffs with short low-mid guitar replies, sampled palm mutes and down/up picks, four-stage distortion, 4x12 convolution, bass, acoustic drums and DJ accents','bpm':bpm,'bars':bars,'seconds':bars*4*60/bpm,'instruments':['Unreal Instruments METAL-GTX humbucker DI','four-stage high-gain distortion and real 4x12 IR','palm-muted rhythm guitars L/R','synth bass' if theme=='stage1' else 'fingered bass','electronic drum kit' if theme=='stage1' else 'acoustic drums','original scratch/noise samples'],'stems':list(buses)}
Path('public/assets/audio/score.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
print(json.dumps(metadata,indent=2))
