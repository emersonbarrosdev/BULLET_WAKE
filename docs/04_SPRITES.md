# 04 — Bíblia de sprites, sheets e animações

> **Fase 1 atual:** [catálogo e prompts dos spritesheets](34_FASE1_PROMPTS_POLIMENTO.md), com oito poses anatômicas por espécie, água em oito frames, metamorfose própria e explosão em dezesseis frames. Não usar escala pulsante do corpo como substituto de animação. [Regras vigentes](33_FASE1_ALIENIGENAS_CAMADAS_OCEANO.md).

## Contrato de renderização
Spritesheets PNG RGBA autorais, sem fundo embutido, grid fixo, pixels sem anti-aliasing na escala de exibição. Resolução lógica inicial sugerida **384×216** (16:9); ampliação nearest-neighbor com letterbox. Frames de nave sugeridos **48×24px**, pivô (24,12), frente à direita. Fonte editável + arquivo PNG + manifesto de animação + preview GIF/MP4 de teste.

## Estados exigidos de CADA nave
| Estado | Frames iniciais | FPS inicial | Loop | Função |
|---|---:|---:|---|---|
| idle | 4 | 8 | sim | motores e núcleo pulsando |
| pitch_up | 3 | 12 | não | corpo inclina para subida |
| climb | 3 | 8 | sim | subida com aletas/motores respondendo |
| pitch_down | 3 | 12 | não | corpo inclina para descida |
| dive | 3 | 8 | sim | descida sustentada |
| muzzle | 2 | 16 | não | flash no ponto correto de disparo |
| boost | 4 | 12 | sim | rastro/reatores mais intensos |
| hit | 2 | 12 | não | faíscas e feedback |
| shield | 4 | 10 | sim | halo como camada independente |
| destruction | 8 | 12 | não | fragmentação e dissipação |

A base de movimento escolhe idle/up/down; **tiro, escudo e hit são sobreposições**, não fazem a nave travar a animação de subida. Morte desativa controle, colisão e emissão de tiros. Ao soltar direção, retornar suavemente ao idle sem saltar pivôs.

## Pivôs e âncoras
Manter muzzleAnchor, engineAnchor(s), shieldAnchor, pivot e hurtbox consistentes por frame e estado. Tiros saem do canhão mesmo com pitch e boost; não criar tiros saindo da asa errada. Hitbox jogável inicialmente 12×8px para todas, desacoplada do casco visível. Não alterar tamanho de colisão devido à animação de inclinação.

## Dimensões iniciais de outras entidades
Drone 24×16 (idle 4, ataque 2, hit 2, death 4); interceptador 48×24 (idle 4, ataque 3, hit 2, death 6); torre 40×40 (idle 4, ataque 4, death 6); pesado 96×64 (idle 4, carga 4, death 8); bosses por módulos com atlas e hitboxes próprias (ex. 64×64 ou 128×64).

## Projetéis
Tiro jogador ~8×4px, 2–3 frames; laser formado por segmentos ou efeito frameado; mísseis 12×6px com propulsão. Inimigos: bala com centro sólido, feixe indicado, projétil angular, bomba com trajetória clara. Cor/forma diferenciam ameaça de coleta. Draw order e FX não podem esconder balas hostis.

## Pastas/nomeação sugeridas
`public/assets/ships/rivet/idle.png`, `moth/climb.png`, `knuckle/destruction.png`; `enemies/scout/attack.png`; `bosses/excavator/arm_left.png`; `fx/explosion_small.png`. Manifesto associa id/frameWidth/frameHeight/frameCount/fps/loop/pivot/muzzleAnchor/engineAnchors/hurtbox. Não hardcode de números de frame em cenas.

## Aceite obrigatório
Frames **realmente diferentes**; naves legíveis em preto e branco; subida/descida animadas; transparência correta; ausência de salto de pivô; preview 1×/4×; arquivo-fonte e licença; teste de animação em 30 e 60 FPS; nenhuma nave de perfil superior. Não confundir um plano de sprites com sprites criados.
