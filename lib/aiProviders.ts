import type { AIProviderId, AIProviderPreset } from "@/types/ai";

export const AI_PROVIDERS: readonly AIProviderPreset[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "OpenAI 兼容接口，中文与推理能力均衡。",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "qwen",
    name: "阿里云百炼 Qwen",
    description: "DashScope 的 OpenAI 兼容模式。",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-max", "qwen-turbo"],
    keyUrl: "https://bailian.console.aliyun.com/",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "官方 OpenAI API；部分环境可能限制浏览器直连。",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4.1-mini", "gpt-4.1", "o4-mini"],
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "一个 Key 访问多家模型，模型名称通常带厂商前缀。",
    baseUrl: "https://openrouter.ai/api/v1",
    models: ["openrouter/auto"],
    keyUrl: "https://openrouter.ai/keys",
  },
  {
    id: "moonshot",
    name: "Moonshot Kimi",
    description: "月之暗面 OpenAI 兼容接口。",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-8k", "moonshot-v1-32k"],
    keyUrl: "https://platform.moonshot.cn/console/api-keys",
  },
  {
    id: "groq",
    name: "Groq",
    description: "低延迟推理服务，提供 OpenAI 兼容接口。",
    baseUrl: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile"],
    keyUrl: "https://console.groq.com/keys",
  },
  {
    id: "custom",
    name: "自定义兼容接口",
    description: "填写任意 OpenAI 兼容的 Base URL 与模型名称。",
    baseUrl: "",
    models: [],
  },
];

export function getAIProvider(
  providerId: AIProviderId,
): AIProviderPreset {
  return (
    AI_PROVIDERS.find((provider) => provider.id === providerId) ??
    AI_PROVIDERS[0]
  );
}

export function isAIProviderId(value: unknown): value is AIProviderId {
  return AI_PROVIDERS.some((provider) => provider.id === value);
}

export const DEFAULT_AI_PROVIDER = getAIProvider("deepseek");
