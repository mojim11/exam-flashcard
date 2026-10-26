"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearStoredAIConfig,
  loadAIConfig,
  saveAIConfig,
} from "@/lib/aiConfigStorage";
import { isAIConfigComplete, type AIConfig } from "@/types/ai";

interface AIConfigContextValue {
  config: AIConfig | null;
  isConfigured: boolean;
  isHydrated: boolean;
  saveConfig: (config: AIConfig) => void;
  clearConfig: () => void;
}

const AIConfigContext = createContext<AIConfigContextValue | null>(null);

export function AIConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = loadAIConfig();

    startTransition(() => {
      if (stored) setConfig(stored);
      setIsHydrated(true);
    });
  }, []);

  const saveConfig = useCallback((nextConfig: AIConfig) => {
    saveAIConfig(nextConfig);
    setConfig(nextConfig);
  }, []);

  const clearConfig = useCallback(() => {
    clearStoredAIConfig();
    setConfig(null);
  }, []);

  const value = useMemo<AIConfigContextValue>(
    () => ({
      config,
      isConfigured: isAIConfigComplete(config),
      isHydrated,
      saveConfig,
      clearConfig,
    }),
    [config, isHydrated, saveConfig, clearConfig],
  );

  return (
    <AIConfigContext.Provider value={value}>
      {children}
    </AIConfigContext.Provider>
  );
}

export function useAIConfig(): AIConfigContextValue {
  const context = useContext(AIConfigContext);

  if (!context) {
    throw new Error("useAIConfig must be used within an AIConfigProvider.");
  }

  return context;
}
