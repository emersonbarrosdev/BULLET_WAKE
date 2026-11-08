# T07 — Sprite pipeline conectado ao combate

**Escopo:** substituir marcadores geométricos visíveis por spritesheets PNG transparentes v0.1 mantendo a lógica já implementada.

## Assets reais versionados
- Três naves: `rivet/flight.png`, `moth/flight.png`, `knuckle/flight.png` (20 frames cada, 48×24).
- Scout (15 frames 24×16), Lancer (17 frames 40×24).
- Projéteis: Rivet, Moth, Knuckle, inimigo (4 frames cada).
- FX: muzzle 4, hit 6, explosion 8, warning 4, em folhas PNG próprias.
- Gerador de arte `scripts/generate-sprites.mjs` reproduz **os arquivos exatos versionados**: `npm run assets:generate` (executar na raiz); PNGs com paleta e transparência alfa tRNS.
- Frames mantidos com diferenças de luz, turbinas, ângulo de voo, damage e explosões — não cópias de imagens estáticas.

## Integração Phaser
`spriteAssets.ts` define pré-carregamento e registro das animações compartilhadas. PilotSelectScene agora carrega e exibe as três naves em animação idle. PrototypeScene usa sprites para nave, projéteis, Scout, Lancer, telegraph, muzzle, acerto e explosão. Em Game Over, anima morte da nave antes do overlay. Hitbox segue independente do sprite; FPS dos efeitos controlado por Phaser.

## QA
`npm test` verifica dimensões e transparência dos 13 PNGs, decodifica pixels e assegura frames diferentes. `npm run typecheck` e `npm run build` precisam passar no CI. **Ainda obrigatório** conferir em navegador o tamanho do sprite na tela, âncoras, visual de cada nave, animação de morte e clipping de efeitos. Tests de lógica não substituem QA visual.

## Limites
Arte v0.1 original e integrada; não afirmar que está refinada ou final sem aprovação visual. Não existem sprites de especiais ainda: eles entram na **T08**, junto com implementação de suas mecânicas. Cenários com parallax e retratos finais ficam para os próximos marcos. O jogo não foi publicado como build web hospedado.
