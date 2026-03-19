import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
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
import { PhaseTag } from "@/components/ui/PhaseTag";
import { TimeDials } from "@/components/ui/TimeDials";
import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { BlockTemplate, BlockType, SchedulePhaseTag } from "@/types";

const BLOCK_TYPES: BlockType[] = [
  "wake", "meal", "work", "commute", "cardio", "lift",
  "hobby", "hygiene", "chores", "errands", "bedtime", "rest", "other",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 7);
}

interface TemplateFormData {
  label: string;
  blockType: BlockType;
  axes: PhaseAxes;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  notes: string;
}

const DEFAULT_FORM: TemplateFormData = {
  label: "",
  blockType: "work",
  axes: { novelty: 2, structure: 3, recovery: 2 },
  startTime: "09:00",
  endTime: "10:00",
  daysOfWeek: [1, 2, 3, 4, 5],
  notes: "",
};

function axesFromPhaseTag(tag: SchedulePhaseTag): PhaseAxes {
  if (tag === "expansion") return { novelty: 4, structure: 2, recovery: 2 };
  if (tag === "recovery") return { novelty: 1, structure: 2, recovery: 4 };
  return { novelty: 2, structure: 4, recovery: 2 };
}

function formFromTemplate(tmpl: BlockTemplate): TemplateFormData {
  return {
    label: tmpl.label,
    blockType: tmpl.blockType,
    axes: axesFromPhaseTag(tmpl.phaseTag),
    startTime: tmpl.startTime,
    endTime: tmpl.endTime,
    daysOfWeek: tmpl.daysOfWeek,
    notes: tmpl.notes ?? "",
  };
}

type ViewMode = "list" | "form";

export default function TemplatesScreen() {
  const insets = useSafeAreaInsets();
  const { state, addBlockTemplate, updateBlockTemplate, removeBlockTemplate } = useApp();
  const templates = state.blockTemplates ?? [];

  const [mode, setMode] = useState<ViewMode>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormData>(DEFAULT_FORM);

  const openNew = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setMode("form");
  };

  const openEdit = (tmpl: BlockTemplate) => {
    setEditingId(tmpl.id);
    setForm(formFromTemplate(tmpl));
    setMode("form");
  };

  const handleSave = () => {
    if (!form.label.trim()) {
      Alert.alert("Name required", "Please enter a name for this template.");
      return;
    }
    if (form.daysOfWeek.length === 0) {
      Alert.alert("Days required", "Select at least one day.");
      return;
    }
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
    const phaseTag = derivePhaseTag(form.axes);
    if (editingId) {
      updateBlockTemplate(editingId, {
        label: form.label.trim(),
        blockType: form.blockType,
        phaseTag,
        startTime: form.startTime,
        endTime: form.endTime,
        daysOfWeek: form.daysOfWeek,
        notes: form.notes.trim() || undefined,
      });
    } else {
      addBlockTemplate({
        id: generateId(),
        label: form.label.trim(),
        blockType: form.blockType,
        phaseTag,
        startTime: form.startTime,
        endTime: form.endTime,
        daysOfWeek: form.daysOfWeek,
        notes: form.notes.trim() || undefined,
      });
    }
    setMode("list");
    setEditingId(null);
  };

  const handleDelete = (tmpl: BlockTemplate) => {
    Alert.alert("Remove Template", `Remove "${tmpl.label}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removeBlockTemplate(tmpl.id),
      },
    ]);
  };

  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d)
        ? f.daysOfWeek.filter((x) => x !== d)
        : [...f.daysOfWeek, d].sort(),
    }));
  };

  if (mode === "form") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => setMode("list")} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={Colors.light.textSecondary} />
          </Pressable>
          <Text style={styles.title}>{editingId ? "Edit Template" : "New Template"}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.textInput}
            value={form.label}
            onChangeText={(t) => setForm((f) => ({ ...f, label: t }))}
            placeholder="e.g. Morning Cardio, Deep Work"
            placeholderTextColor={Colors.light.textMuted}
            autoFocus
            returnKeyType="done"
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

          <Text style={styles.fieldLabel}>Timing</Text>
          <TimeDials
            startTime={form.startTime}
            endTime={form.endTime}
            onStartChange={(t) => setForm((f) => ({ ...f, startTime: t }))}
            onEndChange={(t) => setForm((f) => ({ ...f, endTime: t }))}
          />

          <Text style={styles.fieldLabel}>Repeats on</Text>
          <View style={styles.daysRow}>
            {DAY_LABELS.map((label, i) => (
              <Pressable
                key={i}
                onPress={() => toggleDay(i)}
                style={[styles.dayChip, form.daysOfWeek.includes(i) && styles.dayChipSelected]}
              >
                <Text style={[styles.dayChipText, form.daysOfWeek.includes(i) && styles.dayChipTextSelected]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            value={form.notes}
            onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))}
            placeholder="Any context..."
            placeholderTextColor={Colors.light.textMuted}
            multiline
            numberOfLines={3}
          />
        </ScrollView>

        {/* Fixed footer — always visible, no keyboard occlusion for time dials */}
        <View style={[styles.formFooter, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={() => setMode("list")}
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.saveBtnText}>{editingId ? "Save Changes" : "Create Template"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={Colors.light.textSecondary} />
        </Pressable>
        <Text style={styles.title}>Recurring Templates</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        <Text style={styles.subtitle}>
          Define your canonical week. Apply templates to any day to populate it instantly.
        </Text>

        {templates.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="repeat" size={32} color={Colors.light.textMuted} />
            <Text style={styles.emptyTitle}>No templates yet</Text>
            <Text style={styles.emptyBody}>
              Create templates for blocks that repeat each week — wake time, cardio, work sessions, meals.
            </Text>
          </View>
        ) : (
          <View style={styles.tmplList}>
            {templates.map((tmpl) => (
              <View key={tmpl.id} style={styles.tmplCard}>
                <View style={styles.tmplCardTop}>
                  <View style={styles.tmplCardLeft}>
                    <Text style={styles.tmplLabel}>{tmpl.label}</Text>
                    <Text style={styles.tmplTime}>{tmpl.startTime} – {tmpl.endTime}</Text>
                    <View style={styles.tmplMeta}>
                      <PhaseTag phase={tmpl.phaseTag} small />
                      <Text style={styles.tmplType}>{tmpl.blockType}</Text>
                    </View>
                  </View>
                  <View style={styles.tmplActions}>
                    <Pressable onPress={() => openEdit(tmpl)} style={styles.tmplActionBtn}>
                      <Feather name="edit-2" size={15} color={Colors.light.textSecondary} />
                    </Pressable>
                    <Pressable onPress={() => handleDelete(tmpl)} style={styles.tmplActionBtn}>
                      <Feather name="trash-2" size={15} color={Colors.light.textMuted} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.daysDisplay}>
                  {DAY_LABELS.map((label, i) => (
                    <View
                      key={i}
                      style={[styles.dayPill, tmpl.daysOfWeek.includes(i) && styles.dayPillActive]}
                    >
                      <Text style={[styles.dayPillText, tmpl.daysOfWeek.includes(i) && styles.dayPillTextActive]}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable
          onPress={openNew}
          style={({ pressed }) => [styles.saveBtn, { marginTop: 24 }, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.saveBtnText}>New Template</Text>
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
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.light.textSecondary },
  emptyBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textMuted,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 20,
  },
  tmplList: { gap: 8 },
  tmplCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    gap: 10,
  },
  tmplCardTop: { flexDirection: "row", alignItems: "flex-start" },
  tmplCardLeft: { flex: 1, gap: 3 },
  tmplLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.light.text },
  tmplTime: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textMuted },
  tmplMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  tmplType: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textMuted,
    textTransform: "capitalize",
  },
  tmplActions: { flexDirection: "row", gap: 4 },
  tmplActionBtn: { padding: 8 },
  daysDisplay: { flexDirection: "row", gap: 4 },
  dayPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: Colors.light.border,
  },
  dayPillActive: { backgroundColor: Colors.light.navyDark },
  dayPillText: { fontFamily: "Inter_500Medium", fontSize: 10, color: Colors.light.textMuted },
  dayPillTextActive: { color: Colors.light.surface },
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
  daysRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  dayChipSelected: { backgroundColor: Colors.light.navyDark, borderColor: Colors.light.navyDark },
  dayChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textSecondary },
  dayChipTextSelected: { color: Colors.light.surface },
  formFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "center",
  },
  cancelBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.surface },
});
