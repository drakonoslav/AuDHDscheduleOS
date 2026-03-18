import type { DailyStateSnapshot, QuantitativeDailyLog } from "@/types";

// ─── DailyIndex ───────────────────────────────────────────────────────────────
// One record per day — the unified backbone joining qualitative + quantitative.
// Kept separate; never merged into a single score.
export interface DailyIndex {
  date: string;
  // From qualitative log (derived scores)
  recoveryNeedScore?: number;  // 1–5
  adhdPullScore?: number;      // 1–5
  autismPullScore?: number;    // 1–5
  // From quantitative log (device data)
  hrv?: number;                // ms
  rhr?: number;                // bpm
  deepSleepMin?: number;       // minutes
}

// ─── TrendSignal ──────────────────────────────────────────────────────────────
export type SignalKey =
  | "recoveryNeedScore"
  | "adhdPullScore"
  | "autismPullScore"
  | "hrv"
  | "rhr"
  | "deepSleepMin";

export interface TrendPoint {
  date: string;
  value: number;
}

export interface TrendSignal {
  key: SignalKey;
  label: string;
  unit: string;
  // higher = worse for this signal? used for delta color logic
  higherIsWorse: boolean;
  points: TrendPoint[];          // sparse — only days where data exists
  confidence: "high" | "low";   // high = ≥5 points
  latestValue?: number;
  delta?: number;                // latest − earliest in window (undefined if <2 pts)
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
      recoveryNeedScore: snap?.recoveryNeedScore,
      adhdPullScore: snap?.adhdPullScore,
      autismPullScore: snap?.autismPullScore,
      hrv: quant?.hrv,
      rhr: quant?.rhr,
      deepSleepMin: quant?.deepMin,
    });
  }

  return indices;
}

// ─── Build trend signals ──────────────────────────────────────────────────────
const SIGNAL_DEFS: {
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
  { key: "deepSleepMin",      label: "Deep Sleep",     unit: "min", higherIsWorse: false },
];

export function buildTrendSignals(indices: DailyIndex[]): TrendSignal[] {
  return SIGNAL_DEFS.map(({ key, label, unit, higherIsWorse }) => {
    const points: TrendPoint[] = indices
      .filter((d) => d[key] !== undefined)
      .map((d) => ({ date: d.date, value: d[key] as number }));

    const latestValue = points.length > 0 ? points[points.length - 1]!.value : undefined;
    const delta =
      points.length >= 2
        ? (points[points.length - 1]!.value - points[0]!.value)
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

  // ── Alignment: body + self-report agree that strain is accumulating
  if (
    recovPts.length >= 3 && hrvPts.length >= 3 &&
    recovDir === "up" && hrvDir === "down"
  ) {
    interps.push({
      type: "alignment",
      title: "Signals agree: strain is accumulating",
      description:
        "Subjective recovery need is rising and HRV is declining in the same window. Body and self-report are in agreement — high confidence that cumulative stress is building.",
    });
  }

  // ── Alignment: recovery demand + RHR both rising
  if (
    recovPts.length >= 3 && rhrPts.length >= 3 &&
    recovDir === "up" && rhrDir === "up"
  ) {
    interps.push({
      type: "alignment",
      title: "Signals agree: nervous system under load",
      description:
        "Both subjective recovery need and resting heart rate are rising together. CNS load is being confirmed by two independent signals.",
    });
  }

  // ── Mismatch: feel fine but HRV dropping
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

  // ── Mismatch: high recovery need but HRV stable or rising (stress is psychological, not physiological)
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

  // ── Drift: HRV declining for 3+ consecutive logged days
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

  // ── Drift: recovery need rising 3+ consecutive logged days
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
