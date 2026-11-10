# Fase 1 — Normal, ritmo e polimento fino

Revisão de 10/11/2026. Prevalece sobre os números conflitantes das revisões anteriores. Escopo: gameplay da Fenda Pelágica e RIVET. A aprovação de sensação e dificuldade continua dependendo de partidas humanas completas.

## Pesquisa e decisão: um especial, sem bomba independente

O [manual de Fire Shark / Genesis](https://www.retrogames.cz/manualy/Genesis/Fire_Shark_-_Genesis_-_Manual.pdf) separa cápsulas coloridas de itens P e descreve três P por melhoria. A cadeia azul máximo → verde inicial → verde máximo → rubro inicial é uma decisão de Bullet Wake solicitada pelo usuário; não é atribuída ao original.

O [manual original de Sonic Wings 2, Video System 1994](https://db.hfsplay.fr/files/2019/06/14/1aa6199e-35d2-456a-8a2f-e3513f37594e.pdf), páginas impressas 7 e 9, apresenta um botão de disparo e outro de arma especial, com estoque e reposição por B. As páginas de aeronaves descrevem ataques especiais próprios de cada uma. O PDF foi inspecionado localmente porque o leitor web recusou seu tamanho de aproximadamente 10,9 MB.

**Decisão de design:** não adicionar uma segunda bomba com a mesma função de emergência. A Tempestade Prismática ocupa essa função: duas cargas iniciais, máximo três e somente uma reposição E na fase. O comando ativo é Especial; a compatibilidade antiga com o identificador de item `bomb` não cria estoque, botão ou drop independente.

## Ritmo e suprimentos

- Rolagem: 28 unidades/s, antes 34. O trajeto nominal até a arena leva cerca de 152 s, mais combate com Raia-Dente e a saída dos inimigos restantes.
- Doze transportadores, antes quatorze: nove P, uma oportunidade de reparo, uma carga E e uma cápsula final de evolução. Monstros comuns e miniboss não liberam itens.
- P nas distâncias 360, 740, 1130, 1540, 1980, 2420, 2860, 3300 e 3720. As oportunidades de NV2, NV3 e NV4 chegam após aproximadamente **40, 86 e 133 s de avanço**. Isso não inclui a pausa do trajeto no miniboss nem o tempo de abate e coleta.
- Reparação em 2140: oferece H se houver dano; com integridade completa, oferece S. A escolha é feita ao destruir o transportador e o item permanece físico. E aparece em 3140. A carga final em 4070 oferece verde somente se o azul já estiver no máximo; caso contrário oferece um P útil.
- O verde continua sendo conquista tardia. O vermelho não é distribuído no roteiro normal desta fase. Não existe troca prematura ou entrega automática para compensar item perdido.
- Transportadores não disparam de surpresa durante a aproximação para coleta. Seus caminhos e os inimigos próximos continuam exigindo deslocamento.
- Mais quatro pares de atacantes em entradas escalonadas e um bando adicional. Bandos permanecem frágeis, rápidos e sem disparos; inimigos individuais ganham resistência moderada.
- Ataques comuns têm intervalo de coordenação de 180 ms entre salvas principais. A mira é registrada durante o aviso e não acompanha o jogador até o último instante. Disparos nascendo fora da arena ou a menos de 70 unidades do jogador são descartados.
- O roteiro e novos transportadores ficam suspensos durante os chefes. A água mantém animação independente, evitando consumir suprimentos enquanto o jogador enfrenta Raia-Dente.

## Armas e função de cada ação

- Azul mantém 3/5/9/16 projéteis. NV1 e NV2 têm leques mais concentrados (±12° e ±27°); os demais ampliam cobertura. Esses ângulos são calibração própria, não medição da ROM.
- Cada projétil azul agora exibe um único dardo do atlas existente, alinhado com o ponto de colisão. Antes, um projétil lógico mostrava dois dardos.
- Cadência azul: 280 ms segurando / 160 ms em toques. Verde: 310 / 180 ms. Segurar continua mais lento, mas a diferença diminui e não exige oito apertos por segundo. RAPID conserva sua função de acessibilidade.
- Verde NV1 teve dano concentrado corrigido: a mudança de família não deve transformar uma recompensa em grande perda contra o chefe. O total por salva cresce de forma moderada nos níveis seguintes, preservando as hélices e o foco frontal.
- Míssil RIVET: impacto concentrado de 8 unidades de dano-base e recarga de 3,2 s; raio físico reduzido a 6 para acompanhar melhor sua imagem. Não limpa a tela.
- Carga: mantém a pausa no disparo normal e atravessa alvos alinhados. A colisão agora percorre todo o deslocamento do frame, ordena alvos pela distância e pode atingir vários no mesmo frame sem repetir dano no mesmo alvo.
- Especial: três salvas espaçadas por 800 ms, duração de 3 s, brilho mais contido; limpeza de balas e proteção durante a duração. Orçamento contra chefe continua 120 por ativação, independente do número de lanças. Casca 600 / forma interna 360 continuam equivalendo a cinco/três especiais, mas tiros comuns também vencem ambas.

## Chefes e recuperação

Raia-Dente passa de 45 para 140 HP, com movimento ligado ao tempo de simulação, aviso de 450 ms e mira travada antes da salva dirigida. Um especial não elimina o miniboss inteiro.

Talassarca conserva a casca e a metamorfose de 2,4 s. A forma interna alterna cortinas verticais com corredor de passagem que muda de posição e salvas dirigidas. O corredor exclui disparos a menos de 58 unidades do seu centro; ele não fecha a arena inteira. Os avisos da casca e do interior duram 450 e 550 ms. A mudança exige reposicionamento, não apenas lidar com mais velocidade.

Projéteis comuns, carga e míssil aplicam fator 0,55 contra chefes, corrigindo a discrepância em relação ao dano usado nos inimigos comuns. O especial mantém seu orçamento próprio.

Continue nos checkpoints a partir de 2100 garante azul NV2, preserva P parcial e cargas restantes, remove velocidade extra e oferece 2 s iniciais de proteção. Checkpoints anteriores mantêm a recuperação antiga. Repetir Continue não concede especiais nem aumenta o nível além desse piso; as ondas do trecho reiniciado continuam sendo rejogadas normalmente.

## Animação, contato, som e fluidez

- Ciclos com velocidades próprias por criatura e fases iniciais diferentes, evitando animação sincronizada de todos os organismos. Inimigos aéreos inclinam suavemente segundo a trajetória, sem comprimir/expandir o corpo.
- Três propulsores da RIVET animam separadamente dos frames de inclinação. Talassarca tem ritmo mais lento na casca e mais vivo na forma interna.
- Projéteis azuis/verde e hostis têm ciclos mais fluidos, preservando alfa e as cores das famílias. As artes existentes foram reaproveitadas. A tentativa de gerar um novo dardo via imagegen foi bloqueada pelo serviço e nenhum bitmap dessa tentativa foi integrado.
- Acertos em inimigos produzem destaque curto de 85 ms, substituindo o tingimento permanente. Dano no casco produz faíscas no contato e reação visual de 180 ms. Explosões rápidas e coleta física permanecem.
- Colisão contínua dos tiros do jogador contra elipses dos inimigos e chefes; projéteis rápidos não pulam alvos entre frames e tiros não perfurantes atingem o primeiro contato.
- Áudio da carga limitado a uma voz a cada 100 ms e disparos a cada 65 ms, com desconexão dos osciladores ao terminar. Mantidos sons separados para alienígenas, casco, escudo e coletáveis.
- O resolvedor de separação de inimigos encerra suas passagens quando não há mais interseções, em vez de repetir sempre 24 passagens.

## Validação e limites

Build de produção aprovado e 156 testes automatizados aprovados. As suítes de navegador de polimento, loading e balanceamento passaram em 1366×768 e 1920×1080, sem erros de navegador. Verificaram continuidade da água, transparência dos projéteis, contato no bico, coleta física única, descarte de efeitos, limites de vozes de áudio, transições de 2,5 s e os confrontos abaixo. As capturas de gameplay e briefing foram inspecionadas visualmente; isso não substitui jogar a fase completa.

Os [testes do Normal](../tests/phase1NormalPolish.test.mjs) verificam suprimentos, piso do Continue, ausência de reposição gratuita de especiais, colisão rápida, pausa do roteiro, avisos e corredor da forma interna.

O [harness de gameplay](../scripts/phase1-normal-checks.mjs) mede dano pela implementação real de projéteis e colisões. Cenário: nave centralizada, chefe em movimento, disparo manual na cadência limite, sem míssil, carga ou especial. Não mede a dificuldade de sobreviver aos ataques:

| Confronto | Arma | Tempo controlado aproximado |
|---|---|---:|
| Raia-Dente | Azul NV2 | 14,4 s |
| Talassarca, ambas as camadas | Azul NV2 | 59,2 s |
| Talassarca, ambas as camadas | Azul NV3 | 42,4 s |
| Talassarca, ambas as camadas | Azul NV4 | 38,8 s |
| Talassarca, ambas as camadas | Verde NV1 | 37,2 s |

A primeira medição do verde sem correção resultou em 142 s; essa regressão de potência foi corrigida. Um ensaio separado avança a cena Phaser com animações, timers e colisões: o piloto parado no centro, segurando o disparo e sem usar recursos, foi abatido após aproximadamente 44,7 s. Isso verifica pressão contra inatividade; não constitui uma partida humana ou prova de dificuldade ideal.

[Relatório e capturas nas duas resoluções](screenshots/phase1-normal/validation.json). Medidas de custo de atualização nesse relatório são apenas CPU em simulação acelerada; não representam FPS da GPU. Áudio é validado tecnicamente; ainda precisa de avaliação auditiva humana numa partida completa.

## O que ainda merece avaliação na gameplay

1. Jogar a fase inteira no Normal para avaliar prazer, fadiga e justiça dos padrões, especialmente com P perdidos.
2. Avaliar em movimento a leitura da segunda camada e o peso audiovisual do especial.
3. Testar partidas completas usando principalmente carga ou míssil para verificar se as funções distintas são úteis.
4. Ajustar somente a partir dessas partidas: não considerar os tempos de tiro livre como aprovação definitiva da fase.
