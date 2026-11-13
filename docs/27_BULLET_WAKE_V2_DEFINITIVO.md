# BULLET WAKE — Bíblia vigente

Revisão de 13/11/2026. A [direção arcade aprovada](54_DIRECAO_ARCADE_APROVADA.md) substitui regras conflitantes das revisões anteriores. A [Bíblia de 11/11](archive/2026-11-11-biblia.md) permanece como histórico.

## Identidade e escopo

Arcade 2D cartoon/anime alegre, colorido, legível e original. Cel shading, contornos escuros, amarelo, turquesa, coral, violeta e verde-limão. Sem horror, biomecânica grotesca, realismo fotográfico ou UI cinematográfica escura. Sonic Wings/Aero Fighters e Fire Shark orientam ritmo/progressão; Curse orienta obstáculos laterais. Não copiar arte, personagens, áudio ou valores de ROM.

Duas missões completas com Bayek/RIVET: Fenda Pelágica (UP) e Cidade Solar (SIDE). Meta 5–7 minutos, mínimo cinco minutos de gameplay relevante. O relógio de roteiro não substitui a duração real do confronto. Logo principal/claro/escuro/reduzido e palavras separadas para abertura animada de sete segundos, pulável. Menus, resultados e derrota seguem a mesma identidade.

## Pilotos preservados

| Piloto | Identidade | Nave | Motivação |
|---|---|---|---|
| Bayek | Egípcio, protagonista | RIVET | Irmão desaparecido e honra após salvar civis |
| Tita | Ruiva | MOTH | Encontrar a mãe pesquisadora |
| Leona | Mulher negra brasileira | KESTREL | Encontrar o pai e manter a clínica |
| Osvald | Russo | KNUCKLE | Resgatar a filha e aprender a ouvi-la |
| Hien | Japonês | PEREGRINE | Encontrar a esposa e enfrentar a culpa pela retirada |

IDs nolan/cora/lyra/harlan/bento preservam compatibilidade de saves. Somente Bayek/RIVET é selecionável nesta reformulação. Os outros retratos e registros existem, mas seus novos armamentos UP/SIDE não são escopo desta etapa. Sistemas e conteúdo legados continuam no repositório, fora do fluxo inicial.

## Perspectivas e combate

- UP: arte ortográfica superior, arena vertical central e laterais decorativas. Unidades de superfície recebem tiros, mas não colidem fisicamente com o jogador.
- SIDE: arte lateral própria, arena horizontal, prédios e céu em parallax. Estruturas, portões e barreiras possuem colisão visível e passagem possível.
- RIVET branca/vermelha, três propulsores, poses de inclinação e exaustão nas duas perspectivas. Não obter a vista lateral girando uma sprite superior.
- Simulação fixa a 120 Hz, apresentação alvo 60 FPS. LOW/MED/HIGH mudam apenas decoração e efeitos, nunca dano ou colisão.
- Dez famílias: caça, interceptador, acrobata, bombardeiro, lancha, navio, tanque, torre, dirigível e disco alienígena divertido. Dez movimentos e dez formações, combinados em roteiros próprios.
- Todos os tiros hostis são esféricos. Tamanho, velocidade e padrão distinguem a ameaça; avisos precedem disparos de canhões. Flash vermelho curto ao receber dano, explosões cartoon de 16 quadros, explosões em camadas para alvos grandes e queda breve de aeronaves abatidas.

## Armas, recursos e controles

Rajada Escarlate conserva sprite e som aprovados. Uma pressão produz três pulsos espaçados em 65 ms. Toques permitem reinício a cada 280 ms; segurar repete em 380 ms após a primeira rajada. A opção de disparo acessível permite 280 ms ao segurar.

RIVET evolui com 2/2/2/3 P: nove P até FULL. Níveis 1–5: 1/2/3/6/7 projéteis por pulso; dois mísseis automáticos no NV3/NV4 a cada 1,5 s; três guiados no FULL a cada 1,1 s. P não troca a arma para outro conjunto.

Tormenta Escarlate: corredor frontal de plasma durante três segundos. Dano somente ao alvo atingido, orçamento de 120 sob contato contínuo. Impacto acompanha o alvo real, flash e explosões locais. Proteção durante o especial e limpeza de balas próximas, sem coletável de escudo.

Início com 3 vidas e 2 especiais; limites 5/5. Recursos no máximo rendem pontos, sem estoque oculto. Cada roteiro possui onze caixas: nove P, uma vida e um especial. Destruir a caixa libera um item que quica nas bordas durante 24 segundos. Ao morrer: NV1, medidor zero, três segundos de proteção e um único P comum se havia potência. Nenhuma restauração instantânea de FULL ou reabastecimento de especial.

A fase seguinte conserva potência, P parcial, vidas, especiais e pontos. O save guarda a saída de cada fase separadamente; salvar Cidade Solar não apaga a saída da Fenda. Selecionar Cidade Solar pode retomar o snapshot da Fenda. Reiniciar após derrota usa o kit inicial.

Teclado: WASD/setas, Espaço, X, Esc. Controle padrão: analógico/direcional, botão inferior para tiro, botão esquerdo para especial e Start/Menu para pausa, com rótulos adaptados. Touch: joystick, tiro, especial, pausa. Sem dash, carga, míssil manual, bomba separada ou tutorial obrigatório. Controle físico e Android real exigem validação em dispositivo.

## Roteiros

| Trecho | Fenda Pelágica — UP | Cidade Solar — SIDE |
|---|---|---|
| 0–45 s | Mar aberto e primeiras formações | Horizonte e formações laterais |
| 45–90 s | Costa, lanchas e torres | Avenida, tanques e dirigíveis |
| 90–135 s | Arquipélago e escoltas | Pontes, obstáculos e portões |
| 135–155 s | Corrente acelerada, ameaça reduzida | Via expressa, ameaça reduzida |
| A partir de 155 s | Miniboss naval de três canhões | Miniboss transportador lateral |
| 200–255 s | Patrulhas e superfície | Distrito industrial e barreiras |
| 255–300 s | Fenda e escalada final | Altos da cidade e escalada aérea |
| Após 300 s | Encouraçado Pula-Onda | Mega Dirigível Giro |

Pula-Onda: três armas independentes; fuga após destruição, cinco segundos inteiros ausente e retorno ampliado com seis armas. Scrolling desacelera/paralisa; a água continua animada. Casco não absorve tiros destinados às armas nem distribui dano à peça mais próxima. Leques lentos, pares mirados, salvas rápidas e grandes esferas radiais alternam aviso, ataque e pausa. Destruição em camadas e saída automática da RIVET.

Giro: dirigível lateral, deslocamento vertical, hélices e três baterias independentes. Salvas frontais/miradas e ataque esférico anunciado. Sem fuga naval ou segunda configuração copiada da Fenda. Armas destruídas deixam de disparar; inclinação e explosões na queda. Resultados e encerramento das duas missões.

Normal exige leitura dos padrões. Difícil acrescenta escoltas a alvos isolados e intensifica cadência/velocidade sem inflar HP. A quantidade de caixas é deliberada; perder potência exige recuperação. Avaliação humana de diversão permanece necessária além dos testes técnicos.

## Áudio e interface

Oito composições originais atendem doze contextos: menu/intro, seleção/resultados, fase 1, chefe/miniboss 1, fase 2, chefe/miniboss 2, vitória e derrota. Arranjos melódicos com baixo, percussão, marimba/steel drum e sintetizadores; nu metal e trilha militar não são o padrão atual.

Música começa em 18%, com ganho adicional de mixagem 0,52, abaixo dos efeitos. Ambos são ajustáveis. Pausa preserva cursor; navegar nas opções não religa a música. Vitória/derrota não repetem. UI, esferas, canhões, impactos, explosões e especial usam síntese curta original; o canhão aprovado da RIVET foi preservado.

HUD com pontos, potência, ícones de vidas/especiais, pausa e rota. Sem integridade nem barra do chefe sobre a arena. Rádio breve em acontecimentos, sem chat permanente. Pausa mantém o fundo e oferece continuar, controles, opções e saída com confirmação.

## Futuro — somente metadados

Campanha principal, sexto piloto exclusivo SIDE após a campanha, campanha adicional e Remix com rotas alteradas. Três secretas: SIDE 120 s, UP 180 s e UP 180 s. Condições secretas indefinidas; terminar estas duas missões não significa concluir a campanha ainda não produzida.

## Implementação e evidência

[Motor](../src/game/arcade/ArcadeWorld.ts), [roteiros](../src/game/arcade/content.ts), [apresentação](../src/game/arcade/ArcadeScene.ts), [áudio](../src/game/arcade/ArcadeAudio.ts), [save](../src/game/arcade/progress.ts). O [relatório de validação](55_ARCADE_IMPLEMENTACAO_E_VALIDACAO.md) separa simulação, navegador, desempenho e limitações de avaliação humana/dispositivos.
