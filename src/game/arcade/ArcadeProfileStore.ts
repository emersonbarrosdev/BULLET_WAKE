import { PILOT_IDS, getPilotContract, isValidPilotId, type PilotId } from './ArcadeContracts.ts';
import type { AchievementId } from './ArcadeAchievements.ts';
import { getAchievementDef } from './ArcadeAchievements.ts';
import type { GameDifficulty } from './PelagicDifficulty.ts';
import { normalizeGameDifficulty } from './PelagicDifficulty.ts';
import { rankWeight, type ArcadeRank } from './ArcadeRanking.ts';
import { defaultTouchSettings, sanitizeTouchSettings, type TouchControlSettings } from './TouchControls.ts';
import { readArcadeProgress, type ArcadeProgress } from './progress.ts';
import type { CampaignFlight } from '../systems/campaignFlight.ts';
import { normalizeHullSnapshot, type SurvivalRule } from './HullIntegrity.ts';
import { STORAGE_KEY as LEGACY_SAVE_KEY } from '../systems/saveSystem.ts';

export const PROFILE_SCHEMA_VERSION = 4;
export const PROFILE_STORAGE_KEY = 'bullet_wake_profile_v4';
const LEGACY_ARCADE_KEY = 'bullet_wake_arcade_v1';
const LEGACY_VISUAL_KEY = 'bullet_wake_visual';

export interface KeyBindings {
  readonly fire: string;
  readonly charge: string;
  readonly special: string;
  readonly focus: string;
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  fire: 'SPACE',
  charge: 'Z',
  special: 'X',
  focus: 'SHIFT',
};

export interface PlayerSettings {
  sfxVolume: number;
  musicVolume: number;
  isMuted: boolean;
  difficulty: GameDifficulty;
  rapidFire: boolean;
  assisted: boolean;
  visualQuality: 0 | 1 | 2;
  reducedShake: boolean;
  reducedFlash: boolean;
  hapticsEnabled: boolean;
  touch: TouchControlSettings;
  keyBindings: KeyBindings;
  survivalRule: SurvivalRule;
  mobileOrientation: 'portrait' | 'landscape';
}

export interface CompetitiveRecord {
  readonly score: number;
  readonly rank: ArcadeRank;
  readonly noMiss: boolean;
  readonly noBomb: boolean;
  readonly oneCC: boolean;
  readonly assisted: boolean;
  readonly achievedAt: number;
}

export interface HangarCatalogItem {
  readonly id: string;
  readonly kind: 'pilot' | 'skin';
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly pilotId?: PilotId;
  readonly tintHex?: number;
}

export const HANGAR_CATALOG: readonly HangarCatalogItem[] = [
  { id: 'pilot:cora', kind: 'pilot', pilotId: 'cora', name: 'Tita — MOTH', description: 'Nave ágil com Ondas Violetas e Salto Fantasma.', cost: 500 },
  { id: 'pilot:lyra', kind: 'pilot', pilotId: 'lyra', name: 'Leona — KESTREL', description: 'Precisão tática com Lança Esmeralda e Coroa Orbital.', cost: 750 },
  { id: 'pilot:harlan', kind: 'pilot', pilotId: 'harlan', name: 'Osvald — KNUCKLE', description: 'Fogo pesado Fluxo Âmbar e Ruptura Nova radial.', cost: 750 },
  { id: 'pilot:bento', kind: 'pilot', pilotId: 'bento', name: 'Hien — PEREGRINE', description: 'Chuva Celeste diagonal e esquadrilha Chuva de Cometas.', cost: 1200 },
  { id: 'skin:classic', kind: 'skin', name: 'Pintura Padrão', description: 'Acabamento original de fábrica da frota.', cost: 0, tintHex: 0xffffff },
  { id: 'skin:cobalt_ace', kind: 'skin', name: 'Ás Cobalto', description: 'Fuselagem azul-cobalto de elite (100% cosmético).', cost: 250, tintHex: 0x8ad8ff },
  { id: 'skin:solar_gold', kind: 'skin', name: 'Vanguarda Dourada', description: 'Revestimento dourado comemorativo (100% cosmético).', cost: 400, tintHex: 0xffe484 },
  { id: 'skin:crimson_night', kind: 'skin', name: 'Rubro Noturno', description: 'Acabamento escarlate de alta visibilidade (100% cosmético).', cost: 400, tintHex: 0xffa6b8 },
  { id: 'skin:emerald_tide', kind: 'skin', name: 'Maré Esmeralda', description: 'Pintura oceânica luminosa (100% cosmético).', cost: 350, tintHex: 0x9cffd6 },
];

export interface LocalWallet {
  credits: number;
  gems: number;
  totalEarned: number;
  totalSpent: number;
  claimedRunIds: string[];
}

export const PRIVACY_POLICY_VERSION = '1.0';

export interface AccountProfileState {
  mode: 'guest' | 'linked';
  displayName: string;
  syncState: 'local-only' | 'pending' | 'synced';
  lastSyncedAt: number | null;
  welcomePromptSeen?: boolean;
  privacyAccepted?: boolean;
  privacyAcceptedAt?: number | null;
  privacyVersion?: string;
}

export interface PilotServiceHistory {
  sorties: number;
  clears: number;
  kills: number;
  bestScore: number;
}

export interface PlayerProfileV4 {
  schemaVersion: number;
  selectedPilotId: PilotId;
  settings: PlayerSettings;
  clearedStages: number[];
  flights: Record<string, CampaignFlight>;
  /** Key format: `m{missionId}:{pilotId}:{difficulty}:{pure|assist}` */
  records: Record<string, CompetitiveRecord>;
  achievements: Record<string, number>;
  pilotStats: Partial<Record<PilotId, PilotServiceHistory>>;
  unlocks: {
    pilots: PilotId[];
    skins: string[];
    equippedSkins: Partial<Record<PilotId, string>>;
    practiceUnlocked: boolean;
  };
  wallet: LocalWallet;
  account: AccountProfileState;
}

export interface ProfileStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Optional future cloud sync contract; local offline profile never depends on external network. */
export interface CloudSyncProvider {
  readonly providerId: string;
  readonly configured: boolean;
  pullProfile(userId: string): Promise<PlayerProfileV4 | null>;
  pushProfile(userId: string, profile: PlayerProfileV4): Promise<boolean>;
}

export function createBrowserStorageAdapter(): ProfileStorageAdapter {
  const mem = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      } catch {
        /* fallback */
      }
      return mem.has(key) ? mem.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      mem.set(key, value);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch {
        /* fallback */
      }
    },
    removeItem(key: string): void {
      mem.delete(key);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch {
        /* fallback */
      }
    },
  };
}

export function recordKey(
  missionId: number,
  pilotId: PilotId,
  difficulty: GameDifficulty,
  competitiveEligible: boolean,
  survivalRule: SurvivalRule = 'classic-v1',
): string {
  return `m${missionId}:${pilotId}:${difficulty}:${competitiveEligible ? 'pure' : 'assist'}${survivalRule === 'hull-v1' ? ':hull-v1' : ''}`;
}

export function defaultProfileV4(): PlayerProfileV4 {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    selectedPilotId: 'nolan',
    settings: {
      sfxVolume: 0.85,
      musicVolume: 0.18,
      isMuted: false,
      difficulty: 'normal',
      rapidFire: false,
      assisted: false,
      visualQuality: 2,
      reducedShake: false,
      reducedFlash: false,
      hapticsEnabled: true,
      touch: defaultTouchSettings(),
      keyBindings: { ...DEFAULT_KEY_BINDINGS },
      survivalRule: 'hull-v1',
      mobileOrientation: 'portrait',
    },
    clearedStages: [],
    flights: {},
    records: {},
    achievements: {},
    pilotStats: {},
    unlocks: {
      pilots: ['nolan'],
      skins: ['skin:classic'],
      equippedSkins: { nolan: 'skin:classic' },
      practiceUnlocked: true,
    },
    wallet: {
      credits: 0,
      gems: 0,
      totalEarned: 0,
      totalSpent: 0,
      claimedRunIds: [],
    },
    account: {
      mode: 'guest',
      displayName: 'Piloto Convidado',
      syncState: 'local-only',
      lastSyncedAt: null,
      welcomePromptSeen: false,
      privacyAccepted: false,
      privacyAcceptedAt: null,
      privacyVersion: PRIVACY_POLICY_VERSION,
    },
  };
}

function sanitizeKeyBindings(raw: Partial<KeyBindings> | undefined): KeyBindings {
  const clean = (v: unknown, fallback: string): string => {
    if (typeof v !== 'string') return fallback;
    const up = v.trim().toUpperCase();
    return /^[A-Z0-9]{1,8}$/.test(up) ? up : fallback;
  };
  return {
    fire: clean(raw?.fire, DEFAULT_KEY_BINDINGS.fire),
    charge: clean(raw?.charge, DEFAULT_KEY_BINDINGS.charge),
    special: clean(raw?.special, DEFAULT_KEY_BINDINGS.special),
    focus: clean(raw?.focus, DEFAULT_KEY_BINDINGS.focus),
  };
}

export class ArcadeProfileStore {
  private readonly storage: ProfileStorageAdapter;
  private profile: PlayerProfileV4 = defaultProfileV4();

  constructor(storage: ProfileStorageAdapter = createBrowserStorageAdapter()) {
    this.storage = storage;
    this.load();
  }

  load(): PlayerProfileV4 {
    const rawV4 = this.storage.getItem(PROFILE_STORAGE_KEY);
    if (rawV4) {
      try {
        const parsed = JSON.parse(rawV4);
        if (parsed && typeof parsed === 'object' && parsed.schemaVersion === PROFILE_SCHEMA_VERSION) {
          this.profile = this.sanitizeProfile(parsed);
          return this.profile;
        }
      } catch {
        /* fall back cleanly to migration or defaults */
      }
    }
    this.profile = this.migrateFromLegacyKeys();
    this.save();
    return this.profile;
  }

  private sanitizeProfile(raw: Partial<PlayerProfileV4>): PlayerProfileV4 {
    const base = defaultProfileV4();
    const rawSettings = raw.settings ?? base.settings;
    const vis = Number(rawSettings.visualQuality);
    const visualQuality: 0 | 1 | 2 = vis === 0 ? 0 : vis === 1 ? 1 : 2;
    const pilots: PilotId[] = Array.isArray(raw.unlocks?.pilots)
      ? [...new Set<PilotId>(['nolan' as PilotId, ...raw.unlocks.pilots.filter(isValidPilotId)])]
      : ['nolan'];
    const skins = Array.isArray(raw.unlocks?.skins)
      ? [...new Set<string>(['skin:classic', ...raw.unlocks.skins.filter((s): s is string => typeof s === 'string')])]
      : ['skin:classic'];
    const selectedPilotId: PilotId = isValidPilotId(raw.selectedPilotId) && pilots.includes(raw.selectedPilotId)
      ? raw.selectedPilotId
      : 'nolan';
    return {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      selectedPilotId,
      settings: {
        sfxVolume: clampNum(rawSettings.sfxVolume, 0, 1, base.settings.sfxVolume),
        musicVolume: clampNum(rawSettings.musicVolume, 0, 1, base.settings.musicVolume),
        isMuted: Boolean(rawSettings.isMuted),
        difficulty: normalizeGameDifficulty(rawSettings.difficulty),
        rapidFire: Boolean(rawSettings.rapidFire),
        assisted: Boolean(rawSettings.assisted),
        visualQuality,
        reducedShake: Boolean(rawSettings.reducedShake),
        reducedFlash: Boolean(rawSettings.reducedFlash),
        hapticsEnabled: rawSettings.hapticsEnabled !== false,
        touch: sanitizeTouchSettings(rawSettings.touch),
        keyBindings: sanitizeKeyBindings(rawSettings.keyBindings),
        survivalRule: rawSettings.survivalRule === 'classic-v1' ? 'classic-v1' : 'hull-v1',
        mobileOrientation: rawSettings.mobileOrientation === 'landscape' ? 'landscape' : 'portrait',
      },
      clearedStages: Array.isArray(raw.clearedStages)
        ? [...new Set<number>(raw.clearedStages.filter((n): n is number => n === 1 || n === 2))].sort((a, b) => a - b)
        : [],
      flights: raw.flights && typeof raw.flights === 'object' ? { ...raw.flights } : {},
      records: raw.records && typeof raw.records === 'object' ? { ...raw.records } : {},
      achievements: raw.achievements && typeof raw.achievements === 'object' ? { ...raw.achievements } : {},
      pilotStats: sanitizePilotStats(raw.pilotStats),
      unlocks: {
        pilots,
        skins,
        equippedSkins: raw.unlocks?.equippedSkins && typeof raw.unlocks.equippedSkins === 'object'
          ? { ...raw.unlocks.equippedSkins }
          : { nolan: 'skin:classic' },
        practiceUnlocked: raw.unlocks?.practiceUnlocked ?? true,
      },
      wallet: {
        credits: Math.max(0, Math.floor(Number(raw.wallet?.credits) || 0)),
        gems: Math.max(0, Math.floor(Number(raw.wallet?.gems) || 0)),
        totalEarned: Math.max(0, Math.floor(Number(raw.wallet?.totalEarned) || 0)),
        totalSpent: Math.max(0, Math.floor(Number(raw.wallet?.totalSpent) || 0)),
        claimedRunIds: Array.isArray(raw.wallet?.claimedRunIds) ? raw.wallet.claimedRunIds.slice(-32) : [],
      },
      account: {
        mode: raw.account?.mode === 'linked' ? 'linked' : 'guest',
        displayName: typeof raw.account?.displayName === 'string' && raw.account.displayName.trim()
          ? raw.account.displayName.trim().slice(0, 24)
          : base.account.displayName,
        syncState: raw.account?.syncState === 'synced' || raw.account?.syncState === 'pending' ? raw.account.syncState : 'local-only',
        lastSyncedAt: typeof raw.account?.lastSyncedAt === 'number' ? raw.account.lastSyncedAt : null,
        welcomePromptSeen: Boolean(raw.account?.welcomePromptSeen),
        privacyAccepted: Boolean(raw.account?.privacyAccepted),
        privacyAcceptedAt: typeof raw.account?.privacyAcceptedAt === 'number' ? raw.account.privacyAcceptedAt : null,
        privacyVersion: typeof raw.account?.privacyVersion === 'string' && raw.account.privacyVersion ? raw.account.privacyVersion : PRIVACY_POLICY_VERSION,
      },
    };
  }

  /** Safely imports legacy `bullet_wake_save_data_v1`, `bullet_wake_arcade_v1`, and `bullet_wake_visual`. */
  private migrateFromLegacyKeys(): PlayerProfileV4 {
    const next = defaultProfileV4();

    // 1. Legacy SaveSystem (v1/v2/v3)
    const rawSave = this.storage.getItem(LEGACY_SAVE_KEY);
    if (rawSave) {
      try {
        const parsed = JSON.parse(rawSave);
        if (parsed && typeof parsed === 'object') {
          if (parsed.settings) {
            next.settings.sfxVolume = clampNum(parsed.settings.sfxVolume, 0, 1, next.settings.sfxVolume);
            next.settings.musicVolume = clampNum(parsed.settings.musicVolume, 0, 1, next.settings.musicVolume);
            next.settings.isMuted = Boolean(parsed.settings.isMuted);
            next.settings.difficulty = normalizeGameDifficulty(parsed.settings.difficulty);
            next.settings.rapidFire = Boolean(parsed.settings.rapidFire);
            next.settings.assisted = Boolean(parsed.settings.assisted);
            next.settings.touch = sanitizeTouchSettings(parsed.settings.touch);
          }
          if (parsed.bestScores && typeof parsed.bestScores === 'object') {
            for (const [stageStr, rec] of Object.entries(parsed.bestScores as Record<string, { score?: number; pilotId?: string; clearedAt?: number }>)) {
              const stageId = Number(stageStr);
              if ((stageId === 1 || stageId === 2) && rec && Number.isFinite(rec.score) && (rec.score ?? 0) > 0) {
                const pid: PilotId = isValidPilotId(rec.pilotId) ? rec.pilotId : 'nolan';
                const k = recordKey(stageId, pid, 'normal', true);
                next.records[k] = {
                  score: Math.round(rec.score!),
                  rank: 'A',
                  noMiss: false,
                  noBomb: false,
                  oneCC: true,
                  assisted: false,
                  achievedAt: rec.clearedAt ?? Date.now(),
                };
                if (!next.clearedStages.includes(stageId)) next.clearedStages.push(stageId);
              }
            }
          }
          if (parsed.secretPilotUnlocked && !next.unlocks.pilots.includes('bento')) {
            next.unlocks.pilots.push('bento');
          }
        }
      } catch {
        /* ignore corrupted legacy save */
      }
    }

    // 2. Legacy ArcadeProgress (`bullet_wake_arcade_v1`)
    const legacyArcade: ArcadeProgress = readArcadeProgress(this.storage.getItem(LEGACY_ARCADE_KEY));
    for (const s of legacyArcade.cleared) {
      if ((s === 1 || s === 2) && !next.clearedStages.includes(s)) next.clearedStages.push(s);
    }
    for (const [stageStr, flight] of Object.entries(legacyArcade.flights)) {
      next.flights[`${flight.pilotId}:${stageStr}`] = flight;
    }

    // 3. Legacy visual quality (`bullet_wake_visual`)
    const rawVis = this.storage.getItem(LEGACY_VISUAL_KEY);
    if (rawVis !== null) {
      const n = Number(rawVis);
      if (n === 0 || n === 1 || n === 2) next.settings.visualQuality = n;
    }

    // Only Bayek starts unlocked; additional pilots are unlocked via credits.
    next.clearedStages.sort((a, b) => a - b);
    return next;
  }

  save(): boolean {
    try {
      this.storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
      return true;
    } catch {
      return false;
    }
  }

  getProfile(): Readonly<PlayerProfileV4> {
    return this.profile;
  }

  getSettings(): Readonly<PlayerSettings> {
    return this.profile.settings;
  }

  updateSettings(patch: Partial<PlayerSettings>): void {
    this.profile.settings = {
      ...this.profile.settings,
      ...patch,
      touch: patch.touch ? sanitizeTouchSettings(patch.touch) : this.profile.settings.touch,
      keyBindings: patch.keyBindings ? sanitizeKeyBindings(patch.keyBindings) : this.profile.settings.keyBindings,
      survivalRule: patch.survivalRule === undefined ? this.profile.settings.survivalRule : patch.survivalRule === 'classic-v1' ? 'classic-v1' : 'hull-v1',
    };
    this.save();
  }

  isPilotUnlocked(pilotId: PilotId): boolean {
    return this.profile.unlocks.pilots.includes(pilotId) || getPilotContract(pilotId).defaultUnlocked;
  }

  selectPilot(pilotId: PilotId): boolean {
    if (!this.isPilotUnlocked(pilotId)) return false;
    this.profile.selectedPilotId = pilotId;
    this.save();
    return true;
  }

  unlockPilot(pilotId: PilotId): boolean {
    if (this.profile.unlocks.pilots.includes(pilotId)) return false;
    this.profile.unlocks.pilots.push(pilotId);
    this.save();
    return true;
  }

  recordRunResult(params: {
    runId: string;
    missionId: number;
    pilotId: PilotId;
    difficulty: GameDifficulty;
    score: number;
    rank: ArcadeRank;
    victory: boolean;
    competitiveEligible: boolean;
    survivalRule?: SurvivalRule;
    assisted: boolean;
    noMiss: boolean;
    noBomb: boolean;
    oneCC: boolean;
    creditsEarned: number;
    kills?: number;
    achievements: readonly AchievementId[];
    flight?: CampaignFlight;
  }): { newRecord: boolean; newlyUnlockedAchievements: AchievementId[]; newlyUnlockedPilots: PilotId[]; creditsAdded: number; gemsAdded: number } {
    let newRecord = false;
    const newlyUnlockedAchievements: AchievementId[] = [];
    const newlyUnlockedPilots: PilotId[] = [];
    let firstClearBonusGems = 0;

    if (params.victory && (params.missionId === 1 || params.missionId === 2)) {
      if (!this.profile.clearedStages.includes(params.missionId)) {
        this.profile.clearedStages.push(params.missionId);
        this.profile.clearedStages.sort((a, b) => a - b);
        firstClearBonusGems = 15;
      } else {
        firstClearBonusGems = 5;
      }
      if (params.flight) {
        const flight = structuredClone(params.flight);
        const survival = normalizeHullSnapshot(flight.survival);
        if (survival) flight.survival = survival;
        else delete flight.survival;
        this.profile.flights[`${params.pilotId}:${params.missionId}`] = flight;
      }
    }

    const key = recordKey(params.missionId, params.pilotId, params.difficulty, params.competitiveEligible, params.survivalRule);
    const prev = this.profile.records[key];
    if (!prev || params.score > prev.score || rankWeight(params.rank) > rankWeight(prev.rank)) {
      newRecord = !prev || params.score > prev.score;
      this.profile.records[key] = {
        score: Math.max(prev?.score ?? 0, Math.round(params.score)),
        rank: prev && rankWeight(prev.rank) > rankWeight(params.rank) ? prev.rank : params.rank,
        noMiss: Boolean(prev?.noMiss || params.noMiss),
        noBomb: Boolean(prev?.noBomb || params.noBomb),
        oneCC: Boolean(prev?.oneCC || params.oneCC),
        assisted: params.assisted,
        achievedAt: Date.now(),
      };
    }

    let achievementBonusCredits = 0;
    for (const achId of params.achievements) {
      if (!this.profile.achievements[achId]) {
        this.profile.achievements[achId] = Date.now();
        newlyUnlockedAchievements.push(achId);
        achievementBonusCredits += getAchievementDef(achId)?.rewardCredits ?? 0;
      }
    }

    let creditsAdded = 0;
    let gemsAdded = 0;
    if (!this.profile.wallet.claimedRunIds.includes(params.runId)) {
      this.profile.wallet.claimedRunIds.push(params.runId);
      if (this.profile.wallet.claimedRunIds.length > 32) {
        this.profile.wallet.claimedRunIds.shift();
      }
      creditsAdded = Math.max(0, Math.round(params.creditsEarned + achievementBonusCredits));
      const rankGems = params.victory ? (params.rank === 'S+' ? 10 : params.rank === 'S' ? 5 : params.rank === 'A' ? 2 : 0) : 0;
      const achGems = newlyUnlockedAchievements.length * 5;
      gemsAdded = Math.max(0, firstClearBonusGems + rankGems + achGems);
      this.profile.wallet.credits += creditsAdded;
      this.profile.wallet.gems = (this.profile.wallet.gems ?? 0) + gemsAdded;
      this.profile.wallet.totalEarned += creditsAdded;

      const prevStats = this.profile.pilotStats[params.pilotId] ?? { sorties: 0, clears: 0, kills: 0, bestScore: 0 };
      this.profile.pilotStats[params.pilotId] = {
        sorties: prevStats.sorties + 1,
        clears: prevStats.clears + (params.victory ? 1 : 0),
        kills: prevStats.kills + Math.max(0, Math.round(params.kills ?? 0)),
        bestScore: Math.max(prevStats.bestScore, Math.round(params.score)),
      };
    }

    this.save();
    return { newRecord, newlyUnlockedAchievements, newlyUnlockedPilots, creditsAdded, gemsAdded };
  }

  bestScoreForMission(missionId?: number, pilotId?: PilotId, survivalRule: SurvivalRule = 'classic-v1'): number {
    let best = 0;
    for (const [k, rec] of Object.entries(this.profile.records)) {
      if (k.endsWith(':hull-v1') !== (survivalRule === 'hull-v1')) continue;
      if (missionId !== undefined && !k.startsWith(`m${missionId}:`)) continue;
      if (pilotId !== undefined && !k.includes(`:${pilotId}:`)) continue;
      if (rec.score > best) best = rec.score;
    }
    return best;
  }

  bestRankForMission(missionId: number, pilotId?: PilotId, survivalRule: SurvivalRule = 'classic-v1'): ArcadeRank | null {
    let best: ArcadeRank | null = null;
    for (const [k, rec] of Object.entries(this.profile.records)) {
      if (k.endsWith(':hull-v1') !== (survivalRule === 'hull-v1')) continue;
      if (!k.startsWith(`m${missionId}:`)) continue;
      if (pilotId !== undefined && !k.includes(`:${pilotId}:`)) continue;
      if (!best || rankWeight(rec.rank) > rankWeight(best)) best = rec.rank;
    }
    return best;
  }

  buyHangarItem(itemId: string): { ok: boolean; reason: string } {
    const item = HANGAR_CATALOG.find((i) => i.id === itemId);
    if (!item) return { ok: false, reason: 'Item não encontrado.' };

    if (item.kind === 'pilot' && item.pilotId) {
      if (this.isPilotUnlocked(item.pilotId)) return { ok: false, reason: 'Piloto já desbloqueado.' };
      if (this.profile.wallet.credits < item.cost) return { ok: false, reason: 'Créditos insuficientes.' };
      this.profile.wallet.credits -= item.cost;
      this.profile.wallet.totalSpent += item.cost;
      this.profile.unlocks.pilots.push(item.pilotId);
      this.save();
      return { ok: true, reason: `${item.name} desbloqueado!` };
    }

    if (this.profile.unlocks.skins.includes(item.id)) return { ok: false, reason: 'Pintura já adquirida.' };
    if (this.profile.wallet.credits < item.cost) return { ok: false, reason: 'Créditos insuficientes.' };
    this.profile.wallet.credits -= item.cost;
    this.profile.wallet.totalSpent += item.cost;
    this.profile.unlocks.skins.push(item.id);
    this.profile.unlocks.equippedSkins[this.profile.selectedPilotId] = item.id;
    this.save();
    return { ok: true, reason: `${item.name} equipada!` };
  }

  equipSkin(pilotId: PilotId, skinId: string): boolean {
    if (!this.profile.unlocks.skins.includes(skinId)) return false;
    this.profile.unlocks.equippedSkins[pilotId] = skinId;
    this.save();
    return true;
  }

  getEquippedSkinTint(pilotId: PilotId): number {
    const skinId = this.profile.unlocks.equippedSkins[pilotId] ?? 'skin:classic';
    const item = HANGAR_CATALOG.find((i) => i.id === skinId);
    return item?.tintHex ?? 0xffffff;
  }

  setGuestDisplayName(name: string): void {
    const clean = name.trim().slice(0, 24);
    if (!clean) return;
    this.profile.account.displayName = clean;
    this.save();
  }

  markWelcomeSeen(): void {
    this.profile.account.welcomePromptSeen = true;
    this.profile.account.privacyAccepted = true;
    this.profile.account.privacyAcceptedAt = this.profile.account.privacyAcceptedAt ?? Date.now();
    this.profile.account.privacyVersion = PRIVACY_POLICY_VERSION;
    this.save();
  }

  acceptPrivacy(version = PRIVACY_POLICY_VERSION): void {
    this.profile.account.privacyAccepted = true;
    this.profile.account.privacyAcceptedAt = Date.now();
    this.profile.account.privacyVersion = version;
    this.save();
  }

  signInLocal(displayName?: string): void {
    const clean = (displayName ?? '').trim().slice(0, 24);
    this.profile.account = {
      mode: 'linked',
      displayName: clean || (this.profile.account.mode === 'linked' && this.profile.account.displayName ? this.profile.account.displayName : 'Comandante'),
      syncState: 'local-only',
      lastSyncedAt: null,
      welcomePromptSeen: true,
      privacyAccepted: true,
      privacyAcceptedAt: this.profile.account.privacyAcceptedAt ?? Date.now(),
      privacyVersion: PRIVACY_POLICY_VERSION,
    };
    this.save();
  }

  signOutLocal(): void {
    this.profile.account = {
      mode: 'guest',
      displayName: 'Piloto Convidado',
      syncState: 'local-only',
      lastSyncedAt: null,
      welcomePromptSeen: true,
      privacyAccepted: Boolean(this.profile.account.privacyAccepted),
      privacyAcceptedAt: this.profile.account.privacyAcceptedAt ?? null,
      privacyVersion: this.profile.account.privacyVersion ?? PRIVACY_POLICY_VERSION,
    };
    this.save();
  }

  getPilotHistory(pilotId: PilotId): PilotServiceHistory {
    const h = this.profile.pilotStats[pilotId];
    return h ? { ...h } : { sorties: 0, clears: 0, kills: 0, bestScore: 0 };
  }

  resetAll(): void {
    this.profile = defaultProfileV4();
    this.save();
  }

  /** Helper returning every pilot ID with unlock status for UI grids. */
  pilotRosterStatus(): Array<{ id: PilotId; unlocked: boolean }> {
    return PILOT_IDS.map((id) => ({ id, unlocked: this.isPilotUnlocked(id) }));
  }
}

function sanitizePilotStats(raw: unknown): Partial<Record<PilotId, PilotServiceHistory>> {
  const out: Partial<Record<PilotId, PilotServiceHistory>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, val] of Object.entries(raw as Record<string, Partial<PilotServiceHistory>>)) {
    if (!isValidPilotId(key) || !val || typeof val !== 'object') continue;
    out[key] = {
      sorties: Math.max(0, Math.floor(Number(val.sorties) || 0)),
      clears: Math.max(0, Math.floor(Number(val.clears) || 0)),
      kills: Math.max(0, Math.floor(Number(val.kills) || 0)),
      bestScore: Math.max(0, Math.floor(Number(val.bestScore) || 0)),
    };
  }
  return out;
}

function clampNum(raw: unknown, lo: number, hi: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

export const globalProfileStore = new ArcadeProfileStore();
