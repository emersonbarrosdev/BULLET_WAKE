# BULLET WAKE V2 — Bíblia vigente

Revisão de 11/11/2026. Este documento consolida as decisões atuais e substitui os trechos conflitantes das revisões anteriores. Detalhamento de produção e validação: [ritmo, elenco e contornos](38_RITMO_ELENCO_E_CONTORNOS.md).

## Estado e identidade

- Shooter vertical 2D, visão superior ortográfica. Nariz da nave ao norte; movimento lateral não inclina o plano da imagem. Arte em três quartos fica restrita aos menus.
- Invasão da Terra por organismos alienígenas. Inimigos da Fase 1 são criaturas vivas, sem cockpit, fuselagem ou aparência de veículos humanos.
- Somente Fenda Pelágica está liberada. As demais fases e rotas abaixo são planejamento; produção da Fase 2 depende da aprovação explícita da primeira.
- Quatro pilotos: Nolan/RIVET, Cora/MOTH, Harlan/KNUCKLE e Lyra/KESTREL. Cada especial tem entrega própria e estoque inicial 2/máximo 3. Sem bomba independente.
- Tipografia: Oxanium para títulos/destaques e Rajdhani para leitura/menus. Preservar a abertura e a identidade dos pilotos; opções, preparação, resultados e laterais usam preto fosco/carbono.

## Regras atuais da Fase 1

### Vidas, morte e recuperação

Início com **três vidas**, sem barra de integridade. Um impacto não protegido abate a nave. Um escudo absorve um impacto; após o abate, a nave reaparece no mesmo combate com dois segundos de proteção, arma azul NV1 e sem velocidade acumulada. O especial não ganha cargas gratuitamente.

O armamento conquistado retorna como itens físicos que quicam nas bordas. Até quatro marcos de recuperação restituem família, nível e P parcial por contato. Itens recuperados não compram uma família nova nem duplicam potência; recolher fora de ordem não reduz o nível já restaurado. Nenhum item sai de inimigos comuns.

Ao acabar a terceira vida, mostrar derrota e Continue explícito por checkpoint. Continue começa com três vidas, preserva apenas a recuperação prevista pelo balanceamento e não reabastece especiais. A sobrevivência sem barra é a regra do Normal atual; modos futuros ainda não estão produzidos.

### Comandos e armamento

- WASD/setas ou analógico/direcional: movimento com diagonal normalizada.
- Espaço mantido ou botão sul do controle: disparo na cadência rápida; não exigir apertos repetidos.
- X ou botão oeste: especial único. Esc/Menu: pausa e opções.
- **Dash, tiro carregado e míssil manual removidos**, incluindo diálogos. Cora mantém deslocamento de fase como especial limitado, sem uma ação extra de dash.
- RIVET dispara dois mísseis automaticamente ao segurar disparo em NV3/NV4 de qualquer família. Não há botão nem coletável de míssil na Fase 1.
- Cascata autoral aprovada: azul NV4 libera cápsula verde NV1; verde NV4 libera rubro NV1. Cada troca evolutiva zera P. Três P sobem um nível, nove P do NV1 ao NV4; até três P de reserva no máximo. Cápsula repetida concede pontos.
- Azul: leque de projéteis 3/5/9/16. Verde: ondas entrelaçadas 2/4/6/8, com dano calibrado para a troca não ser uma perda de poder. Rubro: fluxos contínuos móveis, com expansões laterais/traseiras nos níveis avançados. Quantidades/dano/intervalos são calibração de Bullet Wake, não valores medidos das ROMs de referência.

A cascata acima é uma escolha de Bullet Wake solicitada posteriormente. **Fire Shark permite troca de cores independente da potência**, portanto não apresentar nossa cascata como reprodução fiel daquele sistema.

### Coletáveis e apresentação

Caixas com paraquedas entram como suprimento. O jogador precisa destruí-las; o item liberado quica nas quatro bordas e permanece por até 16 segundos. P, cápsulas, velocidade, proteção e especial possuem spritesheets distintas. O antigo H funciona agora como escudo de um impacto; não cura uma barra inexistente.

HUD sem legendas sob os itens nem atalhos espalhados. Laterais preservadas: arena lógica X168..600, largura 432, laterais 168 cada, canvas 768×432. Esquerda agrupa piloto, pontuação, três ícones de vida e até três ícones de especial. Direita agrupa missão, família, nível, P e avanço. Barra do chefe permanece sobre a arena. Tela inteira ocupada pelo conjunto, sem margens externas.

Seleção de missão antes dos quatro pilotos; somente Fenda disponível. Perfil dentro de cada card e confirmação sobre o card escolhido exigem ações distintas. Guia de comandos conforme dispositivo antes da primeira partida, loading de recursos antes do guia e transição de 2,5 segundos para decolagem. Pausa oferece comandos, guia de itens e áudio. Derrota/conclusão usam diálogos de carbono sobre a tela inteira, com ações acessíveis por teclado, mouse e controle.

### Câmera, contato e efeitos

RIVET mantém casco branco/vermelho, três motores, frames neutros superiores e escala menor. Remover propulsão duplicada e efeitos de muzzle que ficam no mundo enquanto a nave se move. Tiros nascem da posição atual do bico.

Projéteis e laser atingem o contorno opaco do frame atual, incluindo extremidades e preservando vazios/concavidades. Usar varredura para não atravessar alvos entre frames. Máscaras de alfa ficam em cache; não usar o retângulo inteiro da spritesheet nem somente um círculo central. Contato físico aéreo explode o inimigo; criaturas de superfície podem ser sobrevoadas.

Sem tremor de câmera. Explosões de fogo curtas, partículas limitadas e dissipação rápida. Projéteis alienígenas mantêm cores/formas próprias e transparência. Água usa sheets animadas com fluxo contínuo, sem depender de uma imagem estática rolando: oceano calmo → invasão/turbulência/destroços → fenda revelada antes de Talassarca.

### Chefes

Raia-Dente permanece miniboss aéreo. Talassarca é corpo aquático colossal visto por cima, abaixo da nave, com órgãos dorsais destrutíveis em posições distintas; órgãos destruídos param de disparar. A nave pode atravessar visualmente o corpo, mas os projéteis continuam perigosos.

Casca de 600 HP (cinco especiais de 120), metamorfose de 2,4 s sem transferência de dano excedente, forma interna de 360 HP (três especiais). Arte útil ocupa aproximadamente 80%/100% da largura da arena; o padding do atlas não conta como corpo. Segunda forma altera origens/padrões e preserva corredor de esquiva. Tiros convencionais também vencem ambas as formas; especiais não são requisito obrigatório.

## Ritmo e duração

| Fases | Alvo total por fase |
|---|---|
| 1–3 | 3–4 minutos |
| 4–7 | 4–5 minutos |
| 8–12 | 4–5 minutos |
| 13–15 | 5–6 minutos |
| Secretas | 5–7 minutos |

Campanha principal planejada em 60–75 min, dependendo dos confrontos. Mudança perceptível a cada 30–45 s, acontecimento relevante a cada 60–90 s e uma situação/mecânica exclusiva por fase. Nunca preencher duração artificialmente. Rotas alternativas/partidas curtas devem ser avaliadas. Fases de 7–9 min exigem acontecimentos suficientes e recuperação justa perto do final.

Na Fenda: oceano aberto → águas contaminadas → Raia-Dente → intensificação/destroços → fenda → Talassarca. O roteiro de cinco minutos é uma proposta de expansão, não um cronômetro já implementado. Medir partidas reais antes de prolongar a fase.

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
A ordem completa de conclusão das três regiões iniciais determina a rota da transmissão desconhecida:
- **Rotas Secretas A-B-C e B-C-A:** Desbloqueiam as Fases 16 e 17 (Final Verdadeiro).
- **Rotas A-C-B e C-A-B:** Desbloqueiam a Fase 16 (Final Subterrâneo).
- **Rotas B-A-C e C-B-A:** Encerram no Final Principal padrão.

* **Fase 16 — Abismo Subterrâneo:** Túneis nas profundezas da crosta terrestre onde a raiz da invasão se instalou. Chefe: *Coração Telúrico*.
* **Fase 17 — Lua: Origem da Colmeia:** Complexo alienígena na superfície lunar. Chefe Final Verdadeiro: **MATRIZ PRIMORDIAL — A ORIGEM DO ENXAME** (entidade suprema em 4 fases devastadoras).

---


## Referências e histórico

- [Fire Shark — manual Mega Drive](https://www.retrogames.cz/manualy/Genesis/Fire_Shark_-_Genesis_-_Manual.pdf).
- [Sonic Wings 2 — manual](https://db.hfsplay.fr/files/2019/06/14/1aa6199e-35d2-456a-8a2f-e3513f37594e.pdf).
- [Normal e suprimentos anteriores](37_FASE1_NORMAL_RITMO_POLIMENTO.md), [água/contato/áudio](35_FASE1_POLIMENTO_CONTATO_AGUA_AUDIO.md), [camadas e invasão](33_FASE1_ALIENIGENAS_CAMADAS_OCEANO.md).

Histórico de decisões antigas e implementações removidas pode ser consultado no Git. Esta versão não conserva regras conflitantes como se estivessem ativas.
