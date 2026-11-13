# Fenda Pelágica — aprovação visual por etapas

## ETAPA 1 — Base do oceano (13/11/2026)

**Status: entregue para teste do usuário. Não avançar à etapa 2 sem aprovação.**

### Problema da revisão anterior
A sobreposição dos atlas `stage1-ocean-world-0.webp` e `-1.webp` com textura azul-cobalto produzia uma fronteira de água ciano desfocada e um mapa que mostrava estruturas costeiras em orientação indesejada. Ajustar o alfa por borda não resolve o problema estrutural.

### Correção isolada nesta etapa
- Apenas UMA `TileSprite` de água `pelagic-water.webp`, 384 x 432 na região x=192..576.
- Desativado o render do panorama misturado/invertido, removendo a névoa e ilhas de orientação confusa. Os dois arquivos de arte **não foram apagados do repositório**.
- `waterScrollOffset` governa o deslocamento para baixo, usando `world.scroll` como antes.
- Mantidos os painéis laterais, o rádio só à direita, nave, tiros, chefes, placar, mecânicas e progressão da Fenda e da Cidade Solar.
- As costas, portos, faróis e rochas são **intencionalmente ausentes nesta primeira entrega de validação da água**. A integração deles é a próxima etapa; não avaliar fidelidade completa da fase por este commit.

### Inspeção necessária
1. O mar é nítido e azul profundo em toda a largura do gameplay, sem variação artificial de cor nas bordas?
2. A superfície move visualmente de cima para baixo?
3. Não surgem elementos costeiros invertidos?

Validar com o jogo real e capturas. `npm run typecheck`, `npm test`, `npm run build`, e a tarefa de inspeção visual no Chrome devem estar verdes. **Não alegar 60 FPS sem nova medição específica.**

### Próxima etapa (somente após aprovação)
Introduzir costa orgânica, rochas, vegetação e espuma por sprites corretamente orientados e sem água pintada nas bordas, com distribuição contínua que se conecte visualmente ao oceano.
