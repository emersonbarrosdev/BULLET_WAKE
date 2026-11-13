/**
 * Geometria canônica do Arquipélago Tropical da Rota 01 — Fenda Pelágica.
 * Elimina definitivamente o efeito de rio: as bordas alternam massas costeiras
 * assimétricas (enseadas, falésias, porto conectado, promontório do farol e ilhotas)
 * com extensos trechos de mar aberto onde a água alcança 100% das extremidades
 * (x = 0 na esquerda, x = COAST_WIDTH na direita).
 * Espaçamento mínimo >= 160 px entre formações independentes do mesmo lado.
 */
export const COAST_WIDTH = 384;
export const COAST_PERIOD = 2400;

export type CoastSide = -1 | 1;
export type FormationKind =
  | 'village-cove'
  | 'rock-outcrop'
  | 'palm-peninsula'
  | 'harbor-left'
  | 'harbor-right'
  | 'lighthouse-cliff'
  | 'beach-cove'
  | 'palm-islet';

export interface ArchipelagoFormationSpec {
  readonly id: number;
  readonly side: CoastSide;
  /** Coordenada Y inicial no ciclo [0, COAST_PERIOD). Pode ser negativa se cruzar a costura cíclica. */
  readonly yStart: number;
  /** Coordenada Y final no ciclo. */
  readonly yEnd: number;
  /** Alcance máximo (px) a partir da borda (0..COAST_WIDTH) em direção ao canal marítimo. */
  readonly maxExtent: number;
  readonly kind: FormationKind;
  /** Quadro equivalente para compatibilidade com PelagicEnvironment (4=porto esq, 5=porto dir, 2=farol, etc.). */
  readonly legacyFrame: number;
}

/**
 * Distribuição assimétrica de arquipélago ao longo de 2400 px de período vertical:
 * - Lado Esquerdo (-1):
 *   1. [-65 .. 295]   (360 px) Enseada da Vila Tropical (cabanas, praia, falésias, palmeiras)
 *      -> Mar aberto: 295 .. 535 (240 px >= 150 px)
 *   2. [535 .. 655]   (120 px) Rochas Oceânicas & Recife Lateral
 *      -> Mar aberto: 655 .. 985 (330 px >= 150 px)
 *   3. [985 .. 1245]  (260 px) Península Rochosa & Palmeiras
 *      -> Mar aberto: 1245 .. 1495 (250 px >= 150 px)
 *   4. [1495 .. 1925] (430 px) Complexo Portuário Conectado à Costa (silo, galpão azul, 2 guindastes, píeres)
 *      -> Mar aberto: 1925 .. 2335 (410 px >= 150 px)
 *
 * - Lado Direito (+1):
 *   1. [-85 .. 95]    (180 px) Falésia Rochosa & Enseada Norte
 *      -> Mar aberto: 95 .. 265 (170 px >= 150 px)
 *   2. [265 .. 395]   (130 px) Ilhota de Palmeiras & Rochas Costeiras
 *      -> Mar aberto: 395 .. 735 (340 px >= 150 px)
 *   3. [735 .. 865]   (130 px) Atol Rochoso de Mar Aberto
 *      -> Mar aberto: 865 .. 1065 (200 px >= 150 px)
 *   4. [1065 .. 1345] (280 px) Píer Auxiliar Direito & Promontório Tropical
 *      -> Mar aberto: 1345 .. 1545 (200 px >= 150 px)
 *   5. [1545 .. 1765] (220 px) Promontório Rochoso do Farol & Casa do Faroleiro
 *      -> Mar aberto: 1765 .. 1925 (160 px >= 150 px)
 *   6. [1925 .. 2115] (190 px) Enseada de Praia Tropical, Corais & Palmeiras
 *      -> Mar aberto: 2115 .. 2315 (200 px >= 150 px)
 */
export const ARCHIPELAGO_SPECS: ReadonlyArray<ArchipelagoFormationSpec> = Object.freeze([
  // LADO ESQUERDO (-1)
  { id: 0, side: -1, yStart: -65, yEnd: 295, maxExtent: 108, kind: 'village-cove', legacyFrame: 0 },
  { id: 1, side: -1, yStart: 535, yEnd: 655, maxExtent: 76, kind: 'rock-outcrop', legacyFrame: 6 },
  { id: 2, side: -1, yStart: 985, yEnd: 1245, maxExtent: 104, kind: 'palm-peninsula', legacyFrame: 1 },
  { id: 3, side: -1, yStart: 1480, yEnd: 1890, maxExtent: 126, kind: 'harbor-left', legacyFrame: 4 },

  // LADO DIREITO (+1)
  { id: 4, side: 1, yStart: -85, yEnd: 85, maxExtent: 102, kind: 'beach-cove', legacyFrame: 1 },
  { id: 5, side: 1, yStart: 255, yEnd: 385, maxExtent: 88, kind: 'palm-islet', legacyFrame: 6 },
  { id: 6, side: 1, yStart: 735, yEnd: 855, maxExtent: 74, kind: 'rock-outcrop', legacyFrame: 6 },
  { id: 7, side: 1, yStart: 1065, yEnd: 1330, maxExtent: 118, kind: 'harbor-right', legacyFrame: 5 },
  { id: 8, side: 1, yStart: 1485, yEnd: 1695, maxExtent: 106, kind: 'lighthouse-cliff', legacyFrame: 2 },
  { id: 9, side: 1, yStart: 1850, yEnd: 2040, maxExtent: 98, kind: 'beach-cove', legacyFrame: 0 },
]);

function normalizeY(y: number): number {
  return ((y % COAST_PERIOD) + COAST_PERIOD) % COAST_PERIOD;
}

/**
 * Avalia o alcance costeiro (em px a partir da borda) de uma formação em uma coordenada Y cíclica.
 * Retorna 0 quando Y está em mar aberto fora da formação.
 */
function formationExtentAt(spec: ArchipelagoFormationSpec, rawY: number): number {
  const y = normalizeY(rawY);
  const len = spec.yEnd - spec.yStart;
  // Testa o intervalo principal e suas réplicas cíclicas (-COAST_PERIOD, +COAST_PERIOD)
  for (const shift of [0, -COAST_PERIOD, COAST_PERIOD]) {
    const localY = y + shift - spec.yStart;
    if (localY >= 0 && localY <= len) {
      const u = localY / len; // 0..1
      // Envelope orgânico suave (zero nas pontas, platô natural no corpo da formação)
      const edgeFade = Math.sin(Math.PI * u);
      const envelope = Math.pow(edgeFade, 0.62);
      // Modulação orgânica de enseadas e pontas rochosas
      const detail =
        0.88 +
        0.12 * Math.sin(u * Math.PI * 3.0 + spec.id * 1.7) +
        0.06 * Math.cos(u * Math.PI * 5.0 + spec.id * 0.9);
      return Math.min(spec.maxExtent * 1.05, spec.maxExtent * envelope * detail);
    }
  }
  return 0;
}

/**
 * Retorna a coordenada X (0..COAST_WIDTH) do limite da formação costeira em Y.
 * Em trechos de mar aberto, retorna 0 para o lado esquerdo (-1) e COAST_WIDTH (384) para o lado direito (1).
 */
export function coastBoundary(y: number, side: CoastSide): number {
  let extent = 0;
  for (const spec of ARCHIPELAGO_SPECS) {
    if (spec.side !== side) continue;
    const e = formationExtentAt(spec, y);
    if (e > extent) extent = e;
  }
  return side < 0 ? extent : COAST_WIDTH - extent;
}

export function coastAtScroll(scroll: number, y: number, side: CoastSide): number {
  return coastBoundary(normalizeY(y - scroll), side);
}

/** Verifica se a coordenada Y (no espaço da textura 0..COAST_PERIOD) é mar aberto naquele lado. */
export function isOpenSeaAt(y: number, side: CoastSide): boolean {
  const boundary = coastBoundary(y, side);
  return side < 0 ? boundary <= 1.0 : boundary >= COAST_WIDTH - 1.0;
}
