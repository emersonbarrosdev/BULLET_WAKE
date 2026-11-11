# Ritmo arcade, quatro pilotos e contato com silhuetas

Revisão de 11/11/2026. Complementa a Bíblia e prevalece sobre o elenco de três pilotos. A expansão da campanha permanece planejamento; o trabalho jogável continua concentrado na Fase 1.

## Direção de ritmo aprovada

| Fases | Alvo por fase, incluindo confrontos |
|---|---|
| 1–3 | 3–4 minutos |
| 4–7 | 4–5 minutos |
| 8–12 | 4–5 minutos |
| 13–15 | 5–6 minutos; até 7 somente com conteúdo suficiente |
| Secretas | 5–7 minutos |

Essas faixas somam 60–75 minutos para as quinze fases principais, sem mortes, telas ou secretas. São metas de design, não durações garantidas ou conteúdo já produzido. Rotas alternativas e sessões mais curtas devem ser avaliadas no planejamento da campanha.

**Regra:** mudança perceptível a cada 30–45 s; acontecimento relevante a cada 60–90 s. Cada fase precisa de uma situação ou mecânica memorável exclusiva. Nunca prolongar artificialmente o trajeto para preencher um cronômetro. Sete a nove minutos exigiriam regiões distintas e acontecimentos suficientes, além de recuperação justa perto do final.

Fenda Pelágica: oceano aberto → contaminação/organismos emergentes → Raia-Dente → invasão com destroços → revelação da fenda → Talassarca/casca/metamorfose. O exemplo de cinco minutos é uma proposta de expansão, não um requisito de duração fixa. Primeiro medir a fase com a colisão corrigida e preservar os marcos existentes. Inimigos continuam organismos alienígenas; referências de outras obras indicam ritmo e composição, não troca dos monstros por caças mecânicos.

## Elenco e estratégia

Quatro cards na mesma seleção, com retrato, nave, função, atributos, perfil e confirmação sobre o card escolhido. Clique/toque/Enter primeiro escolhe; uma ação posterior confirma. Perfis sem scroll em 1366×768 e 1920×1080.

| Piloto / nave | Estratégia | Especial | Compensação |
|---|---|---|---|
| Nolan Fitch / RIVET | Cobertura e fogo sustentado | Tempestade Prismática: salvas pela arena | Mobilidade média, menor impacto por projétil |
| Cora Wren / MOTH | Reposicionamento ágil | Salto Fantasma | Menor cobertura; exige posicionamento |
| Harlan Greer / KNUCKLE | Impacto concentrado | Ruptura Nova radial | Menor velocidade e cadência |
| Lyra Voss / KESTREL | Precisão e controle de alvos prioritários | Coroa Orbital: lanças convergentes | Tiro estreito, exige alinhamento |

Lyra/Kestrel é criação original proposta nesta revisão: especialista em resgate de plataformas oceânicas e instrumentação do Wake. Retrato ilustrado matte, uniforme grafite com acentos verde-jade; Kestrel humana, casco marfim/grafite, duas naceles laterais e acentos jade. Não copiar personagens de Sonic Wings.

A mesma cascata e o mesmo custo de P valem para todos. Orçamento agregado de dano próximo entre pilotos, com compensações reais de cadência, cobertura e impacto. Nenhum piloto deve dominar todas as situações. Especiais têm estoque inicial 2/máximo 3 e orçamento de chefe equivalente, diferenciados por entrega, cobertura e proteção. Não adicionar bomba redundante.

## Contato e propulsão

O contorno sólido do frame atual deve determinar o contato: cantos transparentes e espaços entre curvas não recebem dano. As extremidades visíveis recebem dano, mesmo longe do centro. Aplicar a tiros, mísseis automáticos, laser e contato físico aéreo. Carga manual foi removida. Manter varredura entre frames para projéteis rápidos; registrar impacto no primeiro ponto de contato. Reutilizar máscaras em memória, sem leitura de pixels a cada tiro.

RIVET mantém três motores. Remover chamas adicionais que parecem fios soltos e duplicam a chama já pintada na spritesheet. Propulsão deve sair das bocas dos motores, sem esticar a nave.

## Tarefas desta revisão

- [x] Máscaras de silhueta por frame e testes de curvas, transparência e projéteis rápidos.
- [x] Corrigir propulsores duplicados da RIVET.
- [x] Arte original de Lyra/Kestrel e seleção de quatro cards.
- [x] Implementar quarta nave/especial e compensações de disparo.
- [x] Validar teclado, controle, confirmação, perfis e gameplay nas duas resoluções.
- [x] Medir novamente chefes após colisões reais e documentar resultados.
- [x] Build/testes e revisão final.

## Trabalho posterior de gameplay

- Partidas humanas completas com os quatro pilotos, incluindo P perdidos e Continue.
- Verificar leitura dos quatro especiais e o ganho dos mísseis automáticos no NV3+. Carga e míssil manual foram removidos.
- Aprovar os acontecimentos da Fase 1 antes de produzir outras fases; duração de cinco minutos só se houver conteúdo novo que a justifique.

## Regras implementadas nesta entrega

- Laterais em carbono mantidas, com a arena anterior de 432 px. Sem estender o combate para a tela toda.
- Três vidas sem barra: impacto sem escudo abate, reaparecimento protegido por dois segundos. Até quatro itens físicos restauram marcos do armamento perdido, sem multiplicação de potência. H agora oferece escudo de um impacto.
- Dash removido do teclado, controle, HUD e diálogos. O deslocamento de fase continua sendo o especial limitado da Cora.
- Segurar dispara na cadência rápida. Carga e míssil manual removidos; RIVET em NV3/NV4 lança automaticamente dois mísseis, incluindo verde e rubro.
- RIVET em frames neutros superiores, sem rotação da imagem e sem chamas duplicadas. Tamanho pintado de 40 px dentro da arena lógica, em lugar de 46 px. Não há uma escala universal atribuída a todas as versões de Sonic Wings.
- Origem dos tiros no bico atual; removido o muzzle fixo no espaço. Projéteis/laser usam contorno opaco por frame, com cache e varredura; vazios/concavidades ficam livres.
- Caixas com paraquedas substituem a apresentação dos transportadores de suprimentos. Destruí-las libera o item; ele quica nas quatro paredes e expira após 16 s. Nenhum inimigo comum vira fonte de itens.
- Talassarca visto por cima, aquático e sobrevoável; casca/forma interna com arte própria. Três órgãos dorsais recebem dano e param de atirar quando destruídos; a metamorfose renova os órgãos. Segunda forma alterna salvas miradas e cortina com corredor.
- Seleção de missão funcional antes dos pilotos; somente Fenda liberada. Quatro cards e quatro perfis, cada confirmação sobre o card escolhido.
- Laterais sem atalhos e sem texto sob os ícones. Piloto/pontos/vidas/especial de um lado; missão/arma/P/avanço do outro. Ícones animados para especial/P.
- Preparação, pausa, opções, derrota e conclusão em carbono fosco. Comandos enxutos e áudio funcional; guia de itens mostra uma célula do atlas, em vez da spritesheet inteira comprimida. Teclado navega corretamente nos botões dos resultados. Controle padrão mantém perfil no botão norte e mostra comandos conforme dispositivo nas telas.

## Referências e decisões autorais

Referências consultadas: [Fire Shark, manual Mega Drive](https://www.retrogames.cz/manualy/Genesis/Fire_Shark_-_Genesis_-_Manual.pdf) e [Sonic Wings 2, manual](https://db.hfsplay.fr/files/2019/06/14/1aa6199e-35d2-456a-8a2f-e3513f37594e.pdf). O manual de Sonic Wings permanece no material local de pesquisa; a consulta web também encontrou limite de tamanho desse PDF.

A cascata azul máximo → verde inicial → rubro inicial é decisão posterior do usuário para Bullet Wake. Não é regra original de Fire Shark, que separa cor de potência. Projéteis 3/5/9/16, ondas 2/4/6/8, dano, cadência, par de mísseis no NV3 e duração de efeitos são calibração nossa. Não atribuir números não medidos às ROMs.

Bomba independente continua removida: repetiria a limpeza/proteção já coberta pelo especial limitado. Estoque 2/máximo 3 e uma reposição no roteiro mantêm a decisão de quando usar, sem mais um botão.

## Arte nova e proveniência

Assets raster originais gerados para esta revisão, integrados com transparência. Frames foram recortados e padronizados em atlas; não são recortes da key art inicial.

| Arquivo | Brief de produção e integração |
|---|---|
| [Retrato Lyra](../public/assets/pilot-selection/portrait-lyra.webp) | Mulher adulta de pele morena, cabelo curto com tranças/undercut, uniforme grafite/jade, pintura matte conceitual. 512×512. |
| [Kestrel no menu](../public/assets/pilot-selection/ship-lyra.webp) | Caça humano marfim/grafite/jade, duas naceles, apresentação em três quartos compatível com os outros cards. |
| [Kestrel em combate](../public/assets/combat-hd/kestrel.webp) | Atlas 4×256, dorsal ortográfico. Usar os dois frames neutros na gameplay. |
| [Suprimento](../public/assets/combat-hd/supply-parachute.webp) | Caixa grafite sob paraquedas branco, quatro poses, atlas 4×256. |
| [Talassarca/casca](../public/assets/combat-hd/talassarca-top.webp) | Anatomia dorsal de organismo aquático colossal, placas e órgãos emissores; atlas 4×512. |
| [Talassarca/interno](../public/assets/combat-hd/inner-top.webp) | Forma dorsal exposta, membranas, tentáculos e órgãos jade/coral; atlas 4×512. |

Os quatro frames de criatura foram gerados como poses próprias; não há pulsação por esmagar/esticar continuamente a mesma imagem. Durante a metamorfose, a interpolação de tamanho acompanha a troca de camada.

## Medição após contornos reais

Ensaio controlado no navegador: RIVET central, Talassarca em movimento, cadência rápida, sem especial e sem esquiva. Mísseis automáticos incluídos em NV3/NV4. Ambas as camadas e metamorfose estão no tempo. A máscara usa o frame renderizado durante a simulação; o ensaio não reproduz decisões humanas nem todas as poses ao longo de uma partida.

| Arma | Tempo até destruir ambas as camadas |
|---|---:|
| Azul NV2 | 59,04 s |
| Azul NV3 | 32,00 s |
| Azul NV4 | 21,28 s |
| Verde NV1 | 22,50 s |

O contorno colossal aumentou quantos tiros azuis acertam ao sobrevoar o corpo. A primeira medição dava 37,08 s para o verde, uma regressão ao evoluir; dano do verde foi recalibrado e medido novamente. O verde mantém ondas e maior concentração frontal. Nada disso prova que a dificuldade humana esteja pronta.

## O que ainda falta na Fase 1

1. Partidas humanas completas no Normal, sobretudo perder P, morrer perto de Raia/Talassarca e recuperar sob pressão. Com três vidas de um impacto, o balanceamento anterior de integridade não pode ser considerado aprovado automaticamente.
2. Comparar os quatro pilotos nas três famílias, incluindo especiais e cobertura. O orçamento inicial de dano é próximo, mas equilíbrio entre estratégias exige playtest.
3. Avaliar audição, impacto e leitura do especial em combate intenso e a metamorfose em movimento; as checagens técnicas não aprovam a experiência sozinhas.
4. Medir duração real da Fenda e seus acontecimentos; ampliar apenas se houver conteúdo que justifique cinco minutos. Produzir outras fases continua condicionado à aprovação explícita.

## Validação técnica concluída

Build/TypeScript aprovado e 163 testes aprovados. [Relatório de navegador](screenshots/phase1-arcade/validation.json) e [capturas](screenshots/phase1-arcade/) em 1366×768 e 1920×1080, sem erros de navegador. Cobertura: quatro cards/perfis sem scroll, confirmação separada, seleção de missão, disparo rápido durante deslocamento, par de mísseis automático, contato real de alfa, colisão em extremidade/vazio, formas colossais, paraquedas, quique, perda/recuperação do armamento, proteção de reaparecimento, pausa, comandos, guia de itens, opções iniciais, derrota e conclusão sem cortes. Navegação do resultado por setas + Enter foi exercitada.

Controle foi verificado por snapshots padronizados da Gamepad API e testes de bordas/deadzone/botões, incluindo a separação perfil/míssil removido. Isso não equivale a testar fisicamente todos os modelos de controle. Revisão visual das capturas executada; aprovação final da Fase 1 permanece com o usuário.
