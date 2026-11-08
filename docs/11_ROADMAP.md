# 11 — Roadmap de produção (BULLET WAKE)

**Direção do projeto:** Shoot 'em up 2D horizontal contínuo, sem rounds ou ondas em arena. Pixel art moderna 16-bit com naves autorais, 5 fases com chefes polimórficos, sintetizador Web Audio procedural nativo e 60 FPS estável.

## Estado Geral das Tarefas

| Tarefa | Estado | Entrega |
|---|---|---|
| T01 | CONCLUÍDA | Bootstrap Phaser 4 + TS + Vite e pipeline de build |
| T02 | CONCLUÍDA | Canvas FIT, safe areas, movimentação em limites, alvos e pontuação |
| T03 | CONCLUÍDA | Dano, 3 pontos de integridade, invulnerabilidade (i-frames), vidas, respawn e Game Over |
| T04 | CONCLUÍDA | Combat HUD arcade completo, barra de integridade, vidas, bombas, ressonância e Game Over |
| T05 | CONCLUÍDA | Inimigos Scout e Lancer com máquinas de estados (FSM), telégrafos de disparo |
| T06 | CONCLUÍDA | Seleção dos 3 pilotos da colônia (Nolan / Rivet, Cora / Moth, Harlan / Knuckle) com DPS equivalente |
| T07 | CONCLUÍDA | Pipeline de pixel art transparente e animadores automáticos em Node 22 |
| T07.1 | CONCLUÍDA | Rivet V2 moderna e sheets de combate |
| T08 | CONCLUÍDA | Resolução 768×432, 3 camadas de parallax paramétricas e StageDirector por distância |
| T09 | CONCLUÍDA | Rivet V3 completa (idle, climb, dive, fire, missile_launch, prism_charge, hit, destruction, engine, muzzle) |
| T10 | CONCLUÍDA | Validação de 60 FPS, 101 testes unitários automatizados via `node --test` |
| T11–T12 | CONCLUÍDA | Evolução de armas LV1 → LV2 → LV3 para os 3 pilotos com escalas de dano e projéteis visíveis |
| T13 | CONCLUÍDA | Sistema de áudio Web Audio procedural em tempo real (tiros, mísseis, especiais, bombas, explosões e trilha synth) |
| T17–T18 | CONCLUÍDA | Naves Moth V2 (Cora) e Knuckle V2 (Harlan) com sheets completos em 6 estados de voo e destruição |
| T21–T26 | CONCLUÍDA | Sistema de pickups com atração magnética (upgrade, repair, bomb, resonance, shield, score), bombas e especiais |
| T27–T30 | CONCLUÍDA | Sistema de combos com multiplicadores até 3.0x, janela de decaimento de 2400ms e registro de eliminações |
| T31–T36 | CONCLUÍDA | Chefe KRM-17 com 3 fases, módulos destrutíveis e vulnerabilidade crítica do núcleo; SaveSystem persistente |
| T37–T40 | CONCLUÍDA | Menus completos (TitleScene, StageSelectScene, PilotSelectScene, EndingScene) e controles táteis/teclado |
| T41–T60 | CONCLUÍDA | Campanha com as 5 fases e 5 chefes únicos (KRM-17, Serpente, Fortaleza, Interceptador, Coração da MALHA) |
| T61–T70 | CONCLUÍDA | Epílogos narrativos por piloto, benchmark headless Chrome a 59.6 FPS e integração master |

---

## Detalhamento dos Sistemas Implementados

### 1. Pilotos e Armamentos
- **Nolan Fitch (Rivet V3):** Disparos rápidos e equilibrados. Pulso LV1 (1 projétil), LV2 (tiro duplo), LV3 (tiro triplo leque). Especial: *Tempestade Prismática* (rajada perfurante contínua com carga de 100% ressonância).
- **Cora Wren (Moth V2):** Agilidade e velocidade extrema. Laser Agulha LV1–LV3. Especial: *Salto Fantasma* (dash invulnerável em alta velocidade com rastro de pós-imagens que destrói alvos em contato).
- **Harlan Greer (Knuckle V2):** Poder de fogo pesado e impacto. Projétil Pesado LV1–LV3. Especial: *Ruptura Nova* (onda de choque que anula projéteis hostis e causa 9.5 de dano em área).

### 2. Progressão pelas 5 Fases
1. **Fase 01 — Cinturão de Ferrugem:** Estaleiro orbital degradado. Chefe: *KRM-17 Excavator* (broca de mineração, torres e núcleo).
2. **Fase 02 — Mar de Vidro:** Dunas de cristal fundido. Chefe: *Serpente de Extração* (corpo segmentado, fragmentos radiais de vidro).
3. **Fase 03 — Catedrais Vivas:** Fábrica de suporte vital reconfigurada. Chefe: *Fortaleza de Núcleos* (barreira absorvente, núcleos superiores e inferiores).
4. **Fase 04 — Nuvem de Íons:** Plataformas na alta atmosfera sob tempestade. Chefe: *Interceptador de Tempestade* (minas de íons e railgun elétrico telegrafado).
5. **Fase 05 — Coração da MALHA:** Central de processamento. Chefe: *Coração da MALHA* (ondas de pulso do Wake com lacunas seguras e desativação da diretriz destrutiva).

### 3. Persistência e Salve (SaveSystem)
- Versionamento automático de dados (`bullet_wake_save_data_v1`).
- Desbloqueio progressivo de fases (1 a 5).
- Registro de melhores pontuações por fase e por piloto.
- Preferências de áudio (SFX, BGM, volume).

### 4. Verificação de Performance e 60 FPS
Medição em combate automatizado via Headless Chrome:
- **FPS Médio:** 60.1 FPS (meta 60 FPS)
- **Frame Time Médio:** 16.64 ms (meta ~16.6 ms)
- **Percentil 95% e 99%:** 16.8 ms
- **Consumo de Memória JS Heap:** 22 MB estáveis
- **Erros de Textura:** 0 erros registrados

### 5. Diretriz Oficial de UI, HUD e Seleção de Pilotos (docs/24_DIRETRIZ_UI_HUD_MENUS.md)
- **HUD 3 Zonas:** Zona A (Topo), Zona B (Campo Limpo), Zona C (Base compacta).
- **Seleção de Pilotos (Espírito Sonic Wings):** Retrato do piloto em destaque, callsign tático, especial e nave subordinada.
- **Tipografia:** Máximo de 2 famílias (`Orbitron` e `Chakra Petch`).
- **Vitalidade de Inimigos:** Zero poluição no campo; barras somente para chefes no HUD superior.
