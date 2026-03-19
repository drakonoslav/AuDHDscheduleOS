import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppState, BlockTemplate, QuantitativeDailyLog, ScheduleBlock } from "@/types";

export type { QuantitativeDailyLog };

const KEYS = {
  APP_STATE: "@audhd_os_state_v1",
  MEAL_SEED: "@audhd_os_meal_seed_v1",
};

const DEFAULT_STATE: AppState = {
  blocks: [],
  snapshots: [],
  trainingLogs: [],
  quantitativeLogs: [],
  recommendations: [],
  blockTemplates: [],
  currentNutritionPhaseId: "base",
  onboardingComplete: false,
};

// ─── Seeded meal block templates ──────────────────────────────────────────────
// Added once on first load via MEAL_SEED key. Deletable by user without
// returning on reload. IDs are fixed so the seed guard works correctly.
const MEAL_SEED_TEMPLATES: BlockTemplate[] = [
  {
    id: "meal_seed_precardio",
    label: "Pre Cardio",
    blockType: "meal",
    phaseTag: "structuring",
    startTime: "05:35",
    endTime: "05:45",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: "meal_seed_postcardio",
    label: "Post Cardio",
    blockType: "meal",
    phaseTag: "recovery",
    startTime: "08:35",
    endTime: "08:45",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: "meal_seed_midmorning",
    label: "Mid Morning",
    blockType: "meal",
    phaseTag: "structuring",
    startTime: "11:35",
    endTime: "11:45",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: "meal_seed_prelift",
    label: "Pre Lift",
    blockType: "meal",
    phaseTag: "structuring",
    startTime: "14:35",
    endTime: "14:45",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: "meal_seed_postlift",
    label: "Post Lift",
    blockType: "meal",
    phaseTag: "recovery",
    startTime: "18:00",
    endTime: "18:10",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: "meal_seed_evening",
    label: "Evening",
    blockType: "meal",
    phaseTag: "structuring",
    startTime: "20:00",
    endTime: "20:10",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: "meal_seed_proteinreserve",
    label: "Protein Reserve",
    blockType: "meal",
    phaseTag: "recovery",
    startTime: "22:00",
    endTime: "22:10",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
];

export async function loadAppState(): Promise<AppState> {
  try {
    const [raw, seeded] = await Promise.all([
      AsyncStorage.getItem(KEYS.APP_STATE),
      AsyncStorage.getItem(KEYS.MEAL_SEED),
    ]);

    const base: AppState = raw
      ? { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<AppState>) }
      : { ...DEFAULT_STATE };

    // One-time seed: add meal templates if this device hasn't been seeded yet.
    // Uses a separate key so user-deleted templates don't come back.
    if (!seeded) {
      const existingIds = new Set(base.blockTemplates.map((t) => t.id));
      const toAdd = MEAL_SEED_TEMPLATES.filter((t) => !existingIds.has(t.id));
      if (toAdd.length > 0) {
        base.blockTemplates = [...toAdd, ...base.blockTemplates];
      }
      await AsyncStorage.setItem(KEYS.MEAL_SEED, "1");
    }

    return base;
  } catch {
    return { ...DEFAULT_STATE, blockTemplates: MEAL_SEED_TEMPLATES };
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.APP_STATE, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state:", e);
  }
}

// ─── Deviation calculations ───────────────────────────────────────────────────
function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function calcBlockDeviations(block: ScheduleBlock): {
  startDevMin: number;
  endDevMin: number;
  durationDevMin: number;
  adherenceScore: number;
} {
  const plannedDuration =
    timeToMinutes(block.plannedEnd) - timeToMinutes(block.plannedStart);

  if (!block.actualStart || !block.actualEnd || block.status === "skipped") {
    return {
      startDevMin: 0,
      endDevMin: 0,
      durationDevMin: block.status === "skipped" ? -plannedDuration : 0,
      adherenceScore: block.status === "skipped" ? 0 : 50,
    };
  }

  const startDev =
    timeToMinutes(block.actualStart) - timeToMinutes(block.plannedStart);
  const endDev =
    timeToMinutes(block.actualEnd) - timeToMinutes(block.plannedEnd);
  const actualDuration =
    timeToMinutes(block.actualEnd) - timeToMinutes(block.actualStart);
  const durationDev = actualDuration - plannedDuration;

  const absStartDev = Math.abs(startDev);
  const absDurationDev = Math.abs(durationDev);
  const startPenalty = Math.min(absStartDev / 60, 1) * 50;
  const durationPenalty = Math.min(absDurationDev / 60, 1) * 30;
  const statusBonus = block.status === "done" ? 20 : block.status === "partial" ? 0 : -20;
  const adherenceScore = Math.max(0, Math.min(100, 100 - startPenalty - durationPenalty + statusBonus));

  return {
    startDevMin: startDev,
    endDevMin: endDev,
    durationDevMin: durationDev,
    adherenceScore: Math.round(adherenceScore),
  };
}

// ─── Score daily state ────────────────────────────────────────────────────────
export function calcDayScores(snapshot: {
  noveltyHunger: number;
  mentalFog: number;
  physicalEnergy: number;
  structureHunger: number;
  sensoryLoadBaseline: number;
  noiseAversion: number;
  lightAversion: number;
  textureSensitivity: number;
  sleepQuality: number;
  emotionalStability: number;
  socialLoad: number;
}) {
  const adhdPull = (snapshot.noveltyHunger + snapshot.physicalEnergy + (5 - snapshot.mentalFog)) / 3;
  const autismPull = (snapshot.structureHunger + snapshot.sensoryLoadBaseline + snapshot.noiseAversion) / 3;
  const recoveryNeed = ((5 - snapshot.sleepQuality) + (5 - snapshot.emotionalStability) + snapshot.socialLoad + snapshot.sensoryLoadBaseline) / 4;

  let mode: "expansion_favoring" | "structuring_favoring" | "recovery_favoring" | "mixed" = "mixed";
  if (recoveryNeed >= 3.5) {
    mode = "recovery_favoring";
  } else if (autismPull > adhdPull + 0.5) {
    mode = "structuring_favoring";
  } else if (adhdPull > autismPull + 0.5 && recoveryNeed < 2.5) {
    mode = "expansion_favoring";
  }

  return {
    adhdPullScore: Math.round(adhdPull * 10) / 10,
    autismPullScore: Math.round(autismPull * 10) / 10,
    recoveryNeedScore: Math.round(recoveryNeed * 10) / 10,
    recommendedDayMode: mode,
  };
}
