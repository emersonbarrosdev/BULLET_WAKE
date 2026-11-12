# BULLET WAKE

Shooter arcade 2D de rolagem vertical e visão superior, com invasão alienígena sobre a Terra. Somente a Fase 1, Fenda Pelágica, está liberada nesta versão.

[Bíblia vigente](docs/27_BULLET_WAKE_V2_DEFINITIVO.md) · [Reformulação da Fase 1 e validação](docs/52_FASE1_REFORMULACAO_BIOMECANICA.md) · [Abertura atualizada](docs/50_ABERTURA_RIVET_CACA.md).

Cinco pilotos cartoon: Bayek/RIVET, Tita/MOTH, Leona/KESTREL, Osvald/KNUCKLE e Hien/PEREGRINE. Cada nave evolui sua própria arma com P, tem especial e história pessoal. Início com 3 vidas/2 especiais; limite 5/5, excesso vira pontos. Progresso por piloto, HUD lateral em carbono e rádio contextual. Sem escudo, dash, carga, bomba extra ou míssil manual; RIVET tem cinco níveis, dois mísseis automáticos no NV3/NV4 e três guiados no FULL. Quatro trilhas originais: menu e chefe preservados, combate oceânico com guitarras, baixo sintetizado/kit eletrônico e tema de vitória sem loop. Talassarca combate no ar, foge, retorna pelo oceano e inicia a arena fixa com Eclipse Abissal. Canal do piloto em terminal verde; conclusão com saída automática da nave. Potência e recursos são preservados na passagem sequencial entre fases, sem transformar uma nave fraca em FULL.

A campanha de quinze fases e as rotas secretas são planejamento documentado, não conteúdo produzido. O Normal é o único balanceamento ativo.

## Desenvolvimento

A Fase 1 está jogável e em revisão. As próximas fases dependem da aprovação da primeira.

**Tecnologias principais:** Phaser 4, TypeScript e Vite.

### Executar localmente

Requer Node.js e npm.

```bash
npm install
npm run dev
```

Para verificar os tipos e gerar uma versão de produção:

```bash
npm run typecheck
npm run build
```

## Documentação

O planejamento completo do universo, das naves, sprites, fases, gameplay e arquitetura está na pasta **[docs/](docs/)**.

- [Visão do jogo](docs/00_VISAO.md)
- [História e universo](docs/01_HISTORIA.md)
- [Pilotos e naves](docs/02_PILOTOS_NAVES.md)
- [Direção de arte](docs/03_ARTE.md)
- [Sprites e animações](docs/04_SPRITES.md)
- [Fases](docs/05_FASES.md)
- [Gameplay e progressão](docs/07_GAMEPLAY.md)
- [Arquitetura técnica](docs/08_ARQUITETURA.md)
- [Roadmap](docs/11_ROADMAP.md)

---

*BULLET WAKE — um projeto original em desenvolvimento.*
