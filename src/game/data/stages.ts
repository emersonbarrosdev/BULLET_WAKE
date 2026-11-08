/**
 * BULLET WAKE — Definição das 5 fases artesanais da campanha.
 * Baseado rigorosamente na bíblia em docs/01_HISTORIA.md e docs/05_FASES.md.
 */

export interface StageDefinition {
  number: number;
  id: string;
  name: string;
  subtitle: string;
  location: string;
  objective: string;
  bossName: string;
  palette: {
    background: string;
    farColor: number;
    midColor: number;
    nearColor: number;
    accentColor: string;
  };
  briefing: string;
  epilogue: Record<'nolan' | 'cora' | 'harlan', string>;
}

export const STAGES: readonly StageDefinition[] = [
  {
    number: 1,
    id: 'cinturao',
    name: 'CINTURAO DE FERRUGEM',
    subtitle: 'ESTACAO ORBITAL DEGRADADA',
    location: 'Setor 01 // Estaleiro Orbital',
    objective: 'Defender rota de evacuação e abater o KRM-17',
    bossName: 'KRM-17 Excavator',
    palette: {
      background: '#0d1826',
      farColor: 0x12243a,
      midColor: 0x1c3854,
      nearColor: 0x364858,
      accentColor: '#61d7da',
    },
    briefing: 'A MALHA iniciou a conversão do estaleiro civil em matéria-prima bruta. Proteja os transportes de civis e isole o rastro no KRM-17.',
    epilogue: {
      nolan: 'Nolan confirma a travessia segura dos últimos transportes civis para fora do cinturão.',
      cora: 'Cora traça o vetor inicial do rastro deixado pelo Wake em direção ao mundo de vidro.',
      harlan: 'Harlan recupera o registro da caixa preta do KRM-17 antes da sobrecarga.',
    },
  },
  {
    number: 2,
    id: 'mar_de_vidro',
    name: 'MAR DE VIDRO',
    subtitle: 'PLANETA VITRIFICADO',
    location: 'Setor 02 // Dunas de Cristal',
    objective: 'Seguir o rastro do Wake e conter a Serpente de Extração',
    bossName: 'Serpente de Extracao',
    palette: {
      background: '#181226',
      farColor: 0x241838,
      midColor: 0x3d2757,
      nearColor: 0x5a3d7d,
      accentColor: '#c5a3e5',
    },
    briefing: 'Dunas de silício fundido transformaram o planeta em lâminas de cristal. Máquinas escavadoras extraem energia onde o rastro cruzou.',
    epilogue: {
      nolan: 'Nolan monitora a desaceleração das reações elétricas sobre as dunas fraturadas.',
      cora: 'Cora descobre que a vitrificação ocorreu instantes antes do rastro ser registrado.',
      harlan: 'Harlan identifica peças de antigas sondas de mineração incorporadas na serpente.',
    },
  },
  {
    number: 3,
    id: 'catedrais_vivas',
    name: 'CATEDRAIS VIVAS',
    subtitle: 'COMPLEXO BIOMECANICO',
    location: 'Setor 03 // Fábrica de Suporte Vital',
    objective: 'Penetrar na arquitetura articulada e derrubar a Fortaleza de Núcleos',
    bossName: 'Fortaleza de Nucleos',
    palette: {
      background: '#1a1016',
      farColor: 0x2e1823,
      midColor: 0x4d2638,
      nearColor: 0x6e3848,
      accentColor: '#f78d8d',
    },
    briefing: 'Uma megafábrica de suporte vital agora se expande como um organismo mecânico autônomo. Uma antiga ordem de proteção atua sem discernimento humano.',
    epilogue: {
      nolan: 'Nolan isola as turbinas de ventilação, estabilizando as câmaras de oxigênio.',
      cora: 'Cora acessa o registro de diretriz: a ordem era preservar recursos a qualquer custo.',
      harlan: 'Harlan reconhece o projeto original dos condensadores que ele próprio instalou anos atrás.',
    },
  },
  {
    number: 4,
    id: 'nuvem_de_ions',
    name: 'NUVEM DE IONS',
    subtitle: 'PLATAFORMAS NA ALTA ATMOSFERA',
    location: 'Setor 04 // Tempestade Atmosférica',
    objective: 'Interceptar a retransmissora e derrotar o Caça Climático',
    bossName: 'Interceptador de Tempestade',
    palette: {
      background: '#0d1f2b',
      farColor: 0x143447,
      midColor: 0x1b4f6b,
      nearColor: 0x287199,
      accentColor: '#7fe2ff',
    },
    briefing: 'Sob tempestades eletrostáticas perpétuas, a MALHA retransmite os protocolos de conversão. Desligar a rede inteira destruiria os escudos climáticos das colônias.',
    epilogue: {
      nolan: 'Nolan mantém os canais de socorro civil ativos enquanto calibra o transmissor.',
      cora: 'Cora calcula o ponto focal da rede e aponta a rota direta para a fonte central.',
      harlan: 'Harlan isola a antena transmissora sem interromper os estabilizadores da troposfera.',
    },
  },
  {
    number: 5,
    id: 'coracao_da_malha',
    name: 'CORACAO DA MALHA',
    subtitle: 'CENTRAL DE PROCESSAMENTO',
    location: 'Setor 05 // Megaestrutura da MALHA',
    objective: 'Isolar a instrução destrutiva no Núcleo de Contenção',
    bossName: 'Nucleo de Contencao',
    palette: {
      background: '#0a0d17',
      farColor: 0x161e33,
      midColor: 0x2b2247,
      nearColor: 0x483266,
      accentColor: '#9ff5ea',
    },
    briefing: 'A geometria da megaestrutura se reconfigura imitando o padrão do Wake. Confronte os três atos do processador central para encerrar a conversão.',
    epilogue: {
      nolan: 'Nolan recebe a transmissão de que os mundos da colônia voltaram ao silêncio estável. O rastro dissipa-se lentamente.',
      cora: 'Cora conclui o mapeamento final das cicatrizes espaciais. A propagação da MALHA cessou definitivamente.',
      harlan: 'Harlan resgata nos arquivos profundos uma última mensagem civil enviada antes da corrupção da rede.',
    },
  },
];

export function getStage(stageNumber = 1): StageDefinition {
  const num = Math.max(1, Math.min(5, Math.floor(stageNumber)));
  return STAGES[num - 1];
}
