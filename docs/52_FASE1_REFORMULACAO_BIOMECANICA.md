# Fase 1 — continuidade, combate biomecânico e encerramento

Revisão de 11/11/2026. Escopo produzido: **Fenda Pelágica**, cinco pilotos. A [Bíblia vigente](27_BULLET_WAKE_V2_DEFINITIVO.md) incorpora as regras desta entrega.

## Continuidade, vitória e canal do piloto

- A passagem **sequencial** guarda nível da arma, P parcial, velocidade conquistada, vidas, especiais e pontuação. FULL continua FULL; uma nave enfraquecida continua enfraquecida. Efeitos e cooldowns transitórios terminam. Snapshot persistente por piloto e fase; não transfere equipamento entre pilotos nem transforma um replay da Missão 1 em continuação. [Contrato de entrada](../src/game/systems/campaignFlight.ts) e testes dos cinco conjuntos, fortes e fracos. A Fase 2 permanece indisponível: foi implementada a regra/dados de continuidade, sem inventar conteúdo jogável seguinte.
- Morte da forma final: explosões locais em camadas, **tema próprio de vitória sem loop**, nave alinhando e acelerando automaticamente para cima até sair inteiramente da tela. Resultado após 4,2 s, sobre o campo de batalha. Sem conceder potência nova nessa passagem.
- Canal do piloto virou **terminal verde fósforo**, com fonte monoespaçada, identificação RX, registro curto e cursor discreto. Mantém-se na lateral, fora da arena. Coletas/mortes comuns respeitam o intervalo global; avisos de chegada, fuga, retorno e vitória têm prioridade e proteção contra repetição. Sem IA generativa durante o jogo.

## Reformulação do combate

O diretor usa eventos de distância únicos e aproximação suave de velocidades: pressão, deslocamento e pequenas acelerações nos trechos livres. Distância do roteiro e movimento visual da água estão separados. Cenário progride do oceano à contaminação/fenda; água, refração e partículas continuam animadas quando o avanço vertical para na arena final. Mantidos autofire ao segurar, onze suprimentos físicos, limites 5/5 e punição de potência por morte.

Quatro conjuntos aéreos receberam sheets próprias de aeronaves assimiladas: metal, armas integradas, motores e tecido alienígena, com estados desenhados de ventilação, carga e recuo. Criaturas aquáticas preservadas. Silhuetas reais continuam determinando contato; não se usa o quadrado do frame.

**Raia-Dente** foi redesenhado como capitão de ataque assimilado, menor, com dois canhões e núcleo de 60 HP cada. Três padrões e alvos locais; canhão destruído para de emitir. **Talassarca** usa duas composições próprias e seis partes por forma, 600/360 HP. A forma aérea se move e dispara por órgãos/baterias. Ao perder essa blindagem, foge por um segundo, fica **cinco segundos fora da tela** e emerge do oceano em quatro estados desenhados ao longo de 1,8 s. Só então começa a arena colossal. Não se dá explosão de morte definitiva na fuga nem dano através da transição.

**Eclipse Abissal**: interrompe tiros comuns, avisa corredores por 1,4 s, alterna feixes das baterias ainda vivas por 1,6 s e oferece 0,9 s de recuperação. O centro fica livre. Contato sem conclusão por 180 s na mesma forma interrompe a operação como alvo perdido, sem dar vitória/bônus falsos.

Impactos têm flash/partículas e timbres de metal, tecido ou energia; explosões curtas variam em escala/cor, grandes corpos têm detonações locais encadeadas. Alguns inimigos perdem estabilidade, reduzem escala, caem e terminam em splash. Tiros hostis distinguem classes fraca, média, pesada e especial. **Só em FULL** o contato varrido do tiro principal neutraliza projéteis fracos; médios/pesados/Eclipse permanecem perigosos. Pools limitados reutilizam projéteis e partículas.

## Armas, especiais e áudio

| Nave | Primário atual | Especial |
|---|---|---|
| RIVET | Rajada Escarlate, **preservada** | Tormenta Escarlate, núcleo frontal mais forte que as laterais |
| MOTH | Ondas Violetas entrelaçadas | Salto Fantasma, pós-imagens/descargas e deslocamento comandável |
| KESTREL | Lança Esmeralda, agulhas rápidas/precisas, penetração nos níveis altos | Seis lâminas orbitam, interceptam tiros fracos e procuram alvos reais |
| KNUCKLE | Fluxo Âmbar, pulsos densos e cadência pesada | Ruptura Nova, carga e ondas radiais |
| PEREGRINE | Chuva Celeste, rajadas rápidas com fragmentos diagonais | Oito cometas azul-brancos, impacto e dissipação |

O Salto Fantasma usa 350 ms de deslocamento rápido, com direção controlada e o limite da arena. Isso evita que a própria animação leve a nave longe demais e a deixe dentro do chefe após expirar a proteção comum de 1,8 s. Não há novo dash ou estoque adicional.

Quatro tiros e cinco especiais têm **nove projetos PCM determinísticos próprios**, usados em cache no [sistema de áudio](../src/game/audio/combatVoices.ts), com cabeceira, modulação e dissipação diferentes. Fontes são rastreadas e interrompidas na pausa/saída de cena. O canhão aprovado da RIVET mantém seus samples, taxa, ganho e variações.

A [trilha da fase](../public/assets/audio/stage1.ogg) recebeu progressão, riff e motivo diferentes do menu, com guitarra gravada/distorcida, contraponto industrial, **Synth Bass 1 e kit Electronic** efetivamente presentes na biblioteca GeneralUser GS local. [Vitória](../public/assets/audio/victory.ogg): quatro compassos, sem loop. Menu e música do chefe não foram regravados. [Métricas de áudio e instrumentação](../public/assets/audio/score.json). Não foram copiadas gravações/melodias dos jogos de referência.

## Validação realizada

- **207 testes passaram**, incluindo continuidade forte/fraca, alvos locais, ausência de cinco segundos, aviso/recuperação do Eclipse, timeout sem vitória falsa e nove efeitos PCM distintos/sem clipping nos buffers.
- **Build e TypeScript passaram**; permanece o aviso conhecido do bundle Phaser acima de 500 kB.
- Navegador de produção em **1366×768 e 1920×1080**: cinco pilotos, todos os níveis, especiais causando dano depois do impacto, acerto real na bateria integrada, emergência, Eclipse, neutralização seletiva, decolagem de vitória e snapshot FULL salvo. Epílogo sem HUD/resultado antigos acumulados e painel com opacidade 1. Controle virtual move, atira, consome especial, pausa e retoma. Zero erros de navegador. [Evidência visual/fluxos](screenshots/phase1-reform/visual-validation.json).
- Arquivos de menu/chefe, sprite da RIVET, tiro vermelho, samples do canhão e definição das salvas aprovadas comparados com a revisão anterior: **preservados**. [Hashes e comparação](screenshots/phase1-reform/protected-assets-validation.json).

Partidas automatizadas completas, com movimentação, coleta física e uso do estoque obtido, **sem injetar vida/potência**:

| Piloto | Até derrotar o chefe | Mortes | Potência ao concluir |
|---|---:|---:|---:|
| Bayek | 202,50 s | 0 | FULL / NV5 |
| Tita, após ajuste do Salto | 201,26 s | 0 | FULL / NV4 |
| Leona | 213,30 s | 0 | FULL / NV4 |
| Osvald | 263,16 s | 0 | FULL / NV4 |
| Hien | 235,94 s | 0 | FULL / NV4 |

Somam-se 4,2 s de encerramento até o resultado. As execuções ficaram dentro do alvo **3–5 minutos**. [Cinco rotas e política adicional de evitar P](screenshots/phase1-reform/validation.json) · [Tita revalidada após encurtar o deslocamento](screenshots/phase1-reform/tita-validation.json). A rota adicional de Bayek tentou evitar três P, mas perdeu efetivamente apenas um; isso está registrado, sem apresentar a tentativa como três perdas confirmadas. A perda de um, dois e três P também está coberta pelos testes de progressão. O jogador automatizado foi corrigido para prever o movimento das formações e respeitar a entrada aérea; as primeiras tentativas que se chocavam não foram tomadas como prova de dificuldade injusta nem motivaram vida extra escondida.

**Renderização real:** Chrome headless 156, Windows, ANGLE/D3D11, AMD Radeon Graphics, canvas **1920×1080**, cerca de 8 s de água/chefe final, RIVET FULL, explosões e especial. **59,99 FPS médios**, frame p95 **16,9 ms**, atualização p95 **1,4 ms**; picos de 31 projéteis, 25 partículas e quatro fontes de efeito. Pico de áudio medido antes do limitador: **0,230**; parada de efeitos reduziu fontes ativas de um para zero. [Medição completa](screenshots/phase1-reform/performance-validation.json). Esta fixture mantém jogador/chefe vivos para sustentar a carga e **não** foi usada para medir equilíbrio ou tempo de conclusão. É uma amostra de carga de oito segundos, não uma medição integral em tempo real de toda a fase.

## Arte, fontes e limites

[Quatorze sheets finais](../public/assets/combat-hd/reform/) foram geradas/editadas com **image_gen nativo**. Fora da ferramenta houve somente recorte da grade, redimensionamento e codificação WebP com alfa preservado. Duas limpezas intermediárias dos tiros ainda deixavam névoa retangular; só a versão final com recorte limpo entrou na entrega. [Prompts exatos e arquivos finais](53_PROMPTS_REFORMULACAO_FASE1.json) · [Verificação dos assets](screenshots/phase1-reform/asset-validation.json).

Referências consultadas: [manual original de Sonic Wings 2](https://db.hfsplay.fr/files/2019/06/14/1aa6199e-35d2-456a-8a2f-e3513f37594e.pdf), páginas impressas 8–9 (seleção, comandos e itens), [manual Mega Drive de Fire Shark](https://www.retrogames.cz/manualy/Genesis/Fire_Shark_-_Genesis_-_Manual.pdf) e [página oficial Toaplan](https://www.toaplangames.co.jp/en/license/license-09.html). Geometrias, dano, tempos e escala desta implementação são **calibrações autorais**, não números supostamente medidos dessas ROMs.

Ainda dependem do jogador: aprovação artística/sonora em partida e julgamento humano do Normal. Controle físico não foi validado; a evidência desta rodada é virtual. A continuidade foi testada como contrato/salvamento, pois a segunda missão não está produzida. Não se declara estabilidade prolongada de memória somente com base nesta amostra curta.

Arquivos centrais: [cena de combate](../src/game/scenes/PrototypeScene.ts), [diretor](../src/game/systems/stageDirector.ts), [Talassarca](../src/game/systems/bosses/bossTalassarca.ts), [capitão](../src/game/systems/bosses/minibossRaiaDente.ts), [armamentos](../src/game/systems/weaponSystem.ts), [HUD](../src/game/ui/PremiumCombatHud.ts), [resultado](../src/game/ui/MissionResultOverlay.ts), [transporte musical](../src/game/audio/MusicTransport.ts). Destino da publicação: **master**; hash confirmado na entrega após o push.
