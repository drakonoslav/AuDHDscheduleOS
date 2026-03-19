import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhaseTag } from "@/components/ui/PhaseTag";
import { RatingSlider } from "@/components/ui/RatingSlider";
import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { BlockRatings, BlockStatus, ScheduleBlock, SensoryNotes } from "@/types";

const STATUS_OPTIONS: { value: BlockStatus; label: string; color: string }[] = [
  { value: "planned", label: "Planned", color: Colors.light.textMuted },
  { value: "done", label: "Done", color: Colors.light.structuring },
  { value: "partial", label: "Partial", color: Colors.light.amber },
  { value: "skipped", label: "Skipped", color: Colors.light.rose },
  { value: "moved", label: "Moved", color: Colors.light.amber },
];

type TabId = "actuals" | "ratings" | "sensory";

// ─── Time helpers ─────────────────────────────────────────────────────────────

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function fromMins(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// ─── TimeAdjuster ─────────────────────────────────────────────────────────────

function TimeAdjuster({
  label,
  value,
  plannedValue,
  onChange,
}: {
  label: string;
  value: string;
  plannedValue: string;
  onChange: (v: string) => void;
}) {
  const isChanged = value !== plannedValue;

  const adjust = (delta: number) => {
    onChange(fromMins(toMins(value) + delta));
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
  };

  const reset = () => {
    onChange(plannedValue);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
  };

  return (
    <View style={adj.wrap}>
      <View style={adj.labelRow}>
        <Text style={adj.label}>{label}</Text>
        {isChanged && (
          <Pressable onPress={reset} style={adj.resetBtn}>
            <Text style={adj.resetText}>reset</Text>
          </Pressable>
        )}
      </View>

      <View style={adj.row}>
        {/* −5 */}
        <Pressable style={adj.btnLarge} onPress={() => adjust(-5)}>
          <Text style={adj.btnLargeText}>−5</Text>
        </Pressable>
        {/* −1 */}
        <Pressable style={adj.btnSmall} onPress={() => adjust(-1)}>
          <Text style={adj.btnSmallText}>−1</Text>
        </Pressable>

        {/* Time display */}
        <View style={[adj.timeBox, isChanged && adj.timeBoxChanged]}>
          <Text style={[adj.timeText, isChanged && adj.timeTextChanged]}>{value}</Text>
          {isChanged && (
            <Text style={adj.plannedHint}>was {plannedValue}</Text>
          )}
        </View>

        {/* +1 */}
        <Pressable style={adj.btnSmall} onPress={() => adjust(1)}>
          <Text style={adj.btnSmallText}>+1</Text>
        </Pressable>
        {/* +5 */}
        <Pressable style={adj.btnLarge} onPress={() => adjust(5)}>
          <Text style={adj.btnLargeText}>+5</Text>
        </Pressable>
      </View>
    </View>
  );
}

const adj = StyleSheet.create({
  wrap: { marginBottom: 16 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  label: {
    fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textTertiary,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  resetBtn: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: Colors.light.creamMid },
  resetText: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.light.textMuted },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  btnLarge: {
    width: 48, height: 48, borderRadius: 10,
    backgroundColor: Colors.light.surface, borderWidth: 1, borderColor: Colors.light.border,
    alignItems: "center", justifyContent: "center",
  },
  btnLargeText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text },
  btnSmall: {
    width: 36, height: 48, borderRadius: 8,
    backgroundColor: Colors.light.creamMid, borderWidth: 1, borderColor: Colors.light.borderLight,
    alignItems: "center", justifyContent: "center",
  },
  btnSmallText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textSecondary },
  timeBox: {
    flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface, alignItems: "center", justifyContent: "center",
  },
  timeBoxChanged: { borderColor: Colors.light.tint + "88", backgroundColor: Colors.light.tint + "0A" },
  timeText: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.light.text, letterSpacing: -0.5 },
  timeTextChanged: { color: Colors.light.tint },
  plannedHint: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textMuted, marginTop: 1 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BlockDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, updateBlock, removeBlock } = useApp();

  const block = useMemo(() => state.blocks.find((b) => b.id === id), [state.blocks, id]);

  const [tab, setTab] = useState<TabId>("actuals");
  const [status, setStatus] = useState<BlockStatus>(block?.status ?? "planned");
  // Auto-populate from planned times when no actual has been saved yet.
  const [actualStart, setActualStart] = useState(
    block?.actualStart ?? block?.plannedStart ?? ""
  );
  const [actualEnd, setActualEnd] = useState(
    block?.actualEnd ?? block?.plannedEnd ?? ""
  );
  const [ratings, setRatings] = useState<Partial<BlockRatings>>(block?.ratings ?? {});
  const [sensory, setSensory] = useState<Partial<SensoryNotes>>(block?.sensoryNotes ?? {});
  const [notes, setNotes] = useState(block?.notes ?? "");

  if (!block) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.errorText}>Block not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const handleSave = () => {
    const updates: Partial<ScheduleBlock> = {
      status,
      actualStart: actualStart.trim() || undefined,
      actualEnd: actualEnd.trim() || undefined,
      ratings: Object.keys(ratings).length > 0 ? ratings : undefined,
      sensoryNotes: Object.keys(sensory).length > 0 ? sensory : undefined,
      notes: notes.trim() || undefined,
    };
    updateBlock(block.id, updates);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
    router.back();
  };

  const handleDelete = () => {
    Alert.alert("Remove Block", `Remove "${block.label}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          removeBlock(block.id);
          router.back();
        },
      },
    ]);
  };

  const updateRating = (key: keyof BlockRatings, value: number) => {
    setRatings((r) => ({ ...r, [key]: value }));
  };

  const toggleSensory = (key: keyof SensoryNotes) => {
    setSensory((s) => ({ ...s, [key]: !s[key] }));
  };

  // Live deviation preview (computed from current local state, not saved block).
  const liveStartDevMin = useMemo(() => {
    if (!actualStart || !block.plannedStart) return undefined;
    return toMins(actualStart) - toMins(block.plannedStart);
  }, [actualStart, block.plannedStart]);

  const liveEndDevMin = useMemo(() => {
    if (!actualEnd || !block.plannedEnd) return undefined;
    return toMins(actualEnd) - toMins(block.plannedEnd);
  }, [actualEnd, block.plannedEnd]);

  const liveDurationActual = useMemo(() => {
    if (!actualStart || !actualEnd) return undefined;
    return toMins(actualEnd) - toMins(actualStart);
  }, [actualStart, actualEnd]);

  const liveDurationPlanned = useMemo(() => {
    if (!block.plannedStart || !block.plannedEnd) return undefined;
    return toMins(block.plannedEnd) - toMins(block.plannedStart);
  }, [block.plannedStart, block.plannedEnd]);

  const liveDurationDev = liveDurationActual !== undefined && liveDurationPlanned !== undefined
    ? liveDurationActual - liveDurationPlanned
    : undefined;

  const liveAdherence = useMemo(() => {
    if (liveStartDevMin === undefined || liveDurationDev === undefined) return undefined;
    const startPenalty = Math.min(100, Math.abs(liveStartDevMin) * 5);
    const durPenalty = Math.min(100, Math.abs(liveDurationDev) * 2);
    return Math.max(0, 100 - startPenalty - durPenalty);
  }, [liveStartDevMin, liveDurationDev]);

  const fmtDev = (v: number) =>
    v === 0 ? "on time" : v > 0 ? `+${v}m late` : `${Math.abs(v)}m early`;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={Colors.light.textSecondary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{block.label}</Text>
        <Pressable onPress={handleDelete} style={styles.deleteBtn}>
          <Feather name="trash-2" size={18} color={Colors.light.rose} />
        </Pressable>
      </View>

      {/* Block meta */}
      <View style={styles.blockMeta}>
        <Text style={styles.metaTime}>{block.plannedStart} – {block.plannedEnd}</Text>
        <PhaseTag phase={block.phaseTag} small />
        <Text style={styles.metaType}>{block.blockType}</Text>
        {(block.blockType === "cardio" || block.blockType === "lift") && (
          <Pressable
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
              router.push({ pathname: "/training-log", params: { blockId: block.id, date: block.date } });
            }}
            style={({ pressed }) => [styles.trainingShortcut, pressed && { opacity: 0.7 }]}
          >
            <Feather name="zap" size={12} color={Colors.light.surface} />
            <Text style={styles.trainingShortcutText}>Log Training</Text>
          </Pressable>
        )}
      </View>

      {/* Status row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusRow} contentContainerStyle={styles.statusRowContent}>
        {STATUS_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
              setStatus(opt.value);
            }}
            style={[styles.statusChip, status === opt.value && { backgroundColor: opt.color + "22", borderColor: opt.color }]}
          >
            <Text style={[styles.statusChipText, status === opt.value && { color: opt.color }]}>{opt.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["actuals", "ratings", "sensory"] as TabId[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
              setTab(t);
            }}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* ── Actuals tab ── */}
        {tab === "actuals" && (
          <View style={styles.section}>
            <TimeAdjuster
              label="Actual Start"
              value={actualStart}
              plannedValue={block.plannedStart}
              onChange={setActualStart}
            />
            <TimeAdjuster
              label="Actual End"
              value={actualEnd}
              plannedValue={block.plannedEnd}
              onChange={setActualEnd}
            />

            {/* Live deviation summary */}
            {(liveStartDevMin !== undefined || liveDurationDev !== undefined) && (
              <View style={styles.deviationCard}>
                <Text style={styles.devTitle}>Deviation preview</Text>
                {liveStartDevMin !== undefined && (
                  <View style={styles.devRow}>
                    <Text style={styles.devKey}>Start</Text>
                    <Text style={[styles.devVal, { color: liveStartDevMin !== 0 ? Colors.light.amber : Colors.light.structuring }]}>
                      {fmtDev(liveStartDevMin)}
                    </Text>
                  </View>
                )}
                {liveEndDevMin !== undefined && (
                  <View style={styles.devRow}>
                    <Text style={styles.devKey}>End</Text>
                    <Text style={[styles.devVal, { color: liveEndDevMin !== 0 ? Colors.light.amber : Colors.light.structuring }]}>
                      {fmtDev(liveEndDevMin)}
                    </Text>
                  </View>
                )}
                {liveDurationActual !== undefined && liveDurationPlanned !== undefined && (
                  <View style={styles.devRow}>
                    <Text style={styles.devKey}>Duration</Text>
                    <Text style={styles.devVal}>
                      <Text style={{ color: Colors.light.text }}>{liveDurationActual}m</Text>
                      <Text style={{ color: Colors.light.textMuted }}> planned {liveDurationPlanned}m</Text>
                    </Text>
                  </View>
                )}
                {liveAdherence !== undefined && (
                  <View style={styles.devRow}>
                    <Text style={styles.devKey}>Adherence</Text>
                    <Text style={[styles.devVal, { color: liveAdherence >= 70 ? Colors.light.structuring : Colors.light.amber }]}>
                      {liveAdherence}%
                    </Text>
                  </View>
                )}
              </View>
            )}

            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did this block actually go?"
              placeholderTextColor={Colors.light.textMuted}
              multiline
            />
          </View>
        )}

        {/* ── Ratings tab ── */}
        {tab === "ratings" && (
          <View style={styles.section}>
            <Text style={styles.ratingNote}>
              Rate how this block felt. 1 = low, 5 = high.{"\n"}
              High resistance or overload with on-time execution may indicate a state mismatch, not a discipline failure.
            </Text>
            <RatingSlider label="Ease of starting" value={ratings.ease ?? 0} onChange={(v) => updateRating("ease", v)} />
            <RatingSlider label="Resistance felt" value={ratings.resistance ?? 0} onChange={(v) => updateRating("resistance", v)} inverted />
            <RatingSlider label="Mental overload" value={ratings.overload ?? 0} onChange={(v) => updateRating("overload", v)} inverted />
            <RatingSlider label="Focus quality" value={ratings.focus ?? 0} onChange={(v) => updateRating("focus", v)} />
            <RatingSlider label="Satisfaction" value={ratings.satisfaction ?? 0} onChange={(v) => updateRating("satisfaction", v)} />
            <RatingSlider label="Transition difficulty" value={ratings.transitionDifficulty ?? 0} onChange={(v) => updateRating("transitionDifficulty", v)} inverted />
            <Text style={styles.fieldLabelSection}>Placement Fit</Text>
            <RatingSlider label="Felt too early" value={ratings.feltTooEarly ?? 0} onChange={(v) => updateRating("feltTooEarly", v)} inverted />
            <RatingSlider label="Felt too late" value={ratings.feltTooLate ?? 0} onChange={(v) => updateRating("feltTooLate", v)} inverted />
            <RatingSlider label="Felt too long" value={ratings.feltTooLong ?? 0} onChange={(v) => updateRating("feltTooLong", v)} inverted />
            <RatingSlider label="Felt too short" value={ratings.feltTooShort ?? 0} onChange={(v) => updateRating("feltTooShort", v)} inverted />
          </View>
        )}

        {/* ── Sensory tab ── */}
        {tab === "sensory" && (
          <View style={styles.section}>
            <Text style={styles.ratingNote}>
              Log sensory conditions during this block. These become pattern data over time.
            </Text>
            {(
              [
                { key: "noise", label: "Noise was a factor" },
                { key: "light", label: "Light was uncomfortable" },
                { key: "textureDiscomfort", label: "Texture/clothing discomfort" },
                { key: "crowding", label: "Crowding present" },
                { key: "pressureHelped", label: "Pressure/compression helped" },
                { key: "headphonesUsed", label: "Headphones used" },
              ] as { key: keyof SensoryNotes; label: string }[]
            ).map(({ key, label }) => (
              <View key={key} style={styles.sensoryRow}>
                <Text style={styles.sensoryLabel}>{label}</Text>
                <Switch
                  value={!!sensory[key]}
                  onValueChange={() => {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
                    toggleSensory(key);
                  }}
                  trackColor={{ false: Colors.light.creamDark, true: Colors.light.sageLight }}
                  thumbColor={sensory[key] ? Colors.light.sage : Colors.light.surface}
                />
              </View>
            ))}
            <Text style={styles.fieldLabel}>Sensory notes</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              value={sensory.notes ?? ""}
              onChangeText={(t) => setSensory((s) => ({ ...s, notes: t }))}
              placeholder="What specifically was difficult or helpful?"
              placeholderTextColor={Colors.light.textMuted}
              multiline
            />
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.saveBtnText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.light.text, letterSpacing: -0.3 },
  deleteBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  blockMeta: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 10, flexWrap: "wrap" },
  metaTime: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textMuted },
  metaType: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textMuted, textTransform: "capitalize" },
  trainingShortcut: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.light.tint, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, marginLeft: 4,
  },
  trainingShortcutText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.light.surface },
  statusRow: { flexGrow: 0, marginBottom: 8 },
  statusRowContent: { paddingHorizontal: 16, gap: 6 },
  statusChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: Colors.light.surface, borderWidth: 1, borderColor: Colors.light.border,
  },
  statusChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textMuted },
  tabs: {
    flexDirection: "row", marginHorizontal: 16,
    backgroundColor: Colors.light.creamMid, borderRadius: 10, padding: 3, marginBottom: 12,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: Colors.light.surface },
  tabText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textMuted },
  tabTextActive: { fontFamily: "Inter_600SemiBold", color: Colors.light.text },
  scroll: { paddingHorizontal: 16 },
  section: {},
  fieldLabel: {
    fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.light.textTertiary,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 12,
  },
  fieldLabelSection: {
    fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.text, marginTop: 16, marginBottom: 10,
  },
  textInput: {
    backgroundColor: Colors.light.surface, borderWidth: 1, borderColor: Colors.light.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.light.text,
  },
  notesInput: { height: 80, textAlignVertical: "top" },
  deviationCard: {
    backgroundColor: Colors.light.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.border,
    padding: 12, marginBottom: 4,
  },
  devTitle: {
    fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.light.textMuted,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8,
  },
  devRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  devKey: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },
  devVal: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  ratingNote: {
    fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary,
    lineHeight: 18, backgroundColor: Colors.light.creamMid, borderRadius: 8,
    padding: 10, marginBottom: 12,
  },
  sensoryRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.borderLight,
  },
  sensoryLabel: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.light.text },
  footer: {
    flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.light.border, backgroundColor: Colors.light.background,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.border, alignItems: "center",
  },
  cancelBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.light.textSecondary },
  saveBtn: { flex: 2, backgroundColor: Colors.light.tint, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.surface },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.light.rose, textAlign: "center", padding: 20 },
  backBtn: { padding: 12, alignSelf: "center" },
  backBtnText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.light.accent },
});
