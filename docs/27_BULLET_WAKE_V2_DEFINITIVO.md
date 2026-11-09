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
> 5. **Sistema de Armas (Estilo Fire Shark — Separação Canônica):** Três famílias com identidade visual e mecânica distinta, evoluindo independentemente dos Níveis 1 a 4:
>    - **Dispersão Azul (`ion` — ARMA INICIAL CANÔNICA):** O jogador inicia sempre equipado com Dispersão Azul Nível 1 (`0/3 P`). Disparos direcionais em leque amplo que cobrem mais direções conforme o nível sobe (3 -> 5 -> 7 -> 9 direções).
>    - **Energia Espiralada (`green`):** Feixes de energia verde concentrados e ondulantes (helicoidais/sinusoidais) que aumentam de quantidade e potência por nível (2 -> 3 -> 5 -> 7 ondas).
>    - **Laser Rubro (`red` — ARMAMENTO ENERGÉTICO CONTÍNUO DE MULTIFEIXES EVOLUTIVOS):** Fluxo contínuo de energia vermelha intensa emitido enquanto `ESPAÇO` estiver pressionado, multiplicando suas colunas e adicionando varredura lateral e cobertura diagonal/traseira nos níveis superiores (LV1: 1 fluxo frontal concentrado; LV2: 2 fluxos paralelos; LV3: 4 fluxos com 2 laterais oscilantes; LV4 — **Asas de Energia**: 6 fluxos com 2 frontais + 2 asas laterais de varredura ampla + 2 feixes diagonais traseiros `rear-wing`). **Proibido representar como bolas vermelhas ou projéteis discretos.**
> 6. **Sistema de Power-ups (`3 P` por Nível + Cápsulas de Cor Independentes):** Portadores alienígenas (ex: Casulos Marinhos) soltam cápsulas físicas no campo:
>    - `P` (Power): Aumenta a barra de poder (`MEDIDOR P: ■ □ □ [0/3]`). **Três itens `P` (`3 P`) aumentam 1 nível da arma atual** (`1 -> 2 -> 3 -> 4`). Item raro `P★` (`full_power`) eleva diretamente ao Nível 4.
>    - `W` (Weapon Capsule): Cápsulas coloridas separadas (`AZUL` = Dispersão Azul, `VERDE` = Energia Espiralada, `RUBRO` = Laser Rubro) que trocam imediatamente a arma equipada mantendo o nível (`1..4`) e o progresso do medidor `P` (`0..2`), sem exigir maximizar uma cor antes de coletar outra.
>    - `H` (Health): Recupera blindagem.
>    - `B` (Bomb): Recupera bomba.
>    - `M` (Missile): Reabastece mísseis.
>    - `S` (Score): Pontuação e multiplicadores.
>    - `E` (Special Energy): Recupera energia de especial.
>    - *Nenhum coletável recupera dash.*
> 7. **Primeira Fase Oficial (Escopo Atual):** `STAGE_01_PELAGIC` — **FENDA PELÁGICA** (Oceano terrestre sob invasão biológica alienígena). Miniboss: *Raia-Dente*. Boss Colossal: *Talassarca — O Devorador das Marés* (3 fases completas).
> 8. **Campanha Completa Documentada:** 15 fases principais (1 a 3 selecionáveis; 4 a 15 sequenciais; 3 chefes finais na fase 15: Thalor, Morhiza e Prisma Órfão) + 2 Finais Secretos (Fase 16: Abismo Subterrâneo; Fase 17: Lua: Origem da Colmeia — Matriz Primordial). Somente a Fase 1 é implementada nesta versão.
> 9. **Arquitetura de HUD:** Widescreen com corredor central de combate vertical (`432px` de largura, `X: 168..600`) e painéis laterais de telemetria (`168px` cada), separando completamente as informações vitais do campo de tiro.
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

### 2.2. As 3 Famílias de Armamentos e Sistema de Power-ups (Estilo Fire Shark)
- **Dispersão Azul (`ion` — Wide Shot / Arma Inicial Canônica):** O jogador inicia sempre equipado com Dispersão Azul Nível 1 (`0/3 P`). Disparos direcionais azul-safira/ciano em leque amplo cobrindo mais direções conforme o nível aumenta.
  - *LV1:* 3 direções em leque frontal.
  - *LV2:* 5 direções em leque aberto.
  - *LV3:* 7 direções em leque panorâmico.
  - *LV4:* 9 direções de cobertura total do corredor.
- **Energia Espiralada (`green` — Beam / Emerald Spiral):** Feixes de energia verde concentrados e ondulantes (helicoidais/sinusoidais) que sobem entrelaçados.
  - *LV1:* 2 ondas esmeralda entrelaçadas em contrafase.
  - *LV2:* 3 ondas esmeralda concentradas (eixo central + dupla hélice lateral).
  - *LV3:* 5 ondas esmeralda de alta densidade.
  - *LV4:* 7 ondas esmeralda sinusoidais de saturação concentrada.
- **Laser Rubro (`red` — ARMAMENTO ENERGÉTICO CONTÍNUO DE MULTIFEIXES EVOLUTIVOS):**
  - Inspirado diretamente no *Fire / Super Fire* do *Fire Shark* original (Toaplan), reinterpretado como **fluxos energéticos vermelhos contínuos** com núcleo luminoso incandescente, bordas de plasma animadas e impacto contínuo.
  - **Proibição Estrita:** Nunca representar como bolas vermelhas, projéteis discretos separados, explosões de fogo ou sprites estáticos.
  - *LV1 — Laser Rubro Inicial:* 1 fluxo frontal contínuo, fino e concentrado.
  - *LV2 — Laser Rubro Duplo:* 2 fluxos frontais paralelos contínuos próximos, com maior espessura energética e DPS.
  - *LV3 — Laser Rubro Expandido:* 4 fluxos contínuos (2 fluxos frontais principais + 2 fluxos laterais com movimento oscilante de varredura controlada).
  - *LV4 — Asas de Energia:* 6 fluxos contínuos sincronizados (2 fluxos centrais pesados + 2 asas laterais de varredura ampla + 2 feixes diagonais traseiros `rear-wing` que protegem flancos e retaguarda da aeronave).
- **Sistema de Coletáveis (`3 P` por Nível + Cápsulas de Cor Independentes):**
  - Casulos e transportadores deixam cair cápsulas físicas no cenário.
  - `P` (Power): Aumenta o Medidor `P` (`MEDIDOR P: ■ □ □ [1/3]`). **Três itens `P` (`3 P`) aumentam 1 nível da arma atual** (`1 -> 2 -> 3 -> 4`). Item raro `P★` (`full_power`) eleva diretamente ao Nível 4. No nível 4, itens `P` adicionais concedem bônus de pontuação (`+400 PTS`).
  - `W` (Cápsulas Coloridas): Cápsulas Azul (`Dispersão Azul`), Verde (`Energia Espiralada`) e Vermelha (`Laser Rubro`) alternam imediatamente o tipo da arma sem resetar o nível ou o medidor `P`, e sem exigir maximizar uma cor antes de coletar outra.
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
- **Painel Esquerdo (X: 0 a 168):** Telemetria do Piloto (retrato, callsign, blindagem/HP, vidas, pontuação, multiplicador de combo e os 3 indicadores do Dash `◆ ◆ ◆`).
- **Campo de Combate Central (X: 168 a 600, Y: 0 a 432):** 432 pixels de largura vertical desobstruída para manobras, naves, projéteis e coletáveis, com fundo oceânico abissal centralizado (`tilePositionX = 168`).
- **Painel Direito (X: 600 a 768):** Telemetria de Armamento (Arma ativa, Nível `NV 1/4..4/4`, Medidor `P [0/3..MAX]`, Bombas `[X]`, Especial `[V]`, Radar de Fase e Barra de Vida do Chefe).

### Tipografia
- **Família Display / Títulos:** `Oxanium` (Google Fonts: 600, 700, 800).
- **Família Interface / Menus / HUD:** `Rajdhani` (Google Fonts: 500, 600, 700).

---

## 4. DIRETRIZ DE CALIBRAÇÃO CRÍTICA DE GAMEPLAY E CENÁRIO (V2.1 — FENDA PELÁGICA)

### 4.1. Calibração de Ritmo e Controle Fino
- **Velocidade da Aeronave:** `PLAYER_SPEED_FACTOR = 1.0` (velocidade pura do piloto entre 190 e 215 px/s, garantindo leitura tática sem deslizamentos desenfreados).
- **Dash Tático:** Impulso controlado de `1.85x` de velocidade por 160ms (~56px de deslocamento por carga) com 130ms de invulnerabilidade. Impede que o caça atravesse o corredor de 384px instantaneamente.
- **Buffer de Blindagem e Escudo:**
  - A quebra do escudo de energia concede imediatamente `1200ms` de invulnerabilidade protetora, impedindo que múltiplos projéteis no mesmo frame destruam simultaneamente escudo e blindagem.
  - O dano na blindagem concede `1500ms` de invulnerabilidade com piscar visual da nave.

### 4.2. Telegrafia e Projéteis Inimigos
- **Velocidade de Inimigos:**
  - *Agulha Pelágica (Scout):* 105 px/s (mergulho suave e previsível). Aviso visual (telegraph): 500ms.
  - *Raia de Fenda (Dart):* 120 px/s (curvas em arco cadenciadas). Aviso visual: 550ms.
  - *Parasita Abissal (Lancer):* 85 px/s (posicionamento estratégico). Aviso visual do leque: 750ms.
  - *Casulo Marinho (Cutter):* 70 px/s (avanço pesado). Aviso visual da investida: 700ms.
- **Velocidade de Projéteis:** Calibrada entre 120 e 150 px/s (tempo de travessia do campo de ~3 segundos), permitindo esquiva deliberada e justa.

### 4.3. Progressão de Armamento e Nomes Canônicos
- **Início Obrigatório (Regra Canônica Fire Shark #1):** O jogador inicia equipado com **Wide Shot azul (`DISPERSÃO AZUL`, Nível 1, `powerMeter = 0`)**.
- **Independência entre Troca de Arma e Potência (Regras Canônicas Fire Shark #2, #3, #4 e #5):**
  - Cápsulas coloridas coletadas fisicamente alteram a arma equipada (Azul → `DISPERSÃO AZUL`, Verde → `ENERGIA ESPIRALADA`, Vermelha → `LASER RUBRO`).
  - **Não é necessário maximizar o azul para obter o verde, nem o verde para obter o vermelho.**
  - Cada item `P` coletado incrementa o Medidor `P` (`0/3 -> 1/3 -> 2/3 -> 3/3`). Três itens `P` aumentam 1 nível de potência, até 4 estados totais (`NV 1 -> NV 2 -> NV 3 -> NV 4`).
  - Troca de arma e evolução de potência são mecanismos independentes.
  - O item raro `P★` vermelho (`full_power`) eleva imediatamente a arma equipada para o Nível 4 máximo, sem alterar a família da arma e sem ser confundido com a cápsula vermelha de troca de arma (`weapon_red`).
- **Nomes Canônicos das 5 Regiões V2:**
  - Fase 01: Fenda Pelágica (Chefe: *Talassarca — O Devorador das Marés*)
  - Fase 02: Bosque da Névoa Viva (Chefe: *Arborion — O Coração Vegetal*)
  - Fase 03: Metrópole do Silêncio (Chefe: *Catedral de Vidro*)
  - Fase 04: Dunas de Silício (Chefe: *Sifão das Dunas*)
  - Fase 05: Cânion das Sombras (Chefe: *Mandíbula do Horizonte*)

### 4.4. Direção Visual do Oceano Alienígena (HD 2D)
- **Fundo Marinho:** Fenda tectônica escura com falhas hidrotermais bioluminescentes ciano/esmeralda e silhueta em trânsito de um leviatã marinho colossal.
- **Recifes Submersos:** Formações rochosas orgânicas com gradientes de profundidade, colônias de cianobactérias brilhantes e arcos biomecânicos ancestrais.
- **Superfície e Wake:** Malha de reflexos e cáusticas de luz solar submarina, ondulação suave e partículas de espuma marinha.
- **Rolagem Estável:** Sincronização direta de scroll `tilePositionY = -scrollPx * fator` que elimina qualquer aceleração descontrolada de cenário.

---

## 5. PROTOCOLO PERMANENTE DE BLOQUEIO DE QUALIDADE E VALIDAÇÃO REAL (P0)

> [!CAUTION]
> **IMPORTANTE — NENHUMA ENTREGA PODE SER DECLARADA CONCLUÍDA SE O JOGO NÃO INICIAR E SUAS FUNCIONALIDADES PRINCIPAIS NÃO TIVEREM SIDO VALIDADAS.**

### 5.1. Regra de Bloqueio de Qualidade (Quality Gate Obrigatório)
Nenhuma alteração estrutural ou visual pode ser considerada concluída sem cumprir integralmente os 8 critérios:
1. **TypeScript válido:** `npm run typecheck` com zero erros.
2. **Build funcional:** `npm run build` gerando artefatos limpos em `dist/`.
3. **Testes automatizados aplicáveis:** `npm test` com 100% de aprovação (125/125 na validação de 09/11/2026).
4. **Abertura da aplicação no navegador:** Verificação real contra o servidor ativo (`http://localhost:5173` / `http://127.0.0.1:4174`).
5. **Ausência de erros críticos no console:** Monitoramento via Chrome DevTools Protocol (`Runtime.exceptionThrown`, `Runtime.consoleAPICalled` error, `Log.entryAdded` error) exigindo zero erros.
6. **Teste real da funcionalidade modificada:** Simulação de navegação, seleção, movimentação e disparo em tempo de execução.
7. **Teste de regressão das principais cenas:** Validação encadeada de `TitleScene`, `StageSelectScene`, `PilotSelectScene` e `PrototypeScene`.
8. **Captura de tela real:** Geração e inspeção visual das capturas em `docs/screenshots/`.

### 5.2. Registro de Diagnóstico e Correção P0 (`StageBackdrop` & Indicadores)
- **Causa Raiz Identificada:**
  - O arquivo `src/game/scenes/StageBackdrop.ts` na branch `master` já continha `export class StageBackdrop` válido, porém um processo órfão do Vite Dev Server (`PID 24060`, iniciado às 18:25 na porta `5173`) havia capturado o arquivo durante o instante de truncamento de escrita (0 bytes) e retido em memória um módulo vazio (`sourcesContent: [""]`) com o socket em estado inconsistente. Isso fazia o navegador receber um módulo vazio ao requisitar `/src/game/scenes/StageBackdrop.ts`, disparando `Uncaught SyntaxError: The requested module '/src/game/scenes/StageBackdrop.ts' does not provide an export named 'StageBackdrop'`.
- **Regressões Secundárias Encontradas e Corrigidas:**
  1. **Indicador Falso de FPS em `TitleScene.ts`:** Removida a string fixa `SISTEMA ESTÁVEL [60-240 FPS]` e o aviso estático de taxa de quadros no modal de configurações. No `CombatHud.ts`, removido o fallback artificial `|| 60` para exibir exclusivamente a medição real de `scene.game.loop.actualFps`.
  2. **Conflito de Tecla `S` em `TitleScene.ts`:** A tecla `S` estava registrada duas vezes (`this.navigate(1)` e `this.openStageSelect()`), fazendo com que tentar descer no menu principal abrisse imediatamente a seleção de fases. Corrigido separando o atalho de fases para `[M]`.
  3. **Orientação de Projéteis e Muzzle Flash em `PrototypeScene.ts`:** Os sprites de projéteis primários (`shot-rivet`) e `fx-muzzle` eram desenhados horizontalmente (+X) e subiam de lado; foram corrigidos com `node.setRotation(Math.atan2(def.velocityY, def.velocityX))` e coloração por família (`0x4ade80` Pulso Verde, `0x00f0ff` Laser de Íons, `0xff4d6d` Plasma Vermelho).
  4. **Configuração de `StageBackdrop` em `EndingScene.ts`:** Ajustado para `{ fullWidth: true, showBezels: false }` e nave em modo `'profile'`.
- **Arquivos Corrigidos:**
  - `src/game/scenes/TitleScene.ts`
  - `src/game/ui/CombatHud.ts`
  - `src/game/scenes/PrototypeScene.ts`
  - `src/game/scenes/EndingScene.ts`
  - `scripts/capture-verification-screenshots.mjs`
  - `docs/27_BULLET_WAKE_V2_DEFINITIVO.md`
- **Testes Realizados e Resultados:**
  - `npm run typecheck`: Aprovado (0 erros).
  - `npm run build`: Aprovado (`dist/` compilado com sucesso).
  - `npm test`: Aprovado (124/124 testes passando).
  - Reinicialização limpa do Vite Dev Server na porta `5173` (`npx vite --host 0.0.0.0 --port 5173 --force`) após limpeza de `node_modules/.vite`.
  - Validação automatizada via navegador headless (`node scripts/capture-verification-screenshots.mjs`) na porta `5173`: 0 erros de console, 0 exceções, navegação de menu funcional, 3 pilotos selecionáveis com naves em perfil, Fase 1 iniciando com Pulso Verde LV1, movimentação lateral e disparos destruindo inimigos em combate real.
- **Tarefas Pendentes (Fora do Escopo Atual da Fase 1):**
  - Implementação jogável das Fases 2 a 15 e das 2 rotas secretas documentadas na Bíblia (mantidas bloqueadas conforme regra estrita de escopo da Fase 1 — Fenda Pelágica).

---

## 6. LASER RUBRO — ARMAMENTO ENERGÉTICO CONTÍNUO DE MULTIFEIXES EVOLUTIVOS

> [!IMPORTANT]
> **SUBSTITUIÇÃO DEFINITIVA NA BÍBLIA OFICIAL**
> Ficam permanentemente revogadas todas as referências anteriores a "Plasma Vermelho", "Chama Rubra", bolas vermelhas, projéteis discretos ou explosões sequenciais para o armamento vermelho (`weaponFamily = 'red'`). O armamento vermelho oficial do BULLET WAKE é o **LASER RUBRO**.

### 6.1. Definição e Comportamento Geral (`src/game/systems/crimsonLaserSystem.ts`)
- **Emissão Contínua:** Ativado e mantido continuamente enquanto o jogador segurar `ESPAÇO` (`LASER_RAMP_UP_MS = 35ms`).
- **Encerramento Imediato com Fade-Out Curto:** Ao soltar `ESPAÇO`, a emissão cessa imediatamente com decaimento visual curto (`LASER_DECAY_MS = 110ms`).
- **Sem Lacunas e Sem Superaquecimento:** Feixes contínuos de polilinhas (`16` segmentos verticais por feixe) sem buracos entre segmentos e com `heatPerShot = 0` para nunca sofrer corte arbitrário durante o uso normal.
- **Rastreamento Imediato:** Origem ancorada diretamente aos emissores frontais da nave (`vectorShip.x`, `vectorShip.y`), acompanhando instantaneamente movimentação lateral, diagonal e Dash.
- **Dano por Tick Independente de FPS:** Acumulador determinístico (`LASER_DAMAGE_TICK_MS = 60ms`, ~16,67 ticks/s) que garante o mesmo DPS exato em 30 FPS, 60 FPS, 120 FPS ou 240 FPS.

### 6.2. Os 4 Níveis Progressivos do Laser Rubro
1. **Nível 1 — Fluxo Inicial (`beamCount = 1`):**
   - 1 coluna energética frontal contínua de plasma rubro-alaranjado em movimento, com volumes luminosos conectados subindo rapidamente pelo fluxo, bordas irregulares animadas e núcleo incandescente (`totalDps = 18`).
2. **Nível 2 — Fluxo Duplo (`beamCount = 2`):**
   - 2 fluxos frontais visivelmente separados (`±11.5px`) com pulsação independente em contrafase, maior cobertura frontal e sensação clara de evolução (`totalDps = 27`).
3. **Nível 3 — Expansão Lateral (`beamCount = 4`, `hasLateralSweep = true`, `hasRearCoverage = false`):**
   - 2 fluxos principais frontais + 2 ramificações laterais que abrem para fora e retornam ciclicamente durante o disparo, criando varredura lateral orgânica (`totalDps = 38`).
4. **Nível 4 — Asas de Energia (`beamCount = 6`, `hasLateralSweep = true`, `hasRearCoverage = true`):**
   - Transformação geométrica completa: 2 fluxos principais frontais reforçados (`central`) + 2 ramificações laterais expressivas que abrem e fecham como asas luminosas de plasma (`lateral-sweep`) + **2 novos fluxos voltados para a diagonal traseira/flancos (`rear-wing`)**, protegendo contra ameaças laterais e próximas da retaguarda com comprimento e dano controlados (`totalDps = 50`).

### 6.3. Renderização, Impactos e Legibilidade (`src/game/render/CrimsonLaserRenderer.ts`)
- **Zero Alocação por Frame:** Utiliza um único `Phaser.GameObjects.Graphics` reutilizável em `depth = 8`.
- **Camadas Visuais:** Bainha energética rubra-alaranjada externa com espessura variável por segmento (`0x991b1b` / `0xea580c`), fluxo principal de plasma rubro-alaranjado (`0xff1e42` / `0xf97316`), volumes luminosos conectados ascendentes (`0xff2a1f`, `0xfb923c`, `0xfef08a`), espinha dorsal incandescente contínua (`0xfff7ed`), coronas nos canhões da nave e centelhas rotativas nas coordenadas exatas de impacto (`LaserImpactPoint`).
- **Legibilidade Absoluta de Projéteis Inimigos:** Projéteis hostis são renderizados em `depth = 18` (acima do Laser Rubro em `depth = 8` e da nave em `depth = 15`), garantindo leitura clara mesmo durante o Nível 4 máximo.
- **Modo de Validação Rápida (Sandbox Teclas `1–5`):** Durante o gameplay na `PrototypeScene`, as teclas `1`, `2`, `3` e `4` selecionam imediatamente os Níveis 1 a 4 da arma ativa, e a tecla `5` alterna entre `LASER RUBRO`, `ENERGIA ESPIRALADA` e `DISPERSÃO AZUL`.

---

## 7. IMPORTANTE — REFERÊNCIA VISUAL FIRE SHARK E PROGRESSÃO DEFINITIVA DE ARMAMENTOS

> [!IMPORTANT]
> **SEPARAÇÃO RIGOROSA ENTRE AS REGRAS COMPROVADAS DE *FIRE SHARK* (TOAPLAN) E AS ADAPTAÇÕES PRÓPRIAS DO *BULLET WAKE***
> Esta seção documenta separadamente os mecanismos comprovados da referência histórica (*Fire Shark*, Toaplan) e as adaptações autorais originais do *BULLET WAKE*, proibindo atribuir ao jogo original suposições não verificadas (como uma suposta progressão obrigatória `Azul N4 → Verde N4 → Vermelho`).

### 7.1. Regras Confirmadas de *Fire Shark* (Reproduzidas Conceitualmente)
1. **Arma Inicial Padrão:** O jogador inicia a partida equipado com o **Wide Shot azul** (`DISPERSÃO AZUL` / `'ion'` no Nível 1, com medidor `P` em `0/3`).
2. **Troca por Cápsulas Coloridas:** Cápsulas coloridas coletadas fisicamente no campo de combate alteram imediatamente a arma equipada:
   - Cápsula Azul (`weapon_ion`) → **DISPERSÃO AZUL**
   - Cápsula Verde (`weapon_green`) → **ENERGIA ESPIRALADA**
   - Cápsula Vermelha (`weapon_red`) → **LASER RUBRO**
3. **Ausência de Trava Linear entre Cores:** **Não é necessário maximizar o azul para obter o verde, nem maximizar o verde para obter o vermelho.** Qualquer cápsula coletada ativa sua respectiva arma imediatamente.
4. **Evolução por 3 Itens `P` (4 Estados de Potência):** Coletar **três itens `P`** (`0/3 → 1/3 → 2/3 → 3/3`) aumenta **1 nível de potência** da arma, até **quatro estados totais** (`Nível 1`, `Nível 2`, `Nível 3` e `Nível 4`).
5. **Independência entre Troca de Arma e Evolução de Potência:** A troca de família de arma (cápsulas coloridas) e a evolução de nível de potência (itens `P`) são mecanismos **independentes**. Trocar de arma mantém o nível de potência atual e o progresso acumulado no medidor `P`.
6. **Comportamento da Arma Azul (`DISPERSÃO AZUL`):** Dispara projéteis energéticos direcionais independentes em leque crescente conforme o nível de potência sobe (`3`, `5`, `7` e `9` direções), cobrindo progressivamente mais ângulos frontais e diagonais.
7. **Comportamento da Arma Verde (`ENERGIA ESPIRALADA`):** Dispara feixes e ondas energéticas ondulantes/espiraladas concentradas (`2`, `3`, `5` e `7` ondas helicoidais com fitas luminosas e anéis de fase), com deslocamento ondulante real e foco frontal/semi-frontal.
8. **Comportamento da Arma Vermelha (`LASER RUBRO`):** Utiliza fluxos contínuos de energia semelhantes a fogo/plasma em movimento contínuo (nunca projéteis avulsos ou linha reta estática), que se expandem por nível (`Fluxo Inicial` → `Fluxo Duplo` → `Expansão Lateral` cíclica → `Asas de Energia` no Nível 4 com cobertura lateral ampla e **2 fluxos posteriores/diagonais `rear-wing`**).
9. **Autofire Contínuo:** Manter o comando de disparo (`ESPAÇO`) pressionado garante **autofire contínuo** em todas as armas.
10. **Sem Superaquecimento no Disparo Principal:** Superaquecimento **não** faz parte do sistema principal documentado de *Fire Shark* e não interrompe nem bloqueia o autofire contínuo durante o combate no *BULLET WAKE*.

### 7.2. Adaptações Originais Próprias do *BULLET WAKE*
1. **Reinterpretação Visual Neo-Arcade HD 2D (*Laser Rubro*):** Enquanto o *Fire Shark* original apresenta o *Super Fire* com estética de chamas clássicas, o *BULLET WAKE* reinterpreta o ataque vermelho como **colunas vivas de plasma rubro-alaranjado em movimento** (`#ff1e42`, `#fb923c`, `#fef08a`, `#fff7ed`), com volumes luminosos conectados subindo pelo feixe, bordas irregulares animadas e asas energéticas curvas, sem copiar sprites ou assets da Toaplan.
2. **Dash Tático de Emergência (`SHIFT Esquerdo`):** Sistema autoral do *BULLET WAKE* com exatamente **3 cargas fixas por fase** (`DASH 3/3`), janela curta de evasão (`130ms`) e zero recarga por tempo ou itens.
3. **Controles Exclusivos de Teclado no PC:** Movimentação em 8 direções via `WASD`/Setas e disparo via `ESPAÇO`, com o mouse estritamente desabilitado para tiro ou movimentação da nave no PC.
4. **Sistemas Táticos dos Operadores (Nolan, Cora, Harlan):** Habilidade Especial de Ressonância (`V`), Wave Cannon carregável (`C`) e Bomba Defensiva (`X`), além de balanceamento de DPS por tick determinístico (`60ms`) e alcance traseiro limitado nos fluxos `rear-wing` do Nível 4 para preservar o desafio do Miniboss *Raia-Dente* e do Chefe *Talassarca*.
5. **HUD Widescreen de Alta Legibilidade (1366×768 e 1920×1080):** Corredor central expandido (`432px`, `X: 168..600`) ladeado por painéis táticos (`168px`) com carregamento explícito de `Oxanium` e `Rajdhani`, renderização `antialias: true` para textos/gráficos vetoriais (`FilterMode.NEAREST` restrito apenas às texturas de sprites) e eliminação total de textos ilegíveis de `10px/11px`.

## 8. SELEÇÃO DE PILOTOS — CORREÇÃO FINAL DOS ASSETS (09/11/2026)

- **RIVET de menu:** ilustração independente com transparência real; casco branco, detalhes vermelhos, três propulsores e silhueta agressiva. Vista elevada em três quartos, com frente voltada à esquerda/baixo, escala e iluminação compatíveis com Moth e Knuckle. Nenhum pixel da key art foi usado como recorte. A máscara radial que disfarçava o cenário promocional foi removida.
- **Nolan, Cora e Harlan:** retratos repintados em concept art 2D/2.5D, com pinceladas visíveis, pele fosca e sombras gráficas. Identidades, cicatrizes, cabelos, trajes e cores individuais preservados. O acabamento vem dos arquivos, sem filtro CSS simulando pintura.
- **Layout aprovado preservado:** mesma paleta da UI, tipografia, estrutura, dimensões dos cards e espaçamentos. Comparação automatizada das medidas reais com o CSS anterior: nenhuma mudança em cards, perfis ou rodapé.
- **Validação:** TypeScript e build aprovados; 125/125 testes; Chrome real em 1366×768 e 1920×1080; os três perfis sem scroll, cortes ou sobreposição em ambas as resoluções; roda do mouse sem deslocamento; seleção, abertura/fechamento de perfil, início de operação, movimento/disparo, seleção de fases e retorno à abertura funcionando; zero erros de console/runtime.
- **Inspeção visual:** RIVET sem fundo ou moldura promocional, três naves no mesmo conjunto de menu, retratos claramente ilustrados e espaço livre preservado.
- **Rastreabilidade:** [assets e prompts](28_CORRECAO_FINAL_PILOTOS.md), [capturas](screenshots/pilot-selection-final/) e [medidas da validação](screenshots/pilot-selection-final/validation.json). Reexecutar com `node scripts/validate-pilot-selection.mjs` após `npm run build`.

### 8.1. Pendências reais da campanha V2

Esta lista substitui as declarações de campanha completa da versão horizontal no roadmap antigo. A Fase 1 é o único setor jogável liberado na versão atual; definições de nomes ou chefes herdados não equivalem à implementação das fases canônicas.

1. **Fases 2 e 3:** implementar Bosque da Névoa Viva e Metrópole do Silêncio com cenários, inimigos, minibosses e chefes canônicos Arborion e Catedral de Vidro. As classes antigas Serpent/Fortress ainda usadas pela fábrica não representam esses chefes.
2. **Fases 4 a 15:** construir conteúdo jogável, cenários, padrões inimigos, minibosses e chefes próprios; incluir Thalor, Morhiza e Prisma Órfão como variantes da Fase 15.
3. **Seleção e progressão V2:** disponibilizar a escolha das três regiões iniciais quando seus conteúdos estiverem prontos, registrar a ordem das regiões e encadear as Fases 4–15. A seleção atual tem cinco cards e libera somente a Fase 1; os dados de fases terminam em 5.
4. **Rotas e finais secretos:** implementar as condições das seis ordens iniciais, Fase 16 (Coração Telúrico), Fase 17 (Matriz Primordial em quatro fases) e os finais correspondentes.
5. **Salvamento e vitória V2:** expandir o schema limitado às cinco fases antigas para a campanha canônica, migrar saves e registrar corretamente a fase concluída. O epílogo atual ainda chama `recordStageClear(5, ...)` após a vitória da Fase 1.
6. **Controles e distribuição planejados:** implementar suporte efetivo a gamepad, controles táteis completos para dash/bomba/especial/carga e empacotamento Android. A entrada atual cobre teclado e movimento/tiro por toque.





