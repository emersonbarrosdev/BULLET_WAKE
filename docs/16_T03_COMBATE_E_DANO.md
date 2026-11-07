# T03 — Tiros inimigos, dano e ciclo de vidas

**Estado:** implementação na branch `master`. Requer verificação de uso em navegador real.

## Funcionalidades
- Três alvos de teste começam disparando projéteis laranja/vermelho contra a posição da nave.
- Cada projétil tem direção e velocidade independentes do FPS; colisão simples com hitbox central.
- Dano: 3 HP por vida; cada acerto tira 1 HP, com 1,5 segundo de invulnerabilidade.
- Ao perder 3 HP: desconta uma vida e reaparece no centro esquerdo, com 3 HP, área de projéteis limpa e proteção de 2 segundos.
- Com 0 vidas: exibe Game Over e trava movimentação/troca de disparos.
- Reinício: R ou novo toque na tela após Game Over.
- HUD de teste agora usa fonte menos pixelada e textura de texto em **2x** (`Text.setResolution(2)`) para melhorar leitura. O HUD arcade final é T04.

## Responsabilidades
`src/game/systems/combat.ts` concentra regras puras de HP, lives, i-frame, respawn e game over.
`src/game/scenes/PrototypeScene.ts` desenha os marcadores, dispara balas, faz colisões e aplica alterações de estado. Cena não cria inimigo final: alvos são somente marcadores de teste.

## Testes de aceite manuais
1. Rodar `npm run dev`; movimentar via WASD/setas; atirar segurando espaço.
2. Aproximar-se das balas e observar HP descer **um por acerto**.
3. Durante piscada da nave, colisões não devem retirar mais HP.
4. Ao HP chegar a 0, uma vida é consumida e HP volta a 3. Balas que estavam na tela somem durante respawn.
5. Na terceira morte, aparece Game Over e nenhum tiro novo é emitido; apertar R ou tocar reinicia.
6. Confirmar pontuação ao acertar alvos e FPS estável em resolução de janela variada.
7. Comparar leitura das labels em 1080p, 720p e celular paisagem.

## Limites desta tarefa
Ainda não existe spritesheet animada, IA de inimigo, checkpoint persistente, física avançada, menu final, bônus, boss, áudio nem tela de Game Over produzida em pixel art definitiva. Todos previstos nas próximas tarefas.

## QA automatizado
GitHub Actions valida TypeScript e build Vite. Isso **não** prova que controles/colisões foram testados no navegador. A confirmação funcional depende dos testes manuais acima.
