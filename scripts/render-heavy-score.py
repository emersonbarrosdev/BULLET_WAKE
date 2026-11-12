"""Original nu-metal score renderer.
uv run --with mido --with numpy --with scipy --with soundfile python scripts/render-heavy-score.py

Guitar source: Unreal Instruments METAL-GTX humbucker DI (license-free).
Sample library is used locally, never bundled in the game. Bass/drums: GeneralUser GS.
Cabinet IR: public-domain 4x12 recordings, see docs/licenses/4x12-IR.txt.
"""
from pathlib import Path
from functools import lru_cache
import subprocess,sys,wave,json,re,hashlib
import numpy as np
import soundfile as sf
import mido
from scipy.signal import butter,sosfilt,resample_poly,fftconvolve

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'tmp/audio-tools/score'
SAMPLES=ROOT/'tmp/audio-tools/metal/UI_METAL-GTX/Samples'
FLUID=ROOT/'tmp/audio-tools/fluid/fluidsynth-v2.6.2-win10-x64-cpp11/bin/fluidsynth.exe'
SF=ROOT/'tmp/audio-tools/GeneralUser-GS.sf2'
FFMPEG=next((Path.home()/'AppData/Local/Microsoft/WinGet/Packages').glob('Gyan.FFmpeg*/ffmpeg-*/bin/ffmpeg.exe'))
SR=44100
if not SAMPLES.is_dir():
    raise SystemExit('Missing local METAL-GTX recordings. See docs/44_CHEFE_RIVET5_ESCALA_E_NU_METAL.md for reproduction inputs; the game itself uses the committed OGG files.')
subprocess.run([sys.executable,str(ROOT/'scripts/compose-score.py')],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
meta=json.loads((ROOT/'public/assets/audio/score.json').read_text())

def filt(x,kind,freq,sr=SR):return sosfilt(butter(2,freq,btype=kind,fs=sr,output='sos'),x,axis=0)
def pitch(name):
    n=re.match(r'([a-g])(#?)(\d)',name)
    if not n:return None
    return {'c':0,'d':2,'e':4,'f':5,'g':7,'a':9,'b':11}[n[1]]+(1 if n[2] else 0)+(int(n[3])+1)*12
catalog={}
for articulation in ['Mute_Down','Mute_Up','Sus_Down','Sus_Up']:
    catalog[articulation]={}
    for p in (SAMPLES/articulation).glob('*.flac'):
        key=pitch(p.name)
        if key is not None:catalog[articulation].setdefault(key,[]).append(p)
    for v in catalog[articulation].values():v.sort()
@lru_cache(maxsize=160)
def load(path):
    x,sr=sf.read(path,dtype='float32',always_2d=True)
    assert sr==SR
    return x

def sampled_guitar(midipath,n,side,lead=False):
    output=np.zeros(n,dtype=np.float32);held={};clock=0;seq=0
    for msg in mido.MidiFile(midipath):
        clock+=msg.time
        if msg.type=='note_on' and msg.velocity:held[msg.note]=(clock,msg.velocity)
        elif msg.type=='note_off' or msg.type=='note_on' and not msg.velocity:
            if msg.note not in held:continue
            at,velocity=held.pop(msg.note);duration=clock-at
            art=('Sus_' if lead or duration>.32 else 'Mute_')+('Up' if (seq+side)%2 else 'Down')
            bank=catalog[art];key=min(bank,key=lambda p:abs(p-msg.note));files=bank[key];src=load(files[(seq+side)%len(files)])[:,side]
            ratio=2**((msg.note-key)/12);length=min(len(src),round((duration+.025)*SR*ratio));src=src[:length]
            if abs(ratio-1)>.00001:src=np.interp(np.arange(round(len(src)/ratio))*ratio,np.arange(len(src)),src).astype(np.float32)
            # Actual palm-muted recording plus a short natural stop. No decaying synth oscillators.
            tail=min(len(src),round(.018*SR));src=src.copy();src[-tail:]*=np.linspace(1,0,tail)
            if not lead:src*=np.exp(-np.arange(len(src))/(SR*(.15 if duration<.32 else 1.1)))
            gain=(velocity/127)**1.1*.7
            start=round(at*SR);end=min(n,start+len(src));output[start:end]+=src[:end-start]*gain;seq+=1
    return output

def amp(x,side,lead=False):
    # Fourfold oversampling avoids harsh aliasing from high-gain clipping.
    x=resample_poly(filt(x,'highpass',65),4,1)
    rate=SR*4
    for drive,bias in [(7,.015),(5,-.025),(3,.01),(2,0)]:
        x=np.tanh((x+bias)*drive)-np.tanh(bias*drive)
        x=filt(filt(x,'highpass',42,rate),'lowpass',7600,rate)
    x=resample_poly(x,1,4)
    ir,rate=sf.read(ROOT/('tmp/audio-tools/4x12_straight.wav' if side==0 else 'tmp/audio-tools/4x12_slant.wav'),always_2d=True)
    ir=ir.mean(axis=1)
    if rate!=SR:ir=resample_poly(ir,SR,rate)
    x=fftconvolve(x,ir,mode='full')[:len(x)]
    x=filt(filt(x,'highpass',65),'lowpass',3800 if lead else 6500)
    # Mild scoop leaves space for impacts; retain chest/body at 100-250Hz.
    x-=filt(x,'bandpass',[650,1050])*.20
    return (x/(np.sqrt(np.mean(x*x))+1e-9)*(.035 if lead else .14)).astype(np.float32)

selected=set(sys.argv[1:]) if len(sys.argv)>1 else set(meta)
for theme,data in meta.items():
    if theme not in selected:continue
    n=round(data['seconds']*SR);print('Rendering '+theme+' humbucker recordings',flush=True)
    left=amp(sampled_guitar(OUT/f'{theme}-guitar-left.mid',n,0),0)
    right=amp(sampled_guitar(OUT/f'{theme}-guitar-right.mid',n,1),1)
    lead=amp(sampled_guitar(OUT/f'{theme}-lead.mid',n,0,True),0,True)
    path=OUT/f'{theme}-rhythm.wav';midi=OUT/f'{theme}-rhythm.mid';digest=hashlib.sha256(midi.read_bytes()).hexdigest();stamp=path.with_suffix('.hash')
    if not path.exists() or not stamp.exists() or stamp.read_text()!=digest:
        subprocess.run([str(FLUID),'-ni','-R','0','-C','0','-g','.7','-r',str(SR),'-F',str(path),str(SF),str(midi)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True);stamp.write_text(digest)
    rhythm,sr=sf.read(path,dtype='float32',always_2d=True);tail=rhythm[n:n+SR];rhythm=rhythm[:n].mean(axis=1).copy();rhythm[:len(tail)]+=tail.mean(axis=1);rhythm*=1.9
    mix=np.column_stack((left+right*.06+lead+rhythm,right+left*.06+lead+rhythm))
    # Original scratch/stutter accents, not samples of any released song.
    scratch,_=sf.read(next((SAMPLES/'Pick_Scratch').glob('*.flac')),always_2d=True);scratch=scratch.mean(axis=1)
    for bar in range(7,data['bars'],8):
        at=round((bar*4+3.2)*60/data['bpm']*SR);count=min(round(.3*SR),n-at,len(scratch));fx=scratch[:count]*np.hanning(count)*.065
        mix[at:at+count,0]+=fx;mix[at:at+count,1]+=fx[::-1]
    if theme=='stage1':
        motif=[57,64,67,69,72,69,67,64]
        for beat in range(0,data['bars']*4,2):
            at=round(beat*60/data['bpm']*SR);count=min(round(.35*SR),n-at);t=np.arange(count)/SR
            freq=440*2**((motif[(beat//2)%len(motif)]-69)/12)
            phrase=np.sin(2*np.pi*freq*t+1.1*np.sin(2*np.pi*freq*.5*t))*np.minimum(1,t/.008)*np.exp(-t*8)*.027
            mix[at:at+count,0]+=phrase;mix[at:at+count,1]+=phrase
    if theme=='victory':mix*=np.minimum(1,np.maximum(0,(n-np.arange(n))/(SR*.75)))[:,None]
    mix=np.tanh(mix*1.2)/1.2;mix*=.88/max(.88,np.max(np.abs(mix)))
    dest=OUT/f'{theme}-heavy.wav';sf.write(dest,mix,SR,subtype='PCM_16')
    subprocess.run([str(FFMPEG),'-y','-v','error','-i',str(dest),'-c:a','libvorbis','-q:a','6',str(ROOT/f'public/assets/audio/{theme}.ogg')],check=True)
    data['guitarSource']='Unreal Instruments METAL-GTX, sampled humbucker DI, alternate down/up strokes, palm mute/sustain, round robins'
    data['processing']='4x oversampling; four nonlinear gain stages; recorded 4x12 IR; independent stereo takes; low-mid replies with 3.8 kHz rolloff'
    data['replyRegister']='one octave below the rejected lead; short notes, -5.4 dB relative reply stem gain; approved rhythm guitars unchanged'
    reply_notes=[m.note for m in mido.MidiFile(OUT/f'{theme}-lead.mid') if m.type=='note_on' and m.velocity]
    data['replyMidiRange']=[min(reply_notes),max(reply_notes)]
    data['pcmPeakDb']=round(float(20*np.log10(np.max(np.abs(mix)))),2);data['pcmRmsDb']=round(float(20*np.log10(np.sqrt(np.mean(mix*mix)))),2)
    print(theme,data['pcmPeakDb'],data['pcmRmsDb'],flush=True)
(ROOT/'public/assets/audio/score.json').write_text(json.dumps(meta,indent=2))
