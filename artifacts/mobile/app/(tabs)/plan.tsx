import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhaseTag } from "@/components/ui/PhaseTag";
import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { BlockType, ScheduleBlock, SchedulePhaseTag } from "@/types";

const BLOCK_TYPES: BlockType[] = [
  "wake", "meal", "work", "commute", "cardio", "lift",
  "hobby", "hygiene", "chores", "errands", "bedtime", "rest", "other",
];

const PHASE_TAGS: SchedulePhaseTag[] = ["expansion", "structuring", "recovery"];

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 7);
}

interface BlockFormData {
  label: string;
  blockType: BlockType;
  phaseTag: SchedulePhaseTag;
  plannedStart: string;
  plannedEnd: string;
  notes: string;
}

const DEFAULT_FORM: BlockFormData = {
  label: "",
  blockType: "work",
  phaseTag: "structuring",
  plannedStart: "09:00",
  plannedEnd: "10:00",
  notes: "",
};

function AddBlockModal({ visible, onClose, onAdd, date }: {
  visible: boolean;
  onClose: () => void;
  onAdd: (block: ScheduleBlock) => void;
  date: string;
}) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<BlockFormData>(DEFAULT_FORM);

  const handleAdd = () => {
    if (!form.label.trim()) {
      Alert.alert("Label required", "Please enter a name for this block.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAdd({
      id: generateId(),
      date,
      blockType: form.blockType,
      label: form.label.trim(),
      phaseTag: form.phaseTag,
      plannedStart: form.plannedStart,
      plannedEnd: form.plannedEnd,
      status: "planned",
      notes: form.notes.trim() || undefined,
    });
    setForm(DEFAULT_FORM);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Block</Text>
          <Pressable onPress={onClose}>
            <Feather name="x" size={22} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
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
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setForm((f) => ({ ...f, blockType: t }));
                }}
                style={[styles.chip, form.blockType === t && styles.chipSelected]}
              >
                <Text style={[styles.chipText, form.blockType === t && styles.chipTextSelected]}>
                  {t}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Schedule Phase</Text>
          <View style={styles.phaseRow}>
            {PHASE_TAGS.map((p) => (
              <Pressable
                key={p}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setForm((f) => ({ ...f, phaseTag: p }));
                }}
                style={[styles.phaseChip, form.phaseTag === p && styles.phaseChipSelected]}
              >
                <PhaseTag phase={p} small />
              </Pressable>
            ))}
          </View>

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
        </ScrollView>

        <Pressable
          onPress={handleAdd}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.addBtnText}>Add Block</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { today, blocksForDate, addBlock, removeBlock } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);

  const blocks = useMemo(() => {
    const raw = blocksForDate(selectedDate);
    return [...raw].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));
  }, [blocksForDate, selectedDate]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const dates = useMemo(() => {
    const arr: string[] = [];
    for (let i = -1; i <= 5; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      arr.push(d.toISOString().split("T")[0]!);
    }
    return arr;
  }, []);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Plan</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowAdd(true);
          }}
          style={({ pressed }) => [styles.addIconBtn, pressed && { opacity: 0.7 }]}
        >
          <Feather name="plus" size={20} color={Colors.light.surface} />
        </Pressable>
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
                {date.toLocaleDateString("en-US", { weekday: "short" })}
              </Text>
              <Text style={[styles.dateNum, isSelected && styles.dateTextSelected]}>
                {date.getDate()}
              </Text>
              {isToday && <View style={[styles.todayDot, isSelected && { backgroundColor: Colors.light.surface }]} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {blocks.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={36} color={Colors.light.textMuted} />
            <Text style={styles.emptyTitle}>No blocks for this day</Text>
            <Text style={styles.emptyBody}>Tap + to add your first block.</Text>
            <Pressable
              onPress={() => setShowAdd(true)}
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
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  Alert.alert("Remove Block", `Remove "${block.label}"?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: () => removeBlock(block.id) },
                  ]);
                }}
                onPress={() => router.push({ pathname: "/block-detail", params: { id: block.id } })}
                style={({ pressed }) => [styles.planCard, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.planCardLeft}>
                  <Text style={styles.planTime}>{block.plannedStart} – {block.plannedEnd}</Text>
                  <Text style={styles.planLabel}>{block.label}</Text>
                  <View style={styles.planMeta}>
                    <PhaseTag phase={block.phaseTag} small />
                    <Text style={styles.planType}>{block.blockType}</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color={Colors.light.textMuted} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <AddBlockModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={addBlock}
        date={selectedDate}
      />
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
  addIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  dateBar: { flexGrow: 0, marginBottom: 8 },
  dateBarContent: { paddingHorizontal: 16, gap: 6 },
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
  },
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
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: Colors.light.textSecondary },
  emptyBody: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textMuted },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.surface },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.creamDark,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.light.text },
  modalScroll: { paddingBottom: 16 },
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
  phaseRow: { flexDirection: "row", gap: 8 },
  phaseChip: {
    paddingHorizontal: 2,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  phaseChipSelected: { borderColor: Colors.light.tint },
  timeRow: { flexDirection: "row", gap: 12 },
  timeField: { flex: 1 },
  addBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  addBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.surface },
});
