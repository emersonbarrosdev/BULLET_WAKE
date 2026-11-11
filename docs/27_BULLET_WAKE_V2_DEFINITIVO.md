# BULLET WAKE — Bíblia vigente

Revisão de 11/11/2026. Esta revisão substitui regras conflitantes anteriores. Detalhes e evidências em [elenco, combate e áudio](39_ELENCO_COMBATE_AUDIO.md). Somente Fenda Pelágica está produzida; nenhuma fase seguinte deve ser produzida antes de sua aprovação.

## Identidade e câmera

Shooter vertical arcade 2D. Tudo no combate é visto diretamente de cima, em projeção ortográfica: água, criaturas, caças e armas instaladas. Movimento lateral não inclina a imagem. Menu pode usar naves em três quartos. RIVET mantém casco branco, detalhes vermelhos, três motores e arte própria; nenhum crop da abertura é utilizado.

Invasores são organismos alienígenas, inclusive criaturas biomecânicas. Distinguir voadores de organismos aquáticos: os primeiros compartilham o plano da nave, os segundos emergem, permanecem ancorados ao cenário e voltam a submergir. Não dar a todos aparência de naves humanas.

## Cinco pilotos e progressão própria

| Piloto | Nave / tiro | Especial | Busca pessoal |
|---|---|---|---|
| Terry | RIVET / dispersão azul | Tempestade Prismática | Irmão desaparecido; reconstruir a honra após desobedecer para salvar civis |
| Tita | MOTH / ondas verdes | Salto Fantasma | Mãe pesquisadora; distinguir uma voz real de uma armadilha do enxame |
| Osvald | KNUCKLE / fluxo rubro | Ruptura Nova | Filha desaparecida; aprender a ouvir além de proteger |
| Luma | KESTREL / azul concentrado | Coroa Orbital | Pai desaparecido; salvar a clínica da família e decidir para que serve a fama |
| Bento | PEREGRINE / rajada alternada | Chuva de Cometas | Esposa e cartas dos refugiados; parar de fugir da própria culpa |

Primeiros nomes apenas. Retratos cartoon de alta qualidade, contornos desenhados e sombras matte, sem renderização 3D. Identidades anteriores são preservadas artisticamente; IDs internos antigos continuam estáveis para não quebrar saves/assets.

Cada piloto tem desejo, ferida, conflito, fala de missão e final próprio. A seleção da missão mostra seu retrato e motivação, sem tutorial obrigatório. A Fase 1 mostra um epílogo intermediário; nenhum final da campanha é liberado por vencer somente Talassarca. Progresso e recordes são salvos separadamente por piloto.

### Armas

Cada nave mantém **um armamento próprio**, que evolui do NV1 ao NV4. Esta decisão substitui a cascata azul→verde→vermelho. Os efeitos verdes/vermelhos foram preservados e transferidos para MOTH/KNUCKLE. P aumenta potência, nunca troca a nave para a arma de outro piloto.

- 3 P por nível; 9 P do NV1 ao NV4. No máximo, P extra concede 5.000 pontos; não cria reserva invisível.
- RIVET: leque azul 3/5/9/16, mais espesso em NV3/NV4. Dois mísseis automáticos em NV3+; nenhuma ação manual extra.
- MOTH: ondas verdes entrelaçadas, componentes 2/4/6/8. Dano reequilibrado para estar disponível desde o início.
- KNUCKLE: fogo rubro contínuo, com varreduras móveis nos níveis superiores; alcança o teto da arena, sem bolas vermelhas.
- KESTREL: menor dispersão, exige alinhamento e favorece alvos prioritários.
- PEREGRINE: duas âncoras alternadas e dispersão intermediária, mobilidade e dano moderados.
- Cadência, dano e quantidades são calibrações autorais, não números atribuídos às ROMs de referência. Equilíbrio deve considerar acertos reais, cobertura, risco e especiais, além de DPS teórico.

**Referências:** Sonic Wings informa o conceito de tiro/especial próprios da aeronave. Fire Shark possui troca livre de cor com potência compartilhada; não exige a cascata abandonada de Bullet Wake. Não descrever nossas regras como cópia exata dos dois jogos.

### Vidas, especiais e suprimentos

Início: **3 vidas e 2 especiais**. Ambos acumulam até **5**. Vida extra no máximo concede 5.000 pontos; especial no máximo concede 500. Sem barra de integridade, escudo coletável, dash, bomba separada, tiro carregado ou míssil manual. A proteção breve após renascer/usar especial serve para não encadear mortes; não é uma nova barra nem item de escudo.

Um impacto sem proteção abate a nave. Ao renascer: arma própria NV1, velocidade inicial, dois segundos de proteção, nenhum reabastecimento gratuito de especial. A potência conquistada volta como marcos físicos de recuperação, até três, que não duplicam progresso nem reduzem um nível já recuperado. Continue explícito por checkpoint mantém estoque restante e oferece recuperação limitada, sem farm.

Caixas com paraquedas precisam ser destruídas; o item liberado precisa ser tocado. Quica nas quatro bordas por até 16 s. Inimigos comuns não distribuem itens. Onze suprimentos no roteiro: nove P, uma vida e um especial. P nº3 aproximadamente aos 46 s de percurso; nº6 aos 93 s; nº9 aos 139 s, fora as pausas dos chefes. Destruir o portador e buscar o item são decisões reais. Cada nave tem spritesheet de 1UP com a própria miniatura. Sem legenda sob itens.

## Fenda Pelágica: ritmo de 2–4 minutos

O alvo atual é **2–4 minutos por fase**, incluindo chefes, em uma partida sem mortes/repetições. A antiga proposta de cinco minutos para a Fase 1 e a tabela de 3–7 minutos foram substituídas. Não estender uma fase artificialmente para atingir um cronômetro.

Oceano relativamente calmo → contaminação/criaturas emergentes → Raia-Dente → destroços e invasão → revelação da fenda → Talassarca. Travessia atual: 4.600 unidades a 28/s, cerca de 164 s, mais confrontos, que suspendem o deslocamento do roteiro. O tempo final depende da potência/acerto; medir a faixa em partidas, sem prometer duração fixa em caso de P perdidos ou Continue.

Mudança perceptível a cada 30–45 s; acontecimento relevante a cada 60–90 s; ao menos uma situação exclusiva por fase. Alternar bandos rápidos frágeis que não atiram, atacantes individuais e organismos aquáticos. Normal exige reposicionamento e prioridade de alvos; aumentar só a velocidade de balas não é suficiente. Coordenar entradas, evitar sobreposição e preservar saída dos padrões.

Água tem sheets animadas, interpolação contínua, refração, espuma e partículas. Movimento continua durante chefes; não voltar a uma imagem estática rolando. Destroços não devem saltar de posição com a animação da água. Fenda se revela antes do chefe, não desde a primeira tela.

### Chefes e contato

Raia-Dente é miniboss aéreo. Talassarca é organismo aquático colossal abaixo da nave, com seis partes destrutíveis: três órgãos e três baterias biomecânicas. Tiros partem de cada origem; destruir uma parte impede seus disparos. A nave pode sobrevoar o corpo.

Casca: 600 HP, equivalente a cinco especiais de 120. Metamorfose: 2,4 s, sem transferência do dano excedente. Forma interna: 360 HP, três especiais. Arte útil ocupa aproximadamente 80%/100% da largura da arena. Segunda camada altera padrões/origens e oferece corredor de esquiva; tiros convencionais vencem ambas. Especiais não são requisito.

Colisão usa alfa do frame real e varredura entre frames: atingir bordas sólidas e respeitar vazios/concavidades. Não usar o quadrado da spritesheet nem só o centro. Contato aéreo explode o inimigo. Explosão pequena é breve; grandes inimigos e chefes têm várias detonações locais escalonadas, partículas e final maior na região atingida. Sem tremor de câmera.

## Fluxo, HUD e comandos

Abertura → cinco pilotos → missão com retrato/fala pessoal → loading de 2,5 s → gameplay. Perfil e confirmação continuam dentro/sobre o card escolhido, exigindo duas ações. Somente a Fenda é selecionável. Sem tutorial obrigatório antes da partida.

Laterais preservadas em preto fosco/carbono; arena lógica de 432 px dentro do canvas 768×432, sem margens externas. Esquerda: piloto, score, até cinco ícones de vida e cinco de especial. Direita: missão, arma/nível/P, avanço e canal discreto de comunicação. 275 falas, 55 por piloto, cinco por contexto, incluindo morte, revanche, medo, muitos inimigos, miniboss e quarta parede. Rádio com intervalos longos e seis segundos de leitura; não encobrir a arena.

Pausa congela a gameplay e abre card menor/translúcido com botões verticais: **Continuar / Controles / Voltar ao menu**. Controles no mesmo card. Sair exige **Cancelar / Confirmar saída**, informando perda do progresso da fase atual. Sem reiniciar fase ou trocar piloto nesse card.

Movimento: WASD/setas ou analógico/direcional. Disparo: Espaço ou botão sul, segurar mantém cadência rápida. Especial: X/botão oeste. Pausa: Esc/Menu. Mostrar identificação conforme controle conectado. Validar menus/perfis/resultados sem scroll/corte em 1366×768 e 1920×1080. Tipografia Oxanium/Rajdhani e abertura preservadas.

## Áudio

Trilha autoral de rock de aviação: melodias próprias, guitarra elétrica, baixo, piano, cordas e bateria acústica amostrada, sem reproduzir música de Top Gun, Fire Shark ou Sonic Wings. Três arranjos produzidos: abertura/menus, oceano, chefe. Alternar piano, guitarra e respostas melódicas ao longo de 32 compassos; evitar um único motivo curto repetido.

Renderização: FluidSynth + GeneralUser GS; arquivos finais OGG, transporte com cache e uma faixa por vez. Créditos/licença em [áudio e produção](39_ELENCO_COMBATE_AUDIO.md) e [licença original](licenses/GeneralUser-GS.txt). Efeitos humanos de canhão com transientes mecânicos; alienígenas com cores/timbres diferenciados; impactos curtos e explosões com ataque definido e corpo grave. Limitar sobreposição.

**Espaço: silêncio absoluto**, incluindo música, tiros, explosões e UI. A API de ambiente já silencia todo o master e impede reativação por mute. Fases espaciais permanecem planejamento e deverão usar esse ambiente.

## Campanha, 100% e segredos

Quinze capítulos principais planejados, duas fases secretas. Completar os 15 capítulos com um piloto libera seu final e as duas fases secretas; não exigir todos os pilotos para o primeiro 100%. Recordes, capítulos e final visto ficam separados por piloto. Duração estimada da rota principal: 30–60 min sem telas/mortes, conforme o alvo de 2–4 min; não é conteúdo já produzido.

Bento é o piloto secreto e fica visível no desenvolvimento. Na versão de desbloqueio: completar uma campanha, iniciar o jogo novamente e digitar **WAKEBENTO** na abertura. O código não funciona com apenas a Fase 1 concluída. Chave de desenvolvimento pode ocultá-lo quando for hora de ativar a regra; sistema de progresso já está preparado. Fases secretas são IDs 16/17 e continuam indisponíveis na seleção enquanto não produzidas/aprovadas.

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
