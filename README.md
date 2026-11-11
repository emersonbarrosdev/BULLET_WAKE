# BULLET WAKE

Shooter arcade 2D de rolagem vertical e visão superior, com invasão alienígena sobre a Terra. Somente a Fase 1, Fenda Pelágica, está liberada nesta versão.

[Bíblia vigente](docs/27_BULLET_WAKE_V2_DEFINITIVO.md) · [Revisão atual e pendências](docs/39_ELENCO_COMBATE_AUDIO.md).

Cinco pilotos cartoon: Terry/RIVET, Tita/MOTH, Osvald/KNUCKLE, Luma/KESTREL e Bento/PEREGRINE. Cada nave evolui sua própria arma com P, tem especial e história pessoal. Início com 3 vidas/2 especiais; limite 5/5, excesso vira pontos. Progresso por piloto, HUD lateral em carbono e rádio contextual. Sem escudo, dash, carga, bomba extra ou míssil manual; RIVET recebe mísseis automáticos em NV3+. Três trilhas originais com instrumentos amostrados.

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
