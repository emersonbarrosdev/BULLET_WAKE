# BULLET WAKE — Bíblia vigente

Revisão de 11/11/2026. Esta revisão substitui regras conflitantes anteriores. Correções atuais e evidências em [RIVET caça e Tormenta Escarlate](48_RIVET_CACA_TORMENTA_ESCARLATE.md); [HUD e punição por morte](46_RIVET_VERMELHA_HUD_E_RECUPERACAO.md) registra a revisão anterior; [chefe, RIVET FULL, escala e nu metal](44_CHEFE_RIVET5_ESCALA_E_NU_METAL.md) registra a revisão anterior; [revisão anterior](41_REVISAO_FINAL_FASE_1.md) é histórica; [relatório anterior](39_ELENCO_COMBATE_AUDIO.md) é histórico. Somente Fenda Pelágica está produzida; nenhuma fase seguinte deve ser produzida antes de sua aprovação.

## Identidade e câmera

Shooter vertical arcade 2D. Tudo no combate é visto diretamente de cima, em projeção ortográfica: água, criaturas, caças e armas instaladas. A câmera não gira ao mover. A RIVET usa poses de rolagem lateral para esquerda/direita, com o bico sempre apontado ao norte e disparo no eixo da nave; não gira a imagem no plano nem muda a câmera para três quartos. Naves usam arte de 34 unidades (redução de 15%); inimigos comuns e portadores, redução de 12%, preservando o chefe colossal e a arena. Menu pode usar naves em três quartos. RIVET tem proporções de caça inspiradas no F/A-18, com fuselagem fina, asas e estabilizadores de cauda distintos, dois motores, casco branco e detalhes escarlates; nenhum crop da abertura é utilizado.

Invasores são organismos alienígenas, inclusive criaturas biomecânicas. Distinguir voadores de organismos aquáticos: os primeiros compartilham o plano da nave, os segundos emergem, permanecem ancorados ao cenário e voltam a submergir. Não dar a todos aparência de naves humanas.

## Cinco pilotos e progressão própria

| Ordem / piloto | Identidade | Nave / tiro | Especial | Busca pessoal |
|---|---|---|---|---|
| 1. **Bayek** | Egípcio; protagonista | RIVET / Rajada Escarlate | Tormenta Escarlate | Irmão desaparecido e honra após salvar civis |
| 2. **Tita** | Ruiva; aparência preservada com cabelo cobre | MOTH / ondas verdes | Salto Fantasma | Mãe pesquisadora; distinguir a voz real do enxame |
| 3. **Leona** | Mulher negra brasileira | KESTREL / azul concentrado | Coroa Orbital | Pai desaparecido; manter a clínica da família |
| 4. **Osvald** | Russo; veterano de resgate | KNUCKLE / fluxo rubro | Ruptura Nova | Resgatar a filha e aprender a ouvi-la |
| 5. **Hien** | Japonês; homenagem ao aviador ninja | PEREGRINE / rajada alternada | Chuva de Cometas | Esposa nos abrigos e culpa por uma retirada |

Primeiros nomes apenas. Retratos cartoon desenhados, sem renderização 3D. Bayek assume o conjunto principal antes apresentado como Terry; Hien recebe o conjunto antes apresentado como Bento. Leona substitui Luma. Os IDs técnicos **nolan/cora/lyra/harlan/bento** identificam os conjuntos de nave e preservam os saves. A homenagem visual de Hien foi pesquisada na [fonte oficial de Sonic Wings Reunion](https://swr.success-corp.co.jp/), com capacete/máscara escuros e cachecol vermelho; a nave e as regras são as da PEREGRINE.

Cada piloto tem desejo, ferida, conflito, fala de missão e final próprio. A seleção da missão mostra seu retrato e motivação, sem tutorial obrigatório. A Fase 1 mostra um epílogo intermediário; nenhum final da campanha é liberado por vencer somente Talassarca. Progresso e recordes são salvos separadamente por piloto.

### Armas

Cada nave mantém **um armamento próprio**, que evolui do NV1 ao NV5/FULL na RIVET e ao NV4 nos demais conjuntos. Esta decisão substitui a cascata azul→verde→vermelho. Os efeitos verdes/vermelhos foram preservados e transferidos para MOTH/KNUCKLE. P aumenta potência, nunca troca a nave para a arma de outro piloto.

- RIVET: melhorias com 2/2/2/3 P, nove P do NV1 ao NV5/FULL. Demais conjuntos: três P por melhoria, nove P do NV1 ao NV4. No máximo, P extra concede 5.000 pontos; não cria reserva invisível.
- RIVET: Rajada Escarlate, com spritesheet própria de oito quadros de projétil individual, núcleo claro e corpo vermelho. Largura e comprimento crescem a cada nível, com salto perceptível no NV3. Salvas de 1/2/3/6/7 tiros, com três pares no NV4 e sete tiros encorpados no FULL. Dois mísseis automáticos juntos no NV3/NV4 (intervalo 1,5 s); três guiados no FULL (intervalo 1,1 s), com giro limitado e busca de alvos/peças vivos. Nenhuma ação manual extra. Os nove P existentes chegam ao FULL sem aumentar as onze caixas.
- MOTH: ondas verdes entrelaçadas, componentes 2/4/6/8. Dano reequilibrado para estar disponível desde o início.
- KNUCKLE: fogo rubro contínuo, com varreduras móveis nos níveis superiores; alcança o teto da arena, sem bolas vermelhas.
- KESTREL: menor dispersão, exige alinhamento e favorece alvos prioritários.
- PEREGRINE: duas âncoras alternadas e dispersão intermediária, mobilidade e dano moderados.
- Cadência, dano e quantidades são calibrações autorais, não números atribuídos às ROMs de referência. Equilíbrio deve considerar acertos reais, cobertura, risco e especiais, além de DPS teórico.

**Referências:** Sonic Wings informa o conceito de tiro/especial próprios da aeronave. Fire Shark possui troca livre de cor com potência compartilhada; não exige a cascata abandonada de Bullet Wake. Não descrever nossas regras como cópia exata dos dois jogos.

Especiais: apresentação própria e dano sincronizado aos impactos. Leona usa seis lanças orbitais (20 de orçamento por impacto); Hien, oito falcões de energia (15). Tita usa três pulsos de fase (40), pós-imagens da MOTH real e deslocamento de 650 ms; Osvald usa uma ruptura radial de 120. Bayek usa **Tormenta Escarlate**: sobrecarga ofensiva frontal, feixe central dominante e duas rajadas auxiliares, em escarlate intenso com núcleo branco-amarelado e bordas laranja, mais fragmentos incandescentes. A emissão nasce no bico e acompanha o deslocamento; não é bombardeio da arena inteira. Duração de 3 s, orçamento máximo de 120 contra o chefe durante contato contínuo; atingem-se somente as peças cruzadas pelo plasma. Dano perdido por errar não fica guardado para aplicar depois. Inimigos atrás da nave não recebem dano. O eixo e as poses continuam vistos de cima: à direita, asa direita abaixa/esquerda sobe; à esquerda, o inverso. Proteção especial comum de **1,8 s**; duração visual pode ser maior. Limpar balas ao quebrar uma peça comum não é recompensa automática; a limpeza total fica nos especiais e metamorfose.

### Vidas, especiais e suprimentos

Início: **3 vidas e 2 especiais**. Ambos acumulam até **5**. Vida extra no máximo concede 5.000 pontos; especial no máximo concede 500. Sem barra de integridade, escudo coletável, dash, bomba separada, tiro carregado ou míssil manual. A proteção breve após renascer/usar especial serve para não encadear mortes; não é uma nova barra nem item de escudo.

Um impacto sem proteção abate a nave. Ao renascer: arma própria NV1, velocidade inicial, dois segundos de proteção, nenhum reabastecimento gratuito de especial. O medidor P zera. Se havia potência conquistada, cai somente um P comum: conta uma unidade do medidor e nunca guarda o nível anterior. Recolhê-lo não restaura instantaneamente a arma. Morrer em NV1/0 P não cria item. Continue explícito também retorna ao NV1/0 P e mantém somente o estoque restante de especiais; não concede NV2 automático nem reserva oculta. Esta regra substitui os antigos marcos de recuperação.

Caixas com paraquedas precisam ser destruídas; a animação tem oito quadros a 8 fps, tecido e cordas se movem com a caixa registrada numa âncora fixa; o item liberado precisa ser tocado. Quica nas quatro bordas por até 16 s. Inimigos comuns não distribuem itens. O guia normal mostra apenas os itens disponíveis no roteiro; velocidade/pontos continuam apenas compatibilidade, sem promessa de drops. Onze suprimentos no roteiro: nove P, uma vida e um especial. P nº3 aproximadamente aos 46 s de percurso; nº6 aos 93 s; nº9 aos 139 s, fora as pausas dos chefes. Destruir o portador e buscar o item são decisões reais. Cada nave tem spritesheet de 1UP com a própria miniatura. Sem legenda sob itens.

## Fenda Pelágica: ritmo de 2–4 minutos

O alvo atual é **2–4 minutos por fase**, incluindo chefes, em uma partida sem mortes/repetições. A antiga proposta de cinco minutos para a Fase 1 e a tabela de 3–7 minutos foram substituídas. Não estender uma fase artificialmente para atingir um cronômetro.

Oceano relativamente calmo → contaminação/criaturas emergentes → Raia-Dente → destroços e invasão → revelação da fenda → Talassarca. Travessia atual: 4.600 unidades a 28/s, cerca de 164 s, mais confrontos, que suspendem o deslocamento do roteiro. O tempo final depende da potência/acerto; medir a faixa em partidas, sem prometer duração fixa em caso de P perdidos ou Continue.

Mudança perceptível a cada 30–45 s; acontecimento relevante a cada 60–90 s; ao menos uma situação exclusiva por fase. Alternar bandos rápidos frágeis que não atiram, atacantes individuais e organismos aquáticos. Normal exige reposicionamento e prioridade de alvos; aumentar só a velocidade de balas não é suficiente. Coordenar entradas, evitar sobreposição e preservar saída dos padrões.

Água tem sheets animadas, interpolação contínua, refração, espuma e partículas. Movimento continua durante chefes; não voltar a uma imagem estática rolando. Destroços não devem saltar de posição com a animação da água. Fenda se revela antes do chefe, não desde a primeira tela.

### Chefes e contato

Raia-Dente é miniboss aéreo. Talassarca é organismo aquático colossal abaixo da nave, com seis partes destrutíveis: três órgãos e três baterias biomecânicas. Tiros partem de cada origem; destruir uma parte impede seus disparos. A nave pode sobrevoar o corpo. Armas/órgãos só perdem HP por acertos reais em suas silhuetas; não existe transferência ao módulo mais próximo nem do excedente para outro módulo. Somente as seis regiões anatômicas interceptam tiros; a casca externa permite passagem até elas. O identificador exato da peça segue com o impacto, inclusive o contato da borda larga do laser. HP total é a soma das seis peças, sem dano global em casco vazio. As três baterias estão pintadas na anatomia completa das duas camadas, sem torres ou retículas sobrepostas. Especiais têm dano de área explícito, separado dos impactos locais.

Casca: 600 HP, equivalente a cinco especiais de 120. Metamorfose: 2,4 s, sem transferência do dano excedente. Forma interna: 360 HP, três especiais. Arte útil ocupa aproximadamente 80%/100% da largura da arena. Segunda camada altera padrões/origens e oferece corredor de esquiva; tiros convencionais vencem ambas. Especiais não são requisito. Metamorfose possui sequência desenhada de rachadura/abertura/separação da casca e emergência do interior, sem piscar a imagem ou simular a mudança só aumentando escala.

Todas as cinco naves têm sprites de combate próprias e colisão individual, inclusive coleta. Chamas de propulsão não são casco. Colisão usa alfa do frame real e varredura entre frames: atingir bordas sólidas e respeitar vazios/concavidades. Não usar o quadrado da spritesheet nem só o centro. Contato aéreo explode o inimigo. Explosão pequena é breve; grandes inimigos e chefes têm várias detonações locais escalonadas, partículas e final maior na região que acumulou mais dano (em coordenadas locais do corpo), também na destruição por choque. Corpos grandes dissipam rapidamente. Sem tremor de câmera.

## Fluxo, HUD e comandos

Abertura → cinco pilotos → missão com retrato/fala pessoal → loading de 2,5 s → gameplay. Perfil e confirmação continuam dentro/sobre o card escolhido, exigindo duas ações. Somente a Fenda é selecionável. Sem tutorial obrigatório antes da partida.

Laterais preservadas em preto fosco/carbono; arena lógica de 432 px dentro do canvas 768×432, sem margens externas. Esquerda: piloto, trajeto da missão acima da pontuação, até cinco ícones de vida e cinco de especial. Vida anima por troca de quadros registrados, sem deslocamento lateral. Botão de pausa só com ícone acessível, sem o texto “Pausar / Opções”. Direita: missão, arma/nível/P e canal do piloto logo abaixo do armamento, em caixa de texto. Durante a fala, borda e texto ficam vermelhos; em escuta, discretos e neutros. 275 falas, 55 por piloto, cinco por contexto, incluindo morte, revanche, medo, muitos inimigos, miniboss e quarta parede. Rádio com intervalos longos e seis segundos de leitura; não encobrir a arena. Continue preserva mortes e sequências de falas. A fala de vitória acompanha o resultado para não desaparecer antes da leitura.

Pausa congela a gameplay e abre card menor/translúcido com botões verticais: **Continuar / Controles / Voltar ao menu**. Controles no mesmo card. Sair exige **Cancelar / Confirmar saída**, informando perda do progresso da fase atual. Sem reiniciar fase ou trocar piloto nesse card.

Movimento: WASD/setas ou analógico/direcional. Disparo: Espaço ou botão sul, segurar mantém cadência rápida. Especial: X/botão oeste. Pausa: Esc/Menu. Mostrar identificação conforme controle conectado. Validar menus/perfis/resultados sem scroll/corte em 1366×768 e 1920×1080. Tipografia Oxanium/Rajdhani e arte da abertura preservadas. Enquadrar a arte inteira, sem cortar logotipo, nave ou assinatura; aceitar respiro nas proporções diferentes. Verificar também 2560×1080 e 1280×1024.

## Áudio

Trilha autoral orientada a nu metal: riffs graves em B/F♯, síncopes, cortes secos, palm mute e respostas melódicas curtas. Guitarras General MIDI e solos anteriores foram substituídos por humbuckers gravados da METAL-GTX, com palhetadas down/up, round robins e tomadas independentes à esquerda e à direita. Distorção em quatro estágios, sobreamostragem 4× e gabinete 4×12 por convolução. Baixo e bateria acústica amostrada continuam na instrumentação; scratches pontuais completam o arranjo. Três músicas: abertura/menu, oceano e chefe, com 48 compassos cada. Composições próprias, sem copiar melodias ou gravações de Slipknot, filmes ou jogos. A escuta do usuário decide a aprovação; processamento e métricas de áudio não a substituem.

Renderização: amostrador local de guitarra METAL-GTX + cadeia de alto ganho/IR; FluidSynth + GeneralUser GS para baixo/bateria; arquivos finais OGG, transporte com cache e uma faixa por vez. Pausa preserva a posição musical, incluindo carregamento em andamento. Créditos/licença em [áudio e produção](39_ELENCO_COMBATE_AUDIO.md) e [licença original](licenses/GeneralUser-GS.txt), [METAL-GTX](licenses/METAL-GTX.txt) e [gabinetes](licenses/4x12-IR.txt). Só os arranjos finais são distribuídos; a biblioteca bruta de guitarra fica fora do pacote. Efeitos humanos de canhão com transientes mecânicos; alienígenas com cores/timbres diferenciados; impactos curtos e explosões com ataque definido e corpo grave. Limitar sobreposição.

**Espaço: silêncio absoluto**, incluindo música, tiros, explosões e UI. A API de ambiente já silencia todo o master e impede reativação por mute. Fases espaciais permanecem planejamento e deverão usar esse ambiente.

## Campanha, 100% e segredos

Quinze capítulos principais planejados, duas fases secretas. Completar os 15 capítulos com um piloto libera seu final e as duas fases secretas; não exigir todos os pilotos para o primeiro 100%. Recordes, capítulos e final visto ficam separados por piloto. Duração estimada da rota principal: 30–60 min sem telas/mortes, conforme o alvo de 2–4 min; não é conteúdo já produzido.

Hien é o piloto secreto e fica visível no desenvolvimento; Bayek é o protagonista sempre disponível. Na versão de desbloqueio: completar uma campanha, iniciar o jogo novamente e digitar **WAKEHIEN** na abertura. O código não funciona com apenas a Fase 1 concluída. Chave de desenvolvimento pode ocultá-lo quando for hora de ativar a regra; sistema de progresso já está preparado. Fases secretas são IDs 16/17 e continuam indisponíveis na seleção enquanto não produzidas/aprovadas.

## Campanha planejada: quinze fases e finais secretos

Somente a primeira fase está produzida. As regiões, chefes e rotas seguintes permanecem planejamento.

### Fases 1 a 3 — Regiões Iniciais Selecionáveis
1. **Fase 01 — Fenda Pelágica (Oceano Terrestre):**
   - *Ambiente:* Oceano profundo, recifes submarinos alienígenas e abismo bioluminescente.
   - *Inimigos:* Agulha Pelágica, Raia de Fenda, Parasita Abissal, Casulo Marinho.
   - *Miniboss:* Raia-Dente (grande criatura biomecânica alada com disparos em arco).
   - *Boss Colossal:* **TALASSARCA — O DEVORADOR DAS MARÉS**: casulo/casca, metamorfose anatômica e forma interna mais agressiva. Referência de cinco especiais na casca e três na segunda camada, sem obrigar o uso exclusivo de especiais. Tamanho máximo de 80%/100% da largura do corredor e região inferior para esquiva.
2. **Fase 02 — Bosque da Névoa Viva (Floresta Tropical):**
   - *Ambiente:* Dossel vegetal denso infestado por esporos alienígenas luminosos.
   - *Inimigos:* Vespas de Ruptura, Polinizadores Negros, Mímicos de Folhagem, Tecelões.
   - *Miniboss:* Vespa-Quimera.
   - *Boss Colossal:* **ARBORION — O CORAÇÃO VEGETAL**.
3. **Fase 03 — Metrópole do Silêncio (Cidade Costeira Evacuada):**
   - *Ambiente:* Arranha-céus invadidos por monólitos cristalinos e tecnologia viva.
   - *Inimigos:* Prismas Caçadores, Olhos Sentinelas, Fragmentadores, Lâminas Orbitais.
   - *Miniboss:* Quimera Prisma.
   - *Boss Colossal:* **CATEDRAL DE VIDRO**.

### Fases 4 a 14 — Progressão Sequencial Planetária
4. **Fase 04 — Dunas de Silício:** Deserto cristalizado com tempestades de areia iônica. Chefe: *Sifão das Dunas*.
5. **Fase 05 — Cânion das Sombras:** Fendas tectônicas escarpadas e emboscadas rasantes. Chefe: *Mandíbula do Horizonte*.
6. **Fase 06 — Mar da Tempestade:** Oceano em fúria sob tempestade eletromagnética. Chefe: *Leviatã da Tormenta*.
7. **Fase 07 — Ruínas Vivas:** Estruturas antigas assimiladas por biomassa invasora. Chefe: *Arca Mnemônica*.
8. **Fase 08 — Cordilheira de Cristal:** Picos nevados repletos de agulhas glaciais alienígenas. Chefe: *Coroa de Geada*.
9. **Fase 09 — Arquipélago Vulcânico:** Caldeiras ativas com fluxo magmático luminescente. Chefe: *Coração Magmático*.
10. **Fase 10 — Mar de Nuvens:** Alta troposfera entre cumulonimbus colossais. Chefe: *Colmeia Cumulus*.
11. **Fase 11 — Olho da Estratosfera:** Fronteira orbital com auroras boreais alienígenas. Chefe: *Anel de Aurora*.
12. **Fase 12 — Curvatura da Terra:** Limite exterior da atmosfera terrestre. Chefe: *Véu Colossal*.
13. **Fase 13 — Órbita Fraturada:** Cinturão de satélites destruídos e armadilhas orbitais. Chefe: *Fornalha Sem Luz*.
14. **Fase 14 — Cemitério de Naves:** Destroços de frotas alienígenas e carcaças biomecânicas. Chefe: *Carcaça Primeva*.

### Fase 15 — Trono da Convergência (Chefe Variável por Região Inicial)
O chefe final da Fase 15 é determinado estritamente pela primeira região escolhida no início da campanha:
- **Começou pelo Oceano (Fase 1):** **THALOR — SOBERANO DAS PROFUNDEZAS** (entidade abissal colossal com tentáculos de plasma e órgãos bioelétricos).
- **Começou pela Floresta (Fase 2):** **MORHIZA — CONSCIÊNCIA DA COLMEIA** (entidade simbiótica orgânica ramificada com nuvens de esporos e núcleos alternados).
- **Começou pela Metrópole (Fase 3):** **PRISMA ÓRFÃO — ARQUITETO DA RUPTURA** (estrutura geométrica colossal de cristal vivo com feixes hiper-focados).

### Finais Secretos — Fases 16 e 17
As ordens de rota A/B/C da proposta anterior não condicionam mais os segredos. Completar os quinze capítulos principais com um piloto desbloqueia as duas fases extras planejadas.

* **Fase 16 — Abismo Subterrâneo:** Túneis nas profundezas da crosta terrestre onde a raiz da invasão se instalou. Chefe: *Coração Telúrico*.
* **Fase 17 — Lua: Origem da Colmeia:** Complexo alienígena na superfície lunar. Chefe Final Verdadeiro: **MATRIZ PRIMORDIAL — A ORIGEM DO ENXAME** (entidade suprema com casca, metamorfose e segunda camada, seguindo a regra 5/3 especiais).

---


## Referências e histórico

- [Fire Shark — manual Mega Drive](https://www.retrogames.cz/manualy/Genesis/Fire_Shark_-_Genesis_-_Manual.pdf).
- [Sonic Wings 2 — manual original](https://db.hfsplay.fr/files/2019/06/14/1aa6199e-35d2-456a-8a2f-e3513f37594e.pdf), páginas impressas 7–9: comandos, seleção e itens.
- [Fire Shark — Toaplan](https://www.toaplangames.co.jp/en/license/license-09.html).
- [FluidSynth oficial](https://www.fluidsynth.org/) e [GeneralUser GS do autor](https://github.com/mrbumpy409/GeneralUser-GS).

Documentos 28–38 são histórico; em conflitos prevalecem esta Bíblia e a revisão 39.
