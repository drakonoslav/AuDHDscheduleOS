import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhaseTag } from "@/components/ui/PhaseTag";
import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { NUTRITION_PHASE_MAP } from "@/data/nutritionPhases";
import { computeNutritionAdherence, ingredientDisplayName, slotDisplayName } from "@/engine/nutritionAdherence";
import type { BlockStatus, NutritionPhaseId, ScheduleBlock } from "@/types";

// ─── Training Log Card ────────────────────────────────────────────────────────

function TrainingCard({ date, type }: { date: string; type: "cardio" | "lift" }) {
  const { trainingForDate } = useApp();
  const logs = trainingForDate(date).filter((l) => l.type === type);
  const done = logs.length > 0;
  const first = logs[0];
  const label = type === "cardio" ? "Cardio" : "Lift";
  const icon = type === "cardio" ? "activity" : "zap";

  return (
    <Pressable
      onPress={() => {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
        router.push({ pathname: "/training-log", params: { date, type } });
      }}
      style={({ pressed }) => [
        styles.snapshotCard,
        pressed && { opacity: 0.85 },
        done && styles.snapshotCardDone,
      ]}
    >
      <View style={styles.snapshotLeft}>
        <Feather
          name={done ? "check-circle" : (icon as any)}
          size={18}
          color={done ? Colors.light.structuring : Colors.light.textSecondary}
        />
        <View>
          <Text style={styles.snapshotTitle}>
            {done ? `${label} Done` : `Log ${label}`}
          </Text>
          <Text style={styles.snapshotSub}>
            {done && first
              ? [
                  first.plannedTime,
                  first.intensity,
                  first.duration !== undefined ? `${first.duration} min` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : type === "cardio"
              ? "Time, intensity, meal timing, subjective ratings"
              : "Time, intensity, meal timing, subjective ratings"}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={16} color={Colors.light.textMuted} />
    </Pressable>
  );
}

// ─── Nutrition Score Card ─────────────────────────────────────────────────────

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={nsStyles.barTrack}>
      <View style={[nsStyles.barFill, { width: `${Math.round(value * 100)}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function NutritionScoreCard({
  blocks,
  nutritionPhaseId,
  date,
}: {
  blocks: ScheduleBlock[];
  nutritionPhaseId: NutritionPhaseId;
  date: string;
}) {
  const result = useMemo(
    () => computeNutritionAdherence(blocks, nutritionPhaseId),
    [blocks, nutritionPhaseId],
  );
  const phaseName = NUTRITION_PHASE_MAP[nutritionPhaseId]?.phaseName ?? nutritionPhaseId;

  const scoreColor =
    result.overallScore >= 75
      ? Colors.light.structuring
      : result.overallScore >= 45
      ? Colors.light.amber
      : Colors.light.rose;

  // Whether the user has acted on any meal blocks today (done / partial / skipped).
  // Until that happens we show planned totals so the card is useful before the day is logged.
  const anyActed = result.completedMeals > 0 ||
    blocks.some((b) => b.blockType === "meal" && b.status === "skipped");

  const displayKcal    = anyActed ? result.actualKcal    : result.plannedKcal;
  const displayProtein = anyActed ? result.actualProtein : result.plannedProtein;
  const kcalRatio      = anyActed
    ? result.caloricAdherence
    : result.targetKcal > 0 ? Math.min(1, result.plannedKcal / result.targetKcal) : 0;
  const proteinRatio   = anyActed
    ? result.proteinAdherence
    : result.targetProtein > 0 ? Math.min(1, result.plannedProtein / result.targetProtein) : 0;

  const rows: { label: string; value: number; actual: string; target: string; color: string }[] = [
    {
      label: "Meals",
      value: result.mealAdherence,
      actual: `${result.completedMeals}`,
      target: `${result.totalMeals}`,
      color: Colors.light.tint,
    },
    {
      label: "Kcal",
      value: kcalRatio,
      actual: `${displayKcal}`,
      target: `${result.targetKcal}`,
      color: Colors.light.navyLight,
    },
    {
      label: "Protein",
      value: proteinRatio,
      actual: `${displayProtein}g`,
      target: `${result.targetProtein}g`,
      color: Colors.light.structuring,
    },
    {
      label: "Timing",
      value: result.timingScore,
      actual: `${Math.round(result.timingScore * result.criticalScheduled)}`,
      target: `${result.criticalScheduled} critical`,
      color: Colors.light.amber,
    },
  ];

  return (
    <Pressable
      onPress={() => {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
        router.push({ pathname: "/snapshot", params: { date } });
      }}
      style={({ pressed }) => [nsStyles.card, pressed && { opacity: 0.88 }]}
    >
      <View style={nsStyles.headerRow}>
        <Text style={nsStyles.cardTitle}>Nutrition Score</Text>
        <View style={nsStyles.phaseChip}>
          <Text style={nsStyles.phaseChipText}>{phaseName}</Text>
          <Feather name="edit-2" size={10} color={Colors.light.textMuted} />
        </View>
      </View>

      <View style={nsStyles.scoreRow}>
        <Text style={[nsStyles.scoreNum, { color: scoreColor }]}>{result.overallScore}</Text>
        <Text style={nsStyles.scoreOf}>/100</Text>
        <View style={nsStyles.scoreMeta}>
          <Text style={nsStyles.scoreMetaLine}>
            {result.completedMeals}/{result.totalMeals} meals · {result.actualKcal} kcal
          </Text>
          {result.criticalMissed.length > 0 && (
            <Text style={nsStyles.criticalMissed}>
              ⚠ Missed: {result.criticalMissed.map(slotDisplayName).join(", ")}
            </Text>
          )}
        </View>
      </View>

      {rows.map((row) => (
        <View key={row.label} style={nsStyles.metricRow}>
          <Text style={nsStyles.metricLabel}>{row.label}</Text>
          <ScoreBar value={row.value} color={row.color} />
          <Text style={nsStyles.metricVal}>
            {row.actual}
            <Text style={nsStyles.metricTarget}> / {row.target}</Text>
          </Text>
        </View>
      ))}

      {result.ingredientTotals.length > 0 && (
        <>
          <View style={nsStyles.ingDivider} />
          <Text style={nsStyles.ingHeader}>Ingredients</Text>
          <View style={nsStyles.ingGrid}>
            {result.ingredientTotals.map((ing) => {
              const displayActual  = anyActed ? ing.actual  : ing.planned;
              const ratio          = ing.planned > 0
                ? Math.min(1, (anyActed ? ing.actual : ing.planned) / ing.planned)
                : 0;
              const fmtAmt = (n: number) =>
                ing.unit === "g" ? `${Math.round(n)}g` : `${n % 1 === 0 ? n : n.toFixed(1)} ${ing.unit}`;
              return (
                <View key={ing.ingredientId} style={nsStyles.ingRow}>
                  <Text style={nsStyles.ingName}>{ingredientDisplayName(ing.ingredientId)}</Text>
                  <View style={nsStyles.ingBarTrack}>
                    <View style={[nsStyles.ingBarFill, { width: `${Math.round(ratio * 100)}%` as any }]} />
                  </View>
                  <Text style={nsStyles.ingAmt}>
                    {fmtAmt(displayActual)}
                    <Text style={nsStyles.ingPlanned}> / {fmtAmt(ing.planned)}</Text>
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </Pressable>
  );
}

const nsStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.text, textTransform: "uppercase", letterSpacing: 0.4 },
  phaseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.light.creamMid,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  phaseChipText: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.light.textSecondary },
  scoreRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 12 },
  scoreNum: { fontFamily: "Inter_700Bold", fontSize: 36, letterSpacing: -1 },
  scoreOf: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.textMuted, marginBottom: 2 },
  scoreMeta: { flex: 1, marginLeft: 8 },
  scoreMetaLine: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary },
  criticalMissed: { fontFamily: "Inter_500Medium", fontSize: 10, color: Colors.light.rose, marginTop: 2 },
  metricRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  metricLabel: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.light.textMuted, width: 52 },
  barTrack: { flex: 1, height: 5, backgroundColor: Colors.light.borderLight, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 5, borderRadius: 3 },
  metricVal: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.light.text, width: 70, textAlign: "right" },
  metricTarget: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textMuted },
  ingDivider: { height: 1, backgroundColor: Colors.light.borderLight, marginVertical: 10 },
  ingHeader: { fontFamily: "Inter_500Medium", fontSize: 10, color: Colors.light.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  ingGrid: { gap: 5 },
  ingRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  ingName: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary, width: 54 },
  ingBarTrack: { flex: 1, height: 4, backgroundColor: Colors.light.borderLight, borderRadius: 2, overflow: "hidden" },
  ingBarFill: { height: 4, backgroundColor: "#8FA8BE", borderRadius: 2 },
  ingAmt: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.light.text, width: 74, textAlign: "right" },
  ingPlanned: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textMuted },
});

const STATUS_OPTIONS: BlockStatus[] = ["done", "partial", "skipped", "moved"];

const STATUS_COLORS: Record<BlockStatus, string> = {
  planned: Colors.light.textMuted,
  done: Colors.light.structuring,
  skipped: Colors.light.rose,
  partial: Colors.light.amber,
  moved: Colors.light.amber,
};

const STATUS_LABELS: Record<BlockStatus, string> = {
  planned: "Planned",
  done: "Done",
  skipped: "Skipped",
  partial: "Partial",
  moved: "Moved",
};

function LogBlockCard({ block, onUpdate }: { block: ScheduleBlock; onUpdate: () => void }) {
  const deviation = block.startDevMin;
  const devLabel =
    deviation !== undefined && block.actualStart
      ? deviation === 0 ? "on time" : deviation > 0 ? `+${deviation}m late` : `${Math.abs(deviation)}m early`
      : null;
  const hasRatings = block.ratings && Object.keys(block.ratings).length > 0;
  const adherence = block.adherenceScore;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onUpdate();
      }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardTime}>{block.plannedStart} – {block.plannedEnd}</Text>
          <Text style={styles.cardLabel}>{block.label}</Text>
        </View>
        <View style={styles.cardHeaderRight}>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[block.status] + "22" }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[block.status] }]}>
              {STATUS_LABELS[block.status]}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardMeta}>
        <PhaseTag phase={block.phaseTag} small />
        {devLabel && (
          <Text style={[styles.devLabel, { color: STATUS_COLORS[block.status] }]}>{devLabel}</Text>
        )}
        {adherence !== undefined && block.status !== "planned" && (
          <Text style={styles.adherenceLabel}>Adherence: {adherence}%</Text>
        )}
      </View>

      {block.actualStart && (
        <Text style={styles.actualTime}>
          Actual: {block.actualStart} – {block.actualEnd ?? "?"}
        </Text>
      )}

      <View style={styles.cardFooter}>
        {hasRatings ? (
          <Text style={styles.ratedLabel}>
            <Feather name="check-circle" size={11} color={Colors.light.structuring} /> Rated
          </Text>
        ) : (
          <Text style={styles.unratedLabel}>Tap to log actuals + ratings</Text>
        )}
        <Feather name="chevron-right" size={14} color={Colors.light.textMuted} />
      </View>
    </Pressable>
  );
}

function QuantLogCard({ date }: { date: string }) {
  const { quantitativeLogForDate } = useApp();
  const existing = quantitativeLogForDate(date);
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/quantitative-log", params: { date } });
      }}
      style={({ pressed }) => [
        styles.snapshotCard,
        pressed && { opacity: 0.85 },
        existing ? styles.snapshotCardDone : undefined,
      ]}
    >
      <View style={styles.snapshotLeft}>
        <Feather
          name={existing ? "check-circle" : "bar-chart-2"}
          size={18}
          color={existing ? Colors.light.structuring : Colors.light.textSecondary}
        />
        <View>
          <Text style={styles.snapshotTitle}>
            {existing ? "Quantitative Log Done" : "Quantitative Daily Log"}
          </Text>
          <Text style={styles.snapshotSub}>
            {existing
              ? [
                  existing.hrv !== undefined ? `HRV ${existing.hrv}ms` : null,
                  existing.rhr !== undefined ? `RHR ${existing.rhr}bpm` : null,
                  existing.weightLbs !== undefined ? `${existing.weightLbs}lbs` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Logged"
              : "Sleep stages, HRV, RHR, body composition, waist, hormones"}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={16} color={Colors.light.textMuted} />
    </Pressable>
  );
}

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const { today, blocksForDate, snapshotForDate, state } = useApp();
  const [selectedDate, setSelectedDate] = useState(today);

  const blocks = useMemo(() => {
    const raw = blocksForDate(selectedDate);
    return [...raw].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));
  }, [blocksForDate, selectedDate]);

  const snapshot = snapshotForDate(selectedDate);
  // Use the phase logged in that day's snapshot; fall back to the global phase setting
  const nutritionPhaseId: NutritionPhaseId =
    snapshot?.nutritionPhaseId ?? state.currentNutritionPhaseId;
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const dates = useMemo(() => {
    const arr: string[] = [];
    for (let i = -90; i <= 0; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      arr.push(d.toISOString().split("T")[0]!);
    }
    return arr.reverse(); // today first, scroll right = past
  }, []);

  const doneBlocks = blocks.filter((b) => b.status === "done");
  const skippedBlocks = blocks.filter((b) => b.status === "skipped");
  const pendingBlocks = blocks.filter((b) => b.status === "planned");

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Log</Text>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: "/training-log", params: { date: selectedDate } });
            }}
            style={({ pressed }) => [styles.trainingBtn, pressed && { opacity: 0.7 }]}
          >
            <Feather name="zap" size={16} color={Colors.light.textSecondary} />
            <Text style={styles.trainingBtnText}>Training</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/backup");
            }}
            style={({ pressed }) => [styles.backupBtn, pressed && { opacity: 0.7 }]}
          >
            <Feather name="shield" size={16} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Date selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateBar} contentContainerStyle={styles.dateBarContent}>
        {dates.map((d) => {
          const date = new Date(d + "T00:00:00");
          const isSelected = d === selectedDate;
          const isToday = d === today;
          return (
            <Pressable
              key={d}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedDate(d);
              }}
              style={[styles.dateChip, isSelected && styles.dateChipSelected]}
            >
              <Text style={[styles.dateDow, isSelected && styles.dateTextSelected]}>
                {isToday ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" })}
              </Text>
              <Text style={[styles.dateNum, isSelected && styles.dateTextSelected]}>
                {date.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Qualitative daily log */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: "/snapshot", params: { date: selectedDate } });
          }}
          style={({ pressed }) => [styles.snapshotCard, pressed && { opacity: 0.85 }, snapshot && styles.snapshotCardDone]}
        >
          <View style={styles.snapshotLeft}>
            <Feather
              name={snapshot ? "check-circle" : "activity"}
              size={18}
              color={snapshot ? Colors.light.structuring : Colors.light.textSecondary}
            />
            <View>
              <Text style={styles.snapshotTitle}>
                {snapshot ? "Qualitative Log Done" : "Qualitative Daily Log"}
              </Text>
              <Text style={styles.snapshotSub}>
                {snapshot
                  ? `Sleep ${snapshot.sleepHours}h · Mode: ${snapshot.recommendedDayMode?.replace("_", " ") ?? "—"}`
                  : "Sleep, energy, sensory, mood — subjective ratings"}
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={16} color={Colors.light.textMuted} />
        </Pressable>

        {/* Quantitative daily log */}
        <QuantLogCard date={selectedDate} />

        {/* Training logs */}
        <TrainingCard date={selectedDate} type="cardio" />
        <TrainingCard date={selectedDate} type="lift" />

        {/* Nutrition score — computed from meal block statuses + active phase */}
        {blocks.some((b) => b.blockType === "meal") && (
          <NutritionScoreCard blocks={blocks} nutritionPhaseId={nutritionPhaseId} date={selectedDate} />
        )}

        {/* Stats row */}
        {blocks.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.light.structuring }]}>{doneBlocks.length}</Text>
              <Text style={styles.statLabel}>Done</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.light.amber }]}>{pendingBlocks.length}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.light.rose }]}>{skippedBlocks.length}</Text>
              <Text style={styles.statLabel}>Skipped</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>
                {blocks.length > 0 ? `${Math.round((doneBlocks.length / blocks.length) * 100)}%` : "—"}
              </Text>
              <Text style={styles.statLabel}>Adherence</Text>
            </View>
          </View>
        )}

        {/* Block list */}
        <Text style={styles.sectionTitle}>Blocks</Text>
        {blocks.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="edit-3" size={32} color={Colors.light.textMuted} />
            <Text style={styles.emptyTitle}>No blocks to log</Text>
            <Text style={styles.emptyBody}>Add blocks in the Plan tab first.</Text>
          </View>
        ) : (
          <View style={styles.blockList}>
            {blocks.map((block) => (
              <LogBlockCard
                key={block.id}
                block={block}
                onUpdate={() => router.push({ pathname: "/block-detail", params: { id: block.id } })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 26, color: Colors.light.text, letterSpacing: -0.5 },
  trainingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  trainingBtnText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textSecondary },
  backupBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
  },
  dateBar: { flexGrow: 0, height: 78, marginBottom: 4 },
  dateBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 6, alignItems: "center" },
  dateChip: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    minWidth: 60,
  },
  dateChipSelected: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  dateDow: { fontFamily: "Inter_500Medium", fontSize: 10, color: Colors.light.textMuted, textTransform: "uppercase" },
  dateNum: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.text },
  dateTextSelected: { color: Colors.light.surface },
  scroll: { paddingHorizontal: 16 },
  snapshotCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  snapshotCardDone: { borderColor: Colors.light.sageLight },
  snapshotLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  snapshotTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  snapshotSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textMuted, marginTop: 1 },
  statsRow: {
    flexDirection: "row",
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 14,
    padding: 12,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.light.text },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textMuted, marginTop: 2 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.light.text, marginBottom: 8 },
  blockList: { gap: 6 },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  cardHeaderLeft: { flex: 1 },
  cardHeaderRight: {},
  cardTime: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textMuted, marginBottom: 2 },
  cardLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.light.text },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  devLabel: { fontFamily: "Inter_400Regular", fontSize: 11 },
  adherenceLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textMuted },
  actualTime: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary, marginBottom: 6 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  ratedLabel: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.light.structuring },
  unratedLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textMuted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.light.textSecondary },
  emptyBody: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textMuted, textAlign: "center" },
});
