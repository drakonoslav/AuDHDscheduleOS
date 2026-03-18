import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhaseAxes, PhaseClassifier, derivePhaseTag } from "@/components/ui/PhaseClassifier";
import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { BlockType } from "@/types";

const BLOCK_TYPES: BlockType[] = [
  "wake", "meal", "work", "commute", "cardio", "lift",
  "hobby", "hygiene", "chores", "errands", "bedtime", "rest", "other",
];

const DEFAULT_AXES: PhaseAxes = { novelty: 2, structure: 3, recovery: 2 };

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 7);
}

function timeToMins(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}

function blocksOverlap(
  a: { plannedStart: string; plannedEnd: string },
  b: { plannedStart: string; plannedEnd: string }
): boolean {
  return timeToMins(a.plannedStart) < timeToMins(b.plannedEnd) &&
    timeToMins(b.plannedStart) < timeToMins(a.plannedEnd);
}

function overlapKind(
  a: { plannedStart: string; plannedEnd: string },
  b: { plannedStart: string; plannedEnd: string }
): "soft" | "hard" | "none" {
  if (!blocksOverlap(a, b)) return "none";
  const aS = timeToMins(a.plannedStart), aE = timeToMins(a.plannedEnd);
  const bS = timeToMins(b.plannedStart), bE = timeToMins(b.plannedEnd);
  if ((aS <= bS && aE >= bE) || (bS <= aS && bE >= aE)) return "soft";
  return "hard";
}

interface BlockFormData {
  label: string;
  blockType: BlockType;
  axes: PhaseAxes;
  plannedStart: string;
  plannedEnd: string;
  notes: string;
}

const DEFAULT_FORM: BlockFormData = {
  label: "",
  blockType: "work",
  axes: DEFAULT_AXES,
  plannedStart: "09:00",
  plannedEnd: "10:00",
  notes: "",
};

export default function AddBlockScreen() {
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { addBlock, blocksForDate } = useApp();
  const [form, setForm] = useState<BlockFormData>(DEFAULT_FORM);

  const existingBlocks = useMemo(
    () => (date ? blocksForDate(date) : []),
    [blocksForDate, date]
  );

  const overlapWarnings = useMemo(() => {
    if (!form.plannedStart.match(/^\d{2}:\d{2}$/) || !form.plannedEnd.match(/^\d{2}:\d{2}$/)) return [];
    return existingBlocks
      .map((b) => ({ label: b.label, kind: overlapKind(form, b) }))
      .filter((x) => x.kind !== "none");
  }, [form.plannedStart, form.plannedEnd, existingBlocks]);

  const hasHardOverlap = overlapWarnings.some((w) => w.kind === "hard");
  const hasSoftOverlap = overlapWarnings.some((w) => w.kind === "soft");

  const handleAdd = () => {
    if (!form.label.trim()) {
      Alert.alert("Label required", "Please enter a name for this block.");
      return;
    }
    if (!date) return;
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
    addBlock({
      id: generateId(),
      date,
      blockType: form.blockType,
      label: form.label.trim(),
      phaseTag: derivePhaseTag(form.axes),
      plannedStart: form.plannedStart,
      plannedEnd: form.plannedEnd,
      status: "planned",
      notes: form.notes.trim() || undefined,
    });
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={Colors.light.textSecondary} />
        </Pressable>
        <Text style={styles.title}>Add Block</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          style={styles.textInput}
          value={form.label}
          onChangeText={(t) => setForm((f) => ({ ...f, label: t }))}
          placeholder="e.g. Deep Work, Lunch, Cardio"
          placeholderTextColor={Colors.light.textMuted}
          autoFocus
        />

        <Text style={styles.fieldLabel}>Block Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {BLOCK_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setForm((f) => ({ ...f, blockType: t }))}
              style={[styles.chip, form.blockType === t && styles.chipSelected]}
            >
              <Text style={[styles.chipText, form.blockType === t && styles.chipTextSelected]}>
                {t}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>Schedule Phase</Text>
        <PhaseClassifier
          axes={form.axes}
          onChange={(axes) => setForm((f) => ({ ...f, axes }))}
        />

        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>Planned Start</Text>
            <TextInput
              style={styles.textInput}
              value={form.plannedStart}
              onChangeText={(t) => setForm((f) => ({ ...f, plannedStart: t }))}
              placeholder="HH:MM"
              placeholderTextColor={Colors.light.textMuted}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.fieldLabel}>Planned End</Text>
            <TextInput
              style={styles.textInput}
              value={form.plannedEnd}
              onChangeText={(t) => setForm((f) => ({ ...f, plannedEnd: t }))}
              placeholder="HH:MM"
              placeholderTextColor={Colors.light.textMuted}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        {overlapWarnings.length > 0 && (
          <View style={[styles.overlapWarn, hasHardOverlap && styles.overlapWarnHard]}>
            <Feather
              name="alert-triangle"
              size={13}
              color={hasHardOverlap ? Colors.light.rose : Colors.light.amber}
            />
            <View style={{ flex: 1 }}>
              {hasSoftOverlap && (
                <>
                  <Text style={styles.overlapTitle}>
                    Nested: {overlapWarnings.filter((w) => w.kind === "soft").map((w) => w.label).join(", ")}
                  </Text>
                  <Text style={styles.overlapBody}>
                    This block sits inside a larger one. Ratings may reflect mixed demands.
                  </Text>
                </>
              )}
              {hasHardOverlap && (
                <>
                  <Text style={[styles.overlapTitle, { color: Colors.light.rose }]}>
                    Conflict: {overlapWarnings.filter((w) => w.kind === "hard").map((w) => w.label).join(", ")}
                  </Text>
                  <Text style={styles.overlapBody}>
                    These blocks run simultaneously without either containing the other.
                  </Text>
                </>
              )}
            </View>
          </View>
        )}

        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.textInput, styles.notesInput]}
          value={form.notes}
          onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))}
          placeholder="Any context for this block..."
          placeholderTextColor={Colors.light.textMuted}
          multiline
          numberOfLines={3}
        />

        <Pressable
          onPress={handleAdd}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.addBtnText}>Add Block</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backBtn: { padding: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.text },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.light.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.light.text,
  },
  notesInput: { height: 80, textAlignVertical: "top" },
  chipRow: { flexGrow: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginRight: 6,
  },
  chipSelected: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
    textTransform: "capitalize",
  },
  chipTextSelected: { color: Colors.light.surface },
  timeRow: { flexDirection: "row", gap: 12 },
  timeField: { flex: 1 },
  overlapWarn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: Colors.light.amber + "18",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.amber + "44",
    padding: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  overlapWarnHard: {
    backgroundColor: Colors.light.rose + "18",
    borderColor: Colors.light.rose + "44",
  },
  overlapTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.light.amber,
    marginBottom: 2,
  },
  overlapBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  addBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  addBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.surface },
});
