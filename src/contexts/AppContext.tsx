import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type {
  AppMode,
  QuestionsConfig,
  EvalPromptsConfig,
  ProvidersConfig,
  Run,
  ResultsBundle,
  SynthesisSummary
} from '@/types/benchmark';
import { encryptApiKey, decryptApiKey, isCryptoAvailable } from '@/lib/crypto';

import questionsData from '@/data/questions.json';
import evalPromptsData from '@/data/eval_prompts.json';
import providersData from '@/data/providers.json';

interface StoredApiKey {
  provider_id: string;
  key_last4: string;
  encrypted_key: string;
  version: 'v2'; // Marks keys encrypted with Web Crypto API
}

interface AppContextType {
  // App Mode
  mode: AppMode;
  
  // Configuration
  questions: QuestionsConfig;
  setQuestions: (config: QuestionsConfig) => void;
  evalPrompts: EvalPromptsConfig;
  setEvalPrompts: (config: EvalPromptsConfig) => void;
  providers: ProvidersConfig;
  setProviders: (config: ProvidersConfig) => void;
  
  // API Keys (Builder mode only)
  hasEnvKeys: boolean;
  storedKeys: StoredApiKey[];
  setApiKey: (providerId: string, key: string) => Promise<void>;
  removeApiKey: (providerId: string) => void;
  getApiKey: (providerId: string) => Promise<string | null>;
  
  // Runs (Builder mode only)
  runs: Run[];
  addRun: (run: Run) => void;
  updateRun: (run: Run) => void;
  
  // Results (Viewer mode)
  resultsBundle: ResultsBundle | null;
  loadResultsBundle: (bundle: ResultsBundle) => void;
  
  // Syntheses
  syntheses: SynthesisSummary[];
  addSynthesis: (synthesis: SynthesisSummary) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  QUESTIONS: 'benchmark_questions',
  EVAL_PROMPTS: 'benchmark_eval_prompts',
  PROVIDERS: 'benchmark_providers',
  API_KEYS: 'benchmark_api_keys',
  RUNS: 'benchmark_runs',
  SYNTHESES: 'benchmark_syntheses',
};

// Check for environment variables (in a real app, these would be checked at build time)
const checkEnvKeys = (): boolean => {
  // In a browser environment, we check for specific indicators
  // This would be replaced with actual env var checks in a build process
  return false; // Default to false for demo
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode] = useState<AppMode>('builder'); // Would be set based on build config
  const [hasEnvKeys] = useState(checkEnvKeys());
  
  const [questions, setQuestionsState] = useState<QuestionsConfig>(
    questionsData as QuestionsConfig
  );
  const [evalPrompts, setEvalPromptsState] = useState<EvalPromptsConfig>(
    evalPromptsData as EvalPromptsConfig
  );
  const [providers, setProvidersState] = useState<ProvidersConfig>(
    providersData as ProvidersConfig
  );
  
  const [storedKeys, setStoredKeys] = useState<StoredApiKey[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [resultsBundle, setResultsBundle] = useState<ResultsBundle | null>(null);
  const [syntheses, setSyntheses] = useState<SynthesisSummary[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedQuestions = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
      if (savedQuestions) setQuestionsState(JSON.parse(savedQuestions));
      
      const savedEvalPrompts = localStorage.getItem(STORAGE_KEYS.EVAL_PROMPTS);
      if (savedEvalPrompts) setEvalPromptsState(JSON.parse(savedEvalPrompts));
      
      const savedProviders = localStorage.getItem(STORAGE_KEYS.PROVIDERS);
      if (savedProviders) setProvidersState(JSON.parse(savedProviders));
      
      const savedKeys = localStorage.getItem(STORAGE_KEYS.API_KEYS);
      if (savedKeys) setStoredKeys(JSON.parse(savedKeys));
      
      const savedRuns = localStorage.getItem(STORAGE_KEYS.RUNS);
      if (savedRuns) setRuns(JSON.parse(savedRuns));
      
      const savedSyntheses = localStorage.getItem(STORAGE_KEYS.SYNTHESES);
      if (savedSyntheses) setSyntheses(JSON.parse(savedSyntheses));
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
  }, []);

  const setQuestions = (config: QuestionsConfig) => {
    const updated = { ...config, updated_at: new Date().toISOString() };
    setQuestionsState(updated);
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(updated));
  };

  const setEvalPrompts = (config: EvalPromptsConfig) => {
    const updated = { ...config, updated_at: new Date().toISOString() };
    setEvalPromptsState(updated);
    localStorage.setItem(STORAGE_KEYS.EVAL_PROMPTS, JSON.stringify(updated));
  };

  const setProviders = (config: ProvidersConfig) => {
    const updated = { ...config, updated_at: new Date().toISOString() };
    setProvidersState(updated);
    localStorage.setItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(updated));
  };

  const setApiKey = useCallback(async (providerId: string, key: string): Promise<void> => {
    const keyLast4 = key.slice(-4);

    let encryptedKey: string;
    if (isCryptoAvailable()) {
      encryptedKey = await encryptApiKey(key);
    } else {
      // Fallback for environments without Web Crypto API
      console.warn('Web Crypto API not available, using fallback encoding');
      encryptedKey = btoa(key);
    }

    const newKey: StoredApiKey = {
      provider_id: providerId,
      key_last4: keyLast4,
      encrypted_key: encryptedKey,
      version: 'v2',
    };

    const updated = [
      ...storedKeys.filter(k => k.provider_id !== providerId),
      newKey
    ];
    setStoredKeys(updated);
    localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(updated));
  }, [storedKeys]);

  const removeApiKey = useCallback((providerId: string) => {
    const updated = storedKeys.filter(k => k.provider_id !== providerId);
    setStoredKeys(updated);
    localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(updated));
  }, [storedKeys]);

  const getApiKey = useCallback(async (providerId: string): Promise<string | null> => {
    const stored = storedKeys.find(k => k.provider_id === providerId);
    if (!stored) {
      return null;
    }

    try {
      if (stored.version === 'v2' && isCryptoAvailable()) {
        return await decryptApiKey(stored.encrypted_key);
      } else {
        // Legacy fallback for old base64-encoded keys
        return atob(stored.encrypted_key);
      }
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      return null;
    }
  }, [storedKeys]);

  const addRun = (run: Run) => {
    const updated = [...runs, run];
    setRuns(updated);
    localStorage.setItem(STORAGE_KEYS.RUNS, JSON.stringify(updated));
  };

  const updateRun = (run: Run) => {
    const updated = runs.map(r => r.id === run.id ? run : r);
    setRuns(updated);
    localStorage.setItem(STORAGE_KEYS.RUNS, JSON.stringify(updated));
  };

  const loadResultsBundle = (bundle: ResultsBundle) => {
    setResultsBundle(bundle);
    setSyntheses(bundle.syntheses);
  };

  const addSynthesis = (synthesis: SynthesisSummary) => {
    const updated = [
      ...syntheses.filter(s => s.question_id !== synthesis.question_id),
      synthesis
    ];
    setSyntheses(updated);
    localStorage.setItem(STORAGE_KEYS.SYNTHESES, JSON.stringify(updated));
  };

  return (
    <AppContext.Provider value={{
      mode,
      questions,
      setQuestions,
      evalPrompts,
      setEvalPrompts,
      providers,
      setProviders,
      hasEnvKeys,
      storedKeys,
      setApiKey,
      removeApiKey,
      getApiKey,
      runs,
      addRun,
      updateRun,
      resultsBundle,
      loadResultsBundle,
      syntheses,
      addSynthesis,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
