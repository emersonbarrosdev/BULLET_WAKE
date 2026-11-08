# BULLET WAKE — DIRETRIZ OFICIAL: CONTROLES, DISPARO E ARMAS CARREGÁVEIS

> [!IMPORTANT]
> **REGRA FUNDAMENTAL PERMANENTE — PRIORIDADE MÁXIMA**
> 1. **Correção do Bug do Mouse:** No Desktop PC, o clique do mouse (esquerdo ou direito) NUNCA altera a velocidade, o deslocamento (`moveX`, `moveY`) ou as coordenadas da nave. WASD e as Setas do teclado são os únicos responsáveis pela movimentação no PC.
> 2. **Desacoplamento de Input:** Todas as entradas físicas são unificadas via `InputManager` (`src/game/systems/inputSystem.ts`), convertendo hardware em comandos conceituais puros.
> 3. **Unificação de Disparo:** Espaço e Botão Esquerdo do Mouse acionam o mesmo disparo principal. Pressioná-los simultaneamente NÃO duplica projéteis nem dobra a taxa de tiro.
> 4. **Três Modalidades de Disparo:**
>    - *Modalidade 1 (Auto-Fire):* Segurar Espaço ou Clique Esquerdo dispara em cadência constante base.
>    - *Modalidade 2 (Tapping / Burst):* Toques rápidos manuais aumentam a taxa de disparo em até ~28%, gerando calor acumulado balanceado por sobreaquecimento tático.
>    - *Modalidade 3 (Arma Carregável / Wave Cannon):* Segurar Shift ou Botão Direito do Mouse acumula energia até 1.4s, liberando disparos especiais de alto impacto com identidade tática por piloto.
> 5. **Menu de Contexto:** `scene.input.mouse.disableContextMenu()` é obrigatório para navegação e controle de combate no navegador.

---

## 1. DIAGNÓSTICO E CORREÇÃO DO BUG DO MOUSE

### Causa Raiz Identificada
No código legada de prototipagem, a verificação `pointer.isDown` tratava cliques do mouse de desktop como toques de tela móvel (`finger = pointer.isDown && ...`), computando `dx = Math.sign(pointer.x - ship.x)`. Como o ponteiro do mouse ficava à frente da nave visando inimigos, clicar para atirar forçava `dx = 1`, arremessando a nave para frente de forma indevida.

### Solução Arquitetural
A camada `InputManager` diferencia categoricamente Desktop de Mobile Touch:
- Em ambiente desktop (`game.device.os.desktop && !pointer.wasTouch`), coordenadas do ponteiro são puramente de mira ou acionamento de disparo, tendo peso zero sobre `moveX` e `moveY`.
- Apenas eventos explicitamente originados por touch (`wasTouch` verdadeiro no mobile) podem exercer arraste direcional dentro da arena.

---

## 2. AS TRÊS MODALIDADES DE DISPARO

### Modalidade 1: Disparo Automático Contínuo (Auto-Fire)
- **Acionamento:** Manter pressionado `ESPAÇO` ou `BOTÃO ESQUERDO DO MOUSE`.
- **Comportamento:** Primeiro projétil emitido no instante zero (sem latência de início); disparos subsequentes respeitam o intervalo de cadência base de cada caça.
- **Cadência:**
  - Nolan (Rivet V3): 125ms (~8 tiros/s).
  - Cora (Moth V2): 147ms (~6.8 tiros/s).
  - Harlan (Knuckle V2): 200ms (5 tiros/s).
- **Equilíbrio:** Gera aquecimento moderado, sustentável em rajadas táticas sem sobreaquecer precocemente.

### Modalidade 2: Disparo Manual Controlado (Tapping / Burst)
- **Acionamento:** Cliques manuais repetidos em alta frequência (`firePrimaryTap`).
- **Comportamento:** Permite cadência acelerada (~28% mais veloz que auto-fire):
  - Nolan: 90ms (~11.1 tiros/s).
  - Cora: 105ms (~9.5 tiros/s).
  - Harlan: 145ms (~6.9 tiros/s).
- **Sistema de Calor e Recuperação Tática:**
  - Cada tiro adiciona calor (`heat`) de 0 a 100 (`MAX_HEAT = 100`).
  - Nolan: +8 calor/tiro; resfriamento 42/s.
  - Cora: +6 calor/tiro; resfriamento 52/s (melhor dissipação do esquadrão).
  - Harlan: +14 calor/tiro; resfriamento 36/s (canhão pesado gera maior atrito térmico).
  - Se `heat >= 100`, a arma entra em `isOverheated`: bloqueio temporário de 650ms, alerta na HUD ("VENT!") e resfriamento forçado.
  - Recompensa disciplina e ritmo arcade em vez de spam desenfreado.

### Modalidade 3: Armas Carregáveis (Wave Cannon)
- **Acionamento:** Manter pressionado `SHIFT` ou `BOTÃO DIREITO DO MOUSE`.
- **Comportamento:**
  - Enquanto carrega, disparos normais são contidos e a energia é acumulada (`chargeMs` até 1400ms).
  - Feedback audiovisual: zunido harmônico progressivo via Web Audio API e medidor `CARGA` dinâmico na Zona C do HUD.
  - Limiares de carga:
    - `< 400ms`: Incompleto (sem disparo carregado).
    - `400ms a 1100ms`: Carga Nível 1.
    - `>= 1100ms`: Carga Nível 2 (Carga Máxima).

---

## 3. IDENTIDADE DAS ARMAS CARREGÁVEIS POR PILOTO

| Piloto | Caça | Carga Nível 1 | Carga Nível 2 (Máxima) | Habilidade Especial |
|---|---|---|---|---|
| **Nolan** | Rivet V3 | *Lança de Plasma Penetrante* (Dano 4.8, Vel 720, Piercing) | *Mega Feixe Prismático* (Dano 8.5, Vel 880, Raio 22px, Atravessa inimigos) | Pulso militar concentrado de alta precisão |
| **Cora** | Moth V2 | *Trio de Agulhas Perfurantes* (Dano 3.2 cada, Ângulos abertos) | *Sobrecarga de Agulhas (5 Vias)* (Dano 4.2 a 5.2 cada, Raque amplo) | **Ventilação Instantânea:** Zera 100% do calor acumulado ao disparar Carga Máxima |
| **Harlan** | Knuckle V2 | *Projétil Cinético Pesado* (Dano 6.5, Raio 20px, Concussão) | *Mega-Canhão de Sobrecarga Cinética* (Dano 12.0, Raio 30px, Escala 3.0) | Maior dano bruto do jogo, pulveriza armaduras pesadas |

---

## 4. INTEGRAÇÃO COM A ARQUITETURA DE 3 ZONAS DO HUD

- **Zona A (Topo):** Inalterada (Score, Combo, HP, Vidas, FPS).
- **Zona B (Centro):** 100% desobstruída (área de combate pura).
- **Zona C (Base):**
  - Adicionado medidor térmico compacto: barra de `CALOR` (44px) com alerta visual dinâmico (`VENT!` em vermelho se sobreaquecido).
  - Adicionado indicador de carga do Wave Cannon: exibido exclusivamente quando `chargeMs > 0` (`CARGA [====] LV1 / MAX!`), sumindo imediatamente após o disparo para manter o minimalismo arcade.

---

## 5. COBERTURA DE TESTES AUTOMATIZADOS (Testes A a G)

Arquivo de testes dedicado: `tests/controls_firing.test.mjs`

- **Teste A:** Disparo com Tecla ESPAÇO no PC (sem alteração de coordenadas da nave).
- **Teste B:** Disparo com Clique Esquerdo no PC (ausência completa de impulso para frente; coordenadas estáveis).
- **Teste C:** Disparo com Mouse durante movimentação pelo Teclado (respeita vetor WASD puro).
- **Teste D:** Entradas simultâneas (Espaço + Clique tratadas como intenção única; taxa normal).
- **Teste E:** Cadência, Tapping manual acelerado e acumulação/dissipação térmica.
- **Teste F:** Armas carregáveis, limiares de ativação e especificidades dos 3 pilotos.
- **Teste G:** Estabilidade sob alta frequência (10.000 iterações em < 10ms, sem vazamento).

