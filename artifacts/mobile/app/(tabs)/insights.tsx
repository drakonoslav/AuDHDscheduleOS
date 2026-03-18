import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { WeeklyRecommendation } from "@/types";

const TYPE_ICONS: Record<string, string> = {
  timing_shift: "clock",
  fewer_blocks: "minus-circle",
  meal_timing: "coffee",
  training_placement: "zap",
  environment: "eye-off",
  nutrition_phase: "layers",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  pattern_backed: Colors.light.structuring,
  emerging: Colors.light.amber,
  speculative: Colors.light.textMuted,
};

const CONFIDENCE_LABELS: Record<string, string> = {
  pattern_backed: "Pattern-backed",
  emerging: "Emerging",
  speculative: "Exploratory",
};

function RecCard({ rec, onDismiss }: { rec: WeeklyRecommendation; onDismiss: () => void }) {
  if (rec.dismissed) return null;
  const iconName = TYPE_ICONS[rec.type] ?? "info";
  const confColor = CONFIDENCE_COLORS[rec.confidence] ?? Colors.light.textMuted;
  return (
    <View style={styles.recCard}>
      <View style={styles.recHeader}>
        <View style={styles.recIconCircle}>
          <Feather name={iconName as never} size={15} color={Colors.light.textSecondary} />
        </View>
        <View style={styles.recHeaderText}>
          <Text style={styles.recTitle}>{rec.title}</Text>
          <View style={[styles.confBadge, { backgroundColor: confColor + "22" }]}>
            <Text style={[styles.confText, { color: confColor }]}>
              {CONFIDENCE_LABELS[rec.confidence]}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onDismiss();
          }}
          style={styles.dismissBtn}
        >
          <Feather name="x" size={14} color={Colors.light.textMuted} />
        </Pressable>
      </View>
      <Text style={styles.recBody}>{rec.body}</Text>
      <View style={styles.recActionBox}>
        <Feather name="arrow-right" size={12} color={Colors.light.accent} />
        <Text style={styles.recAction}>{rec.actionable}</Text>
      </View>
    </View>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const { state, refreshRecommendations, dismissRecommendation } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const activeRecs = useMemo(
    () => state.recommendations.filter((r) => !r.dismissed),
    [state.recommendations]
  );

  // Pattern stats from last 7 days
  const recentBlocks = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return state.blocks.filter((b) => new Date(b.date) >= cutoff);
  }, [state.blocks]);

  const recentSnaps = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return state.snapshots.filter((s) => new Date(s.date) >= cutoff);
  }, [state.snapshots]);

  const doneBlocks = recentBlocks.filter((b) => b.status === "done");
  const adherencePct = recentBlocks.length > 0
    ? Math.round((doneBlocks.length / recentBlocks.length) * 100)
    : null;

  const avgResistance = useMemo(() => {
    const rated = recentBlocks.filter((b) => b.ratings?.resistance !== undefined);
    if (rated.length === 0) return null;
    return (rated.reduce((s, b) => s + (b.ratings?.resistance ?? 0), 0) / rated.length).toFixed(1);
  }, [recentBlocks]);

  const avgSleep = useMemo(() => {
    if (recentSnaps.length === 0) return null;
    return (recentSnaps.reduce((s, sn) => s + sn.sleepHours, 0) / recentSnaps.length).toFixed(1);
  }, [recentSnaps]);

  const expansionDays = recentSnaps.filter((s) => s.recommendedDayMode === "expansion_favoring").length;
  const structuringDays = recentSnaps.filter((s) => s.recommendedDayMode === "structuring_favoring").length;
  const recoveryDays = recentSnaps.filter((s) => s.recommendedDayMode === "recovery_favoring").length;

  const highOverloadBlocks = recentBlocks.filter((b) => (b.ratings?.overload ?? 0) >= 4);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            refreshRecommendations();
          }}
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
        >
          <Feather name="refresh-cw" size={16} color={Colors.light.textSecondary} />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* 7-day stats grid */}
        <Text style={styles.sectionTitle}>Last 7 Days</Text>
        <View style={styles.statsGrid}>
          <StatCard
            label="Block adherence"
            value={adherencePct !== null ? `${adherencePct}%` : "—"}
            sub={`${doneBlocks.length}/${recentBlocks.length} blocks`}
            color={adherencePct !== null && adherencePct >= 70 ? Colors.light.structuring : Colors.light.amber}
          />
          <StatCard
            label="Avg resistance"
            value={avgResistance ?? "—"}
            sub="1–5 scale"
            color={avgResistance && parseFloat(avgResistance) >= 3.5 ? Colors.light.rose : Colors.light.structuring}
          />
          <StatCard
            label="Avg sleep"
            value={avgSleep ? `${avgSleep}h` : "—"}
            sub={`${recentSnaps.length} days logged`}
            color={avgSleep && parseFloat(avgSleep) >= 7 ? Colors.light.structuring : Colors.light.amber}
          />
          <StatCard
            label="High overload"
            value={highOverloadBlocks.length.toString()}
            sub="blocks at 4–5"
            color={highOverloadBlocks.length >= 3 ? Colors.light.rose : Colors.light.textSecondary}
          />
        </View>

        {/* Day mode distribution */}
        {recentSnaps.length > 0 && (
          <View style={styles.modeCard}>
            <Text style={styles.modeCardTitle}>Day Mode Distribution</Text>
            <View style={styles.modeRow}>
              {expansionDays > 0 && (
                <View style={[styles.modeBar, { flex: expansionDays, backgroundColor: Colors.light.phaseExpansion }]}>
                  <Text style={[styles.modeBarText, { color: Colors.light.expansion }]}>{expansionDays}d</Text>
                </View>
              )}
              {structuringDays > 0 && (
                <View style={[styles.modeBar, { flex: structuringDays, backgroundColor: Colors.light.phaseStructuring }]}>
                  <Text style={[styles.modeBarText, { color: Colors.light.structuring }]}>{structuringDays}d</Text>
                </View>
              )}
              {recoveryDays > 0 && (
                <View style={[styles.modeBar, { flex: recoveryDays, backgroundColor: Colors.light.phaseRecovery }]}>
                  <Text style={[styles.modeBarText, { color: Colors.light.recovery }]}>{recoveryDays}d</Text>
                </View>
              )}
              {recentSnaps.length - expansionDays - structuringDays - recoveryDays > 0 && (
                <View style={[styles.modeBar, { flex: recentSnaps.length - expansionDays - structuringDays - recoveryDays, backgroundColor: Colors.light.creamMid }]}>
                  <Text style={[styles.modeBarText, { color: Colors.light.textMuted }]}>
                    {recentSnaps.length - expansionDays - structuringDays - recoveryDays}d
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.modeLegend}>
              <View style={styles.modeLegendItem}>
                <View style={[styles.modeDot, { backgroundColor: Colors.light.expansion }]} />
                <Text style={styles.modeLegendText}>Expansion</Text>
              </View>
              <View style={styles.modeLegendItem}>
                <View style={[styles.modeDot, { backgroundColor: Colors.light.structuring }]} />
                <Text style={styles.modeLegendText}>Structuring</Text>
              </View>
              <View style={styles.modeLegendItem}>
                <View style={[styles.modeDot, { backgroundColor: Colors.light.recovery }]} />
                <Text style={styles.modeLegendText}>Recovery</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recommendations */}
        <View style={styles.recHeader}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          {activeRecs.length > 0 && (
            <View style={styles.recCountBadge}>
              <Text style={styles.recCountText}>{activeRecs.length}</Text>
            </View>
          )}
        </View>

        <View style={styles.recNote}>
          <Feather name="info" size={13} color={Colors.light.textMuted} />
          <Text style={styles.recNoteText}>
            Only pattern-backed suggestions appear. Better adherence does not always mean a better schedule — mismatch is detected separately.
          </Text>
        </View>

        {activeRecs.length === 0 ? (
          <View style={styles.emptyRecs}>
            <Feather name="bar-chart-2" size={32} color={Colors.light.textMuted} />
            <Text style={styles.emptyRecsTitle}>No active recommendations</Text>
            <Text style={styles.emptyRecsBody}>Log 3+ days to unlock pattern-based insights.</Text>
          </View>
        ) : (
          <View style={styles.recList}>
            {activeRecs.map((rec) => (
              <RecCard key={rec.id} rec={rec} onDismiss={() => dismissRecommendation(rec.id)} />
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
  title: { fontFamily: "Inter_700Bold", fontSize: 26, color: Colors.light.text, letterSpacing: -0.5 },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  refreshText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textSecondary },
  scroll: { paddingHorizontal: 16 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.light.text, marginBottom: 8 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
  },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.light.text, marginBottom: 2 },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textSecondary },
  statSub: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textMuted, marginTop: 2 },
  modeCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    marginBottom: 16,
  },
  modeCardTitle: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  modeRow: { flexDirection: "row", height: 32, borderRadius: 6, overflow: "hidden", gap: 2, marginBottom: 8 },
  modeBar: { alignItems: "center", justifyContent: "center", borderRadius: 4 },
  modeBarText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  modeLegend: { flexDirection: "row", gap: 12 },
  modeLegendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  modeDot: { width: 8, height: 8, borderRadius: 4 },
  modeLegendText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary },
  recHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  recCountBadge: {
    backgroundColor: Colors.light.tint,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  recCountText: { fontFamily: "Inter_700Bold", fontSize: 10, color: Colors.light.surface },
  recNote: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    backgroundColor: Colors.light.creamMid,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  recNoteText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.light.textSecondary, flex: 1, lineHeight: 16 },
  recList: { gap: 8 },
  recCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
  },
  recHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  recIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.light.creamMid,
    alignItems: "center",
    justifyContent: "center",
  },
  recHeaderText: { flex: 1 },
  recTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text, marginBottom: 3 },
  confBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },
  confText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  dismissBtn: { padding: 4 },
  recBody: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19, marginBottom: 10 },
  recActionBox: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    backgroundColor: Colors.light.phaseStructuring,
    borderRadius: 8,
    padding: 10,
  },
  recAction: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.structuring, flex: 1, lineHeight: 17 },
  emptyRecs: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyRecsTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.light.textSecondary },
  emptyRecsBody: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textMuted, textAlign: "center" },
});
