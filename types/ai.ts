export type AIProviderId =
  | "deepseek"
  | "qwen"
  | "openai"
  | "openrouter"
  | "moonshot"
  | "groq"
  | "custom";

/**
 * User-owned model configuration. The API key is intentionally part of this
 * object, but it never leaves the browser except in requests sent directly to
 * the provider selected by the user.
 */
export interface AIConfig {
  providerId: AIProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  rememberKey: boolean;
}

export interface AIProviderPreset {
  id: AIProviderId;
  name: string;
  description: string;
  baseUrl: string;
  models: readonly string[];
  keyUrl?: string;
}

export function isAIConfigComplete(config: AIConfig | null): boolean {
  return Boolean(
    config &&
      config.baseUrl.trim() &&
      config.apiKey.trim() &&
      config.model.trim(),
  );
}
