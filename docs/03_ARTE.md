# 03 — Bíblia de arte: pixel art 16-bit moderno

## Direção
A arte deve parecer um arcade premium, **não uma colagem de estilos**. Pixels deliberados, paleta contida, sprites com silhuetas fortes, ambientes densos ao fundo, contraste alto no combate e efeitos modernos discretos.

## Regras
- Casco e inimigos desenhados em pixel art 1:1; sem interpolação linear nas ampliações.
- Outline seletivo 1px quando necessário, não contorno preto grosso uniforme.
- Primeiro aprovar silhueta em preto e branco 1x; só depois material, cor, iluminação e FX.
- Jogador identificado pelo brilho ciano e forma; inimigos por vermelho/magenta/âmbar e silhueta. Não depender só de cor.
- Foco no gameplay: HUD, nave, balas e pickups mais legíveis que fundos e destroços.
- Proibido efeitos de partículas que escondem bala perigosa.
- O visual final exige spritesheets autorais e PNG transparente, não círculos/vetores como substitutos de sprites.

## Paletas de referência
| Função | HEX |
|---|---|
| Céu profundo e aço | #101827 #24344D #344C65 |
| Tecnologia aliada | #263447 #8398AA #E1EEF2 #61D7DA |
| Máquina MALHA | #372A3B #714753 #D75E56 #F7A96C |
| Wake | #5A487D #9E88B9 #E5C7D1 |
| Pickups | #94DBAD #F1DC8E #C5A3E5 |
| UI | #EAF2F5 #95B0C3 #5EDBD7 |

## Wake — motivo gráfico único
Duas faixas de brilho quebradas por pequenas ausências de pixels, com um vazio escuro no centro e fragmentos que parecem atrasados em relação à movimentação. Aplicar em sinais, paredes reconfiguradas, cristais, turbinas e núcleo. Nunca fazer todas as superfícies literalmente iguais.

## Materiais dos biomas
01 Estaleiro orbital: treliças, guindastes, motores desligados, cobre queimado. 02 Deserto vitrificado: fraturas e torres refratoras; violeta e vidro. 03 Fábrica viva: dutos que abrem como pulmões e núcleos vermelhos. 04 Atmosfera: plataformas, relâmpagos com aviso, azuis densos. 05 Núcleo: geometria modular que se abre e reordena, vazios significativos.

## Camadas
Fundo longínquo parallax ~0,1×; arquitetura ~0,3×; cenário próximo ~0,6×; plano colisionável 1×; camada dianteira decorativa só quando não cobre o player. O parallax não substitui a arte da colisão; hazards têm borda visual honesta.

## VFX
Explosão pequena 3–5 frames, média 6–8, chefe segmentada. Rastros curtos, recoil pontual, flash de hit reduzido (inicialmente até ~80ms), tremor opcional e moderado. Bosses ocupam área grande, mas devem anunciar ataques e manter corredor seguro.

## Logo e interface
**BULLET WAKE**, duas palavras. Letras de boa leitura com uma quebra horizontal que evoca o rastro. Estética arcade séria, não lettering futurista genérico cheio de brilhos. Verificar disponibilidade da marca antes de comercializar.
