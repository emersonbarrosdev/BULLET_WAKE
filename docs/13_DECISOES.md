# 13 — Registro de decisões e pendências

## Aprovado pelo proprietário
- Nome separado em inglês: **BULLET WAKE**.
- Arcade clássico + cinematográfico, shooter horizontal lateral futurista, pixel art 16-bit moderno, PC/Android.
- Nolan Fitch / Rivet (cadência, Tempestade Prismática), Cora Wren / Moth (velocidade, Salto Fantasma), Harlan Greer / Knuckle (potência, Ruptura Nova). **Não renomear sem pedido.**
- Manter aparências originais desses três personagens após a fase de troca de nomes; novos nomes não implicam personagens novos.
- 3 vidas, 3 pontos de HP, três níveis por tipo de arma, power-ups, score, combos, continues limitados, checkpoints, Normal/Difícil, saves entre fases.
- Cinco biomas/etapas: Cinturão de Ferrugem, Mar de Vidro, Catedrais Vivas, Nuvem de Íons e Coração da MALHA.
- Defesa de colônia inicialmente seguida de viagem entre mundos pelo rastro. Fases manuais e chefes originais, sem roguelite.

## Decisão de engenharia da pré-produção
**Phaser 4 + TypeScript + Vite + Canvas/WebGL**. Angular fora do gameplay inicial; opcional para ferramenta externa futura. Primeiro web desktop, depois Android via empacotamento candidato (Capacitor a validar). Phaser versão exata a travar no lockfile durante implementação.

## Hipóteses de design, não fatos definitivos
- Resolução lógica 384×216 e sprite base 48×24, pivô (24,12), hitbox 12×8.
- Velocidades 190/215/175, tiros/s 8/6/5, DPS parecido, duração especial ~4s/0,6s e raio de bomba/especial.
- Ritmo de fases (8/9/10/10/12 min), nomes dos bosses, spawns, danos e pickup rates.
- Música final e sons autorais, cores finais, marca/logotipo e availability comercial do nome.
- Desempenho 60 FPS e compatibilidade Android: apenas **metas**, não aferidos.

## Não declarar pronto
Nenhum código, spritesheet, Android APK, trilha, build, testes ou desempenho foi entregue por este conjunto de documentos. Somente documentos e plano de tarefas. A publicação de documentos no GitHub comprova **documentação versionada**, não entrega do jogo.
