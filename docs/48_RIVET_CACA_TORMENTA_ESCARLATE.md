# Fase 1 — RIVET caça e Tormenta Escarlate

Revisão de 11/11/2026, posterior à [revisão de HUD e recuperação](46_RIVET_VERMELHA_HUD_E_RECUPERACAO.md). Escopo: somente a Fase 1.

## RIVET vista de cima e inclinação corrigida

Nova arte inspirada nas proporções de um caça F/A-18: fuselagem fina, cockpit menor, asas principais e estabilizadores de cauda separados, dois motores com exaustão curta. Preservadas as cores branca e escarlate. A [referência oficial da Marinha dos EUA](https://www.navy.mil/Resources/Fact-Files/Display-FactFiles/Article/2383479/fa-18a-d-hornet-and-fa-18ef-super-hornet-strike-fighter/) descreve o F/A-18 como caça bimotor; nossa pintura é original, sem identificação militar real.

As quatro poses neutras compartilham nariz/cockpit/fuselagem no eixo vertical. A montagem registra todos os frames pelo bico, sem deslocar a imagem durante a troca. A arte tem quatro quadros retos, quatro com **asa direita baixa/esquerda alta**, quatro com **asa esquerda baixa/direita alta**. Direita usa a primeira linha da sheet de inclinação; esquerda usa a segunda. A câmera continua superior, sem girar o nariz para a diagonal. O tamanho de 34 unidades e a âncora de disparo foram mantidos; a colisão lê a silhueta realmente exibida.

Arte de combate: [pose reta](../public/assets/combat-hd/rivet-hornet.webp) e [poses laterais](../public/assets/combat-hd/rivet-hornet-bank.webp). São doze frames originais montados em duas sheets de células de 256×256. As sheets antigas ficam apenas no histórico.

## Rajada Escarlate e Tormenta Escarlate

O tiro principal passa a se chamar **Rajada Escarlate** no HUD, perfil e guia. Mantém os cinco estágios de projéteis vermelhos encorpados, os dois mísseis automáticos no NV3/NV4 e os três guiados no FULL.

**Tormenta Escarlate** substitui o bombardeio prismático. A RIVET entra em sobrecarga ofensiva e emite uma torrente frontal de plasma: feixe central dominante, duas rajadas laterais e fragmentos incandescentes. Vermelho escarlate intenso, núcleo branco-amarelado e bordas laranja. A apresentação reforça Bayek como vanguarda agressiva, abrindo um corredor à frente da nave.

A emissão se ancora no bico e acompanha o movimento, incluindo a inclinação. A [sheet própria de plasma](../public/assets/combat-hd/polish/scarlet-storm.webp) tem oito quadros, três fluxos com animação defasada e doze fragmentos curtos. Há propagação inicial e dissipação no fim; nada de retângulo visível ao desenhar sobre o oceano. Som próprio com ignição mecânica grave e pressão de plasma; a trilha musical aprovada não foi alterada.

O dano depende do contato com a silhueta do alvo, à frente da nave. Contra Talassarca, somente órgãos e baterias cruzados pelo plasma recebem dano, dividido entre as peças atingidas. Não se consome o ataque no contorno externo do casco nem se aplica dano gratuito a peças distantes. Inimigos atrás do emissor não recebem dano.

Calibração: duração de 3 s; orçamento máximo de 120 contra um chefe sob exposição completa. O dano ocorre durante a emissão e não é aplicado todo na ativação. Se errar ou sair do alinhamento, o dano perdido não fica reservado para um acerto posterior. A referência de cinco/três cargas por camada segue um orçamento ideal de dano, não uma garantia de matar com especiais mal alinhados. Mantidos estoque e proteção temporária já existentes; não há bomba adicional ou carga manual.

## Validação

- **195 testes passaram**, incluindo direção de inclinação, propagação frontal, núcleo dominante, movimento do emissor e orçamento de dano independente de FPS.
- **Build/TypeScript passaram**, com o aviso conhecido do bundle de Phaser.
- Navegador de produção em 1366×768 e 1920×1080: HUD, cinco níveis, três poses, Tormenta sobre alvos reais e ao mover. Dano não ocorre na ativação, ocorre nas peças realmente cruzadas e não atinge inimigos atrás da nave. Efeito é destruído ao terminar. Zero erros de navegador.
- Registro dos doze frames de caça pelo bico e oito de plasma com cantos transparentes verificado. [Métricas dos assets](screenshots/phase1-scarlet/asset-validation.json).
- Seis partidas automatizadas completas, sem alterar vida ou injetar potência: Bayek 4min38s/duas mortes; Tita 3min31s/uma; Leona 3min36s/duas; Osvald 3min42s/zero; Hien 4min20s/uma; Bayek deixando três P, 4min20s/duas. A perda de potência e o especial frontal exigem alinhamento e podem prolongar partidas com mortes além do alvo de 2–4 minutos. Esses tempos não substituem o julgamento de equilíbrio por um jogador.

[Verificação visual](screenshots/phase1-scarlet/visual-validation.json) · [Partidas completas](screenshots/phase1-scarlet/validation.json) · [Tormenta contra Talassarca](screenshots/phase1-scarlet/tormenta-boss-1366.webp).

As regressões também mantiveram água animada, especiais dos outros pilotos, pausa musical e controle virtual. Controle físico e aprovação visual/sonora pelo usuário seguem sem nova evidência nesta rodada.

## Produção da arte

Geração/edição com **image_gen nativo**. [Prompts exatos e caminhos finais](49_PROMPTS_CACA_TORMENTA_ESCARLATE.json). A primeira proposta do caça reutilizava demais a forma antiga e foi descartada; o asset final foi gerado como nova aeronave. O plasma passou por edição nativa para remover a base translúcida antes de entrar no jogo. [Montagem dos atlas](../scripts/assemble-rivet-hornet.py) apenas recorta, redimensiona e registra os frames, preservando a pintura e o alfa.
