# Fase 1 — organismos alienígenas, metamorfose e oceano vivo

Diretriz vigente de 10/11/2026. Este documento substitui as regras conflitantes dos documentos 27, 30 e 31. A aprovação da Fase 1 pertence ao usuário; nenhuma fase posterior entra em produção nesta entrega.

## Identidade e ambiente

O inimigo é um organismo extraterrestre. Caças convencionais, tanques, dirigíveis mecânicos, formas de relógio e máquinas da campanha horizontal antiga não representam a invasão atual. As gerações mecânicas descartadas nesta revisão não são utilizadas nem reservadas para outras fases.

Agulhas, larvas de cardume, parasitas e carapaças têm quitina, membranas, mandíbulas, apêndices articulados e órgãos luminosos. Os identificadores internos `scout`, `dart`, `lancer` e `cutter` descrevem comportamento, não autorizam arte de aeronave. Cada espécie tem oito desenhos de animação. Movimento de nadadeiras, brânquias, membros e mandíbulas substitui o achatamento/expansão do corpo inteiro.

Os organismos aquáticos têm anatomia própria, linha d'água e espuma, sem elipse preta de sombra e sem enguias. Permanecem ancorados no mundo enquanto o cenário passa: submergem, emergem, anunciam o ataque, disparam e se escondem. Não provocam colisão de casco com a nave aérea. Os voadores e seus projéteis compartilham o plano de combate da RIVET. As balas usam sprites animados, cores relacionadas ao emissor e dimensões diferentes. Colisões com inimigos aéreos comuns sempre destroem o inimigo com explosão.

A Fenda Pelágica acontece **sobre o oceano terrestre**, em voo baixo. A nave não está submersa. A progressão visual é:

1. Oceano relativamente calmo, correntes e espuma discretas.
2. Invasão crescente: água agitada, estruturas marítimas destruídas, biomassa e destroços nas bordas.
3. A fenda se revela adiante na aproximação do chefe, com profundidade escura, luz biológica e correntes convergentes.
4. Talassarca emerge na região da ruptura.

Três spritesheets de oito frames animam água, espuma e refração. Interpolação entre frames, rolagem e partículas superficiais são movimentos independentes: a água continua animada com a rolagem parada. O cenário não começa com a fenda já aberta. Os intervalos de distância de produção são 1100–2400 para a invasão e 3150–4100 para revelar a fenda; são parâmetros de Bullet Wake, não medidas de outro jogo.

## Um especial com estoque, sem bomba separada

- Dois especiais no início da tentativa; no máximo três armazenados.
- `V` ou `X` consome uma carga da mesma habilidade. Não há dois estoques ou duas ações de bomba/especial.
- `E` repõe uma carga por contato físico; estoque completo converte a coleta em 500 pontos.
- Não há recarga passiva, por abate ou por barra de ressonância. Continue preserva as cargas restantes; reiniciar a fase inicia uma nova tentativa com duas.
- A Tempestade Prismática da RIVET usa oito frames próprios, plasma ascendente, três lanças e asas de energia. Limpa projéteis e protege o casco durante sua duração.
- Uma ativação possui orçamento fixo de dano contra o chefe, independente de FPS. A animação não aplica esse orçamento várias vezes.

A unificação evita dois botões com a mesma função de emergência e torna cada coleta relevante. A duração e a densidade visual dos especiais dos outros pilotos ainda precisam de balanceamento específico; a produção visual atual permanece na primeira nave.

## Chefes com duas camadas completas

Talassarca possui uma casca viva, metamorfose e forma interna agressiva, cada apresentação com oito desenhos próprios. A casca não é uma simples recoloração da forma interna.

| Estado | Resistência de referência | Comportamento |
|---|---|---|
| Casca / casulo | 600 HP = cinco especiais de 120 | Leques alternados, aviso antes de disparar, movimento lateral limitado |
| Metamorfose | Transição protegida de 2,4 s | Placas racham e se desprendem, membranas e apêndices se desdobram; sem tiros hostis |
| Forma interna | 360 HP = três especiais de 120 | Cadência maior, leques mais largos e salvas adicionais com espaços de esquiva |

Romper a casca não encerra a fase. Dano excedente não atravessa a metamorfose. A segunda camada começa íntegra; só sua destruição libera a vitória. Tiros convencionais também causam dano: não é obrigatório conseguir oito cargas para vencer. A referência de cinco/três supõe camadas sem dano anterior de tiros.

A forma externa ocupa até 80% da **largura do corredor de combate**; os apêndices da forma interna abrangem 100%. Os painéis do HUD não fazem parte dessa medida. A colisão mantém uma região inferior para esquiva; tamanho colossal não pode criar uma parede inevitável. Corpo e anexos mantêm sua escala, com movimento articulado e efeitos de ruptura. Sem tremor de câmera.

Essa arquitetura de duas camadas, cinco/três especiais e metamorfose passa a ser diretriz para **todos os futuros chefes colossais**, inclusive o final. Somente Talassarca foi adaptado agora. Raia-Dente é um miniboss orgânico separado, não um chefe colossal de duas camadas. Os chefes antigos das fases bloqueadas não constituem implementação dessa diretriz.

## Fire Shark: fontes e limites da reprodução

Foram consultados o [manual original do Mega Drive](https://www.retrogames.cz/manualy/Genesis/Fire_Shark_-_Genesis_-_Manual.pdf), a [página oficial da Toaplan](https://www.toaplangames.co.jp/en/license/license-09.html), a [documentação técnica](https://shmups.wiki/library/Fire_Shark) e a [gravação Genesis NTSC do LongplayArchive](https://www.youtube.com/watch?v=JbI9SbqzRSI). Nenhuma arte do jogo foi copiada.

O manual confirma arma azul inicial, três itens P por melhoria, seleção independente de cores, velocidade S e opção RAPID. Descreve o azul com até 16 disparos e o vermelho mantido pelo botão. A descrição do vermelho no manual conta feixes de forma diferente das ramificações descritas na documentação do arcade. O estoque B original é uma referência histórica: foi conscientemente substituído pelo especial solicitado para Bullet Wake.

Na gravação Genesis foram observados o leque azul inicial e sua ampliação, as hélices verdes e a varredura vermelha. Um trecho do vermelho foi inspecionado a 60 FPS: fluxos alternam entre quadros; analisar apenas uma captura a 30 FPS esconde parte do desenho. A página técnica predominantemente descreve o arcade e não serve como confirmação automática de todos os números do Mega Drive.

**Não se afirma equivalência exata com a ROM.** Quantidades internas de componentes, ângulos, velocidades, DPS e duração em milissegundos são calibração de Bullet Wake. O modelo atual usa 3/5/9/16 projéteis azuis, 2/4/6/8 componentes verdes pareados e 1/2/4/6 ramos vermelhos. A contagem verde de todos os quatro estados, a geometria de todos os ramos vermelhos e a recuperação exata após morte no Mega Drive ainda exigem medição controlada adicional. P vermelho raro continua fora do Normal.

A potência é compartilhada e independente da cor: 3 P por nível, quatro estados; repetir a cor dá 5000 pontos. O verde descreve hélices com rastro contínuo, não bolinhas soltas. O vermelho permanece uma emissão móvel enquanto se segura o botão. Sem calor que interrompa o disparo. Por solicitação do usuário, segurar azul/verde é mais lento que apertar repetidamente; RAPID nas Opções permite automatizar a cadência manual. Esse diferencial é uma decisão de Bullet Wake, não uma medição atribuída ao original.

O [manual original de Sonic Wings 2](https://db.hfsplay.fr/files/2019/06/14/1aa6199e-35d2-456a-8a2f-e3513f37594e.pdf) foi consultado como referência da identidade de especiais por aeronave. Quantidades de cargas, cinco/três especiais por camada e metamorfose são regras próprias de Bullet Wake, não alegações sobre Sonic Wings.

## HUD, coleta e suprimentos

Uma única barra contínua representa 0–100 de integridade; sem vidas extras automáticas. Os três círculos P representam evolução de arma e não são barras de vida. Os painéis continuam pretos/carbono com destroços; paleta e tipografia das telas iniciais foram preservadas. Vitória e derrota usam preto/vinho/âmbar e cabem integralmente no viewport.

Treze casulos transportadores, com um único item explícito cada, substituem os drops por contagem de abates. Há seis P ao longo da fase, permitindo NV3 ao coletar todos; não se entrega potência máxima rapidamente. Cores, reparo, velocidade e duas reposições de especial têm eventos definidos. Monstros comuns e miniboss não despejam ícones. Um casulo perdido significa uma coleta perdida; não há concessão automática.

O coletável exige contato com o casco visível, incluindo bico e asas, sem ímã que force a troca de cor. A coleta produz brilho e partículas. Ícones continuam sendo spritesheets distintos por forma, símbolo e cor, sem texto pendurado embaixo; a explicação fica em Opções. Explosões possuem 16 desenhos e partículas com trajetória, arrasto, rotação e dissipação.

## Validação e evidências

- 142 testes de sistemas aprovados com `npm run test`; build TypeScript/Vite aprovado com `npm run build`.
- Navegador real em 1366×768 e 1920×1080: animação raster, transparência, movimento da água sem scroll, barra em 70/100, coleta pelo bico, especial, metamorfose, duas camadas e telas finais sem corte/scroll.
- Capturas dos quatro níveis das três armas e das formas do chefe em [evidências visuais](screenshots/phase1-polish/), com [relatório automatizado](screenshots/phase1-polish/validation.json).
- Regressão de seleção, perfis sem scroll, dimensões dos cards e confirmação por mouse, Enter e touch, aprovada com `node scripts/validate-pilot-selection.mjs`. A validação do combate usa o mesmo comando com `--polish`.
- [Prompts e destinos dos assets](34_FASE1_PROMPTS_POLIMENTO.md). As evidências verificam funcionamento; aprovação estética e sensação do Normal continuam com o usuário.

## O que ainda falta

1. Aprovação visual e de jogabilidade da Fase 1; ajuste fino da dificuldade Normal após essa avaliação.
2. Medição adicional dos estados e recuperação de armas do Fire Shark Mega Drive para fechar as diferenças explicitadas acima.
3. Balanceamento e polimento específico de Moth/Cora e Knuckle/Harlan, preservados neste escopo.
4. Modos Fácil, Difícil e Real. No Real, uma única vida, letalidade por origem/gravidade do impacto e possíveis reparos limitados; regras documentadas, não liberadas.
5. Depois de aprovada a Fase 1: produzir a campanha seguinte, seus biomas, inimigos, chefes com duas camadas, transformações, progressão e finais. Em nuvens/órbita, ameaças profundas deverão subir de perspectiva até entrar no plano de colisão; esta regra futura não está implementada na Fase 1.
