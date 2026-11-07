# 09 — UI, HUD, input, áudio e experiência

## HUD do combate
Superior esquerdo: SCORE 00000000 e combo. Superior centro: 3 segmentos de INTEGRIDADE; superior direita: VIDAS ×03. Inferior esquerdo: arma + LV; inferior centro: barra RESSONÂNCIA; inferior direito: BOMBA ×02. Boss HP aparece sobre área segura, não encima da zona de tiros. Layout responsivo sem virar interface gigante.

## Fluxo de telas
Splash/title BULLET WAKE → Iniciar/Continuar/Seleção de missão liberada/Configurações/Créditos → Seleção com 3 cards (portrait, nave animada, especial e stats) → Briefing curto → Missão → Pausa/Continue/Game Over ou Vitória → Score/resultados → próxima missão. Todos controles com feedback imediato e telas puláveis quando apropriado.

## Mapeamento inicial
| Ação | PC teclado | Gamepad | Android |
|---|---|---|---|
| mover | WASD / setas | stick/D-pad | arrasto/virtual stick |
| tiro | espaço / J | botão principal | auto-fire |
| especial | K / Shift | secundário | botão grande |
| bomba | L | terciário | botão grande |
| pausar | ESC / P | Start | pause |
| confirmar | Enter | A | toque |

Input unificado em ações, não diretamente no Player. Evitar botões touch pequenos, sobreposição com zona de dedo e ações acidentais em notch. Testar landscape 16:9, 20:9 e tablets. Pausar ao sair do app; áudio retoma sem camadas duplicadas.

## Acessibilidade
Reducing flashes/tremor, mute/music/SFX separados, legendas rádio identificadas, ataques avisados por forma e tempo além de cor, contraste controlado, dimensões de toque adequadas e alto contraste para fonte pixel.

## Direção sonora
Trilha original de sintetizadores com percussão industrial: fase 1 metálica e urgente; fase 2 cristalina e isolada; fase 3 biomecânica; fase 4 tempestade heroica; fase 5 resolução do mistério. Bosses com motivos sonoros próprios, dinâmica muda sem interromper gameplay.

**Banco de SFX:** nave Rivet/Moth/Knuckle por arma; especiais x3; bomba; hit jogador e inimigo; explosões pequenas/médias/grandes; upgrade, reparo, bomba, escudo, ressonância, score; aviso de ataque; boss intro/morte; UI/continue/vitória. Limitar sons simultâneos e ducking para alertas importantes. Som sempre autoral/licenciado.
