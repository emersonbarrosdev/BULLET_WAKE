# Sprites de BULLET WAKE

Spritesheets **PNG indexados com transparência alfa (tRNS)**, criados com pixel art original e determinística, não objetos geométricos de runtime.

Gerar novamente: `node scripts/generate-sprites.mjs`. Cada sheet tem **uma linha horizontal de frames**, tamanho fixo por célula e fundo transparente. Não há interpolação, nem imagem externa ou personagem copiado.

| Sprite | Célula | Frames | Layout |
|---|---|---:|---|
| `assets/ships/rivet/flight.png` | 48×24 | 20 | horizontal |
| `assets/ships/moth/flight.png` | 48×24 | 20 | horizontal |
| `assets/ships/knuckle/flight.png` | 48×24 | 20 | horizontal |
| `assets/enemies/scout.png` | 24×16 | 15 | horizontal |
| `assets/enemies/lancer.png` | 40×24 | 17 | horizontal |
| `assets/projectiles/rivet.png` | 12×8 | 4 | horizontal |
| `assets/projectiles/moth.png` | 12×8 | 4 | horizontal |
| `assets/projectiles/knuckle.png` | 16×10 | 4 | horizontal |
| `assets/projectiles/enemy.png` | 10×10 | 4 | horizontal |
| `assets/fx/muzzle.png` | 16×16 | 4 | horizontal |
| `assets/fx/hit.png` | 16×16 | 6 | horizontal |
| `assets/fx/explosion.png` | 24×24 | 8 | horizontal |
| `assets/fx/warning.png` | 16×16 | 4 | horizontal |

**Naves (20 frames):** idle 0–3, subida 4–6, descida 7–9, hit 10–11, destruição 12–19.

**Scout (15 frames):** voo 0–3, aviso 4–6, hit 7–8, destruição 9–14. **Lancer (17 frames):** voo 0–3, aviso 4–6, hit 7–8, destruição 9–16.

**Tiros:** 4 frames por sheet. **FX:** muzzle 4, hit 6, explosion 8, warning 4.

Estes são os **primeiros sprites v0.1** — autorais, animados e integráveis ao motor; poderão receber polimento artístico sem alterar contratos e hitboxes.
