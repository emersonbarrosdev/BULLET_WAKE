/**
 * BULLET WAKE — Definição das 5 fases artesanais da campanha.
 * Baseado rigorosamente na bíblia em docs/01_HISTORIA.md e docs/05_FASES.md.
 */

export interface StageDefinition {
  number: number;
  stageNumber: number;
  id: string;
  name: string;
  title: string;
  subtitle: string;
  biome: string;
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
    stageNumber: 1,
    id: 'fenda_pelagica',
    name: 'FENDA PELÁGICA',
    title: 'Fenda Pelágica',
    subtitle: 'ABISMO OCEÂNICO INVADIDO',
    biome: 'Abismo Oceânico Profundo',
    location: 'Setor 01 // Mar Territorial',
    objective: 'Interceptar enxame alienígena submarino e destruir Talassarca',
    bossName: 'TALASSARCA',
    palette: {
      background: '#04101e',
      farColor: 0x071b30,
      midColor: 0x0a2f4a,
      nearColor: 0x0f4868,
      accentColor: '#38bdf8',
    },
    briefing: 'Enxames bio-alienígenas emergiram da Fenda Pelágica. Intercepte o avanço hostil no oceano profundo e aniquile a criatura colossal Talassarca.',
    epilogue: {
      nolan: 'Nolan estabiliza a nave sobre o oceano pacífico após neutralizar Talassarca.',
      cora: 'Cora decodifica o sinal de ressonância abissal emitido antes da destruição da criatura.',
      harlan: 'Harlan assegura o perímetro marítimo com fogo pesado, dissipando os restos do enxame.',
    },
  },
  {
    number: 2,
    stageNumber: 2,
    id: 'mar_de_vidro',
    name: 'MAR DE VIDRO',
    title: 'Mar de Vidro',
    subtitle: 'PLANETA VITRIFICADO',
    biome: 'Planeta Vitrificado',
    location: 'Setor 02 // Dunas de Cristal',
    objective: 'Seguir o rastro do Wake e conter a Serpente de Extração',
    bossName: 'Serpente de Extração',
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
    stageNumber: 3,
    id: 'catedrais_vivas',
    name: 'CATEDRAIS VIVAS',
    title: 'Catedrais Vivas',
    subtitle: 'COMPLEXO BIOMECANICO',
    biome: 'Complexo Biomecânico',
    location: 'Setor 03 // Fábrica de Suporte Vital',
    objective: 'Penetrar na arquitetura articulada e derrubar a Fortaleza de Núcleos',
    bossName: 'Fortaleza de Núcleos',
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
    stageNumber: 4,
    id: 'nuvem_de_ions',
    name: 'NUVEM DE IONS',
    title: 'Nuvem de Íons',
    subtitle: 'PLATAFORMAS NA ALTA ATMOSFERA',
    biome: 'Plataformas na Alta Atmosfera',
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
    stageNumber: 5,
    id: 'coracao_da_malha',
    name: 'CORACAO DA MALHA',
    title: 'Coração da MALHA',
    subtitle: 'CENTRAL DE PROCESSAMENTO',
    biome: 'Central de Processamento',
    location: 'Setor 05 // Megaestrutura da MALHA',
    objective: 'Isolar a instrução destrutiva no Núcleo de Contenção',
    bossName: 'Coração da MALHA',
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
