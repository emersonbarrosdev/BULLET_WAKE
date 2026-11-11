# 12 — Pipeline de assets e inventário

> Estado vigente: [Bíblia V2](27_BULLET_WAKE_V2_DEFINITIVO.md) e [revisão de ritmo/elenco/contornos](38_RITMO_ELENCO_E_CONTORNOS.md). As definições históricas abaixo não substituem quatro pilotos, três vidas sem barra, especial único, ausência de dash/carga/míssil manual e foco exclusivo na Fase 1.

## Fluxo de produção
Brief funcional → desenho de silhueta monocromático → aprovação de perfil lateral → paleta de material → frames-chave → inbetweens → PNG RGBA → manifesto/atlas → preview em jogo → QA screenshots/vídeo → revisão → commit com arquivo fonte.

## Entrega por nave
Cada uma (Rivet, Moth, Knuckle) exige: portrait do piloto, idle 4 frames, pitch-up 3, climb 3, pitch-down 3, dive 3, boost 4, muzzle 2, hit 2, shield 4, destruction 8, especial com FX próprios. Os números são alvo inicial; FPS e composição visual aprovados pelo preview, não só pelo número de arquivos.

## Entrega por inimigo
Scout, Dart, Swarm, Lancer, Cutter, Mirror, Bulwark, Mortar, Crusher, Rail Node, Beam Gate, Vertebra e Carrier: idle, movimento, telegraph, ataque, hit, destruição; anchors/hitbox. Bosses em módulos animados (não uma imagem gigante imóvel), com peças danificáveis, estados de abertura, charge e morte segmentada.

## Entrega por fase
4 planos de parallax na vertical slice inicial (distante, médio, próximo e colisão), tiles/obstáculos, estruturas com animação local, hazards, 1 set de variantes inimigas e 1 boss. 5 biomas têm elementos próprios, mas materiais e efeitos compartilháveis com regras claras de paleta.

## Convenções
Sprites transparentes, frame size e pivot registrados, material-fonte editável, nome de arquivo em snake_case/inglês; manifest JSON versionado. Ex.: `public/assets/ships/rivet/idle.png`; `public/assets/ships/moth/dive.png`; `public/assets/bosses/excavator/drill.png`; `public/assets/fx/impact_small.png`.

## Otimização e licenças
Atlas por missão, carregamento sob demanda e pool de explosões. Não incorporar imagens da web ou de outros jogos como recursos de release; assets precisam ter autoria ou licença verificada. Manter uma lista de créditos e origem por arquivo. Não compartilhar fontes de terceiros sem licença.

## QA de assets
Alfa transparente correto, frame não cortado, pivô estável, animações não duplicadas, silhueta em preto e branco distinta, preview sobre fundo claro/escuro, 1x/4x sem suavização, emissor correto em todos os estados, sem FX que esconda bala. Se algum requisito falhar, asset ainda não é final.
