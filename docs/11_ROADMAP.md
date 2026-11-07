# 11 — Roadmap e tarefas em PT-BR

**Status:** tudo listado como **A FAZER**. Não há implementação neste commit. Uma tarefa só conclui com arquivo real, aceites, testes e registro do commit. Mensagens de commits de implementação sugeridas em espanhol no padrão Conventional Commits. Branch principal pedida: **master**. Versão do Codex só deve ser preenchida quando for realmente usada, nunca inventada. Regressão completa após cada 10 tarefas.

## Marco A: 1 minuto jogável
| ID | Tarefa | Critério de aceite |
|---|---|---|
| T01 | Bootstrap Phaser 4 + TS + Vite | dev/build/typecheck sem Angular |
| T02 | Canvas lógico, WebGL e pixel-perfect | FIT 16:9 sem blur |
| T03 | Produzir sprites reais Rivet (idle/subida/descida) | frames diferentes e anchors |
| T04 | Movimento 8 direções e bounds | deltaTime, diagonal normalizada |
| T05 | Criar tiros e muzzle FX Nolan | tiros saem do canhão |
| T06 | Gerenciar cooldown e pool de balas | cadência por tempo, sem memory leak |
| T07 | Criar sprites Scout e Lancer | animações reais/autorais |
| T08 | Enemy FSM e primeiro spawner | aviso de ataque e padrões |
| T09 | HP, colisões e respawn | 3 HP, i-frame, 3 vidas |
| T10 | Cenário orbital com parallax e 1 minuto de sequência | jogável do início ao fim |

**Gate 10:** vídeos de idle/subir/descer, teste de HP, perfil de FPS, smoke e regressão.

## Marco B: 2 minutos + 3 pilotos
T11 HUD score/HP/vidas/arma; T12 FX impacto/explosão; T13 SFX básicos; T14 drone Dart; T15 torres e obstáculos; T16 roteirizar 2 min; T17 Moth com sprites e controles; T18 Knuckle com sprites, recoil e ataques; T19 menu 3 pilotos; T20 balancear DPS e velocidade. **Gate 20:** três pilotos completam 2min, teste preliminar touch.

## Marco C: 5 minutos + especiais
T21 upgrades LV1–3; T22 pickup/reparo/bomba/energia; T23 especial Tempestade Prismática; T24 especial Salto Fantasma; T25 especial Ruptura Nova; T26 bombas + ressonância; T27 checkpoint; T28 miniboss fase 1; T29 roteiro completo 5min; T30 regressão e ajuste. **Gate 30:** todos especiais testados contra cenários/obstáculos e tempos reais.

## Marco D: primeira fase completa
T31 kit cenário 01 definitivo; T32 arte modular KRM-17; T33 boss com 3 etapas e partes; T34 Pause/Game Over/Continue; T35 Score/combos/ranking; T36 save versionado; T37 controles Android/safe area; T38 menus em pixel art; T39 trilha + mixer fase 1; T40 primeira fase completa (~8–10min). **Gate 40:** três pilotos, duas dificuldades, PC e Android real.

## Marco E: fases e release
T41–T45: bioma/IA/hazards/chefe/QA fase 2. T46–T50: fase 3. T51–T55: fase 4. T56–T60: fase 5 e epílogos. T61–T70: polimento, acessibilidade, menus, Android build, fontes e licenças, otimização, testes automatizados, teste de finais, pacote release. Gates T50, T60, T70 conforme matriz de QA.

## Template de tarefa
- TÍTULO / ID / PRIORIDADE / STATUS / PROJETO
- DESCRIÇÃO com problema e solução técnica/visual
- DEPENDÊNCIAS E ARQUIVOS
- CRITÉRIOS DE ACEITE verificáveis
- TESTES EXECUTADOS, PLATAFORMA, EVIDÊNCIA visual
- RESPONSÁVEL / VERSÃO DO AGENTE, quando aplicável
- SHA DO COMMIT, RISCOS e PRÓXIMA TAREFA

Todo trabalho deve respeitar os briefs: **não trocar os nomes aprovados, não transformar o jogo em top-down, não substituir sprites finais por shapes**. Tarefas T41–T70 ainda exigem detalhamento antes de execução, mas esta divisão define o macroescopo.
