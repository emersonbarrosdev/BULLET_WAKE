# T06 — Seleção de pilotos e diferenças reais no combate

**Status:** implementado e publicado na `master`; typecheck, testes de lógica e build verificados pelo CI. Teste manual em navegador/Android ainda pendente.

## Fluxo
1. Ao abrir o jogo aparece a cena `PilotSelectScene`.
2. Três cards apresentam **Nolan Fitch / Rivet**, **Cora Wren / Moth** e **Harlan Greer / Knuckle**, com especial, velocidade, cadência e dano.
3. Setas e teclas 1/2/3 escolhem o piloto; Enter ou Espaço iniciam. Mouse/toque seleciona o card e usa botão **INICIAR**.
4. A cena de combate recebe explicitamente o id do piloto e usa seus valores na simulação. O nome da nave aparece no HUD.
5. R reinicia mantendo o mesmo piloto. Esc retorna à seleção; no Game Over há botão **TROCAR PILOTO**.

## Atributos iniciais
| Piloto | Nave | Velocidade (px/s) | Disparos/s | Dano/tiro | DPS teórico |
|---|---|---:|---:|---:|---:|
| Nolan Fitch | Rivet | 190 | 8 | 1.00 | 8.00 |
| Cora Wren | Moth | 215 | 6 | 1.33 | 7.98 |
| Harlan Greer | Knuckle | 175 | 5 | 1.60 | 8.00 |

Mesmo número de vidas, integridade e hitbox entre os três. Projetil muda largura, cor e dano para que a diferença seja percebida na demo; em especial, Lancer requer normalmente 3 disparos de Rivet/Moth ou 2 de Knuckle. Especial de cada piloto **ainda não é jogável**; sua identificação no card prepara a T07.

## Arquivos
- `src/game/data/pilots.ts`: modelo e catálogo tipados, intervalos de tiro.
- `src/game/scenes/PilotSelectScene.ts`: seleção keyboard + pointer.
- `src/game/ui/PrototypeShip.ts`: três marcadores de silhueta provisórios (não são sprites finais).
- `src/game/scenes/PrototypeScene.ts`: aplicar velocidade, intervalo e dano, seleção e reinício.
- `src/game/ui/CombatHud.ts`: mostrar nave selecionada.
- `src/game/ui/GameOverOverlay.ts`: permitir repetir ou trocar.
- `tests/pilots.test.mjs`: validação de nomes, cadência, DPS aproximado e identificadores.

## Testes de aceitação visual pendentes
- Abrir, escolher cada piloto via clique/touch e via setas/Enter.
- Conferir nave selecionada no HUD e silhueta (ainda debug) durante partida.
- Medir deslocamento em intervalo fixo e confirmar velocidade Moth > Rivet > Knuckle.
- Segurar tiro e verificar cadência Rivet > Moth > Knuckle, enquanto Knuckle destrói Lancer em menos impactos.
- Reiniciar com R mantém nave; Esc e botão do Game Over retornam à seleção.
- Mudar seleção várias vezes sem ouvintes duplicados, objetos órfãos, score herdado ou cenas sobrepostas.
- Validar em paisagem no PC e Android reais; CI não comprova teste manual.

## Próxima T07
Especial provisório exclusivo de cada piloto com medidor e implementação de regras distintas; depois os efeitos serão substituídos por assets em pixel art definitiva.
