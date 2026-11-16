# Auditoria Final de Gameplay, Dificuldade e Desempenho — Fenda Pelágica

Data: 15/11/2026  
Escopo auditado: Fase 1 (`ROTA 01 — FENDA PELÁGICA`, perspectiva `UP`) do [Bíblia atual](27_BULLET_WAKE_V2_DEFINITIVO.md) e histórico em [Implementação e Validação Arcade](55_ARCADE_IMPLEMENTACAO_E_VALIDACAO.md).  
Restrição respeitada: nenhuma regra ou conteúdo da Fase 2 (`Cidade Solar` / `SIDE`) foi alterado nesta auditoria.

---

## 1. Resumo Executivo

- **Estabilidade do build e da suíte automatizada:** `296/296` testes unitários/integração (`npm test`), verificação TypeScript (`tsc --noEmit`) e bundle Vite (`npm run build`, `dist/assets/index-BpuzRgy3.js`, `1.795,14 kB`) executados com saída `0`.
- **Desempenho em navegador WebGL (desktop e mobile touch emulado):** todas as `15` medições em Chrome headless (`ANGLE / AMD Radeon(TM) Graphics Direct3D11`), cobrindo `BAIXA` (`q=0`), `MÉDIA` (`q=1`) e `ALTA` (`q=2`) em `1366×768` e `854×480` (`deviceScaleFactor: 2`, `touch`), mantiveram **`59,78–59,87 FPS`** com mediana de **`16,7 ms`**, `p95` entre **`16,8–16,9 ms`**, `p99` entre **`16,9–17,1 ms`** e `maxMs` máximo de **`17,5 ms`** sem quadros travados ou vazamento de objetos entre reinícios (`911` display objects fixos ao longo de `5` reinícios consecutivos).
- **Falhas identificadas e corrigidas durante a auditoria:**
  1. **Sobreposição do botão de pausa touch (`Ⅱ`) sobre o placar (`PONTUAÇÃO`) sob recortes de tela (safe-area cutouts):** detectada visualmente em [`08-touch-mobile-854x480.png`](screenshots/pelagic-final-audit-v1/08-touch-mobile-854x480.png) e corrigida em [`src/game/arcade/TouchControls.ts`](../src/game/arcade/TouchControls.ts) + [`src/game/arcade/ArcadeScene.ts`](../src/game/arcade/ArcadeScene.ts) + teste em [`tests/touchControls.test.mjs`](../tests/touchControls.test.mjs).
  2. **Scripts legados de validação quebrados após refatorações (Tarefas 04/08):** [`scripts/arcade-browser-check.mjs`](../scripts/arcade-browser-check.mjs), [`scripts/pelagic-browser-check.mjs`](../scripts/pelagic-browser-check.mjs), [`scripts/pelagic-anims-check.mjs`](../scripts/pelagic-anims-check.mjs) e [`scripts/pelagic-review-check.mjs`](../scripts/pelagic-review-check.mjs) ainda escreviam em `s.touch.fire` (substituído por `TouchInputController`), liam `s.backdrop.coast` (substituído por `s.backdrop.coastPainting.strips`) ou referenciavam `videoStream` no lugar de `motionStream`. Todos os quatro scripts foram reparados e reexecutados com saída `0`.
- **Limitação explícita:** **não há dispositivo Android físico conectado** (`adb` ausente neste ambiente Windows); portanto, toda verificação móvel foi realizada via emulação Chrome DevTools Protocol (CDP). Testes em smartphone/tablet Android físicos e sessões de playtest humano permanecem **pendentes**.

---

## 2. Problemas Encontrados e Correções Aplicadas

| Severidade | Componente | Sintoma observado | Correção aplicada | Status |
| --- | --- | --- | --- | --- |
| Alta (UX/HUD) | [`TouchControls.ts`](../src/game/arcade/TouchControls.ts) & [`ArcadeScene.ts`](../src/game/arcade/ArcadeScene.ts) | Quando `safeRight` e `safeTop` deslocam controles no paisagem com recorte, `pause` movia para `(698, 44)` diretamente sobre os dígitos de `PONTUAÇÃO` (`680, 50`); além disso, `refreshTouchLayout()` não reposicionava `this.pauseBtn`. | `computeTouchLayout()` desloca `pause` para `(596, 18..34)` se houver conflito com a caixa de pontuação (`x < 732 && safeTop + 16 > 28`); `ArcadeScene.ts` sincroniza `this.pauseBtn?.setPosition(...)` em `refreshTouchLayout()`. | Corrigido e validado (`08-touch-mobile-854x480.png` + `touchControls.test.mjs`) |
| Média (CI/QA) | [`arcade-browser-check.mjs`](../scripts/arcade-browser-check.mjs) | CI (`visual-proof.yml`) quebrava em `s.touch.fire = true` e leitura de layout touch antigo após entrega da Tarefa 08. | Atualizado para acionar disparo por `s.controls.SPACE.isDown` e consultar `s.touchController.getLayout()` / `peek()`. | Corrigido (`exit 0`) |
| Média (QA) | [`pelagic-browser-check.mjs`](../scripts/pelagic-browser-check.mjs) & [`pelagic-anims-check.mjs`](../scripts/pelagic-anims-check.mjs) | Quebra por `s.touch` e `s.backdrop.coast` após refatoração de costa e controles touch. | Atualizado para `s.controls` e `s.backdrop.coastPainting.strips`. | Corrigido (`exit 0`) |
| Média (QA) | [`pelagic-review-check.mjs`](../scripts/pelagic-review-check.mjs) | Modo completo (`--preview` desligado) falhava com `ReferenceError: videoStream is not defined` na gravação WebM, além de `s.touch`/`s.backdrop.coast`. | Alinhado para `motionStream`, `s.controls` e `coastPainting.strips`. | Corrigido (`exit 0`) |
| Informativa | `scripts/verify-pelagic-archipelago.mjs` | Script histórico anterior à refatoração costeira (referencia `s.backdrop.vortex` / `coast.tilePositionY` / `s.touch.fire`); já substituído por `pelagic-coast-check.mjs`, `pelagic-ocean-check.mjs` e `pelagic-browser-check.mjs`. | Não modificado; documentado como legado substituído. | Legado substituído |

---

## 3. Verificação Funcional de Gameplay (Fenda Pelágica)

Validado em conjunto por [`tests/pelagicFinalAudit.test.mjs`](../tests/pelagicFinalAudit.test.mjs), [`scripts/pelagic-final-audit.mjs`](../scripts/pelagic-final-audit.mjs) e scripts de domínio (`combat`, `events`, `assist-comms`, `ocean`, `anims`, `touch`):

| Sistema / Fluxo | Critério verificado | Resultado |
| --- | --- | --- |
| Menus, intro, piloto, rota e pausa | Navegação `title -> pilot -> missions -> play -> pause -> settings -> touch-settings`; relógio congelado na pausa (`route`/`scroll` imóveis). | Aprovado |
| Inicialização e saída da RIVET | Spawn neutro (`384, 376`), `3` vidas, `2` especiais iniciais, `NV 1`, entrada de `2,2s` (`intro -> play`), saída automática após queda do chefe. | Aprovado |
| Armas e suprimentos | Coleta das `11` caixas de `SUPPLIES` (`18s..275s`), evolução `NV1..NV5`, disparos primários e mísseis teleguiados (`NV3+`), limite de `5` vidas / `5` especiais com excedente convertido em `+5000`. | Aprovado |
| Tormenta Escarlate (`ESP` / `X`) | Voo de `0,65s` + explosão em área de `2,1s` limpando tiros inimigos no raio e respeitando teto de dano por seção (`SUB_MAX_BOMB_SECTION_DAMAGE = 220`) no Colosso Abissal. | Aprovado |
| Inimigos, costa, oceano e submarinos | Ondulação contínua independente de `scroll`, esteiras navais dinâmicas, submarinos com ciclo emergir/manter/submergir e destruição sem cadáveres caindo. | Aprovado |
| Eventos especiais e pontuação | `naval-convoy` (`115s`), `elite-interception` (`185s`), `coordinated-strike` (`242s`) e `rare-visitor` (`66s`/`196s`); bônus de esquadrão completo, setores intactos, partes de chefes e proteção anti-farming. | Aprovado |
| Minichefe e Colosso Abissal | `PATRULHA PESADA` aos `155s`; `COLOSSO ABISSAL` aos `300s` avançando progressivamente pelas `5` seções (`PROA BLINDADA` → `PROPULSÃO ABISSAL`), marcas de dano/fumaça e colapso final. | Aprovado |
| Derrota, Game Over, Retry e Cidade Solar | Tela `defeat` limpa e `begin(0)` restaura `lives=3, score=0, elapsed=0, weaponLevel=1`; vitória registra `cleared=[1]` (`bullet_wake_arcade_v1`) e desbloqueia `unlockedStages=[1, 2]` (`bullet_wake_save_data_v1`), permitindo iniciar a Cidade Solar com estado transportado. | Aprovado |
| Paridade de qualidade | `1200` passos determinísticos em Chrome (`10s` simulados) com `s.quality` em `0`, `1` e `2` produziram estado final idêntico (`score: 780`, `kills: 3`, `px: 383.0575`, `py: 365.4875`). | Aprovado |
| Diálogos do Bayek e Modo Assistido | Canal de rádio oculto em silêncio de repouso; falas contextuais por evento; Modo Assistido (Rota 01) aplica recuperação monotônica (`LV5→LV3`, `LV4→LV2`), cápsula dourada única e proteção de respawn (`135px`, `4,2s`) sem alterar Normal/Difícil. | Aprovado |

---

## 4. Simulações Determinísticas de Dificuldade e Equilíbrio

> **Aviso metodológico obrigatório:** os dados desta seção provêm de **simulações determinísticas com bots em passo fixo de `1/120 s`** (idêntico ao integrador do `ArcadeScene.ts`), **não** de sessões de playtest humano nem de avaliação subjetiva de diversão ou ritmo emocional.

Comportamentos simulados em [`tests/pelagicFinalAudit.test.mjs`](../tests/pelagicFinalAudit.test.mjs):
- `passive`: parado ao centro com tiro contínuo (sem esquiva/especial).
- `edge-sweep`: varredura senoidal horizontal simples sem previsão de projéteis.
- `weak`: reação tardia apenas quando há projétil a `< 26 px` e coleta oportunista.
- `intermediate`: navegação de referência (`steer` com evasão e coleta, sem usar especiais).
- `advanced`: piloto simulado com previsão multi-horizonte (`30–310 ms`) para projéteis e mergulhos inimigos, priorização de evasão sobre caixas sob fogo próximo e uso tático de `Tormenta Escarlate`.

| Modo | Estratégia (Bot) | Desfecho | Duração (`s`) | Rota (`s`) | Mortes | Pontuação | Nível Máx. / Final | Pico Balas | Janela mais densa | Frames sem saída (`zeroEscape`) |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | ---: | --- | ---: |
| `ASSISTIDO` | `passive` | Derrota | `17,17` | `17,2` | `3` | `720` | `NV1 / NV1` | `3` | `0s` | `0` |
| `ASSISTIDO` | `edge-sweep` | Derrota | `71,93` | `71,9` | `3` | `6.320` | `NV1 / NV1` | `4` | `20s` | `0` |
| `ASSISTIDO` | `weak` | Derrota | `159,47` | `159,5` | `3` | `19.250` | `NV3 / NV1` | `30` | `150s` (Minichefe) | `0` |
| `ASSISTIDO` | `intermediate` | **Vitória** | `406,32` | `300,0` | `1` | `112.830` | `NV5 / NV3` | `38` | `370s` (Colosso) | `0` |
| `ASSISTIDO` | `advanced` | **Vitória** | `373,04` | `300,0` | `0` | `117.500` | `NV5 / NV5` | `37` | `350s` (Colosso) | `0` |
| `NORMAL` | `passive` | Derrota | `17,17` | `17,2` | `3` | `720` | `NV1 / NV1` | `3` | `0s` | `0` |
| `NORMAL` | `edge-sweep` | Derrota | `71,93` | `71,9` | `3` | `6.320` | `NV1 / NV1` | `4` | `20s` | `0` |
| `NORMAL` | `weak` | Derrota | `139,93` | `139,9` | `3` | `17.080` | `NV2 / NV1` | `7` | `80s` | `0` |
| `NORMAL` | `intermediate` | **Vitória** | `440,19` | `300,0` | `1` | `112.180` | `NV5 / NV1` | `38` | `390s` (Colosso) | `0` |
| `NORMAL` | `advanced` | **Vitória** | `373,04` | `300,0` | `0` | `117.500` | `NV5 / NV5` | `37` | `350s` (Colosso) | `0` |
| `DIFÍCIL` | `passive` | Derrota | `16,96` | `17,0` | `3` | `760` | `NV1 / NV1` | `3` | `0s` | `0` |
| `DIFÍCIL` | `edge-sweep` | Derrota | `96,14` | `96,1` | `3` | `10.780` | `NV2 / NV1` | `5` | `80s` | `0` |
| `DIFÍCIL` | `weak` | Derrota | `159,30` | `159,3` | `3` | `18.290` | `NV3 / NV1` | `30` | `150s` (Minichefe) | `0` |
| `DIFÍCIL` | `intermediate` | Derrota | `258,66` | `258,7` | `4` | `50.150` | `NV2 / NV1` | `38` | `170s` | `0` |
| `DIFÍCIL` | `advanced` | **Vitória** | `375,04` | `300,0` | `0` | `130.900` | `NV5 / NV5` | `54` | `350s` (Colosso) | `0` |

Leitura objetiva da matriz:
- Jogadores passivos (`passive`) ou meramente oscilatórios (`edge-sweep`) falham rapidamente em **todos** os modos (não há autopassagem gratuita no Assistido).
- No `intermediate` (com 1 morte), o **Modo Assistido** preservou poder (`finalLevel: NV3` vs `NV1` no Normal), acelerando a conclusão do Colosso Abissal em **`33,87 s`** (`406,32 s` vs `440,19 s`), enquanto execuções perfeitas (`advanced`, `0` mortes) têm resultados rigorosamente idênticos entre Assistido e Normal.
- O modo **Difícil** elimina vitórias sem evasão/especial consistentes (`intermediate` derrotado aos `258,66 s`), eleva o pico de projéteis hostis (`54` vs `37` no Normal) e recompensa o domínio sem gerar quadros de armadilha matemática (`zeroEscapeFrames = 0` em todas as `15` execuções).

---

## 5. Auditoria Real de Desempenho (WebGL / Chrome)

Ambiente medido por [`scripts/pelagic-final-audit.mjs`](../scripts/pelagic-final-audit.mjs) sobre o bundle de produção `dist/`:
- **GPU/Renderer:** `ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001681) Direct3D11 vs_5_0 ps_5_0, D3D11)`
- **Amostras:** `6 s` reais (~`359–360` quadros por cenário/qualidade via `requestAnimationFrame`), sem simulação acelerada. Evidência completa em [`docs/screenshots/pelagic-final-audit-v1/report.json`](screenshots/pelagic-final-audit-v1/report.json).

| Cenário | Viewport | Qualidade | FPS | Mediana (`ms`) | `p95` (`ms`) | `p99` (`ms`) | Máx (`ms`) | Heap Início → Fim (`MB`) | Objetos | Pico Balas / Inimigos |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |
| Trecho costeiro comum (`NV3`) | `1366×768` | `BAIXA` (`0`) | `59,78` | `16,7` | `16,8` | `17,0` | `17,5` | `55,93 → 56,52` | `911` | `28 / 31` |
| Trecho costeiro comum (`NV3`) | `1366×768` | `MÉDIA` (`1`) | `59,81` | `16,7` | `16,8` | `16,9` | `17,0` | `47,41 → 48,58` | `918` | `28 / 31` |
| Trecho costeiro comum (`NV3`) | `1366×768` | `ALTA` (`2`) | `59,81` | `16,7` | `16,9` | `17,1` | `17,4` | `54,33 → 51,98` | `918` | `28 / 31` |
| Alta densidade + mísseis `NV5` | `1366×768` | `BAIXA` (`0`) | `59,83` | `16,7` | `16,8` | `16,9` | `17,2` | `45,50 → 51,20` | `932` | `66 / 13` |
| Alta densidade + mísseis `NV5` | `1366×768` | `MÉDIA` (`1`) | `59,84` | `16,7` | `16,8` | `17,0` | `17,1` | `52,45 → 67,16` | `932` | `66 / 13` |
| Alta densidade + mísseis `NV5` | `1366×768` | `ALTA` (`2`) | `59,83` | `16,7` | `16,8` | `17,0` | `17,1` | `55,97 → 51,49` | `932` | `66 / 13` |
| Explosão `Tormenta Escarlate` | `1366×768` | `BAIXA` (`0`) | `59,86` | `16,7` | `16,8` | `17,0` | `17,3` | `70,45 → 58,36` | `920` | `46 / 11` |
| Explosão `Tormenta Escarlate` | `1366×768` | `MÉDIA` (`1`) | `59,81` | `16,7` | `16,8` | `17,0` | `17,2` | `53,85 → 66,45` | `920` | `46 / 11` |
| Explosão `Tormenta Escarlate` | `1366×768` | `ALTA` (`2`) | `59,82` | `16,7` | `16,8` | `17,1` | `17,4` | `64,17 → 67,62` | `920` | `46 / 11` |
| Combate `COLOSSO ABISSAL` (`NV5`) | `1366×768` | `BAIXA` (`0`) | `59,81` | `16,7` | `16,8` | `17,0` | `17,3` | `70,94 → 55,78` | `923` | `46 / 0` |
| Combate `COLOSSO ABISSAL` (`NV5`) | `1366×768` | `MÉDIA` (`1`) | `59,84` | `16,7` | `16,8` | `17,0` | `17,3` | `62,29 → 56,32` | `926` | `46 / 0` |
| Combate `COLOSSO ABISSAL` (`NV5`) | `1366×768` | `ALTA` (`2`) | `59,83` | `16,7` | `16,8` | `17,1` | `17,3` | `63,07 → 51,66` | `929` | `46 / 0` |
| Touch mobile emulado (`NV4`) | `854×480 (DPR 2)` | `BAIXA` (`0`) | `59,87` | `16,7` | `16,8` | `17,0` | `17,0` | `56,60 → 60,57` | `924` | `50 / 41` |
| Touch mobile emulado (`NV4`) | `854×480 (DPR 2)` | `MÉDIA` (`1`) | `59,84` | `16,7` | `16,8` | `16,9` | `17,1` | `72,25 → 73,83` | `924` | `50 / 41` |
| Touch mobile emulado (`NV4`) | `854×480 (DPR 2)` | `ALTA` (`2`) | `59,84` | `16,7` | `16,9` | `17,0` | `17,5` | `58,93 → 57,00` | `924` | `50 / 41` |

### Verificação de Vazamento Após Reinícios (`5` partidas seguidas em `ALTA`)

| Reinício | Objetos (`s.children.length`) | `enemySprites` ativos | `effects` ativos | Heap JS (`MB`) |
| ---: | ---: | ---: | ---: | ---: |
| `1` | `911` | `0` | `0` | `72,08` |
| `2` | `911` | `0` | `0` | `60,67` |
| `3` | `911` | `0` | `0` | `75,23` |
| `4` | `911` | `0` | `0` | `63,85` |
| `5` | `911` | `0` | `0` | `52,36` |

Nenhum crescimento de objetos de cena (`911` em todas as iterações) e reciclagem estável de memória por GC (`52,36–75,23 MB`). Observações não críticas para otimização futura opcional: `ArcadeWorld.updateBullets()` ainda filtra um array temporário de alvos por míssil guiado ativo, e `ArcadeScene.renderWorld()` aplica textura base antes de sobrescrever para `arc-wet-hull-*`; nenhum dos dois causou impacto perceptível de frame time nesta auditoria (`p99 <= 17,1 ms`).

---

## 6. Evidências Visuais Inspecionadas (`docs/screenshots/pelagic-final-audit-v1/`)

Todas as `11` capturas geradas por [`scripts/pelagic-final-audit.mjs`](../scripts/pelagic-final-audit.mjs) foram inspecionadas diretamente:
- [`01-title.png`](screenshots/pelagic-final-audit-v1/01-title.png): menu principal e logotipo `BULLET WAKE`.
- [`02-play-coast-early.png`](screenshots/pelagic-final-audit-v1/02-play-coast-early.png): início costeiro, farol, guindaste e HUD aprovado.
- [`03-play-convoy-lv4.png`](screenshots/pelagic-final-audit-v1/03-play-convoy-lv4.png): comboio naval, mísseis `NV5`, pop-up de formação e diálogo dinâmico de Bayek.
- [`04-special-tormenta-escarlate.png`](screenshots/pelagic-final-audit-v1/04-special-tormenta-escarlate.png): explosão da `Tormenta Escarlate` sobre o comboio.
- [`05-miniboss-patrulha-pesada.png`](screenshots/pelagic-final-audit-v1/05-miniboss-patrulha-pesada.png): combate contra o minichefe `PATRULHA PESADA`.
- [`06-boss-colosso-proa.png`](screenshots/pelagic-final-audit-v1/06-boss-colosso-proa.png): `1/5 PROA BLINDADA` do `COLOSSO ABISSAL`.
- [`07-boss-colosso-comando.png`](screenshots/pelagic-final-audit-v1/07-boss-colosso-comando.png): `3/5 TORRE DE COMANDO` com crateras, fumaça e transição anterior pontuada (`+1800 SEÇÃO 2/5`).
- [`08-touch-mobile-854x480.png`](screenshots/pelagic-final-audit-v1/08-touch-mobile-854x480.png): emulação touch `854×480` após a correção da pausa, com placa `PONTUAÇÃO 2420` limpa, botão `Ⅱ` livre no topo direito, joystick/`ESP`/`TIRO` nas colunas laterais e combate legível no corredor central.
- [`09-touch-settings.png`](screenshots/pelagic-final-audit-v1/09-touch-settings.png): painel `CONTROLES TOUCH` com pré-visualização ao vivo.
- [`10-victory-result.png`](screenshots/pelagic-final-audit-v1/10-victory-result.png): conclusão da missão (`RANK S`, `PRÓXIMA: CIDADE SOLAR`).
- [`11-defeat-screen.png`](screenshots/pelagic-final-audit-v1/11-defeat-screen.png): tela de derrota com `TENTAR NOVAMENTE` e `MENU`.

---

## 7. Registro de Testes Executados e Pendências

### Executados e Aprovados (pós-última edição de código)
1. `npm test` (`296` testes em `tests/*.test.mjs`, `0` falhas, `0` ignorados).
2. `npm run build` (`tsc --noEmit && vite build`, saída `0`).
3. `node scripts/pelagic-final-audit.mjs` (capturas, UI/save, touch emulado, paridade 0/1/2, 15 benchmarks WebGL e leak check — saída `0`, `errors: []`).
4. `node scripts/arcade-browser-check.mjs --routes --performance` (fluxo completo Rota 01 + Rota 02, gamepad, touch, pausa e WebGL — saída `0`, `errors: []`).
5. `node scripts/pelagic-combat-check.mjs --quick` (Colosso Abissal, 5 seções e transição — saída `0`).
6. `node scripts/pelagic-events-check.mjs` (eventos especiais da Fenda Pelágica — saída `0`).
7. `node scripts/pelagic-assist-comms-check.mjs` (Modo Assistido e diálogos do Bayek — saída `0`).
8. `node scripts/pelagic-ocean-check.mjs` (ondas, esteiras navais, submarinos e qualidades — saída `0`).
9. `node scripts/pelagic-anims-check.mjs` (spritesheets e animações da RIVET/inimigos — saída `0`).
10. `node scripts/pelagic-touch-check.mjs` (`854×480`, rotação `412×915 ↔ 915×412` com cutouts e `CANHOTO` persistido — saída `0`).
11. `node scripts/pelagic-review-check.mjs` (modo completo + gravação WebM + `1366×768` e `1920×1080` — saída `0`).

### Não Executados / Pendentes
- **Hardware Android real (smartphone e tablet):** não havia dispositivo conectado via USB/`adb` no ambiente de auditoria. Validações de ergonomia tátil física, latência de tela, térmicas móveis e comportamento de WebView/Chrome Android real permanecem pendentes.
- **Playtest humano:** nenhuma sessão de avaliação humana de diversão, legibilidade subjetiva ou curva percebida foi realizada nesta auditoria; simulações determinísticas não substituem playtest humano.
