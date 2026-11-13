# BULLET WAKE

Shooter arcade 2D cartoon/anime em Phaser 4, TypeScript e Vite. Duas missões com Bayek/RIVET: **Fenda Pelágica**, vertical/top-down, e **Cidade Solar**, horizontal/lateral. A segunda é liberada ao concluir a primeira.

[Bíblia vigente](docs/27_BULLET_WAKE_V2_DEFINITIVO.md) · [Direção aprovada](docs/54_DIRECAO_ARCADE_APROVADA.md) · [Implementação e validação](docs/55_ARCADE_IMPLEMENTACAO_E_VALIDACAO.md)

Rajadas de três pulsos, arma própria com cinco níveis, mísseis automáticos NV3+, especial frontal, caixas com paraquedas, partes reais de chefes e recursos preservados entre fases. Início com três vidas e dois especiais, limites cinco. Teclado, controle padrão e interface touch. Música baixa por padrão, opções de áudio, dificuldade e qualidade visual.

Somente Bayek está selecionável nesta reformulação. Tita, Leona, Osvald e Hien mantêm registros e retratos; armas e cenas legadas continuam no repositório. Campanha completa, sexto piloto, Remix e três secretas são planejamento, não fases produzidas.

## Desenvolvimento

Node.js 22.12+ e npm:

```sh
npm install
npm run dev
npm run build
npm test
```

Assets finais versionados: não é necessário instalar geradores de arte/áudio para jogar ou gerar o build. Scripts de autoria opcionais usam Pillow, FluidSynth, GeneralUser GS e FFmpeg; consulte [procedência dos assets](docs/56_ARCADE_ASSETS.md).

## Validação adicional

```sh
node scripts/arcade-route.mjs
node scripts/arcade-browser-check.mjs --both --performance --routes
```

O primeiro simula partidas com bot, não mede habilidade humana. O segundo requer Chrome no caminho Windows documentado no script e build de produção. Controle físico, aprovação sonora/visual e desempenho em Android real precisam ser verificados no dispositivo.
