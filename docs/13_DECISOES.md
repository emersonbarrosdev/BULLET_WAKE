# 13 — Registro de decisões e pendências

## Aprovado pelo proprietário
- Nome separado em inglês: **BULLET WAKE**.
- Arcade clássico + cinematográfico, shooter horizontal lateral futurista, pixel art 16-bit moderno, PC/Android.
- Nolan Fitch / Rivet (cadência, Tempestade Prismática), Cora Wren / Moth (velocidade, Salto Fantasma), Harlan Greer / Knuckle (potência, Ruptura Nova). **Não renomear sem pedido.**
- Manter aparências originais desses três personagens após a fase de troca de nomes; novos nomes não implicam personagens novos.
- 3 vidas, 3 pontos de HP, três níveis por tipo de arma, power-ups, score, combos, continues limitados, checkpoints, Normal/Difícil, saves entre fases.
- Cinco biomas/etapas: Cinturão de Ferrugem, Mar de Vidro, Catedrais Vivas, Nuvem de Íons e Coração da MALHA.
- Defesa de colônia inicialmente seguida de viagem entre mundos pelo rastro. Fases manuais e chefes originais, sem roguelite.
- **[PRIORIDADE MÁXIMA] Diretriz Oficial de UI, HUD em 3 Zonas e Seleção de Pilotos (docs/24_DIRETRIZ_UI_HUD_MENUS.md):**
  - HUD dividido em Zona A (Topo), Zona B (Gameplay 100% limpo) e Zona C (Base).
  - Inimigos comuns sem barras de HP individuais; Chefes com barra principal na Zona A.
  - Seleção de personagens centrada no piloto (espírito *Sonic Wings*) com portrait, callsign tático, especial e nave subordinada em perfil lateral.
  - Tipografia de 2 famílias: `Orbitron` (Display/Títulos) e `Chakra Petch` (Interface/HUD).
- **[PRIORIDADE MÁXIMA] Diretriz de Dificuldade e Balanceamento Arcade (docs/25_DIRETRIZ_DIFICULDADE_BALANCEAMENTO.md):**
  - Gameplay reformulado para evitar facilidade excessiva e estratégias triviais de ficar parado atirando.
  - Inimigos com múltiplos comportamentos: Scouts (esquadrões ágeis), Darts (mergulho rasante), Lancers (disparo em leque triplo de contenção), Cutters (investida horizontal veloz) e Swarms (salvas sincronizadas).
  - Progressão contínua sem vácuos de combate, anti-camping e telegrafia justa.
  - Duelos contra chefes balanceados e estratégicos com transições de fases e vulnerabilidade em pontos fracos críticos.
- **[PRIORIDADE MÁXIMA] Diretriz Oficial de Controles, Disparos e Armas Carregáveis (docs/26_DIRETRIZ_CONTROLES_E_DISPAROS.md):**
  - Correção definitiva do bug do mouse no PC: clique do mouse nunca afeta posição, velocidade ou vetor da nave.
  - Camada de entrada unificada (`InputManager` / `processInputFrame`): mapeamento semântico desacoplado do hardware físico.
  - Três modalidades de disparo integradas:
    1. *Auto-Fire:* Pressionamento sustentado de Espaço ou Clique Esquerdo na cadência base da nave.
    2. *Tapping / Burst Manual:* Cliques manuais rápidos aumentam a cadência em ~28%, gerando calor acumulado e risco de sobreaquecimento temporário (`MAX_HEAT = 100`, bloqueio de 650ms).
    3. *Armas Carregáveis (Wave Cannon):* Segurar Shift ou Botão Direito carrega energia até Carga Máxima (>=1100ms), liberando disparos de alto impacto com identidades de classe: Nolan (Feixe Penetrante), Cora (Leque de Agulhas + Ventilação de Calor 100%), Harlan (Mega-Canhão Cinético de 12.0 de dano).
  - Desativação do menu de contexto nativo no canvas do jogo para viabilizar clique direito fluido.
  - Bateria de testes automatizados dedicados cobrindo os cenários A a G (`tests/controls_firing.test.mjs`).

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
