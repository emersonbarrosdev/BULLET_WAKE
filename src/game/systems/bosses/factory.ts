import type { StageBoss } from './types.ts';
import { BossTalassarca } from './bossTalassarca.ts';
import { BossSerpent } from './bossSerpent.ts';
import { BossFortress } from './bossFortress.ts';
import { BossInterceptor } from './bossInterceptor.ts';
import { BossMeshCore } from './bossMeshCore.ts';

export function createStageBoss(stageNumber: number): StageBoss {
  switch (stageNumber) {
    case 2:
      return new BossSerpent();
    case 3:
      return new BossFortress();
    case 4:
      return new BossInterceptor();
    case 5:
      return new BossMeshCore();
    case 1:
    default:
      return new BossTalassarca();
  }
}

