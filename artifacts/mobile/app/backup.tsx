import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
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

import { Colors } from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import {
  buildBackup,
  getBackupSummary,
  mergeBackup,
  replaceWithBackup,
  validateBackup,
} from "@/storage/backup";
import type { BackupPayload, BackupSummary } from "@/storage/backup";

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportStep = "idle" | "preview" | "confirming" | "success" | "error";

interface ExportSuccess {
  exportedAt: string;
  counts: BackupSummary["counts"];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

// ─── Web file I/O ─────────────────────────────────────────────────────────────

function webExport(json: string, filename: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function webImport(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      try {
        const text = await file.text();
        resolve(text);
      } catch {
        resolve(null);
      }
    };
    input.oncancel = () => resolve(null);
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

// ─── Count row component ──────────────────────────────────────────────────────

function CountRow({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, accent && rowStyles.valueAccent]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  label: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary },
  value: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.text },
  valueAccent: { color: Colors.light.structuring },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BackupScreen() {
  const insets = useSafeAreaInsets();
  const { state, importAppState, refreshRecommendations } = useApp();

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<ExportSuccess | null>(null);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState<ImportStep>("idle");
  const [importPayload, setImportPayload] = useState<BackupPayload | null>(null);
  const [importSummary, setImportSummary] = useState<BackupSummary | null>(null);
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");
  const [confirmText, setConfirmText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importResultSummary, setImportResultSummary] = useState<BackupSummary | null>(null);

  // Current data counts
  const currentCounts = {
    blockTemplates: (state.blockTemplates ?? []).length,
    blocks: state.blocks.length,
    snapshots: state.snapshots.length,
    quantitativeLogs: (state.quantitativeLogs ?? []).length,
    trainingLogs: state.trainingLogs.length,
  };

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    try {
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const payload = buildBackup(state);
      const json = JSON.stringify(payload, null, 2);
      const filename = `audhd-backup-${todayStr()}.json`;

      if (Platform.OS === "web") {
        webExport(json, filename);
      } else {
        const FileSystem = await import("expo-file-system");
        const Sharing = await import("expo-sharing");
        const path = (FileSystem.cacheDirectory ?? "") + filename;
        await FileSystem.writeAsStringAsync(path, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(path, {
            mimeType: "application/json",
            dialogTitle: "Save backup file",
            UTI: "public.json",
          });
        } else {
          Alert.alert("Sharing unavailable", "File written to app cache. Connect to a computer to retrieve it.");
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExportSuccess({
        exportedAt: payload._meta.exportedAt,
        counts: getBackupSummary(payload).counts,
      });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Export failed", String(e));
    } finally {
      setExporting(false);
    }
  };

  // ── Import: pick file ───────────────────────────────────────────────────────

  const handlePickFile = async () => {
    try {
      setImporting(true);
      setImportError(null);
      setImportStep("idle");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      let rawText: string | null = null;

      if (Platform.OS === "web") {
        rawText = await webImport();
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/json", "*/*"],
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]) {
          setImporting(false);
          return;
        }
        rawText = await FileSystem.readAsStringAsync(result.assets[0].uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      if (!rawText) {
        setImporting(false);
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        setImportError("The selected file is not valid JSON. Please select a valid AuDHD backup file.");
        setImportStep("error");
        setImporting(false);
        return;
      }

      const validation = validateBackup(parsed);
      if (!validation.valid || !validation.payload) {
        setImportError(validation.error ?? "The file could not be validated.");
        setImportStep("error");
        setImporting(false);
        return;
      }

      const summary = getBackupSummary(validation.payload);
      setImportPayload(validation.payload);
      setImportSummary(summary);
      setImportStep("preview");
      setConfirmText("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setImportError(`Unexpected error: ${String(e)}`);
      setImportStep("error");
    } finally {
      setImporting(false);
    }
  };

  // ── Import: execute ─────────────────────────────────────────────────────────

  const handleImportExecute = async (mode: "replace" | "merge") => {
    if (!importPayload) return;

    try {
      setImporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      let newState;
      if (mode === "replace") {
        newState = replaceWithBackup(importPayload);
      } else {
        newState = mergeBackup(state, importPayload);
      }

      importAppState(newState);
      refreshRecommendations();

      setImportResultSummary(getBackupSummary(importPayload));
      setImportStep("success");
      setImportMode(mode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setImportError(`Import failed: ${String(e)}`);
      setImportStep("error");
    } finally {
      setImporting(false);
      setImportPayload(null);
    }
  };

  const resetImport = () => {
    setImportStep("idle");
    setImportPayload(null);
    setImportSummary(null);
    setImportError(null);
    setConfirmText("");
    setImportResultSummary(null);
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topInset + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={Colors.light.textSecondary} />
        </Pressable>
        <Text style={styles.title}>Data & Backup</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
      >
        {/* Intro */}
        <View style={styles.introBanner}>
          <Feather name="shield" size={16} color={Colors.light.sage} style={{ marginTop: 1 }} />
          <Text style={styles.introText}>
            Export all your manually entered data to a single JSON file. Import it any time to fully restore the app — including all derived scores, trends, and recommendations.
          </Text>
        </View>

        {/* ── Export section ─────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Export Backup</Text>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Current data</Text>
          <CountRow label="Schedule templates" value={currentCounts.blockTemplates} />
          <CountRow label="Schedule blocks" value={currentCounts.blocks} />
          <CountRow label="Qualitative logs" value={currentCounts.snapshots} />
          <CountRow label="Quantitative logs" value={currentCounts.quantitativeLogs} />
          <CountRow label="Training logs" value={currentCounts.trainingLogs} />
          <View style={styles.divider} />
          <CountRow
            label="Total records"
            value={
              currentCounts.blockTemplates +
              currentCounts.blocks +
              currentCounts.snapshots +
              currentCounts.quantitativeLogs +
              currentCounts.trainingLogs
            }
            accent
          />
        </View>

        <Pressable
          onPress={handleExport}
          disabled={exporting}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }, exporting && { opacity: 0.6 }]}
        >
          <Feather name="download" size={17} color={Colors.light.surface} />
          <Text style={styles.primaryBtnText}>
            {exporting ? "Exporting…" : "Export Backup"}
          </Text>
        </Pressable>

        {exportSuccess && (
          <View style={styles.successCard}>
            <View style={styles.successHeader}>
              <Feather name="check-circle" size={16} color={Colors.light.structuring} />
              <Text style={styles.successTitle}>Backup exported</Text>
            </View>
            <Text style={styles.successTimestamp}>{formatTimestamp(exportSuccess.exportedAt)}</Text>
            <View style={styles.successCounts}>
              <Text style={styles.successCountText}>
                {exportSuccess.counts.blocks} blocks · {exportSuccess.counts.snapshots} daily logs · {exportSuccess.counts.quantitativeLogs} quant logs · {exportSuccess.counts.trainingLogs} training · {exportSuccess.counts.blockTemplates} templates
              </Text>
            </View>
          </View>
        )}

        {/* ── Import section ─────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Import Backup</Text>

        {importStep === "idle" && (
          <>
            <View style={styles.importWarning}>
              <Feather name="alert-triangle" size={14} color={Colors.light.amber} />
              <Text style={styles.importWarningText}>
                Restore All will replace every record in the app with the backup. Merge will add backup records without removing existing ones. Both options will ask for confirmation before committing.
              </Text>
            </View>

            <Pressable
              onPress={handlePickFile}
              disabled={importing}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }, importing && { opacity: 0.6 }]}
            >
              <Feather name="upload" size={17} color={Colors.light.tint} />
              <Text style={styles.secondaryBtnText}>
                {importing ? "Reading file…" : "Select Backup File"}
              </Text>
            </Pressable>
          </>
        )}

        {importStep === "error" && (
          <View style={styles.errorCard}>
            <View style={styles.errorHeader}>
              <Feather name="alert-circle" size={16} color={Colors.light.rose} />
              <Text style={styles.errorTitle}>Could not read backup</Text>
            </View>
            <Text style={styles.errorBody}>{importError}</Text>
            <Pressable onPress={resetImport} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Try another file</Text>
            </Pressable>
          </View>
        )}

        {importStep === "preview" && importSummary && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Feather name="file-text" size={15} color={Colors.light.tint} />
              <Text style={styles.previewTitle}>Backup preview</Text>
            </View>

            <View style={styles.previewMeta}>
              <Text style={styles.previewMetaText}>
                Exported {formatTimestamp(importSummary.exportedAt)}
              </Text>
              <Text style={styles.previewMetaText}>
                App version {importSummary.appVersion} · Schema v{importSummary.schemaVersion}
              </Text>
            </View>

            {(importSummary.dateRange.earliest || importSummary.dateRange.latest) && (
              <View style={styles.dateRangeRow}>
                <View style={styles.dateRangeItem}>
                  <Text style={styles.dateRangeLabel}>Earliest record</Text>
                  <Text style={styles.dateRangeValue}>{formatDate(importSummary.dateRange.earliest)}</Text>
                </View>
                <View style={styles.dateRangeSep} />
                <View style={styles.dateRangeItem}>
                  <Text style={styles.dateRangeLabel}>Latest record</Text>
                  <Text style={styles.dateRangeValue}>{formatDate(importSummary.dateRange.latest)}</Text>
                </View>
              </View>
            )}

            <View style={styles.previewDivider} />

            <CountRow label="Schedule templates" value={importSummary.counts.blockTemplates} />
            <CountRow label="Schedule blocks" value={importSummary.counts.blocks} />
            <CountRow label="Qualitative logs" value={importSummary.counts.snapshots} />
            <CountRow label="Quantitative logs" value={importSummary.counts.quantitativeLogs} />
            <CountRow label="Training logs" value={importSummary.counts.trainingLogs} />
            <View style={styles.previewDivider} />
            <CountRow label="Total records" value={importSummary.counts.total} accent />

            <View style={styles.importActions}>
              <Pressable
                onPress={() => {
                  setImportMode("replace");
                  setImportStep("confirming");
                  setConfirmText("");
                }}
                style={({ pressed }) => [styles.restoreBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.restoreBtnText}>Restore All (Replace)</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setImportMode("merge");
                  setImportStep("confirming");
                  setConfirmText("");
                }}
                style={({ pressed }) => [styles.mergeBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.mergeBtnText}>Merge Into Existing</Text>
              </Pressable>
            </View>

            <Pressable onPress={resetImport} style={styles.cancelImportBtn}>
              <Text style={styles.cancelImportBtnText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {importStep === "success" && importResultSummary && (
          <View style={styles.successCard}>
            <View style={styles.successHeader}>
              <Feather name="check-circle" size={16} color={Colors.light.structuring} />
              <Text style={styles.successTitle}>
                {importMode === "replace" ? "Restore complete" : "Merge complete"}
              </Text>
            </View>
            <Text style={styles.successTimestamp}>
              {importMode === "replace"
                ? "All app data replaced from backup."
                : "Backup merged. Existing records not in backup were preserved."}
            </Text>
            <View style={styles.successCounts}>
              <Text style={styles.successCountText}>
                {importResultSummary.counts.blocks} blocks · {importResultSummary.counts.snapshots} daily logs · {importResultSummary.counts.quantitativeLogs} quant logs · {importResultSummary.counts.trainingLogs} training · {importResultSummary.counts.blockTemplates} templates
              </Text>
            </View>
            <Text style={styles.successNote}>
              All derived scores and recommendations have been recomputed from the restored data.
            </Text>
            <Pressable onPress={resetImport} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Done</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* ── Replace confirmation modal ───────────────────────────── */}
      <Modal
        visible={importStep === "confirming"}
        transparent
        animationType="fade"
        onRequestClose={() => setImportStep("preview")}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Feather
              name={importMode === "replace" ? "alert-triangle" : "git-merge"}
              size={28}
              color={importMode === "replace" ? Colors.light.rose : Colors.light.amber}
            />
            <Text style={styles.modalTitle}>
              {importMode === "replace" ? "Replace all data?" : "Merge backup?"}
            </Text>
            <Text style={styles.modalBody}>
              {importMode === "replace"
                ? "This will permanently erase all existing app data and replace it with the backup. This cannot be undone.\n\nType RESTORE to confirm."
                : "Backup records will be added or merged into your existing data. Conflicts resolve in favor of the backup. Your existing records are preserved.\n\nType MERGE to confirm."}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder={importMode === "replace" ? "Type RESTORE" : "Type MERGE"}
              placeholderTextColor={Colors.light.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setImportStep("preview")}
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  const expected = importMode === "replace" ? "RESTORE" : "MERGE";
                  if (confirmText.trim().toUpperCase() !== expected) {
                    Alert.alert("Confirmation required", `Please type ${expected} to continue.`);
                    return;
                  }
                  handleImportExecute(importMode);
                }}
                disabled={importing}
                style={({ pressed }) => [
                  importMode === "replace" ? styles.modalConfirmReplaceBtn : styles.modalConfirmMergeBtn,
                  pressed && { opacity: 0.85 },
                  importing && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.modalConfirmText}>
                  {importing
                    ? "Working…"
                    : importMode === "replace"
                    ? "Restore All"
                    : "Merge Backup"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.light.text,
    textAlign: "center",
  },
  scroll: { paddingHorizontal: 16 },

  introBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: Colors.light.creamMid,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.sage,
    padding: 12,
    marginBottom: 20,
    alignItems: "flex-start",
  },
  introText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 19,
  },

  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
    paddingBottom: 7,
  },

  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    marginBottom: 12,
  },
  cardHeading: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.light.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.borderLight,
    marginVertical: 8,
  },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 15,
    marginBottom: 12,
  },
  primaryBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.surface },

  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  secondaryBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.light.tint },

  successCard: {
    backgroundColor: Colors.light.sageLight + "33",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.sageLight,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.structuring,
    padding: 14,
    marginBottom: 16,
    gap: 4,
  },
  successHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  successTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.structuring },
  successTimestamp: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textSecondary },
  successCounts: { marginTop: 4 },
  successCountText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textMuted },
  successNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textMuted,
    fontStyle: "italic",
    marginTop: 4,
  },

  importWarning: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: Colors.light.amber + "18",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.amber + "55",
    padding: 12,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  importWarningText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },

  errorCard: {
    backgroundColor: Colors.light.rose + "18",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.rose + "55",
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.rose,
    padding: 14,
    marginBottom: 16,
    gap: 6,
  },
  errorHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.rose },
  errorBody: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18 },

  retryBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  retryBtnText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.light.textSecondary },

  previewCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.tint + "66",
    borderTopWidth: 3,
    borderTopColor: Colors.light.tint,
    padding: 14,
    marginBottom: 16,
  },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  previewTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.tint },
  previewMeta: { gap: 2, marginBottom: 12 },
  previewMetaText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.light.textMuted },

  dateRangeRow: {
    flexDirection: "row",
    backgroundColor: Colors.light.creamMid,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    alignItems: "center",
  },
  dateRangeItem: { flex: 1, alignItems: "center" },
  dateRangeLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.light.textMuted, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  dateRangeValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.light.text },
  dateRangeSep: { width: 1, height: 30, backgroundColor: Colors.light.border, marginHorizontal: 12 },

  previewDivider: { height: 1, backgroundColor: Colors.light.borderLight, marginVertical: 8 },

  importActions: { gap: 8, marginTop: 16 },
  restoreBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  restoreBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.light.surface },
  mergeBtn: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  mergeBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.light.textSecondary },

  cancelImportBtn: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelImportBtnText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textMuted,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    gap: 12,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.light.text,
    textAlign: "center",
  },
  modalBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
  modalInput: {
    width: "100%",
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.light.text,
    textAlign: "center",
    marginTop: 4,
  },
  modalActions: { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "center",
  },
  modalCancelText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.light.textSecondary },
  modalConfirmReplaceBtn: {
    flex: 2,
    backgroundColor: Colors.light.rose,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  modalConfirmMergeBtn: {
    flex: 2,
    backgroundColor: Colors.light.amber,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  modalConfirmText: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.light.surface },
});
