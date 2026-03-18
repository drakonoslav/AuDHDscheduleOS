// ─── Training Readiness Interpreter ──────────────────────────────────────────
//
// Sits ABOVE the trend engine and BELOW any future exercise-selection engine.
// Does not replace any existing log, score, or trend signal.
// Reads derived scores + quantitative trends + recent training timing context
// and returns one of four training modes.
//
// Philosophy: conservative. Never overcall readiness. When in doubt, route
// toward isolation_stability_favoring, not toward compound performance.
//
// ─────────────────────────────────────────────────────────────────────────────

import type { DailyIndex } from "./trendEngine";
import type { DailyStateSnapshot, TrainingLog } from "@/types";

// ─── Output types ─────────────────────────────────────────────────────────────

export type TrainingMode =
  | "compound_performance_favoring"
  | "hypertrophy_volume_favoring"
  | "isolation_stability_favoring"
  | "recovery_training_favoring";

export interface TrainingReadiness {
  mode: TrainingMode;
  confidence: "low" | "moderate" | "high";
  // Plain-text sentences explaining what drove the result. 2–4 items.
  reasoning: string[];
  // How much input data was available for the decision
  dataQuality: "sparse" | "partial" | "full";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function consecutiveDecline(values: number[]): number {
  if (values.length < 2) return 0;
  let run = 0;
  for (let i = values.length - 1; i > 0; i--) {
    if (values[i]! < values[i - 1]!) run++;
    else break;
  }
  return run;
}

function consecutiveRise(values: number[]): number {
  if (values.length < 2) return 0;
  let run = 0;
  for (let i = values.length - 1; i > 0; i--) {
    if (values[i]! > values[i - 1]!) run++;
    else break;
  }
  return run;
}

function trendOf(values: number[]): "rising" | "falling" | "stable" {
  if (values.length < 2) return "stable";
  const delta = values[values.length - 1]! - values[0]!;
  if (Math.abs(delta) < 0.15) return "stable";
  return delta > 0 ? "rising" : "falling";
}

// ─── Main interpreter ─────────────────────────────────────────────────────────

export function interpretTrainingReadiness(
  snapshot: DailyStateSnapshot | undefined,
  indices: DailyIndex[],               // ordered oldest→newest
  recentTraining: TrainingLog[]        // last ~14 days
): TrainingReadiness {

  // ── Data quality assessment ────────────────────────────────────────────────
  const hasSnapshot = snapshot !== undefined;
  const latestQuant = [...indices].reverse().find(
    (d) => d.hrv !== undefined || d.rhr !== undefined || d.deepSleepMin !== undefined
  );
  const hasQuant = latestQuant !== undefined;
  const hasTrend = indices.length >= 3;

  let dataQuality: TrainingReadiness["dataQuality"] = "sparse";
  if (hasSnapshot && hasQuant && hasTrend) dataQuality = "full";
  else if (hasSnapshot || (hasQuant && hasTrend)) dataQuality = "partial";

  // ── Confidence ────────────────────────────────────────────────────────────
  let confidence: TrainingReadiness["confidence"] = "low";
  if (dataQuality === "full") confidence = "high";
  else if (dataQuality === "partial") confidence = "moderate";

  // ── Extract trend arrays ──────────────────────────────────────────────────
  const hrvSeries = indices.filter((d) => d.hrv !== undefined).map((d) => d.hrv!);
  const rhrSeries = indices.filter((d) => d.rhr !== undefined).map((d) => d.rhr!);
  const recovSeries = indices.filter((d) => d.recoveryNeedScore !== undefined).map((d) => d.recoveryNeedScore!);
  const deepSeries = indices.filter((d) => d.deepSleepMin !== undefined).map((d) => d.deepSleepMin!);

  const hrvDeclineRun = consecutiveDecline(hrvSeries);
  const rhrRiseRun = consecutiveRise(rhrSeries);
  const recovRiseRun = consecutiveRise(recovSeries);
  const hrvTrend = trendOf(hrvSeries);
  const rhrTrend = trendOf(rhrSeries);
  const recovTrend = trendOf(recovSeries);

  // Recent training context
  const recentLiftLogs = recentTraining
    .filter((l) => l.type === "lift")
    .slice(-5);
  const lateLiftHighImpact = recentLiftLogs.filter((l) => {
    const [h] = (l.actualTime ?? l.plannedTime).split(":").map(Number);
    return (h ?? 0) >= 19 && (l.bedtimeImpact ?? 0) >= 4;
  }).length;
  const recentHighBedtimeImpact = lateLiftHighImpact >= 2;

  // Today's snapshot fields (safe defaults if absent)
  const recoveryNeed   = snapshot?.recoveryNeedScore ?? (recovSeries.length > 0 ? recovSeries[recovSeries.length - 1]! : undefined);
  const physEnergy     = snapshot?.physicalEnergy;
  const mentalFog      = snapshot?.mentalFog;
  const motivation     = snapshot?.motivation;
  const sensoryLoad    = snapshot?.sensoryLoadBaseline;
  const sleepQuality   = snapshot?.sleepQuality;
  const sleepHours     = snapshot?.sleepHours;
  const emotStability  = snapshot?.emotionalStability;

  const reasoning: string[] = [];

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1 — Recovery check (any one strong signal = recovery mode)
  // ──────────────────────────────────────────────────────────────────────────

  const recoverySignals: string[] = [];

  if (recoveryNeed !== undefined && recoveryNeed >= 3.5) {
    recoverySignals.push(`Recovery need is high (${recoveryNeed.toFixed(1)}/5).`);
  }
  if (physEnergy !== undefined && physEnergy <= 1.5) {
    recoverySignals.push("Physical energy is very low.");
  }
  if (sleepQuality !== undefined && sleepHours !== undefined && sleepQuality <= 1.5 && sleepHours < 6) {
    recoverySignals.push(`Sleep was poor — ${sleepHours}h at quality ${sleepQuality}/5.`);
  }
  if (hrvDeclineRun >= 3) {
    recoverySignals.push(`HRV has declined for ${hrvDeclineRun} consecutive logged days.`);
  }
  if (rhrRiseRun >= 3) {
    recoverySignals.push(`Resting heart rate has risen for ${rhrRiseRun} consecutive logged days.`);
  }
  if (recovRiseRun >= 4) {
    recoverySignals.push("Subjective recovery need has been rising for multiple days.");
  }
  if (deepSeries.length >= 3) {
    const avgDeep = deepSeries.slice(-3).reduce((a, b) => a + b, 0) / 3;
    if (avgDeep < 45) {
      recoverySignals.push(`Average deep sleep over the last 3 logged nights was ${Math.round(avgDeep)} min — below restorative threshold.`);
    }
  }

  if (recoverySignals.length >= 1) {
    reasoning.push(...recoverySignals.slice(0, 3));
    reasoning.push("Recovery training is the appropriate stimulus. Productive output is still possible — nervous system and joints stay engaged without compounding strain.");
    return { mode: "recovery_training_favoring", confidence, reasoning, dataQuality };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2 — Compound performance check (ALL must pass, strict thresholds)
  // ──────────────────────────────────────────────────────────────────────────

  const compoundGates: { pass: boolean; note: string }[] = [
    {
      pass: recoveryNeed === undefined || recoveryNeed <= 2.0,
      note: `Recovery need is ${recoveryNeed !== undefined ? recoveryNeed.toFixed(1) : "unknown"}/5 — threshold for compounds is ≤2.0.`,
    },
    {
      pass: physEnergy === undefined || physEnergy >= 4,
      note: `Physical energy is ${physEnergy !== undefined ? physEnergy : "unknown"}/5 — compounds require ≥4.`,
    },
    {
      pass: mentalFog === undefined || mentalFog <= 2,
      note: `Mental clarity is ${mentalFog !== undefined ? mentalFog : "unknown"}/5 fog — compounds require fog ≤2.`,
    },
    {
      pass: sensoryLoad === undefined || sensoryLoad <= 2,
      note: `Sensory load is ${sensoryLoad !== undefined ? sensoryLoad : "unknown"}/5 — high sensory cost impairs compound coordination.`,
    },
    {
      pass: emotStability === undefined || emotStability >= 3,
      note: "Emotional instability compromises compound execution confidence.",
    },
    {
      pass: hrvTrend !== "falling" || hrvSeries.length < 2,
      note: "HRV is in a declining trend — compounds are not well supported.",
    },
    {
      pass: !recentHighBedtimeImpact,
      note: "Recent late-lifting sessions have been disrupting sleep — adding compound load risks compounding that.",
    },
  ];

  const failedGates = compoundGates.filter((g) => !g.pass);
  const allCompoundGatesPass = failedGates.length === 0;

  if (allCompoundGatesPass && hasSnapshot) {
    reasoning.push("Recovery need, physical energy, and mental clarity are all within compound-performance thresholds.");
    if (hrvSeries.length > 0 || hrvTrend !== "falling") {
      reasoning.push("HRV is not in a declining trend — CNS readiness appears adequate.");
    }
    reasoning.push("All compound performance gates pass. This is an appropriate day for tension-heavy compound work.");
    return { mode: "compound_performance_favoring", confidence, reasoning, dataQuality };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 3 — Hypertrophy volume check (permissive but not absent)
  // ──────────────────────────────────────────────────────────────────────────

  const hypertrophyGates: { pass: boolean }[] = [
    { pass: recoveryNeed === undefined || recoveryNeed < 3.0 },
    { pass: physEnergy === undefined || physEnergy >= 3 },
    { pass: motivation === undefined || motivation >= 3 },
    { pass: sensoryLoad === undefined || sensoryLoad <= 3 },
    { pass: hrvDeclineRun < 3 }, // no sustained HRV collapse
  ];

  const failedHypertrophyGates = hypertrophyGates.filter((g) => !g.pass).length;

  const hypertrophyPass = failedHypertrophyGates <= 1;

  if (hypertrophyPass) {
    // Build reasoning from what's actually driving the result
    if (physEnergy !== undefined && physEnergy >= 3) {
      reasoning.push(`Physical energy (${physEnergy}/5) is sufficient for productive training volume.`);
    }
    if (motivation !== undefined && motivation >= 3) {
      reasoning.push(`Motivation (${motivation}/5) supports executing training without high friction.`);
    }
    if (recoveryNeed !== undefined) {
      reasoning.push(`Recovery need (${recoveryNeed.toFixed(1)}/5) is within hypertrophy-compatible range.`);
    }
    if (failedGates.length > 0) {
      reasoning.push(`${failedGates[0]!.note} Hypertrophy volume work is the more appropriate load today.`);
    } else {
      reasoning.push("Conditions do not meet the strict threshold for compound performance but are well above recovery. Hypertrophy-volume work is appropriate.");
    }
    return { mode: "hypertrophy_volume_favoring", confidence, reasoning, dataQuality };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 4 — Default: isolation & stability
  // ──────────────────────────────────────────────────────────────────────────

  // Explain what's keeping the day from being promoted
  if (sensoryLoad !== undefined && sensoryLoad >= 3) {
    reasoning.push(`Sensory load is elevated (${sensoryLoad}/5) — compound or high-volume work adds cognitive and coordination cost on high-load days.`);
  }
  if (mentalFog !== undefined && mentalFog >= 3) {
    reasoning.push(`Mental clarity is reduced (fog ${mentalFog}/5) — isolation work reduces execution complexity and injury risk.`);
  }
  if (physEnergy !== undefined && physEnergy < 3) {
    reasoning.push(`Physical energy is below mid-range (${physEnergy}/5) — full volume is not well-supported.`);
  }
  if (hrvTrend === "falling") {
    reasoning.push("HRV trend is declining — CNS sharpness is not at peak.");
  }
  if (reasoning.length === 0) {
    reasoning.push("Readiness signals are mixed or sparse. Conservative routing is applied.");
  }
  reasoning.push("Isolation and stability-focused work produces meaningful muscle stimulus without demanding top-end sharpness. A productive and appropriate choice.");

  return { mode: "isolation_stability_favoring", confidence, reasoning, dataQuality };
}

// ─── Display helpers (used by UI layer) ───────────────────────────────────────

export const TRAINING_MODE_DISPLAY: Record<
  TrainingMode,
  { label: string; shortLabel: string; color: string; description: string }
> = {
  compound_performance_favoring: {
    label: "Compound Performance",
    shortLabel: "Compound",
    color: "#2C6BAD",   // navyDark-adjacent — peak readiness
    description: "CNS and subjective state support high-tension compound work.",
  },
  hypertrophy_volume_favoring: {
    label: "Hypertrophy Volume",
    shortLabel: "Hypertrophy",
    color: "#3D7A5A",   // structuring green — productive growth
    description: "Good conditions for volume-driven hypertrophy stimulus.",
  },
  isolation_stability_favoring: {
    label: "Isolation & Stability",
    shortLabel: "Isolation",
    color: "#C07A2A",   // amber — cautious but productive
    description: "Reduced sharpness or load. Isolation work produces quality stimulus without peak demands.",
  },
  recovery_training_favoring: {
    label: "Recovery Training",
    shortLabel: "Recovery",
    color: "#B85450",   // rose — protect and restore
    description: "Cumulative strain or poor readiness detected. Keep training light and purposeful.",
  },
};
