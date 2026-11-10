# BULLET WAKE

Revisão atual: [Fase 1 — cascata, controles, oceano e especial](docs/36_FASE1_CASCATA_CONTROLES_POLIMENTO.md). Inclui carregamento antes do guia, decolagem de 2,5 s e guia/HUD em carbono fosco. Fase 2 e Android aguardam aprovação da Fase 1.

> **Polimento atual da Fase 1:** [água, contato, HUD, áudio e explosões](docs/35_FASE1_POLIMENTO_CONTATO_AGUA_AUDIO.md). Continuidade da água, projéteis sem retângulos, explosões de fogo rápidas e telemetria agrupada; [evidências nas duas resoluções](docs/screenshots/phase1-fine/). As próximas fases aguardam aprovação da primeira.

> **Revisão vigente — 10/11/2026:** [Fase 1: alienígenas, camadas e oceano vivo](docs/33_FASE1_ALIENIGENAS_CAMADAS_OCEANO.md). Especial único com duas cargas iniciais/máximo três, Talassarca com casca e forma interna, água animada e fenda revelada antes do chefe. [Pendências reais](docs/33_FASE1_ALIENIGENAS_CAMADAS_OCEANO.md#o-que-ainda-falta). Fase 2 continua bloqueada até aprovação da primeira.

> **Revisão atual da Fase 1:** [combate, arte e confirmação](docs/31_FASE1_REVISAO_COMBATE.md). Fundo de superfície em movimento, spritesheets de chefes/itens/efeitos, casco com barra única, Continue explícito e confirmação sobre o card. Somente Fenda Pelágica liberada; as próximas fases aguardam aprovação da primeira.

> **Estado atual V2:** shooter vertical top-down; somente Fase 1 — Fenda Pelágica está liberada. Consulte a [Bíblia V2](docs/27_BULLET_WAKE_V2_DEFINITIVO.md) e a [revisão do Normal](docs/30_FASE1_NORMAL_FIRE_SHARK.md). As descrições da campanha horizontal abaixo são históricas.

*Every shot leaves a trace.*

**BULLET WAKE** é um shoot 'em up 2D de rolagem horizontal que combina a ação dos arcades clássicos com ficção científica cinematográfica e pixel art 16-bit moderna.

Um rastro inexplicável aparece no espaço e deixa mundos inteiros à mercê da **MALHA**, uma rede de máquinas que passou a transformar tudo ao seu redor. Três pilotos são convocados para defender uma colônia e, depois, seguir o rastro até sua origem.

## Três pilotos, três estilos

| Piloto | Nave | Estilo | Especial |
|---|---|---|---|
| Nolan Fitch | **Rivet** | Disparos rápidos | Tempestade Prismática |
| Cora Wren | **Moth** | Velocidade e manobras | Salto Fantasma |
| Harlan Greer | **Knuckle** | Tiros potentes | Ruptura Nova |

Todos os pilotos ficam disponíveis desde o início.

## O jogo

- **Cinco fases** feitas à mão, cada uma com cenários, inimigos e chefes próprios.
- Combate horizontal com armas evolutivas, bombas e habilidades especiais.
- Sistema arcade de vidas, integridade, pontuação, combos e power-ups.
- Modos de dificuldade **Normal** e **Difícil**.
- Campanha com progressão salva entre as fases.
- Planejado para **PC e Android**.

## Desenvolvimento

O projeto está em desenvolvimento. A base inicial já inclui uma cena de verificação técnica; a jogabilidade e os sprites definitivos ainda serão implementados.

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
