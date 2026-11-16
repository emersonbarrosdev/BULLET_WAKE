# Reformulação arcade — implementação e validação

13/11/2026. Escopo: as duas missões do [brief aprovado](54_DIRECAO_ARCADE_APROVADA.md), priorizando Fenda Pelágica antes de Cidade Solar. Esta revisão substitui a direção biomecânica anterior. [Bíblia atual](27_BULLET_WAKE_V2_DEFINITIVO.md).

## Entrega

- Nova identidade cartoon/anime, logo em seis versões, abertura animada pulável, seleção de piloto e missão, HUD, pausa, controles, opções, vitória, resultados, derrota e encerramento.
- Bayek/RIVET jogável em UP e SIDE, com sprites próprias, três motores e poses de inclinação. Tita, Leona, Osvald e Hien mantêm identidade, registros e novos retratos; não são selecionáveis nesta etapa.
- Motor compartilhado com movimentos, formações, tiro, recursos, coleta, dano e progresso. Conteúdo de cada missão é autoral, com perspectivas e obstáculos diferentes.
- Dez famílias: caça, interceptador, acrobata, bombardeiro, lancha, navio, tanque, torre, dirigível e disco alienígena. Articulações de armas terrestres/naval, hélices, quedas e explosões em camadas. Todos os tiros hostis são esféricos.
- Rajada de três pulsos, opção acessível, evolução NV1–FULL e mísseis automáticos preservando o tiro vermelho aprovado. Tormenta Escarlate lança bomba com explosão em área (0,65 s de voo + 2,1 s de explosão), limpando projéteis na área e protegendo a RIVET (revisão que sucedeu o feixe frontal histórico).
- Onze caixas por roteiro, perda real de potência ao morrer, recuperação de um P comum, limites cinco vidas/especiais e excedentes em pontos. Passagem para Cidade Solar conserva exatamente o estado obtido na Fenda.
- Normal e Difícil; no Difícil, escoltas extras e cadências mais intensas sem aumentar HP. LOW/MED/HIGH afetam decoração, não simulação.
- Oito músicas originais para doze contextos, efeitos curtos cartoon e canhão principal preservado. Música inicia em 18%, com ganho de mixagem 0,52; efeitos à frente. Volume configurável e pausa com cursor preservado.

## Chefes e cenários

**Fenda Pelágica / UP:** mar tropical animado em camadas, costa, arquipélago, aceleração, patrulha naval (`Miniboss` de três alvos), fenda e transição para mar aberto. Chefe final: **Submarino Colosso Abissal** modular em cinco seções longitudinais destrutíveis progressivamente (`PROA BLINDADA`, `ARMAMENTO FRONTAL`, `TORRE DE COMANDO`, `ARMAMENTO TRASEIRO`, `PROPULSÃO ABISSAL`), com torres duplas giratórias, silos VLS, ponte de comando destrutível em chamas, turbinas de popa e reator abissal. O casco exposto e os módulos recebem dano diretamente; marcas de cratera, fogo e fumaça persistem nas seções; bombas especiais respeitam teto por seção (`220`) para impedir pular fases; a destruição final encadeia colapso progressivo de `3,6 s` seguido de saída automática da RIVET. *(Histórico: substitui o combate anterior do Encouraçado Pula-Onda).*

**Cidade Solar / SIDE:** horizonte urbano, parallax, pontes, portões, área industrial, barreiras destrutíveis e altitude. Miniboss transportador. Mega Dirigível Giro: hélices, deslocamento vertical, canhões independentes, leques escalonados, salvas oscilantes e ataque pesado mirado em três esferas. Não reutiliza a fuga nem o ataque radial naval. Destruição com inclinação, explosões e saída da RIVET.

O casco dos chefes não consome tiros destinados às armas e não distribui dano ao canhão mais próximo. Canhões destruídos param de atirar. Colisão dos inimigos usa alpha da sprite em produção; testes do modelo puro usam aproximação geométrica, por isso seus resultados não são intercambiáveis.

## Duração medida

Partidas completas automatizadas no navegador, usando a simulação real e colisão alpha das sprites. O bot movimenta, atira, tenta coletar, esquiva e usa especiais; não recebeu invulnerabilidade ou potência extra nestas duas partidas. A execução foi acelerada, portanto os tempos abaixo são do **relógio do combate**, não tempo de parede nem partidas humanas. Intro e saída automática ficam fora desse relógio.

| Missão | Duração de combate | Mortes | Saída |
|---|---:|---:|---|
| Fenda Pelágica | 340,758 s — aproximadamente **5min41s** | 1 | 3 vidas, NV1 + 1P, 0 especiais, 62.330 pontos |
| Cidade Solar | 347,892 s — aproximadamente **5min48s** | 1 | 3 vidas, NV3 + 1P, 0 especiais, 115.430 pontos |

A Cidade Solar começou com **3 vidas, NV1 + 1P, zero especiais e 62.330 pontos**, exatamente como a primeira terminou. Ambas ultrapassam cinco minutos sem depender de telas de loading. A duração humana pode variar conforme mortes, coleta e precisão nos módulos. [Evidência estruturada](screenshots/cartoon/browser-report.json).

## Testes executados

**260 testes passaram, zero falhas:** 207 regressões legadas preservadas e 53 testes da suíte arcade (`arcade.test.mjs`, `arcadeSpecial.test.mjs`, `arcadeTask2.test.mjs`, `pelagic.test.mjs`, `pelagicCoastContinuity.test.mjs` e `pelagicSubmarineBoss.test.mjs`). Incluem rajadas e cadência acessível, limites e excesso, perda/recuperação de potência, colisão alpha rejeitada, acertos reais em módulos, superfície sem colisão física, avisos, ausência de cinco segundos, especial em bomba/área com dano limitado por janela, mísseis FULL, save entre fases, dados inválidos, escoltas do Difícil, obstáculos, mix padrão, saída automática, diferença entre especiais dos chefes, progressão modular de 5 seções do `COLOSSO ABISSAL` e continuidade temporal das camadas oceânicas quando a rolagem desacelera ou para.

`npm test` executa a suíte completa via `node --experimental-strip-types --test tests/*.test.mjs`. TypeScript (`tsc --noEmit`) e `npm run build` (Vite) passaram (`dist/assets/index-BXeMf7MJ.js`, 1.737,57 kB minificado). Não existe script de lint separado neste projeto.

O navegador de produção verificou:

- Carregamento dos atlas e áudio sem erros JavaScript ou falhas de recursos registradas.
- Teclado, movimentação/tiro/pausa por **controle virtual padrão**.
- Touch emulado: pressionar/soltar tiro, joystick, especial e pausa.
- Pausa congela relógio; desbloquear áudio/navegar em controles não reinicia música.
- Retorno entre seções do Colosso Abissal, arena de mar aberto e transição progressiva entre todas as 5 seções do submarino.
- Capturas do submarino colossal em `docs/screenshots/pelagic-combat-v2/` (entrada, cinco seções, cratera em casco, torre em ruínas, especial, colapso, saída automática, 1920×1080 e touch 854×480).
- Resultado, encerramento, Game Over, tentar novamente, cancelar saída e confirmar saída.
- Saída automática completa da nave, sem projéteis congelados nos resultados.
- Capturas em 1366×768 e interface compacta 854×480, sem corte dos menus verificados.

Durante a validação foram corrigidos: sobrescrita do snapshot da Fenda pela Cidade Solar; música religando na pausa; recortes com fragmentos vizinhos; ilhas ultrapassando a arena; tiros residuais no resultado; saída lateral curta demais. A primeira tentativa do teste touch habilitava emulação depois do boot do Phaser; o harness foi corrigido para habilitar antes da inicialização, como ocorre em um navegador touch real.

## Desempenho

Chrome headless, WebGL/ANGLE, AMD Radeon integrada (0x1681), Direct3D11, viewport 1366×768, deviceScaleFactor 1. Amostras de oito segundos **em tempo real** por perspectiva/qualidade, com chefe, horda de bombardeiros, FULL e especial. Estas amostras não são a simulação acelerada usada para medir as partidas.

| Cenário | FPS observado | Frame mediano / p95 | Pico de projéteis |
|---|---:|---:|---:|
| Fenda LOW | ~59,8 | 16,7 / 16,9 ms | 63 |
| Fenda HIGH | ~59,8 | 16,7 / 16,8 ms | 63 |
| Cidade LOW | ~59,8 | 16,7 / 16,8 ms | 119 |
| Cidade HIGH | ~59,8 | 16,7 / 16,9 ms | 119 |

Heap JS nas amostras: aproximadamente 48–59 MB (50,4 a 61,7 milhões de bytes), sem incluir VRAM. Pool de 640 projéteis e reaproveitamento de sprites de efeitos. [Medições completas](screenshots/cartoon/performance-report.json). Não extrapolar esses resultados para Android ou outros computadores.

## Áudio

Oito OGG estéreo a 44,1 kHz decodificados integralmente: zero amostras clipadas ou valores inválidos. Pico máximo medido abaixo de 0,80. Volume de transporte inicial confirmado em 0,0936 (18% × 0,52). [Validação dos arquivos](screenshots/cartoon/audio-validation.json), [procedência e licença](56_ARCADE_ASSETS.md). Os testes de transporte/mix e análise de arquivos não equivalem a escuta humana comparativa.

## Limitações e próximos critérios de aprovação

1. Aprovação artística e sonora pelo jogador continua pendente; não alegar que o bot ouviu ou julgou emoção, timbre ou diversão.
2. Controle físico e Android real não foram testados. Há adapter padrão e touch funcional emulado, mas não há medição de GPU móvel, latência física ou APK publicado nesta entrega.
3. Balanceamento foi exercitado por bot e testes de mecânicas; precisa de sessões humanas com diferentes níveis de habilidade. A tentativa automatizada sem usar especial perdeu na Fenda, o que indica pressão, não comprova por si só um Normal ideal.
4. Campanha completa, armas dos demais pilotos no novo motor, sexto piloto, Remix e três fases secretas são planejamento preservado. Nenhum desses conteúdos é declarado entregue.
5. O bundle pode futuramente separar cenas legadas por carregamento sob demanda. A medição atual indica fluidez no equipamento testado, não elimina essa oportunidade.

## Oceano Vivo e Interação Naval (Tarefa 04)

- **Preservação integral das margens:** `coast-harbor-v2.png` e `coast-leisure-v3.png` permanecem intocadas em praias, rochas, porto, farol e vegetação; o canal marinho profundo na pintura (`PelagicCoastPainting.ts`) suaviza o alpha radialmente a partir dos contornos reais do terreno (`landDist` 2D) para revelar o oceano animado em múltiplas camadas (`oceanDepth`, `waterSwell`, `pelagic-water-review`, `oceanCaustics`) sem gerar novas ilhas ou faixas artificiais.
- **Espuma costeira e águas rasas:** texturas derivadas diretamente da pintura (`pelagic-coast-shoal-v1` e `pelagic-coast-surf-v1`) animam com fluxo temporal contínuo contra rochas, praias e estacas do cais.
- **Ondas e reflexos contínuos:** `PelagicWater.ts` e `ArcadeBackdrop.ts` mantêm ondulação primária, swell cruzado, cáusticas, cristas com ciclo de vida suave e brilhos especulares sutis (`depth -18.74`, sempre abaixo de unidades e projéteis) ativos mesmo quando `world.scroll` desacelera ou para em combates contra chefes.
- **Embarcações e submarinos:** barcos/navios substituem anéis concêntricos estáticos por sombra de quilha ancorada, proa com corte em V e esteiras Kelvin/turbina responsivas à velocidade e curva (`turnRate`); submarinos distinguem emergência (ondas expansivas, ebulição de ruptura e imersão cromática), superfície estabilizada e submersão (vórtice de sucção e fervura residual).
- **Evidências comparativas (BAIXA / MÉDIA / ALTA, ~59,8–59,9 FPS, paridade de simulação verificada):** [relatório completo](screenshots/pelagic-ocean-v4/report.json) e capturas em `docs/screenshots/pelagic-ocean-v4/` (costa, porto, farol, combate naval em movimento/hold, submarinos emergindo/superfície/submergindo, `COLOSSO ABISSAL` e qualidades 0/1/2).

## Animação Profissional da RIVET e dos Inimigos (Tarefa 03)

- **Spritesheets desenhadas em RGBA transparente:** empacotador reprodutível em [`scripts/pack-pelagic-animations.mjs`](../scripts/pack-pelagic-animations.mjs) gera quatro folhas dedicadas à Fenda Pelágica (`UP`) em `public/assets/arcade/pelagic-review/` sem recorte ou sobreposição entre células:
  - [`rivet-up-sheet.webp`](../public/assets/arcade/pelagic-review/rivet-up-sheet.webp) (`1792×1024`, grade `7×4` de `256×256`): 7 ângulos contínuos de inclinação lateral (`bank` de `-1` a `+1`, coluna neutra `3`) × 4 quadros de variação dos três propulsores, mantendo a silhueta e paleta aprovadas da RIVET.
  - [`pelagic-enemy-air.webp`](../public/assets/arcade/pelagic-review/pelagic-enemy-air.webp) (`896×2048`, grade `7×16` de `128×128`): quadros específicos por família — `fighter` (5 inclinações × 4 fases de hélice frontal), `interceptor` (5 inclinações × 4 chamas duplas de pós-combustão), `acrobat` (7 poses de rolagem/manobra × 4 fases de hélice) e `bomber` (5 inclinações pesadas × 4 rotações sincronizadas das duas hélices alares).
  - [`pelagic-ufo-anim.webp`](../public/assets/arcade/pelagic-review/pelagic-ufo-anim.webp) (`768×128`, `6×1` de `128×128`): 6 fases de luzes periféricas giratórias e brilho antigravitacional azul-turquesa no disco `alien`.
  - [`pelagic-vfx.webp`](../public/assets/arcade/pelagic-review/pelagic-vfx.webp) (`512×512`, `4×4` de `128×128`): pós-combustão ciana (linha 0), clarões de disparo (linha 1), anel translúcido de invulnerabilidade/recuperação (linha 2) e partículas cartoon de dano/fumaça/faíscas (linha 3).
- **Controlador isolado e hitbox preservada (`PelagicActorAnims.ts` e `PelagicActorAnimsMath.ts`):** aplicado exclusivamente em `world.up` (Cidade Solar permanece intocada). Reação visual de disparo (recuo curto na sprite, clarão de boca e dos pilones alares) sem deslocar `world.player.x`/`world.player.y`; rastros de ponta de asa, linhas de velocidade ao avançar, brilho/anel de invulnerabilidade e pulso de recuperação. Sombra oceânica da RIVET em `ArcadeBackdrop.ts` acompanha a inclinação da asa.
- **Famílias inimigas e leitura em combate:** rolagem sincronizada às curvas em `UP` (`localBank = -bankEff` para compensar rotação `Math.PI`), brilho de alerta de tiro, recuo de torres giratórias navais/terrestres, trim de emergência/submersão em submarinos, fumaça e faíscas de baixo HP e explosões instantâneas em camadas (com borrifo d'água em alvos navais), sem cadáveres caindo. Como o detector de silhueta (`makeAlphaMask`) utiliza limiar `alpha >= 128`, rastros e halos semitransparentes não inflam a colisão física.
- **Validação específica:** testes unitários em [`tests/pelagicActorAnims.test.mjs`](../tests/pelagicActorAnims.test.mjs) e inspeção automatizada Chrome/WebGL em [`scripts/pelagic-anims-check.mjs`](../scripts/pelagic-anims-check.mjs) com 12 capturas e vídeo demonstrativo em `docs/screenshots/pelagic-anims-v1/pelagic-anims-demo.webm`.

## Direção de Combate e Ritmo Arcade (Tarefa 05)

- **Escopo estrito e invariantes preservadas:** alterações aplicadas exclusivamente aos encontros, ritmo e telemetria visual da Fenda Pelágica (`this.up` em [`src/game/arcade/content.ts`](../src/game/arcade/content.ts), [`src/game/arcade/ArcadeWorld.ts`](../src/game/arcade/ArcadeWorld.ts) e [`src/game/arcade/PelagicActorAnims.ts`](../src/game/arcade/PelagicActorAnims.ts)). Os `39` encontros da Cidade Solar (`SOLAR`), as `11` caixas de suprimento (`SUPPLIES`), os HPs base de `FAMILY`, a duração da fase (`300s` + chefe final) e as armas/evoluções da RIVET foram integralmente preservados.
- **Coreografia por janelas na Fenda Pelágica (`FENDA.encounters`):**
  - `0–45s` (`3..40s`, Costeira): abertura progressiva em ondas alternadas (`fighter` trio `straight`, par `diagonal`, `acrobat` `successive` `curve`, `interceptor` `solo` `dive`, `fighter` `horde` `sine`, `interceptor` par `diagonal`, `acrobat` `stagger` `curve`).
  - `45–90s` (`46..85s`, Costeira → Marítima): interação costeira e naval (`boat`, `submarine`, `tower`, `ship`) intercalada com escolta aérea (`acrobat` trio `turn`, `alien` par `sine`, `fighter` `horde` `curve`).
  - `90–135s` (`91..132s`, Marítima): pressão escalonada combinando `fighter` `v` `sine`, `interceptor` `pincer` `diagonal`, `tank`, `bomber` `escort` `straight`, `boat`, `acrobat` `quartet` `curve`, `submarine` e `interceptor` `solo` `straight`.
  - `135–155s` (`138..148s`, Corrente Expressa): respiro tático antes do miniboss com apenas 3 encontros espaçados (`interceptor` `solo` `dive` aos `138s` e `143s`, `acrobat` par `curve` aos `148s`) para recuperação e coleta segura antes de `155s`.
  - `155–200s` (`155..193s`, Corrente → Pós-Miniboss): `ship` `solo` aos `155s` (miniboss) seguido de retomada progressiva em `174s` (`boat`, `fighter` `v` `sine`, `interceptor` `solo` `dive`).
  - `200–255s` (`202..244s`, Estreito Naval): fogo cruzado ar/mar/terra (`tower` par, `fighter` `horde` `sine`, `submarine`, `interceptor` par `dive`, `boat` par, `alien` par `retreat`, `acrobat` `successive` `turn`, `bomber` `escort` `retreat`).
  - `255–300s` (`256..293s`, Aproximação do Colosso): escalada final até o chefe (`fighter` `horde` `accelerate`, `boat`, `interceptor` `pincer` `diagonal`, `submarine` par, `acrobat` `quartet` `zigzag`, `bomber` par `straight`, `fighter` `v` `accelerate`, `interceptor` par `dive`), desembocando no `COLOSSO ABISSAL` em `300s`.
- **Regras de justiça, escalonamento Normal × Difícil e interação geográfica (`ArcadeWorld.ts`):**
  - Escolta adicional do modo Difícil (`this.hard`) na Fenda (`this.up`) diferenciada por família/região: cobertura naval (`fighter` par `curve`) sobre `boat`/`ship`/`submarine`, flanqueamento `diagonal` na região `0` e `interceptor` em `curve`/`pincer` nas regiões posteriores.
  - Cadência inicial escalonada por integrante da formação (`1.65 + i * 0.28s`; `1.9 + i * 0.42s` em `bomber`; `1.7 + i * 0.35s` em unidades de superfície), impedindo paredes instantâneas de projéteis simultâneos na entrada do esquadrão.
  - Entrada lateral de `boat` pela baía leste quando `e.lane > 0.68`, posicionada sobre água navegável por `prepareSurface` em [`src/game/arcade/PelagicEnvironment.ts`](../src/game/arcade/PelagicEnvironment.ts).
  - Janela justa de disparo em `UP`: bloqueio de tiro fora do topo (`e.y <= arena.top + 18`) e atrás do jogador (`e.y > player.y - 44`).
  - Ajuste de legibilidade/esquiva do `COLOSSO ABISSAL`: ritmo após queda da ponte em `1.18`, redução de recarga por seção limitada (`Math.max(0.76, 1 - secIdx * 0.05)`) e torres laterais com leque duplo `[-0.12, 0.12]` no Normal (preservando 3 vias `[-0.22, 0, 0.22]` no Difícil e na torre central avançada).
- **Avisos visuais pré-ataque (`PelagicActorAnims.ts`):** na janela `e.warning > 0` (`0.6s`), unidades pesadas (`bomber`, `ship`, `submarine`, `tower`, `tank`) e ameaças rápidas (`interceptor`, `alien`) exibem anel contrátil de alerta e linha curta direcional de mira (`e.warning > 0.35..0.4`) antes do disparo.
- **Testes automatizados de ritmo e progressão:** [`tests/pelagicPacing.test.mjs`](../tests/pelagicPacing.test.mjs) valida as 7 janelas temporais, as 10 formações e 10 trajetórias, o bloqueio de tiro fora da janela justa, a preservação integral de `SOLAR` e `SUPPLIES`, além da conclusão simulada em Normal e progressão diferenciada em Difícil.

### Roteiro de Playtest Humano (pendente — não executado por humanos nesta etapa)

Checklist estruturado para validação manual posterior (sessões independentes de jogadores humanos; nenhum resultado automatizado substitui esta etapa):

1. **Sessão 1 — Normal (Fenda Pelágica completa, 0s → Colosso Abissal):**
   - `0–45s`: confirmar leitura intuitiva das primeiras formações (`straight`, `diagonal`, `curve`, `dive`) e tempo confortável de reação sem punir o jogador nos primeiros segundos.
   - `45–135s`: avaliar visibilidade dos anéis/linhas de alerta em `boat`, `submarine`, `tower`, `ship`, `tank` e `bomber`; observar se há algum pico abrupto entre os `90s` e `135s`.
   - `135–155s`: confirmar sensação explícita de respiro e reposicionamento antes do anúncio do miniboss em `155s`.
   - `155–300s`: avaliar ritmo do miniboss (`155–174s`), clareza nas formações compostas de `200–255s`, intensidade crescente de `255–300s` e entrada orgânica no `COLOSSO ABISSAL`.
   - `300s+` (`COLOSSO ABISSAL`): validar espaço real de esquiva na faixa inferior diante das 5 seções e se há leitura clara dos módulos prioritários e avisos amarelos/vermelhos.
2. **Sessão 2 — Difícil (Fenda Pelágica completa):**
   - Comparar pressão das escoltas navais e interceptadores extras com o Normal; verificar se o aumento de desafio exige antecipação sem criar armadilhas inevitáveis ou perda abrupta de clareza visual.
3. **Sessão 3 — Regressão de controles e armas:**
   - Confirmar que todas as evoluções de arma (níveis 1–5), bomba especial da RIVET e duração de power-ups permanecem fiéis à especificação original, assim como a Cidade Solar inalterada.

## Eventos Especiais da Fenda Pelágica (Tarefa 11)

Implementados exclusivamente na Fenda Pelágica (`UP`) via [`src/game/arcade/PelagicSpecialEvents.ts`](../src/game/arcade/PelagicSpecialEvents.ts), [`src/game/arcade/ArcadeWorld.ts`](../src/game/arcade/ArcadeWorld.ts) e [`src/game/arcade/PelagicActorAnims.ts`](../src/game/arcade/PelagicActorAnims.ts), com trava determinística por instância de partida (`specialEventsTriggered`, zero duplicação, zero timers órfãos e Cidade Solar intocada):

- **Comboio Naval (`naval-convoy`, `115s`):** `ship` capitânia central + `2 boat` em flancos bombordo/estibordo posicionados dentro de `waterCorridor` + escolta aérea em curva (`2 fighter`; no Difícil adiciona `1 interceptor`), com linhas táteis e balizas âmbar e bônus único `PELAGIC_CONVOY_CLEAR_BONUS` (`+600`) ao desmantelar toda a flotilha sem gerar itens extras.
- **Interceptação de Elite (`elite-interception`, `185s`):** esquadrão de `3 interceptor` ases (`4` no Difícil) com rastros e divisas douradas, manobra de aproximação e varredura lateral com telemetria pré-tiro antes de dardos duplos escalonados.
- **Ataque Coordenado (`coordinated-strike`, `242s`):** `submarine` no canal esquerdo alternando ritmo de disparo (`beat` par/ímpar) com `2 acrobat` em flanco oposto (`+1 interceptor` no Difícil) para evitar empilhamento de projéteis e preservar corredores de esquiva.
- **Inimigo Raro (`rare-visitor`, `PELAGIC_RARE_EARLY_AT = 66s` se `deaths === 0 && kills >= 10` ou fallback único em `PELAGIC_RARE_FALLBACK_AT = 196s` se `kills >= 20`):** sonda alienígena dourada (`1.45×` de escala sobre `pelagic-ufo-anim`, órbita energética com 3 satélites), voo em oito evasivo por `7.8s` antes de sair da tela, rajada em losango legível e limite máximo absoluto de `1` ocorrência e bônus único `PELAGIC_RARE_BONUS` (`+1850`) por partida (mantendo as `11` caixas planejadas de `SUPPLIES`).
- **Validação automatizada e visual:** [`tests/pelagicSpecialEvents.test.mjs`](../tests/pelagicSpecialEvents.test.mjs) (eventos isolados + sequência completa Normal e Difícil) e [`scripts/pelagic-events-check.mjs`](../scripts/pelagic-events-check.mjs) (`docs/screenshots/pelagic-events-v1/`).

## Sistema de Pontuação Arcade Avançado (Tarefa 06)

Implementado exclusivamente para a Fenda Pelágica (`UP`) em [`src/game/arcade/PelagicScoring.ts`](../src/game/arcade/PelagicScoring.ts), integrado ao motor determinístico [`ArcadeWorld.ts`](../src/game/arcade/ArcadeWorld.ts), áudio em [`audioSystem.ts`](../src/game/audio/audioSystem.ts) e feedback flutuante transitório + resumo de resultados em [`ArcadeScene.ts`](../src/game/arcade/ArcadeScene.ts), preservando integralmente a pontuação base em `FAMILY`, a Cidade Solar (`SIDE`) e o layout permanente do HUD.

- **Bônus por formação (`formationBonusPoints`):**
  - Todo esquadrão com `size >= 2` originado em uma onda (`offsets.length >= 2`, excluindo unidades `solo`) recebe um `squadId` único na criação.
  - Se qualquer integrante escapar ativo fora da arena ou no corte da chegada do chefe (`onSquadMemberEscaped`), o esquadrão é invalidado e concede `0` bônus; eliminações simultâneas no mesmo quadro compartilham a mesma trava `awarded` e pagam no máximo uma vez.
  - Fórmula Normal (×`1.2` no Difícil, arredondado em múltiplos de `10`): `base = size * 100 + (size >= 5 ? 200 : size >= 4 ? 100 : 0)`:
    - `2` naves (`pair`, `pincer`): `+200` Normal / `+240` Difícil
    - `3` naves (`trio`, `escort`): `+300` Normal / `+360` Difícil
    - `4` naves (`quartet`, `stagger`, `successive`): `+500` Normal / `+600` Difícil
    - `5` naves (`v`): `+700` Normal / `+840` Difícil
    - `8` naves (`horde`): `+1000` Normal / `+1200` Difícil
- **Bônus de sobrevivência por setor (`sectorSurvivalBonus`):**
  - Avaliado nas transições dos 7 trechos (`regionAt`: `0..5` nos marcos `45s, 90s, 135s, 155s, 200s, 255s` e trecho `6` ao alcançar `300s`), com valores base `[400, 400, 500, 500, 650, 650, 800]` (×`1.2` no Difícil; máximo de `+3.900` Normal / `+4.680` Difícil).
  - Morrer dentro de um setor cancela apenas o bônus daquele setor sem subtrair pontos já conquistados (`0` punição ao iniciante), reabilitando automaticamente o prêmio nos setores seguintes.
- **Bônus de chefes e minichefes (`bossPerformanceBonus` + componentes):**
  - **Minichefe (`PATRULHA PESADA`):** cada uma das `3` torretas paga `+1500` na destruição (`recordBossPartDestroyed` + checagem `hp <= 0` impedem re-hit/farming em partes destruídas). Ao afundar, concede `PELAGIC_MINI_BASE_CLEAR` (`+3000`) + desempenho sem mortes (`+1000`) e eficiência de tempo (`+500` até `26s`, `+250` até `38s`, inverso a atrasar a luta; ×`1.2` no Difícil).
  - **Chefe final (`COLOSSO ABISSAL`):** módulos individuais concedem `+1200` (`turret`, `launcher`, `armor`, `propeller`), `+2000` (`reactor`) ou `+2500` (`bridge`); cada casco de seção paga `+650` e cada conclusão de seção paga `+1800` (protegidos por `recordSubModuleDestroyed` / `recordSubHullDestroyed`). No colapso, além de `12000 + lives * 1000`, concede desempenho por luta sem mortes (`+3000`) e agilidade (`+1500` até `95s`, `+750` até `130s`; ×`1.2` no Difícil).
- **Exemplos concretos de pontuação:**
  - *Esquadrão completo vs. incompleto:* destruir um `trio` de `fighter` (`3 × 160`) concede `480 + 300 = 780` pts (`+300 FORMAÇÃO`); se 1 caça escapar e apenas 2 forem abatidos, soma `320` pts sem bônus.
  - *Partida consistente vs. com perdas:* completar os 7 setores sem mortes (+`3.900`), limpar 12 formações (`pair`/`trio`/`quartet`, ~`+4.200`), derrotar o Minichefe intacto em `22s` (`4.500 + 3.000 + 1.500 = 9.000`), abater todas as 5 seções do `COLOSSO ABISSAL` sem mortes em `90s` com `3` vidas (`~36.750` + `+4.500 DESEMPENHO`) e eventos especiais eleva o placar sólido de domínio acima de `58.000` pts sem inflar excessivamente partidas casuais com mortes/quebras parciais.
- **Feedback transitório e testes:** eventos `'bonus'` disparam chime harmônico curto em `ArcadeAudio` (`playArcade('bonus')`) e textos flutuantes em pool sob a camada dos projéteis (`depth 14.2`, sem obstruir tiros em `depth 15` e sem alterar o HUD fixo); a tela `result` exibe resumo compacto de esquadrões, setores e bônus. Validação unitária em [`tests/pelagicScoring.test.mjs`](../tests/pelagicScoring.test.mjs) cobrindo fórmulas, esquadrão completo/incompleto, mortes simultâneas, penalidade zero em mortes do jogador, anti-farming em partes de chefes e persistência em `recordArcadeClear`.

## Eventos Especiais da Fenda Pelágica (Tarefa 11)

Implementados exclusivamente na Fenda Pelágica (`UP`) via [`src/game/arcade/PelagicSpecialEvents.ts`](../src/game/arcade/PelagicSpecialEvents.ts), [`src/game/arcade/ArcadeWorld.ts`](../src/game/arcade/ArcadeWorld.ts) e [`src/game/arcade/PelagicActorAnims.ts`](../src/game/arcade/PelagicActorAnims.ts), com trava determinística por instância de partida (`specialEventsTriggered`, zero duplicação, zero timers órfãos e Cidade Solar intocada):

- **Comboio Naval (`naval-convoy`, `115s`):** `ship` capitânia central + `2 boat` em flancos bombordo/estibordo posicionados dentro de `waterCorridor` + escolta aérea em curva (`2 fighter`; no Difícil adiciona `1 interceptor`), com linhas táteis e balizas âmbar e bônus único `PELAGIC_CONVOY_CLEAR_BONUS` (`+600`) ao desmantelar toda a flotilha sem gerar itens extras.
- **Interceptação de Elite (`elite-interception`, `185s`):** esquadrão de `3 interceptor` ases (`4` no Difícil) com rastros e divisas douradas, manobra de aproximação e varredura lateral com telemetria pré-tiro antes de dardos duplos escalonados.
- **Ataque Coordenado (`coordinated-strike`, `242s`):** `submarine` no canal esquerdo alternando ritmo de disparo (`beat` par/ímpar) com `2 acrobat` em flanco oposto (`+1 interceptor` no Difícil) para evitar empilhamento de projéteis e preservar corredores de esquiva.
- **Inimigo Raro (`rare-visitor`, `PELAGIC_RARE_EARLY_AT = 66s` se `deaths === 0 && kills >= 10` ou fallback único em `PELAGIC_RARE_FALLBACK_AT = 196s` se `kills >= 20`):** sonda alienígena dourada (`1.45×` de escala sobre `pelagic-ufo-anim`, órbita energética com 3 satélites), voo em oito evasivo por `7.8s` antes de sair da tela, rajada em losango legível e limite máximo absoluto de `1` ocorrência e bônus único `PELAGIC_RARE_BONUS` (`+1850`) por partida (mantendo as `11` caixas planejadas de `SUPPLIES`).
- **Validação automatizada e visual:** [`tests/pelagicSpecialEvents.test.mjs`](../tests/pelagicSpecialEvents.test.mjs) (eventos isolados + sequência completa Normal e Difícil) e [`scripts/pelagic-events-check.mjs`](../scripts/pelagic-events-check.mjs) (`docs/screenshots/pelagic-events-v1/`).

## Sistema de Pontuação Arcade Avançado (Tarefa 06)

Implementado exclusivamente para a Fenda Pelágica (`UP`) em [`src/game/arcade/PelagicScoring.ts`](../src/game/arcade/PelagicScoring.ts), integrado ao motor determinístico [`ArcadeWorld.ts`](../src/game/arcade/ArcadeWorld.ts), áudio em [`audioSystem.ts`](../src/game/audio/audioSystem.ts) e feedback flutuante transitório + resumo de resultados em [`ArcadeScene.ts`](../src/game/arcade/ArcadeScene.ts), preservando integralmente a pontuação base em `FAMILY`, a Cidade Solar (`SIDE`) e o layout permanente do HUD.

- **Bônus por formação (`formationBonusPoints`):**
  - Todo esquadrão com `size >= 2` originado em uma onda (`offsets.length >= 2`, excluindo unidades `solo`) recebe um `squadId` único na criação.
  - Se qualquer integrante escapar ativo fora da arena ou no corte da chegada do chefe (`onSquadMemberEscaped`), o esquadrão é invalidado e concede `0` bônus; eliminações simultâneas no mesmo quadro compartilham a mesma trava `awarded` e pagam no máximo uma vez.
  - Fórmula Normal (×`1.2` no Difícil, arredondado em múltiplos de `10`): `base = size * 100 + (size >= 5 ? 200 : size >= 4 ? 100 : 0)`:
    - `2` naves (`pair`, `pincer`): `+200` Normal / `+240` Difícil
    - `3` naves (`trio`, `escort`): `+300` Normal / `+360` Difícil
    - `4` naves (`quartet`, `stagger`, `successive`): `+500` Normal / `+600` Difícil
    - `5` naves (`v`): `+700` Normal / `+840` Difícil
    - `8` naves (`horde`): `+1000` Normal / `+1200` Difícil
- **Bônus de sobrevivência por setor (`sectorSurvivalBonus`):**
  - Avaliado nas transições dos 7 trechos (`regionAt`: `0..5` nos marcos `45s, 90s, 135s, 155s, 200s, 255s` e trecho `6` ao alcançar `300s`), com valores base `[400, 400, 500, 500, 650, 650, 800]` (×`1.2` no Difícil; máximo de `+3.900` Normal / `+4.680` Difícil).
  - Morrer dentro de um setor cancela apenas o bônus daquele setor sem subtrair pontos já conquistados (`0` punição ao iniciante), reabilitando automaticamente o prêmio nos setores seguintes.
- **Bônus de chefes e minichefes (`bossPerformanceBonus` + componentes):**
  - **Minichefe (`PATRULHA PESADA`):** cada uma das `3` torretas paga `+1500` na destruição (`recordBossPartDestroyed` + checagem `hp <= 0` impedem re-hit/farming em partes destruídas). Ao afundar, concede `PELAGIC_MINI_BASE_CLEAR` (`+3000`) + desempenho sem mortes (`+1000`) e eficiência de tempo (`+500` até `26s`, `+250` até `38s`, inverso a atrasar a luta; ×`1.2` no Difícil).
  - **Chefe final (`COLOSSO ABISSAL`):** módulos individuais concedem `+1200` (`turret`, `launcher`, `armor`, `propeller`), `+2000` (`reactor`) ou `+2500` (`bridge`); cada casco de seção paga `+650` e cada conclusão de seção paga `+1800` (protegidos por `recordSubModuleDestroyed` / `recordSubHullDestroyed`). No colapso, além de `12000 + lives * 1000`, concede desempenho por luta sem mortes (`+3000`) e agilidade (`+1500` até `95s`, `+750` até `130s`; ×`1.2` no Difícil).
- **Exemplos concretos de pontuação:**
  - *Esquadrão completo vs. incompleto:* destruir um `trio` de `fighter` (`3 × 160`) concede `480 + 300 = 780` pts (`+300 FORMAÇÃO`); se 1 caça escapar e apenas 2 forem abatidos, soma `320` pts sem bônus.
  - *Partida consistente vs. com perdas:* completar os 7 setores sem mortes (+`3.900`), limpar 12 formações (`pair`/`trio`/`quartet`, ~`+4.200`), derrotar o Minichefe intacto em `22s` (`4.500 + 3.000 + 1.500 = 9.000`), abater todas as 5 seções do `COLOSSO ABISSAL` sem mortes em `90s` com `3` vidas (`~36.750` + `+4.500 DESEMPENHO`) e eventos especiais eleva o placar sólido de domínio acima de `58.000` pts sem inflar excessivamente partidas casuais com mortes/quebras parciais.
- **Feedback transitório e testes:** eventos `'bonus'` disparam chime harmônico curto em `ArcadeAudio` (`playArcade('bonus')`) e textos flutuantes em pool sob a camada dos projéteis (`depth 14.2`, sem obstruir tiros em `depth 15` e sem alterar o HUD fixo); a tela `result` exibe resumo compacto de esquadrões, setores e bônus. Validação unitária em [`tests/pelagicScoring.test.mjs`](../tests/pelagicScoring.test.mjs) cobrindo fórmulas, esquadrão completo/incompleto, mortes simultâneas, penalidade zero em mortes do jogador, anti-farming em partes de chefes e persistência em `recordArcadeClear`.

## Recuperação de Poder e Modo Assistido (Tarefa 07)

Implementado exclusivamente para a Fenda Pelágica (`UP`) via [`src/game/arcade/PelagicAssist.ts`](../src/game/arcade/PelagicAssist.ts), [`src/game/systems/saveSystem.ts`](../src/game/systems/saveSystem.ts), [`src/game/arcade/ArcadeWorld.ts`](../src/game/arcade/ArcadeWorld.ts) e [`src/game/arcade/ArcadeScene.ts`](../src/game/arcade/ArcadeScene.ts), preservando integralmente as regras clássicas de Normal/Difícil, a Cidade Solar (`SIDE`), a contagem original de `11` caixas em `SUPPLIES` e os limites de `5` vidas/especiais.

- **Opção separada em `OPÇÕES` (`MODO ASSISTIDO`):** alternável independentemente da dificuldade (`NORMAL` / `DIFÍCIL`), persistida em `GameSettings.assisted` com compatibilidade retroativa para saves legados (`false` por padrão) e sinalizada discretamente na seleção de rotas, HUD direito (`MODO ASSISTIDO`), pausa e telas de resultado/derrota apenas na Rota 01.
- **Tabela comparativa dos modos (Fenda Pelágica / Rota 01):**

| Regra após morte | Normal | Difícil | Modo Assistido (`Rota 01`) |
| --- | --- | --- | --- |
| Perda de arma (`LV5` / `LV4`) | Cai para `LV1 / 0 P` | Cai para `LV1 / 0 P` | Monotônica: `LV5 → LV3 / 0 P`, `LV4 → LV2 / 0 P` |
| Perda de arma (`LV3` / `LV2` / `LV1 1P`) | Cai para `LV1 / 0 P` | Cai para `LV1 / 0 P` | Cai para `LV1 / 0 P` |
| Cápsula solta ao morrer | `1` cápsula `+1 P` (se progresso prévio > `0`) | `1` cápsula `+1 P` (se progresso prévio > `0`) | Máx. `1` cápsula dourada `recoveryP` ativa (`+1/+2/+3 P`), coleta física concede `+0.9s` de graça e limpa balas a `55px` |
| Invulnerabilidade ao renascer | `3.0s` | `3.0s` | `4.2s` |
| Limpeza de projéteis no retorno | Raio `75px` | Raio `75px` | Raio `175px` + cadência mínima `1.1s` para inimigos aéreos na faixa inferior (`y > 245`) |
| Inimigos & pontuação | Ritmo padrão (`1.0×`) | Escoltas extras & bônus `1.2×` | Ritmo Normal (`effectiveHard = false`) sem alteração de colisão ou Cidade Solar |

- **Validação automatizada:** [`tests/pelagicAssist.test.mjs`](../tests/pelagicAssist.test.mjs) cobrindo redução monotônica em todos os níveis (`LV1`–`LV5`), anti-empilhamento de cápsulas em mortes consecutivas, coleta física obrigatória sem imã, proteção de respawn (`175px` / `4.2s` / atraso de faixa inferior), Game Over / reinício, preservação da Cidade Solar e migração de `SaveSystem`.

## Diálogos Dinâmicos do Bayek (Tarefa 09)

Implementado para a Fenda Pelágica (`UP`) em [`src/game/arcade/PelagicComms.ts`](../src/game/arcade/PelagicComms.ts), integrado aos eventos estruturados de [`ArcadeWorld.ts`](../src/game/arcade/ArcadeWorld.ts) e ao painel direito de comunicações de [`ArcadeScene.ts`](../src/game/arcade/ArcadeScene.ts):

- **Remoção do estado artificial de espera:** eliminado o texto fixo `"CANAL ABERTO — Aguardando contato…"`; quando não há diálogo ativo (`PelagicComms.current() === null`), o texto de rádio fica oculto, mantendo intactos a posição (`x = 646, y = 295`) e a estética do painel direito (bem como zero interferência no painel esquerdo, área central de voo ou Cidade Solar).
- **Fila por prioridade, cooldowns e controle de pausa:** categorias contextualizadas (`start`, `threat`, `submarine`, `pickup` restrito a `life`/`special`/`full`/`recovery` — nunca para `+1 P` comum —, `damage`, `special-event`, `miniboss`, `boss` e `victory`) com fila limitada (`PELAGIC_COMMS_MAX_QUEUE = 2`), preempção por eventos críticos, deduplicação de repetições e relógio avançado apenas durante `'play'` ativo (pausa congela a duração restante sem descartar ou expirar a fala).
- **Validação automatizada:** [`tests/pelagicComms.test.mjs`](../tests/pelagicComms.test.mjs) verificando silêncio em repouso, prioridades, anti-spam em coletas comuns de `P`, congelamento em pausa e preservação integral da Cidade Solar.

## Controles Touch Profissionais para Android (Tarefa 08)

Implementado para uso multitoque móvel e configurável no menu sem alterar o desktop (`!pointer.wasTouch` segue ignorado fora do botão de pausa conforme `26_DIRETRIZ_CONTROLES_E_DISPAROS.md`), a Cidade Solar (`SIDE`) ou os painéis laterais do cockpit:

- **Núcleo geométrico e multitoque em [`src/game/arcade/TouchControls.ts`](../src/game/arcade/TouchControls.ts):**
  - `computeStickVector`: zona morta de `14%`, assistência angular de `±6°` nas 8 direções cardinais/diagonais e resposta radial analógica contínua até `1.0`.
  - `computeTouchLayout` e `computeWorldSafeInsets`: posicionamento dentro das faixas laterais (`x <= 192` e `x >= 576`) com separação garantida entre `TIRO` e `ESP` e respeito a `env(safe-area-inset-*)` expostos em [`src/style.css`](../src/style.css) (`--sat`, `--sar`, `--sab`, `--sal`), mantendo livre o corredor central (`192..576`) e a área de pausa.
  - `TouchInputController`: isolamento por identificador de ponteiro (`pointer.id`) para movimento simultâneo + disparo contínuo + acionamento latched do especial (`ESP`), exigindo `pointerdown` dentro do círculo de `ESP` (arrastar o dedo por cima não dispara especial acidentalmente) e limpeza em `pointercancel`, `gameout`, `blur`, `visibilitychange`, `resize`, `orientationchange` e entrada em pausa.
- **Personalização e persistência em [`src/game/systems/saveSystem.ts`](../src/game/systems/saveSystem.ts) e [`src/game/arcade/ArcadeScene.ts`](../src/game/arcade/ArcadeScene.ts):**
  - Tela dedicada `'touch-settings'` (acessível por `CONTROLES TOUCH` em Opções) com pré-visualização ao vivo de `MÃO DOMINANTE` (`DESTRO`/`CANHOTO`), `POSIÇÃO (MÃO)` (`CANTO`/`ELEVADA`/`ABERTA`), `TAMANHO` (`PEQUENO`/`PADRÃO`/`GRANDE`), `TRANSPARÊNCIA` (`30%–75%`), `ALTURA FINA` (`RESTAURAR PADRÃO` e `VOLTAR`), persistida e sanitizada em `GameSettings.touch` com retrocompatibilidade para saves antigos.
  - Sobreposição translúcida em múltiplos anéis integrados à estética do cockpit e alternância instantânea entre teclado, gamepad e touch no `update()`.
- **Validação automatizada e emulação de navegador:**
  - [`tests/touchControls.test.mjs`](../tests/touchControls.test.mjs): testes unitários/integração para vetor 8-direções/analógico, limites laterais para destros/canhotos/tamanhos/recortes, multitoque de 3 dedos simultâneo, prevenção de especial acidental e persistência no `SaveSystem`.
  - [`scripts/pelagic-touch-check.mjs`](../scripts/pelagic-touch-check.mjs): verificação em Chrome/WebGL com emulação touch via CDP nas resoluções `854×480`, rotação `412×915 ↔ 915×412` com recortes simulados (`--sal`/`--sar`/`--sab`) e `800×600` com `CANHOTO` persistido após recarregamento da página, gerando capturas em [`docs/screenshots/pelagic-touch-v1/`](screenshots/pelagic-touch-v1/).
- **Limitação explícita do ambiente:** não há smartphone ou tablet Android físico conectado neste ambiente desktop Windows; portanto, a validação de ergonomia, gestos e resposta em hardware Android real permanece pendente e **não** é considerada aprovada apenas com emulação CDP/Chromium.

## Capturas

[Menu](screenshots/cartoon/title.webp), [pilotos](screenshots/cartoon/pilots.webp), [missões](screenshots/cartoon/missions.webp), [Pula-Onda](screenshots/cartoon/phase1-boss.webp), [retorno ampliado](screenshots/cartoon/phase1-return.webp), [Cidade Solar](screenshots/cartoon/phase2-city.webp), [Giro](screenshots/cartoon/phase2-boss.webp), [resultado da Fenda](screenshots/cartoon/result-phase1.webp), [resultado da Cidade](screenshots/cartoon/result-phase2.webp), [interface touch compacta](screenshots/cartoon/compact-touch.webp).

## Arco das Marés, Checkpoint e Layouts Responsivos (Tarefa 21)

Implementação do evento mid-stage **Arco das Marés** em [`src/game/arcade/PelagicTideArch.ts`](../src/game/arcade/PelagicTideArch.ts) e [`src/game/arcade/PelagicTideArchArt.ts`](../src/game/arcade/PelagicTideArchArt.ts), integrado ao núcleo [`ArcadeWorld.ts`](../src/game/arcade/ArcadeWorld.ts), [`ArcadeScene.ts`](../src/game/arcade/ArcadeScene.ts), [`ArcadeBackdrop.ts`](../src/game/arcade/ArcadeBackdrop.ts) e [`combatResolution.ts`](../src/game/render/combatResolution.ts):

- **Substituição completa do miniboss da Fenda Pelágica:** O encontro `at=155` e `startBoss(true)` em modo `UP` foram removidos/bloqueados; a Cidade Solar (`SIDE`) mantém seu miniboss e obstáculos intactos.
- **Máquina de estados e travessia jogável:** `TideArchController` coordena `approach` (`4.6s`), `descent` (`3.8s`, escala `1.0 -> 0.78`), `low-flight`, `under-arch` (ponte natural a `depth 18.9` acima da RIVET em `depth 16.4` com colisão nos pilares e projéteis em `depth 19.5`), `ascent` (`3.8s`) e `checkpoint` (`+1500` base + `+2000` sem dano). Nenhuma aeronave ou helicóptero nasce enquanto `airSpawnsBlocked === true`.
- **Combate e leitura:** `10` canhões costeiros ancorados a `archWorldY` (padrões `alternating`, `aimed-burst`, `fan3`, `sweep`) + `7` barcos de patrulha + cachoeiras animadas (`4` quadros), sombras projetadas na água e áudio dedicado (`arch-descent`, `arch-ascent`, `checkpoint` e diálogos `arch` em `PelagicComms`).
- **HUD PC Horizontal e Android Portrait (`UP`):** `setCombatVirtualSize` mantém câmera nítida em `768×432` (PC: painel esquerdo `0..160`, barra superior compacta, sem painel direito) e `384×portraitH` (Android retrato tátil: sem barras laterais, barra de status compacta no topo e `ESP` acima de `TIRO` à direita, com `#rotate-hint` ativo apenas em missões `SIDE`).
- **Validação automatizada e navegador:**
  - Suíte [`tests/pelagicTideArch.test.mjs`](../tests/pelagicTideArch.test.mjs) cobrindo `30` cenários do Arco das Marés somando-se às suítes completas executadas via `node --experimental-strip-types --test tests/*.test.mjs` (`0` falhas).
  - Verificação Chrome/WebGL [`scripts/tide-arch-verify.mjs`](../scripts/tide-arch-verify.mjs) em PC Horizontal (`1366×768` e `1920×1080` — `52.7 FPS` médios em SwiftShader headless, `p95 = 25.1ms`) e Android Vertical emulado via CDP (`720×1600` e `1080×1920` — `55.1 FPS` médios, `p95 = 25.1ms`, `0` erros de console), com capturas em [`docs/screenshots/tide-arch/`](screenshots/tide-arch/) e vídeo da travessia em [`docs/videos/arco-das-mares-pc.webm`](videos/arco-das-mares-pc.webm).
- **Limitação explícita:** A validação mobile foi realizada por emulação tátil/viewport em Chromium DevTools; dispositivo Android físico não estava disponível neste ambiente.

## Rolagem Longitudinal 2.5D da RIVET na Gameplay UP (Tarefa 22)

Recriação completa da spritesheet da RIVET vista superior em [`scripts/pack-pelagic-animations.mjs`](../scripts/pack-pelagic-animations.mjs) a partir das poses de base em [`scripts/assets/rivet-roll-left-poses.png`](../scripts/assets/rivet-roll-left-poses.png) e da pose neutra original de [`public/assets/arcade/rivet.webp`](../public/assets/arcade/rivet.webp), gerando [`public/assets/arcade/pelagic-review/rivet-up-sheet.webp`](../public/assets/arcade/pelagic-review/rivet-up-sheet.webp) (`1792×1024`, `7×4` = `28` quadros RGBA de `256×256`, comando `npm run assets:pelagic`):

- **Rolagem no eixo longitudinal (sem giro 2D do nariz):** `7` colunas progressivas (`-84°`, `-55°`, `-28°`, `0°` neutro original, `+28°`, `+55°`, `+84°`) mantendo a ponta do caça estritamente voltada para cima em todos os quadros (`player.angle === 0` durante o voo em [`PelagicActorAnims.ts`](../src/game/arcade/PelagicActorAnims.ts)). Nos extremos (`0` e `6`), os três propulsores metálicos empilham/sobrepõem em profundidade 2.5D em vez de permanecerem alinhados lado a lado.
- **4 variações por coluna (`rows 0..3`):** propulsão normal (`0`), propulsão intensa ciano (`1`), oscilação alternada dos motores (`2`) e flare de reação ao disparo (`3`).
- **Jogabilidade e SIDE preservados:** interpolação suave de `player.bank` (`dt * 10.5` em [`ArcadeWorld.ts`](../src/game/arcade/ArcadeWorld.ts)) garantindo passagem por todas as poses intermediárias em inversões rápidas (`5 -> 4 -> 3 -> 2 -> 1 -> 0`) sem atraso horizontal nem giro dos projéteis ou mísseis (`arc-missile` / `arc-red` restaurados); a Cidade Solar (`SIDE`) mantém seus sprites originais intactos.
- **Validação e mídia:** [`tests/pelagicActorAnims.test.mjs`](../tests/pelagicActorAnims.test.mjs) e [`scripts/rivet-roll-verify.mjs`](../scripts/rivet-roll-verify.mjs) aprovados (`0` erros de console, `60.4 FPS` médios em SwiftShader headless), com capturas das poses em [`docs/screenshots/rivet-roll/`](screenshots/rivet-roll/) e vídeo animado em [`docs/videos/rivet-roll-sonic-wings.webm`](videos/rivet-roll-sonic-wings.webm).

## Eliminação de Duplo Loading, Faixas Laterais e Flash Pré-Splash (Tarefa 23)

Correção estrutural do fluxo `BOOT → LOADING → LOADING_COMPLETE → STUDIO_SPLASH → STUDIO_EXIT → TITLE_READY → TITLE_VISIBLE` em [`index.html`](../index.html), [`src/main.ts`](../src/main.ts) e [`src/game/arcade/ArcadeScene.ts`](../src/game/arcade/ArcadeScene.ts):

- **Carregamento único full-bleed (`#040d21`):** removida a duplicidade entre o overlay DOM (`#bw-boot-loading`) e os antigos objetos canvas `768×432` (`loadBg`, `loadBar`, `loadTitle`, `loadPct`). O shell HTML/CSS inicializa com `width: 0%`, `height: 100dvh`, `env(safe-area-inset-*)`, métricas estáveis (`tabular-nums`, sans-serif de sistema imune a FOUT) e barra fixa (`width: min(360px, 78vw)`, `height: 18px`), enquanto [`src/main.ts`](../src/main.ts) inicializa o `Phaser.Game` diretamente no tamanho do viewport (`host.clientWidth × host.clientHeight`), eliminando o salto inicial `768×432 → viewport`.
- **Handoff atômico via `POST_RENDER`:** ao atingir `LOADING_COMPLETE` (todos os recursos e texturas críticas de abertura carregados, sem retrocesso de porcentagem), `ArcadeScene` prepara `BOTAN STUDIO APRESENTA` (`introWash` cobrindo dinamicamente todo o viewport virtual `getCombatVirtualSize`, `menuSky`/`logo`/`menuPlanes`/`ui` ocultos) e só dispensa `#bw-boot-loading` após `Phaser.Core.Events.POST_RENDER` confirmar o quadro renderizado em WebGL — garantindo zero frames intermediários com menu, céu ou flash branco.
- **Validação quadro a quadro e multiambiente:** [`tests/combatResolution.test.mjs`](../tests/combatResolution.test.mjs), [`tests/openingMenuRework.test.mjs`](../tests/openingMenuRework.test.mjs), [`scripts/opening-menu-verify.mjs`](../scripts/opening-menu-verify.mjs) e [`scripts/opening-boot-verify.mjs`](../scripts/opening-boot-verify.mjs) aprovados (`0` erros de console, `0` vazamentos antes de `TITLE_READY`, `0` frames brancos) em `dist` e dev server nos cenários `1280×720`, `1366×768`, `1920×1080`, rede lenta, fontes externas bloqueadas, reload `F5` e Android retrato/paisagem (`1080×1920`, `720×1600`, `844×390`), com capturas em [`docs/screenshots/startup-audit/`](screenshots/startup-audit/) e vídeo contínuo em [`docs/videos/startup-sequence.webm`](videos/startup-sequence.webm).

## Reformulação do Ritmo de Combate da Fenda Pelágica (Tarefa 25)

Reorganização orientada por auditoria determinística do ritmo, frequência de disparos e **Diretor Dinâmico de Ameaças** em [`src/game/arcade/PelagicCombatDirector.ts`](../src/game/arcade/PelagicCombatDirector.ts), [`src/game/arcade/content.ts`](../src/game/arcade/content.ts), [`src/game/arcade/ArcadeWorld.ts`](../src/game/arcade/ArcadeWorld.ts), [`src/game/arcade/PelagicTideArch.ts`](../src/game/arcade/PelagicTideArch.ts), [`src/game/arcade/PelagicEnvironment.ts`](../src/game/arcade/PelagicEnvironment.ts) e [`src/devtools/DevToolsPanel.ts`](../src/devtools/DevToolsPanel.ts):

- **Diretor Dinâmico com proteção anti-farm e recuperação pós-morte:** antecipa a próxima onda roteirizada quando o jogador limpa a arena rapidamente (sem atravessar as fronteiras `148s` do Arco das Marés ou `296s` do chefe) e injeta reforços leves estritamente limitados por setor quando o vazio se prolonga. Bloqueia reforços durante recuperação pós-morte (`playerInvulnerable > 1.25s`), janelas de densidade alta (calibradas separadamente para PC horizontal e Android vertical `384px`) e nunca injeta aeronaves enquanto `tideArch.airSpawnsBlocked === true`.
- **Novo roteiro `0–300s` + cadência e projéteis estilo Sonic Wings:** abertura em `1.2s`, entradas laterais alternadas (`left`/`right`), alternância contínua ar/costa/mar com torres e barcos ativos, `4` famílias de helicópteros (`heli_scout`, `heli_utility`, `heli_phantom`, `heli_warhawk` alternando gatling + míssil reto rápido sem perseguição), Arco das Marés (`148–178s`) com retomada aérea imediata após subida (`180.5s+`) e trecho de oceano aberto (`280–300s`) livre de unidades terrestres até o Colosso Abissal. Cidade Solar (`SOLAR`, `LEGACY_SOLAR_FIRE`, `LEGACY_SOLAR_SHOTS`) preservada integralmente.
- **Comparativo auditado (Antes → Depois, simulações determinísticas + Chrome/WebGL):**
  - `NORMAL-PC-NV1`: presença de ameaça `65.6% → 94.8%`, inimigo visível `51.1% → 79.3%`, maior ociosidade `13.12s → 4.95s`, intervalos `>3s` `12 → 1`, disparos/min `49 → 92.8` (`1` morte, vitória em `300s`).
  - `ANDROID-PORTRAIT-NV1`: presença de ameaça `69.9% → 94.1%`, inimigo visível `38.6% → 56.9%`, maior ociosidade `13.85s → 8.05s`, intervalos `>3s` `11 → 1`, disparos/min `31.4 → 57.2` (`0` mortes, vitória em `300s`).
  - Evidências e testes: [`tests/pelagicCombatDirector.test.mjs`](../tests/pelagicCombatDirector.test.mjs), [`scripts/pelagic-pacing-audit.mjs`](../scripts/pelagic-pacing-audit.mjs), [`scripts/pelagic-pacing-verify.mjs`](../scripts/pelagic-pacing-verify.mjs) (`59.9 FPS` médios em SwiftShader/ANGLE, `p95 = 16.71ms`, `p99 = 16.73ms`), capturas em [`docs/screenshots/pelagic-pacing-v1/`](screenshots/pelagic-pacing-v1/) e vídeo em [`docs/videos/fenda-pelagica-ritmo-v25.webm`](videos/fenda-pelagica-ritmo-v25.webm). Limitação mantida: dispositivos Android físicos e playtest humano permanecem pendentes.

## Auditoria Final da Fenda Pelágica (Tarefa 12)

Consolidação completa pós-implementação das demais melhorias em [Auditoria Final — Fenda Pelágica](56_AUDITORIA_FINAL_FENDA_PELAGICA.md), cobrindo `296` testes automatizados (`npm test`), matriz determinística de simulação por dificuldade (`ASSISTIDO`, `NORMAL`, `DIFÍCIL`), `15` benchmarks Chrome/WebGL (`BAIXA`, `MÉDIA`, `ALTA` em desktop `1366×768` e touch emulado `854×480` — `59,78–59,87 FPS`, `p95 <= 16,9 ms`), correção do botão de pausa touch sob recortes de tela e evidências visuais em [`docs/screenshots/pelagic-final-audit-v1/`](screenshots/pelagic-final-audit-v1/). Limitação mantida: hardware Android físico e playtest humano permanecem pendentes.

Publicação prevista nesta revisão: branch `master`, por push normal, sem force. O hash confirmado é informado na entrega; o relatório faz parte do próprio commit.
