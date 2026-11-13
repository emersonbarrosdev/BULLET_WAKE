# Fenda Pelágica — retrabalho do litoral após rejeição visual

**Motivo:** a implementação anterior duplicava um módulo de ilha por entrada de costa e ainda sobrepunha conectores e recifes. A cena parecia um conjunto de adesivos empilhados.

**Mudança técnica:** substituição por uma textura de litoral contínuo composta **uma única vez** no início do jogo. A textura contém as duas margens orgânicas e é desenhada com recorte da faixa de terra, com folhagens, pedras e rochas do atlas artístico `pelagic-coast.webp`. Não existe mais o array de até 24 sprites soltos para a costa. O desenho só ocupa a terra, nunca pinta névoa por cima do mar. O oceano `pelagic-water.webp` continua intacto e nítido.

- Largura 384 px, período vertical de 1024 px, bordas cíclicas.
- Geometria de costa e espuma desenhadas em caminhos contínuos e independentes, sem ilhas ovais recortadas flutuando no centro.
- Somente duas chamadas de desenho contínuo (água e costa), sem adicionar sprites por frame.
- `tilePositionY` usa `-world.scroll`: avanço em direção de cima para baixo na tela.
- HUD, diálogo apenas à direita, tiros, inimigos, pickups e progressão não alterados.
- Assets anteriormente gerados e `PelagicShoreline.ts` ficam preservados para referência, mas a antiga composição **não é mais utilizada**.

## Aprovação
Gerar e inspecionar capturas reais no Chrome (início e combate) e verificar bordas sem cortes, atmosfera sem neblina e sem desenho que pareça sobreposto. Se não parecer materialmente mais coerente que o estágio anterior, corrigir antes de seguir ao porto/chefe. Não afirmar que foi alcançada igualdade pixel-a-pixel com a concept art.
