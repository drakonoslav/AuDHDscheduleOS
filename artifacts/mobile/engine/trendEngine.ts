import type { NutritionPhaseId, DailyStateSnapshot, QuantitativeDailyLog } from "@/types";

// ─── DailyIndex ───────────────────────────────────────────────────────────────
// One record per day — the unified backbone joining qualitative + quantitative.
// Three layers are kept explicitly separate; never merged into a single score.
export interface DailyIndex {
  date: string;

  // ── From qualitative log — raw entry fields ───────────────────────────────
  sleepHours?: number;
  sleepQuality?: number;          // 1–5
  physicalEnergy?: number;        // 1–5
  motivation?: number;            // 1–5
  mentalFog?: number;             // 1–5 (1=clear, 5=very foggy)
  emotionalStability?: number;    // 1–5
  noveltyHunger?: number;         // 1–5
  structureHunger?: number;       // 1–5
  pressureSeek?: number;          // 1–5
  sensoryLoadBaseline?: number;   // 1–5
  socialLoad?: number;            // 1–5
  noiseAversion?: number;         // 1–5
  lightAversion?: number;         // 1–5
  textureSensitivity?: number;    // 1–5
  nutritionPhaseId?: NutritionPhaseId;

  // ── From qualitative log — derived composite scores ───────────────────────
  recoveryNeedScore?: number;     // 1–5
  adhdPullScore?: number;         // 1–5
  autismPullScore?: number;       // 1–5

  // ── From quantitative log — sleep stages ──────────────────────────────────
  awakeMin?: number;
  remMin?: number;
  coreMin?: number;
  deepMin?: number;               // deep sleep minutes

  // ── From quantitative log — vitals ───────────────────────────────────────
  hrv?: number;                   // ms
  rhr?: number;                   // bpm

  // ── From quantitative log — body composition ─────────────────────────────
  weightLbs?: number;
  bodyFatPct?: number;
  skeletalMusclePct?: number;
  fatFreeMassLbs?: number;
  waistIn?: number;

  // ── From quantitative log — hormone signal ───────────────────────────────
  hormoneDurationMin?: number;
  hormoneQuantCount?: number;
  hormoneQualCount?: number;
}

// ─── TrendSignal ──────────────────────────────────────────────────────────────
export type SignalKey =
  | "recoveryNeedScore"
  | "adhdPullScore"
  | "autismPullScore"
  | "hrv"
  | "rhr"
  | "deepMin"
  | "physicalEnergy"
  | "motivation"
  | "mentalFog"
  | "emotionalStability"
  | "sleepHours"
  | "sleepQuality"
  | "noveltyHunger"
  | "structureHunger"
  | "sensoryLoadBaseline"
  | "remMin"
  | "coreMin"
  | "awakeMin"
  | "weightLbs"
  | "bodyFatPct"
  | "fatFreeMassLbs"
  | "waistIn"
  | "hormoneDurationMin"
  | "hormoneQuantCount";

export interface TrendPoint {
  date: string;
  value: number;
}

export interface TrendSignal {
  key: SignalKey;
  label: string;
  unit: string;
  higherIsWorse: boolean;
  points: TrendPoint[];
  confidence: "high" | "low";
  latestValue?: number;
  delta?: number;
}

// ─── Cross-layer interpretation ───────────────────────────────────────────────
export type InterpretationType = "alignment" | "mismatch" | "drift";

export interface CrossLayerInterpretation {
  type: InterpretationType;
  title: string;
  description: string;
}

// ─── Build daily index ────────────────────────────────────────────────────────
export function buildDailyIndices(
  snapshots: DailyStateSnapshot[],
  quantLogs: QuantitativeDailyLog[],
  windowDays: number = 14
): DailyIndex[] {
  const indices: DailyIndex[] = [];
  const today = new Date();

  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0]!;

    const snap = snapshots.find((s) => s.date === dateStr);
    const quant = quantLogs.find((q) => q.date === dateStr);

    if (!snap && !quant) continue;

    indices.push({
      date: dateStr,
      // ── Qualitative raw fields
      sleepHours:           snap?.sleepHours,
      sleepQuality:         snap?.sleepQuality,
      physicalEnergy:       snap?.physicalEnergy,
      motivation:           snap?.motivation,
      mentalFog:            snap?.mentalFog,
      emotionalStability:   snap?.emotionalStability,
      noveltyHunger:        snap?.noveltyHunger,
      structureHunger:      snap?.structureHunger,
      pressureSeek:         snap?.pressureSeek,
      sensoryLoadBaseline:  snap?.sensoryLoadBaseline,
      socialLoad:           snap?.socialLoad,
      noiseAversion:        snap?.noiseAversion,
      lightAversion:        snap?.lightAversion,
      textureSensitivity:   snap?.textureSensitivity,
      nutritionPhaseId:     snap?.nutritionPhaseId,
      // ── Qualitative derived
      recoveryNeedScore:    snap?.recoveryNeedScore,
      adhdPullScore:        snap?.adhdPullScore,
      autismPullScore:      snap?.autismPullScore,
      // ── Quantitative sleep stages
      awakeMin:             quant?.awakeMin,
      remMin:               quant?.remMin,
      coreMin:              quant?.coreMin,
      deepMin:              quant?.deepMin,
      // ── Quantitative vitals
      hrv:                  quant?.hrv,
      rhr:                  quant?.rhr,
      // ── Quantitative body composition
      weightLbs:            quant?.weightLbs,
      bodyFatPct:           quant?.bodyFatPct,
      skeletalMusclePct:    quant?.skeletalMusclePct,
      fatFreeMassLbs:       quant?.fatFreeMassLbs,
      waistIn:              quant?.waistIn,
      // ── Quantitative hormone signal
      hormoneDurationMin:   quant?.hormoneDurationMin,
      hormoneQuantCount:    quant?.hormoneQuantCount,
      hormoneQualCount:     quant?.hormoneQualCount,
    });
  }

  return indices;
}

// ─── Signal definitions ───────────────────────────────────────────────────────
// Six legacy signals shown in the primary Trends grid (unchanged from v1)
const PRIMARY_SIGNAL_DEFS: {
  key: SignalKey;
  label: string;
  unit: string;
  higherIsWorse: boolean;
}[] = [
  { key: "recoveryNeedScore", label: "Recovery Need",  unit: "/5",  higherIsWorse: true  },
  { key: "adhdPullScore",     label: "ADHD Pull",      unit: "/5",  higherIsWorse: false },
  { key: "autismPullScore",   label: "Autism Pull",    unit: "/5",  higherIsWorse: false },
  { key: "hrv",               label: "HRV",            unit: "ms",  higherIsWorse: false },
  { key: "rhr",               label: "Resting HR",     unit: "bpm", higherIsWorse: true  },
  { key: "deepMin",           label: "Deep Sleep",     unit: "min", higherIsWorse: false },
];

// Extended raw signals — used by orbital inference and shown in raw signal explorer
export const ALL_SIGNAL_DEFS: {
  key: SignalKey;
  label: string;
  unit: string;
  higherIsWorse: boolean;
  group: "qualitative" | "sleep" | "vitals" | "body" | "hormone";
}[] = [
  // Qualitative
  { key: "physicalEnergy",    label: "Physical Energy",   unit: "/5",  higherIsWorse: false, group: "qualitative" },
  { key: "motivation",        label: "Motivation",        unit: "/5",  higherIsWorse: false, group: "qualitative" },
  { key: "mentalFog",         label: "Mental Fog",        unit: "/5",  higherIsWorse: true,  group: "qualitative" },
  { key: "emotionalStability",label: "Emotional Stability",unit:"/5", higherIsWorse: false, group: "qualitative" },
  { key: "sleepHours",        label: "Sleep Duration",    unit: "h",   higherIsWorse: false, group: "qualitative" },
  { key: "sleepQuality",      label: "Sleep Quality",     unit: "/5",  higherIsWorse: false, group: "qualitative" },
  { key: "noveltyHunger",     label: "Novelty Hunger",    unit: "/5",  higherIsWorse: false, group: "qualitative" },
  { key: "structureHunger",   label: "Structure Hunger",  unit: "/5",  higherIsWorse: false, group: "qualitative" },
  { key: "sensoryLoadBaseline",label:"Sensory Load",      unit: "/5",  higherIsWorse: true,  group: "qualitative" },
  { key: "recoveryNeedScore", label: "Recovery Need",     unit: "/5",  higherIsWorse: true,  group: "qualitative" },
  { key: "adhdPullScore",     label: "ADHD Pull",         unit: "/5",  higherIsWorse: false, group: "qualitative" },
  { key: "autismPullScore",   label: "Autism Pull",       unit: "/5",  higherIsWorse: false, group: "qualitative" },
  // Sleep stages
  { key: "awakeMin",          label: "Awake",             unit: "min", higherIsWorse: true,  group: "sleep" },
  { key: "remMin",            label: "REM",               unit: "min", higherIsWorse: false, group: "sleep" },
  { key: "coreMin",           label: "Core Sleep",        unit: "min", higherIsWorse: false, group: "sleep" },
  { key: "deepMin",           label: "Deep Sleep",        unit: "min", higherIsWorse: false, group: "sleep" },
  // Vitals
  { key: "hrv",               label: "HRV",               unit: "ms",  higherIsWorse: false, group: "vitals" },
  { key: "rhr",               label: "Resting HR",        unit: "bpm", higherIsWorse: true,  group: "vitals" },
  // Body composition
  { key: "weightLbs",         label: "Body Weight",       unit: "lbs", higherIsWorse: false, group: "body" },
  { key: "bodyFatPct",        label: "Body Fat",          unit: "%",   higherIsWorse: false, group: "body" },
  { key: "fatFreeMassLbs",    label: "Fat-Free Mass",     unit: "lbs", higherIsWorse: false, group: "body" },
  { key: "waistIn",           label: "Waist",             unit: "in",  higherIsWorse: false, group: "body" },
  // Hormone
  { key: "hormoneDurationMin",label: "Hormone Duration",  unit: "min", higherIsWorse: false, group: "hormone" },
  { key: "hormoneQuantCount", label: "Hormone Count",     unit: "",    higherIsWorse: false, group: "hormone" },
];

function buildSignals(
  defs: { key: SignalKey; label: string; unit: string; higherIsWorse: boolean }[],
  indices: DailyIndex[]
): TrendSignal[] {
  return defs.map(({ key, label, unit, higherIsWorse }) => {
    const points: TrendPoint[] = indices
      .filter((d) => d[key] !== undefined)
      .map((d) => ({ date: d.date, value: d[key] as number }));

    const latestValue = points.length > 0 ? points[points.length - 1]!.value : undefined;
    const delta =
      points.length >= 2
        ? points[points.length - 1]!.value - points[0]!.value
        : undefined;

    return {
      key,
      label,
      unit,
      higherIsWorse,
      points,
      confidence: points.length >= 5 ? "high" : "low",
      latestValue,
      delta,
    };
  });
}

// Primary Trends grid (6 composite + HRV/RHR signals)
export function buildTrendSignals(indices: DailyIndex[]): TrendSignal[] {
  return buildSignals(PRIMARY_SIGNAL_DEFS, indices);
}

// All raw signals for orbital inference + extended explorer
export function buildAllSignals(indices: DailyIndex[]): TrendSignal[] {
  return buildSignals(ALL_SIGNAL_DEFS, indices);
}

// ─── Cross-layer pattern detection ───────────────────────────────────────────
function trendDir(values: number[]): "up" | "down" | "flat" {
  if (values.length < 2) return "flat";
  const delta = values[values.length - 1]! - values[0]!;
  if (Math.abs(delta) < 0.2) return "flat";
  return delta > 0 ? "up" : "down";
}

function consecutiveRun(values: number[], direction: "up" | "down"): number {
  let run = 0;
  for (let i = values.length - 1; i > 0; i--) {
    const moved = direction === "up"
      ? values[i]! > values[i - 1]!
      : values[i]! < values[i - 1]!;
    if (moved) run++;
    else break;
  }
  return run;
}

export function detectInterpretations(
  indices: DailyIndex[]
): CrossLayerInterpretation[] {
  const interps: CrossLayerInterpretation[] = [];
  if (indices.length < 3) return interps;

  const recovPts = indices.filter((d) => d.recoveryNeedScore !== undefined).map((d) => d.recoveryNeedScore!);
  const hrvPts   = indices.filter((d) => d.hrv !== undefined).map((d) => d.hrv!);
  const rhrPts   = indices.filter((d) => d.rhr !== undefined).map((d) => d.rhr!);

  const recovDir = trendDir(recovPts);
  const hrvDir   = trendDir(hrvPts);
  const rhrDir   = trendDir(rhrPts);

  if (recovPts.length >= 3 && hrvPts.length >= 3 && recovDir === "up" && hrvDir === "down") {
    interps.push({
      type: "alignment",
      title: "Signals agree: strain is accumulating",
      description:
        "Subjective recovery need is rising and HRV is declining in the same window. Body and self-report are in agreement — high confidence that cumulative stress is building.",
    });
  }

  if (recovPts.length >= 3 && rhrPts.length >= 3 && recovDir === "up" && rhrDir === "up") {
    interps.push({
      type: "alignment",
      title: "Signals agree: nervous system under load",
      description:
        "Both subjective recovery need and resting heart rate are rising together. CNS load is being confirmed by two independent signals.",
    });
  }

  if (
    recovPts.length >= 2 && hrvPts.length >= 3 &&
    recovDir !== "up" &&
    recovPts[recovPts.length - 1]! < 2.5 &&
    hrvDir === "down"
  ) {
    interps.push({
      type: "mismatch",
      title: "Hidden fatigue signal",
      description:
        "Subjective recovery need is low — you feel fine — but HRV has been declining. The body is under more strain than it currently feels like. Worth watching before adding training load.",
    });
  }

  if (
    recovPts.length >= 2 && hrvPts.length >= 2 &&
    recovDir === "up" &&
    recovPts[recovPts.length - 1]! >= 3.5 &&
    hrvDir !== "down"
  ) {
    interps.push({
      type: "mismatch",
      title: "Subjective load not reflected in HRV",
      description:
        "Recovery need is elevated but HRV is holding steady or improving. The fatigue signal may be primarily cognitive or emotional rather than physiological.",
    });
  }

  if (hrvPts.length >= 4) {
    const run = consecutiveRun(hrvPts, "down");
    if (run >= 3) {
      interps.push({
        type: "drift",
        title: `HRV declining ${run} consecutive days`,
        description:
          "A sustained HRV decline without a corresponding recovery window is the clearest leading indicator of accumulated physiological stress. A deload or sleep priority intervention is worth considering.",
      });
    }
  }

  if (recovPts.length >= 4) {
    const run = consecutiveRun(recovPts, "up");
    if (run >= 3) {
      interps.push({
        type: "drift",
        title: `Recovery need rising ${run} consecutive days`,
        description:
          "Subjective recovery need has risen for multiple consecutive days. Long-term strain accumulation is compounding — the schedule may be asking more than the current state can support.",
      });
    }
  }

  return interps;
}
