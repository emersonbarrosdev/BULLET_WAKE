# 06 — Catálogo MALHA: inimigos e bosses

## Origem
A MALHA adapta equipamentos de extração, manutenção, transporte, suporte e defesa. Cada inimigo deve ter papel claro e traços de sua função anterior; nada de drones iguais com cores diferentes.

| Família | Inimigo | Comportamento | Telegraph |
|---|---|---|---|
| Drone | Scout | entra, atira e sai | sensor acende |
| Drone | Dart | mergulho diagonal | alinha, acelera |
| Drone | Swarm | formação em onda | salva sincronizada |
| Interceptador | Lancer | acompanha altura do jogador | rajada preparada |
| Interceptador | Cutter | investida e retorno | pausa antes do avanço |
| Interceptador | Mirror | mira na posição prevista | laser de mira com atraso |
| Pesado | Bulwark | barreira móvel | placa abre |
| Pesado | Mortar | tiro em arco contra área | marca de impacto |
| Pesado | Crusher | bloqueio e carga | som e corpo recuam |
| Torre | Rail Node | canhão rotativo | linha de mira |
| Torre | Beam Gate | controla corredor | luz de carga |
| Biomecânico | Vertebra | corpo segmentado | segmento vibra |
| Biomecânico | Carrier | solta drones | cápsula abre |

FSM por tipo: SPAWN → APPROACH → TELEGRAPH → ATTACK → RECOVER → REPOSITION → DEATH/DESPAWN. Timers baseados em tempo, não em frames. Unidades não surgem coladas à nave sem aviso.

## Chefes por fase
**KRM-17 Excavator:** máquina de mineração gigantesca com broca frontal, duas armas laterais e placas; atacar canhões retira padrões, abrir placas revela núcleo. 3 etapas: canhões, broca/drones, núcleo.
**Serpente de Extração:** módulos articulados sob vidro; emergências com rachaduras/aviso, peças destruíveis reduzem alcance, cabeça exposta no fim.
**Fortaleza de Núcleos:** fabrica viva com três condensadores. Padrões modulados pela quantidade de núcleos ativos, não boss rígido único.
**Interceptador de Tempestade:** enorme veículo climático, asas com armas, turbinas eletrostáticas e relâmpagos avisados; abre janela vulnerável entre padrões.
**Núcleo de Contenção:** 3 estágios: módulos orbitais, geometria mutante, processador exposto; isolar ordem de conversão, não destruir suporte vital.

## Contrato boss
Introdução sem dano imediato, nome e barra legíveis, 2 ou mais padrões por etapa, telegraph proposto 0,6–1,2s, períodos de vulnerabilidade, rota de fuga em tela, partes danificáveis com HP próprio, destruição segmentada sem double-kill. Testar poderes de cada piloto, incluindo dash contra paredes e bomba em fases de invulnerabilidade do boss.

## Balanceamento
Scouts caem rapidamente; interceptadores valorizam movimento; pesados possuem janelas para tiro no ponto fraco. Boss exige ler padrão, não só segurar fire. Valores finais de HP, cadência e dano devem vir de playtest, não apenas estimativa.
