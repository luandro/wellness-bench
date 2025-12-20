import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';

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

// Mock runs data - in production this would load from static JSON
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
  {
    id: 'run-2024-06',
    name: 'June 2024',
    date: '2024-06-10',
    models: ['GPT-4', 'Claude 3 Opus', 'Gemini 1.0'],
  },
  {
    id: 'run-2024-01',
    name: 'January 2024',
    date: '2024-01-18',
    models: ['GPT-4', 'Claude 2.1', 'Gemini Pro'],
  },
];

interface BenchmarkContextType {
  // Runs
  runs: BenchmarkRun[];
  selectedRun: BenchmarkRun;
  setSelectedRunId: (id: string) => void;
  
  // Bias filters
  biasFilters: BiasFilters;
  toggleBiasFilter: (key: keyof BiasFilters) => void;
  anyBiasFilterActive: boolean;
}

const BenchmarkContext = createContext<BenchmarkContextType | undefined>(undefined);

export function BenchmarkProvider({ children }: { children: ReactNode }) {
  const [runs] = useState<BenchmarkRun[]>(mockRuns);
  const [selectedRunId, setSelectedRunId] = useState<string>(mockRuns[0].id);
  const [biasFilters, setBiasFilters] = useState<BiasFilters>({
    market: false,
    growth: false,
    techno: false,
    power: false,
  });

  const selectedRun = useMemo(() => {
    return runs.find(r => r.id === selectedRunId) || runs[0];
  }, [runs, selectedRunId]);

  const toggleBiasFilter = (key: keyof BiasFilters) => {
    setBiasFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const anyBiasFilterActive = useMemo(() => {
    return Object.values(biasFilters).some(Boolean);
  }, [biasFilters]);

  return (
    <BenchmarkContext.Provider value={{
      runs,
      selectedRun,
      setSelectedRunId,
      biasFilters,
      toggleBiasFilter,
      anyBiasFilterActive,
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
