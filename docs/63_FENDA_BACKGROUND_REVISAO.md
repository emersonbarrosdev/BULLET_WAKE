# Fenda Pelágica — etapa visual para aprovação

Data: 13/11/2026. Branch: `prototype/fenda-art-review`.
Base preservada: `b95c02b89970794717064b764ed49bb4dfba4093`.

**Estado: implementação testada, aguardando aprovação visual. Não representa aprovação de fidelidade aos prints nem migração de engine.** A última instrução de isolamento prevalece: esta etapa não é enviada à master. O protótipo comparativo em Cocos é a próxima etapa, após esta avaliação.

## Diagnóstico do cenário reprovado

A implementação anterior recortava sub-regiões de várias imagens, repetia rochas e folhagens e compunha o porto com peças independentes. Uma geometria senoidal orientava a espuma enquanto outra composição definia a aparência; assim, contorno, terreno e navegação não representavam o mesmo desenho. A textura composta era rasterizada na resolução lógica, perdendo detalhes. A estratégia de preencher raízes costeiras também favorecia margens com aparência de corredor.

## Mudanças desta etapa

- Substituição da composição por estampagens parciais por oito formações completas. Quatro são novas: enseada tropical, promontório com farol e escadaria, porto com estrada/galpão/silo/dois guindastes/pilares, e baía rochosa. Quatro ilustrações existentes são reutilizadas inteiras para variar vila, rochedos e vegetação.
- Cada formação preserva proporção e orientação. A distribuição é autorada, com período de 4.200 unidades, intervalos de mar aberto e margem mínima de 150 unidades entre formações independentes. O espaço central permanece livre.
- Nova textura marítima ilustrada, profundidade, recifes submersos associados às costas, cáusticas e superfície com animações independentes. A água continua em movimento durante encontros com rolagem parada e congela corretamente na pausa.
- Água rasa e quatro estados de espuma derivam do alpha e de trajetos de contato registrados na arte. Copas, telhados e braços de guindaste não recebem espuma. A ilustração original não passa por remoção de cores ou recortes para fabricar costa.
- Esteiras ilustradas de quatro quadros, espuma de casco e sombras de contato/altitude integram barcos, unidades terrestres e aeronaves ao ambiente.
- Envelopes conservadores de navegação vêm dos limites medidos da arte; barcos em dupla mantêm faixas distintas. Unidades terrestres usam pontos de apoio do terreno. Esses ajustes não alteram dano, cadência, encontros, score ou progressão.
- HUD, rádio à direita, RIVET, armas, chefes, músicas e regras de combate preservados. As funções de cenário do menu e da Cidade Solar foram comparadas com a base e permaneceram idênticas.

## Capturas reais do Chrome

As cinco cenas abaixo são fixtures do renderer real: posição de roteiro e encontros controlados para cobrir os locais solicitados. Não são montagens nem imagens geradas representando o jogo. A execução completa com bot é registrada separadamente.

| Trecho | 1366×768 | 1920×1080 |
|---|---|---|
| Início | [Captura](screenshots/pelagic-review/01-start-1366.webp) | [Captura](screenshots/pelagic-review/01-start-1920.webp) |
| Combate intermediário | [Captura](screenshots/pelagic-review/02-middle-1366.webp) | [Captura](screenshots/pelagic-review/02-middle-1920.webp) |
| Porto, barcos e farol | [Captura](screenshots/pelagic-review/03-harbor-lighthouse-1366.webp) | [Captura](screenshots/pelagic-review/03-harbor-lighthouse-1920.webp) |
| Mar aberto | [Captura](screenshots/pelagic-review/04-open-sea-1366.webp) | [Captura](screenshots/pelagic-review/04-open-sea-1920.webp) |
| Aproximação do chefe | [Captura](screenshots/pelagic-review/05-boss-approach-1366.webp) | [Captura](screenshots/pelagic-review/05-boss-approach-1920.webp) |
| Roteiro contínuo aos 80 s | [Captura](screenshots/pelagic-review/06-uninterrupted-route-80s-1366.webp) | [Captura](screenshots/pelagic-review/06-uninterrupted-route-80s-1920.webp) |

[Vídeo real de rolagem e esteiras](screenshots/pelagic-review/motion.webm) · [Medições brutas](screenshots/pelagic-review/report.json).

## Comparação visual e limites

A referência orientou as cores, os volumes das falésias, a praia, a integração física da arquitetura e o espaço central. A revisão remove as margens paralelas e a montagem de estruturas com recortes diferentes. As capturas mostram água até as bordas em trechos abertos e estruturas apoiadas em suas próprias bases.

**Ainda é necessária a decisão do usuário sobre fidelidade artística, densidade da composição, escala do porto/farol e intensidade da espuma.** Não se declara reprodução exata das referências. O resultado usa ilustrações 2D com efeitos de profundidade no Phaser; ainda não é geometria 3D real. Elementos de combate e HUD não foram redesenhados para esconder diferenças da referência, pois estavam fora do escopo desta etapa.

## Validação executada

- `npm test`: 234 aprovados, zero falhas.
- Typecheck: aprovado pelo `tsc --noEmit` e pelo build.
- `npm run build`: aprovado. Permanece o aviso de bundle acima de 500 kB; não é erro de compilação.
- Testes de percurso verificam centenas de milhares de posições de barcos sem travessia de terreno, correções sem teleporte, separação de duplas, orientação, margem de 150 unidades e canal navegável.
- Partida completa com bot até vitória; resultado e duração efetiva no relatório JSON. Não substitui avaliação humana de diversão.
- Scroll positivo move costa para baixo, com UV marítimo correspondente; nenhum sprite costeiro é espelhado ou rotacionado. Pausa mantém mundo e água congelados.
- Rádio medido em `x=646`, limite direito `766`, exclusivamente no painel direito.
- Console: zero erros registrados.
- Emenda vertical da textura: diferença RGB média 5,27, abaixo do percentil 95 das linhas internas (7,33). Inspeção visual e rolagem complementam a medida; não foi usado filtro de névoa para esconder emendas.

| Chrome headless no Windows, HIGH, combate ativo | FPS médio | Mediana | P95 | Amostra |
|---|---:|---:|---:|---:|
| 1366×768 | 59,90 | 16,7 ms | 16,8 ms | 10,00 s |
| 1920×1080 | 59,86 | 16,7 ms | 16,8 ms | 10,01 s |

GPU reportada: ANGLE / AMD Radeon Graphics / Direct3D11. Pico de 74 projéteis ativos; heap JS amostrado de aproximadamente 55–62 MB. A medição é deste computador e deste cenário; Android físico e controle físico não foram testados.

## Assets e reprodução

[Atlas integrado](../public/assets/arcade/pelagic-review/formations.webp), [oceano](../public/assets/arcade/pelagic-review/water.webp), [esteiras](../public/assets/arcade/pelagic-review/wakes.webp), [manifesto SHA-256](../public/assets/arcade/pelagic-review/manifest.json), [prompts exatos](62_FENDA_BACKGROUND_PROMPTS.json).

Produção raster: ferramenta nativa `imagegen`, com referência visual fornecida pelo usuário. [Empacotamento](../scripts/pack-pelagic-review.py) apenas recorta células, redimensiona uniformemente, conserva alpha e mede limites; não pinta nem remove fundo por chave de cor. Os efeitos locais de contato são gerados pelo renderer. Os PNGs originais permanecem na pasta de imagens geradas; nenhum runtime depende de caminhos externos ao projeto.

Reprodução técnica: `npm run build`, `npm test`, `node scripts/pelagic-review-check.mjs`. O último comando usa Chrome no caminho Windows configurado no script e cria as capturas e o relatório.

## Próxima etapa — Cocos, ainda não executada

Cocos Creator 3.8.8 foi encontrado em `C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe`. Não foi criado um projeto Cocos nesta etapa, nem alegados build, FPS ou desempenho Android desse motor. A comparação jogável com câmera ortográfica inclinada, geometria 3D, materiais cartoon e reaproveitamento da simulação segue pendente. Ela deverá ficar isolada do Phaser e da master, com evidência própria e nova parada para avaliação.

Esta parada corresponde à instrução do usuário: **“Pare para aprovação visual antes de avançar para a próxima etapa.”**
