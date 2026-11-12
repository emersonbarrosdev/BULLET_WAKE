/** Route motion and visible water motion are separate during cinematic encounters. */
export function approachSpeed(current:number,target:number,dt:number):number {
  return current+(target-current)*(1-Math.exp(-Math.max(0,dt)/650));
}
export function cruiseTarget(enemies:number,quietMs:number):number {
  return enemies>=4?24:enemies>0?28:quietMs>500&&quietMs<4800?43:30;
}
