# BULLET WAKE

Shooter arcade 2D cartoon/anime em Phaser 4, TypeScript e Vite. Duas missões com Bayek/RIVET: **Fenda Pelágica**, vertical/top-down, e **Cidade Solar**, horizontal/lateral. A segunda é liberada ao concluir a primeira.

[Bíblia vigente](docs/27_BULLET_WAKE_V2_DEFINITIVO.md) · [Direção aprovada](docs/54_DIRECAO_ARCADE_APROVADA.md) · [Implementação e validação](docs/55_ARCADE_IMPLEMENTACAO_E_VALIDACAO.md)

Rajadas de três pulsos, POWER progressivo, mísseis automáticos NV3+, especiais próprios e suprimentos em drones. A Fenda Pelágica tem margens contínuas, submarinos e canhões/torres que deixam destroços com fumaça. A regra padrão começa com **quatro segmentos de casco e dois especiais**. Cada impacto válido remove um segmento e reduz POWER em um nível, com piso NV1; REPAIR recupera um segmento e P recupera armamento. Danos progressivos mostram marcas, fumaça e chamas sem alterar controle ou hitbox. O modo clássico de três vidas continua selecionável nas opções, com recordes separados.

[Revisão do cenário](docs/65_COAST_V2_VALIDATION.md) · [Revisão de combate](docs/67_TASK2_COMBAT_VALIDATION.md)

Bayek, Tita, Leona, Osvald e Hien possuem contratos de armas e especiais no motor arcade, com desbloqueios no perfil. A arte de nave em gameplay ainda usa a RIVET aprovada, com tintas para os demais pilotos; isso não equivale a cinco modelos visuais finais. O sistema de casco contém âncoras UP/SIDE para os cinco contratos. Campanha completa, sexto piloto, Remix e três secretas são planejamento, não fases produzidas.

Score fica no painel esquerdo no desktop vertical e no rodapé nas apresentações lateral e retrato. Teclado, gamepad e multitoque compartilham as mesmas regras de combate. Validação por navegador não certifica Android nem controles físicos.

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
