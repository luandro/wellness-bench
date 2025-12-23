import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback, useRef } from 'react';
import { fetchResults } from '@/lib/basePath';

export interface BenchmarkRun {
  id: string;
  name: string;
  date: string;
  models: string[];
  isLatest?: boolean;
}

export interface BiasFilters {
  market: boolean;
  growth: boolean;
  techno: boolean;
  power: boolean;
}

// Fallback mock data - used when static results aren't available
const mockRuns: BenchmarkRun[] = [
  {
    id: 'run-2024-12',
    name: 'December 2024',
    date: '2024-12-15',
    models: ['GPT-4o', 'Claude 3.5', 'Gemini Pro', 'Grok-2', 'DeepSeek-V3'],
    isLatest: true,
  },
  {
    id: 'run-2024-10',
    name: 'October 2024',
    date: '2024-10-22',
    models: ['GPT-4', 'Claude 3', 'Gemini 1.5', 'Grok-1', 'DeepSeek-V2'],
  },
];

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
      setError(err instanceof Error ? err.message : String(err));
      // Fall back to mock data
      setRuns(mockRuns);
      if (!selectedRunIdRef.current) {
        setSelectedRunId(mockRuns[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load runs on mount
  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

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
