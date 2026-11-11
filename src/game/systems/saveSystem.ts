import { CAMPAIGN_MAIN_STAGES, SECRET_PILOT_CODE, SECRET_STAGE_IDS } from '../data/pilotStories.ts';
/**
 * BULLET WAKE — Sistema de Salvamento e Persistência de Campanha.
 * Armazenamento versionado via localStorage com fallback em memória.
 */

export interface GameSettings {
  sfxVolume: number;
  musicVolume: number;
  isMuted: boolean;
  difficulty: 'normal' | 'hard' | 'arcade';
  rapidFire: boolean;
}

export interface StageScoreRecord {
  score: number;
  pilotId: string;
  clearedAt: number;
}

export interface PilotProgress { clearedStages:number[]; bestScores:Record<number,number>; endingSeen:boolean; }
export interface SaveData {
  pilotProgress:Record<string,PilotProgress>;
  secretPilotUnlocked:boolean;
  secretStagesUnlocked:boolean;
  schemaVersion: number;
  unlockedStages: number[]; // Main chapters 1–15; secrets 16–17 remain unproduced.
  bestScores: Record<number, StageScoreRecord>;
  completedCampaignPilots: string[]; // ['nolan', 'cora', 'harlan']
  lastPilotId: string;
  settings: GameSettings;
}

export const CURRENT_SCHEMA_VERSION = 2;
export const STORAGE_KEY = 'bullet_wake_save_data_v1';

export function defaultSaveData(): SaveData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    pilotProgress:{},secretPilotUnlocked:false,secretStagesUnlocked:false,
    unlockedStages: [1],
    bestScores: {},
    completedCampaignPilots: [],
    lastPilotId: 'nolan',
    settings: {
      sfxVolume: 0.85,
      musicVolume: 0.55,
      isMuted: false,
      difficulty: 'normal',
      rapidFire: false,
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
          if (parsed && [1,CURRENT_SCHEMA_VERSION].includes(parsed.schemaVersion)) {
            this.data = {
              ...defaultSaveData(),
              ...parsed,
              schemaVersion:CURRENT_SCHEMA_VERSION,
              pilotProgress:parsed.pilotProgress??{},
              completedCampaignPilots:parsed.schemaVersion===1?[]:(parsed.completedCampaignPilots??[]),
              settings: {
                ...defaultSaveData().settings,
                ...(parsed.settings || {}),
              },
            };
            if(parsed.schemaVersion===1){
              for(const [stage,record] of Object.entries(this.data.bestScores)){
                if(!record||!Number.isFinite(record.score)||!record.pilotId)continue;
                const progress=this.data.pilotProgress[record.pilotId]??={clearedStages:[],bestScores:{},endingSeen:false};
                const n=Number(stage);if(n<1||n>15)continue;
                progress.clearedStages.push(n);progress.bestScores[n]=record.score;
              }
            }
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

  getSaveData(): Readonly<SaveData> {
    return this.data;
  }

  getSettings(): Readonly<GameSettings> {
    return this.data.settings;
  }

  unlockNextStage(currentStage: number): void {
    const next = currentStage + 1;
    if (next <= CAMPAIGN_MAIN_STAGES && !this.data.unlockedStages.includes(next)) {
      this.data.unlockedStages.push(next);
      this.data.unlockedStages.sort((a, b) => a - b);
      this.save();
    }
  }

  recordStageClear(stageNumber: number, pilotId: string, score: number): void {
    if(!Number.isInteger(stageNumber)||stageNumber<1||stageNumber>17||!Number.isFinite(score))return;
    const progress=this.data.pilotProgress[pilotId]??={clearedStages:[],bestScores:{},endingSeen:false};
    if(!progress.clearedStages.includes(stageNumber))progress.clearedStages.push(stageNumber);
    progress.clearedStages.sort((a,b)=>a-b);
    progress.bestScores[stageNumber]=Math.max(progress.bestScores[stageNumber]??0,Math.max(0,score));
    const fullClear=Array.from({length:CAMPAIGN_MAIN_STAGES},(_,i)=>i+1).every(n=>progress.clearedStages.includes(n));
    if(fullClear){this.data.secretStagesUnlocked=true;for(const n of SECRET_STAGE_IDS)if(!this.data.unlockedStages.includes(n))this.data.unlockedStages.push(n);}
    const existing = this.data.bestScores[stageNumber];
    if (!existing || score > existing.score) {
      this.data.bestScores[stageNumber] = {
        score,
        pilotId,
        clearedAt: Date.now(),
      };
    }
    if (fullClear && !this.data.completedCampaignPilots.includes(pilotId)) {
      this.data.completedCampaignPilots.push(pilotId);
    }
    this.unlockNextStage(stageNumber);
    this.save();
  }

  getPilotProgress(pilotId:string):Readonly<PilotProgress> {
    return this.data.pilotProgress[pilotId]??{clearedStages:[],bestScores:{},endingSeen:false};
  }
  markEndingSeen(pilotId:string):void {
    const progress=this.data.pilotProgress[pilotId];
    if(progress&&this.data.completedCampaignPilots.includes(pilotId)){progress.endingSeen=true;this.save();}
  }
  enterSecretCode(code:string):boolean {
    if(!this.data.completedCampaignPilots.length||code.toUpperCase()!==SECRET_PILOT_CODE)return false;
    this.data.secretPilotUnlocked=true;this.save();return true;
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
export const saveSystem = globalSave;
