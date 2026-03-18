// ─── Orbital Phase Inference Engine ──────────────────────────────────────────
// Scores each of the 8 orbital phases against the expanded raw signal window.
// Produces a likelihood ranking, secondary drift detection, and nutrition
// phase mismatch detection.
//
// CRITICAL LAYER SEPARATION:
//   OrbitalPhaseId  — physiological state read from data (this engine's output)
//   NutritionPhaseId — dietary regime the user selected (input for comparison)
// These are never merged. The engine compares, not conflates.

import type { NutritionPhaseId, OrbitalPhaseId } from "@/types";
import type { DailyIndex } from "./trendEngine";
import { NUTRITION_TO_ORBITAL } from "@/data/nutritionToOrbitalMap";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrbitalLikelihood {
  orbitalPhaseId: OrbitalPhaseId;
  label: string;
  score: number;           // 0–1
  keySignals: string[];
}

export interface OrbitalDriftEntry {
  orbitalPhaseId: OrbitalPhaseId;
  drift: number;           // recent3d score − full7d score; positive = gaining pressure
}

export interface OrbitalInference {
  likelihoods: OrbitalLikelihood[];         // all 8, sorted by score desc
  topPhase: OrbitalPhaseId;
  topScore: number;
  secondPhase: OrbitalPhaseId | null;
  confidence: "low" | "moderate" | "high";
  dataPoints: number;
  // ── Drift (secondary pressure detection) ────────────────────────────────
  driftPressures: OrbitalDriftEntry[];      // sorted by |drift| desc
  risingPhase: OrbitalPhaseId | null;       // gaining pressure in last 3d vs 7d
  fallingPhase: OrbitalPhaseId | null;      // losing pressure in last 3d vs 7d
  driftAvailable: boolean;                  // false when < 4 days total data
  // ── Nutrition comparison ─────────────────────────────────────────────────
  selectedNutritionPhaseId: NutritionPhaseId | null;
  translatedOrbitalPhaseId: OrbitalPhaseId | null;
  mismatch: boolean;
  mismatchSeverity: "none" | "mild" | "strong";
  mismatchTitle?: string;
  mismatchDescription?: string;
  suggestedNutritionPhaseId?: NutritionPhaseId;
  suggestionRationale?: string;
}

// ─── Orbital phase display metadata ──────────────────────────────────────────
export const ORBITAL_COLORS: Record<OrbitalPhaseId, string> = {
  priming:          "#8AAE92",
  loading:          "#D4873A",
  accumulation:     "#3A7CA5",
  saturation:       "#C45C5C",
  partitioning:     "#5A8A80",
  resensitization:  "#B07A4A",
  rebound:          "#6AAB8E",
  expression:       "#3D4F6B",
};

export const ORBITAL_LABELS: Record<OrbitalPhaseId, string> = {
  priming:          "Priming",
  loading:          "Loading",
  accumulation:     "Accumulation",
  saturation:       "Saturation",
  partitioning:     "Partitioning",
  resensitization:  "Resensitization",
  rebound:          "Rebound",
  expression:       "Expression",
};

export const ORBITAL_SHORT_DESC: Record<OrbitalPhaseId, string> = {
  priming:          "System receptive, not yet loaded",
  loading:          "Force production rising, fuel pressure high",
  accumulation:     "Absorbing training stimulus, substrate restoration",
  saturation:       "Maximum cellular stress, peak hypertrophy drive",
  partitioning:     "Nutrient routing toward muscle, efficiency mode",
  resensitization:  "CNS recovery, receptor sensitivity being restored",
  rebound:          "Supercompensation — output capacity returning",
  expression:       "Stabilized at a higher baseline, not forcing",
};

// ─── Orbital cycle positions — for distance-based mismatch severity ──────────
// Positions represent the physiological state machine cycle order (0–7).
// Cyclic distance = min(|a−b|, 8−|a−b|). Range: 0 (same) to 4 (opposite).
const ORBITAL_CYCLE_POSITION: Record<OrbitalPhaseId, number> = {
  priming:          0,
  loading:          1,
  accumulation:     2,
  saturation:       3,
  partitioning:     4,
  resensitization:  5,
  rebound:          6,
  expression:       7,
};

const ALL_ORBITAL_PHASES: OrbitalPhaseId[] = [
  "priming", "loading", "accumulation", "saturation",
  "partitioning", "resensitization", "rebound", "expression",
];

function orbitalDistance(a: OrbitalPhaseId, b: OrbitalPhaseId): number {
  const pa = ORBITAL_CYCLE_POSITION[a];
  const pb = ORBITAL_CYCLE_POSITION[b];
  const diff = Math.abs(pa - pb);
  return Math.min(diff, 8 - diff);
}
// distance ≥ 3 → strong mismatch; distance 1–2 → mild mismatch

// ─── Reverse map: observed orbital → recommended nutrition phase ──────────────
const ORBITAL_TO_NUTRITION_RECOMMENDATION: Record<
  OrbitalPhaseId,
  { phaseId: NutritionPhaseId; rationale: string }
> = {
  priming: {
    phaseId: "base",
    rationale:
      "Priming signals suggest the system is preparing without full load. Base nutrition maintains the controlled operating state without adding unnecessary fuel pressure.",
  },
  loading: {
    phaseId: "carbup",
    rationale:
      "Loading pressure calls for rising fuel. A Carb-Up protocol matches this phase directly — carbohydrates increase to support force production and training quality.",
  },
  accumulation: {
    phaseId: "base",
    rationale:
      "Accumulation suggests the training stimulus is already being absorbed. Base nutrition supports restoration without adding more fuel pressure on top of ongoing recovery.",
  },
  saturation: {
    phaseId: "peakbulk",
    rationale:
      "Saturation signals indicate maximum cellular stress and peak hypertrophy drive. Peak Bulk nutrition matches this state — the surplus and carbohydrate pressure align with what the body is already doing.",
  },
  partitioning: {
    phaseId: "recomp",
    rationale:
      "Partitioning pressure means the body is actively routing nutrients toward muscle over fat. Recomp nutrition supports this routing emphasis without forcing a full surplus or deficit.",
  },
  resensitization: {
    phaseId: "deload",
    rationale:
      "Resensitization signals indicate CNS recovery is needed and receptor sensitivity is being restored. Deload nutrition reduces caloric and training strain to allow the system to reset.",
  },
  rebound: {
    phaseId: "dietbreak",
    rationale:
      "Rebound signals suggest suppression is lifting and output is returning. A Diet Break relieves adaptive suppression by bringing intake back to maintenance — matching the system's natural recovery trajectory.",
  },
  expression: {
    phaseId: "base",
    rationale:
      "Expression signals mean the system has stabilized at a higher baseline after a completed cycle. Base nutrition is the correct operating point — not forcing the next push yet, not resetting.",
  },
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function windowAvg(indices: DailyIndex[], field: keyof DailyIndex): number | undefined {
  const vals = indices
    .map((d) => d[field] as number | undefined)
    .filter((v): v is number => v !== undefined);
  if (vals.length === 0) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function fieldTrend(
  indices: DailyIndex[],
  field: keyof DailyIndex
): "rising" | "falling" | "stable" {
  const vals = indices
    .map((d) => d[field] as number | undefined)
    .filter((v): v is number => v !== undefined);
  if (vals.length < 3) return "stable";
  const delta = vals[vals.length - 1]! - vals[0]!;
  const span = Math.max(...vals) - Math.min(...vals);
  const threshold = span > 0 ? span * 0.2 : 0.15;
  if (Math.abs(delta) < threshold) return "stable";
  return delta > 0 ? "rising" : "falling";
}

// Clamp-normalized score: how well does value sit in [idealMin, idealMax]?
// softZone controls the width of the transition band from 1.0 → 0.0.
// Default softZone=2 suits 1–5 scale signals (0.5 per unit penalty).
// Use softZone=20 for sleep-minute signals (1 min penalty per 20 min off-ideal).
function rangeScore(
  value: number | undefined,
  idealMin: number,
  idealMax: number,
  softZone: number = 2
): number {
  if (value === undefined) return 0.5;
  if (value >= idealMin && value <= idealMax) return 1.0;
  const distBelow = Math.max(0, idealMin - value);
  const distAbove = Math.max(0, value - idealMax);
  const dist = distBelow + distAbove;   // only one is non-zero at any point
  return Math.max(0, 1 - dist / softZone);
}

function trendScore(
  dir: "rising" | "falling" | "stable",
  preferredDir: "rising" | "falling" | "stable"
): number {
  if (dir === preferredDir) return 1.0;
  if (dir === "stable") return 0.6;
  return 0.2;
}

// Sleep stage ratios — all computed against a 30-minute minimum sleep floor
function sleepRatios(avgDeep?: number, avgRem?: number, avgCore?: number, avgAwake?: number) {
  const total = (avgDeep ?? 0) + (avgRem ?? 0) + (avgCore ?? 0) + (avgAwake ?? 0);
  const sleep = (avgDeep ?? 0) + (avgRem ?? 0) + (avgCore ?? 0);
  if (sleep < 30) {
    return { deepPct: undefined, remPct: undefined, corePct: undefined, awakePct: undefined };
  }
  return {
    deepPct:  (avgDeep  ?? 0) / sleep * 100,
    remPct:   (avgRem   ?? 0) / sleep * 100,
    corePct:  (avgCore  ?? 0) / sleep * 100,
    awakePct: total > 0 ? (avgAwake ?? 0) / total * 100 : undefined,
  };
}

type Ratios = ReturnType<typeof sleepRatios>;

// Pre-computed window data passed to all scoring functions
interface WindowData {
  avg: Record<string, number | undefined>;
  trends: Record<string, "rising" | "falling" | "stable">;
  ratios: Ratios;
}

function computeWindowData(indices: DailyIndex[]): WindowData {
  const fields: (keyof DailyIndex)[] = [
    "recoveryNeedScore", "physicalEnergy", "motivation", "mentalFog",
    "emotionalStability", "noveltyHunger", "structureHunger",
    "sensoryLoadBaseline", "hrv", "rhr", "deepMin", "remMin",
    "coreMin", "awakeMin", "bodyFatPct", "fatFreeMassLbs",
    "weightLbs", "waistIn",
  ];
  const avg: Record<string, number | undefined> = {};
  const trends: Record<string, "rising" | "falling" | "stable"> = {};
  for (const f of fields) {
    avg[f as string] = windowAvg(indices, f);
    trends[f as string] = fieldTrend(indices, f);
  }
  const ratios = sleepRatios(avg.deepMin, avg.remMin, avg.coreMin, avg.awakeMin);
  return { avg, trends, ratios };
}

// ─── Phase scoring functions ──────────────────────────────────────────────────
// Each returns { score: 0–1, signals: string[] }
// Weights within each function must sum to 1.00.

function scorePriming(
  { avg, trends, ratios }: WindowData
): { score: number; signals: string[] } {
  const signals: string[] = [];
  const weights: [number, number][] = [];

  // Recovery need low — system not depleted (0.20)
  const rnScore = rangeScore(avg.recoveryNeedScore, 1, 2);
  weights.push([rnScore * 0.20, 0.20]);
  if (rnScore > 0.7) signals.push("Recovery need low — system not depleted");

  // Physical energy moderate, not spiking (0.15)
  const peScore = rangeScore(avg.physicalEnergy, 2, 3.5);
  weights.push([peScore * 0.15, 0.15]);
  if (peScore > 0.7) signals.push("Physical energy in readiness range");

  // Sensory load low (0.15)
  const slScore = rangeScore(avg.sensoryLoadBaseline, 1, 2.5);
  weights.push([slScore * 0.15, 0.15]);
  if (slScore > 0.7) signals.push("Sensory load low");

  // HRV stable (reduced from 0.15 → 0.10 to absorb Awake weight) (0.10)
  const hrvTrendScore = trendScore(trends.hrv ?? "stable", "stable");
  weights.push([hrvTrendScore * 0.10, 0.10]);
  if (hrvTrendScore > 0.7) signals.push("HRV holding steady");

  // Core sleep 40–60% of sleep (0.10)
  if (ratios.corePct !== undefined) {
    const coreScore = rangeScore(ratios.corePct, 40, 60);
    weights.push([coreScore * 0.10, 0.10]);
  } else {
    weights.push([0.5 * 0.10, 0.10]);
  }

  // Mental fog low — receptive (reduced from 0.15 → 0.10) (0.10)
  const mfScore = rangeScore(avg.mentalFog, 1, 2.5);
  weights.push([mfScore * 0.10, 0.10]);
  if (mfScore > 0.7) signals.push("Mental clarity in receptive range");

  // Motivation moderate — not fired up, not crashed (0.10)
  const motScore = rangeScore(avg.motivation, 2, 3.5);
  weights.push([motScore * 0.10, 0.10]);

  // Awake time low — sleep structure intact (0.10)  [was unused, now explicit]
  // Awake ↔ Priming axis: Priming expects <10% awake of total sleep time.
  if (ratios.awakePct !== undefined) {
    const awakeScore = rangeScore(ratios.awakePct, 0, 10);
    weights.push([awakeScore * 0.10, 0.10]);
    if (awakeScore > 0.7) signals.push("Awake time low — sleep structure intact");
  } else {
    weights.push([0.5 * 0.10, 0.10]);
  }

  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return {
    score: weights.reduce((s, [e]) => s + e, 0) / maxPossible,
    signals: signals.slice(0, 3),
  };
}

function scoreLoading(
  { avg, trends }: WindowData
): { score: number; signals: string[] } {
  // Loading is intentionally sleep-agnostic. Physical energy and motivation
  // already absorb the downstream effect of disrupted sleep. Adding sleep
  // stages here would double-count that path. Revisit if Loading over-triggers
  // on days following disrupted nights.
  const signals: string[] = [];
  const weights: [number, number][] = [];

  const peScore = rangeScore(avg.physicalEnergy, 3.5, 5);
  weights.push([peScore * 0.22, 0.22]);
  if (peScore > 0.7) signals.push("Physical energy elevated");

  const motScore = rangeScore(avg.motivation, 3.5, 5);
  weights.push([motScore * 0.22, 0.22]);
  if (motScore > 0.7) signals.push("Motivation high");

  const mfScore = rangeScore(avg.mentalFog, 1, 2.5);
  weights.push([mfScore * 0.15, 0.15]);
  if (mfScore > 0.7) signals.push("Mental fog low — sharp and ready");

  const rnScore = rangeScore(avg.recoveryNeedScore, 1, 2.5);
  weights.push([rnScore * 0.15, 0.15]);
  if (rnScore > 0.7) signals.push("Recovery need low");

  const novScore = rangeScore(avg.noveltyHunger, 3.5, 5);
  weights.push([novScore * 0.12, 0.12]);
  if (novScore > 0.7) signals.push("Novelty hunger high — drive toward output");

  const hrvTrendScore = trendScore(trends.hrv ?? "stable", "stable");
  weights.push([hrvTrendScore * 0.14, 0.14]);
  if (hrvTrendScore > 0.7) signals.push("HRV stable or rising");

  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return {
    score: weights.reduce((s, [e]) => s + e, 0) / maxPossible,
    signals: signals.slice(0, 3),
  };
}

function scoreAccumulation(
  { avg, trends, ratios }: WindowData
): { score: number; signals: string[] } {
  const signals: string[] = [];
  const weights: [number, number][] = [];

  // Deep sleep elevated — body processing the stimulus (0.25)
  // softZone=20: 90min→1.0, 70min→0.0, 80min→0.5
  if (avg.deepMin !== undefined) {
    const deepScore = rangeScore(avg.deepMin, 90, 999, 20);
    weights.push([deepScore * 0.25, 0.25]);
    if (deepScore > 0.7) signals.push("Deep sleep elevated — stimulus being absorbed");
  } else {
    weights.push([0.5 * 0.25, 0.25]);
  }

  const rnScore = rangeScore(avg.recoveryNeedScore, 2.0, 3.5);
  weights.push([rnScore * 0.18, 0.18]);
  if (rnScore > 0.7) signals.push("Moderate recovery need — absorption phase");

  const peScore = rangeScore(avg.physicalEnergy, 2.0, 3.5);
  weights.push([peScore * 0.15, 0.15]);
  if (peScore > 0.7) signals.push("Physical energy in consolidation range");

  const strScore = rangeScore(avg.structureHunger, 3.0, 5);
  weights.push([strScore * 0.12, 0.12]);
  if (strScore > 0.7) signals.push("Structure hunger elevated — consolidation mode");

  const hrvTrendScore = trendScore(trends.hrv ?? "stable", "stable");
  weights.push([hrvTrendScore * 0.15, 0.15]);

  if (avg.rhr !== undefined) {
    const rhrScore = rangeScore(avg.rhr, 55, 70);
    weights.push([rhrScore * 0.15, 0.15]);
    if (avg.rhr > 60) signals.push("RHR slightly elevated — processing ongoing");
  } else {
    weights.push([0.5 * 0.15, 0.15]);
  }

  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return {
    score: weights.reduce((s, [e]) => s + e, 0) / maxPossible,
    signals: signals.slice(0, 3),
  };
}

function scoreSaturation(
  { avg, trends, ratios }: WindowData
): { score: number; signals: string[] } {
  const signals: string[] = [];
  const weights: [number, number][] = [];

  // Recovery need very high — hallmark of saturation (0.25)
  const rnScore = rangeScore(avg.recoveryNeedScore, 3.5, 5);
  weights.push([rnScore * 0.25, 0.25]);
  if (rnScore > 0.6) signals.push("Recovery need high — maximum cellular stress");

  // Deep sleep very high — softZone=20; 100min→1.0, 80min→0.0 (0.20)
  if (avg.deepMin !== undefined) {
    const deepScore = rangeScore(avg.deepMin, 100, 999, 20);
    weights.push([deepScore * 0.20, 0.20]);
    if (avg.deepMin > 100) signals.push("Deep sleep very high — body in repair overdrive");
  } else {
    weights.push([0.4 * 0.20, 0.20]);  // pessimistic neutral
  }

  // RHR trending upward (0.15)
  const rhrTrendScore = trendScore(trends.rhr ?? "stable", "rising");
  weights.push([rhrTrendScore * 0.15, 0.15]);
  if (trends.rhr === "rising") signals.push("RHR trending upward");

  // HRV declining — CNS under maximum load (0.20)
  const hrvTrendScore = trendScore(trends.hrv ?? "stable", "falling");
  weights.push([hrvTrendScore * 0.20, 0.20]);
  if (trends.hrv === "falling") signals.push("HRV declining — CNS under maximum load");

  // Fat-free mass increasing (reduced from 0.10 → 0.05) (0.05)
  const ffmTrendScore = trendScore(trends.fatFreeMassLbs ?? "stable", "rising");
  weights.push([ffmTrendScore * 0.05, 0.05]);

  // Weight trending up (reduced from 0.10 → 0.05) (0.05)
  const wtTrendScore = trendScore(trends.weightLbs ?? "stable", "rising");
  weights.push([wtTrendScore * 0.05, 0.05]);
  if (trends.weightLbs === "rising") signals.push("Body weight trending up — mass accumulation");

  // Awake time elevated — Awake ↔ Saturation axis (0.10)
  // Saturation at peak load associates with mild sleep disruption (10–25% awake of total).
  if (ratios.awakePct !== undefined) {
    const awakeScore = rangeScore(ratios.awakePct, 10, 25);
    weights.push([awakeScore * 0.10, 0.10]);
    if (awakeScore > 0.7) signals.push("Elevated wake time — sleep disrupted at peak load");
  } else {
    weights.push([0.4 * 0.10, 0.10]);  // pessimistic neutral
  }

  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return {
    score: weights.reduce((s, [e]) => s + e, 0) / maxPossible,
    signals: signals.slice(0, 3),
  };
}

function scorePartitioning(
  { avg, trends }: WindowData
): { score: number; signals: string[] } {
  const signals: string[] = [];
  const weights: [number, number][] = [];

  const hrvTrendScore = trendScore(trends.hrv ?? "stable", "stable");
  weights.push([hrvTrendScore * 0.20, 0.20]);
  if (trends.hrv === "stable") signals.push("HRV stable — efficient, not stressed");

  const bfTrendScore = trendScore(trends.bodyFatPct ?? "stable", "falling");
  weights.push([bfTrendScore * 0.18, 0.18]);
  if (trends.bodyFatPct === "falling") signals.push("Body fat declining — routing to muscle");

  // Fat-free mass: rising=1.0, stable=0.7, falling=0.2
  const ffmDir = trends.fatFreeMassLbs ?? "stable";
  const ffmScore = ffmDir === "rising" ? 1.0 : ffmDir === "stable" ? 0.7 : 0.2;
  weights.push([ffmScore * 0.18, 0.18]);
  if (ffmScore > 0.7) signals.push("Fat-free mass holding or rising");

  const peScore = rangeScore(avg.physicalEnergy, 2.5, 4);
  weights.push([peScore * 0.15, 0.15]);

  const rnScore = rangeScore(avg.recoveryNeedScore, 1.5, 3);
  weights.push([rnScore * 0.15, 0.15]);

  // Waist: falling=1.0, stable=0.7, rising=0.2
  const waistDir = trends.waistIn ?? "stable";
  const waistScore = waistDir === "falling" ? 1.0 : waistDir === "stable" ? 0.7 : 0.2;
  weights.push([waistScore * 0.14, 0.14]);
  if (waistScore > 0.7) signals.push("Waist stable or declining — fat routing");

  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return {
    score: weights.reduce((s, [e]) => s + e, 0) / maxPossible,
    signals: signals.slice(0, 3),
  };
}

function scoreResensitization(
  { avg, trends, ratios }: WindowData
): { score: number; signals: string[] } {
  const signals: string[] = [];
  const weights: [number, number][] = [];

  // HRV declining — CNS needs restoration (0.25)
  const hrvTrendScore = trendScore(trends.hrv ?? "stable", "falling");
  weights.push([hrvTrendScore * 0.25, 0.25]);
  if (trends.hrv === "falling") signals.push("HRV declining — CNS requesting restoration");

  const rnScore = rangeScore(avg.recoveryNeedScore, 3.0, 5);
  weights.push([rnScore * 0.20, 0.20]);
  if (rnScore > 0.7) signals.push("Recovery need elevated");

  const peScore = rangeScore(avg.physicalEnergy, 1, 3);
  weights.push([peScore * 0.15, 0.15]);
  if (peScore > 0.7) signals.push("Physical energy low — system in rest mode");

  const slScore = rangeScore(avg.sensoryLoadBaseline, 3, 5);
  weights.push([slScore * 0.15, 0.15]);
  if (slScore > 0.7) signals.push("Sensory load elevated — nervous system taxed");

  // Deep sleep elevated — softZone=20; 80min→1.0, 60min→0.0 (0.15)
  if (avg.deepMin !== undefined) {
    const deepScore = rangeScore(avg.deepMin, 80, 999, 20);
    weights.push([deepScore * 0.15, 0.15]);
    if (avg.deepMin > 80) signals.push("Deep sleep elevated — restoration underway");
  } else {
    weights.push([0.5 * 0.15, 0.15]);
  }

  const rhrTrendScore = trendScore(trends.rhr ?? "stable", "rising");
  weights.push([rhrTrendScore * 0.10, 0.10]);

  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return {
    score: weights.reduce((s, [e]) => s + e, 0) / maxPossible,
    signals: signals.slice(0, 3),
  };
}

function scoreRebound(
  { avg, trends, ratios }: WindowData
): { score: number; signals: string[] } {
  const signals: string[] = [];
  const weights: [number, number][] = [];

  // HRV rising — THE defining rebound signal (0.30)
  const hrvRisingScore = trendScore(trends.hrv ?? "stable", "rising");
  weights.push([hrvRisingScore * 0.30, 0.30]);
  if (trends.hrv === "rising") signals.push("HRV rising — supercompensation window open");

  const peTrendScore = trendScore(trends.physicalEnergy ?? "stable", "rising");
  weights.push([peTrendScore * 0.20, 0.20]);
  if (trends.physicalEnergy === "rising") signals.push("Physical energy recovering upward");

  const rnTrendScore = trendScore(trends.recoveryNeedScore ?? "stable", "falling");
  weights.push([rnTrendScore * 0.20, 0.20]);
  if (trends.recoveryNeedScore === "falling") signals.push("Recovery need declining — suppression lifting");

  const motTrendScore = trendScore(trends.motivation ?? "stable", "rising");
  weights.push([motTrendScore * 0.15, 0.15]);
  if (trends.motivation === "rising") signals.push("Motivation returning");

  // REM 22–40% of sleep — supercompensation and cognitive consolidation (0.15)
  if (ratios.remPct !== undefined) {
    const remScore = rangeScore(ratios.remPct, 22, 40);
    weights.push([remScore * 0.15, 0.15]);
    if (remScore > 0.7) signals.push("REM elevated — consolidation and rebound signature");
  } else {
    weights.push([0.5 * 0.15, 0.15]);
  }

  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return {
    score: weights.reduce((s, [e]) => s + e, 0) / maxPossible,
    signals: signals.slice(0, 3),
  };
}

function scoreExpression(
  { avg, trends }: WindowData
): { score: number; signals: string[] } {
  const signals: string[] = [];
  const weights: [number, number][] = [];

  const rnScore = rangeScore(avg.recoveryNeedScore, 1, 2.5);
  weights.push([rnScore * 0.20, 0.20]);
  if (rnScore > 0.7) signals.push("Recovery need low — stabilized");

  // Multi-signal stability — the defining feature of Expression (0.30)
  const stableSignals = ["hrv", "physicalEnergy", "motivation", "recoveryNeedScore", "rhr"];
  let stableCount = 0;
  for (const sig of stableSignals) {
    if ((trends[sig] ?? "stable") === "stable") stableCount++;
  }
  const stabilityScore = stableCount / stableSignals.length;
  weights.push([stabilityScore * 0.30, 0.30]);
  if (stabilityScore >= 0.6) {
    signals.push(`${stableCount}/${stableSignals.length} signals stable — expression state`);
  }

  const peScore = rangeScore(avg.physicalEnergy, 3, 4.5);
  weights.push([peScore * 0.15, 0.15]);
  if (peScore > 0.7) signals.push("Physical energy in stable capable range");

  const hrvTrendScore = trendScore(trends.hrv ?? "stable", "stable");
  weights.push([hrvTrendScore * 0.20, 0.20]);
  if (trends.hrv === "stable") signals.push("HRV stable");

  const mfScore = rangeScore(avg.mentalFog, 1, 2.5);
  weights.push([mfScore * 0.15, 0.15]);

  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return {
    score: weights.reduce((s, [e]) => s + e, 0) / maxPossible,
    signals: signals.slice(0, 3),
  };
}

// ─── Score all 8 phases from pre-computed window data ────────────────────────
function scoreAllPhases(data: WindowData): Record<OrbitalPhaseId, { score: number; signals: string[] }> {
  return {
    priming:          scorePriming(data),
    loading:          scoreLoading(data),
    accumulation:     scoreAccumulation(data),
    saturation:       scoreSaturation(data),
    partitioning:     scorePartitioning(data),
    resensitization:  scoreResensitization(data),
    rebound:          scoreRebound(data),
    expression:       scoreExpression(data),
  };
}

// ─── Main inference function ──────────────────────────────────────────────────
export function inferOrbitalPhase(
  indices: DailyIndex[],
  selectedNutritionPhaseId: NutritionPhaseId | null
): OrbitalInference {
  const window = indices.slice(-7);
  const dataPoints = window.length;

  const confidence: "low" | "moderate" | "high" =
    dataPoints < 3 ? "low" : dataPoints < 6 ? "moderate" : "high";

  // ── Score all phases over the full window ────────────────────────────────
  const fullData = computeWindowData(window);
  const fullScores = scoreAllPhases(fullData);

  const likelihoods: OrbitalLikelihood[] = ALL_ORBITAL_PHASES.map((phase) => ({
    orbitalPhaseId: phase,
    label: ORBITAL_LABELS[phase],
    score: Math.round(fullScores[phase].score * 100) / 100,
    keySignals: fullScores[phase].signals,
  })).sort((a, b) => b.score - a.score);

  const topPhase   = likelihoods[0]!.orbitalPhaseId;
  const topScore   = likelihoods[0]!.score;
  const secondPhase = likelihoods[1]?.orbitalPhaseId ?? null;

  // ── Secondary drift — two-window comparison ──────────────────────────────
  // drift = recentScore − fullScore; positive = phase gaining pressure
  const recentWindow = indices.slice(-3);
  const driftAvailable = recentWindow.length >= 3 && window.length >= 4;

  let driftPressures: OrbitalDriftEntry[] = [];
  let risingPhase: OrbitalPhaseId | null = null;
  let fallingPhase: OrbitalPhaseId | null = null;

  if (driftAvailable) {
    const recentData = computeWindowData(recentWindow);
    const recentScores = scoreAllPhases(recentData);

    driftPressures = ALL_ORBITAL_PHASES.map((phase) => ({
      orbitalPhaseId: phase,
      drift: Math.round((recentScores[phase].score - fullScores[phase].score) * 100) / 100,
    })).sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

    const DRIFT_THRESHOLD = 0.05;
    const maxDrift = driftPressures[0];
    const minDrift = [...driftPressures].sort((a, b) => a.drift - b.drift)[0];

    risingPhase  = (maxDrift && maxDrift.drift  >  DRIFT_THRESHOLD) ? maxDrift.orbitalPhaseId  : null;
    fallingPhase = (minDrift && minDrift.drift   < -DRIFT_THRESHOLD) ? minDrift.orbitalPhaseId : null;
  }

  // ── Nutrition mismatch detection ─────────────────────────────────────────
  const translatedOrbitalPhaseId: OrbitalPhaseId | null = selectedNutritionPhaseId
    ? (NUTRITION_TO_ORBITAL[selectedNutritionPhaseId]?.orbitalPhasePrimary ?? null)
    : null;

  let mismatch = false;
  let mismatchSeverity: "none" | "mild" | "strong" = "none";
  let mismatchTitle: string | undefined;
  let mismatchDescription: string | undefined;
  let suggestedNutritionPhaseId: NutritionPhaseId | undefined;
  let suggestionRationale: string | undefined;

  // Gate: mismatch requires a different phase, topScore > 0.5,
  // AND confidence must be at least "moderate" (≥ 3 data points).
  if (
    translatedOrbitalPhaseId &&
    translatedOrbitalPhaseId !== topPhase &&
    topScore > 0.5 &&
    confidence !== "low"
  ) {
    mismatch = true;

    // Severity via orbital cycle distance — principled, no hardcoded list.
    // distance ≥ 3 of 4 max = strong mismatch; 1–2 = mild mismatch.
    const distance = orbitalDistance(translatedOrbitalPhaseId, topPhase);
    mismatchSeverity = distance >= 3 ? "strong" : "mild";

    const selectedLabel = ORBITAL_LABELS[translatedOrbitalPhaseId];
    const observedLabel = ORBITAL_LABELS[topPhase];

    mismatchTitle = `Nutrition implies ${selectedLabel} — data suggests ${observedLabel}`;
    mismatchDescription =
      mismatchSeverity === "strong"
        ? `Your current nutrition phase is steering the system toward ${selectedLabel} (orbital distance ${distance}), but signal patterns over the past ${dataPoints} days are consistent with ${observedLabel}. These phases sit on opposite ends of the physiological cycle — continuing the current protocol against this pattern may deepen the mismatch.`
        : `Your current nutrition phase is oriented toward ${selectedLabel}, but the observed signal pattern more closely resembles ${observedLabel} (orbital distance ${distance}). The mismatch is mild — monitor for a few more days, or consider adjusting the protocol if this pattern holds.`;

    const rec = ORBITAL_TO_NUTRITION_RECOMMENDATION[topPhase];
    suggestedNutritionPhaseId = rec.phaseId;
    suggestionRationale = rec.rationale;
  }

  return {
    likelihoods,
    topPhase,
    topScore,
    secondPhase,
    confidence,
    dataPoints,
    driftPressures,
    risingPhase,
    fallingPhase,
    driftAvailable,
    selectedNutritionPhaseId,
    translatedOrbitalPhaseId,
    mismatch,
    mismatchSeverity,
    mismatchTitle,
    mismatchDescription,
    suggestedNutritionPhaseId,
    suggestionRationale,
  };
}
