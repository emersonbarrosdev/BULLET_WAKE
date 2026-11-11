import type { PilotId } from './pilots.ts';
export type RadioEvent = 'death1'|'death2'|'deathlater'|'comeback'|'crowd'|'fear'|'miniboss'|'boss'|'upgrade'|'idle'|'victory';
export const PILOT_RADIO:Record<PilotId,Record<RadioEvent,readonly string[]>> = {
  "nolan": {
    "death1": [
      "Primeira nave perdida. Concentra aí, meu.",
      "O bico não é escudo. Acabamos de comprovar.",
      "Eu piloto. Você desvia. Vamos alinhar isso.",
      "Tá olhando o mar ou as balas?",
      "Beleza. Aquela nave era de treinamento. Era, sim."
    ],
    "death2": [
      "Duas naves? A seguradora já bloqueou seu número.",
      "Segunda vez. Agora olha pra tela, não pra mensagem.",
      "Eu voltei. Minha paciência ficou na outra nave.",
      "Você e esses aliens estão de parceria?",
      "Se eu reclamar mais alto, você desvia melhor?"
    ],
    "deathlater": [
      "Outra? Vou começar a cobrar por fuselagem.",
      "Tem mais nave no estoque do que concentração aí.",
      "O alien nem precisou mirar dessa vez.",
      "Respira. A próxima curva a gente faz junto.",
      "Vou fingir que isso era uma manobra avançada."
    ],
    "comeback": [
      "Agora sim! Voltei e trouxe o prejuízo pra eles.",
      "Duas quedas depois, acabou a diplomacia.",
      "Esse é o piloto que eu estava esperando!",
      "Recado pros aliens: a franquia é por conta deles.",
      "Devolvendo cada parafuso com juros."
    ],
    "crowd": [
      "Tem especial guardado e alien sobrando. Faz a conta.",
      "Aquele especial não rende juros, chefe.",
      "Se lotar mais, vira condomínio alienígena.",
      "Hora boa pra apertar o botão que brilha.",
      "Se está esperando convite pro especial, tá convidado."
    ],
    "fear": [
      "Não gostei do tamanho daquilo. Nem um pouco.",
      "Minha mão tá firme. O resto a gente conversa depois.",
      "Aquela coisa piscou pra mim. Prefiro que não.",
      "Coragem é continuar mesmo ouvindo esse barulho.",
      "Se eu ficar quieto agora, é concentração. Ou medo."
    ],
    "miniboss": [
      "VOCÊ É O BICHÃO MESMO, HEIN!",
      "Primeiro mestre no chão. Agora eu acredito!",
      "Esse alien dá um belo hambúrguer.",
      "Raia no cardápio. Sem acompanhamento.",
      "Mandou bem! Vou apagar a parte das reclamações."
    ],
    "boss": [
      "Olha os implantes. Cada canhão desses pode cair.",
      "Isso não é uma ilha. Repito: não é uma ilha.",
      "Mira nas armas instaladas antes que elas mirem na gente.",
      "Se tem parafuso, tem peça pra arrancar.",
      "Grande assim e ainda precisa de canhão. Apelão."
    ],
    "upgrade": [
      "Agora o tiro tem presença. Gostei.",
      "Mais potência, mesma responsabilidade de desviar.",
      "Essa melhoria a gente conquistou. Faz valer.",
      "A oficina caprichou nessa rajada.",
      "O alien pediu silêncio. Negado."
    ],
    "idle": [
      "Olha pra tela, não pra mensagem, caramba.",
      "Concentra aí, meu. Eu espero a piada terminar.",
      "Se eu coubesse fora do card, já estava desviando por você.",
      "Esse oceano é bonito. Visita depois da missão.",
      "A quarta parede não para projétil. Confirmado."
    ],
    "victory": [
      "Fim da criatura. Começo da conta da oficina.",
      "Missão cumprida! Agora pode ler a mensagem.",
      "Bichão certificado. Sem contestação.",
      "O oceano voltou a ter dono. E não era aquilo.",
      "Boa! Hoje eu conto só a parte em que a gente venceu."
    ]
  },
  "cora": {
    "death1": [
      "Opa. Curva criativa, resultado caro.",
      "Era pra dançar entre as balas, não abraçar uma.",
      "Tudo bem. A Moth tem irmãs. Minha calma, não.",
      "Se esse era o plano, vamos improvisar outro.",
      "Alguém apertou a tecla de virar alvo?"
    ],
    "death2": [
      "Duas? Tá testando minha amizade, né?",
      "Voltei. Agora segura essa mão nervosa.",
      "Duas quedas e você ainda tá lendo minhas falas?",
      "Vou desenhar uma seta: fuja das bolinhas.",
      "A gravidade ganhou de novo. Não gostei."
    ],
    "deathlater": [
      "Colecionar explosão própria não dá conquista.",
      "A nave voa melhor inteira, só lembrando.",
      "Esse desvio chegou na atualização seguinte.",
      "Meu cabelo aguentou. O casco nem tanto.",
      "Bora de novo. Com menos contato visual com a bala."
    ],
    "comeback": [
      "Agora sim, a dança ficou nossa!",
      "Eu voltei mais rápida e bem menos simpática.",
      "Duas quedas renderam um solo de vingança.",
      "Quem caiu? Eu só troquei de figurino.",
      "Assim eu até perdoo as outras naves. Talvez."
    ],
    "crowd": [
      "Solta o especial, isso aqui virou bloco de carnaval.",
      "Tem convite demais nessa festa. Usa o especial.",
      "Especial guardado não cabe no álbum de lembranças.",
      "Aperta o botão bonito. A pista tá lotada.",
      "Eu danço, mas não com vinte parceiros atirando."
    ],
    "fear": [
      "Acho que meu radar também ficou com medo.",
      "Tá tudo sob controle. Quem disse foi meu pânico.",
      "Aquilo mexeu? Preferia quando era uma rocha.",
      "Medo? Não. Respeito em velocidade máxima.",
      "Se eu rir agora, é mecanismo de sobrevivência."
    ],
    "miniboss": [
      "VOCÊ É O BICHÃO! Eu sabia. Quase sabia.",
      "Raia frita! Alguém trouxe limão?",
      "Esse boss saiu do palco mais cedo.",
      "Olha só! Você desviando e acertando ao mesmo tempo!",
      "Aplausos! Bem curtos, que ainda tem bala vindo."
    ],
    "boss": [
      "Os canhões estão montados na criatura. Arranca eles.",
      "Um resort inteiro de tentáculos. Que horror.",
      "Isso ocupa a tela e ainda acha pouco espaço.",
      "Mira nas torres. Vamos desmontar esse condomínio.",
      "Arma e alien no mesmo pacote. Promoção péssima."
    ],
    "upgrade": [
      "Agora minha dança ganhou trilha verde.",
      "Essas ondas estão um espetáculo!",
      "Mais potência. Sem perder a elegância.",
      "Isso! O tiro ficou com a minha cara.",
      "Quem disse que espiral era só penteado?"
    ],
    "idle": [
      "Olha a tela! Minha fofoca pode esperar.",
      "Se eu falar demais, ignora só a metade engraçada.",
      "Você lê minhas falas, eu leio suas curvas. Justo.",
      "A gente quebra a quarta parede, não o casco. Combinado?",
      "Depois eu mando isso por mensagem. Desvia primeiro."
    ],
    "victory": [
      "Dançamos em cima do desastre. Literalmente.",
      "Missão cumprida. Pode respirar e rir agora.",
      "O alien saiu de cena. Eu fico pros aplausos.",
      "Bichão e bichona: equipe completa.",
      "Esse mar merece férias. A gente também."
    ]
  },
  "harlan": {
    "death1": [
      "Casco novo. Erro antigo. Ajusta a mão.",
      "Isso custou uma nave. Guarda a lição.",
      "A bala não ia sair da frente sozinha.",
      "Já derrubei coisa maior. Só preciso da sua ajuda.",
      "Sem pressa. Também sem estacionar na linha de tiro."
    ],
    "death2": [
      "Duas naves. O orçamento acabou antes da fase.",
      "Voltei. E agora estou pessoalmente ofendido.",
      "Duas quedas. Chega de gentileza com alien.",
      "Você mira bem. Falta combinar com o desvio.",
      "Meu joelho não reclamou tanto quanto você pilotando."
    ],
    "deathlater": [
      "Mais sucata. Pelo menos eu conheço oficina.",
      "Belo teste de resistência. Da minha paciência.",
      "Essa a gente podia ter evitado. Vamos evitar a próxima.",
      "Ainda tem trabalho. Levanta o nariz.",
      "Eu não desisti. Só estou reclamando com método."
    ],
    "comeback": [
      "Pronto. Agora é serviço pesado.",
      "Duas quedas depois, trouxe a ferramenta certa.",
      "Isso. Trabalho limpo, alien em pedaços.",
      "Quem me derrubou devia ter confirmado o serviço.",
      "O veterano voltou. E trouxe cobrança."
    ],
    "crowd": [
      "Usa o especial. Ferramenta parada enferruja.",
      "A sala encheu. Hora de abrir espaço.",
      "Não guarda munição pro inventário final.",
      "Especial. Agora seria uma excelente ideia.",
      "Se esperar mais, vamos precisar de dois especiais."
    ],
    "fear": [
      "Isso é maior que o estaleiro onde trabalhei.",
      "Não vou mentir. Aquela coisa impõe respeito.",
      "Se tem tanta perna, devia pagar mais imposto.",
      "Mão firme. O resto da nave a gente solda depois.",
      "Esse é o tipo de serviço que merece adicional."
    ],
    "miniboss": [
      "É o bichão mesmo. Serviço aprovado.",
      "Essa raia dá churrasco pro esquadrão inteiro.",
      "Primeiro mestre desmontado. Separa as peças boas.",
      "Bom trabalho. Sem discurso, ainda tem serviço.",
      "Alien no chão. Café depois."
    ],
    "boss": [
      "Tem arma aparafusada na casca. Solta os parafusos.",
      "Pontos separados. Destrói um de cada vez.",
      "Colocaram artilharia num crustáceo. Péssima engenharia.",
      "As torres são prioridade. Depois, a carapaça.",
      "Se cresce arma de metal, também perde peça de metal."
    ],
    "upgrade": [
      "Agora tem peso no gatilho.",
      "Boa melhoria. Vamos fazer render.",
      "O rubro não pede passagem. Abre caminho.",
      "Isso é poder de fogo com nota fiscal.",
      "A oficina acertou nessa regulagem."
    ],
    "idle": [
      "Concentra no serviço. A conversa não desvia bala.",
      "Tá lendo por quê? Eu também leio depois.",
      "Essa quarta parede tá precisando de reforço.",
      "A nave aguenta muita coisa. Distração não.",
      "Eu conto a história quando a gente pousar."
    ],
    "victory": [
      "Serviço concluído. Pode chamar a equipe de limpeza.",
      "Missão cumprida. Agora aceito o café.",
      "Dá um belo churrasco. Precisa de uma churrasqueira maior.",
      "Sobrevivemos. Já é uma boa entrega.",
      "Pronto. Isso não entra na garantia."
    ]
  },
  "lyra": {
    "death1": [
      "Registro: a bala ocupava exatamente nossa posição.",
      "A precisão estava ótima. Na direção errada.",
      "Perdemos uma nave. Vamos preservar a próxima.",
      "Hipótese de atravessar projétil: rejeitada.",
      "Ainda dá pra corrigir a trajetória. Desta vez, antes."
    ],
    "death2": [
      "Duas perdas. O relatório ficou desconfortável.",
      "Voltei. Com menos dados e mais rancor.",
      "A segunda nave também não tinha modo fantasma.",
      "Probabilidade de eu reclamar: cem por cento.",
      "Você controla a nave. Eu controlo a ironia. Quase."
    ],
    "deathlater": [
      "Mais uma amostra para o estudo de colisões.",
      "O resultado era previsível. Queria estar errada.",
      "A ciência recomenda não repetir esse experimento.",
      "Recuperação iniciada. Orgulho, não localizado.",
      "Vamos tentar uma variável nova: desviar."
    ],
    "comeback": [
      "Correção aplicada. Agora o problema é deles.",
      "Duas quedas, oito respostas. Gosto dessa proporção.",
      "O retorno ficou estatisticamente satisfatório.",
      "A raiva melhorou a precisão. Não vou publicar isso.",
      "Dados suficientes. Iniciando revanche."
    ],
    "crowd": [
      "Especial disponível. Densidade hostil absurda. Sugestão óbvia.",
      "O melhor momento do especial passou. O segundo é agora.",
      "Tem mais alvo que espaço livre. Abre um corredor.",
      "A carga não vence no fim da fase. Pode usar.",
      "Preciso reduzir essa quantidade de variáveis. Especial?"
    ],
    "fear": [
      "Não existe escala confortável para aquela criatura.",
      "Meu cálculo terminou com um ponto de interrogação.",
      "O radar pediu pra sair. Entendo o radar.",
      "Estou calma. Meu pulso discorda dos dados.",
      "Isso não estava no treinamento. Nem na margem de erro."
    ],
    "miniboss": [
      "Você é o bichão mesmo. Dado confirmado.",
      "A biomassa daria um hambúrguer de laboratório gigante.",
      "Miniboss resolvido. Belo experimento de campo.",
      "Preciso admitir: essa foi elegante.",
      "Registro oficial: mandou muito bem."
    ],
    "boss": [
      "Implantes mecânicos detectados. Cada um é um alvo.",
      "Seis pontos vulneráveis. Escolhe e insiste.",
      "A criatura usa armas instaladas. Vamos desinstalar.",
      "Canhões primeiro. Discussão sobre bioética depois.",
      "Esse organismo claramente excedeu o limite de acessórios."
    ],
    "upgrade": [
      "Precisão ampliada. Gostei desse resultado.",
      "Mais potência, mesma necessidade de alinhar.",
      "O disparo ficou mais denso. Exatamente o previsto.",
      "Melhoria instalada sem reiniciar o universo.",
      "É assim que um teste deveria terminar."
    ],
    "idle": [
      "Olha para a tela. A mensagem é uma variável secundária.",
      "Sim, eu sei que você está lendo isso agora.",
      "Quebrar a quarta parede não melhora a blindagem.",
      "Sugestão científica: menos leitura, mais reflexo.",
      "Se eu distrair você, a culpa continua dividida."
    ],
    "victory": [
      "Missão concluída. Resultado acima da margem esperada.",
      "Pode olhar a mensagem agora. Essa é a parte segura.",
      "O relatório vai omitir nossas tentativas anteriores.",
      "A criatura perdeu. A coleta de dados ganhou.",
      "Excelente. Vamos pousar antes que apareça outra variável."
    ]
  }
  ,bento:{
 death1:['Entrega interrompida. O remetente vai reclamar.','Essa nave ainda estava parcelada!','Carimbo novo: frágil. Muito frágil.','Foi um pouso? Não. Definitivamente não.','Uma nave a menos. As cartas continuam comigo.'],
 death2:['Duas quedas e nenhum seguro. Belo serviço.','Voltei. A taxa de entrega agora inclui vingança.','Minha esposa vai ler esse relatório antes de mim.','Segunda tentativa de virar sucata. Aprovada.','Respira. Não quero entregar a terceira nave ao mar.'],
 deathlater:['O oceano já tem meu endereço?','Mais uma nave. Menos uma piada disponível.','Isso conta como devolução ao remetente?','A próxima entrega vai ser de chumbo.','Pega meu armamento. E um pouco de juízo.'],
 comeback:['Duas quedas depois, chegou minha resposta!','Acabou a simpatia. Entrega expressa!','Agora eu cobro cada nave que perdi.','Pode preparar o recibo, alien!','Minha melhor rota é por cima deles.'],
 crowd:['Tem especial. Tem fila de alien. Faz a conta.','Esse estoque não rende juros. Usa!','O corredor lotou. Hora de abrir outra rota.','Especial disponível, paciência indisponível.','Manda a esquadrilha antes que eu vire encomenda.'],
 fear:['Isso aceita negociação? Perguntando por mim.','Nunca entreguei carta num monstro desse tamanho.','Meu radar acabou de pedir demissão.','A mão está firme. O joelho é outro departamento.','Se der ruim, apaga meu histórico de entregas.'],
 miniboss:['Você é o bichão mesmo, hein! Assina aqui!','Esse alien dá um belo hambúrguer família.','Miniboss entregue. Falta só o comprovante.','Foi bonito. Não espalha que eu elogiei.','Pacote grande resolvido. Próxima parada!'],
 boss:['Canhões instalados. Vamos cancelar essa assinatura.','Cada arma quebrada é uma preocupação a menos.','Esse bicho encomendou peças demais.','Olho e canhão são endereços diferentes. Mira direito.','Tem uma camada embaixo da casca. Péssima embalagem.'],
 upgrade:['Chegou o reforço. Sem frete!','Agora a rajada cabe numa caixa maior.','Potência nova. Responsabilidade velha.','Gostei desse pacote. Vamos testar.','O próximo alien recebe em dobro.'],
 idle:['Olha para a tela, não para a mensagem, caramba.','Sim, sou eu falando com você do outro lado.','Essa caixa de texto não desvia bala.','Concentra aí, meu. Tenho família esperando.','Se estiver lendo, pelo menos continua atirando.'],
 victory:['Entrega concluída. Agora falta voltar para casa.','Pode respirar. E assinar o recibo.','Salvamos a costa. Minha esposa vai gostar da notícia.','Boa pilotagem. Vou omitir as batidas do relatório.','A mala continua cheia. A esperança também.']
 }
};
