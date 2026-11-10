# Fase 1 — especificações de geração de arte

Direção dos prompts usada na revisão 31. Gerações raster originais com a ferramenta integrada `image_gen`, sem copiar sprites dos jogos usados como referência mecânica. O empacotamento posterior só recorta células regulares, redimensiona e converte; não redesenha o resultado.

Base comum para sprites: jogo arcade 2D premium, ilustração painterly de ficção científica, leitura nítida em pequena escala, luz coerente, sem render 3D plástico, fundo realmente transparente, sem cenário ou UI. Grade com células iguais, mesmo pivô e margens livres, quatro estados visualmente diferentes. Nave ao norte; criaturas ao sul.

| Geração | Especificação visual do prompt | Destino |
|---|---|---|
| Raia-Dente | Monstro aéreo alienígena tipo raia, carapaça azul-ardósia, lâminas marfim, canais ciano e núcleo magenta; silhueta de miniboss, duas asas completas e cauda. Grade 2×2: voo, flexão, preparação, ataque. Edição de enquadramento para caber inteiramente com margem. | [raia.webp](../public/assets/combat-hd/review/raia.webp), 4×512 px |
| Talassarca | Chefe colossal original, carapaça índigo/violeta, tentáculos e duas grandes pinças marfim, núcleo magenta. Grade 2×2: blindado, pinças abertas, tentáculos bioelétricos, núcleo exposto/avariado. Corpo completo e centro legível. | [talassarca.webp](../public/assets/combat-hd/review/talassarca.webp), 4×512 px |
| Artilharia de recife | Organismo radial ancorado à rocha, raízes e placas verdes, boca central, sem asas ou fuselagem. Grade 2×2: fechado, abertura, preparação luminosa, recuo. | [surface.webp](../public/assets/combat-hd/review/surface.webp), 4×256 px |
| Nadador | Serpente alienígena hidrodinâmica azul-petróleo, detalhes ciano, cauda bifurcada ao norte, focinho ao sul e pequenas nadadeiras peitorais. Distinta de raia voadora e torre. Grade 2×2: curva esquerda, reta, curva direita, boca carregada. | [swimmer.webp](../public/assets/combat-hd/review/swimmer.webp), 4×256 px |
| Itens | Metal gasto ilustrado, emblemas pequenos legíveis e cores diferentes, sem legendas ou placas. Grade 8×5, dois itens por linha, quatro frames por item. Ordem: P ouro / W azul; W verde / W vermelho; H branco / B âmbar; S pervinca / $ turquesa; M aço / E violeta. | Dez strips `pickups-*`, 4×64 px |
| Balas hostis | Grade 4×6, quatro estados por linha: agulha coral, gota azul, esporo magenta, crescente âmbar, glóbulo ácido verde, anel gelado ciano. Núcleo legível, diferenças de contorno, brilho contido, sem névoa que esconda o campo. | Seis strips `hostile-*`, 4×64 px |
| Efeitos RIVET | Grade 4×6: projétil azul, filamento espiral verde, segmento de chama vermelha, míssil branco/vermelho, lança carregada azul/violeta, explosão âmbar. Quatro fases por efeito; orientação ao norte e alpha limpo. | Seis strips `effects-*`, 4×128 px |
| Tempestade Prismática | Especial original arcade: três lanças frontais azul/violeta, asas crescentes de energia e canais transparentes, sem nave desenhada no efeito. Grade 2×2 com ativação, expansão, tempestade e dissipação; pivô estável. | [special.webp](../public/assets/combat-hd/review/special.webp), 4×256 px |
| Superfície oceânica | Vista aérea vertical sobre oceano escuro, ondas/espuma/esteiras visíveis, recifes alienígenas emergindo e destroços nas bordas; centro de baixa complexidade para combate. Não representar fundo do mar ou nave submersa. Imagem vertical opaca, sem texto, inimigos ou UI. | [ocean.webp](../public/assets/combat-hd/review/ocean.webp), 1024×3072 px |

Empacotador: [import-phase1-review.mjs](../scripts/import-phase1-review.mjs). Exemplo: `node scripts/import-phase1-review.mjs talassarca CAMINHO_DA_GERACAO.png`. A geração não é reproduzida durante build/test: os WebP finais versionados são os assets de execução.
