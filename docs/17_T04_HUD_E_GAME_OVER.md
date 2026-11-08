# T04 — HUD funcional, feedback de dano e Game Over

**Status:** implementado, com validação de build/TypeScript via CI; ainda precisa de verificação manual no navegador e no Android.

## Entregas
- HUD próprio `CombatHud` separado da simulação, com score, três segmentos de integridade e vidas.
- Interface de texto em Arial/Helvetica e `setResolution(3)` para reduzir o problema de leitura observado no protótipo.
- Avisos curtos e visíveis para perda de HP e perda de vida.
- Botão `REINICIAR [R]` clicável durante a tentativa, além de tecla `R`.
- Tela `GameOverOverlay` dedicada, com pontuação final e botão `JOGAR NOVAMENTE` clicável/touch.
- Reinício por `Phaser.Input.Keyboard.JustDown`, evitando reinícios repetidos pela tecla pressionada.
- Correção na iteração de balas inimigas quando respawn limpa o array, evitando acesso a objetos já destruídos.
- HUD e overlay se recriam na cena reiniciada sem reter ponteiros ou score de tentativa anterior.

## Critérios de aceite
1. Score muda ao eliminar marcador inimigo.
2. Barras de HP diminuem uma por acerto, nunca duas enquanto há i-frame.
3. Vida diminui ao perder o último HP; HP volta a 3 no respawn.
4. HUD mostra vida/integridade corretas em todo o ciclo.
5. Game Over exibe pontuação final e impede novos tiros/movimentação.
6. Clicar/tocar em `JOGAR NOVAMENTE` ou apertar `R` reinicia a tentativa e zera score.
7. O botão `REINICIAR [R]` funciona durante gameplay.
8. Sem duplicação de listeners, Game Over sobreposto ou arrays inválidos após restart.
9. Fonte melhora a leitura; inspecionar em navegador real antes de aceitar como UI final.

## Limites
A interface ainda é de protótipo; não há sprite final nem estilo definitivo. O usuário priorizou gameplay e as tarefas futuras incluem refinamento de HUD, pilotos, inimigos, menus e arte. O teste automatizado (typecheck/build) **não** comprova teste de render ou interação real.
