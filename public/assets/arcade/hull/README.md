# Original hull damage artwork

Original cartoon/anime cel artwork authored as asymmetric Bézier paths in
[generate-hull-art.mjs](../../../../scripts/generate-hull-art.mjs), rasterized by
an isolated Chromium process into transparent RGBA PNG. No approved ship sprite
is replaced, copied or repainted. Rebuild with `node scripts/generate-hull-art.mjs`.

Every sheet is a single horizontal strip. Frames use top-left indexing from zero.
The contact sheet is a preview on a dark background, not a runtime texture.

| Sheet | Frame size | Frames | Content |
|---|---:|---:|---|
| hull-scars-up | 64 × 64 | 3 | Light / medium / critical scorch plates and split seams, nose upward |
| hull-scars-side | 64 × 64 | 3 | Light / medium / critical marks, nose right |
| hull-smoke | 64 × 64 | 8 | Asymmetric billows with three cel tones and rim highlights |
| hull-flame | 64 × 64 | 8 | Curved flame tongues, ember flecks, yellow core; base at (32,59) |
| hull-spark | 64 × 64 | 4 | Outward hot metal streaks; center at (32,32) |
| hull-repair | 64 × 64 | 8 | Reconstruction arcs, diamond motes and brief confirmation glint |
| hull-destruction | 128 × 128 | 8 | Ignition, flash, fragment separation, fire, smoke and fade |
| hull-repair-pickup | 64 × 64 | 8 | Turquoise chamfered service module with recognizable open wrench |

`manifest.json` records actual dimensions and transparent/opaque/partial alpha
pixel counts. All runtime sheets have empty alpha outside their silhouettes.
Shapes use dark blue contours, warm orange/yellow impact accents, desaturated
smoke, and turquoise repair colors, distinct from POWER and heart pickups.

## Anchors and rendering

[HullDamageVisualConfig.ts](../../../../src/game/arcade/HullDamageVisualConfig.ts)
defines fractional positions inside each ship's existing texture frame. Zero is
the frame center; positive X is right, positive Y is down. UP anchors sit near
the rear engine bays (X ±0.12–0.17, Y 0.19–0.23); SIDE anchors sit behind the
center (X −0.19–−0.23) around the engine line. The UP trail rotates 180° to stream
down; SIDE rotates −90° to stream left. Flames use a 0.5/0.92 origin at their base.

[HullDamageArt.ts](../../../../src/game/arcade/HullDamageArt.ts) transforms anchors
using the approved player's actual display size, origin, flip and rotation.
UP bank narrows lateral attachments. Scorch overlays follow the same transform.
Overlays have no physics body and never change the ship, input or collision data.
Four smoke slots, two flames, three sparks, one scorch, one repair and one
destruction sprite form a fixed 12-object budget; no emitters grow over time.
All animation clocks freeze at `dt=0`. `clear()` resets every effect on restart;
`destroy()` releases all twelve objects.

All five pilot IDs have UP/SIDE anchor profiles. RIVET is the fully rendered
reference. Other profiles conservatively support the current tinted approved
frame; these are not claims of new ship-specific artwork or physical playtests.
