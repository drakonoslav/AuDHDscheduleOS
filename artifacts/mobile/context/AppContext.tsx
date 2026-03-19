import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  AppState,
  BlockTemplate,
  DailyStateSnapshot,
  NutritionPhaseId,
  QuantitativeDailyLog,
  ScheduleBlock,
  ScheduleWizardConfig,
  TrainingLog,
  WeeklyRecommendation,
} from "@/types";
import { calcBlockDeviations, calcDayScores, loadAppState, saveAppState } from "@/storage/storage";
import { generateRecommendations } from "@/engine/recommendations";

interface AppContextType {
  state: AppState;
  isLoaded: boolean;
  today: string;
  // Blocks
  addBlock: (block: ScheduleBlock) => void;
  updateBlock: (id: string, updates: Partial<ScheduleBlock>) => void;
  removeBlock: (id: string) => void;
  blocksForDate: (date: string) => ScheduleBlock[];
  // Snapshots
  upsertSnapshot: (snapshot: DailyStateSnapshot) => void;
  snapshotForDate: (date: string) => DailyStateSnapshot | undefined;
  // Training
  addTrainingLog: (log: TrainingLog) => void;
  updateTrainingLog: (id: string, updates: Partial<TrainingLog>) => void;
  trainingForDate: (date: string) => TrainingLog[];
  // Phase
  setNutritionPhase: (phaseId: NutritionPhaseId) => void;
  // Recommendations
  refreshRecommendations: () => void;
  dismissRecommendation: (id: string) => void;
  // Block templates
  addBlockTemplate: (template: BlockTemplate) => void;
  updateBlockTemplate: (id: string, updates: Partial<BlockTemplate>) => void;
  removeBlockTemplate: (id: string) => void;
  applyTemplatesToDate: (date: string) => void;
  // Quantitative logs
  upsertQuantitativeLog: (log: QuantitativeDailyLog) => void;
  quantitativeLogForDate: (date: string) => QuantitativeDailyLog | undefined;
  // Onboarding
  completeOnboarding: (phaseId: NutritionPhaseId) => void;
  // Setup wizard
  completeSetupWizard: (config: ScheduleWizardConfig, templates: BlockTemplate[]) => void;
  // Backup / restore — atomically replaces the entire app state
  importAppState: (newState: AppState) => void;
}

const AppContext = createContext<AppContextType | null>(null);

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 7);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    blocks: [],
    snapshots: [],
    trainingLogs: [],
    quantitativeLogs: [],
    recommendations: [],
    blockTemplates: [],
    currentNutritionPhaseId: "base",
    onboardingComplete: false,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadAppState().then((loaded) => {
      setState(loaded);
      setIsLoaded(true);
    });
  }, []);

  const persistState = useCallback((next: AppState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveAppState(next), 400);
  }, []);

  const updateState = useCallback(
    (updater: (prev: AppState) => AppState) => {
      setState((prev) => {
        const next = updater(prev);
        persistState(next);
        return next;
      });
    },
    [persistState]
  );

  // ─── Blocks ────────────────────────────────────────────────────
  const addBlock = useCallback(
    (block: ScheduleBlock) => {
      const devs = calcBlockDeviations(block);
      const enriched = { ...block, ...devs };
      updateState((s) => ({ ...s, blocks: [...s.blocks, enriched] }));
    },
    [updateState]
  );

  const updateBlock = useCallback(
    (id: string, updates: Partial<ScheduleBlock>) => {
      updateState((s) => ({
        ...s,
        blocks: s.blocks.map((b) => {
          if (b.id !== id) return b;
          const updated = { ...b, ...updates };
          const devs = calcBlockDeviations(updated);
          return { ...updated, ...devs };
        }),
      }));
    },
    [updateState]
  );

  const removeBlock = useCallback(
    (id: string) => {
      updateState((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== id) }));
    },
    [updateState]
  );

  const blocksForDate = useCallback(
    (date: string) => state.blocks.filter((b) => b.date === date),
    [state.blocks]
  );

  // ─── Snapshots ─────────────────────────────────────────────────
  const upsertSnapshot = useCallback(
    (snapshot: DailyStateSnapshot) => {
      const scores = calcDayScores(snapshot);
      const enriched: DailyStateSnapshot = { ...snapshot, ...scores };
      updateState((s) => {
        const existing = s.snapshots.findIndex((sn) => sn.date === snapshot.date);
        if (existing >= 0) {
          const next = [...s.snapshots];
          next[existing] = enriched;
          return { ...s, snapshots: next };
        }
        return { ...s, snapshots: [...s.snapshots, enriched] };
      });
    },
    [updateState]
  );

  const snapshotForDate = useCallback(
    (date: string) => state.snapshots.find((sn) => sn.date === date),
    [state.snapshots]
  );

  // ─── Training ──────────────────────────────────────────────────
  const addTrainingLog = useCallback(
    (log: TrainingLog) => {
      updateState((s) => ({ ...s, trainingLogs: [...s.trainingLogs, log] }));
    },
    [updateState]
  );

  const updateTrainingLog = useCallback(
    (id: string, updates: Partial<TrainingLog>) => {
      updateState((s) => ({
        ...s,
        trainingLogs: s.trainingLogs.map((l) =>
          l.id === id ? { ...l, ...updates } : l
        ),
      }));
    },
    [updateState]
  );

  const trainingForDate = useCallback(
    (date: string) => state.trainingLogs.filter((l) => l.date === date),
    [state.trainingLogs]
  );

  // ─── Phase ─────────────────────────────────────────────────────
  const setNutritionPhase = useCallback(
    (phaseId: NutritionPhaseId) => {
      updateState((s) => ({ ...s, currentNutritionPhaseId: phaseId }));
    },
    [updateState]
  );

  // ─── Recommendations ───────────────────────────────────────────
  const refreshRecommendations = useCallback(() => {
    const recs = generateRecommendations(state);
    updateState((s) => ({ ...s, recommendations: recs }));
  }, [state, updateState]);

  const dismissRecommendation = useCallback(
    (id: string) => {
      updateState((s) => ({
        ...s,
        recommendations: s.recommendations.map((r) =>
          r.id === id ? { ...r, dismissed: true } : r
        ),
      }));
    },
    [updateState]
  );

  // ─── Block Templates ───────────────────────────────────────────
  const addBlockTemplate = useCallback(
    (template: BlockTemplate) => {
      updateState((s) => ({
        ...s,
        blockTemplates: [...(s.blockTemplates ?? []), template],
      }));
    },
    [updateState]
  );

  const updateBlockTemplate = useCallback(
    (id: string, updates: Partial<BlockTemplate>) => {
      updateState((s) => ({
        ...s,
        blockTemplates: (s.blockTemplates ?? []).map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      }));
    },
    [updateState]
  );

  const removeBlockTemplate = useCallback(
    (id: string) => {
      updateState((s) => ({
        ...s,
        blockTemplates: (s.blockTemplates ?? []).filter((t) => t.id !== id),
      }));
    },
    [updateState]
  );

  // Apply all templates that match the given date's day-of-week
  // Skips any template whose label+time already exists for that date
  const applyTemplatesToDate = useCallback(
    (date: string) => {
      const dayOfWeek = new Date(date + "T12:00:00").getDay();
      const templates = (state.blockTemplates ?? []).filter((t) =>
        t.daysOfWeek.includes(dayOfWeek)
      );
      if (templates.length === 0) return;

      const existing = state.blocks.filter((b) => b.date === date);

      updateState((s) => {
        const newBlocks: ScheduleBlock[] = [];
        for (const tmpl of templates) {
          const alreadyExists = existing.some(
            (b) =>
              b.label === tmpl.label &&
              b.plannedStart === tmpl.startTime &&
              b.plannedEnd === tmpl.endTime
          );
          if (alreadyExists) continue;
          const block: ScheduleBlock = {
            id: generateId(),
            date,
            blockType: tmpl.blockType,
            label: tmpl.label,
            phaseTag: tmpl.phaseTag,
            plannedStart: tmpl.startTime,
            plannedEnd: tmpl.endTime,
            status: "planned",
            notes: tmpl.notes,
          };
          const devs = calcBlockDeviations(block);
          newBlocks.push({ ...block, ...devs });
        }
        return { ...s, blocks: [...s.blocks, ...newBlocks] };
      });
    },
    [state.blockTemplates, state.blocks, updateState]
  );

  // ─── Quantitative logs ─────────────────────────────────────────
  const upsertQuantitativeLog = useCallback(
    (log: QuantitativeDailyLog) => {
      updateState((s) => {
        const existing = (s.quantitativeLogs ?? []).findIndex((l) => l.date === log.date);
        if (existing >= 0) {
          const next = [...(s.quantitativeLogs ?? [])];
          next[existing] = log;
          return { ...s, quantitativeLogs: next };
        }
        return { ...s, quantitativeLogs: [...(s.quantitativeLogs ?? []), log] };
      });
    },
    [updateState]
  );

  const quantitativeLogForDate = useCallback(
    (date: string) => (state.quantitativeLogs ?? []).find((l) => l.date === date),
    [state.quantitativeLogs]
  );

  // ─── Onboarding ────────────────────────────────────────────────
  const completeOnboarding = useCallback(
    (phaseId: NutritionPhaseId) => {
      updateState((s) => ({
        ...s,
        currentNutritionPhaseId: phaseId,
        onboardingComplete: true,
      }));
    },
    [updateState]
  );

  // ─── Setup Wizard ───────────────────────────────────────────────
  // Stores wizard config and PREPENDS the generated templates.
  // Any pre-existing user templates are preserved after the wizard templates.
  const completeSetupWizard = useCallback(
    (config: ScheduleWizardConfig, templates: BlockTemplate[]) => {
      updateState((s) => {
        const existingIds = new Set(templates.map((t) => t.id));
        const kept = (s.blockTemplates ?? []).filter((t) => !existingIds.has(t.id));
        return {
          ...s,
          scheduleConfig: config,
          setupWizardComplete: true,
          blockTemplates: [...templates, ...kept],
        };
      });
    },
    [updateState]
  );

  // ─── Backup / restore ──────────────────────────────────────────
  // Atomically replaces the entire app state with an imported backup.
  // Derived fields (adherenceScore, pullScores, etc.) must already be
  // recomputed by the caller (recomputeState from backup.ts) before
  // passing the new state here. Recommendations are rebuilt automatically
  // from the new state on the next render cycle.
  const importAppState = useCallback(
    (newState: AppState) => {
      updateState(() => newState);
    },
    [updateState]
  );

  return (
    <AppContext.Provider
      value={{
        state,
        isLoaded,
        today: todayStr(),
        addBlock,
        updateBlock,
        removeBlock,
        blocksForDate,
        upsertSnapshot,
        snapshotForDate,
        addTrainingLog,
        updateTrainingLog,
        trainingForDate,
        setNutritionPhase,
        refreshRecommendations,
        dismissRecommendation,
        addBlockTemplate,
        updateBlockTemplate,
        removeBlockTemplate,
        applyTemplatesToDate,
        upsertQuantitativeLog,
        quantitativeLogForDate,
        completeOnboarding,
        completeSetupWizard,
        importAppState,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
