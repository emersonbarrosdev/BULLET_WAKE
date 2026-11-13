# BULLET WAKE — decisão oficial de plataforma e renderização 2.5D

**Data:** 13/11/2026  
**Status:** decisão aprovada pelo proprietário; substitui as diretrizes anteriores de apresentação puramente 2D e de distribuição web como plataforma principal.  
**Tarefa de execução:** [GitHub Issue #1](https://github.com/emersonbarrosdev/BULLET_WAKE/issues/1).

## 1. Plataformas obrigatórias

1. **PC Windows:** build executável como meta de distribuição, com teclado e gamepad, suporte a 1366×768, 1920×1080 e telas maiores; Web Desktop pode ser usado como build de validação, não como substituto de build nativo.
2. **Android:** build nativo APK/AAB com UI adaptativa, touch, safe areas, pausa/resume, compatibilidade com diferentes DPI e resoluções; gamepad quando suportado.
3. **iOS:** fora do escopo inicial. Não atrasar Windows/Android por iOS.

## 2. Motor e estilo

**Motor escolhido para a migração:** Cocos Creator 3.8 LTS (validar o patch e a compatibilidade com toolchains). Preservar a branch `backup/phaser-pre-cocos-2026-11-13` e a `master` funcionando enquanto a versão Cocos é implementada em branch separada.

**Estilo definitivo:** shooter arcade 2.5D original, anime/cartoon cel-shading, perspectiva clássica de cima levemente inclinada, **com profundidade geométrica real e iluminação**, sem perder precisão de controles, colisões e padrões de projéteis de shoot'em up 2D.

Não usar renderização fotorealista, câmera livre, shooter em primeira/terceira pessoa, cenário genérico procedural ou sombras que dificultem a leitura. A referência de perspectiva dos arcades 1945/Raiden é de linguagem, sem copiar assets ou propriedade intelectual.

### Câmeras

- **Fenda Pelágica (UP):** câmera ortográfica 3D superior levemente inclinada, com orientação ajustável conforme capturas aprovadas. O campo de gameplay conserva o movimento clássico vertical, com projéteis e colisões em plano estável.
- **Cidade Solar (SIDE):** câmera ortográfica lateral, com prédios, pontes, elementos de primeiro plano e fundo separados em profundidade 3D e parallax controlado.
- **HUD:** composição 25% / 50% / 25% (painel esquerdo / gameplay / painel direito), preservando o rádio Bayek **somente à direita**. UI em espaço de tela independente da câmera 3D.

### Materiais e geometria

- Água com **3 níveis coerentes**: profundidade abissal e recifes submersos; cáusticas/reflexos intermediários; ondas superficiais e brilho especular.
- Costa com água rasa turquesa em transição gradual, espuma branca irregular e quebrada, textura de praia, rochas com volume e sombras de contato.
- Ilhas, falésias, farol, porto, guindastes, barcos e naves em meshes low-poly estilizados, planos 2D ou modelos híbridos conforme contribuição visual. A escolha precisa respeitar top-down inclinado, escala, oclusão e performance.
- Sem rio com duas faixas paralelas de areia; o mar aberto deve dominar, com arquipélagos e ilhas laterais de composição não simétrica. Nenhum recorte seco, ilha empilhada, borda ciano contínua ou peça flutuando sem relação espacial.
- Posicionar massas e obstáculos com âncoras e espaçamentos definidos por cena; inspecionar colisões separadamente da composição de cenário.

## 3. Animação

RIVET: motores e exaustão vivos, banking/roll e inclinação ao mover, sombra projetada na água conforme altitude, recoil dos disparos, evolução das armas, mísseis, efeitos do especial, impactos, rachaduras/dano visual e destruição. Animações precisam ser reproduzidas no jogo real, não apenas referidas em arquivos.

Inimigos: hélices/turbinas, aproximação, banking, tiro, dano, explosões e destroços; barcos com balanço discreto, esteira dinâmica e interação visual com superfície aquática; bosses com partes/ataques animados e transições de fases.

Cenário: ondulação, cáusticas, espuma irregular costeira, refletores/farol quando aplicável, sombra dos relevos, partículas leves e movimento controlado de objetos. Animar a câmera com parcimônia, sem causar enjoo ou prejudicar aiming.

## 4. Desempenho e plataformas

- **Meta:** 60 FPS em PC Windows e Android real com orçamento aproximado de 16,67 ms por frame. Meta não significa medição concluída.
- **Perfis:** PC Alto; Android Alto/Médio/Baixo, ajustando sombras, iluminação, partículas, pós-processamento, render scale, densidade e resolução de texturas sem alterar hitboxes/gameplay.
- Reutilizar pools para tiros, partículas e efeitos; batching/instancing, culling, compressão de texturas, LOD e gerenciamento de memória.
- Testar 1366×768 e 1920×1080 no PC, ao menos dois aspectos de tela no Android e um aparelho real quando disponível. Registrar FPS, 1% lows ou p95 frame-time, memória e draw calls.
- Validar input teclado/controle no PC, touch e gamepad compatível no Android, orientação de tela, alt-tab, suspensão e retomada do aplicativo.

## 5. Plano de migração e critérios de aceite

1. Editor Cocos Creator instalado e versão documentada; projeto real abre no editor; build Web para inspeção e builds nativos conforme toolchain.
2. Vertical slice Fenda Pelágica 2.5D com RIVET animada, água 3D estilizada, câmera ortográfica, tiros, controles e colisões corretas.
3. Fase completa com navios, inimigos, pickups, porto, farol, miniboss, boss, HUD, rádio, animações, áudio e transições.
4. Cidade Solar SIDE 2.5D com paralaxe, inimigos, chefe e progressão.
5. PC/Android QA real: capturas e vídeos, medição de FPS, bugs/regressões, perfis gráficos e documentação de build.

**Regras de entrega:** etapas e commits isolados, PR draft antes de qualquer merge, comparação com as concept arts aprovadas, screenshots reais em gameplay, testes automatizados e manuais. Não afirmar instalação, build nativo, fidelidade visual ou FPS sem comprovação. O usuário deve aprovar visualmente as etapas antes do merge para a master.

**Precedência:** esta decisão complementa `docs/54_DIRECAO_ARCADE_APROVADA.md`. Onde `docs/54` descrever apresentação puramente 2D, **substituir por 2.5D no Cocos Creator**, preservando a direção artística cartoon/anime e todas as mecânicas compatíveis.
