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
  DailyStateSnapshot,
  NutritionPhaseId,
  ScheduleBlock,
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
}

const AppContext = createContext<AppContextType | null>(null);

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    blocks: [],
    snapshots: [],
    trainingLogs: [],
    recommendations: [],
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
