# 25 — Diretriz Importante: Reformulação da Dificuldade e Balanceamento

> **Atualização 09/11/2026:** Os números e modos abaixo são históricos. A diretriz vigente é [Fase 1 — Normal e Fire Shark](30_FASE1_NORMAL_FIRE_SHARK.md). Ajustar apenas Normal nesta etapa; Fácil, Difícil e Real ficam planejados. Bandos rápidos e frágeis não atiram. Real terá uma vida e letalidade por ataque, com avarias e reparos possíveis; não está implementado.


> [!IMPORTANT]
> **DIRETRIZ PERMANENTE DE ALTA PRIORIDADE DO BULLET WAKE**
> O gameplay anterior estava fácil demais e foi reformulado para proporcionar uma experiência de shoot 'em up arcade desafiadora, intensa, recompensadora e justa desde os primeiros segundos.
> Esta diretriz complementa as decisões de arte Neo-Arcade HD 2D, HUD em 3 Zonas, tipografia estrita, naves em perfil lateral e áudio procedural, preservando integralmente a integridade da Bíblia.

---

## 1. Filosofia de Combate Arcade

O jogador de **BULLET WAKE** deve sentir:
1. **Desafio imediato:** O combate começa nos primeiros segundos, exigindo movimentação e leitura de tela sem tempos mortos.
2. **Movimentação dinâmica e anti-camping:** É estritamente proibido haver posições seguras onde o jogador possa ficar parado atirando sem ser ameaçado.
3. **Geometria de projéteis e padrões táticos:** A dificuldade nasce da geometria dos disparos (tiros mirados, leques em cone, cortes de rota) e da composição de esquadrões (unidades ágeis combinadas com unidades resistentes).
4. **Curva progressiva contínua:** A intensidade evolui organicamente pelos 4 setores da fase até o clímax no chefe final.
5. **Recompensa pelo domínio:** Aprender a antecipar o *telegraph* dos inimigos e utilizar upgrades, mísseis, especiais e bombas com timing preciso.

---

## 2. O que é Proibido (Anti-Dificuldade Artificial)

- ❌ Aumentar o HP dos inimigos indefinidamente transformando-os em esponjas de balas (*bullet sponges*).
- ❌ Projéteis imperceptíveis ou camuflados pelo fundo/efeitos.
- ❌ Inimigos surgindo instantaneamente sobre a nave do jogador (*cheap spawns*).
- ❌ Ataques impossíveis de evitar sem rotas de fuga legíveis.
- ❌ Reduzir artificialmente a velocidade ou capacidade de manobra do caça do jogador.
- ❌ Alterações ocultas ou dinâmicas que sabotam a precisão da micro-hitbox (5px).

---

## 3. Catálogo de Inimigos e Novos Comportamentos

Em conformidade com `docs/06_INIMIGOS.md`:

| Inimigo | Classe | Comportamento Principal | Padrão Balístico / Ataque | Telegraph |
|---|---|---|---|---|
| **Scout** | Drone Leve | Entrada em esquadrões (V, onda, pinça), manobra de evasão | Tiro direcionado rápido (230 px/s) | Sensor frontal pisca vermelho (420ms) |
| **Dart** | Drone de Rasante | Mergulho diagonal veloz cortando o espaço aéreo do jogador | Tiro de interceptação em ângulo agudo | Alinhamento e aceleração direcional |
| **Swarm** | Enxame Ágil | Incursões em fila rápida ou duplas sincronizadas | Micro-salvas duplas coordenadas | Flash sutil de motor |
| **Lancer** | Interceptador | Acompanha a altitude do jogador de forma responsiva | **Disparo em Leque Triplo (Fan Spread -18°, 0°, +18°)** | Carga energética de canhão (650ms) |
| **Cutter** | Interceptador | Rastreamento horizontal de choque e investida veloz | Investida frontal agressiva (290 px/s) com recuo | Sensor de choque aceso com faíscas |

---

## 4. Curva de Dificuldade dos Setores da Fase

### Setor 1: Evacuação (0m – 1000m)
- Entrada rápida do primeiro esquadrão de Scouts aos 60px (primeiros 1.5s).
- Introdução de Darts em mergulho para exigir movimentação vertical imediata.
- Primeiro Lancer com disparo em leque de 3 vias para ensinar a leitura das aberturas seguras.

### Setor 2: Destroços (1000m – 2100m)
- Formações mistas: Lancers fornecendo fogo de cobertura enquanto Scouts e Darts realizam pinças.
- Introdução de Cutters que atacam em rasante forçando mudança repentina de rota.
- Coleta de upgrades de arma (LV2) torna-se essencial para limpar formações antes que ocupem o espaço aéreo.

### Setor 3: Indústria (2100m – 3200m)
- Salvas coordenadas e maior densidade geométrica de balas.
- Formações duplas de Lancers alternando tempos de recarga, exigindo manobras em oito e uso estratégico de mísseis secundários.

### Setor 4: Aproximação do Chefe (3200m – 4250m)
- Pressão tática controlada com esquadrões pesados preparando o jogador para a batalha principal.
- Teste de domínio dos controles antes da transição da arena do chefe.

---

## 5. Duelo com Chefes (Exemplo: KRM-17 Excavator)

- **HP Total:** 140 pontos (duelo balanceado de ~35-45 segundos).
- **Fase 1 (Torres Superior e Inferior):**
  - Torres disparam salvas intercaladas com cadência de 1.1s.
  - Destruir uma das torres alivia a metade correspondente da tela, recompensando foco de dano.
- **Fase 2 (Broca de Mineração):**
  - Investida da broca telegrafada com leque de 5 vias de fragmentos de aço e lançamento de 2 drones de apoio.
- **Fase 3 (Núcleo de Sobrecarga):**
  - Pulso em anel de 10 direções com lacunas de esquiva angulares calculadas.
  - Ponto fraco crítico no núcleo recebe **1.45x de dano**, premiando jogadores que arriscam tiros frontais precisos.

---

## 6. Balanceamento de Recursos e Upgrades

- **Armas Primárias:** LV1 (fogo focado), LV2 (tiro duplo paralelo), LV3 (tiro triplo em leque de alta cobertura).
- **Ressonância:** Acúmulo de +4% a +8% por abate; ativação do Especial exige 100% e deve ser reservada para momentos de pico ou fases críticas dos chefes.
- **Bombas:** 2 bombas iniciais (máximo 3). Limpam projéteis e dão alívio imediato, causando dano de 14 nos chefes (não trivializam a luta).
- **Escudo Defensivo:** Absorve exatamente 1 impacto direto, preservando a vida da nave.

---

## 7. Métricas de Validação e Testes Obrigatórios

Todo ajuste de balanceamento deve ser validado por:
1. `tests/difficulty.test.mjs`:
   - Simulação de jogador imóvel demonstrando que a inação resulta em dano rápido.
   - Verificação da presença de leques angulares e múltiplos tipos de tiros.
   - Análise de cadência e cobertura dos 4 setores sem vácuos de gameplay.
   - Simulação de resiliência e fases do chefe KRM-17.
2. Performance estável mantendo 60 FPS no Chrome headless com 0 vazamentos de memória e 0 erros de textura.

