# 24 — Diretriz Oficial de UI, HUD, Menus e Seleção de Pilotos

> [!IMPORTANT]
> **PRIORIDADE MÁXIMA DE INTERFACE — REGRA PERMANENTE DA BÍBLIA**  
> Esta diretriz define a arquitetura oficial, hierarquia visual e organização de informações para todas as telas, HUD de combate, menus e fluxos de seleção do BULLET WAKE. Todas as decisões de gameplay, performance (60+ FPS), progressão e identidade artística consolidada permanecem preservadas.

---

## 1. Conclusões da Pesquisa de Shmups Clássicos e Modernos

Com base na análise de obras de referência do gênero:

1. **Sonic Wings / Aero Fighters (Video System):**
   - A tela de seleção dá destaque total aos **pilotos como operadores humanos**, exibindo portraits expressivos, callsigns táticos e estilos individuais. A nave é apresentada como instrumento subordinado ao piloto.
   - O jogador escolhe o personagem pela sua personalidade, função tática e especial característico.

2. **Raiden (Seibu Kaihatsu):**
   - O HUD opera exclusivamente nas bordas superior e inferior, com integração periférica limpa.
   - O campo de combate permanece 100% livre para leitura milimétrica de tiros e desvios.

3. **R-Type (Irem):**
   - Tradição do shoot 'em up horizontal: o rodapé abriga a carga do tiro especial e recursos, enquanto o topo ancora a pontuação e integridade.
   - Chefes exibem sua vitalidade fora da rota dos projéteis para não causar mortes injustas.

4. **Crimzon Clover & Jamestown:**
   - Shmups modernos mantêm mensagens breves (< 800ms) com transparência e transições sutis, proibindo blocos estáticos no meio do campo de mira.

---

## 2. Arquitetura Oficial do HUD em Três Zonas

```
+-----------------------------------------------------------------------------+
| [ZONA A - HUD SUPERIOR]                                                     |
| SCORE: 0148200 (x2.4)   |   SETOR 01: CINTURÃO / BOSS HP   |  HP: ■■■  VIDAS: 3 |
+-----------------------------------------------------------------------------+
|                                                                             |
|                                                                             |
|                           [ZONA B - CAMPO DE JOGO]                          |
|             Área 100% limpa: apenas caça, inimigos, tiros e pickups         |
|                     Zero poluição de textos persistentes                    |
|                                                                             |
|                                                                             |
+-----------------------------------------------------------------------------+
| [ZONA C - HUD INFERIOR]                                                     |
| ARMA: PULSO LV.2 (••◦)  |   RESSONÂNCIA: [■■■■■■■■□□] 80%   |  BOMBAS: 2  MÍSSIL: OK |
+-----------------------------------------------------------------------------+
```

### 2.1. ZONA A — TOPO (HUD Superior, 28px de altura)
- **Extremo Esquerdo:** Pontuação atual (`SCORE`) e multiplicador de combo (`x1.0` a `x4.0`).
- **Centro:** Identificação de progresso da fase (`FASE 01 // CINTURÃO`) ou **Barra de Vida de Chefe** com nome do alvo quando ativo.
- **Extremo Direito:** Indicador de integridade da blindagem (3 blocos de HP) e vidas restantes (`VIDAS × 03`).
- **FPS:** Medidor discreto de taxa de quadros (30 a 240 FPS).

### 2.2. ZONA B — CENTRO (Área de Combate Ativo)
- Reservado **estritamente para a ação**: nave do jogador, inimigos, disparos, pickups e efeitos visuais.
- **Proibido:** Textos longos persistentes, caixas soltas de diálogo no campo de mira, telemetria irrelevante ou sobreposição de dados.
- **Mensagens Rápidas:** Alertas como `BOMBA DETONADA!` ou `UPGRADE!` duram menos de 800ms e possuem transparência.

### 2.3. ZONA C — BASE (HUD Inferior, 28px de altura)
- **Extremo Esquerdo:** Arma principal ativa e nível atual (`LV1`, `LV2`, `LV3`).
- **Centro:** Medidor de Ressonância (0% a 100%) com aviso visual `[ESPECIAL PRONTO]` ao atingir carga total.
- **Extremo Direito:** Estoque de bombas disponíveis (`BOMBAS: 02`) e status de prontidão da arma secundária/mísseis.

---

## 3. Diretriz Oficial de Vida dos Inimigos

1. **Inimigos Comuns (Scouts, Lancers, patrulhas leves):**
   - **NÃO possuem barras de vida flutuantes.**
   - O feedback de dano é transmitido exclusivamente por:
     - Flash de impacto luminoso (*hit flash*);
     - Faíscas e partículas metálicas;
     - Fumaça e peças se desprendendo em dano crítico;
     - Explosão final com destruição da carcaça.

2. **Chefes de Fase:**
   - Barra de vida larga ancorada na **Zona A (HUD Superior)**.
   - Exibição de nome oficial do chefe e indicação clara de fase/módulos destrutíveis.
   - Fora do fluxo de tiros para garantir máxima visibilidade durante desvios de projéteis.

---

## 4. Diretriz Oficial de Seleção de Pilotos (Espírito Sonic Wings)

A seleção do BULLET WAKE é uma **seleção de pilotos operacionais**, não um mero catálogo de veículos.

### 4.1. Hierarquia de Apresentação
1. **Piloto em Destaque:** Retrato expressivo em pixel art militar (*portrait* 48x48 escalonado) em vista lateral ou 3/4.
2. **Identidade Tática:** Nome completo e **Callsign Tático Operacional**.
3. **Especial Principal:** Nome do ataque de ressonância e resumo de sua função estratégica.
4. **Aeronave Subordinada:** Nome da nave e silhueta em perfil lateral.
5. **Estatísticas:** Velocidade, cadência e potência comparativas.

### 4.2. Os Três Operadores Oficiais
- **Nolan Fitch** — Callsign: `CORRIDOR VANGUARD`
  - Perfil: Especialista em fogo sustentado e proteção de evacuação.
  - Especial: *Tempestade Prismática* | Nave: *Rivet V3*.
- **Cora Wren** — Callsign: `WAKE WEAVER`
  - Perfil: Navegadora de alta velocidade e leitura de anomalias quânticas.
  - Especial: *Salto Fantasma* | Nave: *Moth V2*.
- **Harlan Greer** — Callsign: `IRON BULWARK`
  - Perfil: Veterano calmo com domínio de blindagens pesadas e hardware industrial.
  - Especial: *Ruptura Nova* | Nave: *Knuckle V2*.

---

## 5. Tipografia Oficial — Sistema de Duas Famílias

| Função | Família Tipográfica | Características | Exemplos de Uso |
|---|---|---|---|
| **Família A: Display & Títulos** | **`Orbitron`** | Sci-fi, geométrica, forte e memorável | Logo BULLET WAKE, nomes de fases, títulos de menus, callsigns |
| **Família B: Interface & Dados** | **`Chakra Petch`** | Condensada, extrema legibilidade, números claros | HUD (score, HP, armas), botões, estatísticas, alertas, telas mobile |

---

## 6. Telas de Menus e Operação Militar

- Estética inspirada em terminais militares de inteligência de combate espacial.
- **Ação Principal Evidente:** Botões primários (`INICIAR OPERAÇÃO`) possuem iluminação ciano neon pulsante, bordas reforçadas e tamanho proeminente.
- Estados de interface explícitos: `Normal`, `Hover / Foco`, `Selecionado`, `Bloqueado`.
- Suporte imediato para controles de teclado (`Enter`, `Espaço`, `Setas`, `WASD`, `ESC`) e toque móvel responsivo.
