import type { AppState, WeeklyRecommendation } from "@/types";

function weekStart(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0]!;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

// ─── Conservative recommendation engine ──────────────────────────────────────
// Philosophy:
// - Pattern-backed suggestions only (need ≥3 data points)
// - Small timing shifts, not full reschedules
// - Distinguish discipline failure from state/schedule mismatch
// - Protect recovery before adding optimization
export function generateRecommendations(state: AppState): WeeklyRecommendation[] {
  const today = todayStr();
  const ws = weekStart(today);
  const recs: WeeklyRecommendation[] = [];
  let idCounter = 1;

  const recentBlocks = state.blocks.filter((b) => {
    const d = new Date(b.date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    return d >= cutoff;
  });

  const recentSnapshots = state.snapshots.filter((s) => {
    const d = new Date(s.date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    return d >= cutoff;
  });

  // Keep existing dismissed recommendations
  const dismissed = new Set(
    state.recommendations.filter((r) => r.dismissed).map((r) => r.id)
  );

  function makeRec(
    partial: Omit<WeeklyRecommendation, "id" | "weekStart" | "dismissed">
  ): WeeklyRecommendation {
    return {
      ...partial,
      id: `rec_${ws}_${idCounter++}`,
      weekStart: ws,
      dismissed: dismissed.has(`rec_${ws}_${idCounter - 1}`),
    };
  }

  // ─── Rule 1: High-resistance blocks consistently appearing ──────────────────
  const highResistanceBlocks = recentBlocks.filter(
    (b) => (b.ratings?.resistance ?? 0) >= 4
  );
  const blockTypeCounts: Record<string, number> = {};
  for (const b of highResistanceBlocks) {
    blockTypeCounts[b.blockType] = (blockTypeCounts[b.blockType] ?? 0) + 1;
  }
  for (const [type, count] of Object.entries(blockTypeCounts)) {
    if (count >= 3) {
      recs.push(
        makeRec({
          type: "timing_shift",
          confidence: "pattern_backed",
          title: `${type.charAt(0).toUpperCase() + type.slice(1)} blocks have high resistance`,
          body: `Your ${type} blocks have shown high resistance ${count} times in the last 2 weeks. This may reflect wrong timing for your neuro-state — not discipline failure.`,
          actionable: `Try shifting your ${type} block 30–60 min earlier or later and observe whether resistance changes.`,
        })
      );
    }
  }

  // ─── Rule 2: Low sleep + high block count → suggest fewer blocks ────────────
  const lowSleepDays = recentSnapshots.filter(
    (s) => s.sleepHours < 6.5 || s.sleepQuality <= 2
  );
  if (lowSleepDays.length >= 3) {
    recs.push(
      makeRec({
        type: "fewer_blocks",
        confidence: "pattern_backed",
        title: "Reduce block load on poor sleep days",
        body: `You've had ${lowSleepDays.length} low-sleep days recently. On these days, a full schedule increases overload risk without improving output.`,
        actionable: "On days with sleep quality ≤2 or <6.5h, remove 1–2 optional blocks and protect recovery time.",
      })
    );
  }

  // ─── Rule 3: High sensory load days → environment suggestion ───────────────
  const highSensoryDays = recentSnapshots.filter(
    (s) => s.sensoryLoadBaseline >= 4 || s.noiseAversion >= 4
  );
  if (highSensoryDays.length >= 3) {
    recs.push(
      makeRec({
        type: "environment",
        confidence: "pattern_backed",
        title: "Protect sensory environment on high-load days",
        body: `High sensory load appeared ${highSensoryDays.length} times recently. Errands and public-facing blocks on these days raise overload risk.`,
        actionable: "Schedule errands in early-morning low-crowd windows. Add a recovery block after any public exposure.",
      })
    );
  }

  // ─── Rule 4: Recovery mode days but expansion-type blocks ──────────────────
  const mismatchedDays = recentBlocks.filter((b) => {
    const snap = state.snapshots.find((s) => s.date === b.date);
    return (
      snap?.recommendedDayMode === "recovery_favoring" &&
      b.phaseTag === "expansion" &&
      (b.ratings?.overload ?? 0) >= 4
    );
  });
  if (mismatchedDays.length >= 2) {
    recs.push(
      makeRec({
        type: "timing_shift",
        confidence: "pattern_backed",
        title: "Expansion blocks on recovery days cause overload",
        body: `Expansion-tagged blocks on recovery-favoring days led to overload ${mismatchedDays.length} times recently. This is a state-schedule mismatch, not a motivation issue.`,
        actionable: "On recovery days, replace expansion blocks with structuring or rest blocks. Reserve novelty for higher-state days.",
      })
    );
  }

  // ─── Rule 5: Lift timing and bedtime impact ─────────────────────────────────
  const lateLiftDays = state.trainingLogs.filter((l) => {
    if (l.type !== "lift") return false;
    const time = l.actualTime ?? l.plannedTime;
    const [h] = time.split(":").map(Number);
    return (h ?? 0) >= 19 && (l.bedtimeImpact ?? 0) >= 4;
  });
  if (lateLiftDays.length >= 2) {
    recs.push(
      makeRec({
        type: "training_placement",
        confidence: "pattern_backed",
        title: "Late lifting disrupts bedtime",
        body: `Lifting after 7pm has correlated with high bedtime impact ${lateLiftDays.length} times. Late CNS stimulation may be pushing your sleep window.`,
        actionable: "Try moving lift sessions to before 6pm. If evening is the only option, reduce intensity on those days.",
      })
    );
  }

  // ─── Rule 6: Pre-lift meal timing ──────────────────────────────────────────
  const poorPreLiftTiming = state.trainingLogs.filter(
    (l) =>
      l.type === "lift" &&
      l.preLiftMealTiming !== undefined &&
      (l.preLiftMealTiming < 30 || l.preLiftMealTiming > 120) &&
      (l.motivationBefore ?? 5) <= 3
  );
  if (poorPreLiftTiming.length >= 2) {
    recs.push(
      makeRec({
        type: "meal_timing",
        confidence: "emerging",
        title: "Pre-lift meal timing may be off",
        body: `Your pre-lift meals have fallen outside the 30–90 min window on ${poorPreLiftTiming.length} occasions alongside low motivation before lifting.`,
        actionable: "Aim for pre-lift carbs 45–60 min before your session. Dextrin + Whey 45 min prior is your current template.",
      })
    );
  }

  // ─── If no data yet, return a welcoming non-prescriptive note ───────────────
  if (recs.length === 0 && recentBlocks.length < 3) {
    recs.push(
      makeRec({
        type: "timing_shift",
        confidence: "speculative",
        title: "Keep logging to unlock insights",
        body: "Recommendations appear once there are enough logged days to identify real patterns. Aim for 3+ days of block logging.",
        actionable: "Log today's blocks and rate at least a few of them to get started.",
      })
    );
  }

  return recs;
}
