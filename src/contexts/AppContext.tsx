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
import {
  encryptApiKey,
  decryptApiKey,
  isCryptoAvailable,
  initializePassphrase,
  isPassphraseSetUp,
  hasSessionPassphrase,
  clearSessionPassphrase,
  resetPassphrase,
} from '@/lib/crypto';
import { toast } from '@/hooks/use-toast';

import questionsData from '@/data/questions.json';
import evalPromptsData from '@/data/eval_prompts.json';
import providersData from '@/data/providers.json';

interface StoredApiKey {
  provider_id: string;
  key_last4: string;
  encrypted_key: string;
  version?: 'v2' | 'v3'; // undefined or 'v2' = legacy, 'v3' = passphrase-encrypted
}

/** Check if any stored keys are using legacy encryption */
function hasLegacyKeys(keys: StoredApiKey[]): boolean {
  return keys.some(k => k.version !== 'v3');
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

  // Vault (passphrase-protected API key storage)
  isVaultSetUp: boolean;
  isVaultUnlocked: boolean;
  unlockVault: (passphrase: string) => Promise<boolean>;
  lockVault: () => void;
  resetVault: () => void;

  // API Keys (Builder mode only)
  hasEnvKeys: boolean;
  storedKeys: StoredApiKey[];
  hasLegacyKeys: boolean;
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

/** Maximum number of runs to keep in storage */
const MAX_STORED_RUNS = 50;

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

  // Vault state
  const [isVaultSetUp, setIsVaultSetUp] = useState(false);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);

  // Check vault status on mount and sync across tabs
  useEffect(() => {
    setIsVaultSetUp(isPassphraseSetUp());
    setIsVaultUnlocked(hasSessionPassphrase());

    // Listen for storage changes from other tabs
    const handleStorageChange = (event: StorageEvent) => {
      // If passphrase verification key changes, update vault setup status
      if (event.key === 'benchmark_passphrase_verify') {
        const wasSetUp = isVaultSetUp;
        const nowSetUp = event.newValue !== null;
        setIsVaultSetUp(nowSetUp);

        // If vault was reset in another tab, lock this tab too
        if (wasSetUp && !nowSetUp) {
          clearSessionPassphrase();
          setIsVaultUnlocked(false);
        }
      }

      // If API keys change, reload them
      if (event.key === STORAGE_KEYS.API_KEYS && event.newValue) {
        try {
          const keys = JSON.parse(event.newValue) as StoredApiKey[];
          setStoredKeys(keys);
        } catch {
          // Ignore parse errors from other tabs
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isVaultSetUp]);

  const reportStorageError = useCallback((message: string, error: unknown) => {
    console.error(message, error);
    toast({
      title: 'Storage Error',
      description: message,
      variant: 'destructive',
    });
  }, []);

  const safeSetItem = useCallback((key: string, value: string, label: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      reportStorageError(`Failed to save ${label}.`, error);
    }
  }, [reportStorageError]);

  // Load from localStorage on mount
  useEffect(() => {
    const loadFromStorage = <T,>(key: string, setter: (value: T) => void, label: string) => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(key);
      } catch (error) {
        reportStorageError(`Failed to access ${label}.`, error);
        return;
      }
      if (!raw) {
        return;
      }
      try {
        setter(JSON.parse(raw));
      } catch (error) {
        reportStorageError(`Failed to load ${label}.`, error);
      }
    };

    loadFromStorage<QuestionsConfig>(STORAGE_KEYS.QUESTIONS, setQuestionsState, 'questions');
    loadFromStorage<EvalPromptsConfig>(STORAGE_KEYS.EVAL_PROMPTS, setEvalPromptsState, 'evaluation prompts');
    loadFromStorage<ProvidersConfig>(STORAGE_KEYS.PROVIDERS, setProvidersState, 'providers');
    loadFromStorage<StoredApiKey[]>(STORAGE_KEYS.API_KEYS, setStoredKeys, 'API keys');
    loadFromStorage<Run[]>(STORAGE_KEYS.RUNS, setRuns, 'runs');
    loadFromStorage<SynthesisSummary[]>(STORAGE_KEYS.SYNTHESES, setSyntheses, 'syntheses');
  }, [reportStorageError]);

  const setQuestions = (config: QuestionsConfig) => {
    const updated = { ...config, updated_at: new Date().toISOString() };
    setQuestionsState(updated);
    safeSetItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(updated), 'questions');
  };

  const setEvalPrompts = (config: EvalPromptsConfig) => {
    const updated = { ...config, updated_at: new Date().toISOString() };
    setEvalPromptsState(updated);
    safeSetItem(STORAGE_KEYS.EVAL_PROMPTS, JSON.stringify(updated), 'evaluation prompts');
  };

  const setProviders = (config: ProvidersConfig) => {
    const updated = { ...config, updated_at: new Date().toISOString() };
    setProvidersState(updated);
    safeSetItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(updated), 'providers');
  };

  // Vault management
  const unlockVault = useCallback(async (passphrase: string): Promise<boolean> => {
    if (!isCryptoAvailable()) {
      toast({
        title: 'Encryption Not Available',
        description: 'Web Crypto API is not available in this browser. Cannot securely store API keys.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const success = await initializePassphrase(passphrase);
      if (success) {
        setIsVaultSetUp(true);
        setIsVaultUnlocked(true);
        return true;
      } else {
        toast({
          title: 'Incorrect Passphrase',
          description: 'The passphrase you entered is incorrect.',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unlock vault';
      toast({
        title: 'Vault Error',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, []);

  const lockVault = useCallback(() => {
    clearSessionPassphrase();
    setIsVaultUnlocked(false);
  }, []);

  const resetVaultHandler = useCallback(() => {
    resetPassphrase();
    // Also clear all stored API keys since they can't be decrypted anymore
    setStoredKeys([]);
    safeSetItem(STORAGE_KEYS.API_KEYS, JSON.stringify([]), 'API keys');
    setIsVaultSetUp(false);
    setIsVaultUnlocked(false);
    toast({
      title: 'Vault Reset',
      description: 'All stored API keys have been removed. You can set up a new passphrase.',
    });
  }, [safeSetItem]);

  const setApiKey = useCallback(async (providerId: string, key: string): Promise<void> => {
    if (!isCryptoAvailable()) {
      throw new Error('Web Crypto API is not available. Cannot securely store API keys.');
    }

    if (!isVaultUnlocked) {
      throw new Error('Vault is locked. Please unlock it first.');
    }

    const keyLast4 = key.slice(-4);
    const encryptedKey = await encryptApiKey(key);

    const newKey: StoredApiKey = {
      provider_id: providerId,
      key_last4: keyLast4,
      encrypted_key: encryptedKey,
      version: 'v3',
    };

    const updated = [
      ...storedKeys.filter(k => k.provider_id !== providerId),
      newKey
    ];
    setStoredKeys(updated);
    safeSetItem(STORAGE_KEYS.API_KEYS, JSON.stringify(updated), 'API keys');
  }, [isVaultUnlocked, safeSetItem, storedKeys]);

  const removeApiKey = useCallback((providerId: string) => {
    const updated = storedKeys.filter(k => k.provider_id !== providerId);
    setStoredKeys(updated);
    safeSetItem(STORAGE_KEYS.API_KEYS, JSON.stringify(updated), 'API keys');
  }, [safeSetItem, storedKeys]);

  const getApiKey = useCallback(async (providerId: string): Promise<string | null> => {
    const stored = storedKeys.find(k => k.provider_id === providerId);
    if (!stored) {
      return null;
    }

    if (!isVaultUnlocked) {
      throw new Error('Vault is locked. Please unlock it first.');
    }

    // Only support v3 (passphrase-encrypted) keys
    // Legacy v2 and unversioned keys are no longer supported for security
    if (stored.version !== 'v3') {
      toast({
        title: 'Key Migration Required',
        description: `The API key for ${providerId} uses an older format. Please re-enter it.`,
        variant: 'destructive',
      });
      // Remove the legacy key
      const updated = storedKeys.filter(k => k.provider_id !== providerId);
      setStoredKeys(updated);
      safeSetItem(STORAGE_KEYS.API_KEYS, JSON.stringify(updated), 'API keys');
      return null;
    }

    try {
      return await decryptApiKey(stored.encrypted_key);
    } catch (error) {
      reportStorageError('Unable to decrypt stored API key. Please re-enter it.', error);
      const updated = storedKeys.filter(k => k.provider_id !== providerId);
      setStoredKeys(updated);
      safeSetItem(STORAGE_KEYS.API_KEYS, JSON.stringify(updated), 'API keys');
      return null;
    }
  }, [isVaultUnlocked, reportStorageError, safeSetItem, storedKeys]);

  const addRun = useCallback((run: Run) => {
    setRuns(currentRuns => {
      // Enforce maximum stored runs limit
      let updated = [...currentRuns, run];
      if (updated.length > MAX_STORED_RUNS) {
        // Remove oldest runs (keep most recent)
        updated = updated.slice(-MAX_STORED_RUNS);
      }
      safeSetItem(STORAGE_KEYS.RUNS, JSON.stringify(updated), 'runs');
      return updated;
    });
  }, [safeSetItem]);

  const updateRun = useCallback((run: Run) => {
    setRuns(currentRuns => {
      const updated = currentRuns.map(r => r.id === run.id ? run : r);
      safeSetItem(STORAGE_KEYS.RUNS, JSON.stringify(updated), 'runs');
      return updated;
    });
  }, [safeSetItem]);

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
    safeSetItem(STORAGE_KEYS.SYNTHESES, JSON.stringify(updated), 'syntheses');
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
      isVaultSetUp,
      isVaultUnlocked,
      unlockVault,
      lockVault,
      resetVault: resetVaultHandler,
      hasEnvKeys,
      storedKeys,
      hasLegacyKeys: hasLegacyKeys(storedKeys),
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
