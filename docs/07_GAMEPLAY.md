# 07 — Manual de gameplay e progressão

> HISTÓRICO: para nomes, cinco pilotos, vidas/especiais 5/5, armas próprias, duração 2–4 min e áudio atuais, prevalecem a [Bíblia vigente](27_BULLET_WAKE_V2_DEFINITIVO.md) e a [revisão 39](39_ELENCO_COMBATE_AUDIO.md).
> Estado vigente: [Bíblia V2](27_BULLET_WAKE_V2_DEFINITIVO.md) e [revisão de ritmo/elenco/contornos](38_RITMO_ELENCO_E_CONTORNOS.md). As definições históricas abaixo não substituem quatro pilotos, três vidas sem barra, especial único, ausência de dash/carga/míssil manual e foco exclusivo na Fase 1.

> **Regras vigentes da Fase 1:** [diretriz 33](33_FASE1_ALIENIGENAS_CAMADAS_OCEANO.md). Uma barra contínua 0–100 de integridade; sem vidas extras automáticas. Especial único V/X, duas cargas iniciais/máximo três, E repõe uma, sem bomba separada ou ressonância. Cor de arma e potência P independentes. O texto legado abaixo não substitui essa diretriz.

## Controle e sobrevivência
Movimento de nave em oito direções, câmera horizontal, fogo básico repetível. Deslocamento pelo deltaTime, diagonal normalizada. **3 vidas por partida; 3 pontos de integridade por vida.** Ao sofrer dano, -1 HP, i-frames propostos de 1,5 s; ao morrer, perde 1 vida, animação de destruição, respawn seguro no checkpoint com 3 HP e i-frame inicial de 2 s (hipóteses). Hits simultâneos não causam dano duplicado. No fim das vidas, Continue limitado ou Game Over.

## Armas
Cada piloto preserva identidade de tiro. Todas as categorias liberadas oferecem **LV1, LV2, LV3** (não LV4). Tipos propostos: pulso base, laser concentrado, spread e mísseis auxiliares. Upgrades coletáveis e não permanentes na campanha arcade. O jogador nunca precisa gastar munição no tiro padrão.

## Especiais e Ressonância
Medidor ganha energia ao destruir inimigos e recolher energia; near-miss dá bônus opcional, não obrigatório. Quando cheio:
- Nolan dispara **Tempestade Prismática**: múltiplos caminhos simultâneos por curta duração.
- Cora ativa **Salto Fantasma**: dash protegido com rastros e dano de contato, testado com varredura de colisão.
- Harlan solta **Ruptura Nova**: pulso com dano em área e remoção de projéteis no raio delimitado.
Bombas são consumíveis separados dos especiais: estoque inicial sugerido 2; limpeza em área e explosão própria.

## Pickups
Reparo +1 HP até 3; upgrade +1 nível até 3; escudo temporário; bomba; energia de Ressonância; pontos. Ícones com silhuetas únicas, não só mudança de cor, e drop sempre dentro da região alcançável. Pickup não nasce dentro de sólidos.

## Pontuação
Score por classe de inimigo, partes destruídas, combos por sequência de mortes, bônus por resgate, vida restante e missão concluída. Combos têm decay temporal; balancear para não punir Harlan injustamente. Ranking local por piloto/fase/dificuldade; continuar pode invalidar recorde da tentativa sem apagar progresso desbloqueado.

## Fases, continuações e salvamento
Fases roteirizadas, checkpoints antes de trechos importantes, progresso entre fases persistido. A missão seguinte desbloqueia ao terminar a anterior. Escolher piloto antes de cada fase; não manter arma de nave anterior. SaveData com schemaVersion, unlockedMissions, bestScores, settings e lastPilot. Ao carregar checkpoint, não permitir score/pickup infinitos por reset.

## Dificuldade
Normal = aprendizado e densidade moderada; Difícil = novas variações de padrão, maior pressão e menores pausas — não eliminar avisos. Mesmos HP/vidas entre pilotos. Testar efetividade real e chance de conclusão com os três.
