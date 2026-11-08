# 11 — Roadmap de produção (prioridade: GAMEPLAY)

**Decisão de priorização:** gameplay antes de acabamento visual. Primeiro construir o ciclo de movimentação → disparo → reação do inimigo → dano → derrota/vitória, e **depois substituir os elementos diagnósticos por sprites animados autorais**. Nenhum marcador do protótipo serve como arte final.

## Estado
| Tarefa | Estado | Entrega |
|---|---|---|
| T01 | CONCLUÍDA | Bootstrap Phaser 4 + TS + Vite e CI de build |
| T02 | IMPLEMENTADA — validar em navegador/mobile | Canvas FIT, safe areas e sandbox com nave controlável, tiros, alvos e score |
| T03 | IMPLEMENTADA — QA manual pendente | Projéteis inimigos, HP, invulnerabilidade, respawn, game over; [detalhes](16_T03_COMBATE_E_DANO.md) |\n| T04 | IMPLEMENTADA — QA manual pendente | HUD, feedback de dano e overlay Game Over com botão; [detalhes](17_T04_HUD_E_GAME_OVER.md) |\n| T05–T70 | A FAZER | A seguir, priorizadas por gameplay |

A avaliação de T02 inclui CI build/typecheck e teste manual de viewport e toque. Para detalhes ver [T02](15_T02_GAMEPLAY_FIRST.md). A T03 implementa dano/vidas com [registro de aceite](16_T03_COMBATE_E_DANO.md). A T04 entrega UI funcional e o fluxo de reinício em [seu documento](17_T04_HUD_E_GAME_OVER.md).

## Primeiro ciclo: 1 minuto jogável (T03–T10)

| ID | Prioridade | Tarefa | Critério de aceite |
|---|---|---|---|
| T03 | Alta | Adicionar dano à nave e projéteis inimigos | Integridade 3, i-frames, morte, respawn e colisões honestas |
| T04 | Alta | HUD vivo e reinício de tentativa | Vidas, HP, score, botão reiniciar e Game Over funcionais |
| T05 | Alta | Primeiro inimigo real e ondas roteirizadas | Scout + Lancer com telegraph, tiros e spawns reproduzíveis |
| T06 | Alta | Seleção dos três pilotos com atributos reais | Nolan, Cora e Harlan mudam controle/cadência/dano |
| T07 | Alta | Sistema de arma e especial básico por piloto | Cada piloto possui ao menos 1 comportamento exclusivo verificável |
| T08 | Alta | Eventos, pickups e miniboss simples | Loop de combate de 45–60s com começo, risco e objetivo |
| T09 | Alta | Integrar spritesheets autorais e animados na primeira vertical slice | Rivet idle/climb/dive, tiros, dois inimigos e explosões, sem shapes de debug |
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
T31 cenário Cinturão de Ferrugem; T32 boss KRM-17 arte modular; T33 boss 3 estados e ataques; T34 Pause/Continue/Game Over refinados; T35 score/combos/rank; T36 save de campanha; T37 Android controles e safe areas finalizados; T38 menus pixel art; T39 trilha, áudio e mix fase 1; T40 finalizar ~8–10 minutos e QA PC/Android.

## Campanha (T41–T70)
T41–T45 fase 2; T46–T50 fase 3; T51–T55 fase 4; T56–T60 fase 5. T61–T70 ajustes, release, acessibilidade, builds Android, licenças, testes e otimização. Gates de regressão a cada 10 tarefas continuam obrigatórios.

## Regra de definição de pronto
Tarefas em PT-BR, commits em espanhol (Conventional Commits); branch de trabalho `master` quando solicitado pelo proprietário. Não declarar arte final, teste Android ou gameplay terminado apenas pelo build. Cada tarefa registra código/arte real, arquivos, testes, captura quando disponível, commit e pendências. Não inventar versão de agente ou status de dispositivo.
