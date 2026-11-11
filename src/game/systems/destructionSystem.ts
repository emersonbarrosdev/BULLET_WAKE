export interface Blast {
    delay: number;
    x: number;
    y: number;
    scale: number;
    major: boolean;
}
/** Staggered rings plus a final impact-centred blast; never a single scaled grey cloud. */
export function destructionPlan(x: number, y: number, radius: number, impactX = x, impactY = y, boss = false): Blast[] {
    const count = boss ? 18 : 7, bursts: Blast[] = [];
    for (let i = 0; i < count; i++) {
        const a = i * 2.399963, r = radius * Math.sqrt((i + .5) / count) * .8;
        bursts.push({ delay: i * (boss ? 45 : 35), x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * .72, scale: boss ? .65 : .4, major: false });
    }
    bursts.push({ delay: boss ? 700 : 210, x: impactX, y: impactY, scale: boss ? 1.5 : .9, major: true });
    if (boss)
        bursts.push({ delay: 900, x: impactX, y: impactY, scale: 1.9, major: true });
    return bursts;
}
