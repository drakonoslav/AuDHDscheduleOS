// ─── Orbital Phase Inference Engine ──────────────────────────────────────────
// Scores each of the 8 orbital phases against the expanded raw signal window.
// Produces a likelihood ranking + nutrition phase mismatch detection.
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
  keySignals: string[];    // which signals drove the score
}

export interface OrbitalInference {
  likelihoods: OrbitalLikelihood[];       // all 8, sorted by score desc
  topPhase: OrbitalPhaseId;
  topScore: number;
  secondPhase: OrbitalPhaseId | null;
  confidence: "low" | "moderate" | "high";
  dataPoints: number;                     // how many days had any data
  // ── Nutrition comparison ─────────────────────────────────────────────────
  selectedNutritionPhaseId: NutritionPhaseId | null;
  translatedOrbitalPhaseId: OrbitalPhaseId | null;   // from translator table
  mismatch: boolean;
  mismatchSeverity: "none" | "mild" | "strong";
  mismatchTitle?: string;
  mismatchDescription?: string;
  suggestedNutritionPhaseId?: NutritionPhaseId;
  suggestionRationale?: string;
}

// ─── Orbital phase display metadata ──────────────────────────────────────────
export const ORBITAL_COLORS: Record<OrbitalPhaseId, string> = {
  priming:          "#8AAE92",   // sage
  loading:          "#D4873A",   // amber
  accumulation:     "#3A7CA5",   // structuring blue
  saturation:       "#C45C5C",   // rose
  partitioning:     "#5A8A80",   // teal/accent
  resensitization:  "#B07A4A",   // warm orange-brown
  rebound:          "#6AAB8E",   // expansion green
  expression:       "#3D4F6B",   // navy
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

// Returns "rising" | "falling" | "stable" for any numeric field over the window
function fieldTrend(indices: DailyIndex[], field: keyof DailyIndex): "rising" | "falling" | "stable" {
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

// Clamp-normalized score: how well does `value` sit in [idealMin, idealMax]?
function rangeScore(value: number | undefined, idealMin: number, idealMax: number): number {
  if (value === undefined) return 0.5;
  if (value >= idealMin && value <= idealMax) return 1.0;
  const distBelow = Math.max(0, idealMin - value);
  const distAbove = Math.max(0, value - idealMax);
  const dist = Math.max(distBelow, distAbove);
  return Math.max(0, 1 - dist / 2);
}

function trendScore(
  dir: "rising" | "falling" | "stable",
  preferredDir: "rising" | "falling" | "stable"
): number {
  if (dir === preferredDir) return 1.0;
  if (dir === "stable") return 0.6;
  return 0.2;
}

// Sleep stage ratios from a single DailyIndex (or averaged window)
function sleepRatios(avgDeep?: number, avgRem?: number, avgCore?: number, avgAwake?: number) {
  const total = (avgDeep ?? 0) + (avgRem ?? 0) + (avgCore ?? 0) + (avgAwake ?? 0);
  const sleep = (avgDeep ?? 0) + (avgRem ?? 0) + (avgCore ?? 0);
  if (sleep < 30) return { deepPct: undefined, remPct: undefined, corePct: undefined, awakePct: undefined };
  return {
    deepPct: (avgDeep ?? 0) / sleep * 100,
    remPct:  (avgRem  ?? 0) / sleep * 100,
    corePct: (avgCore ?? 0) / sleep * 100,
    awakePct: total > 0 ? (avgAwake ?? 0) / total * 100 : undefined,
  };
}

// ─── Phase scoring functions ──────────────────────────────────────────────────
// Each returns { score: 0–1, signals: string[] }

function scorePriming(avg: Record<string, number | undefined>, trends: Record<string, "rising" | "falling" | "stable">, ratios: ReturnType<typeof sleepRatios>): { score: number; signals: string[] } {
  const signals: string[] = [];
  let total = 0;
  const weights: [number, number, string][] = [];  // [earned, max, label]

  // Recovery need low = system not depleted yet
  const rnScore = rangeScore(avg.recoveryNeedScore, 1, 2);
  weights.push([rnScore * 0.20, 0.20, "Low recovery need"]);
  if (rnScore > 0.7) signals.push("Recovery need low — system not depleted");

  // Physical energy moderate, not spiking
  const peScore = rangeScore(avg.physicalEnergy, 2, 3.5);
  weights.push([peScore * 0.15, 0.15, "Moderate physical energy"]);
  if (peScore > 0.7) signals.push("Physical energy in readiness range");

  // Sensory load low
  const slScore = rangeScore(avg.sensoryLoadBaseline, 1, 2.5);
  weights.push([slScore * 0.15, 0.15, "Low sensory load"]);
  if (slScore > 0.7) signals.push("Sensory load low");

  // HRV stable
  const hrvTrendScore = trendScore(trends.hrv ?? "stable", "stable");
  weights.push([hrvTrendScore * 0.15, 0.15, "HRV stable"]);
  if (hrvTrendScore > 0.7) signals.push("HRV holding steady");

  // Sleep stages: moderate core, moderate deep, low awake — system prepared
  if (ratios.corePct !== undefined) {
    const coreScore = rangeScore(ratios.corePct, 40, 60);
    weights.push([coreScore * 0.10, 0.10, "Core sleep balanced"]);
  } else {
    weights.push([0.5 * 0.10, 0.10, ""]);
  }

  // Mental fog low = receptive, not foggy
  const mfScore = rangeScore(avg.mentalFog, 1, 2.5);
  weights.push([mfScore * 0.15, 0.15, "Mental clarity"]);
  if (mfScore > 0.7) signals.push("Mental clarity in receptive range");

  // Motivation moderate (not fired up, not crashed)
  const motScore = rangeScore(avg.motivation, 2, 3.5);
  weights.push([motScore * 0.10, 0.10, "Moderate motivation"]);

  for (const [earned, max] of weights) total += earned / max * max;
  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return { score: weights.reduce((s, [e]) => s + e, 0) / maxPossible, signals: signals.slice(0, 3) };
}

function scoreLoading(avg: Record<string, number | undefined>, trends: Record<string, "rising" | "falling" | "stable">): { score: number; signals: string[] } {
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
  return { score: weights.reduce((s, [e]) => s + e, 0) / maxPossible, signals: signals.slice(0, 3) };
}

function scoreAccumulation(avg: Record<string, number | undefined>, trends: Record<string, "rising" | "falling" | "stable">, ratios: ReturnType<typeof sleepRatios>): { score: number; signals: string[] } {
  const signals: string[] = [];
  const weights: [number, number][] = [];

  // Deep sleep elevated — body processing the stimulus (most important signal)
  if (avg.deepMin !== undefined) {
    const deepScore = rangeScore(avg.deepMin, 90, 999);
    weights.push([deepScore * 0.25, 0.25]);
    if (deepScore > 0.7) signals.push("Deep sleep elevated — stimulus being absorbed");
  } else {
    weights.push([0.5 * 0.25, 0.25]);
  }

  // Recovery need moderate — system is working on recovery, not crashed
  const rnScore = rangeScore(avg.recoveryNeedScore, 2.0, 3.5);
  weights.push([rnScore * 0.18, 0.18]);
  if (rnScore > 0.7) signals.push("Moderate recovery need — absorption phase");

  // Physical energy moderate-low (coming down from loading)
  const peScore = rangeScore(avg.physicalEnergy, 2.0, 3.5);
  weights.push([peScore * 0.15, 0.15]);
  if (peScore > 0.7) signals.push("Physical energy in consolidation range");

  // Structure hunger rising — system prefers consolidation over novelty
  const strScore = rangeScore(avg.structureHunger, 3.0, 5);
  weights.push([strScore * 0.12, 0.12]);
  if (strScore > 0.7) signals.push("Structure hunger elevated — consolidation mode");

  // HRV slightly dipped but stable (not crashing)
  const hrvTrendScore = trendScore(trends.hrv ?? "stable", "stable");
  weights.push([hrvTrendScore * 0.15, 0.15]);

  // RHR slightly elevated
  if (avg.rhr !== undefined) {
    const rhrScore = rangeScore(avg.rhr, 55, 70);
    weights.push([rhrScore * 0.15, 0.15]);
    if (avg.rhr > 60) signals.push("RHR slightly elevated — processing ongoing");
  } else {
    weights.push([0.5 * 0.15, 0.15]);
  }

  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return { score: weights.reduce((s, [e]) => s + e, 0) / maxPossible, signals: signals.slice(0, 3) };
}

function scoreSaturation(avg: Record<string, number | undefined>, trends: Record<string, "rising" | "falling" | "stable">, ratios: ReturnType<typeof sleepRatios>): { score: number; signals: string[] } {
  const signals: string[] = [];
  const weights: [number, number][] = [];

  // High recovery need is the hallmark of saturation
  const rnScore = rangeScore(avg.recoveryNeedScore, 3.5, 5);
  weights.push([rnScore * 0.25, 0.25]);
  if (rnScore > 0.6) signals.push("Recovery need high — maximum cellular stress");

  // Very high deep sleep
  if (avg.deepMin !== undefined) {
    const deepScore = rangeScore(avg.deepMin, 100, 999);
    weights.push([deepScore * 0.20, 0.20]);
    if (avg.deepMin > 100) signals.push("Deep sleep very high — body in repair overdrive");
  } else {
    weights.push([0.4 * 0.20, 0.20]);
  }

  // RHR elevated or rising
  const rhrTrendScore = trendScore(trends.rhr ?? "stable", "rising");
  weights.push([rhrTrendScore * 0.15, 0.15]);
  if (trends.rhr === "rising") signals.push("RHR trending upward");

  // HRV declining
  const hrvTrendScore = trendScore(trends.hrv ?? "stable", "falling");
  weights.push([hrvTrendScore * 0.20, 0.20]);
  if (trends.hrv === "falling") signals.push("HRV declining — CNS under maximum load");

  // Fat-free mass increasing (peak bulk body comp signal)
  const ffmTrendScore = trendScore(trends.fatFreeMassLbs ?? "stable", "rising");
  weights.push([ffmTrendScore * 0.10, 0.10]);

  // Weight trending up (accumulating mass)
  const wtTrendScore = trendScore(trends.weightLbs ?? "stable", "rising");
  weights.push([wtTrendScore * 0.10, 0.10]);
  if (trends.weightLbs === "rising") signals.push("Body weight trending up — mass accumulation");

  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return { score: weights.reduce((s, [e]) => s + e, 0) / maxPossible, signals: signals.slice(0, 3) };
}

function scorePartitioning(avg: Record<string, number | undefined>, trends: Record<string, "rising" | "falling" | "stable">): { score: number; signals: string[] } {
  const signals: string[] = [];
  const weights: [number, number][] = [];

  // HRV stable = key marker — efficient but not stressed
  const hrvTrendScore = trendScore(trends.hrv ?? "stable", "stable");
  weights.push([hrvTrendScore * 0.20, 0.20]);
  if (trends.hrv === "stable") signals.push("HRV stable — efficient, not stressed");

  // Body fat declining
  const bfTrendScore = trendScore(trends.bodyFatPct ?? "stable", "falling");
  weights.push([bfTrendScore * 0.18, 0.18]);
  if (trends.bodyFatPct === "falling") signals.push("Body fat declining — routing to muscle");

  // Fat-free mass holding or rising
  const ffmTrendScore = trendScore(trends.fatFreeMassLbs ?? "stable", "rising");
  const ffmStableScore = trends.fatFreeMassLbs === "stable" ? 0.7 : (trends.fatFreeMassLbs === "rising" ? 1.0 : 0.2);
  weights.push([ffmStableScore * 0.18, 0.18]);
  if (ffmStableScore > 0.7) signals.push("Fat-free mass holding or rising");

  // Physical energy moderate
  const peScore = rangeScore(avg.physicalEnergy, 2.5, 4);
  weights.push([peScore * 0.15, 0.15]);

  // Recovery need moderate
  const rnScore = rangeScore(avg.recoveryNeedScore, 1.5, 3);
  weights.push([rnScore * 0.15, 0.15]);

  // Waist stable or declining
  const waistTrend = trends.waistIn ?? "stable";
  const waistScore = waistTrend === "falling" ? 1.0 : waistTrend === "stable" ? 0.7 : 0.2;
  weights.push([waistScore * 0.14, 0.14]);
  if (waistScore > 0.7) signals.push("Waist stable or declining — fat routing");

  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return { score: weights.reduce((s, [e]) => s + e, 0) / maxPossible, signals: signals.slice(0, 3) };
}

function scoreResensitization(avg: Record<string, number | undefined>, trends: Record<string, "rising" | "falling" | "stable">, ratios: ReturnType<typeof sleepRatios>): { score: number; signals: string[] } {
  const signals: string[] = [];
  const weights: [number, number][] = [];

  // HRV declining = CNS needs restoration
  const hrvTrendScore = trendScore(trends.hrv ?? "stable", "falling");
  weights.push([hrvTrendScore * 0.25, 0.25]);
  if (trends.hrv === "falling") signals.push("HRV declining — CNS requesting restoration");

  // High recovery need
  const rnScore = rangeScore(avg.recoveryNeedScore, 3.0, 5);
  weights.push([rnScore * 0.20, 0.20]);
  if (rnScore > 0.7) signals.push("Recovery need elevated");

  // Physical energy low-moderate
  const peScore = rangeScore(avg.physicalEnergy, 1, 3);
  weights.push([peScore * 0.15, 0.15]);
  if (peScore > 0.7) signals.push("Physical energy low — system in rest mode");

  // Sensory load elevated (system hypersensitive under fatigue)
  const slScore = rangeScore(avg.sensoryLoadBaseline, 3, 5);
  weights.push([slScore * 0.15, 0.15]);
  if (slScore > 0.7) signals.push("Sensory load elevated — nervous system taxed");

  // Deep sleep elevated (body attempting restoration)
  if (avg.deepMin !== undefined) {
    const deepScore = rangeScore(avg.deepMin, 80, 999);
    weights.push([deepScore * 0.15, 0.15]);
    if (avg.deepMin > 80) signals.push("Deep sleep elevated — restoration underway");
  } else {
    weights.push([0.5 * 0.15, 0.15]);
  }

  // RHR elevated
  const rhrTrendScore = trendScore(trends.rhr ?? "stable", "rising");
  weights.push([rhrTrendScore * 0.10, 0.10]);

  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return { score: weights.reduce((s, [e]) => s + e, 0) / maxPossible, signals: signals.slice(0, 3) };
}

function scoreRebound(avg: Record<string, number | undefined>, trends: Record<string, "rising" | "falling" | "stable">, ratios: ReturnType<typeof sleepRatios>): { score: number; signals: string[] } {
  const signals: string[] = [];
  const weights: [number, number][] = [];

  // HRV rising after suppression — THE defining rebound signal
  const hrvRisingScore = trendScore(trends.hrv ?? "stable", "rising");
  weights.push([hrvRisingScore * 0.30, 0.30]);
  if (trends.hrv === "rising") signals.push("HRV rising — supercompensation window open");

  // Physical energy rising
  const peTrendScore = trendScore(trends.physicalEnergy ?? "stable", "rising");
  weights.push([peTrendScore * 0.20, 0.20]);
  if (trends.physicalEnergy === "rising") signals.push("Physical energy recovering upward");

  // Motivation rising
  const motTrendScore = trendScore(trends.motivation ?? "stable", "rising");
  weights.push([motTrendScore * 0.15, 0.15]);
  if (trends.motivation === "rising") signals.push("Motivation returning");

  // Recovery need declining
  const rnTrendScore = trendScore(trends.recoveryNeedScore ?? "stable", "falling");
  weights.push([rnTrendScore * 0.20, 0.20]);
  if (trends.recoveryNeedScore === "falling") signals.push("Recovery need declining — suppression lifting");

  // REM elevated (supercompensation and cognitive consolidation)
  if (ratios.remPct !== undefined) {
    const remScore = rangeScore(ratios.remPct, 22, 40);
    weights.push([remScore * 0.15, 0.15]);
    if (remScore > 0.7) signals.push("REM elevated — consolidation and rebound signature");
  } else {
    weights.push([0.5 * 0.15, 0.15]);
  }

  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return { score: weights.reduce((s, [e]) => s + e, 0) / maxPossible, signals: signals.slice(0, 3) };
}

function scoreExpression(avg: Record<string, number | undefined>, trends: Record<string, "rising" | "falling" | "stable">): { score: number; signals: string[] } {
  const signals: string[] = [];
  const weights: [number, number][] = [];

  // Recovery need low — not depleted, not pushing hard
  const rnScore = rangeScore(avg.recoveryNeedScore, 1, 2.5);
  weights.push([rnScore * 0.20, 0.20]);
  if (rnScore > 0.7) signals.push("Recovery need low — stabilized");

  // All primary signals stable (the defining expression feature is stability)
  const stableSignals = ["hrv", "physicalEnergy", "motivation", "recoveryNeedScore", "rhr"];
  let stableCount = 0;
  for (const sig of stableSignals) {
    if ((trends[sig] ?? "stable") === "stable") stableCount++;
  }
  const stabilityScore = stableCount / stableSignals.length;
  weights.push([stabilityScore * 0.30, 0.30]);
  if (stabilityScore >= 0.6) signals.push(`${stableCount}/${stableSignals.length} signals stable — expression state`);

  // Physical energy moderate (good but not spiking)
  const peScore = rangeScore(avg.physicalEnergy, 3, 4.5);
  weights.push([peScore * 0.15, 0.15]);
  if (peScore > 0.7) signals.push("Physical energy in stable capable range");

  // HRV stable
  const hrvTrendScore = trendScore(trends.hrv ?? "stable", "stable");
  weights.push([hrvTrendScore * 0.20, 0.20]);
  if (trends.hrv === "stable") signals.push("HRV stable");

  // Mental fog low
  const mfScore = rangeScore(avg.mentalFog, 1, 2.5);
  weights.push([mfScore * 0.15, 0.15]);

  const maxPossible = weights.reduce((s, [, max]) => s + max, 0);
  return { score: weights.reduce((s, [e]) => s + e, 0) / maxPossible, signals: signals.slice(0, 3) };
}

// ─── Main inference function ──────────────────────────────────────────────────
export function inferOrbitalPhase(
  indices: DailyIndex[],
  selectedNutritionPhaseId: NutritionPhaseId | null
): OrbitalInference {
  // Use last 7 days from the window (or all if fewer)
  const window = indices.slice(-7);
  const dataPoints = window.length;

  // ── Compute averages and trends ──────────────────────────────────────────
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
    avg[f as string] = windowAvg(window, f);
    trends[f as string] = fieldTrend(window, f);
  }

  const avgDeep   = avg.deepMin;
  const avgRem    = avg.remMin;
  const avgCore   = avg.coreMin;
  const avgAwake  = avg.awakeMin;
  const ratios    = sleepRatios(avgDeep, avgRem, avgCore, avgAwake);

  // ── Score all 8 phases ───────────────────────────────────────────────────
  const scored: { phase: OrbitalPhaseId; result: { score: number; signals: string[] } }[] = [
    { phase: "priming",         result: scorePriming(avg, trends, ratios) },
    { phase: "loading",         result: scoreLoading(avg, trends) },
    { phase: "accumulation",    result: scoreAccumulation(avg, trends, ratios) },
    { phase: "saturation",      result: scoreSaturation(avg, trends, ratios) },
    { phase: "partitioning",    result: scorePartitioning(avg, trends) },
    { phase: "resensitization", result: scoreResensitization(avg, trends, ratios) },
    { phase: "rebound",         result: scoreRebound(avg, trends, ratios) },
    { phase: "expression",      result: scoreExpression(avg, trends) },
  ];

  const likelihoods: OrbitalLikelihood[] = scored
    .map(({ phase, result }) => ({
      orbitalPhaseId: phase,
      label: ORBITAL_LABELS[phase],
      score: Math.round(result.score * 100) / 100,
      keySignals: result.signals,
    }))
    .sort((a, b) => b.score - a.score);

  const topPhase  = likelihoods[0]!.orbitalPhaseId;
  const topScore  = likelihoods[0]!.score;
  const secondPhase = likelihoods[1]?.orbitalPhaseId ?? null;

  const confidence: "low" | "moderate" | "high" =
    dataPoints < 3 ? "low"
    : dataPoints < 6 ? "moderate"
    : "high";

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

  if (translatedOrbitalPhaseId && translatedOrbitalPhaseId !== topPhase && topScore > 0.5) {
    mismatch = true;

    // Severity: strong if the two phases are physiologically opposite; mild otherwise
    const strongOpposites: [OrbitalPhaseId, OrbitalPhaseId][] = [
      ["saturation", "resensitization"],
      ["loading", "resensitization"],
      ["loading", "rebound"],
      ["saturation", "rebound"],
      ["saturation", "deload" as never],
      ["expression", "saturation"],
    ];
    const isStrongOpposite = strongOpposites.some(
      ([a, b]) =>
        (a === translatedOrbitalPhaseId && b === topPhase) ||
        (b === translatedOrbitalPhaseId && a === topPhase)
    );
    mismatchSeverity = isStrongOpposite ? "strong" : "mild";

    const selectedLabel = ORBITAL_LABELS[translatedOrbitalPhaseId];
    const observedLabel = ORBITAL_LABELS[topPhase];

    mismatchTitle = `Nutrition implies ${selectedLabel} — data suggests ${observedLabel}`;
    mismatchDescription =
      mismatchSeverity === "strong"
        ? `Your current nutrition phase is steering the system toward ${selectedLabel}, but signal patterns over the past ${dataPoints} days are consistent with ${observedLabel}. These are physiologically opposed states — continuing the current protocol against this signal pattern may deepen the mismatch.`
        : `Your current nutrition phase is oriented toward ${selectedLabel}, but the observed signal pattern more closely resembles ${observedLabel}. The mismatch is mild — monitor for a few more days, or consider adjusting the protocol if this pattern holds.`;

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
