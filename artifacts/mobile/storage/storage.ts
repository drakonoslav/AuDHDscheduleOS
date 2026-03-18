import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppState, ScheduleBlock } from "@/types";

const KEYS = {
  APP_STATE: "@audhd_os_state_v1",
};

const DEFAULT_STATE: AppState = {
  blocks: [],
  snapshots: [],
  trainingLogs: [],
  recommendations: [],
  currentNutritionPhaseId: "base",
  onboardingComplete: false,
};

export async function loadAppState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.APP_STATE);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
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
