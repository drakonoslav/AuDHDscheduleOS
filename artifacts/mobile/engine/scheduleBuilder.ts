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
 * 10. Meals (distributed across wake→bed using deterministic gap formula)
 * 11. Micro-blocks (greedy void fill, ratio-weighted)
 */

import type { BlockTemplate, BlockType, SchedulePhaseTag } from "@/types";

// ─── Config type ──────────────────────────────────────────────────────────────

export interface WizardConfig {
  wakeTime: string;          // HH:MM
  bedTime: string;           // HH:MM
  mealCount: number;         // 1–7

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
  workDays: number[];        // 0=Sun … 6=Sat
  workStart: string;         // HH:MM
  workEnd: string;           // HH:MM

  hasCommute: boolean;
  commuteMinutes: number;

  showerCount: number;       // 0–3 per day

  weekdayMicroSize: 3 | 5 | 10 | 15 | 25 | 30;
  weekdayMicroTypes: { type: BlockType; ratio: number }[];

  weekendMicroSize: 3 | 5 | 10 | 15 | 25 | 30;
  weekendMicroTypes: { type: BlockType; ratio: number }[];
}

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

// ─── Meal name resolution ─────────────────────────────────────────────────────

// Full canonical sequence (time-ordered). Active slots take precedence;
// bridge slots fill gaps to reach mealCount.
const CANONICAL_SLOTS: { name: string; active: (c: WizardConfig) => boolean }[] = [
  { name: "Pre Cardio",      active: (c) => c.hasCardio && c.cardioPre },
  { name: "Post Cardio",     active: (c) => c.hasCardio && c.cardioPost },
  { name: "Mid Morning",     active: () => false },   // bridge
  { name: "Pre Lift",        active: (c) => c.hasLift && c.liftPre },
  { name: "Post Lift",       active: (c) => c.hasLift && c.liftPost },
  { name: "Evening",         active: () => false },   // bridge
  { name: "Protein Reserve", active: () => false },   // bridge
];

function getMealNames(config: WizardConfig): string[] {
  const required = CANONICAL_SLOTS.filter((s) => s.active(config)).map((s) => s.name);

  if (config.mealCount <= required.length) {
    return required.slice(0, config.mealCount);
  }

  // Merge required + bridges in canonical order until mealCount reached
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

  // Fallback to generic names if still short (> 7 shouldn't happen, but guard anyway)
  while (result.length < config.mealCount) {
    result.push(`Meal ${result.length + 1}`);
  }

  return result;
}

// ─── Internal slot type ───────────────────────────────────────────────────────

interface Slot {
  label: string;
  blockType: BlockType;
  phaseTag: SchedulePhaseTag;
  start: number;   // minutes since midnight
  end: number;
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
    if (s.start > cursor) {
      voids.push({ start: cursor, end: s.start });
    }
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < windowEnd) {
    voids.push({ start: cursor, end: windowEnd });
  }
  return voids;
}

// ─── Meal placement (exact deterministic formula) ────────────────────────────

function placeMeals(config: WizardConfig, names: string[]): Slot[] {
  const wakeEnd = toMins(config.wakeTime) + 1;
  const bedStart = toMins(config.bedTime) - 1;
  const n = config.mealCount;

  const usableWindow = bedStart - wakeEnd;                  // total minutes available
  const totalMealTime = n * 10;
  const gapCount = n - 1;
  // gap_size = (usable_window - total_meal_time) / gap_count
  // For n=1, gapCount=0, meal is centred (start=wakeEnd)
  const gapSize = gapCount > 0 ? (usableWindow - totalMealTime) / gapCount : 0;

  return names.map((name, i) => {
    const start = Math.round(wakeEnd + i * (10 + gapSize));
    return {
      label: name,
      blockType: "meal" as BlockType,
      phaseTag: "structuring" as SchedulePhaseTag,
      start,
      end: start + 10,
    };
  });
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

  // Count total slots available
  let totalSlots = 0;
  for (const v of voids) totalSlots += Math.floor((v.end - v.start) / microSize);
  if (totalSlots === 0) return [];

  // Assign counts by ratio
  const norm = types.map((t) => ({ ...t, ratio: t.ratio / totalRatio }));
  const counts = norm.map((t) => ({ ...t, count: Math.floor(t.ratio * totalSlots) }));
  let remainder = totalSlots - counts.reduce((s, c) => s + c.count, 0);
  // Distribute remainder deterministically (by descending fractional part)
  const fractionals = counts
    .map((c, i) => ({ i, frac: norm[i]!.ratio * totalSlots - c.count }))
    .sort((a, b) => b.frac - a.frac);
  for (let r = 0; r < remainder; r++) {
    counts[fractionals[r % fractionals.length]!.i]!.count++;
  }

  // Build type sequence (sorted for determinism)
  const sequence: BlockType[] = [];
  for (const c of [...counts].sort((a, b) => a.type.localeCompare(b.type))) {
    for (let i = 0; i < c.count; i++) sequence.push(c.type);
  }

  // Phase tag helper
  const phaseFor = (t: BlockType): SchedulePhaseTag =>
    t === "rest" ? "recovery" : t === "hobby" ? "expansion" : "structuring";

  // Greedy pack into voids
  const result: Slot[] = [];
  let seqIdx = 0;
  for (const v of voids) {
    let cursor = v.start;
    while (cursor + microSize <= v.end && seqIdx < sequence.length) {
      const bt = sequence[seqIdx]!;
      result.push({
        label: bt.charAt(0).toUpperCase() + bt.slice(1),
        blockType: bt,
        phaseTag: phaseFor(bt),
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

function buildDayAnchors(config: WizardConfig, isWeekday: boolean): Slot[] {
  const slots: Slot[] = [];
  const wakeEnd = toMins(config.wakeTime) + 1;
  const bedStart = toMins(config.bedTime) - 1;

  let workS = 0, workE = 0, commAMStart = 0, commPMEnd = 0;
  if (isWeekday && config.hasWork) {
    workS = toMins(config.workStart);
    workE = toMins(config.workEnd);
    commAMStart = config.hasCommute ? workS - config.commuteMinutes : workS;
    commPMEnd   = config.hasCommute ? workE + config.commuteMinutes : workE;
  }

  const morningLimit = isWeekday && config.hasWork ? commAMStart : bedStart;

  let morningCursor = wakeEnd;
  let showersLeft = config.showerCount;

  // Helper: try to place a workout at cursor if it fits within limit
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
    let next = end;
    if (showersLeft > 0 && next + 5 <= limit) {
      slots.push({ label: "Shower", blockType: "hygiene", phaseTag: "structuring", start: next, end: next + 5 });
      next += 5;
      showersLeft--;
    }
    return { placed: true, cursor: next };
  };

  // ── 2+3. Morning workouts ─────────────────────────────────────────────────
  const morningQueue: { label: string; type: "cardio" | "lift"; mins: number }[] = [];
  if (config.hasCardio && config.cardioTime === "morning")
    morningQueue.push({ label: "Cardio", type: "cardio", mins: config.cardioMins });
  if (config.hasLift && config.liftTime === "morning")
    morningQueue.push({ label: "Lift", type: "lift", mins: config.liftMins });

  const deferredToEvening: typeof morningQueue = [];
  for (const w of morningQueue) {
    const r = tryPlace(w.label, w.type, w.mins, morningCursor, morningLimit);
    if (r.placed) {
      morningCursor = r.cursor;
    } else {
      deferredToEvening.push(w);
    }
  }

  // Add afternoon/evening-preferred workouts to deferred list too
  if (config.hasCardio && config.cardioTime !== "morning")
    deferredToEvening.push({ label: "Cardio", type: "cardio", mins: config.cardioMins });
  if (config.hasLift && config.liftTime !== "morning")
    deferredToEvening.push({ label: "Lift", type: "lift", mins: config.liftMins });

  // ── 4+5+6. Commute + Work + Commute (weekday only) ──────────────────────
  let eveningCursor = morningCursor;
  if (isWeekday && config.hasWork) {
    if (config.hasCommute) {
      slots.push({ label: "Commute AM", blockType: "commute", phaseTag: "structuring", start: commAMStart, end: workS });
    }
    slots.push({ label: "Work", blockType: "work", phaseTag: "structuring", start: workS, end: workE });
    if (config.hasCommute) {
      slots.push({ label: "Commute PM", blockType: "commute", phaseTag: "structuring", start: workE, end: commPMEnd });
    }
    eveningCursor = commPMEnd;
  }

  // ── 7+8. Evening workouts + showers ──────────────────────────────────────
  for (const w of deferredToEvening) {
    const r = tryPlace(w.label, w.type, w.mins, eveningCursor, bedStart);
    if (r.placed) eveningCursor = r.cursor;
  }

  // Any remaining showers (not tied to a workout) — place in morning if space
  while (showersLeft > 0) {
    if (morningCursor + 5 <= morningLimit) {
      slots.push({ label: "Shower", blockType: "hygiene", phaseTag: "structuring", start: morningCursor, end: morningCursor + 5 });
      morningCursor += 5;
    }
    showersLeft--;
  }

  return slots;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function buildSchedule(config: WizardConfig): BlockTemplate[] {
  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
  const WORK_DAYS = config.hasWork ? config.workDays : [];
  const NON_WORK_DAYS = ALL_DAYS.filter((d) => !WORK_DAYS.includes(d));

  const wakeTimeMins = toMins(config.wakeTime);
  const bedTimeMins  = toMins(config.bedTime);
  const wakeStart    = wakeTimeMins - 1;
  const wakeEnd      = wakeTimeMins + 1;
  const bedStart     = bedTimeMins - 1;
  const bedEnd       = bedTimeMins + 1;

  const mealNames = getMealNames(config);
  const mealSlots = placeMeals(config, mealNames);

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

  // ── 1. Wake (all days) ──────────────────────────────────────────────────
  templates.push(makeTemplate(
    { label: "Wake", blockType: "wake", phaseTag: "structuring", start: wakeStart, end: wakeEnd },
    ALL_DAYS,
  ));

  // ── 9. Bedtime (all days) ───────────────────────────────────────────────
  templates.push(makeTemplate(
    { label: "Bed", blockType: "bedtime", phaseTag: "recovery", start: bedStart, end: bedEnd },
    ALL_DAYS,
  ));

  // ── 10. Meals (all days — formula is day-agnostic) ──────────────────────
  for (const meal of mealSlots) {
    templates.push(makeTemplate(meal, ALL_DAYS));
  }

  // ── Weekday anchors ─────────────────────────────────────────────────────
  if (WORK_DAYS.length > 0) {
    const wdAnchors = buildDayAnchors(config, true);
    for (const s of wdAnchors) {
      templates.push(makeTemplate(s, WORK_DAYS));
    }

    // ── 11. Weekday micro-blocks ─────────────────────────────────────────
    const wdFixed = [
      ...wdAnchors,
      ...mealSlots,
      { label: "", blockType: "wake" as BlockType, phaseTag: "structuring" as SchedulePhaseTag, start: wakeStart, end: wakeEnd },
      { label: "", blockType: "bedtime" as BlockType, phaseTag: "recovery" as SchedulePhaseTag, start: bedStart, end: bedEnd },
    ];
    const wdVoids = computeVoids(wdFixed, wakeEnd, bedStart);
    if (config.weekdayMicroTypes.length > 0) {
      const micros = packMicroBlocks(wdVoids, config.weekdayMicroSize, config.weekdayMicroTypes);
      for (const m of micros) templates.push(makeTemplate(m, WORK_DAYS));
    }
  }

  // ── Weekend anchors ─────────────────────────────────────────────────────
  if (NON_WORK_DAYS.length > 0) {
    const weAnchors = buildDayAnchors(config, false);
    for (const s of weAnchors) {
      templates.push(makeTemplate(s, NON_WORK_DAYS));
    }

    // ── 11. Weekend micro-blocks ─────────────────────────────────────────
    const weFixed = [
      ...weAnchors,
      ...mealSlots,
      { label: "", blockType: "wake" as BlockType, phaseTag: "structuring" as SchedulePhaseTag, start: wakeStart, end: wakeEnd },
      { label: "", blockType: "bedtime" as BlockType, phaseTag: "recovery" as SchedulePhaseTag, start: bedStart, end: bedEnd },
    ];
    const weVoids = computeVoids(weFixed, wakeEnd, bedStart);
    if (config.weekendMicroTypes.length > 0) {
      const micros = packMicroBlocks(weVoids, config.weekendMicroSize, config.weekendMicroTypes);
      for (const m of micros) templates.push(makeTemplate(m, NON_WORK_DAYS));
    }
  }

  return templates;
}

// ─── Sleep disturbance evaluator (runtime rule — no storage) ─────────────────

/**
 * Returns true if the given block time falls outside the sleep window.
 * Sleep window = bedTime_start → wakeTime_end.
 * Used in Logs / Insights to flag potential sleep disturbances.
 * This is NEVER stored — it is evaluated fresh from each block's times.
 */
export function isSleepDisturbance(
  blockStartHHMM: string,
  blockEndHHMM: string,
  wakeTime: string,
  bedTime: string,
): boolean {
  const blockStart = toMins(blockStartHHMM);
  const blockEnd   = toMins(blockEndHHMM);
  const sleepWindowStart = toMins(bedTime) - 1;   // bedtime_start
  const sleepWindowEnd   = toMins(wakeTime) + 1;  // wake_end (next day)

  // Sleep window crosses midnight: [sleepWindowStart, 1440) ∪ [0, sleepWindowEnd)
  const inSleepWindow = blockStart >= sleepWindowStart || blockEnd <= sleepWindowEnd;
  return inSleepWindow;
}
