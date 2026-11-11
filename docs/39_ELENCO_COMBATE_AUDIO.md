# Fase 1 — elenco, combate e áudio

Revisão de 11/11/2026. Complementa a [Bíblia vigente](27_BULLET_WAKE_V2_DEFINITIVO.md) e substitui as regras conflitantes das revisões 28–38. A Fase 2 continua aguardando aprovação da primeira.

## Decisão de armamento e referência

Adotado um tiro próprio por nave, evoluindo com P, e um especial limitado distinto. A mudança dá identidade ao elenco e permite compensar cobertura, mobilidade e impacto. Preserva ondas verdes e fluxo vermelho existentes, agora pertencentes a Tita/MOTH e Osvald/KNUCKLE. Terry/RIVET mantém leque azul, Luma/KESTREL concentra o azul e Bento/PEREGRINE alterna as âncoras da rajada.

O [manual original de Sonic Wings 2](https://db.hfsplay.fr/files/2019/06/14/1aa6199e-35d2-456a-8a2f-e3513f37594e.pdf), páginas impressas 7–9, foi consultado para comandos, seleção e itens P/F/B. O [manual Mega Drive de Fire Shark](https://www.retrogames.cz/manualy/Genesis/Fire_Shark_-_Genesis_-_Manual.pdf) distingue potência P de troca de cores. A cascata abandonada era uma escolha anterior de Bullet Wake, não regra de Fire Shark. Números de dano, intervalos e quantidades desta revisão são calibrações próprias.

Não manter bomba independente: sua função defensiva competia com o especial. Estoque único: dois especiais iniciais, máximo cinco, mesmo orçamento de 120 de dano ao chefe, entregas e utilidades diferentes. Vidas: três iniciais, máximo cinco; sem escudo ou barra. Excedentes viram pontos, nunca um sexto item de estoque.

## Elenco, histórias e campanha

- **Terry:** desonrado ao desobedecer para salvar civis; procura o irmão. Sua resolução é trocar a necessidade de provar inocência por um esquadrão de resgate.
- **Tita:** denunciou experiências com o Wake; a mãe ficou para proteger a equipe. A busca exige distinguir uma voz familiar de uma armadilha e aceitar reconstruir lembranças.
- **Osvald:** brigou com a filha antes do desaparecimento. Precisa resgatá-la sem destruir as pistas e aprender a seguir o plano dela.
- **Luma:** voa para pagar a clínica da família; procura o pai. A escolha final põe pessoas antes da recompensa e dá outro sentido à fama.
- **Bento:** ex-contrabandista, procura a esposa e entrega cartas dos refugiados. Seu humor esconde vergonha; a resolução é parar de fugir e reconstruir uma rota de correio.

Texto completo, conflitos, falas iniciais e cinco finais estão em [pilotStories.ts](../src/game/data/pilotStories.ts). Cada piloto tem um epílogo intermediário após a Fenda. Não simular vitória na campanha ao concluir a única fase produzida.

Salvamento v2 mantém capítulos, recordes e final visto por piloto. Migra recordes/configurações de v1; a antiga marca de conclusão do protótipo de cinco fases não equivale a concluir quinze capítulos. Os IDs internos anteriores permanecem para compatibilidade.

Meta atual: fases de **2–4 minutos**; quinze capítulos principais, cerca de 30–60 min de combate sem telas/repetições. Concluir todos com um piloto libera seu final e duas fases secretas planejadas. Bento fica visível por uma chave de desenvolvimento; no lançamento, exige campanha concluída e **WAKEBENTO** na abertura de uma nova execução. Nada disso disponibiliza fases ainda não produzidas.

## Combate e apresentação

- RIVET refeita em projeção superior, quatro frames neutros com propulsão contida. PEREGRINE recebe sheet de combate e arte de menu próprias. Cinco retratos novos com desenho cartoon/cel shading matte.
- Cinco spritesheets de vida extra, uma miniatura por nave, mantendo a moldura e a animação do item de referência. Todas as naves evoluem sua própria arma pelo mesmo item P.
- Roteiro ampliado de 4.250 para 4.600 unidades, a 28/s: aproximadamente 164 s de deslocamento. Chefes suspendem a travessia; água continua animada.
- Normal: encontros cruzados adicionais, maior resistência dos atacantes médios e trecho final ativo. Bandos continuam rápidos/frágeis e sem disparo. As caixas não atiram nem geram pilhas de itens.
- Raia-Dente tem 180 HP; um especial deixa 60, preservando parte do confronto. Talassarca mantém 600/360 e seis partes, incluindo três baterias instaladas. Partes destruídas deixam de atirar.
- Laser de Osvald agora aplica o multiplicador de impacto do piloto, antes omitido no caminho de dano contínuo. O balanceamento compara contato real, não apenas os atributos do card.
- Explosões grandes: sete detonações pequenas e um final maior; chefe: dezoito locais e duas maiores, distribuídas ao longo de aproximadamente 0,9 s, com partículas e dissipação. Conclusão aparece depois desse efeito.
- Rádio no rodapé direito: **275 falas**, 55 por piloto, cinco por contexto. Intervalos de 26–34 s, leitura de 6 s, contexto não urgente com intervalo mínimo de 45 s. Mortes, revanche e vitória podem interromper a espera. O texto volta a “Canal aberto” ao encerrar a transmissão.

## Fluxo

Piloto → confirmação sobre seu card → missão com retrato e fala pessoal → loading de 2,5 s → combate. Perfil e confirmação continuam separados. Tutorial de decolagem removido; controles ficam em opções ou na pausa.

Pausa com card vertical de até 380 px sobre gameplay congelada e visível: Continuar, Controles, Voltar ao menu. Controles no mesmo card. Sair exige cancelar/confirmar e informa perda da fase atual. Laterais em carbono preservadas, sem ampliar a arena.

## Produção musical

Três composições originais de 32 compassos:

| Uso | Tema | BPM | Loop |
|---|---|---|---|
| Abertura/menus | Vanguarda do Horizonte | 118 | 65,08 s |
| Oceano | Maré de Combate | 142 | 54,08 s |
| Chefes | Casca de Aço | 156 | 49,23 s |

Arranjo com guitarra elétrica de melodia, guitarra rítmica, guitarra limpa estéreo, baixo dedilhado, piano de cauda, cordas e kit acústico. Seções alternam piano, guitarra e respostas; viradas de toms e pratos marcam as frases. Não há gravação, melodia ou trilha copiada de Top Gun ou dos jogos de referência.

Pesquisa de ferramentas: [FluidSynth oficial](https://www.fluidsynth.org/download/) e [GeneralUser GS, repositório do autor Chris Collins](https://github.com/mrbumpy409/GeneralUser-GS). Renderização local com FluidSynth 2.6.2, GeneralUser GS v2.0.3 e FFmpeg 9.0.2. O banco de instrumentos e os executáveis não são distribuídos com o jogo; somente as gravações autorais finais e a [licença original do banco](licenses/GeneralUser-GS.txt). A licença autoriza criação musical comercial e registra as informações de procedência fornecidas pelo autor.

Reprodução: [compose-score.py](../scripts/compose-score.py) gera MIDI original; renderizar com `fluidsynth -ni -g 0.7 -r 44100 -F output.wav GeneralUser-GS.sf2 score.mid`, dobrar a cauda de reverberação no começo do loop e converter para OGG/Vorbis q5. Metadados técnicos em [score.json](../public/assets/audio/score.json). PCM normalizado: pico −1,06 dBFS; RMS entre −16,39 e −15,70 dBFS. Tamanho total das três faixas: aproximadamente 3 MB.

Transporte com decodificação em cache, uma fonte ativa por vez, invalidação de carregamentos pendentes ao parar/trocar e fade de entrada. Mixer de música/efeitos separado, compressor no master. Canhão humano com transientes mecânicos curtos; disparos alienígenas modulados por espécie; impacto e explosão têm durações e corpo distintos. Ambiente espacial zera todo o master e bloqueia novos disparos/música, inclusive ao desmutar.

## Arte e prompts

Produção com a skill imagegen em modo **builtin**. Os arquivos finais estão em [pilot-selection](../public/assets/pilot-selection/) e [combat-hd](../public/assets/combat-hd/). Prompts exatos dos cinco retratos, PEREGRINE e sheet conjunta de 1UP: [manifesto](40_PROMPTS_ELENCO.json). A montagem somente recorta/alinha células e preserva alfa; não substitui a arte por pintura procedural.

Assets adicionais desta revisão: RIVET superior em quatro frames; bateria biomecânica em quatro estados; 1UP individual inicial, substituído no combate pelas cinco variantes do conjunto. Briefs de produção: projeção ortográfica sem faces circulares dos motores, três propulsores na RIVET, canhões instalados com estados repouso/carga/disparo/resfriamento e miniaturas de nave em moldura 1UP.

## Validação e próxima decisão

**170 testes passaram**, incluindo saves/migração, progressão, estoque, contornos, recuperação, rádio e chefes. Build de produção passou; mantém o aviso conhecido de chunk Phaser maior que 500 kB.

Validação no Chrome do build final em **1366×768 e 1920×1080**, sem erros de navegador: cinco cards/perfis sem scroll, história por piloto, carregamento, armas próprias, limites 5/5, partes destrutíveis, explosões, pausa/controles/saída, epílogos pessoais e silêncio espacial. Audio OGG decodificado, uma fonte musical ativa; desmutar no espaço mantém master zero. Atlases novos conferidos: alfa transparente, quatro frames distintos e dimensões regulares.

Tempos simulados com tiro mantido, alvo real animado, nave centralizada, sem especiais e sem esquiva. RIVET usa seus mísseis automáticos no NV3. Não são tempos de uma partida humana:

| Piloto | Raia NV2 | Talassarca NV2 (duas camadas) | Talassarca NV3 (duas camadas) |
|---|---|---|---|
| Terry | 24,38 s | 59,02 s | 32,02 s |
| Tita | 10,74 s | 51,82 s | 35,5 s |
| Osvald | 9,84 s | 50,3 s | 37,52 s |
| Luma | 12,6 s | 58,98 s | 32,98 s |
| Bento | 15,94 s | 59,06 s | 33,28 s |

Somando travessia e confrontos de referência, uma rota em NV3 fica por volta de 3min35–3min45. Isso é estimativa por partes, não medição de uma partida completa com coleta/movimentação. Perder P ou usar Continue pode prolongar o combate.

Teste do jogador parado com tiro mantido e sem especiais: derrota aos 26,5 s, pico de cinco inimigos/quatro tiros simultâneos; custo de atualização P95 aproximadamente 0,5 ms no ambiente de teste. Esse número mede CPU da simulação, não taxa de quadros da máquina do jogador.

[Relatório e capturas](screenshots/phase1-hangar/validation.json). Testes técnicos não substituem uma partida humana ou a avaliação musical em caixas/fones.

Ainda recomendo, somente na gameplay da Fase 1:

1. Partidas completas com P perdidos, morte e Continue para confirmar a recuperação e o alvo de 2–4 min.
2. Avaliar leitura dos cinco especiais com muitos projéteis, sobretudo Tita e Bento; ajustar duração visual sem aumentar o orçamento de dano.
3. Comparar o tempo de Raia-Dente entre leque e armas concentradas; decidir se o leque precisa de melhor oportunidade de alinhamento.
4. Ouvir o mix durante chefe/especial e verificar se guitarra, tiros e alertas permanecem distinguíveis.
5. Aprovação visual do conjunto e uma rodada humana do Normal antes de liberar a próxima fase.
