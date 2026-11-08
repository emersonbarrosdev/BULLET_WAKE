# IMPORTANTE — BULLET WAKE V2: IDENTIDADE, CAMPANHA E GAMEPLAY DEFINITIVOS

> [!IMPORTANT]
> **DIRETRIZ CANÔNICA PERMANENTE — BULLET WAKE V2 (PRIORIDADE MÁXIMA)**
> Esta seção substitui todas as definições conflitantes anteriores e consolida a identidade definitiva do jogo.
>
> 1. **Gênero e Orientação:** Shoot 'em up 2D de visão superior (TOP-DOWN) com rolagem vertical estrita. A visão lateral foi totalmente revogada.
> 2. **Tema Estrito:** Invasão extraterrestre à Terra. Combate exclusivo contra frotas alienígenas, monstros voadores, organismos biomecânicos e entidades colossais. É proibido combate contra tanques ou forças militares humanas terrestres convencionais.
> 3. **Controles Oficiais no PC:**
>    - `WASD` ou `Setas`: Movimentação da nave (diagonais normalizadas).
>    - `ESPAÇO`: Disparo principal (contínuo segurando, manual tapando).
>    - `SHIFT Esquerdo`: Dash / Propulsão de emergência (exatamente 3 por fase).
>    - `C`: Carregar arma (Wave Cannon / Carga quando aplicável).
>    - `X`: Bomba defensiva.
>    - `V`: Especial de ressonância do piloto.
>    - `ESC`: Pausa / Menu.
>    - **MOUSE NÃO ATIRA NO PC:** Cliques do mouse (esquerdo ou direito) e movimento do ponteiro são 100% desvinculados do voo durante o gameplay. O mouse serve unicamente para menus e interfaces.
> 4. **Mecânica Oficial do Dash:** Exatamente **3 DASHES POR FASE** (`DASH: ◆ ◆ ◆`). Sem recarga temporal, sem recarga por abate, sem power-up de dash e sem recuperação ao morrer dentro da fase. Restauração exclusiva ao reiniciar a fase do zero ou iniciar nova fase.
> 5. **Sistema de Armas (Estilo Fire Shark):** Três famílias com identidade visual e evolução real (Níveis 1 a 4):
>    - **Pulso Verde:** Ampla cobertura em leque (frontal duplo -> 3 vias -> 5 vias -> 7 vias).
>    - **Laser de Íons:** Feixe ciano concentrado de alta penetração em blindagens pesadas.
>    - **Plasma Vermelho:** Orbes pesados com impacto térmico concussivo e dano em área.
> 6. **Coletáveis Físicos no Campo:** Portadores alienígenas (ex: Casulos Marinhos) soltam cápsulas físicas no campo:
>    - `P` (Power): Evolui a arma atual de 1 a 4.
>    - `W` (Weapon): Cápsula de troca (Verde, Ciano, Vermelho).
>    - `H` (Health): Recupera blindagem.
>    - `B` (Bomb): Recupera bomba.
>    - `M` (Missile): Reabastece mísseis.
>    - `S` (Score): Pontuação e multiplicadores.
>    - `E` (Special Energy): Recupera energia de especial.
>    - *Nenhum coletável recupera dash.*
> 7. **Primeira Fase Oficial (Escopo Atual):** `STAGE_01_PELAGIC` — **FENDA PELÁGICA** (Oceano terrestre sob invasão biológica alienígena). Miniboss: *Raia-Dente*. Boss Colossal: *Talassarca — O Devorador das Marés* (3 fases completas).
> 8. **Campanha Completa Documentada:** 15 fases principais (1 a 3 selecionáveis; 4 a 15 sequenciais; 3 chefes finais na fase 15: Thalor, Morhiza e Prisma Órfão) + 2 Finais Secretos (Fase 16: Abismo Subterrâneo; Fase 17: Lua: Origem da Colmeia — Matriz Primordial). Somente a Fase 1 é implementada nesta versão.
> 9. **Arquitetura de HUD:** Widescreen com corredor central de combate vertical (384px de largura) e painéis laterais de telemetria (192px cada), separando completamente as informações vitais do campo de tiro.
> 10. **Tipografia Estrita:** Máximo de duas famílias legítimas carregadas:
>     - **Oxanium** (600, 700, 800): Títulos, cabeçalhos, destaques, chefes e alertas.
>     - **Rajdhani** (500, 600, 700): Menus, botões, labels, HUD e telemetria.

---

## 1. CAMPANHA OFICIAL: AS 15 FASES E FINAIS SECRETOS

### Fases 1 a 3 — Regiões Iniciais Selecionáveis
1. **Fase 01 — Fenda Pelágica (Oceano Terrestre):**
   - *Ambiente:* Oceano profundo, recifes submarinos alienígenas e abismo bioluminescente.
   - *Inimigos:* Agulha Pelágica, Raia de Fenda, Parasita Abissal, Casulo Marinho.
   - *Miniboss:* Raia-Dente (grande criatura biomecânica alada com disparos em arco).
   - *Boss Colossal:* **TALASSARCA — O DEVORADOR DAS MARÉS** (3 fases: asas com leques, tentáculos energéticos destrutíveis e núcleo exposto vulnerável a dano crítico).
2. **Fase 02 — Bosque da Névoa Viva (Floresta Tropical):**
   - *Ambiente:* Dossel vegetal denso infestado por esporos alienígenas luminosos.
   - *Inimigos:* Vespas de Ruptura, Polinizadores Negros, Mímicos de Folhagem, Tecelões.
   - *Miniboss:* Vespa-Quimera.
   - *Boss Colossal:* **ARBORION — O CORAÇÃO VEGETAL**.
3. **Fase 03 — Metrópole do Silêncio (Cidade Costeira Evacuada):**
   - *Ambiente:* Arranha-céus invadidos por monólitos cristalinos e tecnologia viva.
   - *Inimigos:* Prismas Caçadores, Olhos Sentinelas, Fragmentadores, Lâminas Orbitais.
   - *Miniboss:* Quimera Prisma.
   - *Boss Colossal:* **CATEDRAL DE VIDRO**.

### Fases 4 a 14 — Progressão Sequencial Planetária
4. **Fase 04 — Dunas de Silício:** Deserto cristalizado com tempestades de areia iônica. Chefe: *Sifão das Dunas*.
5. **Fase 05 — Cânion das Sombras:** Fendas tectônicas escarpadas e emboscadas rasantes. Chefe: *Mandíbula do Horizonte*.
6. **Fase 06 — Mar da Tempestade:** Oceano em fúria sob tempestade eletromagnética. Chefe: *Leviatã da Tormenta*.
7. **Fase 07 — Ruínas Vivas:** Estruturas antigas assimiladas por biomassa invasora. Chefe: *Arca Mnemônica*.
8. **Fase 08 — Cordilheira de Cristal:** Picos nevados repletos de agulhas glaciais alienígenas. Chefe: *Coroa de Geada*.
9. **Fase 09 — Arquipélago Vulcânico:** Caldeiras ativas com fluxo magmático luminescente. Chefe: *Coração Magmático*.
10. **Fase 10 — Mar de Nuvens:** Alta troposfera entre cumulonimbus colossais. Chefe: *Colmeia Cumulus*.
11. **Fase 11 — Olho da Estratosfera:** Fronteira orbital com auroras boreais alienígenas. Chefe: *Anel de Aurora*.
12. **Fase 12 — Curvatura da Terra:** Limite exterior da atmosfera terrestre. Chefe: *Véu Colossal*.
13. **Fase 13 — Órbita Fraturada:** Cinturão de satélites destruídos e armadilhas orbitais. Chefe: *Fornalha Sem Luz*.
14. **Fase 14 — Cemitério de Naves:** Destroços de frotas alienígenas e carcaças biomecânicas. Chefe: *Carcaça Primeva*.

### Fase 15 — Trono da Convergência (Chefe Variável por Região Inicial)
O chefe final da Fase 15 é determinado estritamente pela primeira região escolhida no início da campanha:
- **Começou pelo Oceano (Fase 1):** **THALOR — SOBERANO DAS PROFUNDEZAS** (entidade abissal colossal com tentáculos de plasma e órgãos bioelétricos).
- **Começou pela Floresta (Fase 2):** **MORHIZA — CONSCIÊNCIA DA COLMEIA** (entidade simbiótica orgânica ramificada com nuvens de esporos e núcleos alternados).
- **Começou pela Metrópole (Fase 3):** **PRISMA ÓRFÃO — ARQUITETO DA RUPTURA** (estrutura geométrica colossal de cristal vivo com feixes hiper-focados).

### Finais Secretos — Fases 16 e 17
A ordem completa de conclusão das três regiões iniciais determina a rota da transmissão desconhecida:
- **Rotas Secretas A-B-C e B-C-A:** Desbloqueiam as Fases 16 e 17 (Final Verdadeiro).
- **Rotas A-C-B e C-A-B:** Desbloqueiam a Fase 16 (Final Subterrâneo).
- **Rotas B-A-C e C-B-A:** Encerram no Final Principal padrão.

* **Fase 16 — Abismo Subterrâneo:** Túneis nas profundezas da crosta terrestre onde a raiz da invasão se instalou. Chefe: *Coração Telúrico*.
* **Fase 17 — Lua: Origem da Colmeia:** Complexo alienígena na superfície lunar. Chefe Final Verdadeiro: **MATRIZ PRIMORDIAL — A ORIGEM DO ENXAME** (entidade suprema em 4 fases devastadoras).

---

## 2. REGRAS DE GAMEPLAY DA FASE 1: FENDA PELÁGICA

### 2.1. O Novo Dash (Propulsão de Emergência)
- **Cargas Iniciais:** Exatamente 3 cargas por tentativa (`remainingDashes = 3`).
- **Comando:** Tecla `SHIFT` esquerdo no PC ou botão de Dash no Gamepad/Mobile.
- **Vetor:** Segue a direção do movimento atual da nave. Se a nave estiver parada, projeta para a frente (+Y).
- **Velocidade e Tempo:** Multiplicador de velocidade de ~2.8x durante 160ms.
- **Janela de Evasão:** Invulnerabilidade a projéteis inimigos por 130ms. Não atravessa as bordas laterais do campo de combate.
- **Rastro Visual:** Rastro translúcido ciano com partículas de plasma.
- **Regra de Não-Recarga:** Cargas **NUNCA** se regeneram por tempo, morte de inimigos ou power-ups. Apenas o reinício completo da fase restaura as 3 cargas.

### 2.2. As 3 Famílias de Armamentos e Coletáveis
- **Pulso Verde (Green Pulse):** Arma equilibrada de cobertura.
  - *LV1:* 2 projéteis paralelos frontais.
  - *LV2:* 3 projéteis em leque suave (-10°, 0°, +10°).
  - *LV3:* 5 projéteis em leque amplo (-20°, -10°, 0°, +10°, +20°).
  - *LV4:* 7 projéteis de dispersão cobrindo o campo com alta cadência.
- **Laser de Íons (Ion Laser):** Feixe concentrado ciano para alvos pesados.
  - *LV1:* Feixe estreito frontal de perfuração contínua.
  - *LV2:* Feixe duplo alargado com partículas iônicas.
  - *LV3:* Feixe central pesado + 2 agulhas laterais de foco.
  - *LV4:* Coluna iônica devastadora de dano focal massivo.
- **Plasma Vermelho (Red Plasma):** Disparo pesado concussivo e controle de área.
  - *LV1:* Orbe único pesado com pequena detonação no impacto.
  - *LV2:* Orbes duplos com onda de choque de 25px.
  - *LV3:* Disparo triplo frontal com dano térmico prolongado.
  - *LV4:* Canhão devastador quádruplo com raio explosivo de 45px.
- **Sistema de Coletáveis (Fire Shark):**
  - Casulos e transportadores deixam cair cápsulas físicas no cenário.
  - `P` (Power): Evolui nível de 1 a 4. No nível 4, concede 1.000 pontos.
  - `W` (Weapon): Alterna imediatamente a família de arma (Verde, Íon, Vermelho), mantendo o nível atual.
  - `H` (Vida), `B` (Bomba), `M` (Míssil), `S` (Score), `E` (Especial).
  - *Nenhum coletável concede dash.*

### 2.3. Inimigos da Fenda Pelágica
1. **Agulha Pelágica (Pelagic Needle):** Caça alienígena pequeno, esquadrões em V, mergulhos rápidos e rajadas frontais curtas.
2. **Raia de Fenda (Rift Ray):** Criatura biomecânica alada, movimentos sinusoidais suaves, leques laterais de 3 projéteis.
3. **Parasita Abissal (Abyssal Parasite):** Organismo alienígena luminescente, lança esporos ácidos lentos que cobrem corredores.
4. **Casulo Marinho (Sea Cocoon):** Portador blindado de alta resistência. Ao ser destruído, eclode liberando drones ou cápsulas de power-up.

### 2.4. Miniboss e Boss Colossal
- **Miniboss (Raia-Dente):** Emerge no meio da fase; alterna salvas de asas, arcos de projéteis com aberturas de esquiva e investidas laterais. Possui barra de HP dedicada no topo do HUD.
- **Boss Colossal (Talassarca — O Devorador das Marés):**
  - *Fase 1 (Asas e Pincers):* 140 HP. Salvas intercaladas das extensões laterais e leques quíntuplos.
  - *Fase 2 (Tentáculos e Brocas):* Emissão de tentáculos bioelétricos e disparo focado telegrafado; destruição das partes laterais.
  - *Fase 3 (Núcleo Vulnerável):* O núcleo central abre-se e emite anéis com corredores seguros de passagem. Recebe 1.5x de dano crítico. Derrota cinematográfica em cadeia de explosões.

---

## 3. IDENTIDADE VISUAL E TIPOGRAFIA DEFINITIVA

### Arquitetura Widescreen TATE / Arcade Bezel
- Resolução lógica: 768 × 432 pixels.
- **Painel Esquerdo (X: 0 a 192):** Telemetria do Piloto (retrato, callsign, blindagem/HP, vidas, pontuação, multiplicador de combo e os 3 indicadores do Dash `◆ ◆ ◆`).
- **Campo de Combate Central (X: 192 a 576, Y: 0 a 432):** 384 pixels de largura vertical desobstruída para manobras, naves, projéteis e coletáveis.
- **Painel Direito (X: 576 a 768):** Telemetria de Armamento (Arma ativa, Nível 1 a 4, Bombas `[X]`, Especial `[V]`, Mísseis, Radar de Fase e Barra de Vida do Chefe).

### Tipografia
- **Família Display / Títulos:** `Oxanium` (Google Fonts: 600, 700, 800).
- **Família Interface / Menus / HUD:** `Rajdhani` (Google Fonts: 500, 600, 700).

