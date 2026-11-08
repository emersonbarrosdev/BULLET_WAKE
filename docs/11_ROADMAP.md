# 11 — Roadmap de produção (prioridade: GAMEPLAY)

**Direção atual:** shoot 'em up horizontal com fase avançando continuamente, sem rounds/ondas de arena. Gameplay e pixel art moderna evoluem em conjunto; uma nave é refinada por vez. Nenhum marcador de debug é arte final.

## Estado
| Tarefa | Estado | Entrega |
|---|---|---|
| T01 | CONCLUÍDA | Bootstrap Phaser 4 + TS + Vite e CI de build |
| T02 | IMPLEMENTADA — validar em navegador/mobile | Canvas FIT, safe areas e sandbox com nave controlável, tiros, alvos e score |
| T03 | IMPLEMENTADA — QA manual pendente | Projéteis inimigos, HP, invulnerabilidade, respawn, game over; [detalhes](16_T03_COMBATE_E_DANO.md) |
| T04 | IMPLEMENTADA — QA manual pendente | HUD, feedback de dano e overlay Game Over com botão; [detalhes](17_T04_HUD_E_GAME_OVER.md) |
| T05 | IMPLEMENTADA — QA visual pendente | Scout e Lancer, FSM, ondas roteirizadas, tiros anunciados; [detalhes](18_T05_INIMIGOS_E_ONDAS.md) |
| T06 | IMPLEMENTADA — QA manual pendente | Cena de seleção e atributos dos três pilotos; [detalhes](19_T06_ESCOLHA_DE_PILOTOS.md) |
| T07 | BASE V1 — não aprovada visualmente | Sprites preliminares integrados, mas exigem revisão individual; [base técnica](20_T07_SPRITES_COMBATE.md) |
| T07.1 | RIVET V2 IMPLEMENTADA — QA visual pendente | Uma nave por vez: nova Rivet 112×54, animações de voo, tiro, dano e morte; [detalhes](21_RIVET_V2_MODERN_PIXEL_ART.md) |
| T08 | IMPLEMENTADA — QA visual pendente | Resolução 768×432, parallax e StageDirector sem ondas; [detalhes](22_T08_SCROLL_CONTINUO_E_QUALIDADE.md) |
| Próximo | FOCO | Validar a progressão em navegador e corrigir texturas verdes se ainda surgirem |
| T09–T70 | REPLANEJAR APÓS GATE RIVET | Especiais com sprites, combate completo, fases e boss mais adiante |

A avaliação de T02 inclui CI build/typecheck e teste manual de viewport e toque. Para detalhes ver [T02](15_T02_GAMEPLAY_FIRST.md). A T03 implementa dano/vidas com [registro de aceite](16_T03_COMBATE_E_DANO.md). A T04 entrega UI funcional e o fluxo de reinício em [seu documento](17_T04_HUD_E_GAME_OVER.md). A T05 descreve a primeira IA de inimigos no [registro histórico](18_T05_INIMIGOS_E_ONDAS.md), cujo modelo de ondas foi retirado em T08. A T06 registra a escolha real de pilotos em [seu documento](19_T06_ESCOLHA_DE_PILOTOS.md).

## Primeiro ciclo: 1 minuto jogável (T03–T10)

| ID | Prioridade | Tarefa | Critério de aceite |
|---|---|---|---|
| T03 | Alta | Adicionar dano à nave e projéteis inimigos | Integridade 3, i-frames, morte, respawn e colisões honestas |
| T04 | Alta | HUD vivo e reinício de tentativa | Vidas, HP, score, botão reiniciar e Game Over funcionais |
| T05 | Alta | Primeiro inimigo real (protótipo original de ondas) | História: Scout + Lancer, substituído pelo StageDirector em T08 |
| T06 | Alta | Seleção dos três pilotos com atributos reais | Nolan, Cora e Harlan mudam controle/cadência/dano |
| T07 | Alta | Pipeline visual de combate com spritesheets | Naves, projéteis, inimigos, impactos e explosões animados via PNG |
| T08 | Alta | Fase auto-scroll e resolução de pixel art mais densa | 768×432, 3 camadas de parallax, eventos por distância, sem ondas |
| T09 | Alta | Refinar Rivet e verificar inimigos/FX em jogo | Corrigir texturas ausentes, animações e legibilidade sem criar novas naves |
| T10 | Alta | Fechar 1 minuto + bateria de regressão | 3 pilotos, teste mobile inicial, controles, colisões, FPS medido |

**Gate QA após T10**: testes de movimentação, hitbox, tiro, IA, animação (frames diferentes), viewport, arte, performance; só então ampliar conteúdo.

## 2 minutos + profundidade (T11–T20)
- T11: níveis de armas 1–3 para uma família. T12: impacto/explosões definitivos.
- T13: efeitos sonoros básicos e mixer. T14: drone Dart e nova formação.
- T15: cenário com torres/obstáculos colisionáveis.
- T16: sequência completa 2 minutos e checkpoint.
- T17: sprites Moth e estados de animação. T18: sprites Knuckle com recuo.
- T19: UI de escolha refinada com retratos e preview.
- T20: balancear 3 pilotos + regressão do gate T20.

## 5 minutos + recursos avançados (T21–T30)
T21 upgrades de todas as armas; T22 pickups reparo/escudo/bomba; T23 Tempestade Prismática final; T24 Salto Fantasma final; T25 Ruptura Nova final; T26 ressonância e bombas; T27 salvamento de checkpoint; T28 miniboss modular completo; T29 trecho de 5min; T30 QA e balanceamento.

## Primeira fase completa (T31–T40)
T31 cenário definitivo Cinturão de Ferrugem; T32 boss KRM-17 arte modular; T33 boss 3 estados e ataques; T34 Pause/Continue/Game Over refinados; T35 score/combos/rank; T36 save de campanha; T37 Android controles e safe areas finalizados; T38 menus pixel art; T39 trilha, áudio e mix fase 1; T40 finalizar ~8–10 minutos e QA PC/Android.

## Campanha (T41–T70)
T41–T45 fase 2; T46–T50 fase 3; T51–T55 fase 4; T56–T60 fase 5. T61–T70 ajustes, release, acessibilidade, builds Android, licenças, testes e otimização. Gates de regressão a cada 10 tarefas continuam obrigatórios.

## Regra de definição de pronto
Tarefas em PT-BR, commits em espanhol (Conventional Commits); branch de trabalho `master` quando solicitado pelo proprietário. Não declarar arte final, teste Android ou gameplay terminado apenas pelo build. Cada tarefa registra código/arte real, arquivos, testes, captura quando disponível, commit e pendências. Não inventar versão de agente ou status de dispositivo.
