# Fase 1 — revisão visual focada na RIVET

> **Atualização:** Raia-Dente, Talassarca e os efeitos auxiliares da RIVET foram produzidos na [revisão de combate](31_FASE1_REVISAO_COMBATE.md), que substitui suas pendências de arte e as regras conflitantes deste registro.

Data: 09/11/2026. Etapa visual, sem avanço à Fase 2.

## Escopo entregue

- Cenário da Fenda Pelágica pintado em 2D: recifes alienígenas nas laterais, água escura no centro e rolagem contínua. O segundo trecho da textura é espelhado verticalmente em runtime para conectar as bordas sem linha de emenda.
- HUD do Nolan com os materiais bordô/âmbar, o retrato ilustrado, Oxanium e Rajdhani das telas iniciais. Telemetria preservada nas laterais, fora do corredor de 432 unidades.
- RIVET de combate com casco branco, detalhes vermelhos, três motores e vista superior. Quatro frames próprios: voo A/B e inclinação esquerda/direita. A imagem de menu não é usada como sprite de combate.
- Quatro inimigos comuns com spritesheets próprios: Agulha Pelágica, Raia de Fenda, Parasita Abissal e Casulo Marinho. Cada sheet contém quatro poses diferentes de voo, carga e recuperação, com transparência e margem de segurança.
- Dispersão Azul do Nolan com projéteis nítidos, mantendo 3/5/7/9 direções nos níveis 1/2/3/4. Removida a sobreposição dos antigos chevrons vetoriais sobre as novas lanças.
- Bomba, impactos e explosões do Nolan com animação pintada de quatro estágios. Bomba sem flash branco cobrindo a tela inteira; balas hostis continuam desenhadas acima dos efeitos.
- Cápsulas pintadas com símbolos e cores distintos: P, P★, W azul/verde/rubro, H, B, M, S e E. As letras são renderizadas pelo jogo para permanecerem legíveis.
- Framebuffer 1920×1080 exclusivo do combate do Nolan; câmera em 2,5× mantém o mundo lógico em 768×432. O framebuffer retorna ao padrão ao sair/reiniciar a cena. Toque é convertido para coordenadas de mundo.

Moth e Knuckle mantêm seus renderizadores, armas, efeitos de bomba e HUD anteriores. As telas iniciais e a seleção de pilotos permanecem intactas. Dano, colisões, velocidades, cooldowns, três dashes por fase e três itens P por nível não foram rebalanceados.

## Inventário e produção

[Manifesto completo](../public/assets/combat-hd/manifest.json). Assets finais em [combat-hd](../public/assets/combat-hd/):

| Arquivo | Dimensões | Uso |
|---|---|---|
| [rivet.webp](../public/assets/combat-hd/rivet.webp) | 1024×256 | Quatro frames da RIVET |
| [scout.webp](../public/assets/combat-hd/scout.webp) | 1024×256 | Agulha Pelágica |
| [dart.webp](../public/assets/combat-hd/dart.webp) | 1024×256 | Raia de Fenda |
| [lancer.webp](../public/assets/combat-hd/lancer.webp) | 1024×256 | Parasita Abissal |
| [cutter.webp](../public/assets/combat-hd/cutter.webp) | 1024×256 | Casulo Marinho |
| [bomb.webp](../public/assets/combat-hd/bomb.webp) | 1024×256 | Ignição, expansão, onda e dissipação |
| [ocean.webp](../public/assets/combat-hd/ocean.webp) | 1024×1536 | Ambiente oceânico |
| [capsule.webp](../public/assets/combat-hd/capsule.webp) | 256×256 | Invólucro dos power-ups |

Arte criada com a ferramenta integrada `image_gen`, uma geração por asset. A Raia recebeu uma edição adicional para reconstruir as pontas e ampliar as margens. O [importador](../scripts/import-combat-art.mjs) usa FFmpeg para empacotar cada grade 2×2 em uma faixa RGBA de quatro frames; não redesenha os personagens. Os scripts antigos de pixel art não sobrescrevem estes arquivos.

### Conjunto de prompts de produção

Direção comum: concept art 2D pintada, materiais foscos, silhueta legível em pequena escala, luz superior esquerda, vista ortográfica superior, sem texto, cenário ou moldura nos sprites e fundo alfa real. Sheets em grade 2×2 com o mesmo centro e escala; poses realmente distintas.

1. **RIVET:** usar somente a identidade da nave de menu aprovada como referência. Nariz para norte, casco branco, asas angulares vermelhas, canopy âmbar e exatamente três motores ao sul. Voo com chamas curtas/longas e duas inclinações laterais suaves.
2. **Oceano:** Fenda Pelágica, recifes biomecânicos e rochas nas bordas, água azul-petróleo escura no centro, bioluminescência ciano/esmeralda restrita às margens. Sem naves, horizonte, estrelas, linhas de wireframe, UI ou obstáculos centrais. Composição vertical para rolagem.
3. **Agulha:** interceptador biomecânico esguio, carapaça vinho/coral, aletas curvas, nervuras ósseas e órgão laranja. Voo recolhido/aberto, carga e recuperação. Frente ao sul.
4. **Raia:** manta alienígena cinza-azulada, membranas corais, núcleo magenta, cauda ao norte e cabeça ao sul. Quatro articulações de asas; edição final com criaturas menores dentro das células e pontas completas, sem corte.
5. **Parasita:** organismo cefalópode de carapaça índigo/ameixa, núcleo magenta, tendões claros e tentáculos curtos. Quatro poses de extensão e recolhimento, carga e recuperação. Frente ao sul.
6. **Casulo:** portador oval blindado em quitina ocre/âmbar, placas sobrepostas, espinhos de marfim e fenda incubadora laranja. Estados fechado, expansão, carga com fenda aberta e recuperação. Sem tanque ou veículo humano.
7. **Bomba:** quatro estágios radiais pintados, pequena ignição, expansão âmbar, anel largo e dissipação fragmentada; centro transparente nos últimos frames, sem nuvem opaca de tela inteira.
8. **Cápsula:** invólucro hexagonal isolado de metal claro gasto, grampos de latão, centro de vidro grafite e pequenas luzes âmbar. Sem letras embutidas; o jogo sobrepõe símbolos e cores.

## Validação

- `npm run build`: aprovado, incluindo TypeScript; aviso preexistente de bundle acima de 500 kB.
- `npm test`: 125 testes aprovados.
- `node scripts/validate-pilot-selection.mjs --stage1`: Chrome real no build de produção, 1366×768 e 1920×1080, HUD sem corte/scroll e alinhado ao canvas; contagens 3/5/7/9; coleta real de três P elevando NV1 a NV2; bomba consumindo uma unidade e removendo balas; movimento/disparo/dash; restauração da resolução e preservação das duas outras naves; saída sem HUD residual; zero erros de navegador.
- Auditoria dos sheets no navegador: seis faixas 1024×256, quatro frames distintos em cada uma e silhuetas sem tocar as bordas de suas células.
- [Capturas reais](screenshots/stage1-visual/) e [relatório](screenshots/stage1-visual/validation.json). As capturas de níveis e pickups usam o sandbox com posições controladas para comparar os assets; não são alterações no roteiro da fase.

## Limites desta etapa

Os sprites novos cobrem os quatro inimigos comuns. Raia-Dente e Talassarca continuam com a apresentação anterior e precisam de uma etapa própria de arte modular. Wave Cannon, mísseis e Tempestade Prismática mantêm suas artes anteriores; o foco de tiros desta revisão é a Dispersão Azul evolutiva. Nenhuma fase nova foi liberada.
