import { isAIProviderId } from "@/lib/aiProviders";
import type { AIConfig } from "@/types/ai";

const LOCAL_STORAGE_KEY = "examflash:ai-config";
const SESSION_STORAGE_KEY = "examflash:ai-config-session";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAIConfig(value: unknown): value is AIConfig {
  if (!isRecord(value)) return false;

  return (
    isAIProviderId(value.providerId) &&
    typeof value.baseUrl === "string" &&
    typeof value.apiKey === "string" &&
    typeof value.model === "string" &&
    typeof value.rememberKey === "boolean"
  );
}

/** Loads the remembered key first, then the session-only key. */
export function loadAIConfig(): AIConfig | null {
  if (typeof window === "undefined") return null;

  try {
    const fromLocal = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (fromLocal) {
      const parsed: unknown = JSON.parse(fromLocal);
      if (isAIConfig(parsed)) return parsed;
    }
  } catch {
    // Ignore unavailable or malformed local storage.
  }

  try {
    const fromSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (fromSession) {
      const parsed: unknown = JSON.parse(fromSession);
      if (isAIConfig(parsed)) return parsed;
    }
  } catch {
    // Ignore unavailable or malformed session storage.
  }

  return null;
}

/**
 * Remembered configurations go to localStorage. Session-only configurations
 * live in sessionStorage and disappear when this browser tab closes.
 */
export function saveAIConfig(config: AIConfig): void {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify(config);

  try {
    if (config.rememberKey) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, payload);
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, payload);
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable in private browsing.
  }
}

export function clearStoredAIConfig(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}
