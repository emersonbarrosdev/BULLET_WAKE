# BULLET WAKE — Guia Oficial do DevTools Universal

## 1. O que é o DevTools
O **BULLET WAKE — DEVTOOLS** é o painel interno permanente de desenvolvimento, inspeção, depuração e QA do projeto. Ele funciona sobre todas as fases jogáveis registradas em `MISSIONS` (`Fenda Pelágica — UP`, `Cidade Solar — SIDE` e futuras fases implementadas), permitindo saltar diretamente para checkpoints, minibosses, chefes finais, seções de chefes, spawns de inimigos, visualizações reais de colisão, telemetria de desempenho e prévia quadro a quadro de spritesheets.

> **Garantia de Isolamento:** O DevTools existe **exclusivamente** no servidor de desenvolvimento (`npm run dev`). Todo build distribuível (`npm run build`, incluindo builds com `--mode development`) e `npm run preview` eliminam estaticamente o código, o chunk e os globais do DevTools do artefato final `dist/`.

---

## 2. Como iniciar com `npm run dev` (e testes Android na LAN)

### Uso padrão seguro (Localhost)
Por padrão de segurança (Seção 16), o servidor de desenvolvimento escuta exclusivamente em `127.0.0.1` na porta `5173`:

```bash
npm run dev
```

### Acesso LAN temporário para dispositivos Android na rede local
Quando precisar testar controles touch no Android pela mesma rede Wi-Fi local (nunca exponha diretamente à internet):

```bash
npm run dev:lan
```

Isso inicia `vite --host 0.0.0.0`. Após o teste no aparelho Android, encerre o processo no terminal.

---

## 3. Como abrir, mover e fechar o painel
1. **Botão flutuante `DEV`**: exibido no canto inferior esquerdo durante o desenvolvimento (título, seleção de piloto/missão, gameplay e pausa).
2. **Atalho global `F9`**: abre e fecha o painel em qualquer tela.
3. **Tecla `Escape`**: fecha o painel **apenas quando o foco estiver dentro do DevTools**, preservando o comportamento normal de pausa do jogo.
4. **Reposicionar e Minimizar**: arraste pela barra superior `BULLET WAKE — DEVTOOLS`, ou clique em `—` (minimizar) e `×` (fechar).
5. **Bloco de Inputs**: quando um campo `<input>` ou `<select>` do painel estiver selecionado, as teclas de movimento/tiro/menu da `ArcadeScene` são ignoradas para não interferir na digitação.

---

## 4. Abas e Funcionalidades

### `FASES`
- Lista automaticamente todas as fases jogáveis registradas em `MISSIONS` ([content.ts](file:///c:/Users/emers/PROJETOS/GAMES/BULLET_WAKE/src/game/arcade/content.ts)) — rotas reservadas em `FUTURE_ROUTES` nunca aparecem como jogáveis.
- Permite iniciar do começo, ir direto ao **Miniboss** (`155s`), ir direto ao **Boss Final** (`300s`), carregar qualquer checkpoint (`0s`, `45s`, `90s`, `135s`, `155s`, `200s`, `255s`, `300s`), reiniciar o trecho atual, reiniciar a fase ou **Voltar ao Menu** encerrando a sessão dev com restauração limpa.
- Ao carregar um checkpoint (`ArcadeScene.devJumpToCheckpoint` / `ArcadeWorld.devJumpToCheckpoint`), o sistema sincroniza cenário, `scroll`, `route`, `elapsed`, região, índice do diretor de encontros (`waveIndex`), `supplyIndex`, obstáculos e `specialEventsTriggered` (evitando eventos passados reaparecerem) e ajusta a trilha sonora correspondente.

### `BOSSES`
- Inicia diretamente o Miniboss (`Patrulha Pesada Naval` / `Patrulha Pesada Aérea`) ou Boss Final (`Colosso Abissal` / `Mega Dirigível Giro`).
- Para chefes multi-seção (`Colosso Abissal` em [PelagicSubmarineBoss.ts](file:///c:/Users/emers/PROJETOS/GAMES/BULLET_WAKE/src/game/arcade/PelagicSubmarineBoss.ts)), permite iniciar diretamente qualquer uma das **5 seções reais implementadas**:
  1. `PROA BLINDADA`
  2. `ARMAMENTO FRONTAL`
  3. `TORRE DE COMANDO`
  4. `ARMAMENTO TRASEIRO`
  5. `PROPULSÃO ABISSAL`
- Permite **Restaurar Vida & Componentes**, testar colapso/vitória, aplicar presets de resistência (`NV1 sem Especiais`, `NV3 com 2 Especiais`, `FULL sem Especiais`, `FULL + 5 Especiais`, `FULL + 5 ESP + Invencível`), acompanhar telemetria em tempo real e executar **Auditar Progressão Completa do Boss** (`DevScenarioRunner.verifyBossProgression`) para confirmar que nenhuma fase/seção é pulada.

### `INIMIGOS`
- Detecta automaticamente todas as famílias reais de `FAMILY` (incluindo `heli_scout`, `heli_utility`, `heli_phantom`, `heli_warhawk`, aviões, navios, submarinos, torres e tanques).
- Permite configurar quantidade (`1..24`), formação, trajetória, lado de entrada (`top`, `left`, `right`), faixa, velocidade, multiplicadores de cadência/velocidade de tiro (exclusivos do modo de teste sem alterar a produção), posição inicial e dificuldade, além de atalhos prontos (10 caças, formação em V, entradas laterais, submarino emergindo, torre costeira, Warhawk com míssil etc.).

### `JOGADOR / ARMAS`
- Configura ao vivo nível da arma (`NV1..FULL`), medidor `P` (`0..2`), vidas (`1..5`), especiais (`0..5`), pontuação, dificuldade (`Normal`/`Difícil`), disparo acessível, modo assistido e **Invencibilidade Dev** (`world.devInvincible = true`, protege apenas a RIVET).
- Botões para disparo manual/rajada, mísseis, especial, soltar cápsulas (`power`, `life`, `special`), **RESETAR RIVET** e **TESTAR MORTE** (`world.devTriggerControlledDeath`, que executa a regra real de perda de vida, queda de nível e cápsula de recuperação).

### `COLISÕES`
- Implementado em [DevCollisionOverlay.ts](file:///c:/Users/emers/PROJETOS/GAMES/BULLET_WAKE/src/devtools/DevCollisionOverlay.ts).
- Desenha em tempo real os **dados exatos da simulação** sobre os sprites sem afetar o jogo:
  - Hitbox elíptica da RIVET (`sweepEllipse` `rx=5, ry=7`) e raio de coleta (`22px`).
  - Hitboxes reais dos inimigos, limites dos sprites e raio de colisão aérea.
  - Hitboxes, rastro `sweep` (`(px, py) -> (x, y)`) e vetores de direção `(vx, vy)` dos projéteis.
  - Pivôs das torretas e coordenadas exatas da ponta dos canos (`resolveActorMounts` / `resolveUnmountedMuzzle`).
  - Módulos, setores de dano, blindagens e casco das seções do `Colosso Abissal`.
  - Obstáculos (`width × height`), caixas/suprimentos e raio ativo da bomba especial.

### `EVENTOS`
- Lista eventos especiais registrados (`PELAGIC_TIMED_EVENTS`, `PELAGIC_RARE_EVENT`), suprimentos (`SUPPLIES`) e encontros da missão selecionada, exibe snapshot do diretor e permite acionar encontros, reiniciar o último evento, avançar ao próximo encontro e testar diálogos do Bayek.

### `DESEMPENHO`
- Implementado em [DevPerformanceMonitor.ts](file:///c:/Users/emers/PROJETOS/GAMES/BULLET_WAKE/src/devtools/DevPerformanceMonitor.ts).
- Exibe FPS atual/médio, média, mediana, P95, P99, contagem viva de inimigos, tiros, objetos Phaser, efeitos, qualidade visual (`0/1/2`), resolução, memória JS (`performance.memory` quando suportada) e GPU (`WEBGL_debug_renderer_info`).
- Controles determinísticos: **Pausar Simulação**, **Retomar**, **Passo `1/120s`**, velocidade `100%` / `50%` / `25%`, troca de qualidade e **6 cenários de estresse controlado** com limpeza completa ao encerrar.
- Os relatórios JSON gerados diferenciam explicitamente `measurementKind: "interactive"` de `"controlled-simulation"`.

### `VISUAL`
- Implementado em [DevAnimationPreviewer.ts](file:///c:/Users/emers/PROJETOS/GAMES/BULLET_WAKE/src/devtools/DevAnimationPreviewer.ts).
- Lista texturas/spritesheets reais carregados na cena por categoria (`RIVET`, `Aeronaves`, `Helicópteros`, `Barcos`, `Submarinos`, `Canhões`, `Explosões`, `Mísseis`, `Especiais`), renderizando sobre grade de transparência com mira de pivô/origem, bordas do frame, FPS configurável, Play/Pause e avanço quadro a quadro.

---

## 5. Como Estender para Novas Fases, Inimigos, Checkpoints e Chefes

### Registrar uma nova fase jogável
Adicione a nova `Mission` ao array `MISSIONS` em [src/game/arcade/content.ts](file:///c:/Users/emers/PROJETOS/GAMES/BULLET_WAKE/src/game/arcade/content.ts). O [DevStageAdapter.ts](file:///c:/Users/emers/PROJETOS/GAMES/BULLET_WAKE/src/devtools/DevStageAdapter.ts) descobre automaticamente toda missão em `MISSIONS` (ignorando `FUTURE_ROUTES`) e registra seus checkpoints, miniboss, boss e encontros no [DevScenarioRegistry.ts](file:///c:/Users/emers/PROJETOS/GAMES/BULLET_WAKE/src/devtools/DevScenarioRegistry.ts) sem alterar o painel.

### Registrar um novo inimigo
Adicione a família em `Family`, `FAMILY` e `ENEMY_SHOTS` em [content.ts](file:///c:/Users/emers/PROJETOS/GAMES/BULLET_WAKE/src/game/arcade/content.ts). `createPlayableStageAdapters()` lê `Object.keys(FAMILY)` automaticamente, disponibilizando o inimigo no seletor da aba **INIMIGOS**. Se possuir torretas articuladas, registre em `MOUNT_SPECS` no [PelagicWeaponMounts.ts](file:///c:/Users/emers/PROJETOS/GAMES/BULLET_WAKE/src/game/arcade/PelagicWeaponMounts.ts) para aparecer automaticamente também no overlay de canhões.

### Adicionar checkpoints e cenários customizados
- **Checkpoints automáticos:** defina `regions` na `Mission`; os tempos de transição (`REGION_START_TIMES`) geram checkpoints e botões automaticamente.
- **Cenários programáticos:** chame `registry.register({ id, stageId, missionIndex, name, category, initialize(scene, options), cleanup(scene) })` usando a interface `DevScenario` em [src/devtools/types.ts](file:///c:/Users/emers/PROJETOS/GAMES/BULLET_WAKE/src/devtools/types.ts).

### Registrar bosses com múltiplas seções
No `DevStageAdapter.ts`, `buildBossesForMission()` inspeciona chefes multi-seção (como `createSubmarineBoss` com suas 5 seções em [PelagicSubmarineBoss.ts](file:///c:/Users/emers/PROJETOS/GAMES/BULLET_WAKE/src/game/arcade/PelagicSubmarineBoss.ts)). Para novos chefes multi-estágio futuros, adicione o adaptador de seções em `buildBossesForMission()` e o método de salto de seção em `ArcadeWorld.devStartBoss`.

---

## 6. Isolamento de Saves e Segurança

1. **Bloqueio de escrita no save real:** Sempre que qualquer cenário de debug é executado via `DevStateManager.beginTestSession(scene)`, `ArcadeScene.setDevSaveGuard(true)` é ativado. Em `ArcadeScene.saveClear()`, se `this.devSaveGuard` estiver ligado, nenhuma gravação ocorre em `localStorage['bullet_wake_save_data_v1']` (`globalSave`) nem em `localStorage['bullet_wake_arcade_v1']`.
2. **Persistência exclusiva do painel:** Preferências de posição/aba/seed do painel ficam isoladas em `bullet_wake_devtools_prefs_v1`, módulo existente apenas no modo DEV.
3. **Sessões reprodutíveis:** Parâmetros do último cenário/teste e seed são mantidos em `DevStateManager` para o botão **Reiniciar Cenário / Trecho**; ao sair para o menu, qualidade e controles são restaurados.

---

## 7. Como o DevTools é Excluído da Produção (e Como Auditar)

### Mecanismo de compilação obrigatório
1. Em [vite.config.ts](file:///c:/Users/emers/PROJETOS/GAMES/BULLET_WAKE/vite.config.ts):
   ```ts
   const enableDevTools = command === 'serve' && mode === 'development';
   define: { __BW_DEVTOOLS__: JSON.stringify(enableDevTools) }
   ```
   Como `command === 'serve'` é `false` em **qualquer** execução de `vite build`, até mesmo `npx vite build --mode development` compila `__BW_DEVTOOLS__` como `false`.
2. Em [src/main.ts](file:///c:/Users/emers/PROJETOS/GAMES/BULLET_WAKE/src/main.ts):
   ```ts
   if (__BW_DEVTOOLS__ && import.meta.env.DEV) {
     const { mountDevTools } = await import('./devtools/mountDevTools');
     cleanupDevTools = mountDevTools(game, Phaser);
   }
   ```
   Durante `npm run build`, a eliminação de código morto do Rollup/Vite remove o ramo e descarta completamente todo o diretório `src/devtools/` — nenhum chunk extra é emitido e nenhuma referência a `window.__GAME__`, `window.Phaser` ou `mountDevTools` entra no pacote final.

### Comandos de verificação
```bash
# Testes automatizados (inclui auditoria do build --mode development contra dist/)
npm test

# Verificação ponta-a-ponta do Arco das Marés (PC Horizontal + Android Retrato + vídeo)
node scripts/tide-arch-verify.mjs

# Verificação ponta-a-ponta real em Chrome: DEV (npm run dev), BUILD (--mode development), e PREVIEW (vite preview)
node scripts/devtools-browser-e2e.mjs

# Build de produção e auditoria de gameplay (valida isolamento em dist/ + rotas completas em dev)
npm run build
node scripts/arcade-browser-check.mjs --routes --performance
```
