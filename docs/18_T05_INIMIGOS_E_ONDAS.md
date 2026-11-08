# T05 — Scouts, Lancers e ondas roteirizadas

**Status:** código publicado na master; testes de lógica e build automatizados, validação visual em navegador ainda necessária.

## Entrega
- `EnemyDirector` em TypeScript puro: timeline de spawn, movimento, estados de ataque e HP. Reinicia com a cena.
- **Scout:** 1 HP, movimento ondulante vertical, chegada rápida, telegraph por 640ms, um disparo na direção do jogador, recuo e saída; 100 pontos.
- **Lancer:** 3 HP, aproximação com acompanhamento vertical limitado, telegraph por 950ms, duas rajadas, saída; 300 pontos.
- Estados: `approach → telegraph → attack → recover → exit`; spawn inicial aos 0,55s, 1,35s, 3,4s e demais eventos até ~18s; ciclo roteirizado se repete a cada 23s no sandbox para teste contínuo, não é fase final.
- Aviso de disparo pisca no casco antes de emitir balas. Tiros são mirados na **posição do jogador ao disparar**, não perseguem depois.
- Duas silhuetas provisórias diferentes, indicadores de dano e cor de alerta. São formas de debug **não sprites finais**.
- Colisão nave/inimigo, player bullets com HP por tipo, score somente na morte, remoção de objetos fora de tela, limite de balas inimigas.
- HUD mostra número de onda. Game Over, respawn, vidas e HP continuam funcionando.
- Testes de lógica no arquivo `tests/enemyDirector.test.mjs`; CI executa `npm test` além de typecheck e build.

## Como verificar
```bash
git pull origin master
npm install
npm test
npm run dev
```
Observe Scouts após ~0,5s, Lancer após ~3,4s, aviso luminoso antes dos tiros e pontuação 100/300 por morte. Deixe rodar 23s para ver outra onda. Tente perder HP e vidas e reiniciar com R. Verifique ausência de double-score e disparos invisíveis.

## Limites e próxima etapa
AI/padrões estão separados da renderização, mas não há spritesheets, modelos de pilotos nem roteiro integral da fase 1. A tarefa T06 deve permitir escolher Nolan, Cora ou Harlan, atribuindo velocidade, frequência e potência reais. A interface e marcadores continuam temporários.
