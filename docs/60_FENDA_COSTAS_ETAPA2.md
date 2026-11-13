# Fenda Pelágica — etapa 2 / costas orgânicas

**Data:** 13/11/2026

**Status:** implementado na `master` para avaliação do jogador; **não avançar à etapa 3 sem aprovação.**

## Mudanças
- Mantida a textura única `pelagic-water.webp` do oceano azul escuro da etapa 1.
- Inserida `PelagicShoreline.ts` com bordas artísticas autorais montadas usando células **transparentes** do atlas `pelagic-coast.webp` (ilhas tropicais, árvores, rochas, espuma, recifes).
- A composição visual tem módulos principais e conectores, presos às bordas esquerda/direita da arena. Não há ilhas arbitrárias flutuando no centro; nenhuma imagem com textura de água retangular é misturada ao fundo.
- Não há alpha gradual, vinheta, neblina, coloração por sobreposição ou espelhamento/rotação. O conteúdo do atlas permanece na orientação artística original.
- A posição vertical é determinada por `screenY = authoredY + world.scroll`, compatível com avanço da câmera e navegação.
- Pool fixo de 24 imagens para não criar centenas de objetos por frame; apenas elementos dentro da janela aparecem.
- Nesta etapa **não são desenhados porto, guindastes, farol ou barcos extras**; estas estruturas entram na etapa 3. Os assets foram preservados.
- Alterações limitadas a apresentação da Fenda e testes, sem substituir RIVET, tiro, HUD, rádio ou Cidade Solar.

## Como avaliar
1. Água central e margens devem ter o mesmo azul profundo, sem faixa de névoa no encaixe.
2. Vegetação, pedras e praias devem surgir ao longo de ambas as bordas sem serem espelhadas ou invertidas.
3. O jogador deve enxergar passagem central e tiros sem obstrução.
4. Se as bordas ainda parecerem colagens ou houver emendas abruptas, **não aprovar**: refinar este commit antes da etapa 3.

Evidências: GitHub Actions (capturas `phase1-start.webp`, `phase1-coast.webp`, `phase1-boss.webp` e relatório do navegador). O desenho das margens ainda não é uma réplica pixel-a-pixel da concept art aprovada e exige inspeção humana.
