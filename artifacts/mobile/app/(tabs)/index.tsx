import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo } from "react";
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
import { NUTRITION_TO_ORBITAL } from "@/data/nutritionToOrbitalMap";
import { ORBITAL_PHASE_MAP } from "@/data/orbitalPhases";
import { buildDailyIndices } from "@/engine/trendEngine";
import {
  interpretTrainingReadiness,
  TRAINING_MODE_DISPLAY,
} from "@/engine/trainingReadiness";
import type { ScheduleBlock } from "@/types";

const BLOCK_TYPE_ICONS: Record<string, string> = {
  wake: "sunrise",
  meal: "coffee",
  work: "briefcase",
  commute: "navigation",
  cardio: "activity",
  lift: "zap",
  hobby: "heart",
  hygiene: "droplet",
  chores: "home",
  errands: "shopping-cart",
  bedtime: "moon",
  rest: "wind",
  other: "more-horizontal",
};

const STATUS_COLORS: Record<string, string> = {
  planned: Colors.light.textMuted,
  done: Colors.light.structuring,
  skipped: Colors.light.rose,
  partial: Colors.light.amber,
  moved: Colors.light.amber,
};

function BlockCard({ block, onPress }: { block: ScheduleBlock; onPress: () => void }) {
  const icon = BLOCK_TYPE_ICONS[block.blockType] ?? "more-horizontal";
  const statusColor = STATUS_COLORS[block.status] ?? Colors.light.textMuted;
  const deviation = block.startDevMin;
  const devLabel =
    deviation !== undefined && block.actualStart
      ? deviation > 0
        ? `+${deviation}m late`
        : deviation < 0
        ? `${Math.abs(deviation)}m early`
        : "on time"
      : null;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.blockCard, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.blockLeft, { borderLeftColor: statusColor }]}>
        <View style={styles.blockTimeCol}>
          <Text style={styles.blockTime} numberOfLines={1}>{block.plannedStart}</Text>
          <Text style={styles.blockTimeEnd} numberOfLines={1}>{block.plannedEnd}</Text>
        </View>
        <View style={[styles.blockIconCircle, { backgroundColor: Colors.light.creamMid }]}>
          <Feather name={icon as never} size={14} color={Colors.light.textSecondary} />
        </View>
        <View style={styles.blockContent}>
          <Text style={styles.blockLabel} numberOfLines={1}>{block.label}</Text>
          <View style={styles.blockMeta}>
            <PhaseTag phase={block.phaseTag} small />
            {devLabel && (
              <Text style={[styles.devLabel, { color: statusColor }]}>{devLabel}</Text>
            )}
          </View>
        </View>
      </View>
      <View style={styles.blockRight}>
        {block.status !== "planned" && (
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {block.status}
            </Text>
          </View>
        )}
        <Feather name="chevron-right" size={14} color={Colors.light.textMuted} />
      </View>
    </Pressable>
  );
}

function DayModeCard({ mode }: { mode: string }) {
  const modeLabels: Record<string, { label: string; sub: string; color: string }> = {
    expansion_favoring: { label: "Expansion Day", sub: "High explorer pull. Good for novelty and ideas.", color: Colors.light.expansion },
    structuring_favoring: { label: "Structuring Day", sub: "Strong stabilizer pull. Routines and focus.", color: Colors.light.structuring },
    recovery_favoring: { label: "Recovery Day", sub: "High need detected. Protect your energy.", color: Colors.light.recovery },
    mixed: { label: "Mixed Day", sub: "Balanced state. Stay flexible.", color: Colors.light.textSecondary },
  };
  const info = modeLabels[mode] ?? modeLabels["mixed"]!;
  return (
    <View style={[styles.dayModeCard, { borderLeftColor: info.color }]}>
      <Text style={[styles.dayModeLabel, { color: info.color }]}>{info.label}</Text>
      <Text style={styles.dayModeSub}>{info.sub}</Text>
    </View>
  );
}

function TrainingReadinessCard() {
  const { today, snapshotForDate, state } = useApp();
  const snapshot = snapshotForDate(today);

  const readiness = useMemo(() => {
    const indices = buildDailyIndices(state.snapshots, state.quantitativeLogs ?? [], 14);
    const recentTraining = state.trainingLogs.filter((l) => {
      const d = new Date(l.date);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 14);
      return d >= cutoff;
    });
    return interpretTrainingReadiness(snapshot, indices, recentTraining);
  }, [snapshot, state.snapshots, state.quantitativeLogs, state.trainingLogs, today]);

  const display = TRAINING_MODE_DISPLAY[readiness.mode];

  const CONF_COLORS = {
    high:     Colors.light.structuring,
    moderate: Colors.light.amber,
    low:      Colors.light.textMuted,
  };
  const QUALITY_LABELS = {
    full:    "Full data",
    partial: "Partial data",
    sparse:  "Sparse data",
  };

  return (
    <View style={[trc.card, { borderLeftColor: display.color }]}>
      <View style={trc.topRow}>
        <View>
          <Text style={trc.layer}>Training Readiness</Text>
          <Text style={[trc.mode, { color: display.color }]}>{display.label}</Text>
        </View>
        <View style={trc.badges}>
          <View style={[trc.badge, { backgroundColor: CONF_COLORS[readiness.confidence] + "22" }]}>
            <Text style={[trc.badgeText, { color: CONF_COLORS[readiness.confidence] }]}>
              {readiness.confidence.charAt(0).toUpperCase() + readiness.confidence.slice(1)} conf.
            </Text>
          </View>
          <View style={[trc.badge, { backgroundColor: Colors.light.creamMid }]}>
            <Text style={[trc.badgeText, { color: Colors.light.textMuted }]}>
              {QUALITY_LABELS[readiness.dataQuality]}
            </Text>
          </View>
        </View>
      </View>

      <Text style={trc.desc}>{display.description}</Text>

      <View style={trc.reasoningList}>
        {readiness.reasoning.map((r, i) => (
          <View key={i} style={trc.reasoningRow}>
            <View style={[trc.reasoningDot, { backgroundColor: display.color }]} />
            <Text style={trc.reasoningText}>{r}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const trc = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  layer: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.light.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  mode: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  badges: { gap: 4, alignItems: "flex-end" },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
  },
  desc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 10,
    lineHeight: 17,
  },
  reasoningList: { gap: 5 },
  reasoningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  reasoningDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 5,
    flexShrink: 0,
  },
  reasoningText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
    flex: 1,
    lineHeight: 17,
  },
});

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { today, blocksForDate, snapshotForDate, state } = useApp();

  const blocks = useMemo(() => {
    const raw = blocksForDate(today);
    return [...raw].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));
  }, [blocksForDate, today]);

  const snapshot = snapshotForDate(today);
  const dayMode = snapshot?.recommendedDayMode ?? null;

  const nutritionPhase = NUTRITION_PHASE_MAP[state.currentNutritionPhaseId];
  const orbitalMap = NUTRITION_TO_ORBITAL[state.currentNutritionPhaseId];
  const orbitalPhase = orbitalMap ? ORBITAL_PHASE_MAP[orbitalMap.orbitalPhasePrimary] : null;

  const doneCount = blocks.filter((b) => b.status === "done").length;
  const totalCount = blocks.length;

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.dateLabel}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </Text>
          <Text style={styles.appTitle}>Schedule OS</Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/snapshot");
          }}
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}
        >
          <Feather name="activity" size={18} color={Colors.light.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Phase context strip */}
        <View style={styles.phaseStrip}>
          <View style={styles.phaseItem}>
            <Text style={styles.phaseKey}>Nutrition</Text>
            <Text style={styles.phaseVal}>{nutritionPhase?.phaseName ?? "—"}</Text>
          </View>
          <View style={styles.phaseDivider} />
          <View style={styles.phaseItem}>
            <Text style={styles.phaseKey}>Orbital</Text>
            <Text style={styles.phaseVal}>{orbitalPhase?.orbitalPhaseName ?? "—"}</Text>
          </View>
          <View style={styles.phaseDivider} />
          <Pressable
            style={styles.phaseItem}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/snapshot");
            }}
          >
            <Text style={styles.phaseKey}>State</Text>
            <Text style={[styles.phaseVal, { color: Colors.light.accent }]}>
              {snapshot ? "Logged" : "Log now →"}
            </Text>
          </Pressable>
        </View>

        {/* Day mode card */}
        {dayMode && <DayModeCard mode={dayMode} />}

        {/* Training readiness */}
        <TrainingReadinessCard />

        {/* Progress summary */}
        {totalCount > 0 && (
          <View style={styles.progressCard}>
            <Text style={styles.progressLabel}>
              {doneCount} / {totalCount} blocks completed
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* Blocks */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Blocks</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/plan");
            }}
          >
            <Text style={styles.sectionAction}>+ Add</Text>
          </Pressable>
        </View>

        {blocks.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={32} color={Colors.light.textMuted} />
            <Text style={styles.emptyTitle}>No blocks planned</Text>
            <Text style={styles.emptyBody}>Go to Plan to build today's schedule.</Text>
          </View>
        ) : (
          <View style={styles.blockList}>
            {blocks.map((block) => (
              <BlockCard
                key={block.id}
                block={block}
                onPress={() => router.push({ pathname: "/block-detail", params: { id: block.id } })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  dateLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
  appTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 16,
  },
  phaseStrip: {
    flexDirection: "row",
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 12,
    overflow: "hidden",
  },
  phaseItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  phaseKey: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.light.textMuted,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  phaseVal: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.light.text,
    textAlign: "center",
  },
  phaseDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  dayModeCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 12,
  },
  dayModeLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    marginBottom: 2,
  },
  dayModeSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
  progressCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    marginBottom: 12,
  },
  progressLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.light.creamMid,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.light.structuring,
    borderRadius: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.light.text,
  },
  sectionAction: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.accent,
  },
  blockList: {
    gap: 6,
  },
  blockCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 12,
    overflow: "hidden",
  },
  blockLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderLeftWidth: 3,
  },
  blockTimeCol: {
    width: 44,
  },
  blockTime: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.light.text,
  },
  blockTimeEnd: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.light.textMuted,
  },
  blockIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  blockContent: {
    flex: 1,
  },
  blockLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 3,
  },
  blockMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  devLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
  },
  blockRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    textTransform: "capitalize",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  emptyBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textMuted,
    textAlign: "center",
  },
});
