# 68 — Reformulação Visual e Funcional da Abertura e dos Menus (Tarefa 16)

## 1. Máquina de Estados da Abertura

A inicialização de `ArcadeScene` segue uma sequência explícita e determinística sem vazamento de fundo nem flashes brancos:

1. **`LOADING`**
   - Superfície `#040d21` ocupando `100vw × 100dvh` via overlay DOM imediato `#bw-boot-loading` (`index.html`), eliminando faixas laterais (`sidebars`) em qualquer proporção de tela e removendo a tela branca inicial.
   - Moldura `.bw-boot-frame` com dimensões fixas (`width: min(360px, 78vw); height: 18px`): apenas o preenchimento interno `#bw-boot-fill` avança de `0%` a `100%` conforme `loadRealProgress` e a verificação das texturas críticas de abertura (`criticalOpeningAssetsReady()`).
   - O pano de fundo celeste e os atores do menu permanecem estritamente ocultos (`showMenuBackdrop = false`, `hero/logo/menuPlanes.visible = false`).
2. **`STUDIO_SPLASH`**
   - Tela cheia `#040d21` apresentando `BOTAN STUDIO — A P R E S E N T A` sem fundo do menu atrás da vinheta.
   - Skip controlado liberado após `0.35s` por clique ou tecla/botão de confirmação, executando fade suave de saída antes de entrar em `MAIN_MENU`.
3. **`MAIN_MENU`**
   - Entrada com véu escuro suave (`360ms`) sobre o menu já montado.
   - Fundo panorâmico ensolarado estático (`public/assets/arcade/ui/sky-panorama.webp`, `1536×864`, sem rolagem/tile-scroll e sem grande banda de água no primeiro plano).
   - Logo oficial `BULLET WAKE` centralizado no topo (`x: 384, y: 114, 352×154`), livre de aeronaves sobre as letras.
   - Remoção definitiva da nave grande (`hero`) sobre os botões.
   - Três botões compactos centralizados (`220×34`, `x: 384`): `INICIAR JORNADA` (`y: 264`), `CONTROLES` (`y: 306`) e `OPÇÕES` (`y: 348`).
   - Três aeronaves 2.5D animadas (`public/assets/arcade/ui/menu-aircraft.webp`, `4×3 @ 160×160`: patrulheiro a hélice com spinner rotativo, jato de escolta com pós-combustor animado e helicóptero de rotor giratório) em corredores aéreos livres de colisão com o logotipo e os botões.

---

## 2. Variantes Oficiais do Logo (`public/assets/brand/` e `ui/`)

Geradas por `scripts/pack-menu-rework-v1.mjs`:

- [`bullet-wake-logo.svg`](../public/assets/brand/bullet-wake-logo.svg) — Vetor mestre editável.
- [`bullet-wake-logo-main.png`](../public/assets/brand/bullet-wake-logo-main.png) — Versão principal de apresentação (`1280×560`).
- [`bullet-wake-logo-transparent.png`](../public/assets/brand/bullet-wake-logo-transparent.png) — PNG transparente sem placa de fundo (`1200×520`).
- [`bullet-wake-logo-compact.png`](../public/assets/brand/bullet-wake-logo-compact.png) — Versão compacta (`384×176`).
- [`bullet-wake-logo-light-bg.png`](../public/assets/brand/bullet-wake-logo-light-bg.png) — Aplicação sobre fundo claro (`1200×520`).
- [`bullet-wake-logo-dark-bg.png`](../public/assets/brand/bullet-wake-logo-dark-bg.png) — Aplicação sobre fundo escuro `#040d21` (`1200×520`).
- [`logo-arcade.webp`](../public/assets/arcade/ui/logo-arcade.webp) — Ativo otimizado em runtime para o menu (`960×420`).

---

## 3. Tela de Controles com Abas (`PC | CONTROLE | ANDROID`)

A tela `CONTROLES` (`ArcadeScene.ts`) oferece seleção interativa via mouse, teclado (`1`/`2`/`3` e setas `←`/`→`), toque e gamepad, preservando o retorno contextual (`title` no menu principal ou `pause` durante a missão):

- **Aba `PC`**
  - `WASD / Setas`: mover a RIVET em 8 direções.
  - `ESPAÇO`: rajada manual de 3 pulsos por toque (compatível com o sistema manual Sonic Wings; *segurar ESPAÇO não dispara em loop no modo padrão*; tiro contínuo somente quando *Disparo Acessível* está ativo em `OPÇÕES`).
  - `X`: especial *Tormenta Escarlate*.
  - `ESC / ENTER`: pausar / confirmar menus (mouse não atira nem move no combate).
- **Aba `CONTROLE` (PlayStation 5 DualSense & Xbox/Genérico)**
  - Detecção dinâmica ao entrar e via hot-plug em `update()`: exibe ilustração dedicada do **PS5 DualSense** (`pad-dualsense.webp`) por padrão ou ao conectar controle PlayStation/DualSense, e `pad-xbox.webp` quando um controle Xbox/XInput é detectado.
  - Mapeamento real implementado em `GamepadReader`:
    - `L / D-Pad`: mover a aeronave.
    - `✕` (Cruz / `A`): disparar rajada manual (3 pulsos) / confirmar menus.
    - `□` (Quadrado / `X`): especial *Tormenta Escarlate*.
    - `OPTIONS` (`START`): pausar / retomar partida.
    - `○` (Círculo / `B`): voltar nos menus.
    - Nota explícita de que `△` e gatilhos permanecem sem ação ativa neste modo.
- **Aba `ANDROID`**
  - Ilustração dedicada em modo paisagem (`mobile-landscape.webp`) com Joystick virtual à esquerda, botões independentes `TIRO` e `ESP` para multitoque simultâneo sem disparos acidentais do especial e botão `PAUSA` no topo direito respeitando área segura.

---

## 4. Orientação e Compatibilidade Responsiva

- `#rotate-hint` em `src/style.css` e `index.html` inicia oculto (`display: none` no CSS crítico inline) e só é exibido via media query `@media (orientation: portrait) and (pointer: coarse) and (max-width: 900px)`, evitando disparos falsos em janelas desktop estreitas e substituindo qualquer tela branca de orientação por um aviso azul-marinho `#040d21` com ícone ilustrado de rotação.
- Validação visual automatizada em `scripts/opening-menu-verify.mjs` e testes determinísticos em `tests/openingMenuRework.test.mjs`, com evidências salvas em `docs/screenshots/menu-rework-v1/`.
