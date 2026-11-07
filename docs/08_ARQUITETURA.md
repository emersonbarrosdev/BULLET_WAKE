# 08 — Arquitetura técnica: Phaser 4, Angular, Canvas, Android

## Escolha oficial de pré-produção
**Phaser 4 + TypeScript + Vite**. Um **HTMLCanvasElement** será a superfície de jogo. O Phaser renderiza os sprites preferencialmente via **WebGL** (GPU); Canvas 2D não é o plano de render principal. Angular **não** será incorporado ao runtime de ação, pois apenas adicionaria DOM, router e estado desnecessários. Se necessário, Angular poderá ser usado **separadamente** em um futuro editor de conteúdo ou painel de produção. Fixar versão estável exata no lockfile ao iniciar implementação e revisar API Phaser 4 versus Phaser 3.

## Justificativa
Foco num único jogo arcade com cenas, câmera, sprites, input e animação. Phaser oferece essas peças sem uma camada Angular. Vite serve assets e compila TypeScript. O jogo será um build web estático offline sempre que possível.

## Configuração inicial proposta
Viewport lógico 384×216 em 16:9; pixelArt/nearest-neighbor; scale FIT/letterbox com safe areas para mobile; fullscreen opcional e coordenadas de input normalizadas. Não misturar sprites e tiles 16-bit com vetores lisos finais. Meta 60 FPS com frame time nominal ~16,67ms; medir em dispositivo real, não presumir.

## Pastas planejadas (a criar no bootstrap)
```text
src/
  main.ts
  game/
    scenes/BootScene.ts, PreloadScene.ts, TitleScene.ts,
           PilotSelectScene.ts, MissionScene.ts, ResultsScene.ts,
           GameOverScene.ts, SettingsScene.ts
    entities/Player.ts, Enemy.ts, Projectile.ts, Pickup.ts, BossPart.ts
    systems/MovementSystem.ts, WeaponSystem.ts, CollisionSystem.ts,
            DamageSystem.ts, WaveSpawner.ts, ScoreSystem.ts,
            SaveSystem.ts, AudioSystem.ts
    data/pilots.ts, missions.ts, enemies.ts, weapons.ts, animations.ts
    input/KeyboardController.ts, GamepadController.ts, TouchController.ts
    ui/HUD.ts, PilotCards.ts, BossBar.ts
    render/Parallax.ts, VFXPool.ts
  shared/types.ts, timing.ts
public/assets/{ships,enemies,bosses,backgrounds,fx,ui,audio}/
tests/{unit,integration,e2e}/
```

## Modelos e responsabilidades
**PilotDefinition:** id, name, shipId, speed, fireRate, damage, specialId, animationManifest. **WeaponDefinition:** type, level 1..3, cooldownMs, damage, projectileId, anchors. **EnemyDefinition:** id, hp, hitbox, behaviorId, attackPatterns, drops, score. **MissionDefinition:** id, layers, timeline/spawns, checkpoints, hazards, boss, reward. **AnimationManifest:** states, dimensions, fps, pivots, emitterAnchors, hurtbox. **SaveData:** schemaVersion, unlockedStages, bestScores, settings.

Separar regras determinísticas de lógica visual Phaser para testes. Cooldowns em milissegundos, movimento por delta, pooling de balas/partículas, atlas por missão, carregamento incremental e limpeza após transições. Não criar centenas de objetos por quadro.

## PC e Android
Desktop primeiro: teclado, gamepad, áudio web e navegador. Android em paisagem: drag/joystick virtual, tiro básico automático, botões de especial/bomba, orientação, notch/safe area, áudio liberado por gesto, pause/resume. **Capacitor** é candidato para empacotar o web build, não garantia de desempenho; validar WebView, memória, pixel scaling e controles em aparelho real.

## Qualidade de engenharia
TypeScript strict, ESLint/Prettier, testes unitários de simulação, testes de integração, build e smoke web, arte final integrada cedo. Dependências com lockfile. Nunca declarar performance ou suporte Android sem build/teste. Phaser 4 documentação oficial: https://phaser.io/download/phaser4 ; https://docs.phaser.io .
