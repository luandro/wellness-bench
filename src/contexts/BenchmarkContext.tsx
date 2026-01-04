import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback, useRef } from 'react';
import { fetchResults } from '@/lib/basePath';
import { toast } from '@/hooks/use-toast';
import type { BiasCategoryKey } from '@/lib/bias';

export interface BenchmarkRun {
  id: string;
  name: string;
  date: string;
  models: string[];
  isLatest?: boolean;
}

// Full index.json structure
export interface RunDetail {
  run_id: string;
  run_name: string;
  run_description?: string;
  created_at: string;
  completed_at?: string;
  languages_available: string[];
  models_included: Array<{
    provider_id: string;
    model_id: string;
    display_name: string;
    version?: string;
  }>;
  question_ids: string[];
  file_map: {
    snapshots: {
      questions: string;
      eval_prompts: string;
      providers: string;
    };
    per_question: Record<string, string>;
    per_model: Record<string, Record<string, string>>;
  };
  stats?: {
    total_questions: number;
    total_models: number;
    total_evaluations: number;
    succeeded: number;
    failed: number;
    total_duration_ms: number;
  };
}

export type BiasFilters = Record<BiasCategoryKey, boolean>;

// ... mock data ...

// Types for the static runs.json catalog
interface RunsCatalogEntry {
  run_id: string;
  run_name: string;
  created_at: string;
  status: string;
  languages?: string[];
  question_count?: number;
  model_count?: number;
  path: string;
}

interface RunsCatalog {
  version: string;
  updated_at: string;
  runs: RunsCatalogEntry[];
}

interface BenchmarkContextType {
  // Runs
  runs: BenchmarkRun[];
  selectedRun: BenchmarkRun | null;
  setSelectedRunId: (id: string) => void;
  isLoading: boolean;
  error: string | null;
  
  // Details
  runDetails: RunDetail | null;
  isLoadingDetails: boolean;

  // Bias filters
  biasFilters: BiasFilters;
  toggleBiasFilter: (key: keyof BiasFilters) => void;
  anyBiasFilterActive: boolean;

  // Data loading
  refreshRuns: () => Promise<void>;
}

const BenchmarkContext = createContext<BenchmarkContextType | undefined>(undefined);

/**
 * Convert static catalog entry to BenchmarkRun format
 */
function catalogEntryToRun(entry: RunsCatalogEntry, isLatest: boolean): BenchmarkRun {
  return {
    id: entry.run_id,
    name: entry.run_name,
    date: entry.created_at.split('T')[0],
    models: [], // Will be populated when run details are loaded
    isLatest,
  };
}

export function BenchmarkProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const selectedRunIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [runDetails, setRunDetails] = useState<RunDetail | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [biasFilters, setBiasFilters] = useState<BiasFilters>({
    market: false,
    growth: false,
    techno: false,
    power: false,
  });

  useEffect(() => {
    selectedRunIdRef.current = selectedRunId;
  }, [selectedRunId]);

  /**
   * Load runs from static JSON catalog
   */
  const loadRuns = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const catalog = await fetchResults<RunsCatalog>('runs.json');

      if (catalog.runs && catalog.runs.length > 0) {
        const benchmarkRuns = catalog.runs.map((entry, index) =>
          catalogEntryToRun(entry, index === 0)
        );
        setRuns(benchmarkRuns);

        // Select the first (latest) run by default
        const currentSelection = selectedRunIdRef.current;
        const hasSelection = currentSelection
          ? benchmarkRuns.some((run) => run.id === currentSelection)
          : false;
        if (!hasSelection && benchmarkRuns.length > 0) {
          setSelectedRunId(benchmarkRuns[0].id);
        }
      } else {
        // No runs in catalog, use mock data
        setRuns(mockRuns);
        if (!selectedRunIdRef.current) {
          setSelectedRunId(mockRuns[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load runs catalog, using mock data:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      
      // Fall back to mock data
      setRuns(mockRuns);
      if (!selectedRunIdRef.current) {
        setSelectedRunId(mockRuns[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load details for a specific run
   */
  const loadRunDetails = useCallback(async (runId: string) => {
    setIsLoadingDetails(true);
    try {
      // In our generator, path is currently the runId
      const details = await fetchResults<RunDetail>(`${runId}/index.json`);
      setRunDetails(details);
    } catch (err) {
      console.error(`Failed to load details for run ${runId}:`, err);
      setRunDetails(null);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  // Load runs on mount
  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Load details when selectedRunId changes
  useEffect(() => {
    if (selectedRunId && !selectedRunId.startsWith('run-2024')) { // Don't try to load mock run details
      loadRunDetails(selectedRunId);
    } else {
      setRunDetails(null);
    }
  }, [selectedRunId, loadRunDetails]);

  const selectedRun = useMemo(() => {
    if (selectedRunId) {
      return runs.find(r => r.id === selectedRunId) || null;
    }
    return runs[0] || null;
  }, [runs, selectedRunId]);

  const toggleBiasFilter = useCallback((key: keyof BiasFilters) => {
    setBiasFilters(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const anyBiasFilterActive = useMemo(() => {
    return Object.values(biasFilters).some(Boolean);
  }, [biasFilters]);

  const refreshRuns = useCallback(async () => {
    await loadRuns();
  }, [loadRuns]);

  return (
    <BenchmarkContext.Provider value={{
      runs,
      selectedRun,
      setSelectedRunId,
      isLoading,
      error,
      runDetails,
      isLoadingDetails,
      biasFilters,
      toggleBiasFilter,
      anyBiasFilterActive,
      refreshRuns,
    }}>
      {children}
    </BenchmarkContext.Provider>
  );
}

export function useBenchmark() {
  const context = useContext(BenchmarkContext);
  if (context === undefined) {
    throw new Error('useBenchmark must be used within a BenchmarkProvider');
  }
  return context;
}
