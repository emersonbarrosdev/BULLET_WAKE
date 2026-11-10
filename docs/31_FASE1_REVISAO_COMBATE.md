# Fase 1 — revisão de combate, arte e confirmação

Revisão de 09/11/2026. **Esta é a revisão vigente da bíblia para a Fase 1.** Substitui os trechos conflitantes dos documentos 27–30 sobre vidas, hitbox, itens com legendas, arte de chefes, fundo e cadência. A Fase 2 permanece bloqueada até aprovação explícita da Fase 1 pelo usuário. O foco de produção continua sendo Nolan/RIVET; a arte de Moth e Knuckle foi preservada.

## Resultado implementado

| Pedido | Comportamento atual |
|---|---|
| Confirmação inequívoca | Clicar/tocar no card ou pressionar Enter escolhe o piloto. O botão **CONFIRMAR NOME [ENTER]** aparece sobre o próprio card escolhido. Outra ação confirma o início. Navegar, abrir perfil ou repetir Enter automaticamente não inicia combate. Cliques duplicados sobre a mesma posição têm proteção de 250 ms. |
| Preservar seleção | Cards, fontes, paleta e espaçamentos mantidos; perfil sem scroll em 1366×768 e 1920×1080. Perfil continua dentro de cada card. |
| Sem tremor | Removidas chamadas de shake e flash da câmera em dano, explosões, bombas e especiais. Efeitos locais preservam feedback. |
| Barra única | Integridade contínua de 0–100%. Balas normais causam 18%, cortadores 22%, Talassarca 25% e colisão aérea comum 30%. Proteção pós-impacto evita dano simultâneo repetido. H repara 30%. Não há três vidas nem renascimento automático. |
| Morte e Continue | Ao zerar o casco, a nave explode e aparece **CONTINUAR**. Só essa escolha retoma o início do setor: 0, 1000, 2100 ou 3200. Score reinicia; azul retorna a NV1, ou NV2 com reserva P completa. Progresso P parcial e dash já gasto são preservados. B volta ao estoque inicial de três; velocidade reinicia. Eventos anteriores ao checkpoint não são repetidos. |
| Colisão legível | Contorno da RIVET inclui bico e asas; cantos transparentes e chama dos motores não contam como casco. O tiro gera impacto no ponto atingido. Inimigos aéreos comuns explodem ao encostar mesmo quando dash/proteção impede dano ao jogador; esse choque não premia pontuação. |
| Escala | RIVET de 54 para 46 unidades; inimigos comuns de 47/62/61/66 para 38/48/46/50. Bandos usam 74% da escala comum. Chefes mantêm presença e corredores de esquiva. |
| Rotas coordenadas | Nove bandos com entrada escalonada, frágeis, rápidos e sem tiro; unidades armadas independentes. Separação de corpos entre rotas e exclusão ao redor do chefe antes de desenhar. Organismos ancorados permanecem presos à superfície. |
| Itens | Dez ícones raster próprios, com quatro frames diferentes, cor e símbolo identificáveis. **Sem texto ou placa abaixo no combate.** Explicações ficam em Opções → Guia de itens e armas, com a mesma arte dos itens. |
| Balas hostis | Seis spritesheets com quatro frames: agulha coral, gota azul, esporo magenta, crescente âmbar, glóbulo verde e anel ciano. Tamanhos variam de 18 a 24 unidades. Talassarca usa esporos magenta maiores; Raia-Dente e nadadores usam energia ciano. |
| Arte final | Raia-Dente e Talassarca têm sheets próprios de 512 px por frame. Especial, carga, míssil, chamas, disparos e explosão da RIVET têm arte raster animada. Não usam peças de chefes antigos. |

### Qual fase e qual plano de combate

**Fase 01: Fenda Pelágica, sobre a superfície do oceano terrestre invadido.** A RIVET voa; a cena não representa uma nave submersa. Água com espuma, esteiras, destroços e recifes alienígenas emergentes torna essa leitura explícita. O centro permanece escuro para contraste dos projéteis.

O fundo é composto por dois painéis raster que se deslocam fisicamente no eixo Y, com continuidade espelhada nas junções. A velocidade visível é 0,9× o avanço lógico. A validação compara capturas dos pixels da água em duas posições, isolando inimigos e interface.

As 123 entradas roteirizadas se distribuem pela fase: 42 unidades independentes, 52 integrantes de bandos, 21 portadores de suprimentos, cinco artilharias fixadas em recifes e três criaturas nadadoras. Não são 123 inimigos simultâneos.

- **Aéreo:** usa as artes aprovadas dos quatro inimigos, na mesma escala de perspectiva da nave; balas já aparecem no plano de combate, sem crescimento artificial.
- **Ancorado ao recife:** organismo radial verde, enraizado, sem asas; acompanha a água, telegrafa 750 ms e dispara duas sementes verdes. Não causa colisão aérea por contato.
- **Nadador:** serpente marinha azul-petróleo/ciano com cauda bifurcada, movimento sinuoso e arte própria. Não reutiliza a silhueta voadora ou a torre e não causa colisão de casco com a nave aérea.

As balas ascendentes desses organismos entram no plano de combate já com tamanho e colisão consistentes. A aproximação completa por profundidade em nuvens/espaço continua sendo uma diretriz futura descrita no documento 30, sem adicionar outras fases agora. Inimigos terrestres próprios serão produzidos quando o bioma terrestre entrar em produção.

## Fire Shark: referência e adaptação consciente

Fontes consultadas:

- [TATSUJIN/Toaplan — Fire Shark](https://www.toaplangames.co.jp/en/license/license-09.html): famílias de arma, itens, três P por evolução, cor repetida como pontos e ausência de colisão aérea com alvos de superfície.
- [Manual Mega Drive digitalizado](https://www.retrogames.cz/manualy/Genesis/Fire_Shark_-_Genesis_-_Manual.pdf): referência documental da conversão doméstica.
- [Sega-16 — Fire Shark](https://www.sega-16.com/2004/07/fire-shark/) e [Sega Does — Fire Shark](https://segadoes.com/2017/03/14/fire-shark/): evolução do tiro inicial triplo, cobertura ampla do azul no máximo e identidade das três armas. A análise do Sega Does descreve 16 projéteis azuis no máximo.
- [1CC Log — Fire Shark Mega Drive](https://1cclog.blogspot.com/2012/02/fire-shark-mega-drive.html): nove P até o máximo e particularidades da cadência da versão doméstica.
- [Manual de Sonic Wings Special](https://psinstructionmanual.com/sonicwingsspecial/): ataque especial próprio de cada piloto e separação entre tiro, rapid fire e ataque especial. Orienta identidade visual/funcional; nenhuma arte foi copiada.

**Regras preservadas:** azul/verde/vermelho escolhem a família; potência é independente da cor; cada três P sobe um nível, nove P chegam ao NV4; repetir a cor equipada rende 5.000 pontos, sem potência extra. Não há P máximo nem P aleatório em bandos no Normal. O roteiro distribui nove P ao longo de toda a aproximação.

**Dispersão Azul:** 3 / 5 / 9 / 16 projéteis por salva, saindo do mesmo canhão frontal e abrindo progressivamente o leque. Os extremos mantêm velocidade total de 640 unidades/s. Os patamares intermediários e ângulos são calibração própria de Bullet Wake; não são anunciados como reprodução exata de ROM. O pedido de cinco tiros no segundo patamar foi preservado.

**Energia Espiralada:** foco frontal com filamentos verdes sinuosos. **Laser Rubro:** chamas raster contínuas em 1 / 2 / 4 / 6 fluxos, com varredura lateral nos níveis avançados. Colisão e desenho seguem a mesma geometria, usando o tamanho atual dos inimigos.

**Cadência modernizada:** azul com salva a cada 125 ms; verde a cada 150 ms. Segurar e apertar repetidamente usam o mesmo relógio, sem bônus por tap ou repetição do teclado. O acumulador conserva frações de tempo entre frames; testes com 30/60/120 Hz verificam a equivalência. O autofire doméstico original não é tratado como modelo de conforto: a atualização aqui é intencional. Calor não interrompe o disparo contínuo.

## Bomba versus especial — decisão crítica

Dois ataques que limpam a tela e destroem os mesmos alvos seriam redundantes. A solução mantém a entrada X, mas restringe sua função:

| Entrada | Função | Limite e contrapartida |
|---|---|---|
| X — pulso defensivo | Limpa apenas balas próximas, num raio de 130 unidades; dá 400 ms de proteção e dano leve local. | Três cargas no máximo. Não limpa a tela inteira nem substitui a arma. B repõe uma carga. |
| V — Tempestade Prismática | Especial ofensivo da RIVET: três lanças e asas de energia azul/violeta, animadas com quatro frames, acompanhando a nave por 3,8 s. | Consome 100% de ressonância. Dano frontal por ticks de 100 ms, dentro do alcance desenhado. Não concede invulnerabilidade nem remove balas globalmente. |

O especial tem entrada/saída por alpha e animação por tempo, não por contagem de frames de renderização. Essa diferenciação é a recomendação implementada para avaliação jogável da Fase 1.

## Arte, procedência e validação

Os [assets finais](../public/assets/combat-hd/review/) foram criados com `image_gen`; recorte regular de grids, redimensionamento e empacotamento WebP foram feitos com FFmpeg. Há 27 spritesheets, 108 frames distintos e um fundo. O [manifesto](../public/assets/combat-hd/review/manifest.json) registra dimensões e uso; as [especificações dos prompts](32_FASE1_PROMPTS_ARTE.md) registram a direção de cada geração. Sem recortes promocionais ou assets de Fire Shark/Sonic Wings.

Validação desta revisão:

- `npm test`: 138 testes aprovados, incluindo contorno do casco, cadência, separação de rotas com chefe e Continue sem repetição de eventos anteriores.
- `npm run build`: TypeScript e produção aprovados; permanece o aviso de bundle acima de 500 kB.
- `node scripts/validate-pilot-selection.mjs --review`: Chrome real sobre o build de produção, em 1366×768 e 1920×1080. Confirma pixels do oceano em movimento, quatro frames distintos por sheet, ausência de legendas, barra única, impacto no bico, explosão ao contato protegido, diferença X/V, arte de chefes, vitória sem corte e Continue na Fase 1.
- `node scripts/validate-pilot-selection.mjs --confirmation`: clique, teclado e touch; perfis sem scroll; cards sem crescimento; confirmação sobre o card e piloto correto no combate.

Evidências: [relatório de combate](screenshots/phase1-review/validation.json), [combate em 1366×768](screenshots/phase1-review/combat-1366x768.webp), [Talassarca em 1920×1080](screenshots/phase1-review/talassarca-1920x1080.webp) e [relatório da seleção](screenshots/pilot-confirmation/validation.json). Capturas com armas/itens agrupados são montagens controladas pelo teste dentro do motor real, para inspecionar cada elemento; não representam densidade simultânea do roteiro.

## O que ainda falta

1. Avaliação jogável e aprovação visual da Fase 1 pelo usuário; ajustar pressão, dano e leitura conforme esse retorno. Testes automatizados não substituem essa aprovação.
2. Validar conforto e desempenho em aparelhos Android físicos e sessões prolongadas; a revisão atual comprova os dois viewports desktop, não uma certificação de hardware mobile.
3. Implementar e balancear Fácil, Difícil e Real posteriormente; continuam indisponíveis. Real precisa da tabela de letalidade, avarias e recuperação já prevista no documento 30.
4. Somente depois da aprovação da Fase 1: produção das fases seguintes e seus inimigos terrestres, aéreos em profundidade e espaciais, além dos efeitos específicos dos outros pilotos.

Raia-Dente, Talassarca e efeitos auxiliares da RIVET deixam de constar como arte pendente nesta revisão. Isso não equivale à aprovação da fase pelo usuário.
