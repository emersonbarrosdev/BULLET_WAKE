# Fase 1 — carbono, progressão e combate Normal

> **Registro anterior:** consulte a [revisão vigente de combate](31_FASE1_REVISAO_COMBATE.md). Os itens SVG com placas, vidas automáticas, cadência antiga, contagem azul 3/5/7/9, balas crescentes e arte submarina descritos abaixo foram substituídos. O estoque atual de X é de três pulsos locais; V tem função ofensiva própria. As diretrizes de biomas e dificuldades futuras continuam válidas.

Revisão de 09/11/2026. Complementa e prevalece sobre definições conflitantes de HUD, drops e dificuldade dos documentos anteriores. A produção continua concentrada na Fenda Pelágica e na RIVET; as artes das outras duas naves permanecem como estão.

## Referências verificadas

- [TATSUJIN / Toaplan — Fire Shark](https://www.toaplangames.co.jp/en/license/license-09.html): fonte oficial das regras de itens e sobrevivência. Cor escolhe armamento; cor repetida vale 5.000 pontos. Três P aumentam potência; o progresso parcial sobrevive à morte. No máximo, três P extras formam reserva. S aumenta velocidade, B repõe bombas, com estoque de dez. Alvos de superfície não causam colisão aérea.
- [1CC Log — Fire Shark para Mega Drive](https://1cclog.blogspot.com/2012/02/fire-shark-mega-drive.html): análise específica da conversão, confirmando nove P até a potência máxima, troca independente por cápsulas que se deslocam e diferenças de cadência entre armas. Também distingue a experiência mais acessível do Mega Drive.

A referência orienta as regras; os tempos, danos, trajetórias, ícones e desenhos são próprios de Bullet Wake. Não foram importadas artes, músicas ou fases de Fire Shark. As contagens 3/5/7/9 do azul e 1/2/4/6 do vermelho são a adaptação já definida para Bullet Wake, sem atribuição dessas contagens à conversão de Mega Drive. Blindagem, reparos H, ressonância, mísseis e dash continuam sendo sistemas próprios.

## Apresentação implementada

- Laterais opacas em preto/grafite com trama de carbono, armadura queimada, sucata e fumaça discretas. Acentos funcionais mantêm âmbar, azul, verde e vermelho; tipografia continua Oxanium/Rajdhani.
- O combate ocupa todo o viewport, inclusive em proporções diferentes de 16:9. O HUD de carbono e os ícones são comuns aos três pilotos; as artes de Moth/Knuckle permanecem como estão. Mantém o mundo lógico de 768×432 e as três zonas proporcionais; nenhuma faixa externa de letterbox. A arena conserva seus limites lógicos X=168..600.
- Vitória e derrota usam uma camada DOM acima do HUD, com texto que quebra linha e botões responsivos. O HUD fica inerte durante o resultado; mouse, teclado e toque acionam a mesma escolha uma única vez. Sair/rejogar remove a camada e seus listeners.
- A seleção e os perfis dos pilotos preservam estrutura, dimensões dos cards e ausência de scroll.

### Procedência do novo fundo lateral

[carbon-wreckage.webp](../public/assets/combat-hd/carbon-wreckage.webp), 768×1152, criado com `image_gen` e convertido para WebP com FFmpeg. Prompt: painel vertical decorativo de carbono preto opaco; grafite quase preto, trama diagonal discreta, placas queimadas e rachadas, destroços de nave e cinzas na base, centro escuro livre para telemetria, poucas brasas âmbar apagadas; sem letras, UI, pessoas ou moldura. Não é um recorte do cenário de combate.

## Regras implementadas de armas e itens

| Sistema | Regra atual no Normal |
|---|---|
| Início de uma tentativa | Dispersão Azul NV1, 0/3 P, 3 bombas, velocidade S=0 |
| P | Cada 3 aumentam um nível; 9 elevam NV1 a NV4. A barra zera a cada evolução, inclusive ao chegar ao NV4. |
| Reserva P | No NV4, cada P adicional preenche uma posição, até três. Reserva completa permite voltar no NV2 na próxima vida; P excedente vale 5.000 pontos. |
| Perda de vida | Retorna ao azul; potência volta ao NV1, ou NV2 com reserva completa. P parcial permanece; reserva completa é consumida. Velocidade S volta a zero e bombas voltam a três. Dash continua sem reposição. |
| W azul/verde/vermelho | Troca livre desde NV1, mantendo nível e barra P. Mesma cor: 5.000 pontos, sem adicionar P. Não há sequência obrigatória de cores. |
| S | +8% de velocidade por coleta, até três incrementos (+24%). Excedente vale 5.000 pontos. |
| B | +1 bomba até dez; X detona. |
| H / M / E / $ | Reparo de 1 blindagem; prontidão do míssil; +25% ressonância; +500 pontos. São extensões de Bullet Wake. |
| Coleta | Contato com o núcleo da nave, sem ímã. Cápsulas de arma e S atravessam lateralmente e rebatem nas bordas; cores permanecem fixas. |
| Cadência | Azul: 220 ms por salva; verde: 240 ms; vermelho continua com emissão e dano por tempo. Tapping e segurar usam o mesmo intervalo, impedindo aceleração por repetição de tecla. |
| P★ | Ferramenta exclusiva de sandbox; não integra o roteiro Normal nem recompensa o miniboss. Atalhos numéricos de teste ficam desligados no build normal; opt-in com `?sandbox`. |

Os erros anteriores foram removidos: W repetida não dá P; W não vira P no NV1; abates comuns não geram P em massa; alcançar NV4 não concede reserva gratuita. A interface mostra a barra real e atualiza imediatamente a pontuação da coleta.

### Ritmo de suprimentos

21 portadores com cargas fixas: nove P, seis cápsulas W e seis itens de suporte. Os P estão nas distâncias 450, 900, 1400, 1900, 2400, 2900, 3400, 3800 e 4150. Sem contar tempo de destruição, coleta e desaceleração no miniboss, as terceiras cargas de cada evolução só entram após aproximadamente 20,6 / 42,6 / 61 segundos. Não é uma subida automática: é preciso derrubar o portador e coletar o item.

Os nove P da aproximação não garantem uma reserva na Fase 1. O sistema de reserva funciona e fica disponível para a expansão futura da campanha; a aproximação atual prioriza a subida gradual até NV4. Itens de suporte e pontuação não completam potência. Portadores têm quatro pontos de resistência, enquanto os inimigos comuns preservam seus valores anteriores.

### Identificação visual

Cada item possui cor, contorno e símbolo exclusivos, além de uma legenda curta. P é um losango com raio; azul tem três direções; verde, hélice; vermelho, chama; H, escudo com cruz; B, bomba; S, setas de velocidade; $, moeda com estrela; M, míssil; E, cristal violeta. A mesma definição gera as texturas do combate e o **Guia de Itens e Armas**, acessível nas Opções. Em telas menores, a legenda pode ser rolada com toque, roda do mouse ou setas, mantendo Voltar acessível.

## Inimigos e cenário implementados

- O roteiro passou a 120 entradas: 42 unidades do roteiro anterior, 52 integrantes de nove bandos, 21 portadores e cinco organismos de superfície. São distribuídas pela fase, não simultâneas.
- Bandos de cinco ou seis Agulhas menores seguem a mesma curva com entrada escalonada, alternando lados. Fazem arcos de entrada e saída em 3,4 segundos. São rápidos, frágeis (0,3 HP), não atiram e não soltam itens. O ganho de ressonância por integrante é menor para não substituir a aceleração antiga de potência por especiais excessivos.
- Unidades independentes continuam com tiros mirados, leques e preparação visível. As formações aumentam a atividade sem transformar cada integrante em mais um atirador.
- Parasitas fixados à superfície acompanham exatamente o deslocamento do cenário. Avisam por 750 ms, disparam duas balas miradas e aguardam 2,1 segundos antes da próxima preparação. Não colidem fisicamente com a nave aérea; podem ser atingidos pelos disparos e bombas do jogador.
- Balas vindas da superfície crescem de cinco para doze pixels em 500 ms, mantendo colisão proporcional ao núcleo. Essa indicação distingue a origem em profundidade dos tiros aéreos comuns.
- O oceano continua coerente com a Fenda Pelágica: invasão alienígena, recifes biomecânicos, água escura e bioluminescência periférica. A rolagem visível é 0,72× o avanço lógico, corrigida pela escala da textura; os organismos fixos usam o mesmo fator. O fundo não fica parado.

## Diretriz permanente de profundidade — fases futuras

1. **Terra:** estruturas e organismos alienígenas do solo acompanham a rolagem; disparos sobem visualmente até o plano da nave. Nenhum tanque militar humano substitui o tema alienígena.
2. **Mar:** usar recifes, organismos ancorados, embarcações alienígenas e ameaças submersas, com origem e preparação legíveis. Alvos abaixo do plano de voo não causam colisão por contato.
3. **Céu/nuvens:** inimigos podem aparecer pequenos e distantes sob as nuvens, atirando de baixo para cima; crescem e mudam de sobreposição ao se aproximar. Avisar o corredor de aproximação antes de entrarem no plano da nave.
4. **Espaço/exterior do planeta:** aproximar adversários do plano profundo para a câmera com escala, luminosidade e trajetória coerentes, disparando durante a subida. Ao atingir o plano de combate, podem investir para colidir com a nave.
5. **Colisão:** profundidade precisa ser um estado de gameplay; inimigo distante não pode provocar dano de contato antes de alcançar o plano do jogador. Balas precisam indicar a transição de planos e respeitar uma janela de reação. Nada de surgir já grande sobre o jogador.

O primeiro passo marítimo está implementado. Aproximações completas de inimigos pelas nuvens/espaço e os demais biomas ficam para suas fases, sem liberar a Fase 2 agora.

## Dificuldades — decisão para implementação posterior

Somente **Normal** é usado no combate e apresentado como disponível. Preferências antigas de Difícil/Arcade não ativam multiplicadores ocultos nesta revisão. Normal busca pressão moderada, telegrafia clara e mistura de bandos sem tiro com unidades armadas; a avaliação de sensação continua em playtests.

| Modo futuro | Diretriz, ainda não implementada |
|---|---|
| Fácil | Mais tolerância, menos pressão simultânea e maior disponibilidade de recuperação. |
| Normal | Referência principal; consolidar esta calibração antes de derivar os demais. |
| Difícil | Rotas e combinações mais exigentes, com avisos e possibilidades de esquiva preservados. |
| Real | Uma vida. Dano conforme origem, calibre/energia e região atingida: certos ataques matam imediatamente; outros deixam avarias que permitem continuar até encontrar reparo. Criar tabela de letalidade e sistema de avarias/recuperação antes de habilitar o modo. Não equivale a declarar qualquer toque fatal. |

Não estão fixados ainda os multiplicadores, tabelas de dano, distribuição de curas e condições finais desses modos. O antigo rótulo Arcade não é um quinto modo aprovado.

## Validação e limites

- `npm run build`: aprovado, incluindo TypeScript; permanece o aviso de tamanho do bundle. `node --experimental-strip-types --test --test-reporter=tap tests/*.test.mjs`: 132 testes aprovados.
- `node scripts/validate-pilot-selection.mjs --normal`: aprovado, zero erros de navegador. `node scripts/validate-pilot-selection.mjs --confirmation`: regressão aprovada em ambas as resoluções obrigatórias, com seleção por teclado/clique/toque e todos os perfis sem scroll.
- Chrome real no build de produção: 1366×768, 1920×1080, 1280×800 e 2560×1080. Canvas e HUD preenchem o viewport; vitória/derrota sobrepõem o HUD sem cortes; replay por teclado, clique e toque; saída e reinício sem camadas residuais.
- Testes de coleta executam as colisões reais da cena: W repetida, troca no NV1, P parcial preservado na troca, três P para evolução e S de velocidade. Testes puros cobrem reserva e respawn, trajetória de bandos sem tiros, ancoragem e disparos de superfície, exclusividade dos símbolos e ausência de farm de P.
- Verificados no navegador: escala e colisão dos tiros da superfície, ausência de colisão aérea com os organismos ancorados, respawn com reserva e HUD atualizado, bloqueio dos atalhos de potência no build normal, artes de Moth/Knuckle preservadas e epílogo sem registrar vitória falsa na Fase 5. A cena de combate grava a Fase 1; o epílogo não duplica o registro.
- [Capturas e relatório](screenshots/normal-phase1/validation.json). As capturas de itens exibem o catálogo em posições controladas; as de resultado aceleram a chegada ao chefe e aplicam dano para verificar o fluxo final. Não equivalem a um playtest integral nem a um benchmark de FPS.
- Raia-Dente/Talassarca ainda precisam de arte final; carga, míssil e especiais mantêm os assets anteriores. Os demais modos e as fases futuras seguem pendentes.
