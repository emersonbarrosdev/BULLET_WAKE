/**
 * BULLET WAKE — Sistema de Salvamento e Persistência de Campanha.
 * Armazenamento versionado via localStorage com fallback em memória.
 */

export interface GameSettings {
  sfxVolume: number;
  musicVolume: number;
  isMuted: boolean;
  difficulty: 'normal' | 'hard';
}

export interface StageScoreRecord {
  score: number;
  pilotId: string;
  clearedAt: number;
}

export interface SaveData {
  schemaVersion: number;
  unlockedStages: number[]; // 1 a 5
  bestScores: Record<number, StageScoreRecord>;
  completedCampaignPilots: string[]; // ['nolan', 'cora', 'harlan']
  lastPilotId: string;
  settings: GameSettings;
}

export const CURRENT_SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'bullet_wake_save_data_v1';

export function defaultSaveData(): SaveData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    unlockedStages: [1],
    bestScores: {},
    completedCampaignPilots: [],
    lastPilotId: 'nolan',
    settings: {
      sfxVolume: 0.85,
      musicVolume: 0.55,
      isMuted: false,
      difficulty: 'normal',
    },
  };
}

export class SaveSystem {
  private data: SaveData = defaultSaveData();

  constructor() {
    this.load();
  }

  load(): SaveData {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.schemaVersion === CURRENT_SCHEMA_VERSION) {
            this.data = {
              ...defaultSaveData(),
              ...parsed,
              settings: {
                ...defaultSaveData().settings,
                ...(parsed.settings || {}),
              },
            };
            return this.data;
          }
        }
      }
    } catch {
      // Fallback em memória
    }
    this.data = defaultSaveData();
    return this.data;
  }

  save(): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        return true;
      }
    } catch {
      // Fallback silencioso
    }
    return false;
  }

  getData(): Readonly<SaveData> {
    return this.data;
  }

  unlockNextStage(currentStage: number): void {
    const next = currentStage + 1;
    if (next <= 5 && !this.data.unlockedStages.includes(next)) {
      this.data.unlockedStages.push(next);
      this.data.unlockedStages.sort((a, b) => a - b);
      this.save();
    }
  }

  recordStageClear(stageNumber: number, pilotId: string, score: number): void {
    const existing = this.data.bestScores[stageNumber];
    if (!existing || score > existing.score) {
      this.data.bestScores[stageNumber] = {
        score,
        pilotId,
        clearedAt: Date.now(),
      };
    }
    if (stageNumber === 5 && !this.data.completedCampaignPilots.includes(pilotId)) {
      this.data.completedCampaignPilots.push(pilotId);
    }
    this.unlockNextStage(stageNumber);
    this.save();
  }

  setLastPilot(pilotId: string): void {
    this.data.lastPilotId = pilotId;
    this.save();
  }

  updateSettings(settings: Partial<GameSettings>): void {
    this.data.settings = { ...this.data.settings, ...settings };
    this.save();
  }

  resetProgress(): void {
    this.data = defaultSaveData();
    this.save();
  }
}

export const globalSave = new SaveSystem();
