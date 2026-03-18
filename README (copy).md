# AuDHD Schedule OS

A mobile-first, local-first daily operating system built specifically for the neurodivergent body and mind. AuDHD Schedule OS is not a habit tracker, a productivity app, or a calorie counter. It is a physiological and neuro-state interpreter — a system that reads what your body and nervous system are actually doing, and helps you make scheduling, nutrition, and training decisions that align with that reality rather than fight against it.

---

## Table of Contents

1. [Premise and Philosophy](#1-premise-and-philosophy)
2. [The Three Concept Layers](#2-the-three-concept-layers)
3. [App Structure — Five Tabs](#3-app-structure--five-tabs)
   - [Today](#today-tab)
   - [Plan](#plan-tab)
   - [Log](#log-tab)
   - [Meals](#meals-tab)
   - [Insights](#insights-tab)
4. [Data Entry — Qualitative Daily Log](#4-data-entry--qualitative-daily-log)
5. [Data Entry — Quantitative Daily Log](#5-data-entry--quantitative-daily-log)
6. [Data Entry — Training Log](#6-data-entry--training-log)
7. [The Orbital Inference Engine](#7-the-orbital-inference-engine)
8. [The Training Readiness Interpreter](#8-the-training-readiness-interpreter)
9. [The Trend Engine](#9-the-trend-engine)
10. [The Recommendation Engine](#10-the-recommendation-engine)
11. [Meal Planning — Nutrition Phases and Templates](#11-meal-planning--nutrition-phases-and-templates)
12. [Backup and Restore System](#12-backup-and-restore-system)
13. [Local-First Architecture](#13-local-first-architecture)
14. [Design Principles and Constraints](#14-design-principles-and-constraints)

---

## 1. Premise and Philosophy

Most productivity and health apps are built on an implicit assumption: that a person's capacity to execute, focus, recover, and absorb stimulus is roughly constant from day to day and amenable to willpower and habit stacking. For many neurodivergent people — particularly those with ADHD, autism, or both — this assumption is wrong in a fundamental way that no amount of discipline resolves.

An autistic nervous system processes sensory input at a different gain level than neurotypical systems. Accumulated sensory load, social exposure, novel stimulation, and environmental texture create a real physiological cost that compounds across the day and across the week. An ADHD nervous system has inconsistent access to executive function, dopamine regulation, and working memory — meaning that the same task at the same time on different days can feel effortless or completely inaccessible, not because of motivation failure, but because the underlying neurochemistry is different.

AuDHD Schedule OS is built on a different assumption: **your state is real, measurable, variable, and meaningful.** A day where your sensory baseline is already high before the day starts is not a day to add more stimulation — it is a day to protect recovery capacity. A block that gets high resistance ratings consistently is not evidence of a discipline problem — it is evidence of a timing or state mismatch. Better adherence does not automatically mean a better schedule. A schedule that asks too much of the wrong state is a problem with the schedule, not the person executing it.

The app does three things simultaneously:

1. **Reads your current physiological and neuro-state** through daily qualitative and quantitative logging.
2. **Interprets that state** through four separate reasoning engines that never confuse a schedule decision with a nutrition decision with a physiological inference.
3. **Returns structured guidance** — scheduling recommendations, training readiness classification, orbital phase inference with nutrition suggestions — that you can follow, override, or ignore as you see fit.

The app never forces decisions. It annotates your choices with what the data says, and lets you decide.

---

## 2. The Three Concept Layers

The most important architectural decision in the app is the strict separation of three domains that operate at different timescales and serve different purposes. They are never collapsed into one score and never used interchangeably.

### Layer 1: SchedulePhaseTag

A property of individual **schedule blocks** — not of days, not of the body. It has three values:

- **Expansion** — novelty-seeking, creative, socially engaging, or high-stimulation activity.
- **Structuring** — predictable, procedural, low-novelty, execution-focused activity.
- **Recovery** — rest, low demand, restorative, or sensory-quiet activity.

Every block in your schedule carries one of these tags. The tag is used to detect whether what you are scheduling matches your neuro-state. Expansion blocks on recovery-mode days repeatedly coincide with high overload ratings — the system notes this and suggests a shift. It does not tell you that you failed; it tells you the schedule was mismatched.

### Layer 2: NutritionPhaseId

A property of **your current dietary regime** — the protocol you are deliberately running. Eight phases are supported:

| Phase | What it means |
|---|---|
| **Base** | Stabilized operating point — not pushing surplus or deficit |
| **Carb-Up** | Rising carbohydrate pressure to support force production |
| **Carb-Cut** | Carbohydrate reduction — improved nutrient routing |
| **Fat-Cut** | Fat reduction — storage-pressure reduction protocol |
| **Recomp** | Slow recomposition — routing toward muscle while controlling fat |
| **Deload** | Recovery nutrition — reduced strain, restored CNS sensitivity |
| **Diet Break** | Metabolic reset — relieves adaptive suppression |
| **Peak Bulk** | Aggressive growth — highest surplus and carbohydrate pressure |

You select your active nutrition phase. The app records it on your daily qualitative log so your nutrition state is tracked alongside your neuro-state over time.

### Layer 3: OrbitalPhaseId

A property of **your physiological cycle** — what the body's data says about where you actually are in a stimulus-recovery-adaptation loop. This is the output of the Orbital Inference Engine and is never the same thing as your selected nutrition phase. It is a *reading* of your state, not a *decision* you make.

Eight orbital phases form a cycle:

| Phase | What it represents |
|---|---|
| **Priming** | System receptive, not yet loaded — optimal moment to begin a protocol |
| **Loading** | Force production rising, fuel pressure high — absorbing stimulus |
| **Accumulation** | Absorbing training stimulus, substrate restoration underway |
| **Saturation** | Maximum cellular stress, peak hypertrophy drive |
| **Partitioning** | Nutrient routing toward muscle, efficiency mode |
| **Resensitization** | CNS recovery, receptor sensitivity being restored |
| **Rebound** | Supercompensation — output capacity returning |
| **Expression** | Stabilized at a higher baseline, not forcing — the achieved state |

The system translates between Layer 2 and Layer 3 through a **translator table** — each nutrition phase maps to a primary and secondary orbital phase it is physiologically consistent with. The inference engine reads your actual signals and identifies which orbital phase you are *in*, then compares it to what your selected nutrition protocol *implies*. If these differ significantly (measured by cyclic distance in the 8-phase cycle), the system flags a mismatch with an explanation and a suggested nutrition protocol adjustment.

---

## 3. App Structure — Five Tabs

### Today Tab

The home screen for every day. It shows:

- **Date header and greeting** — contextually aware of the current day.
- **Today's qualitative state** — a compact summary of your logged neuro-state pulled from the qualitative daily log, including your recommended day mode (expansion-favoring, structuring-favoring, recovery-favoring, or mixed), ADHD pull score, autism pull score, and recovery need score.
- **Orbital phase context** — the top inferred orbital phase from the engine, showing what physiological state the signal window suggests you are in.
- **Training readiness badge** — the training mode recommended for today (Compound Performance, Hypertrophy Volume, Isolation & Stability, or Recovery Training) with a plain-text explanation of what drove the classification.
- **Active nutrition phase** — your currently running protocol and its orbital alignment (what orbital phase it is oriented toward, both primary and secondary).
- **Today's schedule blocks** — all blocks for today, each showing planned time, block type, status, and phase tag. Tapping any block opens the block detail sheet where you can log actuals, record ratings, note sensory conditions, and update status.
- **Quick-access entry points** — tapping the qualitative log card opens the daily state form; blocks link to their detail screen.

The Today tab is the daily anchor. Everything else in the app feeds information into what you see here.

### Plan Tab

The schedule construction and template management screen. Two modes are available:

**Block creation (one-off):**
- Select date, block type (wake, meal, work, commute, cardio, lift, hobby, hygiene, chores, errands, bedtime, rest, other), label, planned start and end times.
- The phase tag (Expansion / Structuring / Recovery) is derived automatically from three slider axes — novelty, structure, and recovery — using a weighted classifier. You set the axes and the system derives the tag; you can override if needed.
- Overlap detection runs automatically: a soft overlap (nested blocks, like a meal inside a work block) is allowed with a visual note; a hard overlap (partial collision where neither contains the other) raises an alert.

**Block templates (recurring schedule):**
- Define a canonical block with a label, type, time range, phase tag, and which days of the week it applies to.
- Apply templates to any date — the system stamps new blocks from all matching day-of-week templates, skipping any that already exist for that date (deduplication by label + time).
- Templates are your recurring schedule skeleton. Modifying a template does not retroactively change already-applied blocks.

### Log Tab

The daily logging hub. It contains four sections:

1. **Qualitative Daily Log card** — opens the full subjective state entry form (detailed in Section 4).
2. **Quantitative Daily Log card** — opens the objective measurement form for sleep stages, HRV, RHR, body composition, waist measurement, and hormonal signal data (detailed in Section 5).
3. **Schedule block list** — all blocks for the selected date, each tappable to open the block detail rating sheet. The list shows: planned vs actual time, deviation (minutes early/late), phase tag, status, and whether ratings have been entered.
4. **Training button** — opens the training log entry form for cardio or lift sessions (detailed in Section 6).

The Log tab also carries the **Data & Backup** entry point — a shield icon in the header that opens the backup and restore system (detailed in Section 12).

A date selector at the top lets you navigate up to 90 days back. All data entry for past dates is fully supported.

### Meals Tab

The nutrition-phase-aware meal planning screen. It shows:

- **Your active nutrition phase** with a phase-selector toggle to switch protocols.
- **Orbital alignment context** — the two orbital phases (primary and secondary) that your current nutrition phase is oriented toward, shown as a contextual annotation.
- **Macro targets for the day** — daily protein, carbohydrate, and fat targets derived from your current phase, displayed as a macro bar with gram and percentage breakdowns.
- **Meal slot templates** — each of the seven canonical meal slots (Pre-Cardio, Post-Cardio, Mid-Morning, Pre-Lift, Post-Lift, Evening, Protein Reserve) is shown as an expandable card displaying the ingredient list, per-ingredient macros (kcal / protein / carbs / fat), and slot totals.
- **Phase navigation** — switch between all eight nutrition phases from within the Meals tab to preview what their templates and targets look like before committing.

Templates are built from a structured ingredient database containing eight items: MCT oil, flaxseed, oats, dextrin, whey protein, Greek yogurt, banana, and eggs. Every template line specifies an ingredient, a unit amount, a prep note, and the resulting macros. Templates currently exist for four phases (Base, Carb-Up, Recomp, Deload) with the architecture in place to extend to all eight.

### Insights Tab

The pattern analysis and physiological interpretation screen. It has six sections:

**1. Last 7 Days stats panel**
Four summary cards: block adherence percentage (done blocks / total blocks), average block resistance rating, average sleep hours, and day mode breakdown (how many expansion, structuring, and recovery days in the past 7).

**2. Trend signals**
A configurable time-window selector (7, 14, 21, or 28 days) drives a trend signal analysis across 23 tracked signals. Each signal shows: direction arrow (rising / falling / stable), current value, 7-day delta, and a sparkline of recent values. Signals include: Recovery Need Score, ADHD Pull Score, Autism Pull Score, HRV, RHR, Deep Sleep minutes, physical energy, motivation, mental clarity, emotional stability, sleep hours, sleep quality, novelty hunger, structure hunger, sensory load baseline, REM sleep, core sleep, awake minutes, weight, body fat percentage, fat-free mass, waist circumference, and hormone duration.

Cross-layer interpretations are detected automatically — for example, when an HRV decline trend coincides with rising recovery need and poor sleep quality, the system surfaces this as a named interpretation rather than leaving you to connect the signals yourself.

**3. Orbital phase inference panel**
A full likelihood ranking of all eight orbital phases, each shown as a percentage-fill bar with: the phase label, its score (0–100%), and the top key signals that drove the scoring. The top two phases are expanded. Confidence level (Low / Moderate / High) is shown with the data point count. Drift pills appear inline on the bars when drift data is available (≥4 days), showing which phases are gaining or losing pressure in the most recent 3 days vs the full window — these appear as ↑ or ↓ arrows beside the likelihood bar.

**4. Nutrition mismatch alert**
If the orbital engine detects that your currently logged nutrition phase implies a significantly different physiological state than your actual signal data suggests, a mismatch card appears with: the severity (mild or strong, based on cyclic distance between the two implied orbital phases), a plain-English explanation of what is misaligned, and a specific nutrition phase suggestion with a rationale drawn from the reverse orbital-to-nutrition mapping table.

**5. Recommendations panel**
Pattern-backed schedule and lifestyle recommendations generated by the recommendation engine (detailed in Section 10). Each recommendation shows: type tag (timing shift, fewer blocks, environment, meal timing, training placement), confidence level (pattern-backed or emerging), title, a detailed body explaining why the pattern was detected, and a specific actionable suggestion.

**6. High overload blocks list**
A list of blocks in the last 7 days that received an overload rating of 4 or 5, shown with their date, time, and block label. This provides direct visibility into where the schedule is creating the most strain.

---

## 4. Data Entry — Qualitative Daily Log

The qualitative log is the subjective state capture form, filled out once at the start of each day. It is deliberately fast to complete — the instruction to answer quickly and use first instinct is intentional, because a carefully reasoned score is less repeatable and less useful than a rapid gut-level rating.

All sliders operate on a 1–5 scale. Some are explicitly inverted in their labeling (e.g., mental fog: 1 = clear, 5 = very foggy) so the scale always reads as "1 = low intensity, 5 = high intensity" regardless of whether higher is better or worse for a given signal.

**Sleep section:**
- Hours slept (decimal input — e.g., 7.5)
- Sleep quality (1 = poor / 5 = restorative)

**Energy & State section:**
- Physical energy (1 = drained / 5 = energized)
- Motivation (1 = resistant to starting things / 5 = driven)
- Mental clarity / fog (1 = clear / 5 = very foggy — inverted on the 1–5 scale)
- Emotional stability (1 = fragile / 5 = grounded)

**Neuro Pull section** — these three signals directly drive the ADHD Pull Score, Autism Pull Score, and recommended day mode computation:
- Novelty hunger (1 = want sameness / 5 = craving stimulation)
- Structure hunger (1 = flexible is fine / 5 = need predictability)
- Pressure / compression seeking (1 = not needed / 5 = strongly wanted)

**Sensory section** — these signals contribute to the Autism Pull Score and recovery need computation:
- Sensory load baseline (1 = low load / 5 = already overloaded — inverted)
- Social load (1 = easy / 5 = strongly costly — inverted)
- Noise aversion (1 = tolerable / 5 = overwhelming — inverted)
- Light aversion (1 = tolerable / 5 = overwhelming — inverted)
- Texture sensitivity (1 = tolerable / 5 = disruptive — inverted)

**Nutrition Regime section:**
- A chip grid showing all eight nutrition phases. The currently selected phase is highlighted in the primary tint color.
- If the orbital engine has sufficient data (≥3 days) and moderate or high confidence, an **orbital suggestion banner** appears above the chip grid showing: the inferred orbital phase (with its phase-specific color), confidence level, the suggested nutrition phase, and a one-to-two line rationale explaining why that nutrition phase aligns with the observed signal pattern. The suggested chip is additionally marked with an amber border and a small amber dot. Tapping any chip selects it as usual — the suggestion is advisory only.

On save, three composite scores are derived automatically:
- **ADHD Pull Score** = (noveltyHunger + physicalEnergy + (5 − mentalFog)) / 3
- **Autism Pull Score** = (structureHunger + sensoryLoadBaseline + noiseAversion) / 3
- **Recovery Need Score** = ((5 − sleepQuality) + (5 − emotionalStability) + socialLoad + sensoryLoadBaseline) / 4

And a **recommended day mode** is derived:
- Recovery need ≥ 3.5 → Recovery-favoring
- Autism Pull > ADHD Pull + 0.5 → Structuring-favoring
- ADHD Pull > Autism Pull + 0.5 AND recovery need < 2.5 → Expansion-favoring
- Otherwise → Mixed

---

## 5. Data Entry — Quantitative Daily Log

The quantitative log captures objective measurable data — all of it optional, so that partial data entry over time still accumulates useful signal.

**Sleep stages (in minutes):**
- Awake time (minutes spent awake during the sleep period)
- REM sleep (minutes)
- Core sleep (minutes)
- Deep sleep (minutes)

Sleep stage ratios (deep%, REM%, core%, awake% of total sleep) are computed by the orbital engine from these raw minute values. A minimum 30-minute sleep floor is required before ratios are trusted.

**Vitals:**
- HRV (heart rate variability, in milliseconds — whole number)
- RHR (resting heart rate, in beats per minute — whole number)

**Body composition:**
- Weight in pounds (one decimal)
- Body fat percentage (one decimal)
- Skeletal muscle percentage (one decimal)
- Fat-free mass in pounds (one decimal)

**Measurements:**
- Waist circumference in inches (increments of 0.25)

**Hormonal signal** (three separate inputs that together represent a composite hormonal observation):
- Duration in minutes (entered as hours:minutes, converted on save)
- Quantitative count (one decimal)
- Qualitative count (one decimal)

All quantitative data is stored as raw entries per date with no averaging applied at the storage layer. Averaging, trend detection, and ratio computation happen in the trend engine at render time.

---

## 6. Data Entry — Training Log

The training log captures both cardio and resistance training sessions with subjective ratings that feed the training readiness and recommendation engines.

**Session basics:**
- Type: cardio or lift
- Planned time (HH:MM)
- Actual time (if different from planned)
- Duration in minutes
- Intensity: low, moderate, or high

**Lift-specific timing:**
- Pre-lift meal timing (minutes before session)
- Post-lift meal timing (minutes after session)

**Subjective ratings (all 1–5):**
- Motivation before (1 = very low / 5 = very high)
- Resistance before (resistance to starting — 1 = none / 5 = strong)
- Satisfaction after
- Later fatigue cost (how much fatigue accumulated after the session)
- Bedtime impact (1 = no effect / 5 = significantly disrupted)
- Effect on focus (1 = reduced / 5 = improved)
- Effect on sensory calm (1 = more dysregulated / 5 = notably calmer)

The bedtime impact and training time together are used by the recommendation engine to detect a recurring pattern of late lifting disrupting sleep (requires ≥2 occurrences before surfacing a suggestion). Pre-lift meal timing combined with pre-session motivation drives the meal timing recommendation rule.

---

## 7. The Orbital Inference Engine

The orbital inference engine is the most sophisticated component in the app. It operates on a rolling 14-day window of `DailyIndex` records — the per-day unified join of qualitative log fields, quantitative log fields, and derived composite scores. It produces a ranked probability distribution over all eight orbital phases, detects drift in that distribution across time, identifies nutrition mismatches, and outputs a suggested nutrition protocol adjustment.

### Scoring architecture

Eight independent scoring functions — one per orbital phase — each produce a score from 0.0 to 1.0. Each function uses a weighted combination of the following signal types:

- **Range scores:** how well a signal's average value falls within an ideal range for that phase. The `rangeScore()` function uses a soft zone parameter to create a smooth penalty curve rather than a hard boundary. Sleep stage minute signals use `softZone=20` (1 point of penalty per 20 minutes off-ideal); 1–5 scale signals use the default `softZone=2`.
- **Trend scores:** whether a signal's direction (rising / falling / stable) matches what a given orbital phase would predict. Trend requires ≥3 data points in the field; fewer data points return stable.
- **Sleep stage ratios:** deep sleep as a percentage of total sleep, REM%, core%, and awake% of total sleep time are used as ratio signals rather than raw minutes, to normalize against different total sleep durations.

Weights within each scoring function sum to 1.0 so that partial data (missing fields) degrades the score gracefully rather than zeroing it out. A missing field contributes a neutral 0.5 rather than failing.

### Phase-by-phase signal fingerprints

Each orbital phase has a distinct signal fingerprint that distinguishes it from the others:

**Priming:** Low recovery need (1–2), physical energy in readiness range (2–3.5), low sensory load baseline, stable HRV, core sleep 40–60%, low mental fog, motivation moderate (not fired up), awake time <10% of total sleep.

**Loading:** High physical energy (3.5–5), rising HRV trend, high motivation, moderate-to-high novelty hunger (3–5), moderate recovery need, high deep sleep (90–150min), low sensory load, structure hunger moderate.

**Accumulation:** Moderate physical energy (2.5–4), HRV stable, moderate recovery need (1.5–3), deep sleep ≥90min, moderate motivation (2.5–4), REM sleep ≥70min, low sensory load.

**Saturation:** High recovery need (2.5–4.5), high physical energy despite high recovery need, rising motivation, very high deep sleep (100–180min), falling HRV trend, moderate-to-high mental fog (2.5–5), moderate sensory load (1.5–3.5), awake time 10–25% (indicating sleep disruption from cellular stress), high structure hunger.

**Partitioning:** Moderate recovery need (1.5–3), moderate motivation (2.5–4), HRV stable, deep sleep ≥80min, moderate mental fog (2–4), low-to-moderate sensory load, structure hunger moderate-to-high. Expression stability is discriminated from Partitioning by body composition trend: if bodyFatPct, fatFreeMassLbs, HRV, physicalEnergy, motivation, recoveryNeedScore, and RHR are all stable over the window, Expression is preferred. Active recomposition (bodyFatPct falling) removes this stability condition, creating at least a 0.050 margin for Partitioning.

**Resensitization:** Moderate-to-high recovery need (2–4), falling physical energy trend, moderate mental fog (2–4), declining motivation trend, high deep sleep (80–140min), falling novelty hunger (system going quiet), high structure hunger, high sensory load, low novelty.

**Rebound:** Falling recovery need trend (recovery lifting), rising physical energy trend, rising motivation trend, low mental fog (1–2.5), HRV rising trend, deep sleep ≥70min, moderate sensory load.

**Expression:** Low recovery need (1–2), high physical energy (3.5–5), high motivation (3.5–5), low mental fog (1–2.5), HRV stable or rising, deep sleep ≥80min, low sensory load. Expression requires signal stability — if HRV, physicalEnergy, motivation, recoveryNeedScore, RHR, and bodyFatPct are all in stable trends (6-signal check), the Expression stability bonus is fully applied.

### Confidence and data gating

- **Low confidence:** fewer than 3 indexed days. No mismatch is flagged, no nutrition suggestion is surfaced, drift is not computed.
- **Moderate confidence:** 3 or more days but fewer than the full window.
- **High confidence:** sufficient data across the full window with multiple overlapping signals.

### Drift detection

Secondary drift detects which phases are **gaining pressure** vs **losing pressure** in the most recent 3-day window compared to the full 7-day window. This is a differential: recent3d score minus full7d score. A threshold of ±0.05 determines significance. Drift requires ≥3 recent days AND ≥4 full window days to compute.

A `risingPhase` (gaining pressure) and a `fallingPhase` (losing pressure) are identified from the highest and lowest drift values respectively. These appear as ↑/↓ drift pills on the phase likelihood bars in the Insights tab.

### Nutrition mismatch and suggestion

The nutrition-to-orbital translator table maps each NutritionPhaseId to a primary and secondary OrbitalPhaseId. If the user's logged nutrition phase implies orbital phase A, but the inference engine's top result is phase B, and the cyclic distance between A and B is ≥1, a mismatch is flagged.

Mismatch severity: cyclic distance ≥3 (out of 4 maximum) = strong mismatch; distance 1–2 = mild mismatch. Strong mismatches sit on opposite sides of the physiological cycle and represent the most significant misalignment.

The mismatch gate requires: a different phase than the top inferred phase, topScore > 0.5, and confidence not "low." This prevents noisy low-data mismatch alerts.

A nutrition suggestion (suggestedNutritionPhaseId and its rationale) is always populated when confidence is moderate or high, regardless of mismatch. On mismatch, the suggestion explains the misalignment. Without mismatch, it confirms or contextualizes the current protocol.

---

## 8. The Training Readiness Interpreter

The training readiness interpreter sits above the trend engine and reads the same `DailyIndex` window plus today's qualitative snapshot and recent training logs to classify the appropriate training mode for the day.

### Four training modes

**Compound Performance-Favoring:** The highest readiness state. Requires all gates to pass: recovery need ≤ 2.0, physical energy ≥ 4, mental fog ≤ 2, sensory load ≤ 2, emotional stability ≥ 3, HRV not in declining trend, and no recent pattern of late lifting disrupting sleep. If all seven gates pass and today's snapshot exists, compound performance work is appropriate.

**Hypertrophy Volume-Favoring:** The productive middle state. Requires: recovery need < 3.0, physical energy ≥ 3, motivation ≥ 3, sensory load ≤ 3, and HRV not in a sustained 3-day decline. Up to one gate failure is tolerated. This is appropriate for most training days when compound performance gates are not fully cleared.

**Isolation & Stability-Favoring:** The conservative productive state. Reached when hypertrophy gates fail by more than one. Isolation work produces meaningful stimulus without requiring top-end CNS sharpness, coordination precision, or peak motivation. Appropriate when sensory load, mental fog, or energy are reduced but recovery mode is not yet indicated.

**Recovery Training-Favoring:** The protective state. Triggered by any single strong recovery signal: recovery need ≥ 3.5, physical energy ≤ 1.5, poor sleep (quality ≤ 1.5 and <6 hours), HRV declining for 3+ consecutive logged days, RHR rising for 3+ consecutive logged days, subjective recovery need rising for 4+ consecutive days, or average deep sleep below 45 minutes over the last 3 logged nights. Recovery mode does not mean no training — it means purposeful light movement that keeps the system engaged without compounding accumulated strain.

### Reasoning transparency

Every readiness assessment returns 2–4 plain-text sentences explaining exactly what signals drove the classification and what gate failed or passed. The UI displays this reasoning so you always know why a given mode was selected — it is not a black box.

### Data quality

The interpreter tracks data quality (sparse / partial / full) and confidence (low / moderate / high) based on whether today's qualitative snapshot, recent quantitative trend data, and training history are all available. The readiness classification degrades gracefully when data is sparse — it defaults toward conservative routing rather than overcalling readiness.

---

## 9. The Trend Engine

The trend engine is the data-joining and signal-extraction layer that connects raw log entries to the higher reasoning engines.

### DailyIndex

Each day produces a `DailyIndex` record — a unified per-day object that joins all available fields from the qualitative log, the quantitative log, and derived composite scores. Fields are optional — the index holds whatever was logged for that day. The trend engine operates on arrays of `DailyIndex` objects ordered oldest to newest.

`buildDailyIndices(snapshots, quantitativeLogs, windowDays)` produces the rolling window. Days missing either a qualitative or quantitative entry still appear in the index with whichever fields are available.

### TrendSignal computation

`buildTrendSignals(indices)` computes per-signal trend summaries for the 23 tracked signal keys. Each signal produces: direction (rising / falling / stable), current value (most recent non-null), 7-day delta, average over the window, and the full array of data points for sparkline rendering.

Direction is computed from the endpoint delta normalized against the signal's range over the window. A 20% range threshold determines whether a directional change is meaningful or noise.

### Cross-layer interpretation detection

`detectInterpretations(indices)` identifies named multi-signal patterns. For example: simultaneous HRV decline + rising recovery need + worsening sleep quality is flagged as a meaningful convergence rather than three separate noise signals. These interpretations appear as contextual annotations in the Insights tab's trend section.

---

## 10. The Recommendation Engine

The recommendation engine applies six pattern detection rules to the last 14 days of blocks, snapshots, and training logs. All rules require a minimum number of occurrences before surfacing a suggestion — the system never recommends on a single data point.

**Rule 1 — High-resistance block type clustering (≥3 occurrences, pattern_backed):**
If the same block type consistently receives resistance ratings of 4 or 5 across at least 3 sessions in the last two weeks, the system surfaces a timing shift suggestion. The reasoning explicitly frames this as a scheduling mismatch rather than a discipline failure: "this is a consistent pattern, not an occasional difficulty."

**Rule 2 — Poor sleep + high block load (≥3 low-sleep days, pattern_backed):**
If 3 or more days in the last two weeks showed sleep hours below 6.5 or sleep quality at or below 2, the system suggests reducing optional blocks on poor-sleep days and protecting recovery time.

**Rule 3 — High sensory load pattern (≥3 high-sensory days, pattern_backed):**
If sensory load baseline or noise aversion reaches 4 or higher on at least 3 days in the last two weeks, the system suggests scheduling errands in early-morning low-crowd windows and adding a recovery block after public exposure.

**Rule 4 — Expansion blocks on recovery days coinciding with high overload (≥2 occurrences, emerging):**
If expansion-tagged blocks on recovery-mode days have coincided with overload ratings of 4 or 5 at least twice, the system surfaces this as an emerging pattern and suggests replacing expansion blocks with structuring or rest blocks on recovery days.

**Rule 5 — Late lifting and bedtime disruption (≥2 occurrences, emerging):**
If lift sessions at 7pm or later coincide with bedtime impact ratings of 4 or 5 at least twice in recent training logs, the system suggests moving sessions before 6pm or reducing intensity on evening sessions.

**Rule 6 — Pre-lift meal timing (≥2 occurrences, emerging):**
If pre-lift meal timing falls outside the 30–90 minute window on at least 2 occasions that also show low pre-session motivation (≤ 3), the system suggests targeting 45–60 minutes before the session as the ideal fueling window.

The distinction between **pattern_backed** (≥3 points, high certainty) and **emerging** (2 points, early signal) is reflected in the confidence badge and the framing of the recommendation body. Emerging recommendations explicitly acknowledge they may be starting to show a pattern rather than claiming certainty.

---

## 11. Meal Planning — Nutrition Phases and Templates

The Meals tab provides structured, macro-calculated meal templates organized by nutrition phase and meal slot.

### Nutrition phases

All eight phases have defined descriptions and macro target profiles. Daily macro targets (`PHASE_DAILY_TARGETS`) specify protein, carbohydrate, and fat grams for each phase. These appear as a macro bar at the top of the Meals tab.

### Meal slot system

Seven canonical meal slots define *when* meals happen relative to training:

| Slot | When |
|---|---|
| Pre-Cardio | Before cardio session |
| Post-Cardio | After cardio session |
| Mid-Morning | Between cardio and lifting |
| Pre-Lift | Before lift session |
| Post-Lift | After lift session |
| Evening | Final meal of the day |
| Protein Reserve | Late protein maintenance |

Each slot has a defined order (slotOrder 1–7) used to sort the display.

### Meal templates

Templates are keyed by the compound ID format `{nutritionPhaseId}_{mealSlot}` — for example, `base_precardio` or `recomp_postlift`. Templates are pre-built for four phases (Base, Carb-Up, Recomp, Deload) and every slot within those phases. Each template contains:

- An ingredient list with unit amounts and prep notes.
- Per-line macro calculations (kcal, protein, carbs, fat) derived from the ingredient database.
- Slot totals and phase daily totals.

### Ingredient database

Eight tracked ingredients with full macro profiles per unit:
- MCT oil, flaxseed, rolled oats, dextrin (fast carbohydrate), whey protein isolate, Greek yogurt, banana, whole egg.

Each ingredient specifies unit type, kcal per unit, protein, carbs, and fat per unit, allowing macro totals to be computed precisely from any combination of ingredients and amounts.

---

## 12. Backup and Restore System

Because the app is local-first (all data lives on device in AsyncStorage), data preservation is a first-class concern. A full backup and restore system is built into the app as a durable failsafe against device loss, app reinstallation, or storage reset after a republish.

### Accessing the system

Tap the **shield icon** in the top-right corner of the Log tab header. This opens the Data & Backup screen as a modal.

### Export

Tap **Export Backup** to serialize the complete app state into a single versioned JSON file. The file includes:

- `_meta` block: schema version, app ID, app version, export timestamp, and record counts per collection.
- `config`: current nutrition phase ID and onboarding state.
- `blockTemplates`: all recurring schedule template definitions.
- `blocks`: all schedule block entries, including actuals, ratings, sensory flags, and deviation data.
- `snapshots`: all qualitative daily log entries, including raw slider values and derived composite scores.
- `quantitativeLogs`: all quantitative entries (sleep stages, HRV, RHR, body composition, waist, hormonal signals).
- `trainingLogs`: all cardio and lift sessions with all subjective ratings.

Derived fields (like adherenceScore and adhdPullScore) are included for human readability but are re-derived on import — they are never used as a source of truth on restore.

**On native (iOS/Android):** the file is written to the app's cache directory and shared through the OS share sheet — you can save it to Files, AirDrop it, email it, or send it to a cloud storage app.

**On web:** a download is triggered automatically.

After export, a success card confirms the timestamp and full record count breakdown.

### Import

Tap **Select Backup File** to open a file picker. Select any `.json` file previously exported from this app.

The app validates the file before showing any import options:
- Confirms the file is valid JSON.
- Checks that `_meta.appId` matches (`audhd-schedule-os`).
- Checks that `schemaVersion` is not from a future version of the app.
- Checks that all required collections are present.
- Applies any schema migrations needed (migration pipeline supports sequential version upgrades).

If validation fails, a specific error message explains exactly why the file was rejected.

If validation passes, a **preview card** appears showing:
- Export timestamp, app version, and schema version of the backup.
- **Earliest and latest record date** across all collections — confirming this is the right backup file covering the right date range.
- Per-collection record counts and total.

Two action options are then offered:

**Restore All (Replace)** — the primary disaster recovery path. Clears all existing app data and replaces it with the backup. Requires typing `RESTORE` to confirm. This is the correct choice after a republish or storage reset: the backup is treated as the authoritative source of truth.

**Merge Into Existing** — the secondary path. Adds backup records alongside existing data. Conflicts are resolved in favor of the backup on every collection (backup record wins on matching ID or date). Requires typing `MERGE` to confirm.

After either operation: all derived fields are recomputed from the restored raw data (block deviations, day scores), the full state is written to AsyncStorage, the app context reloads, and recommendations are regenerated from the restored data. The restored app computes identical orbital inferences, trend signals, training readiness assessments, and recommendations as it did before — because the raw data is the source of truth.

### Schema versioning and future migrations

The backup format carries `schemaVersion: 1`. Future structural changes to the data model (renamed fields, new required collections, type changes) will increment the schema version and add a migration function. Migrations are applied sequentially: a v1 backup loaded into a v3 app runs `migrateV1toV2()` then `migrateV2toV3()` before the payload is validated and imported. Adding new optional fields to existing records does not require a version bump.

---

## 13. Local-First Architecture

All data is stored exclusively on-device using React Native AsyncStorage under the key `@audhd_os_state_v1`. No data is sent to a server. No account is required. No internet connection is needed for any app functionality.

The app state is a single JSON object (`AppState`) that contains all collections. Writes are debounced by 400ms to avoid unnecessary I/O during rapid form interactions. Reads happen once at app startup; from that point the state lives in React context and is updated in memory with each write.

Record IDs are generated as `Date.now().toString() + Math.random().toString(36).substring(2, 7)` — timestamp-anchored to make them naturally ordered, with 5 random characters appended to prevent collision on rapid entry.

The four reasoning engines (orbital inference, training readiness, trend engine, recommendations) are all pure functions with no side effects and no storage reads — they receive data as arguments and return structured output. This means the app can re-run any engine at any time with the same inputs and get the same output, which is the foundation of the backup restore guarantee.

---

## 14. Design Principles and Constraints

**The app reads state, it does not assign blame.** Every signal interpretation, mismatch alert, recommendation, and training mode classification is framed as information about the environment and the schedule — not as an assessment of the person's performance or discipline.

**Confidence gates protect against false precision.** The orbital engine, training readiness interpreter, and recommendation engine all require minimum data thresholds before surfacing conclusions. Low-confidence outputs are clearly labeled as such. No mismatch is flagged on fewer than 3 days of data.

**Derived scores are transparent.** Every composite score (ADHD Pull, Autism Pull, Recovery Need, phase likelihoods, training mode, adherence percentage) is derived from documented formulas that the user can reason about. The Insights tab's reasoning display and the training readiness text output are designed to make the logic inspectable, not opaque.

**The three layers are never collapsed.** The SchedulePhaseTag system exists to annotate schedule decisions. The NutritionPhaseId exists to track your dietary protocol. The OrbitalPhaseId exists to read your physiological state. These three domains operate at different timescales and serve different purposes. The translator table creates a principled bridge between Nutrition and Orbital for comparison only — it does not replace either layer's independent meaning.

**Override is always available.** The orbital nutrition suggestion highlights a chip but does not force a selection. The training readiness mode is a classification, not a lock. Recommendations are dismissible. The user retains full agency over every decision; the app's role is to provide a structured, evidence-based orientation before that decision is made.

**Recovery is protected before optimization is attempted.** In the recommendation engine, the training readiness interpreter, and the orbital phase scoring, recovery signals take priority. The system routes toward rest and protection before it routes toward performance or growth. This is a deliberate design choice based on the understanding that for a chronically dysregulated nervous system, the cost of over-reaching is substantially higher than the cost of under-reaching.
