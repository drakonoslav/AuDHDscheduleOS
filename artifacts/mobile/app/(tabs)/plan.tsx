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

import { PhaseClassifier, PhaseAxes, derivePhaseTag } from "@/components/ui/PhaseClassifier";
import { PhaseTag } from "@/components/ui/PhaseTag";
import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { BlockTemplate, BlockType, ScheduleBlock, SchedulePhaseTag } from "@/types";

const BLOCK_TYPES: BlockType[] = [
  "wake", "meal", "work", "commute", "cardio", "lift",
  "hobby", "hygiene", "chores", "errands", "bedtime", "rest", "other",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  // Soft = one fully contains the other (nested / embedded — expected)
  if ((aS <= bS && aE >= bE) || (bS <= aS && bE >= aE)) return "soft";
  // Hard = partial collision — neither contains the other
  return "hard";
}

// ─── Add Block Modal ──────────────────────────────────────────────────────────

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

function AddBlockModal({ visible, onClose, onAdd, date, existingBlocks }: {
  visible: boolean;
  onClose: () => void;
  onAdd: (block: ScheduleBlock) => void;
  date: string;
  existingBlocks: ScheduleBlock[];
}) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<BlockFormData>(DEFAULT_FORM);

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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAdd({
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
            <View style={[styles.overlapInlineWarn, hasHardOverlap && styles.overlapInlineWarnHard]}>
              <Feather
                name="alert-triangle"
                size={13}
                color={hasHardOverlap ? Colors.light.rose : Colors.light.amber}
              />
              <View style={{ flex: 1 }}>
                {hasSoftOverlap && (
                  <>
                    <Text style={styles.overlapInlineTitle}>
                      Nested: {overlapWarnings.filter((w) => w.kind === "soft").map((w) => w.label).join(", ")}
                    </Text>
                    <Text style={styles.overlapInlineBody}>
                      This block sits inside a larger one. Ratings may reflect mixed demands — note when interpreting scores.
                    </Text>
                  </>
                )}
                {hasHardOverlap && (
                  <>
                    <Text style={[styles.overlapInlineTitle, { color: Colors.light.rose }]}>
                      Conflict: {overlapWarnings.filter((w) => w.kind === "hard").map((w) => w.label).join(", ")}
                    </Text>
                    <Text style={styles.overlapInlineBody}>
                      These blocks run simultaneously without either containing the other. Scores on both will be unreliable.
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

// ─── Template Form ────────────────────────────────────────────────────────────

interface TemplateFormData {
  label: string;
  blockType: BlockType;
  axes: PhaseAxes;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  notes: string;
}

const DEFAULT_TEMPLATE_FORM: TemplateFormData = {
  label: "",
  blockType: "work",
  axes: DEFAULT_AXES,
  startTime: "09:00",
  endTime: "10:00",
  daysOfWeek: [1, 2, 3, 4, 5],
  notes: "",
};

// When editing an existing template, we have phaseTag but no stored axes.
// Map it to a coherent starting point so the sliders reflect the tag.
function axesFromPhaseTag(tag: SchedulePhaseTag): PhaseAxes {
  if (tag === "expansion") return { novelty: 4, structure: 2, recovery: 2 };
  if (tag === "recovery")  return { novelty: 1, structure: 2, recovery: 4 };
  return { novelty: 2, structure: 4, recovery: 2 }; // structuring
}

function TemplateFormModal({
  visible,
  onClose,
  onSave,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (form: TemplateFormData) => void;
  initial?: TemplateFormData;
}) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<TemplateFormData>(initial ?? DEFAULT_TEMPLATE_FORM);

  React.useEffect(() => {
    if (visible) setForm(initial ?? DEFAULT_TEMPLATE_FORM);
  }, [visible]);

  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d)
        ? f.daysOfWeek.filter((x) => x !== d)
        : [...f.daysOfWeek, d].sort(),
    }));
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({ ...form, label: form.label.trim() });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{initial ? "Edit Template" : "New Template"}</Text>
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
            placeholder="e.g. Morning Cardio, Deep Work"
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
              <Text style={styles.fieldLabel}>Start Time</Text>
              <TextInput
                style={styles.textInput}
                value={form.startTime}
                onChangeText={(t) => setForm((f) => ({ ...f, startTime: t }))}
                placeholder="HH:MM"
                placeholderTextColor={Colors.light.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>End Time</Text>
              <TextInput
                style={styles.textInput}
                value={form.endTime}
                onChangeText={(t) => setForm((f) => ({ ...f, endTime: t }))}
                placeholder="HH:MM"
                placeholderTextColor={Colors.light.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Repeats on</Text>
          <View style={styles.daysRow}>
            {DAY_LABELS.map((label, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleDay(i);
                }}
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

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.addBtnText}>{initial ? "Save Changes" : "Create Template"}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Templates Manager Modal ──────────────────────────────────────────────────

function TemplatesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { state, addBlockTemplate, updateBlockTemplate, removeBlockTemplate } = useApp();
  const templates = state.blockTemplates ?? [];
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BlockTemplate | null>(null);

  const handleSave = (form: TemplateFormData) => {
    const phaseTag = derivePhaseTag(form.axes);
    if (editingTemplate) {
      updateBlockTemplate(editingTemplate.id, {
        label: form.label,
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
        label: form.label,
        blockType: form.blockType,
        phaseTag,
        startTime: form.startTime,
        endTime: form.endTime,
        daysOfWeek: form.daysOfWeek,
        notes: form.notes.trim() || undefined,
      });
    }
    setEditingTemplate(null);
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={[styles.modalContainer, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Recurring Templates</Text>
            <Pressable onPress={onClose}>
              <Feather name="x" size={22} color={Colors.light.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
            <Text style={styles.tmplSubtitle}>
              Define your canonical week. Apply templates to any day to populate it instantly.
            </Text>

            {templates.length === 0 ? (
              <View style={styles.tmplEmpty}>
                <Feather name="repeat" size={32} color={Colors.light.textMuted} />
                <Text style={styles.tmplEmptyTitle}>No templates yet</Text>
                <Text style={styles.tmplEmptyBody}>
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
                        <Pressable
                          onPress={() => {
                            setEditingTemplate(tmpl);
                            setShowForm(true);
                          }}
                          style={styles.tmplActionBtn}
                        >
                          <Feather name="edit-2" size={15} color={Colors.light.textSecondary} />
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            Alert.alert("Remove Template", `Remove "${tmpl.label}"?`, [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Remove",
                                style: "destructive",
                                onPress: () => removeBlockTemplate(tmpl.id),
                              },
                            ]);
                          }}
                          style={styles.tmplActionBtn}
                        >
                          <Feather name="trash-2" size={15} color={Colors.light.textMuted} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.daysDisplay}>
                      {DAY_LABELS.map((label, i) => (
                        <View
                          key={i}
                          style={[
                            styles.dayPill,
                            tmpl.daysOfWeek.includes(i) && styles.dayPillActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayPillText,
                              tmpl.daysOfWeek.includes(i) && styles.dayPillTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <Pressable
            onPress={() => {
              setEditingTemplate(null);
              setShowForm(true);
            }}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.addBtnText}>New Template</Text>
          </Pressable>
        </View>
      </Modal>

      <TemplateFormModal
        visible={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingTemplate(null);
        }}
        onSave={handleSave}
        initial={
          editingTemplate
            ? {
                label: editingTemplate.label,
                blockType: editingTemplate.blockType,
                axes: axesFromPhaseTag(editingTemplate.phaseTag),
                startTime: editingTemplate.startTime,
                endTime: editingTemplate.endTime,
                daysOfWeek: editingTemplate.daysOfWeek,
                notes: editingTemplate.notes ?? "",
              }
            : undefined
        }
      />
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { today, blocksForDate, addBlock, removeBlock, applyTemplatesToDate, state } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);

  const blocks = useMemo(() => {
    const raw = blocksForDate(selectedDate);
    return [...raw].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));
  }, [blocksForDate, selectedDate]);

  // Map<blockId, "soft" | "hard"> — hard wins if a block appears in multiple pairs
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
    return arr; // yesterday first, then today, then 44 days forward
  }, []);

  const selectedDayOfWeek = useMemo(
    () => new Date(selectedDate + "T12:00:00").getDay(),
    [selectedDate]
  );

  const hasTemplatesForDay = useMemo(
    () => (state.blockTemplates ?? []).some((t) => t.daysOfWeek.includes(selectedDayOfWeek)),
    [state.blockTemplates, selectedDayOfWeek]
  );

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Plan</Text>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setShowTemplates(true)}
            style={({ pressed }) => [styles.tmplHeaderBtn, pressed && { opacity: 0.7 }]}
          >
            <Feather name="repeat" size={16} color={Colors.light.textSecondary} />
            <Text style={styles.tmplHeaderBtnText}>Templates</Text>
          </Pressable>
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
        {/* Apply templates banner */}
        {hasTemplatesForDay && (
          <Pressable
            style={({ pressed }) => [styles.applyBanner, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                style={({ pressed }) => [
                  styles.planCard,
                  overlapKinds.has(block.id) && styles.planCardOverlap,
                  overlapKinds.get(block.id) === "hard" && styles.planCardHardOverlap,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {overlapKinds.get(block.id) === "hard" && <View style={[styles.overlapAccent, styles.overlapAccentHard]} />}
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

      <AddBlockModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={addBlock}
        date={selectedDate}
        existingBlocks={blocks}
      />
      <TemplatesModal
        visible={showTemplates}
        onClose={() => setShowTemplates(false)}
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
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
  planCardOverlap: {
    borderColor: Colors.light.amber + "66",
    backgroundColor: Colors.light.surface,
  },
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
  overlapCardNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.amber,
    marginTop: 4,
  },
  overlapCardNoteHard: {
    color: Colors.light.rose,
  },
  planCardHardOverlap: {
    borderColor: Colors.light.rose + "66",
  },
  overlapAccentHard: {
    backgroundColor: Colors.light.rose,
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
  // Templates
  tmplSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 19,
    marginBottom: 16,
  },
  tmplEmpty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  tmplEmptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  tmplEmptyBody: {
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
  tmplCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  tmplCardLeft: { flex: 1, gap: 3 },
  tmplLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
  },
  tmplTime: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.light.textMuted,
  },
  tmplMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  tmplType: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textMuted,
    textTransform: "capitalize",
  },
  tmplActions: {
    flexDirection: "row",
    gap: 4,
  },
  tmplActionBtn: {
    padding: 8,
  },
  daysDisplay: {
    flexDirection: "row",
    gap: 4,
  },
  dayPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: Colors.light.border,
  },
  dayPillActive: {
    backgroundColor: Colors.light.navyDark,
  },
  dayPillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: Colors.light.textMuted,
  },
  dayPillTextActive: {
    color: Colors.light.surface,
  },
  // Shared modal styles
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
  daysRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  dayChipSelected: {
    backgroundColor: Colors.light.navyDark,
    borderColor: Colors.light.navyDark,
  },
  dayChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  dayChipTextSelected: { color: Colors.light.surface },
  addBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  addBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.light.surface },
  overlapInlineWarn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: Colors.light.amber + "18",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.amber + "44",
    padding: 10,
    marginBottom: 10,
  },
  overlapInlineTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.light.amber,
    marginBottom: 2,
  },
  overlapInlineBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  overlapInlineWarnHard: {
    backgroundColor: Colors.light.rose + "18",
    borderColor: Colors.light.rose + "44",
  },
});
