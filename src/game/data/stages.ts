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
    id: 'bosque_da_nevoa_viva',
    name: 'BOSQUE DA NÉVOA VIVA',
    title: 'Bosque da Névoa Viva',
    subtitle: 'FLORESTA TROPICAL INFESTADA',
    biome: 'Dossel Vegetal Biomecânico',
    location: 'Setor 02 // Bacia Tropical',
    objective: 'Aniquilar a proliferação de esporos alienígenas e purgar Arborion',
    bossName: 'ARBORION — O CORAÇÃO VEGETAL',
    palette: {
      background: '#091c14',
      farColor: 0x0f2e1f,
      midColor: 0x16422b,
      nearColor: 0x1f5c3a,
      accentColor: '#34d399',
    },
    briefing: 'Névoas de biomassa alienígena cobriram o dossel tropical. Esporos vivos assimilam a flora nativa sob comando da entidade vegetal Arborion.',
    epilogue: {
      nolan: 'Nolan sobrevoa a floresta clareada, com as leituras de contaminação estabilizadas.',
      cora: 'Cora cataloga a estrutura simbiótica vegetal, confirmando a origem extraterrestre da invasão.',
      harlan: 'Harlan estabelece perímetro de quarentena sobre a bacia após aniquilar o núcleo.',
    },
  },
  {
    number: 3,
    stageNumber: 3,
    id: 'metropole_do_silencio',
    name: 'METRÓPOLE DO SILÊNCIO',
    title: 'Metrópole do Silêncio',
    subtitle: 'CIDADE COSTEIRA EVACUADA',
    biome: 'Ruínas Urbanas Cristalizadas',
    location: 'Setor 03 // Zona Metropolitana Costeira',
    objective: 'Interromper a conversão de edifícios e destruir a Catedral de Vidro',
    bossName: 'CATEDRAL DE VIDRO',
    palette: {
      background: '#150f24',
      farColor: 0x241838,
      midColor: 0x3d2757,
      nearColor: 0x5a3d7d,
      accentColor: '#c084fc',
    },
    briefing: 'Arranha-céus evacuados foram envolvidos por monólitos de cristal vivo. Uma superestrutura geométrica converte energia civil para o enxame.',
    epilogue: {
      nolan: 'Nolan restabelece a rede defensiva da cidade ao dissipar as ressonâncias do prisma.',
      cora: 'Cora intercepta os últimos fluxos de dados direcionados para as coordenadas subterrâneas.',
      harlan: 'Harlan vasculha os escombros industriais, confirmando ausência de sobreviventes hostis.',
    },
  },
  {
    number: 4,
    stageNumber: 4,
    id: 'dunas_de_silicio',
    name: 'DUNAS DE SILÍCIO',
    title: 'Dunas de Silício',
    subtitle: 'DESERTO CRISTALIZADO',
    biome: 'Deserto Mineral Iônico',
    location: 'Setor 04 // Mar de Areia Iônica',
    objective: 'Cruzar as tempestades magnéticas e abater o Sifão das Dunas',
    bossName: 'SIFÃO DAS DUNAS',
    palette: {
      background: '#221508',
      farColor: 0x38220c,
      midColor: 0x543212,
      nearColor: 0x78461a,
      accentColor: '#f59e0b',
    },
    briefing: 'Tempestades de silício ionizado geram descargas atmosféricas letais. O Sifão das Dunas extrai minerais raros do manto terrestre.',
    epilogue: {
      nolan: 'Nolan conduz o esquadrão através da tempestade dissipada em direção aos cânions.',
      cora: 'Cora recalibra os sensores interferométricos imunes aos pulsos iônicos do deserto.',
      harlan: 'Harlan recolhe amostras de carapaças minerais fundidas pelo confronto com o Sifão.',
    },
  },
  {
    number: 5,
    stageNumber: 5,
    id: 'canion_das_sombras',
    name: 'CÂNYON DAS SOMBRAS',
    title: 'Cânion das Sombras',
    subtitle: 'FENDAS TECTÔNICAS ESCARPADAS',
    biome: 'Desfiladeiro Geológico Profundo',
    location: 'Setor 05 // Falha Tectônica Central',
    objective: 'Sobreviver à emboscada nas falhas e derrotar a Mandíbula do Horizonte',
    bossName: 'MANDÍBULA DO HORIZONTE',
    palette: {
      background: '#180a0a',
      farColor: 0x2e1212,
      midColor: 0x4a1c1c,
      nearColor: 0x6e2828,
      accentColor: '#f87171',
    },
    briefing: 'Paredões de rocha escarpada estreitam o espaço de manobra. A colossal Mandíbula do Horizonte embosca qualquer aeronave que tente alcançar a estratosfera.',
    epilogue: {
      nolan: 'Nolan ascende pelos paredões rumo ao oceano aberto, com o desfiladeiro pacificado.',
      cora: 'Cora detecta a convergência global das transmissões alienígenas rumo à órbita.',
      harlan: 'Harlan resfria os propulsores blindados após o embate final no desfiladeiro.',
    },
  },
];

export function getStage(stageNumber = 1): StageDefinition {
  const num = Math.max(1, Math.min(5, Math.floor(stageNumber)));
  return STAGES[num - 1];
}
