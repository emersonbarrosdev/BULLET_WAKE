# Fase 1 — prompts do polimento orgânico

Assets raster originais gerados pela ferramenta integrada `image_gen`, sem CLI/API externa e sem reutilizar imagens dos jogos de referência. Abaixo estão as especificações normalizadas do conjunto de prompts selecionado. As versões de aeronaves, dirigível mecânico e fortaleza mecânica foram descartadas e não entram no jogo.

> A explosão e a transparência dos projéteis receberam revisão posterior. Seus prompts e destinos vigentes estão em [Polimento de contato, água, áudio e explosões](35_FASE1_POLIMENTO_CONTATO_AGUA_AUDIO.md#assets-finais-e-prompts).

## Prompt-base de criaturas

> Production animation sprite atlas for BULLET WAKE, premium hand-painted illustrated 2D arcade shooter, matte painterly 2.5D concept art, true orthographic top-down, head points down. LIVING EXTRATERRESTRIAL ORGANISMS, no spaceship, conventional aircraft, metal machine, cockpit, thruster, gun, clock, tank, gothic skull or Void creature. Every cell has the same centered core anchor, camera, scale and lighting. Animate actual joints, fins, gills, mandibles and tendrils, never whole-body squash/stretch. Keep the complete silhouette inside each equal-sized cell. Genuine transparent alpha outside the organisms, no white/gray matte, backdrop, shadow, text or grid lines. Crisp readable colors and silhouettes at gameplay scale.

## Conjunto selecionado

| Grupo / grade original | Direção específica adicionada ao prompt-base | Assets finais |
|---|---|---|
| Quatro voadores / 8×4 | Oito poses por espécie. Agulha rubi de quitina com três mandíbulas marfim e membranas vermelhas; larva âmbar com quatro flippers articulados; parasita-raia roxo com três olhos e plasma violeta; trilobita laranja de carapaça marfim com brânquias e seis membros. Corpo constante, nadadeiras e mandíbulas articuladas. | [scout](../public/assets/combat-hd/polish/scout.webp), [dart](../public/assets/combat-hd/polish/dart.webp), [lancer](../public/assets/combat-hd/polish/lancer.webp), [cutter](../public/assets/combat-hd/polish/cutter.webp) |
| Aquáticos / 8×2 | Dois organismos ancorados, oito estados por linha: espuma, emergência, abertura, aviso, disparo, retração, submersão e espuma. Bivalve com glândula ácida verde e pólipo/anêmona rubi com boca âmbar; sem canhão mecânico, fuselagem ou propulsores. Linha d'água e espuma, fundo transparente. | [surface](../public/assets/combat-hd/polish/surface.webp), [ambush](../public/assets/combat-hd/polish/ambush.webp) |
| Transportador / 4×2 | Casulo vivo translúcido, bexiga âmbar assimétrica com costuras de quitina coral, vesículas nutrientes luminosas visíveis dentro, quatro barbatanas e cílios verde-petróleo, tentáculos curtos para baixo. Voo orgânico baixo; não é balão ou dirigível mecânico. | [carrier](../public/assets/combat-hd/polish/carrier.webp) |
| Raia-Dente / 4×2 | Raia alienígena viva, corpo largo vermelho/cobre, membranas violeta-avermelhadas, presas marfim, órgãos branquiais laranja e pequenos tendrilos posteriores. Oito batidas articuladas de nadadeiras, abertura de mandíbula e preparação/disparo de plasma. | [raia](../public/assets/combat-hd/polish/raia.webp) |
| Talassarca externo / 4×2 | Casulo colossal com placas naturais marfim/peroladas, coral ferrugem, grandes nadadeiras laterais blindadas, seis membros de crustáceo, costuras bioluminescentes ciano, olhos âmbar e boca ao sul. Abriga uma criatura maior; oito poses articuladas, sem mudar o torso. | [talassarca](../public/assets/combat-hd/polish/talassarca.webp) |
| Talassarca interno / 4×2 | Referência: forma externa. Torso muscular vinho exposto, enormes membranas verde-petróleo/ciano, seis tendrilos, três olhos biológicos ciano, brânquias cobre/laranja e pequenos restos da carapaça nos ombros. Silhueta mais larga e agressiva da mesma espécie; oito poses com ondulações das membranas e movimento dos apêndices. | [inner](../public/assets/combat-hd/polish/inner.webp) |
| Metamorfose / 4×2 | Referências: externo e interno. Sequência progressiva: casca rachando; placas abrindo; placas e fragmentos se separando; torso exposto emergindo; membranas desdobrando; tendrilos abrindo; forma interna quase livre; forma interna completa. Centro estável, transformação anatômica real. | [metamorphosis](../public/assets/combat-hd/polish/metamorphosis.webp) |
| Explosão / 4×4 | Dezesseis quadros: ignição branca, fogo âmbar crescente, expansão com fragmentos, fumaça rolante e dissipação progressiva. Espalhar fragmentos entre quadros, sem círculo estático escalado. Alpha transparente. | [explosion](../public/assets/combat-hd/polish/explosion.webp) |
| Armas / 4×6 | Vinte e quatro desenhos, oito por família: par de projéteis ciano de núcleo branco; filamento longo de dupla hélice esmeralda; segmento vermelho/laranja de chama energética contínua móvel. Pivô estável, orientação ao norte, glows sem fundo opaco. | [blue](../public/assets/combat-hd/polish/blue.webp), [green](../public/assets/combat-hd/polish/green.webp), [fire](../public/assets/combat-hd/polish/fire.webp) |
| Especial / 4×2 | Tempestade Prismática original: três lanças ascendentes, central mais forte, feixes laterais abrindo como asas, plasma violeta externo, fraturas elétricas ciano e pequenas faíscas quentes. Oito frames com fluxo ascendente e varredura, origem inferior constante, sem nave embutida, sem anel ou laser geométrico parado. | [special](../public/assets/combat-hd/polish/special.webp) |

Os sprites selecionados de Raia-Dente, casulo transportador, casca, armas e especial receberam edição adicional com a ferramenta integrada para remover resíduos de fundo. Prompt de edição:

> Use case: background-extraction. Edit only the alpha/background of the exact supplied atlas. All blank space outside the subject silhouettes must be completely transparent, not translucent white, beige or gray. Preserve the exact grid, frame positions, dimensions, camera, colors and animation poses. Preserve actual ivory anatomy and white-hot energy cores; keep colored membranes/glow naturally semitransparent. No new scene or artwork, no grid, checkerboard, floor or opaque rectangle. Clean production game cutouts suitable for dark ocean compositing.

## Prompt-base da água

> Environmental animation atlas for BULLET WAKE, premium hand-painted top-down 2D marine arcade game. Exact grid four columns by two rows, eight equal portrait cells, each 1:2 aspect ratio. All eight frames show the same ocean location at successive moments. Same camera, layout, scale and color palette. Animate actual foam, currents, ripples and refraction; do not turn the grid into a panorama. Full bleed cells, no borders/grid lines, text, UI, ships or enemies. Dark petrol-teal/navy ocean with layered depth and readable dark central navigation area, matte painterly 2.5D art rather than CGI or a flat blue pattern. Opaque background.

| Ambiente | Especificação | Destino |
|---|---|---|
| Calmo | Água oceânica profunda, ondulações e espuma discretas; sem fenda ou estruturas invasoras dominantes. | [ocean](../public/assets/combat-hd/polish/ocean.webp) |
| Invasão | Correntes agitadas, espuma e refração entre destroços parcialmente submersos de plataforma marítima nas bordas; raízes bioluminescentes alienígenas. Ainda sem fenda. | [turbulent](../public/assets/combat-hd/polish/turbulent.webp) |
| Fenda | Ruptura profunda alongada adiante, abismo escuro com corais/luz biológica ciano, água convergente e braços de espuma girando, estruturas marítimas quebradas às margens. Mesma posição da ruptura entre frames. | [rift](../public/assets/combat-hd/polish/rift.webp) |

## Empacotamento e integração

[import-phase1-polish.mjs](../scripts/import-phase1-polish.mjs) recorta as células regulares, preserva proporções e alpha e gera strips WebP horizontais. Não repinta anatomia, inventa frames nem substitui as gerações por vetores. Fundos usam células de 256×512; criaturas comuns 256×256; Raia-Dente 384×384; chefe e metamorfose 512×512; explosão 192×192; armas 128×128; especial 384×384.

[polishArt.ts](../src/game/assets/polishArt.ts) é o catálogo dos 19 spritesheets em execução. Cada um tem oito frames distintos, exceto explosão com dezesseis. Os ícones e balas hostis ilustrados da revisão anterior permanecem em uso; não são substituídos por letras ou círculos genéricos.

As gerações rejeitadas não são copiadas para o repositório. Os assets finais acima estão versionados e são carregados localmente; nenhuma geração ou acesso a ferramenta de imagem ocorre durante o jogo ou build.
