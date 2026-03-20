/**
 * backup.ts — AuDHD Schedule OS backup / restore engine
 *
 * Architecture:
 *   - All functions are pure (no side-effects on the app state directly).
 *   - The UI layer (backup.tsx) calls these functions and decides when to
 *     commit changes to AsyncStorage / AppContext.
 *   - Derived fields (adherenceScore, adhdPullScore, etc.) are re-derived
 *     after import via recomputeState(); the exported file includes them too
 *     for human readability, but they are never trusted as source of truth
 *     on re-import.
 */

import type {
  AppState,
  BlockTemplate,
  DailyStateSnapshot,
  NutritionPhaseId,
  QuantitativeDailyLog,
  ScheduleBlock,
  TrainingLog,
} from "@/types";
import { calcBlockDeviations, calcDayScores } from "./storage";

// ─── Version constants ────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 1;
export const APP_ID = "audhd-schedule-os";
export const APP_VERSION = "1.0.0";

// ─── Backup schema types ──────────────────────────────────────────────────────

export interface BackupMeta {
  schemaVersion: number;
  appId: string;
  appVersion: string;
  exportedAt: string;
  recordCounts: {
    blockTemplates: number;
    blocks: number;
    snapshots: number;
    quantitativeLogs: number;
    trainingLogs: number;
  };
}

export interface BackupConfig {
  currentNutritionPhaseId: NutritionPhaseId;
  onboardingComplete: boolean;
  setupWizardComplete: boolean;
}

export interface BackupPayload {
  _meta: BackupMeta;
  config: BackupConfig;
  blockTemplates: BlockTemplate[];
  blocks: ScheduleBlock[];
  snapshots: DailyStateSnapshot[];
  quantitativeLogs: QuantitativeDailyLog[];
  trainingLogs: TrainingLog[];
}

// ─── Summary for the import preview UI ───────────────────────────────────────

export interface BackupSummary {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  counts: {
    blockTemplates: number;
    blocks: number;
    snapshots: number;
    quantitativeLogs: number;
    trainingLogs: number;
    total: number;
  };
  dateRange: {
    earliest: string | null;
    latest: string | null;
  };
}

// ─── Validation result ────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
  payload?: BackupPayload;
}

// ─── Build backup from live state ─────────────────────────────────────────────

export function buildBackup(state: AppState): BackupPayload {
  const counts = {
    blockTemplates: (state.blockTemplates ?? []).length,
    blocks: state.blocks.length,
    snapshots: state.snapshots.length,
    quantitativeLogs: (state.quantitativeLogs ?? []).length,
    trainingLogs: state.trainingLogs.length,
  };

  return {
    _meta: {
      schemaVersion: SCHEMA_VERSION,
      appId: APP_ID,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      recordCounts: counts,
    },
    config: {
      currentNutritionPhaseId: state.currentNutritionPhaseId,
      onboardingComplete: state.onboardingComplete,
      setupWizardComplete: state.setupWizardComplete ?? true,
    },
    blockTemplates: state.blockTemplates ?? [],
    blocks: state.blocks,
    snapshots: state.snapshots,
    quantitativeLogs: state.quantitativeLogs ?? [],
    trainingLogs: state.trainingLogs,
  };
}

// ─── Validate an unknown payload (post-parse) ─────────────────────────────────

export function validateBackup(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: "File is not valid JSON." };
  }

  const obj = raw as Record<string, unknown>;

  if (!obj._meta || typeof obj._meta !== "object") {
    return { valid: false, error: "Missing _meta block. This file was not created by AuDHD Schedule OS." };
  }

  const meta = obj._meta as Record<string, unknown>;

  if (meta.appId !== APP_ID) {
    return {
      valid: false,
      error: `Unrecognized backup source (appId: ${meta.appId ?? "unknown"}). Only AuDHD Schedule OS backups can be imported.`,
    };
  }

  if (typeof meta.schemaVersion !== "number") {
    return { valid: false, error: "Missing or invalid schemaVersion in backup metadata." };
  }

  if (meta.schemaVersion > SCHEMA_VERSION) {
    return {
      valid: false,
      error: `This backup was created by a newer version of the app (schema v${meta.schemaVersion}). Please update the app before importing.`,
    };
  }

  if (!Array.isArray(obj.blocks)) {
    return { valid: false, error: "Backup is missing the blocks collection." };
  }
  if (!Array.isArray(obj.snapshots)) {
    return { valid: false, error: "Backup is missing the snapshots collection." };
  }
  if (!Array.isArray(obj.trainingLogs)) {
    return { valid: false, error: "Backup is missing the trainingLogs collection." };
  }

  if (!obj.config || typeof obj.config !== "object") {
    return { valid: false, error: "Backup is missing the config section." };
  }

  const migrated = applyMigrations(obj as BackupPayload);
  return { valid: true, payload: migrated };
}

// ─── Migration pipeline ───────────────────────────────────────────────────────
// Each migration is a pure function: BackupPayload → BackupPayload.
// Apply them in order from the backup's schemaVersion up to SCHEMA_VERSION.

function applyMigrations(raw: BackupPayload): BackupPayload {
  let payload = raw;
  const v = payload._meta.schemaVersion;

  // v1 → v2 would go here when needed:
  // if (v < 2) payload = migrateV1toV2(payload);

  // Normalize arrays that may be missing in very old backups
  if (!payload.blockTemplates) payload = { ...payload, blockTemplates: [] };
  if (!payload.quantitativeLogs) payload = { ...payload, quantitativeLogs: [] };

  // Stamp the final schema version (migrations are complete)
  return {
    ...payload,
    _meta: { ...payload._meta, schemaVersion: SCHEMA_VERSION },
  };
  void v;
}

// ─── Build a human-readable summary for the import preview UI ─────────────────

export function getBackupSummary(payload: BackupPayload): BackupSummary {
  const allDates: string[] = [
    ...payload.blocks.map((b) => b.date),
    ...payload.snapshots.map((s) => s.date),
    ...payload.quantitativeLogs.map((q) => q.date),
    ...payload.trainingLogs.map((t) => t.date),
  ].filter(Boolean).sort();

  const earliest = allDates[0] ?? null;
  const latest = allDates[allDates.length - 1] ?? null;

  const counts = {
    blockTemplates: payload.blockTemplates.length,
    blocks: payload.blocks.length,
    snapshots: payload.snapshots.length,
    quantitativeLogs: payload.quantitativeLogs.length,
    trainingLogs: payload.trainingLogs.length,
    total:
      payload.blockTemplates.length +
      payload.blocks.length +
      payload.snapshots.length +
      payload.quantitativeLogs.length +
      payload.trainingLogs.length,
  };

  return {
    schemaVersion: payload._meta.schemaVersion,
    appVersion: payload._meta.appVersion,
    exportedAt: payload._meta.exportedAt,
    counts,
    dateRange: { earliest, latest },
  };
}

// ─── Recompute all derived fields after import ────────────────────────────────

export function recomputeState(state: AppState): AppState {
  const blocks = state.blocks.map((b) => {
    const devs = calcBlockDeviations(b);
    return { ...b, ...devs };
  });

  const snapshots = state.snapshots.map((s) => {
    const scores = calcDayScores(s);
    return { ...s, ...scores };
  });

  return { ...state, blocks, snapshots };
}

// ─── Replace all: build a fresh AppState from the backup ─────────────────────

export function replaceWithBackup(payload: BackupPayload): AppState {
  const raw: AppState = {
    blocks: payload.blocks,
    snapshots: payload.snapshots,
    trainingLogs: payload.trainingLogs,
    quantitativeLogs: payload.quantitativeLogs,
    blockTemplates: payload.blockTemplates,
    recommendations: [],
    currentNutritionPhaseId: payload.config.currentNutritionPhaseId,
    onboardingComplete: payload.config.onboardingComplete,
    // Old backups won't have this field — always default true so SeedGateway
    // doesn't block the app after restore.
    setupWizardComplete: payload.config.setupWizardComplete ?? true,
  };
  return recomputeState(raw);
}

// ─── Merge: backup wins on every conflict; existing records not in backup kept ─

export function mergeBackup(existing: AppState, payload: BackupPayload): AppState {
  // Blocks: indexed by id
  const blockMap = new Map<string, ScheduleBlock>(existing.blocks.map((b) => [b.id, b]));
  for (const b of payload.blocks) blockMap.set(b.id, b);

  // Snapshots: indexed by date (one per day)
  const snapshotMap = new Map<string, DailyStateSnapshot>(existing.snapshots.map((s) => [s.date, s]));
  for (const s of payload.snapshots) snapshotMap.set(s.date, s);

  // QuantitativeLogs: indexed by date
  const quantMap = new Map<string, QuantitativeDailyLog>((existing.quantitativeLogs ?? []).map((q) => [q.date, q]));
  for (const q of payload.quantitativeLogs) quantMap.set(q.date, q);

  // TrainingLogs: indexed by id
  const trainMap = new Map<string, TrainingLog>(existing.trainingLogs.map((t) => [t.id, t]));
  for (const t of payload.trainingLogs) trainMap.set(t.id, t);

  // BlockTemplates: indexed by id
  const tmplMap = new Map<string, BlockTemplate>((existing.blockTemplates ?? []).map((t) => [t.id, t]));
  for (const t of payload.blockTemplates) tmplMap.set(t.id, t);

  const raw: AppState = {
    blocks: Array.from(blockMap.values()),
    snapshots: Array.from(snapshotMap.values()),
    quantitativeLogs: Array.from(quantMap.values()),
    trainingLogs: Array.from(trainMap.values()),
    blockTemplates: Array.from(tmplMap.values()),
    recommendations: existing.recommendations,
    currentNutritionPhaseId: payload.config.currentNutritionPhaseId,
    onboardingComplete: payload.config.onboardingComplete,
    setupWizardComplete: payload.config.setupWizardComplete ?? true,
  };
  return recomputeState(raw);
}
