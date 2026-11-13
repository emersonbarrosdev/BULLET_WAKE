# Arte e áudio — procedência da reformulação arcade

## Assets de produção

A arte raster foi criada com geração nativa de imagem para este projeto. As versões finais usam transparência nativa; não foi usado chroma key nem remoção de fundo por Python. Pillow realiza somente corte, registro dos quadros, redimensionamento e empacotamento WebP. As fontes originais ficam no diretório local do gerador; os atlas finais estão versionados.

O [manifesto](../public/assets/arcade/manifest.json) registra nomes das fontes nativas, tamanho dos quadros, grade, alpha e bytes. [Empacotador](../scripts/pack-arcade-art.py). A localização das fontes no script é específica da máquina de autoria; não é necessária para builds normais.

| Atlas | Conteúdo e direção aplicada |
|---|---|
| rivet | Oito poses UP/SIDE, casco branco e vermelho, três motores, cel shading e contorno azul-escuro |
| enemies | Dezesseis quadros, oito famílias nas duas perspectivas; unidades de superfície com encaixes vazios para canhões móveis |
| boss | Oito módulos: plataforma naval, configuração ampliada, miniboss, canhão UP, dirigível, transportador, canhão SIDE e hélice |
| pilots | Bayek em quatro expressões; Tita ruiva, Leona negra brasileira, Osvald russo e Hien japonês |
| scenery | Ilhas, costa, porto, fenda, nuvens, cidade, ponte e indústria |
| explosion | Dezesseis quadros: impacto branco/amarelo, estrela laranja, fumaça estilizada, faíscas e dissipação |
| ufo | Disco divertido verde-limão/magenta, piloto alienígena expressivo, duas poses UP e duas SIDE |
| ocean | Textura de água tropical, duas camadas com movimento contínuo e velocidades diferentes |

A especificação visual usada na geração pede arte original de videogame 2D cartoon/anime, cores vibrantes, contorno limpo, projeção correta, objetos inteiros centralizados, margem entre quadros, ausência de texto e fundo transparente. A folha do disco pede explicitamente quatro células 2×2, vista superior na primeira linha e lateral olhando à esquerda na segunda. As fontes nativas da RIVET e do chefe tiveram edição adicional para transparência; inimigos tiveram edição para remover armas pintadas e criar encaixes modulares. Não confundir esta descrição de produção com um log literal completo de todos os prompts anteriores.

O logo é SVG original, construído por [gerador próprio](../scripts/arcade-logo.mjs), com seis variantes. A sprite vermelha aprovada da RIVET e os mísseis anteriores foram reutilizados, sem substituir a identidade do tiro.

## Música

[Compositor e renderizador](../scripts/compose-arcade.py): oito composições MIDI originais, com motivos e arranjos distintos; renderização FluidSynth/GeneralUser GS e conversão FFmpeg para OGG. Refrões, variações e pontes são compostos no script, sem extrair melodias dos jogos de referência. [Partituras e duração](../public/assets/audio/arcade/score.json).

Instrumentos GeneralUser GS de S. Christian Collins; [licença incluída](../public/assets/audio/arcade/LICENSE-GeneralUser.txt), que permite uso musical comercial. SoundFont e binários de autoria não integram o download do jogo. Recursos já renderizados dispensam ferramentas externas no build.

Menu e intro compartilham tema; seleção e resultados compartilham tema; cada miniboss compartilha o tema do chefe da sua missão. As duas fases e seus chefes possuem composições diferentes. Vitória e derrota têm peças curtas sem loop. Música inicial 18%, ganho final 0,52; efeitos configurados separadamente. A música pausa e retoma na mesma posição.

Efeitos de UI, esferas, canhões, impactos, explosões e especial são síntese Web Audio original com envelope curto e limites de repetição. O canhão principal amostrado já aprovado permanece. Avaliação técnica de arquivos e transporte não equivale a aprovação auditiva pelo jogador.

## Referências

- [Aero Fighters — Arcade Archives](https://www.arcadearchives.com/en/title/aca-286/): referência oficial de apresentação arcade.
- [Fire Shark — Toaplan](https://www.toaplangames.co.jp/en/license/license-09.html): referência oficial do jogo.
- Curse é referência de direção lateral fornecida pelo usuário. Não foi feita engenharia reversa de ROM nem atribuídos valores exatos de balanceamento aos jogos.
