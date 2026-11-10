# Fase 1 — polimento de contato, água, áudio e explosões

> **Atualização prioritária:** [Fase 1 — cascata, controles e polimento](36_FASE1_CASCATA_CONTROLES_POLIMENTO.md). Azul NV4 libera verde NV1; verde NV4 libera rubro NV1. Especial apenas X no teclado, guia antes da partida, pause/opções e controle padrão. Esta decisão mais recente substitui a troca livre e os atalhos V/B citados historicamente abaixo.

Revisão de 10/11/2026, complementar à [diretriz vigente da Fase 1](33_FASE1_ALIENIGENAS_CAMADAS_OCEANO.md). Somente Fenda Pelágica/RIVET; as próximas fases continuam dependendo da aprovação do usuário.

## Correções integradas

- **Bico da RIVET:** removida a elipse ciano desenhada sobre a nave ao disparar. O clarão fica por conta do sprite animado junto à origem dos tiros.
- **Balas alienígenas:** seis strips de quatro frames receberam extração de fundo. Forma, cor e animação continuam específicas por emissor, sem o quadrado translúcido das versões anteriores.
- **Acerto versus destruição:** acertos mostram uma faísca de 65 ms no ponto atingido. Não reproduzem a animação inteira de morte. A destruição usa nova arte de fogo branco/amarelo/laranja, expansão e desintegração em 16 frames, 40 FPS, removida ao terminar os 400 ms.
- **Resíduos:** eliminadas as nuvens de fumaça cinza. Fragmentos se afastam, giram, encolhem e desaparecem em 160–340 ms; limite de 120 partículas e descarte fora do corredor. Nenhum tremor de câmera.
- **Contato:** projéteis hostis verificam o segmento percorrido entre frames contra o casco, incluindo bico e asas. O efeito aparece no primeiro contato. Invulnerabilidade não produz um segundo falso impacto; casco e escudo têm áudio próprio. Alvos removidos ou submersos não produzem falsos acertos. Balas convencionais também mostram a faísca na posição do projétil, em vez do centro do inimigo.
- **Coleta:** permanece física, sem ímã e sem nova concessão de itens. O ícone se dissolve brevemente em direção ao casco somente depois do contato confirmado. Reparo e pontuação são aplicados uma única vez. P comum e subida de nível têm sinais sonoros diferentes.

## Oceano contínuo

[OceanSurface](../src/game/render/OceanSurface.ts) mantém as três spritesheets ambientais existentes como fontes de arte. Uma única superfície WebGL cobre o corredor, com refração contínua, janelas de amostragem sobrepostas e mistura suave na repetição vertical. Não há mais duas imagens independentes encontrando suas bordas no meio da tela.

O quadro-base mantém as posições de destroços e da fenda estáveis. Os outros frames contribuem com variação discreta de espuma/refração: mistura de 5,5%, transições suaves de dois segundos. O movimento principal da água, a rolagem e as partículas superficiais são contínuos e independentes. Isso evita que a troca de desenho desloque estruturas inteiras ou faça a água parecer travar. A fenda tem amostragem sem repetição e surge na aproximação, com a orientação vertical correta.

Intervalos mantidos: invasão em 1100–2400 px e fenda em 3150–4100 px. São parâmetros de Bullet Wake. As verificações de 30/60/120 FPS comparam posições finais em simulação; **não são uma medição de desempenho em todos os dispositivos**.

## Hierarquia do HUD

| Lado esquerdo: sobrevivência | Lado direito: armamento e missão |
|---|---|
| Identidade do operador | Nome da operação e setor |
| Uma barra contínua de integridade | Arma equipada, nível e três coletas P no mesmo painel |
| Dash e estoque do especial agrupados | Pontuação e progresso da operação agrupados |
| Reiniciar | Controles de disparo/carga/menu |

Cinco painéis no total, sem telemetria de FPS na interface de produção e sem repetir instruções de cada recurso. Mantidos carbono preto, destroços, fontes, corredor de 432 px, cards de pilotos e perfis sem scroll. Ícones no campo continuam sem legendas penduradas.

## Identidade sonora

Os humanos mantêm seus sons de armas. Os organismos usam sete vozes biológicas com modulação de frequência, ressonância filtrada e timbres associados à espécie; não repetem o disparo quadrado humano genérico. Uma salva gera um evento sonoro, em vez de sobrepor o mesmo áudio para cada bala. Intervalos mínimos limitam a sobreposição durante formações.

Acerto em tecido alienígena, dano no casco, dissipação do escudo e destruição têm sinais distintos. Explosões recebem ataque mais definido e corpo grave curto. Cada tipo real de coleta utiliza sua própria sequência de notas; os identificadores antigos que faziam quase todos os itens tocar o mesmo som foram corrigidos. Ruído de impactos é reutilizado e os novos nós de áudio são desconectados ao terminar. Um compressor no barramento mestre controla os picos de combate sem modificar o volume escolhido pelo jogador.

São sons autorais de Bullet Wake, não amostras nem medidas atribuídas a Fire Shark ou Sonic Wings.

## Assets finais e prompts

Modo utilizado: **ferramenta integrada `image_gen`**, sem CLI/API externa. Alpha gerado preservado; FFmpeg somente recorta, redimensiona e empacota as células. Não há remoção programática de fundo, pintura por script ou filtro que esconda o problema durante o jogo.

### Projéteis — edição / background-extraction

Referência: montagem dos seis strips anteriores, mantendo sua ordem. Grade final de quatro colunas por seis linhas.

> Edit this exact 4 column by 6 row alien projectile animation sheet. Preserve all 24 projectile cores, shapes, colors, order, size and four animation variations: coral needle, blue arrow, magenta spore, amber crescent, green seed, cyan ring. Remove EVERY white/gray/tinted rectangular background behind the projectiles. Genuine transparent alpha 0 everywhere outside the compact projectile and its very tight local glow. All cell corners and ample cell margins must have alpha 0, no faint matte, no large haze. Do not repaint the background any color. No labels, grid, checkerboard, frame outlines. Keep each projectile centered in a separate square cell, even four columns and six rows, consistent small size with clear padding. This is production game sprite extraction: no transparency residue and no neighboring cell bleed.

Destinos, todos com quatro células de 64×64:

- [hostile-scout.webp](../public/assets/combat-hd/review/hostile-scout.webp)
- [hostile-dart.webp](../public/assets/combat-hd/review/hostile-dart.webp)
- [hostile-lancer.webp](../public/assets/combat-hd/review/hostile-lancer.webp)
- [hostile-cutter.webp](../public/assets/combat-hd/review/hostile-cutter.webp)
- [hostile-surface.webp](../public/assets/combat-hd/review/hostile-surface.webp)
- [hostile-raia.webp](../public/assets/combat-hd/review/hostile-raia.webp)

Empacotamento: `node scripts/import-phase1-review.mjs hostile SOURCE`.

### Explosão — geração / stylized-concept

Especificação do prompt usado, normalizada:

> Original production sprite animation atlas for BULLET WAKE, premium matte painterly 2.5D arcade game. Exact four columns by four rows, sixteen equal square cells in playback order. Genuine transparent background, no gray/brown smoke mass, fog, opaque matte, floor, grid, labels or checkerboard. Violent white-yellow hot ignition in frames 1–3, orange flame expansion in frames 4–7, separated flame tongues and fast outward sparks with an opening transparent center in frames 8–11, few fading embers and shards in frames 12–15, clear end frame. Maintain centered anchors and generous 15% padding. An actual fiery alien destruction that disperses and clears the screen quickly, never a lingering gray cloud.

Destino: [explosion.webp](../public/assets/combat-hd/polish/explosion.webp), 16 células de 192×192. Empacotamento: `node scripts/import-phase1-polish.mjs explosion SOURCE`. O fim da animação destrói o objeto; fragmentos não ficam acumulados no cenário.

## Validação

- 143 testes de sistemas aprovados; TypeScript e build de produção aprovados.
- Navegador real em **1366×768 e 1920×1080**: HUD agrupado sem corte/scroll, uma barra de vida, transparência das seis famílias hostis, bico atingido durante trajeto rápido, invulnerabilidade e reparo aplicado uma única vez.
- Cantos de 5×5 px dos 24 frames hostis: alpha máximo 0–1/255 após empacotamento; inspeção visual sobre o oceano sem retângulos visíveis.
- Água isolada da UI: comparação antes/depois da repetição, movimento com scroll parado e mesmo resultado visual ao simular um segundo a 30/60/120 FPS. Inspeção da fenda corretamente orientada.
- Após a destruição, zero sprites de explosão e zero partículas ao fim da janela de limpeza de 500 ms.
- Renderização real de áudio com `OfflineAudioContext`: sete vozes alienígenas distintas da RIVET, impactos/coletas diferentes, rajada de 24 chamadas sem empilhar a voz e mistura simultânea de combate sem clipping. Essas medições não substituem avaliação auditiva do usuário em seus alto-falantes.
- Regressão dos menus: seleção e confirmação por mouse, Enter e touch; três perfis sem scroll nas duas resoluções.

Reprodução:

```bash
npm run build
node --experimental-strip-types --test tests/*.test.mjs
node scripts/validate-pilot-selection.mjs --fine
node scripts/validate-pilot-selection.mjs --polish
node scripts/validate-pilot-selection.mjs
```

[Capturas do polimento](screenshots/phase1-fine/) e [relatório com medições](screenshots/phase1-fine/validation.json). A aprovação visual e do Normal continua pendente com o usuário; [lista vigente do que falta](33_FASE1_ALIENIGENAS_CAMADAS_OCEANO.md#o-que-ainda-falta).
