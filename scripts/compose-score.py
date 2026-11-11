"""Original 32-bar aviation-rock scores. Render with FluidSynth + GeneralUser GS.

uv run --with mido python scripts/compose-score.py
No melodies or recordings from existing games/films are used.
"""
from pathlib import Path
import json
import mido

OUT = Path('tmp/audio-tools/score')
OUT.mkdir(parents=True, exist_ok=True)
SCORES = {
    'menu': (118, 50, [0,7,9,5,0,7,5,7], [
        [74,-1,78,81,-1,78,76,74], [76,-1,81,83,81,-1,78,76],
        [78,81,85,-1,83,81,78,-1], [79,-1,78,74,76,-1,73,-1],
        [74,78,81,86,-1,85,81,78], [76,78,81,-1,83,81,78,76],
        [79,78,76,74,-1,76,78,-1], [76,-1,73,76,81,-1,-1,-1]]),
    'stage1': (142, 50, [0,10,5,7,0,3,10,7], [
        [74,77,81,-1,84,81,77,74], [72,-1,77,79,81,79,77,-1],
        [79,82,86,84,82,-1,79,77], [81,-1,80,77,76,73,76,-1],
        [86,84,81,77,74,-1,77,81], [77,81,84,89,-1,86,84,81],
        [84,82,79,77,-1,79,82,84], [85,81,80,76,73,-1,76,81]]),
    'boss': (156, 40, [0,0,8,10,0,3,8,11], [
        [76,79,82,83,82,79,76,-1], [76,88,-1,86,83,82,79,76],
        [84,83,79,76,75,76,79,-1], [86,-1,84,82,79,78,75,-1],
        [88,86,83,82,79,-1,76,79], [79,82,86,89,86,82,79,-1],
        [84,83,79,78,76,75,72,-1], [87,83,78,75,71,-1,75,78]])}

metadata = {}
for theme, (bpm, root, progression, phrases) in SCORES.items():
    midi = mido.MidiFile(ticks_per_beat=480)
    tempo = mido.MidiTrack()
    tempo.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm)))
    midi.tracks.append(tempo)
    events = {c: [] for c in [0,1,2,3,4,5,9]}
    # Actual sampled grand piano, overdrive lead, rhythm guitar, finger bass,
    # strings, clean guitar and acoustic Standard drum kit.
    programs = {0:0,1:29,2:30,3:33,4:48,5:27,9:0}
    levels = {0:78,1:89,2:62,3:102,4:47,5:63,9:83}
    pans = {0:49,1:68,2:25,3:64,4:94,5:104,9:64}
    def note(c, pitch, at, length, velocity):
        if pitch < 0: return
        events[c].append((round(at*480), mido.Message('note_on',channel=c,note=pitch,velocity=velocity)))
        events[c].append((round((at+length)*480), mido.Message('note_off',channel=c,note=pitch,velocity=0)))
    for bar in range(32):
        section = bar//8
        chord = root+progression[bar%8]
        minor = theme != 'menu' and bar%8 not in (1,5,6)
        third = 3 if minor else 4
        for eighth in range(8):
            t=bar*4+eighth/2
            human=((bar*11+eighth*7)%9)-4
            # Bass follows the kick, with a fifth pickup into the next chord.
            note(3,chord-12+(7 if eighth==7 else 0),t,.43,92+human)
            # Palm-muted rhythm, wide stereo clean guitar on offbeats.
            if eighth in (0,3,4,6):
                for j,p in enumerate([chord,chord+7,chord+12]):
                    note(2,p,t+j*.008,.31,68+human)
            if eighth%2:
                note(5,chord+12+[0,third,7,12][eighth//2],t,.37,58+human)
            # A: piano-led melody, B: guitar anthem, C: answered guitar/piano.
            lead=phrases[bar%8][eighth]
            if lead>=0:
                length=.78 if eighth%2==0 else .42
                if section in (0,2):
                    note(0,lead,t,length,84+human)
                    if section==2 and eighth in (0,4): note(5,lead-12,t,.92,70)
                else:
                    note(1,lead+(12 if section==3 and eighth in (0,4) else 0),t,length,88+human)
                    if eighth in (0,4): note(0,lead-12,t,.9,68)
            # Warm sustained string harmony, not a synthetic pad.
            if eighth==0:
                for p in (chord+12,chord+12+third,chord+19): note(4,p,t,3.85,54)
            # Acoustic kit: kick, snare, closed/open hat, tom fills and crashes.
            note(9,42 if eighth!=7 or bar%4!=3 else 46,t,.12,51+human)
            if eighth in (0,4) or (theme=='boss' and eighth==7): note(9,36,t,.17,99)
            if eighth in (2,6): note(9,38,t+.009,.17,104+human)
            if bar%8==7 and eighth>=5: note(9,[50,47,45][eighth-5],t+.21,.15,82)
        if bar%8==0: note(9,49,bar*4,.9,78)
    for c, channel_events in events.items():
        track=mido.MidiTrack(); midi.tracks.append(track)
        track.append(mido.Message('program_change',channel=c,program=programs[c],time=0))
        for control,value in [(7,levels[c]),(10,pans[c]),(91,29 if c!=3 else 8),(93,10)]:
            track.append(mido.Message('control_change',channel=c,control=control,value=value,time=0))
        previous=0
        for at,event in sorted(channel_events,key=lambda e:(e[0],e[1].type=='note_on')):
            event.time=at-previous; track.append(event);previous=at
        track.append(mido.MetaMessage('end_of_track',time=32*4*480-previous))
    midi.save(OUT/f'{theme}.mid')
    metadata[theme]={'bpm':bpm,'bars':32,'seconds':32*4*60/bpm,'instruments':['grand piano','electric lead guitar','rhythm guitar','fingered bass','strings','clean guitar','acoustic drums']}
Path('public/assets/audio').mkdir(parents=True,exist_ok=True)
Path('public/assets/audio/score.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
print(json.dumps(metadata,indent=2))
