import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppState, BlockTemplate, QuantitativeDailyLog, ScheduleBlock } from "@/types";

export type { QuantitativeDailyLog };

const KEYS = {
  APP_STATE: "@audhd_os_state_v1",
  MEAL_SEED: "@audhd_os_meal_seed_v1",
  DEDUP_MIGRATION: "@audhd_os_dedup_v1",
  SCHEDULE_SEED_MIGRATION: "@audhd_os_schedule_seed_v2",
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
  setupWizardComplete: false,
};

// ─── Ground-truth schedule seed ───────────────────────────────────────────────
// Full verified schedule: all 16 blocks across all days.
// Used by SeedGateway "Implant Schedule Seed" and the v2 migration.
// IDs use the "seed_" prefix so completeSetupWizard / completeScheduleSeed
// strip them correctly on a re-seed.
export const SCHEDULE_SEED_TEMPLATES: BlockTemplate[] = [
  { id: "seed_wake",          label: "Wake",           blockType: "wake",     phaseTag: "structuring", startTime: "05:25", endTime: "05:30", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_precardio",     label: "Pre Cardio",     blockType: "meal",     phaseTag: "structuring", startTime: "05:40", endTime: "05:50", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_cardio",        label: "Cardio",         blockType: "cardio",   phaseTag: "expansion",   startTime: "05:50", endTime: "06:30", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_shower_am",     label: "Shower",         blockType: "hygiene",  phaseTag: "structuring", startTime: "06:30", endTime: "06:35", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_postcardio",    label: "Post Cardio",    blockType: "meal",     phaseTag: "recovery",    startTime: "06:35", endTime: "06:45", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_commute_am",    label: "Commute AM",     blockType: "commute",  phaseTag: "structuring", startTime: "06:40", endTime: "07:00", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_work",          label: "Work",           blockType: "work",     phaseTag: "structuring", startTime: "07:00", endTime: "16:40", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_midmorning",    label: "Mid Morning",    blockType: "meal",     phaseTag: "structuring", startTime: "09:30", endTime: "09:40", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_proteinreserve",label: "Protein Reserve",blockType: "meal",     phaseTag: "recovery",    startTime: "12:30", endTime: "12:40", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_prelift",       label: "Pre Lift",       blockType: "meal",     phaseTag: "structuring", startTime: "15:45", endTime: "15:55", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_commute_pm",    label: "Commute PM",     blockType: "commute",  phaseTag: "structuring", startTime: "16:40", endTime: "17:00", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_lift",          label: "Lift",           blockType: "lift",     phaseTag: "expansion",   startTime: "17:00", endTime: "18:15", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_postlift",      label: "Post Lift",      blockType: "meal",     phaseTag: "recovery",    startTime: "18:15", endTime: "18:25", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_shower_pm",     label: "Shower",         blockType: "hygiene",  phaseTag: "structuring", startTime: "19:15", endTime: "19:30", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_evening",       label: "Evening",        blockType: "meal",     phaseTag: "structuring", startTime: "19:30", endTime: "19:40", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "seed_bed",           label: "Bed",            blockType: "bedtime",  phaseTag: "recovery",    startTime: "21:25", endTime: "21:30", daysOfWeek: [0,1,2,3,4,5,6] },
];

// ─── Legacy meal-only seed (fresh install fallback) ───────────────────────────
// Only seeded when the full schedule seed hasn't been applied yet.
const MEAL_SEED_TEMPLATES: BlockTemplate[] = [
  { id: "meal_seed_precardio",     label: "Pre Cardio",     blockType: "meal", phaseTag: "structuring", startTime: "05:40", endTime: "05:50", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "meal_seed_postcardio",    label: "Post Cardio",    blockType: "meal", phaseTag: "recovery",    startTime: "06:35", endTime: "06:45", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "meal_seed_midmorning",    label: "Mid Morning",    blockType: "meal", phaseTag: "structuring", startTime: "09:30", endTime: "09:40", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "meal_seed_proteinreserve",label: "Protein Reserve",blockType: "meal", phaseTag: "recovery",    startTime: "12:30", endTime: "12:40", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "meal_seed_prelift",       label: "Pre Lift",       blockType: "meal", phaseTag: "structuring", startTime: "15:45", endTime: "15:55", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "meal_seed_postlift",      label: "Post Lift",      blockType: "meal", phaseTag: "recovery",    startTime: "18:15", endTime: "18:25", daysOfWeek: [0,1,2,3,4,5,6] },
  { id: "meal_seed_evening",       label: "Evening",        blockType: "meal", phaseTag: "structuring", startTime: "19:30", endTime: "19:40", daysOfWeek: [0,1,2,3,4,5,6] },
];

export async function loadAppState(): Promise<AppState> {
  try {
    const [raw, seeded, deduped, scheduleSeeded] = await Promise.all([
      AsyncStorage.getItem(KEYS.APP_STATE),
      AsyncStorage.getItem(KEYS.MEAL_SEED),
      AsyncStorage.getItem(KEYS.DEDUP_MIGRATION),
      AsyncStorage.getItem(KEYS.SCHEDULE_SEED_MIGRATION),
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

    // One-time migration: remove seed meal templates that duplicated wizard
    // templates when the setup wizard was completed. Any device that ran the
    // wizard before this fix landed will have both meal_seed_* and wizard_*
    // templates — this clears the stale seed entries exactly once.
    if (!deduped) {
      const before = base.blockTemplates.length;
      base.blockTemplates = base.blockTemplates.filter(
        (t) => !t.id.startsWith("meal_seed_"),
      );
      if (base.blockTemplates.length !== before) {
        await saveAppState(base);
      }
      await AsyncStorage.setItem(KEYS.DEDUP_MIGRATION, "1");
    }

    // v2 migration: replace any wizard_* / meal_seed_* / old seed_* templates
    // with the verified ground-truth SCHEDULE_SEED_TEMPLATES. Preserves any
    // user-created templates (IDs that don't match those prefixes).
    if (!scheduleSeeded) {
      const kept = base.blockTemplates.filter(
        (t) =>
          !t.id.startsWith("wizard_") &&
          !t.id.startsWith("meal_seed_") &&
          !t.id.startsWith("seed_"),
      );
      base.blockTemplates = [...SCHEDULE_SEED_TEMPLATES, ...kept];
      base.setupWizardComplete = true;
      await saveAppState(base);
      await AsyncStorage.setItem(KEYS.SCHEDULE_SEED_MIGRATION, "1");
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
