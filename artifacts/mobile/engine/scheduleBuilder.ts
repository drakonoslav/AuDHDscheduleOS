/**
 * scheduleBuilder.ts
 *
 * Deterministic schedule template generator.
 * Same inputs → identical BlockTemplate[] output. No randomness, no Date.now().
 *
 * Anchor placement order (enforced):
 *  1. Wake
 *  2. Morning workout(s)
 *  3. Shower after morning workout
 *  4. Morning commute
 *  5. Work
 *  6. Evening commute
 *  7. Evening / afternoon workout(s)
 *  8. Shower after evening workout
 *  9. Bedtime
 * 10. Meals — fixed anchors first, then flexible gap-filling
 *     Fixed anchors: Pre Cardio (0 min gap), Post Cardio (+5 min), Pre Lift (-45 min),
 *                    Post Lift (+5 min), Evening (2.5 hr before bed)
 *     Protein Reserve: largest daytime gap (≥150 min) → work-window gap → largest gap
 *     MAX_GAP = 180 min. Flexible meals placed at 40% into the largest open gap.
 *     Meals are allowed inside work blocks.
 * 11. Micro-blocks (greedy void fill, ratio-weighted)
 */

import type { BlockTemplate, BlockType, SchedulePhaseTag } from "@/types";

// ─── Config type ──────────────────────────────────────────────────────────────

export interface WizardConfig {
  wakeTime: string;
  bedTime: string;
  mealCount: number;

  hasCardio: boolean;
  cardioPre: boolean;
  cardioPost: boolean;
  cardioMins: number;
  cardioTime: "morning" | "afternoon" | "evening";

  hasLift: boolean;
  liftPre: boolean;
  liftPost: boolean;
  liftMins: number;
  liftTime: "morning" | "afternoon" | "evening";

  hasWork: boolean;
  workDays: number[];
  workStart: string;
  workEnd: string;

  hasCommute: boolean;
  commuteMinutes: number;

  showerCount: number;

  weekdayMicroSize: 3 | 5 | 10 | 15 | 25 | 30;
  weekdayMicroTypes: { type: BlockType; ratio: number }[];

  weekendMicroSize: 3 | 5 | 10 | 15 | 25 | 30;
  weekendMicroTypes: { type: BlockType; ratio: number }[];
}

// ─── Meal gap constants ───────────────────────────────────────────────────────

const MAX_GAP  = 180;  // 3 hours — hard ceiling between any two meals
const IDEAL_GAP = 150; // 2.5 hours — threshold for Protein Reserve placement priority

// Training-adjacent meal timing offsets (minutes)
// Pre Cardio:  meal ends 0 min before cardio start  → start = cardioStart - 10
// Post Cardio: meal starts 5 min after cardio end
// Pre Lift:    meal ends 45 min before lift start (mid of 30–60 window)
// Post Lift:   meal starts 5 min after lift end
const POST_WORKOUT_DELAY = 5;
const PRE_LIFT_END_OFFSET = 45;  // how many minutes before liftStart the meal ends

// ─── Time utilities ───────────────────────────────────────────────────────────

function toMins(hhmm: string): number {
  const parts = hhmm.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

export function fromMins(total: number): string {
  const safe = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface Slot {
  label: string;
  blockType: BlockType;
  phaseTag: SchedulePhaseTag;
  start: number;
  end: number;
}

interface WorkoutPositions {
  cardioStart?: number;
  cardioEnd?: number;
  liftStart?: number;
  liftEnd?: number;
}

interface DayAnchorResult {
  slots: Slot[];
  workouts: WorkoutPositions;
}

// ─── Meal name resolution ─────────────────────────────────────────────────────

const CANONICAL_SLOTS: { name: string; active: (c: WizardConfig) => boolean }[] = [
  { name: "Pre Cardio",      active: (c) => c.hasCardio && c.cardioPre },
  { name: "Post Cardio",     active: (c) => c.hasCardio && c.cardioPost },
  { name: "Mid Morning",     active: () => false },
  { name: "Pre Lift",        active: (c) => c.hasLift && c.liftPre },
  { name: "Post Lift",       active: (c) => c.hasLift && c.liftPost },
  { name: "Evening",         active: () => false },
  { name: "Protein Reserve", active: () => false },
];

function getMealNames(config: WizardConfig): string[] {
  const required = CANONICAL_SLOTS.filter((s) => s.active(config)).map((s) => s.name);
  if (config.mealCount <= required.length) return required.slice(0, config.mealCount);

  const bridgesNeeded = config.mealCount - required.length;
  let bridgeAdded = 0;
  const result: string[] = [];
  for (const slot of CANONICAL_SLOTS) {
    if (slot.active(config)) {
      result.push(slot.name);
    } else if (bridgeAdded < bridgesNeeded) {
      result.push(slot.name);
      bridgeAdded++;
    }
    if (result.length >= config.mealCount) break;
  }
  while (result.length < config.mealCount) result.push(`Meal ${result.length + 1}`);
  return result;
}

// ─── Void computation ─────────────────────────────────────────────────────────

function computeVoids(
  anchors: Slot[],
  windowStart: number,
  windowEnd: number,
): { start: number; end: number }[] {
  const sorted = [...anchors].sort((a, b) => a.start - b.start);
  const voids: { start: number; end: number }[] = [];
  let cursor = windowStart;
  for (const s of sorted) {
    if (s.start > cursor) voids.push({ start: cursor, end: s.start });
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < windowEnd) voids.push({ start: cursor, end: windowEnd });
  return voids;
}

// ─── Meal gap helper ─────────────────────────────────────────────────────────

interface MealGap {
  gapStart: number;
  gapEnd: number;
  size: number;
}

function computeMealGaps(sortedMeals: Slot[], wakeEnd: number, bedStart: number): MealGap[] {
  const gaps: MealGap[] = [];

  const firstStart = sortedMeals[0]?.start ?? bedStart;
  if (firstStart > wakeEnd + 10) {
    gaps.push({ gapStart: wakeEnd, gapEnd: firstStart, size: firstStart - wakeEnd });
  }

  for (let i = 0; i < sortedMeals.length - 1; i++) {
    const from = sortedMeals[i]!.end;
    const to   = sortedMeals[i + 1]!.start;
    if (to > from) gaps.push({ gapStart: from, gapEnd: to, size: to - from });
  }

  const lastEnd = sortedMeals[sortedMeals.length - 1]?.end ?? wakeEnd;
  if (bedStart > lastEnd + 10) {
    gaps.push({ gapStart: lastEnd, gapEnd: bedStart, size: bedStart - lastEnd });
  }

  return gaps;
}

function largestGap(gaps: MealGap[]): MealGap | undefined {
  return gaps.reduce<MealGap | undefined>(
    (best, g) => (!best || g.size > best.size ? g : best),
    undefined,
  );
}

// ─── Anchored meal placement ──────────────────────────────────────────────────

// Evening is included here so that when it appears in the meal list it is
// anchored to 2–3 hours before bed (not left to open gap-filling).
const TRAINING_NAMES = new Set(["Pre Cardio", "Post Cardio", "Pre Lift", "Post Lift", "Evening"]);

function phaseFor(name: string): SchedulePhaseTag {
  if (name === "Post Cardio" || name === "Post Lift" || name === "Protein Reserve") return "recovery";
  return "structuring";
}

function tryAnchoredMeal(name: string, w: WorkoutPositions, wakeEnd: number, bedStart: number): Slot | null {
  let start: number, end: number;

  switch (name) {
    case "Pre Cardio":
      if (w.cardioStart == null) return null;
      end   = w.cardioStart;
      start = end - 10;
      break;
    case "Post Cardio":
      if (w.cardioEnd == null) return null;
      start = w.cardioEnd + POST_WORKOUT_DELAY;
      end   = start + 10;
      break;
    case "Pre Lift":
      if (w.liftStart == null) return null;
      end   = w.liftStart - PRE_LIFT_END_OFFSET;
      start = end - 10;
      break;
    case "Post Lift":
      if (w.liftEnd == null) return null;
      start = w.liftEnd + POST_WORKOUT_DELAY;
      end   = start + 10;
      break;
    case "Evening":
      // Anchored 2.5 hours before bed (sweet spot of the 2–3 hr window).
      // Falls back to flexible if the resulting slot is before wakeEnd.
      end   = bedStart - 150;
      start = end - 10;
      break;
    default:
      return null;
  }

  if (start < wakeEnd || end > bedStart) return null;
  return { label: name, blockType: "meal", phaseTag: phaseFor(name), start, end };
}

// ─── Core meal placer ────────────────────────────────────────────────────────
//
// Phase 1: Place fixed-anchor meals at their physiologically correct positions.
//          Pre Cardio: ends at cardioStart (0-min gap → eat then immediately start)
//          Post Cardio: starts cardioEnd+5  (within 0–30 min window)
//          Pre Lift:    ends liftStart-45   (sweet spot of 30–60 min window)
//          Post Lift:   starts liftEnd+5    (within 0–30 min window, sooner = better)
//          Evening:     ends bedStart-150   (2.5 hr before bed; sweet spot of 2–3 hr window)
//          Any anchor that falls outside the wake→bed window falls back to flexible.
// Phase 2: Place flexible meals (Protein Reserve priority) into largest gaps.
//          Protein Reserve: largest daytime gap (≥IDEAL_GAP) → work-window gap → largest gap.
// Phase 3: Enforce MAX_GAP — if any gap still > MAX_GAP, shift the nearest
//          flexible meal to the 40% point of that gap.
// Meals are allowed inside work blocks (no restriction applied here).

function placeMealsForDay(
  config: WizardConfig,
  names: string[],
  workouts: WorkoutPositions,
): Slot[] {
  const wakeEnd  = toMins(config.wakeTime) + 1;
  const bedStart = toMins(config.bedTime)  - 1;

  const placed: Slot[]     = [];
  const flexible: string[] = [];

  // ── Phase 1: training-anchored ──────────────────────────────────────────
  for (const name of names) {
    if (TRAINING_NAMES.has(name)) {
      const slot = tryAnchoredMeal(name, workouts, wakeEnd, bedStart);
      if (slot) {
        placed.push(slot);
      } else {
        flexible.push(name); // fallback to flexible if workout missing / out of window
      }
    } else {
      flexible.push(name);
    }
  }

  // ── Phase 2: place flexible meals, Protein Reserve first ────────────────
  // Re-order: Protein Reserve leads, then alphabetical for determinism
  const prIdx = flexible.indexOf("Protein Reserve");
  if (prIdx > 0) {
    flexible.splice(prIdx, 1);
    flexible.unshift("Protein Reserve");
  }

  for (const name of flexible) {
    placed.sort((a, b) => a.start - b.start);
    const gaps = computeMealGaps(placed, wakeEnd, bedStart);
    if (gaps.length === 0) break;

    let targetGap: MealGap;

    if (name === "Protein Reserve") {
      // Priority 1: largest gap if it is at or above IDEAL_GAP
      const biggest = largestGap(gaps)!;
      if (biggest.size >= IDEAL_GAP) {
        targetGap = biggest;
      } else if (config.hasWork) {
        // Priority 2: largest gap that overlaps the work window
        const workS = toMins(config.workStart);
        const workE = toMins(config.workEnd);
        const workGaps = gaps.filter((g) => g.gapStart < workE && g.gapEnd > workS);
        targetGap = workGaps.length > 0
          ? workGaps.reduce((b, g) => (g.size > b.size ? g : b))
          : biggest;
      } else {
        targetGap = biggest;
      }
    } else {
      // Other flexible meals: just fill the largest open gap
      targetGap = largestGap(gaps)!;
    }

    // Place at 40% into the gap (slightly before midpoint → first sub-gap = 40%, second = 60%)
    const available = targetGap.gapEnd - targetGap.gapStart - 10;
    if (available < 0) continue; // gap too small for a 10-min meal

    const mealStart = Math.round(targetGap.gapStart + 0.4 * available);
    const mealEnd   = mealStart + 10;

    if (mealStart >= wakeEnd && mealEnd <= bedStart) {
      placed.push({ label: name, blockType: "meal", phaseTag: phaseFor(name), start: mealStart, end: mealEnd });
    }
  }

  // ── Phase 3: MAX_GAP enforcement ────────────────────────────────────────
  // If any gap still exceeds MAX_GAP, try to slide the nearest flexible meal
  // to cut that gap below the threshold. Training-anchored meals stay fixed.
  placed.sort((a, b) => a.start - b.start);
  let gaps = computeMealGaps(placed, wakeEnd, bedStart);
  const flexibleSet = new Set(flexible);

  for (const gap of gaps.filter((g) => g.size > MAX_GAP)) {
    // Find a flexible meal adjacent to (or inside) this gap that we can move
    const movable = placed.find(
      (m) =>
        flexibleSet.has(m.label) &&
        (Math.abs(m.start - gap.gapStart) < 5 ||
          Math.abs(m.end - gap.gapEnd) < 5),
    );
    if (!movable) continue;

    // Reposition to 40% into the gap
    const available = gap.gapEnd - gap.gapStart - 10;
    if (available < 0) continue;
    const newStart = Math.round(gap.gapStart + 0.4 * available);
    movable.start = newStart;
    movable.end   = newStart + 10;
  }

  return placed.sort((a, b) => a.start - b.start);
}

// ─── Micro-block greedy packer ────────────────────────────────────────────────

function packMicroBlocks(
  voids: { start: number; end: number }[],
  microSize: number,
  types: { type: BlockType; ratio: number }[],
): Slot[] {
  if (types.length === 0) return [];
  const totalRatio = types.reduce((s, t) => s + t.ratio, 0);
  if (totalRatio === 0) return [];

  let totalSlots = 0;
  for (const v of voids) totalSlots += Math.floor((v.end - v.start) / microSize);
  if (totalSlots === 0) return [];

  const norm   = types.map((t) => ({ ...t, ratio: t.ratio / totalRatio }));
  const counts = norm.map((t) => ({ ...t, count: Math.floor(t.ratio * totalSlots) }));
  let remainder = totalSlots - counts.reduce((s, c) => s + c.count, 0);
  const fractionals = counts
    .map((c, i) => ({ i, frac: norm[i]!.ratio * totalSlots - c.count }))
    .sort((a, b) => b.frac - a.frac);
  for (let r = 0; r < remainder; r++) counts[fractionals[r % fractionals.length]!.i]!.count++;

  const sequence: BlockType[] = [];
  for (const c of [...counts].sort((a, b) => a.type.localeCompare(b.type))) {
    for (let i = 0; i < c.count; i++) sequence.push(c.type);
  }

  const microPhase = (t: BlockType): SchedulePhaseTag =>
    t === "rest" ? "recovery" : t === "hobby" ? "expansion" : "structuring";

  const result: Slot[] = [];
  let seqIdx = 0;
  for (const v of voids) {
    let cursor = v.start;
    while (cursor + microSize <= v.end && seqIdx < sequence.length) {
      const bt = sequence[seqIdx]!;
      result.push({
        label: bt.charAt(0).toUpperCase() + bt.slice(1),
        blockType: bt,
        phaseTag: microPhase(bt),
        start: cursor,
        end: cursor + microSize,
      });
      cursor += microSize;
      seqIdx++;
    }
  }
  return result;
}

// ─── Day-specific anchor builder ──────────────────────────────────────────────

function buildDayAnchors(config: WizardConfig, isWeekday: boolean): DayAnchorResult {
  const slots: Slot[]            = [];
  const workouts: WorkoutPositions = {};

  const wakeEnd  = toMins(config.wakeTime) + 1;
  const bedStart = toMins(config.bedTime)  - 1;

  let workS = 0, workE = 0, commAMStart = 0, commPMEnd = 0;
  if (isWeekday && config.hasWork) {
    workS        = toMins(config.workStart);
    workE        = toMins(config.workEnd);
    commAMStart  = config.hasCommute ? workS - config.commuteMinutes : workS;
    commPMEnd    = config.hasCommute ? workE + config.commuteMinutes : workE;
  }

  const morningLimit = isWeekday && config.hasWork ? commAMStart : bedStart;
  let morningCursor  = wakeEnd;
  let showersLeft    = config.showerCount;

  const tryPlace = (
    label: string,
    bt: "cardio" | "lift",
    mins: number,
    cursor: number,
    limit: number,
  ): { placed: boolean; cursor: number } => {
    const end = cursor + mins;
    if (end > limit) return { placed: false, cursor };
    slots.push({ label, blockType: bt, phaseTag: "expansion", start: cursor, end });
    if (bt === "cardio") { workouts.cardioStart = cursor; workouts.cardioEnd = end; }
    if (bt === "lift")   { workouts.liftStart   = cursor; workouts.liftEnd   = end; }
    let next = end;
    if (showersLeft > 0 && next + 5 <= limit) {
      slots.push({ label: "Shower", blockType: "hygiene", phaseTag: "structuring", start: next, end: next + 5 });
      next += 5;
      showersLeft--;
    }
    return { placed: true, cursor: next };
  };

  // Morning workouts
  const morningQueue: { label: string; type: "cardio" | "lift"; mins: number }[] = [];
  if (config.hasCardio && config.cardioTime === "morning")
    morningQueue.push({ label: "Cardio", type: "cardio", mins: config.cardioMins });
  if (config.hasLift && config.liftTime === "morning")
    morningQueue.push({ label: "Lift", type: "lift", mins: config.liftMins });

  const deferred: typeof morningQueue = [];
  for (const w of morningQueue) {
    const r = tryPlace(w.label, w.type, w.mins, morningCursor, morningLimit);
    if (r.placed) { morningCursor = r.cursor; } else { deferred.push(w); }
  }

  if (config.hasCardio && config.cardioTime !== "morning")
    deferred.push({ label: "Cardio", type: "cardio", mins: config.cardioMins });
  if (config.hasLift && config.liftTime !== "morning")
    deferred.push({ label: "Lift", type: "lift", mins: config.liftMins });

  // Commute + Work + Commute
  let eveningCursor = morningCursor;
  if (isWeekday && config.hasWork) {
    if (config.hasCommute)
      slots.push({ label: "Commute AM", blockType: "commute", phaseTag: "structuring", start: commAMStart, end: workS });
    slots.push({ label: "Work", blockType: "work", phaseTag: "structuring", start: workS, end: workE });
    if (config.hasCommute)
      slots.push({ label: "Commute PM", blockType: "commute", phaseTag: "structuring", start: workE, end: commPMEnd });
    eveningCursor = commPMEnd;
  }

  // Evening workouts
  for (const w of deferred) {
    const r = tryPlace(w.label, w.type, w.mins, eveningCursor, bedStart);
    if (r.placed) eveningCursor = r.cursor;
  }

  // Remaining showers
  while (showersLeft > 0) {
    if (morningCursor + 5 <= morningLimit) {
      slots.push({ label: "Shower", blockType: "hygiene", phaseTag: "structuring", start: morningCursor, end: morningCursor + 5 });
      morningCursor += 5;
    }
    showersLeft--;
  }

  return { slots, workouts };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function buildSchedule(config: WizardConfig): BlockTemplate[] {
  const ALL_DAYS      = [0, 1, 2, 3, 4, 5, 6];
  const WORK_DAYS     = config.hasWork ? config.workDays : [];
  const NON_WORK_DAYS = ALL_DAYS.filter((d) => !WORK_DAYS.includes(d));

  const wakeTimeMins = toMins(config.wakeTime);
  const bedTimeMins  = toMins(config.bedTime);
  const wakeStart    = wakeTimeMins - 1;
  const wakeEnd      = wakeTimeMins + 1;
  const bedStart     = bedTimeMins  - 1;
  const bedEnd       = bedTimeMins  + 1;

  const mealNames = getMealNames(config);

  let idx = 0;
  const makeTemplate = (s: Slot, days: number[]): BlockTemplate => ({
    id: `wizard_${idx++}`,
    label: s.label,
    blockType: s.blockType,
    phaseTag: s.phaseTag,
    startTime: fromMins(s.start),
    endTime: fromMins(s.end),
    daysOfWeek: days,
  });

  const templates: BlockTemplate[] = [];

  // ── Wake & Bed (all days) ───────────────────────────────────────────────
  templates.push(makeTemplate(
    { label: "Wake", blockType: "wake", phaseTag: "structuring", start: wakeStart, end: wakeEnd },
    ALL_DAYS,
  ));
  templates.push(makeTemplate(
    { label: "Bed", blockType: "bedtime", phaseTag: "recovery", start: bedStart, end: bedEnd },
    ALL_DAYS,
  ));

  // ── Weekday schedule ────────────────────────────────────────────────────
  if (WORK_DAYS.length > 0) {
    const { slots: wdAnchors, workouts: wdWorkouts } = buildDayAnchors(config, true);
    for (const s of wdAnchors) templates.push(makeTemplate(s, WORK_DAYS));

    // Meals: training-anchored + gap-fill (workday workout positions)
    const wdMeals = placeMealsForDay(config, mealNames, wdWorkouts);
    for (const m of wdMeals) templates.push(makeTemplate(m, WORK_DAYS));

    // Micro-blocks: avoid anchors + meals
    const wdFixed = [
      ...wdAnchors, ...wdMeals,
      { label: "", blockType: "wake" as BlockType, phaseTag: "structuring" as SchedulePhaseTag, start: wakeStart, end: wakeEnd },
      { label: "", blockType: "bedtime" as BlockType, phaseTag: "recovery" as SchedulePhaseTag, start: bedStart, end: bedEnd },
    ];
    if (config.weekdayMicroTypes.length > 0) {
      const wdVoids  = computeVoids(wdFixed, wakeEnd, bedStart);
      const wdMicros = packMicroBlocks(wdVoids, config.weekdayMicroSize, config.weekdayMicroTypes);
      for (const m of wdMicros) templates.push(makeTemplate(m, WORK_DAYS));
    }
  }

  // ── Weekend schedule ────────────────────────────────────────────────────
  if (NON_WORK_DAYS.length > 0) {
    const { slots: weAnchors, workouts: weWorkouts } = buildDayAnchors(config, false);
    for (const s of weAnchors) templates.push(makeTemplate(s, NON_WORK_DAYS));

    // Meals: training-anchored + gap-fill (weekend workout positions)
    const weMeals = placeMealsForDay(config, mealNames, weWorkouts);
    for (const m of weMeals) templates.push(makeTemplate(m, NON_WORK_DAYS));

    // Micro-blocks
    const weFixed = [
      ...weAnchors, ...weMeals,
      { label: "", blockType: "wake" as BlockType, phaseTag: "structuring" as SchedulePhaseTag, start: wakeStart, end: wakeEnd },
      { label: "", blockType: "bedtime" as BlockType, phaseTag: "recovery" as SchedulePhaseTag, start: bedStart, end: bedEnd },
    ];
    if (config.weekendMicroTypes.length > 0) {
      const weVoids  = computeVoids(weFixed, wakeEnd, bedStart);
      const weMicros = packMicroBlocks(weVoids, config.weekendMicroSize, config.weekendMicroTypes);
      for (const m of weMicros) templates.push(makeTemplate(m, NON_WORK_DAYS));
    }
  }

  // ── No-work-days-at-all edge case ───────────────────────────────────────
  // If user has no work AND no non-work days (shouldn't happen), generate for all days
  if (WORK_DAYS.length === 0 && NON_WORK_DAYS.length === 0) {
    const { slots: anchors, workouts } = buildDayAnchors(config, false);
    for (const s of anchors) templates.push(makeTemplate(s, ALL_DAYS));
    const meals = placeMealsForDay(config, mealNames, workouts);
    for (const m of meals) templates.push(makeTemplate(m, ALL_DAYS));
  }

  return templates;
}

// ─── Sleep disturbance evaluator (runtime rule — no storage) ─────────────────

/**
 * Returns true if the given block time falls outside the sleep window.
 * Sleep window = bedTime_start → wakeTime_end (crosses midnight).
 * Used in Logs / Insights — never stored.
 */
export function isSleepDisturbance(
  blockStartHHMM: string,
  blockEndHHMM: string,
  wakeTime: string,
  bedTime: string,
): boolean {
  const blockStart       = toMins(blockStartHHMM);
  const blockEnd         = toMins(blockEndHHMM);
  const sleepWindowStart = toMins(bedTime)  - 1;
  const sleepWindowEnd   = toMins(wakeTime) + 1;
  return blockStart >= sleepWindowStart || blockEnd <= sleepWindowEnd;
}
