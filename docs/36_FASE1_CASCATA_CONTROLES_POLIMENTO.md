# Fase 1 — cascata, controles e polimento

Diretriz de 10/11/2026. Prevalece sobre regras conflitantes dos documentos 27, 30, 31, 33 e 35. O escopo permanece Fase 1 / RIVET / dificuldade Normal. Fase 2, Android e demais pilotos aguardam aprovação explícita.

## Evolução decidida para Bullet Wake

O pedido mais recente substitui a troca livre de cores pela cadeia **azul NV4 → verde NV1 → verde NV4 → rubro NV1**. Esta é uma decisão de Bullet Wake; não deve ser apresentada como regra original de Fire Shark.

- Cada família tem quatro níveis. Três itens P sobem um nível; nove P levam do NV1 ao NV4.
- Uma cápsula só libera a família imediatamente seguinte quando a atual está no NV4. A nova família começa no NV1 com P zerado. Não há salto azul → vermelho, regressão para azul por cápsula ou troca prematura.
- Cápsula da mesma cor continua valendo 5.000 pontos. Uma cápsula bloqueada não altera potência, família ou pontos.
- No NV4, P ainda pode formar a reserva de três para recuperação no Continue. A reserva é consumida ao evoluir de família; não entrega potência gratuita à nova arma.
- O Continue mantém a regra existente: retorna ao azul, preserva P parcial e permite NV2 se havia uma reserva completa; mantém as cargas de especial restantes.
- Quatorze transportadores biológicos, uma carga física por transportador, nove P, um S, um reparo, duas cargas E e uma oportunidade final de evolução. Não há drops de inimigos comuns.
- Os primeiros nove P permitem alcançar azul NV4 apenas depois de aproximadamente 100 segundos de rolagem. A última carga chega depois de aproximadamente 116 segundos, sem contar a interrupção do miniboss. Se o piloto ainda não chegou ao máximo, ela oferece P. Se chegou, oferece a próxima família. Não há espera automática nem coleta remota.
- Assim, uma partida perfeita pode chegar ao verde NV1 perto do chefe. O vermelho não aparece durante o roteiro normal desta fase. Seus quatro níveis estão implementados e disponíveis no sandbox para avaliação; a distribuição em campanha futura fica pendente. Não aceleramos todo o arsenal para caber na primeira fase.

## Armas, tiros inimigos e especial

O rubro alcança o topo da arena desde NV1, respeitando os bloqueadores e a colisão real. A progressão visual é 1 / 2 / 4 / 4 fluxos: no máximo as duas asas ampliam a varredura e retornam pelos flancos. A cobertura cresce ao longo do movimento; não existe dano universal automático em todo pixel da tela. Dano, ângulos, oscilação e alcance em unidades do mundo são calibração própria, não constantes medidas na ROM.

No Normal, tiros táticos comuns ficaram 35% mais rápidos. Transportadores usam 160 unidades/s; organismos da superfície, 175. Talassarca usa 205 na casca e 230 na forma interna. Permanecem avisos de ataque, corredores de esquiva e colisão varrida contra o casco, para que projéteis rápidos não atravessem o bico. Os modos alternativos não foram liberados nesta entrega.

A Tempestade Prismática da RIVET virou três salvas escalonadas com cinco lanças cada, atravessando a arena de baixo para cima. Cada lança tem ignição, deslocamento, impacto e dissipação; sprites são recortados pela arena para não invadir o HUD. Impactos causam dano local aos inimigos comuns, acompanhados de partículas curtas. O dano único de 120 no chefe ocorre no primeiro impacto, sem multiplicar o orçamento por lança ou frame. Mantidos: duas cargas iniciais, máximo três, limpeza de balas e proteção durante 3,8 s. Talassarca continua exigindo cinco especiais equivalentes na casca e três na forma interna. Não há bomba separada.

## Água e apresentação

Três spritesheets de oito frames continuam alimentando o oceano, a invasão e a fenda. A animação agora tem fluxo UV mais perceptível, mistura dos detalhes de espuma, modulação da superfície e espuma pintada em movimento contínuo, sem linhas geométricas sobre o oceano. A água se move com a rolagem parada e mantém velocidade temporal independente de FPS. Janelas de amostragem sobrepostas evitam a emenda horizontal na repetição.

A abertura continua relativamente calma, a invasão cresce entre 1100 e 2400 unidades percorridas, e a fenda se revela entre 3150 e 4100 antes de Talassarca. Não há tremor de câmera. O HUD mantém fundo preto/carbono, área destruída discreta, uma única barra de integridade, sobrevivência à esquerda e armamento/progresso/pontos à direita. Foram removidas as teclas permanentes das laterais; o botão inferior abre pausa/opções.

## Controles e fluxo

Antes de iniciar a Fase 1 pela seleção, o jogador confirma o guia de comandos. Nenhum inimigo, cronômetro ou movimento avança enquanto ele lê. Reiniciar e Continue não repetem obrigatoriamente o guia, que permanece acessível em **Pause → Opções → Ver comandos**. A mesma área oferece a legenda dos coletáveis. O guia, a pausa e as opções mantêm a tipografia existente e usam preto fosco/carbono neutro, conforme a revisão de carregamento abaixo. Encerrar uma vitória retorna à abertura; a outra saída permite escolher piloto. A Fase 1 não conduz ao epílogo legado nem às fases seguintes.

| Ação | Teclado | Controle padrão Xbox | PlayStation | Nintendo padrão |
|---|---|---|---|---|
| Movimento | WASD / setas | Analógico / direcional | Analógico / direcional | Analógico / direcional |
| Disparo | Espaço | A | ✕ | B |
| Especial | X | X | □ | Y |
| Dash | Shift | RB | R1 | R |
| Carga | C | LT | L2 | ZL |
| Míssil | M | Y | △ | X |
| Pause | Esc | Menu | Options | + |

V e B no teclado não acionam especial. R não reinicia acidentalmente o combate; reinício fica no pause. O botão B de um controle Nintendo, por exemplo, é um botão físico mapeado pela API, não a tecla B do teclado.

A API Gamepad com mapeamento `standard` alimenta o jogo e os menus. Há zona morta, diagonais normalizadas, eventos de pressionar/soltar e navegação por analógico/direcional. Os nomes dos botões acompanham o dispositivo reconhecido. Desconectar o controle pausa a partida. Dispositivos sem mapeamento padrão exigem trabalho posterior de remapeamento, sem adivinhar seus botões. A conexão pode só ser exposta pelo navegador após o primeiro botão pressionado.

Android permanece pendente. Dois botões de ação, especial e dash, só resolvem a interface se movimento e disparo forem definidos separadamente (por exemplo, movimento por arrasto e disparo automático). Carga e míssil ainda existem no desktop; não assumir que desaparecerão do mobile sem uma decisão de design.

## Referências verificadas e limites

- [Manual original Fire Shark / Genesis](https://www.retrogames.cz/manualy/Genesis/Fire_Shark_-_Genesis_-_Manual.pdf), páginas impressas 9–11: três P por melhoria, Wide Shot até 16 projéteis, Shark Beam espiralado, Super Fire contínuo até quatro fluxos, transportadores e itens. Página 5: opção RAPID.
- [Toaplan / TATSUJIN](https://www.toaplangames.co.jp/en/license/license-09.html): descrição oficial da apresentação do Super Fire como asas flamejantes.
- [Manual original Sonic Wings 2, Video System 1994](https://db.hfsplay.fr/files/2019/06/14/1aa6199e-35d2-456a-8a2f-e3513f37594e.pdf), seção de aeronaves: especiais próprios de cada piloto/aeronave. A interpretação de Bullet Wake é bombardeio prismático em salvas, não uma cópia de um especial específico.
- [Gameplay Genesis NTSC de referência](https://www.youtube.com/watch?v=JbI9SbqzRSI). Esta revisão não concluiu medição quadro a quadro dos doze estados originais. Não reivindicar reprodução exata de contagens intermediárias, DPS, ângulos ou recuperação da ROM. A cadeia solicitada já diverge deliberadamente do original.

## Asset e prompts

Gerado pelo **imagegen integrado**, com alfa verdadeiro, e empacotado por crop/escala proporcional preservando alfa. Asset final: [special.webp](../public/assets/combat-hd/polish/special.webp), oito frames de 384 × 384. Integração: [PrismStrike](../src/game/render/PrismStrike.ts). Nenhuma remoção de fundo ou pintura por script.

Prompt inicial:

> Use case: stylized-concept. Production sprite sheet for BULLET WAKE premium 2D painted arcade vertical shooter. EXACT 4 columns x 2 rows, 8 evenly spaced square animation frames in chronological reading order, true transparent background, no text, no borders. Subject: ONE original prismatic bombardment lance projectile, vertically oriented point upward, ivory-white incandescent spear core, golden orange fire along sides and violet refracted energy ribbons. This is a powerful LIMITED SPECIAL aerial strike inspired by classic 1990s shoot-em-up spectacle, not a logo, shield, ring or magic emblem. Frame 1 ignition narrow spear; frames 2-4 long racing plasma lance with lively twisting flame tails below, frames 5-6 violent starburst impact shedding incandescent shards, frame 7 fading orange/violet sparks, frame 8 just few tiny embers. Keep all eight frame centers identical, each fully contained with transparent generous gutters. Hand painted crisp detailed 2D concept art, luminous white core with saturated orange violet secondary streaks. No gray smoke, no black background, no rectangular matte, no circle, no ship, no alien, no scenery. Runtime will launch several of these across playfield; draw one discrete isolated effect per cell, no screen-wide wash.

Correção final sobre a primeira geração, para eliminar cortes nas células:

> Correct this game spritesheet. Keep exact 4 columns x 2 rows eight square animation cells, transparent alpha, same golden white violet plasma attack progression and painted quality. Essential repair: SHRINK EVERY EFFECT TO 60% OF ITS CURRENT SIZE centered separately within its own cell. All eight cells must have at least 60 pixels of fully transparent gutter on EVERY side. No effect clipped at image edges, no glowing pixel crossing any cell boundary. Top row long spears each fully inside own cell, second row impact bursts and fading embers each fully inside own cell. Remove gray haze; keep luminous orange white violet colored sparks and soft colored alpha glow only. Frame8 extremely sparse embers. No text or gridlines.

## Validação desta entrega

- `npm run build`: aprovado, incluindo TypeScript. Permanece o aviso de bundle Phaser maior que 500 kB.
- `node --experimental-strip-types --test tests/*.test.mjs`: **149 testes aprovados**. Inclui bloqueio da cascata, nove P por família, reserva, comandos exclusivos, controle padrão, alcance do rubro, colisão varrida, formações e orçamento das duas camadas do chefe.
- `node scripts/validate-pilot-selection.mjs --cascade`: [relatório](screenshots/phase1-cascade/validation.json). Guia antes da partida, congelamento real da simulação, pause/opções, X sem V/B, movimento e especial por Gamepad simulado, pausa ao desconectar, coleta física com bloqueio de evolução, limpeza do especial e imagens dos quatro níveis do rubro e dos três estados do oceano.
- `node scripts/validate-pilot-selection.mjs --fine`: [relatório](screenshots/phase1-fine/validation.json). Água com scroll parado, continuidade e equivalência em 30/60/120 Hz, alfa dos projéteis, impacto no bico, reparo apenas uma vez, áudio renderizado offline e remoção dos efeitos em menos de 500 ms.
- `node scripts/validate-pilot-selection.mjs --polish`: [relatório](screenshots/phase1-polish/validation.json). Doze estados de armas, animações orgânicas, especial, metamorfose, duas camadas e resultados sem cortes.
- `node scripts/validate-pilot-selection.mjs`: [relatório](screenshots/pilot-confirmation/validation.json). Confirmação dentro do card, perfis, teclado/mouse/touch, nenhum aumento de card ou scroll.

Todas as verificações de navegador acima passaram em **1366×768 e 1920×1080**, sem erros de navegador. Capturas de inspeção usam estados controlados/sandbox quando necessário; não representam uma partida humana vencida. Gamepad foi simulado na API do navegador, e áudio foi verificado por renderização offline, não por avaliação auditiva humana.

## Recomendações antes de aprovar a Fase 1

1. Fazer partidas humanas completas no Normal para ajustar simultaneamente velocidade das balas, espaçamento de ataques e dano recebido. Testes automáticos não decidem se a dificuldade está agradável.
2. Aprovar o ritmo da cadeia: verde no final da Fase 1, rubro reservado à continuidade da campanha. Se ambos precisarem aparecer nesta fase, rever duração ou economia de P explicitamente, sem voltar à troca prematura.
3. Avaliar o especial e a metamorfose com o chefe em movimento; ajustar impacto visual e áudio por preferência após jogar.
4. Validar controles físicos Xbox/PlayStation/Nintendo e navegadores reais. A cobertura automatizada usa snapshots/API Gamepad simulados; não equivale a conectar esses aparelhos.
5. Medir desempenho em uma máquina intermediária e uma GPU integrada. O bundle Phaser ainda gera aviso de tamanho no build; otimização de carregamento permanece recomendada.

A fase está em revisão, não aprovada automaticamente. Android, novos modos de dificuldade, outros pilotos e próximas fases permanecem fora desta entrega.


## Revisão: carregamento e carbono fosco (10/11/2026)

Esta revisão substitui a paleta marrom/âmbar do guia e dos painéis da gameplay. Não altera o layout, a tipografia, o oceano animado ou as mecânicas de combate.

- Confirmar o piloto abre **CARREGANDO OPERAÇÃO**, com barra vinculada ao progresso do carregador de recursos. Depois de criar a cena, a apresentação permanece por mais 650 ms para ser visível também quando os recursos já estão em cache. O guia aparece somente após essa preparação.
- Confirmar **ENTENDI · INICIAR OPERAÇÃO** abre **PREPARANDO DECOLAGEM** por **2,5 segundos**, com barra temporal. Essa segunda barra representa a transição solicitada; não simula um novo download.
- A simulação fica pausada em toda a preparação, leitura e decolagem. A música de combate começa ao entrar na gameplay. Cliques repetidos, Enter, Escape e confirmações do controle não pulam nem reiniciam a transição.
- Pausa, opções e retorno à partida não acrescentam essa espera. Reiniciar e Continue mantêm o fluxo existente sem repetir obrigatoriamente o guia.
- O carregamento trata falha de recursos com mensagem e retorno aos pilotos. Sair da cena cancela a transição e remove os bloqueios de entrada, evitando reativação tardia da gameplay.
- Guia, loading, pausa, opções e HUD usam preto fosco, textura sutil de carbono, bordas cinza e textos neutros. As laterais preservam os destroços discretos. Vida, armas, potência coletada e especial mantêm suas cores de identificação. As telas iniciais e os cards aprovados permanecem com sua identidade própria.

### Validação desta revisão

Build de produção e 149 testes de lógica aprovados. A verificação de navegador em 1366×768 e 1920×1080 mede a duração real da decolagem, verifica a simulação congelada, proteção contra confirmação duplicada, retorno sem atraso da pausa, carregamento com cache, ausência de scroll e descarte da transição ao sair da cena. Controle padrão é simulado pela API de gamepad; falha de recurso é exercitada pelo evento do carregador. Essas verificações não substituem teste com controle físico.

Executar: `node scripts/validate-pilot-selection.mjs --loading` após `npm run build`. [Capturas e relatório](screenshots/phase1-loading/validation.json). A aprovação visual da Fase 1 continua pendente do usuário; Fase 2 e Android não foram liberados.
