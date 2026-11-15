# Tarefa 1 — costa contínua

Arte final: `public/assets/arcade/pelagic-review/coast-harbor-v2.png` e `coast-leisure-v3.png`, geradas com ImageGen integrado. A segunda substitui a torre pintada por um pátio vazio para receber a torre destrutível `defense-tower.png`. Prompts completos: `64_COAST_V2_PROMPTS.json`. Bases e fumaça: `PELAGIC_EMPLACEMENTS_ASSETS.md`.

As margens são uma pintura fixa no mundo: esquerda tropical conectada; direita com cais, farol, restaurante, circo, skate e campo. As junções seguem uma costura de menor diferença entre as pinturas, evitando transparência de rochas e vegetação. O renderizador apenas desloca duas cópias da textura, sem reconstruir ilhas ou remover praia quando barcos entram. O período tem 2048 pixels de mundo; os pontos de interesse voltam em voltas posteriores do percurso.

Canhões e torres ocupam pontos registrados no terreno. Cada ponto só recebe uma unidade por vez; unidades futuras aguardam fora da tela. Destroços preservam a posição no mundo e recebem fogo e fumaça com quadros próprios. A navegação amostra as margens ao longo de todo o casco, preserva duas faixas e permite entrada lateral apenas na enseada livre da direita.

Verificação: TypeScript, build Vite e suíte Node. O script `scripts/pelagic-coast-check.mjs` captura Phaser real em Chrome a 1366×768 e 1920×1080, incluindo as duas junções, canhão intacto/destruído e a virada das cópias. Em três capturas consecutivas, o terreno avançou exatamente um pixel: erro médio e máximo zero após compensar a translação. A execução completa também grava oito segundos de rolagem. Capturas e relatório em `docs/screenshots/pelagic-coast-v2/`.

Comparação visual realizada com a referência enviada pelo usuário: continuidade das duas margens, vegetação em camadas, faces verticais das rochas, contato do cais com a água e variedade dos pontos de interesse. As capturas são fixtures controladas, não uma partida humana completa. A referência orienta a composição e o acabamento; as pinturas incluem as variações solicitadas, não são cópias pixel a pixel.

Referências técnicas consultadas para coordenadas e camadas: [Godot — 2D parallax](https://docs.godotengine.org/en/stable/tutorials/2d/2d_parallax.html) e [Phaser — Tile Sprite](https://docs.phaser.io/phaser/concepts/gameobjects/tile-sprite).
