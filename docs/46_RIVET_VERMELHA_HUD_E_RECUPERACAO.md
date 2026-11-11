# Fase 1 — RIVET vermelha, HUD e punição por morte

Revisão de 11/11/2026. Escopo: Fenda Pelágica. Complementa a [integração do chefe e do áudio](44_CHEFE_RIVET5_ESCALA_E_NU_METAL.md); substitui suas regras de cor da RIVET e recuperação de potência.

## Alterações

- **Bayek/RIVET:** poses pintadas de rolagem para esquerda e direita, com retorno ao repouso. O nariz continua ao norte, sem girar a câmera ou o eixo de tiro. O bico permanece registrado na mesma âncora; colisão acompanha o alfa do frame exibido. A arte reta e a escala de 34 unidades foram preservadas.
- **Dispersão Vermelha:** nova sheet de oito quadros, projétil individual vermelho com núcleo claro. Corpo e comprimento aumentam nos cinco níveis, com crescimento maior no NV3. Preservadas as salvas 1/2/3/6/7 e os dois mísseis no NV3/NV4, três guiados no FULL. Cadência e dano-base não foram aumentados; o raio de contato acompanha o corpo visível. A KNUCKLE continua com seu laser próprio; KESTREL/PEREGRINE continuam azuis.
- **Vidas no HUD:** corrigido o deslocamento existente dentro da sheet original. Os quatro quadros foram registrados e agora alternam como imagens inteiras, com tamanho/posição fixos. Os frames são carregados antecipadamente; não há deslocamento interpolado da imagem de fundo.
- **HUD:** trajeto da missão passou para a esquerda, acima da pontuação. Pausa com ícone acessível, sem o texto “Pausar / Opções”. Rádio em caixa logo abaixo do armamento, mais alto; borda e fala vermelhas ao transmitir, neutras ao aguardar. As laterais em carbono permanecem.
- **Paraquedas:** sequência nova de oito quadros a 8 fps; tecido ondula e cordas acompanham o movimento. Caixa registrada pelo centro inferior, sem pulsação de escala. Conservados roteiro, quantidade de suprimentos e coleta por contato.
- **Morte:** potência e medidor voltam ao NV1/0 P. Se havia progresso de arma, cai **um único P comum**. Recolhê-lo soma um P; não guarda nem restaura o antigo nível. Morrer sem progresso não gera P. Continue também retorna ao NV1/0 P, sem NV2 gratuito ou reserva oculta. Estoque de especiais não é reabastecido pela morte.

## Referência e escolhas de balanceamento

O [manual original de Aero Fighters/Sonic Wings para SNES](https://manuals.plus/m/a161d0191efce5685e3a7c11d1757c8423ec42c8fa2fa398412bb7d8fe4493ed.pdf), página impressa 3, diferencia **Power Up** de **Full Power Up**. A recuperação normal de Bullet Wake agora é um P comum; não equivale ao item de potência máxima.

O manual não fornece contagem de frames, dimensões dos tiros, ângulos do leque ou fórmula numérica do drop após a morte. Os cinco estágios, custo 2/2/2/3 P, tamanhos e limite de um P recuperável são a calibração de Bullet Wake solicitada nesta revisão; não são apresentados como reprodução medida da ROM. As capturas enviadas pelo usuário orientaram a leitura de força/cobertura dos níveis e dos mísseis. O raio maior dos tiros altos foi conferido com os alvos reais do combate.

## Arte final e reprodução

Geração pelo **image_gen nativo**, seguida apenas de recorte das células, redimensionamento e registro das âncoras, preservando transparência e pintura. [Prompts completos e caminhos finais](47_PROMPTS_RIVET_VERMELHA.json). Montagem: [assemble-rivet-red.py](../scripts/assemble-rivet-red.py).

- [RIVET esquerda/direita](../public/assets/combat-hd/rivet-bank.webp): oito células de 256×256, quatro colunas e duas linhas.
- [Tiro vermelho](../public/assets/combat-hd/polish/rivet-red.webp): oito células de 128×128.
- [Paraquedas](../public/assets/combat-hd/supply-parachute-v2.webp): oito células de 256×256.
- [Quadros registrados das vidas](../public/assets/combat-hd/hud/): quatro imagens de 64×64 por piloto.

## Validação

- **192 testes passaram.** Cobrem perda de potência/medidor, drop limitado e ausência de ganho indevido, Continue para os cinco pilotos, rolagem equivalente a 30/60/120 Hz e crescimento da apresentação do tiro.
- **Build e TypeScript passaram.** Permanece o aviso conhecido de tamanho do bundle de Phaser.
- Navegador de produção em **1366×768 e 1920×1080**: HUD sem corte/overflow, rádio vermelho, pausa, três poses e cinco estágios de tiro; origem de disparo alinhada ao bico, paraquedas com oito quadros; perda de vida e coleta de um P comum para os cinco pilotos. Zero erros de navegador.
- Registro de alfa/âncoras: 20 imagens de vida, oito frames laterais, oito de tiro e oito de paraquedas. Variação residual do centro dos ícones de vida menor que meio pixel de tela em 1366×768, causada pelo contorno pintado; posição do slot permanece idêntica.

[Validação visual](screenshots/phase1-rivet-red/visual-validation.json) · [Partidas completas e regressões](screenshots/phase1-rivet-red/validation.json) · [Registro das imagens](screenshots/phase1-rivet-red/asset-validation.json).

| Partida automatizada | Duração | Mortes | Resultado |
|---|---:|---:|---|
| Bayek, coletando os nove P | 3min13s | 0 | FULL, fase concluída |
| Tita | 3min29s | 1 | NV3, fase concluída |
| Leona | 3min36s | 2 | NV3, fase concluída |
| Osvald | 3min41s | 0 | NV4, fase concluída |
| Hien | 4min55s | 3 | NV1, fase concluída |
| Bayek, deixando três P | 3min21s | 0 | NV4, fase concluída |

As partidas usam movimento, tiros, coleta e especiais com vida real do jogo, sem invulnerabilidade ou potência injetada. As verificações isoladas de poses/níveis usam estados de teste. A tentativa de Hien demonstra que morrer e perder potência pode ultrapassar quatro minutos; o alvo de 2–4 minutos continua destinado a uma partida sem mortes/repetições. A dificuldade percebida e o equilíbrio entre pilotos ainda dependem da avaliação humana.

A água continuou animada com o scroll parado; os especiais mantiveram o dano sincronizado aos impactos. Controle padronizado passou na simulação virtual. Esta rodada não constitui validação com controle físico, aprovação visual do usuário ou nova aprovação sonora. Áudio não foi alterado.
