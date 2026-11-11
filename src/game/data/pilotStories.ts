import type { PilotId } from './pilots.ts';

export interface PilotStory {
  desire:string; wound:string; conflict:string; mission1:string; afterMission1:string; ending:string;
}
/** Campaign endings are authored; only the Phase 1 chapter is currently playable. */
export const PILOT_STORIES:Record<PilotId,PilotStory>={
 nolan:{desire:'Encontrar o irmão e recuperar a própria honra.',
  wound:'Terry desobedeceu uma retirada para salvar civis. Foi expulso do esquadrão; seu irmão voltou sozinho para procurar sobreviventes e desapareceu.',
  conflict:'Confunde coragem com nunca abandonar ninguém. Precisará aceitar ajuda e escolher os vivos, em vez de tentar apagar a culpa.',
  mission1:'O transmissor do meu irmão respondeu perto da fenda. O comando chama isso de ruído. Eu conheço aquele sinal. Vamos trazer essa gente para casa.',
  afterMission1:'O sinal não era um pedido de resgate: alguém repetia a rota de um comboio. Meu irmão deixou um caminho. Hoje salvamos a costa; amanhã sigo as pistas.',
  ending:'Terry encontra o irmão liderando uma rede de evacuação entre os cativos. Recusa a condecoração que apagaria a desobediência e funda um esquadrão de resgate. A honra passa a ser quem volta com ele.'},
 cora:{desire:'Reencontrar a mãe, uma pesquisadora dada como morta.',
  wound:'Tita denunciou experiências com o Wake. Sua mãe permaneceu no laboratório para proteger a equipe; a transmissão final pareceu uma despedida.',
  conflict:'Consegue interpretar os sinais alienígenas, mas teme que a voz familiar seja uma armadilha feita para ela.',
  mission1:'A assinatura da minha mãe está misturada ao canto dessas criaturas. Se for uma armadilha, eu descubro. Se for ela... ninguém vai desligar esse rádio.',
  afterMission1:'A voz parou quando o núcleo caiu, mas deixou uma coordenada. Não vou trocar a segurança da costa por uma resposta fácil. Desta vez, investigo acompanhada.',
  ending:'Tita encontra a mãe ligada à rede que mantém os cativos vivos. Juntas desligam o enxame, preservando as pessoas conectadas. A mãe volta sem parte das lembranças; a filha escolhe construir novas memórias.'},
 harlan:{desire:'Resgatar a filha e cumprir uma promessa antiga.',
  wound:'Osvald vendeu a oficina para financiar a carreira da filha. Brigaram quando ela escolheu trabalhar em uma plataforma que ele considerava perigosa; não se despediram.',
  conflict:'Seu poder de fogo abre caminhos, mas destruir tudo pode apagar as pistas e ferir quem deseja salvar.',
  mission1:'Minha filha trabalhava na plataforma além daquele recife. Primeiro abrimos passagem para os resgates. Depois cobro dos invasores cada minuto que ela passou lá.',
  afterMission1:'Encontramos o marcador da equipe dela, sem corpos. Ainda tem gente lá. Não é hora de comemorar nem de se jogar no mar: é hora de chegar inteiro.',
  ending:'Osvald encontra a filha coordenando a fuga de uma instalação inimiga. Pela primeira vez segue o plano dela. Reabrem a oficina como centro de reconstrução: a promessa passa a ser ouvir, além de proteger.'},
 lyra:{desire:'Encontrar o pai e manter aberta a clínica da família.',
  wound:'Luma virou piloto de exibição para pagar o tratamento da mãe. Seu pai transportava remédios quando desapareceu; a dívida continuou chegando.',
  conflict:'Aceita uma recompensa pela missão, mas terá de escolher entre uma prova valiosa da invasão e pessoas que precisam de ajuda agora.',
  mission1:'O último voo do meu pai cruzou essas águas. A recompensa paga a clínica, mas hoje ninguém fica para trás por falta de dinheiro. Me ajuda a manter essa promessa.',
  afterMission1:'O manifesto do cargueiro dele apareceu nos destroços. Os remédios chegaram a uma ilha antes da invasão. Alguém ainda pode saber para onde ele foi.',
  ending:'Luma encontra o pai mantendo uma enfermaria entre os refugiados. Abandona a recompensa imediata para retirar os feridos; os resgatados divulgam a história e financiam a clínica. A fama ganha um propósito que ela escolhe.'},
 bento:{desire:'Entregar a última carta e reencontrar a esposa.',
  wound:'Bento usava rotas clandestinas para fugir das próprias dívidas. A esposa ficou organizando abrigos; ele voltou tarde e encontrou apenas a mala de correspondência dela.',
  conflict:'Faz piada para esconder a vergonha. Carrega cartas de famílias desconhecidas porque não aceita declarar ninguém perdido, inclusive a si mesmo.',
  mission1:'Minha esposa deixou um mapa dentro da mala de cartas. Essa fenda engoliu a primeira parada. Vamos abrir a rota: tem muita gente esperando notícia boa.',
  afterMission1:'Achei um envelope dela num abrigo evacuado. Não era despedida, era instrução de entrega. Ela continua trabalhando. Melhor eu parar de enrolar e acompanhar.',
  ending:'Bento alcança a esposa quando ela prepara a última evacuação. Entrega as cartas antes de pedir perdão, sem prometer que tudo será fácil. Os dois inauguram uma rota de correio entre cidades reconstruídas. A primeira entrega é para casa.'},
};

export const DEV_SHOW_SECRET_PILOT=true;
export const SECRET_PILOT_CODE='WAKEBENTO';
export const CAMPAIGN_MAIN_STAGES=15;
export const SECRET_STAGE_IDS=[16,17] as const;
