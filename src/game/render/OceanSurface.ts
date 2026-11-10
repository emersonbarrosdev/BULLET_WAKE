import Phaser from 'phaser';
import { GAME_HEIGHT, PLAYFIELD_WIDTH, PLAYFIELD_X } from '../constants';

/** A continuous UV flow over the painted sheets. Geometry never jumps between frames. */
const WATER_FRAGMENT = `
precision highp float;
varying vec2 outTexCoord;
uniform sampler2D uOcean;
uniform sampler2D uInvasion;
uniform sampler2D uRift;
uniform float uTime;
uniform float uScroll;
uniform float uInvasionMix;
uniform float uRiftMix;
const float PI=3.14159265359;
vec3 cell(sampler2D tex,vec2 uv,float frame){
  uv=clamp(uv,vec2(.5/256.,.5/512.),vec2(1.-.5/256.,1.-.5/512.));
  // Phaser uploads image textures with flipped Y; keep the painted scene upright.
  return texture2D(tex,vec2((frame+uv.x)/8.,1.-uv.y)).rgb;
}
vec3 continuousTile(sampler2D tex,vec2 uv,float frame){
  float y=fract(uv.y);
  float weight=pow(sin(PI*y),2.);
  // One sampling window is invisible at the other window's wrap: no tile edge.
  return mix(cell(tex,vec2(uv.x,fract(y+.5)),frame),cell(tex,vec2(uv.x,y),frame),weight);
}
vec3 water(sampler2D tex,vec2 uv){
  vec3 stable=continuousTile(tex,uv,0.);
  float t=uTime*.5;
  float frame=mod(floor(t),8.);
  float blend=smoothstep(0.,1.,fract(t));
  vec3 detail=mix(continuousTile(tex,uv,frame),continuousTile(tex,uv,mod(frame+1.,8.)),blend);
  // Source frames contribute small foam/refraction detail, never moving entire wrecks.
  return mix(stable,detail,.055);
}
void main(){
  vec2 screen=outTexCoord;
  float y=(screen.y*432.-uScroll*.9)/864.;
  vec2 flow=vec2(sin(y*13.+uTime*.7)+.4*sin(y*31.-uTime*.45),sin(screen.x*14.-uTime*.55));
  vec2 uv=vec2(screen.x,y)+flow*vec2(.0028,.0022);
  vec3 color=water(uOcean,uv);
  if(uInvasionMix>.001)color=mix(color,water(uInvasion,uv),uInvasionMix);
  if(uRiftMix>.001){
    float riftY=-360.+min(320.,max(0.,uScroll-3150.)*.3);
    vec2 ruv=vec2(screen.x,(screen.y*432.-riftY)/864.);
    vec2 rimFlow=flow*vec2(.0018,.0015);
    color=mix(color,cell(uRift,ruv+rimFlow,0.),uRiftMix);
  }
  gl_FragColor=vec4(color,1.);
}`;

export class OceanSurface {
  readonly surface: Phaser.GameObjects.Shader;
  private elapsedMs = 0;
  private scrollPx = 0;
  private invasion = 0;
  private rift = 0;

  constructor(scene: Phaser.Scene) {
    this.surface=scene.add.shader({
      name:'bullet-wake-continuous-ocean',fragmentSource:WATER_FRAGMENT,
      setupUniforms:(set:(name:string,value:unknown)=>void)=>{
        set('uOcean',0);set('uInvasion',1);set('uRift',2);
        set('uTime',this.elapsedMs/1000);set('uScroll',this.scrollPx);
        set('uInvasionMix',this.invasion);set('uRiftMix',this.rift);
      },
    },PLAYFIELD_X+PLAYFIELD_WIDTH/2,GAME_HEIGHT/2,PLAYFIELD_WIDTH,GAME_HEIGHT,
    ['polish-ocean','polish-turbulent','polish-rift']).setDepth(-10);
    this.surface.setTextureCoordinates(0,0,1,0,0,1,1,1);
  }

  update(scrollPx:number,deltaMs:number):void {
    this.elapsedMs+=Math.max(0,deltaMs);this.scrollPx=scrollPx;
    const ramp=(start:number,end:number):number=>{
      const t=Phaser.Math.Clamp((scrollPx-start)/(end-start),0,1);return t*t*(3-2*t);
    };
    this.invasion=ramp(1100,2400);this.rift=ramp(3150,4100);
  }
}
