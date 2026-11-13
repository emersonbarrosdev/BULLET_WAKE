# Fenda Pelágica — composição costeira integrada
13/11/2026. Ajuste de direção a partir das quatro telas fornecidas pelo usuário: **o visual desejado é o da costa ilustrada contínua com porto, navios, rochas, farol e arrecifes, não ilhas soltas sobre um oceano vazio.**

## Mudança implementada
- Reaproveitados `stage1-ocean-world-0.webp` e `stage1-ocean-world-1.webp`, que já estavam versionados mas não eram exibidos na gameplay.
- Uma textura de mundo é composta uma única vez no boot, com sobreposição cruzada de ~11% e continuidade na emenda cíclica; rolagem acompanha exatamente `world.scroll`.
- Os desenhos de costa, porto, farol e arrecifes fazem parte da própria paisagem. Os sprites avulsos de ilhas deixam de ser aplicados indiscriminadamente em cima da água.
- O tom da água recebe somente uma correção seletiva dos tons azul/ciano; áreas de areia, espuma, vegetação e estruturas são preservadas.
- A superfície tem brilho leve animado apenas no canal central. A paisagem congela com o scroll do chefe, mas os reflexos continuam vivos.
- A área central passa a 384 px de uma tela lógica de 768 px (50%), e os painéis 192 px cada (25%). Pontuação, vidas, especiais, retratos e diálogo permanecem nas laterais; **rádio somente à direita**.
- Nave, tiro, dano, balanço, inimigos, chefes, progressão e segunda fase não foram redesenhados por esse ajuste.

## Critérios de aceitação visual
O objetivo são as telas de referência do usuário: cenários detalhados e integrados, nenhuma peça com aparência de colagem, água azul profunda com espuma costeira, combate legível, silhuetas e projéteis na escala de shooter clássico, painéis sem diálogos duplicados. Não equivale a afirmar equivalência pixel-a-pixel dos screenshots, pois esses são concept arts e os mapas do repositório não são a mesma pintura. Deve-se comparar gameplay real em 1366x768 e 1920x1080 antes da aprovação final.

## Limitações da validação
Os testes automatizados e TypeScript não substituem captura real em navegador, nem atestam 60 FPS em Android. A simulação `PelagicEnvironment` ainda usa envelopes conservadores próprios para as rotas das lanchas; a próxima etapa visual é casar essas âncoras com o detalhamento da pintura, conforme inspeção de screenshots.
