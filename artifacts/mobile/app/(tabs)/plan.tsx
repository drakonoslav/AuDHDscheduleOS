import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
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

function timeToMins(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}

function overlapKind(
  a: { plannedStart: string; plannedEnd: string },
  b: { plannedStart: string; plannedEnd: string }
): "soft" | "hard" | "none" {
  const aS = timeToMins(a.plannedStart), aE = timeToMins(a.plannedEnd);
  const bS = timeToMins(b.plannedStart), bE = timeToMins(b.plannedEnd);
  if (!(aS < bE && bS < aE)) return "none";
  if ((aS <= bS && aE >= bE) || (bS <= aS && bE >= aE)) return "soft";
  return "hard";
}

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { today, blocksForDate, removeBlock, applyTemplatesToDate, state } = useApp();
  const [selectedDate, setSelectedDate] = useState(today);

  const blocks = useMemo(() => {
    const raw = blocksForDate(selectedDate);
    return [...raw].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));
  }, [blocksForDate, selectedDate]);

  const overlapKinds = useMemo(() => {
    const kinds = new Map<string, "soft" | "hard">();
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const kind = overlapKind(blocks[i]!, blocks[j]!);
        if (kind === "none") continue;
        const upgrade = (id: string) => {
          if (kinds.get(id) !== "hard") kinds.set(id, kind);
        };
        upgrade(blocks[i]!.id);
        upgrade(blocks[j]!.id);
      }
    }
    return kinds;
  }, [blocks]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const dates = useMemo(() => {
    const arr: string[] = [];
    for (let i = -1; i <= 44; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      arr.push(d.toISOString().split("T")[0]!);
    }
    return arr;
  }, []);

  const selectedDayOfWeek = useMemo(
    () => new Date(selectedDate + "T12:00:00").getDay(),
    [selectedDate]
  );

  const hasTemplatesForDay = useMemo(
    () => (state.blockTemplates ?? []).some((t) => t.daysOfWeek.includes(selectedDayOfWeek)),
    [state.blockTemplates, selectedDayOfWeek]
  );

  const openAddBlock = () => {
    router.push({ pathname: "/add-block", params: { date: selectedDate } });
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Plan</Text>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => router.push("/templates")}
            style={({ pressed }) => [styles.tmplHeaderBtn, pressed && { opacity: 0.7 }]}
          >
            <Feather name="repeat" size={16} color={Colors.light.textSecondary} />
            <Text style={styles.tmplHeaderBtnText}>Templates</Text>
          </Pressable>
          <Pressable
            onPress={openAddBlock}
            style={({ pressed }) => [styles.addIconBtn, pressed && { opacity: 0.7 }]}
          >
            <Feather name="plus" size={20} color={Colors.light.surface} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dateBar}
        contentContainerStyle={styles.dateBarContent}
      >
        {dates.map((d) => {
          const date = new Date(d + "T00:00:00");
          const isSelected = d === selectedDate;
          const isToday = d === today;
          return (
            <Pressable
              key={d}
              onPress={() => setSelectedDate(d)}
              style={[styles.dateChip, isSelected && styles.dateChipSelected]}
            >
              <Text style={[styles.dateDow, isSelected && styles.dateTextSelected]}>
                {date.toLocaleDateString("en-US", { weekday: "short" })}
              </Text>
              <Text style={[styles.dateNum, isSelected && styles.dateTextSelected]}>
                {date.getDate()}
              </Text>
              {isToday && (
                <View style={[styles.todayDot, isSelected && { backgroundColor: Colors.light.surface }]} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {hasTemplatesForDay && (
          <Pressable
            style={({ pressed }) => [styles.applyBanner, pressed && { opacity: 0.85 }]}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
              applyTemplatesToDate(selectedDate);
            }}
          >
            <Feather name="repeat" size={14} color={Colors.light.navyDark} />
            <Text style={styles.applyBannerText}>Apply week templates to this day</Text>
            <Feather name="plus" size={14} color={Colors.light.navyDark} />
          </Pressable>
        )}

        {blocks.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={36} color={Colors.light.textMuted} />
            <Text style={styles.emptyTitle}>No blocks for this day</Text>
            <Text style={styles.emptyBody}>Tap + to add your first block.</Text>
            <Pressable
              onPress={openAddBlock}
              style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.emptyBtnText}>Add Block</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.blockList}>
            {blocks.map((block) => (
              <Pressable
                key={block.id}
                onLongPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
                  Alert.alert("Remove Block", `Remove "${block.label}"?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: () => removeBlock(block.id) },
                  ]);
                }}
                onPress={() => router.push({ pathname: "/block-detail", params: { id: block.id } })}
                style={({ pressed }) => [
                  styles.planCard,
                  overlapKinds.has(block.id) && styles.planCardOverlap,
                  overlapKinds.get(block.id) === "hard" && styles.planCardHardOverlap,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {overlapKinds.get(block.id) === "hard" && (
                  <View style={[styles.overlapAccent, styles.overlapAccentHard]} />
                )}
                {overlapKinds.get(block.id) === "soft" && <View style={styles.overlapAccent} />}
                <View style={styles.planCardLeft}>
                  <Text style={styles.planTime}>{block.plannedStart} – {block.plannedEnd}</Text>
                  <Text style={styles.planLabel}>{block.label}</Text>
                  <View style={styles.planMeta}>
                    <PhaseTag phase={block.phaseTag} small />
                    <Text style={styles.planType}>{block.blockType}</Text>
                  </View>
                  {overlapKinds.get(block.id) === "soft" && (
                    <Text style={styles.overlapCardNote}>
                      Nested overlap — ratings may reflect mixed demands
                    </Text>
                  )}
                  {overlapKinds.get(block.id) === "hard" && (
                    <Text style={[styles.overlapCardNote, styles.overlapCardNoteHard]}>
                      Conflicting overlap — blocks run simultaneously
                    </Text>
                  )}
                </View>
                <Feather name="chevron-right" size={16} color={Colors.light.textMuted} />
              </Pressable>
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
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  tmplHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  tmplHeaderBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  addIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  dateBar: { flexGrow: 0, height: 78, marginBottom: 4 },
  dateBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 6, alignItems: "center" },
  dateChip: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    minWidth: 52,
  },
  dateChipSelected: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  dateDow: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: Colors.light.textMuted,
    textTransform: "uppercase",
  },
  dateNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.light.text,
  },
  dateTextSelected: { color: Colors.light.surface },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.accent,
    marginTop: 2,
  },
  scroll: { paddingHorizontal: 16 },
  applyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.cream,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.navyDark + "33",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  applyBannerText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.navyDark,
  },
  blockList: { gap: 6 },
  planCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
    overflow: "hidden",
  },
  planCardOverlap: { borderColor: Colors.light.amber + "66" },
  planCardHardOverlap: { borderColor: Colors.light.rose + "66" },
  overlapAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.light.amber,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  overlapAccentHard: { backgroundColor: Colors.light.rose },
  overlapCardNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.amber,
    marginTop: 4,
  },
  overlapCardNoteHard: { color: Colors.light.rose },
  planCardLeft: { flex: 1 },
  planTime: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.light.textMuted,
    marginBottom: 2,
  },
  planLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
    marginBottom: 4,
  },
  planMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  planType: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textMuted,
    textTransform: "capitalize",
  },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: Colors.light.textSecondary,
  },
  emptyBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textMuted,
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.light.surface,
  },
});
