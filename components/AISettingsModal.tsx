"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  CircleAlert,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { useAIConfig } from "@/context/AIConfigContext";
import {
  AIRequestError,
  fetchAvailableModels,
} from "@/lib/aiClient";
import {
  AI_PROVIDERS,
  DEFAULT_AI_PROVIDER,
  getAIProvider,
} from "@/lib/aiProviders";
import { cn } from "@/lib/utils";
import type { AIProviderId } from "@/types/ai";

interface AISettingsModalProps {
  onClose: () => void;
}

type ConnectionState =
  | { status: "idle"; message: string }
  | { status: "testing"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function uniqueModels(models: readonly string[]): string[] {
  return [...new Set(models.map((model) => model.trim()).filter(Boolean))];
}

export default function AISettingsModal({
  onClose,
}: AISettingsModalProps) {
  const { config, isConfigured, saveConfig, clearConfig } = useAIConfig();
  const initialProvider = config
    ? getAIProvider(config.providerId)
    : DEFAULT_AI_PROVIDER;

  const [providerId, setProviderId] = useState<AIProviderId>(
    config?.providerId ?? initialProvider.id,
  );
  const [baseUrl, setBaseUrl] = useState(
    config?.baseUrl ?? initialProvider.baseUrl,
  );
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");
  const [model, setModel] = useState(
    config?.model ?? initialProvider.models[0] ?? "",
  );
  const [rememberKey, setRememberKey] = useState(
    config?.rememberKey ?? false,
  );
  const [showKey, setShowKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>(
    uniqueModels([
      ...(config ? [config.model] : []),
      ...initialProvider.models,
    ]),
  );
  const [connection, setConnection] = useState<ConnectionState>({
    status: "idle",
    message: "",
  });

  const provider = getAIProvider(providerId);
  const canTest =
    baseUrl.trim().length > 0 &&
    apiKey.trim().length > 0 &&
    connection.status !== "testing";
  const canSave =
    canTest &&
    model.trim().length > 0 &&
    baseUrl.trim().length > 0;

  const modelOptions = useMemo(
    () => uniqueModels([...availableModels, ...provider.models]),
    [availableModels, provider.models],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const resetConnection = () => {
    setConnection({ status: "idle", message: "" });
  };

  const handleProviderChange = (nextProviderId: AIProviderId) => {
    const nextProvider = getAIProvider(nextProviderId);
    setProviderId(nextProviderId);
    setBaseUrl(nextProvider.baseUrl);
    setModel(nextProvider.models[0] ?? "");
    setAvailableModels([...nextProvider.models]);
    resetConnection();
  };

  const currentConfig = () => ({
    providerId,
    baseUrl: baseUrl.trim().replace(/\/+$/, ""),
    apiKey: apiKey.trim(),
    model: model.trim(),
    rememberKey,
  });

  const handleTest = async () => {
    if (!canTest) return;

    setConnection({
      status: "testing",
      message: "正在验证密钥并读取模型列表…",
    });

    try {
      const models = await fetchAvailableModels(currentConfig());
      setAvailableModels((previous) => uniqueModels([...previous, ...models]));

      if (!model.trim() && models.length > 0) {
        setModel(models[0]);
      }

      setConnection({
        status: "success",
        message:
          models.length > 0
            ? `连接成功，发现 ${models.length} 个模型。`
            : "连接成功，但接口没有返回模型列表，可手动填写模型名称。",
      });
    } catch (error) {
      setConnection({
        status: "error",
        message:
          error instanceof AIRequestError
            ? error.message
            : "连接失败，请检查网络、Base URL 与 API Key。",
      });
    }
  };

  const handleSave = () => {
    if (!canSave) return;

    saveConfig(currentConfig());
    onClose();
  };

  const handleClear = () => {
    clearConfig();
    setApiKey("");
    setRememberKey(false);
    setConnection({
      status: "idle",
      message: "已清除浏览器中保存的 AI 配置。",
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-5">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-[#10251c]/55 backdrop-blur-[6px]"
      />

      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-settings-title"
        aria-describedby="ai-settings-description"
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-white/70 bg-[#f7f2e7] shadow-[0_40px_100px_-30px_rgba(16,37,28,0.65)] dark:border-white/10 dark:bg-[#0b1512] dark:shadow-[0_0_90px_-30px_rgba(16,185,129,0.22)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-900/[0.07] px-5 py-4 dark:border-white/10 sm:px-7 sm:py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#173b2e] text-amber-100 shadow-[0_12px_26px_-14px_rgba(23,59,46,0.9)] dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.6)]">
              <Sparkles size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-800/65 dark:text-emerald-400/70">
                Bring your own key
              </p>
              <h2
                id="ai-settings-title"
                className="font-display mt-1 text-xl font-semibold tracking-tight text-[#15231d] dark:text-slate-100 sm:text-2xl"
              >
                AI 模型设置
              </h2>
              <p
                id="ai-settings-description"
                className="mt-1 max-w-lg text-xs leading-5 text-stone-500 dark:text-slate-400"
              >
                使用你自己的 API Key 和模型服务。密钥只留在你的浏览器，不会上传到 ExamFlash 服务器。
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="关闭 AI 设置"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-900/[0.08] bg-white/50 text-stone-500 transition-colors hover:bg-white hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/25 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="ai-provider"
                  className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-slate-400"
                >
                  服务商
                </label>
                <div className="relative mt-2">
                  <Server
                    size={15}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-800/55 dark:text-emerald-400/70"
                  />
                  <select
                    id="ai-provider"
                    value={providerId}
                    onChange={(event) =>
                      handleProviderChange(event.target.value as AIProviderId)
                    }
                    autoFocus
                    className="w-full cursor-pointer appearance-none rounded-xl border border-stone-900/10 bg-white/70 py-3 pl-10 pr-9 text-sm font-medium text-[#15231d] outline-none transition-colors focus:border-emerald-700/35 focus:bg-white focus:ring-4 focus:ring-emerald-700/10 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-100 dark:focus:border-emerald-400/30 dark:focus:bg-white/[0.08] dark:focus:ring-emerald-400/10"
                  >
                    {AI_PROVIDERS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="ai-model"
                  className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-slate-400"
                >
                  模型名称
                </label>
                <div className="relative mt-2">
                  <Cpu
                    size={15}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-800/55 dark:text-emerald-400/70"
                  />
                  <input
                    id="ai-model"
                    list="ai-model-options"
                    value={model}
                    onChange={(event) => {
                      setModel(event.target.value);
                      resetConnection();
                    }}
                    placeholder="例如 deepseek-chat"
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full rounded-xl border border-stone-900/10 bg-white/70 py-3 pl-10 pr-4 font-mono text-[13px] text-[#15231d] outline-none transition-colors placeholder:text-stone-400 focus:border-emerald-700/35 focus:bg-white focus:ring-4 focus:ring-emerald-700/10 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400/30 dark:focus:bg-white/[0.08] dark:focus:ring-emerald-400/10"
                  />
                  <datalist id="ai-model-options">
                    {modelOptions.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>
                {modelOptions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {modelOptions.slice(0, 6).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setModel(option);
                          resetConnection();
                        }}
                        className={cn(
                          "max-w-full truncate rounded-full border px-2.5 py-1 font-mono text-[9px] transition-colors",
                          model === option
                            ? "border-emerald-800/25 bg-emerald-900/[0.08] text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200"
                            : "border-stone-900/[0.07] bg-white/35 text-stone-500 hover:border-emerald-800/20 hover:text-emerald-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-emerald-400/25 dark:hover:text-emerald-200",
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-stone-400 dark:text-slate-500">
              <span>{provider.description}</span>
              {provider.keyUrl && (
                <a
                  href={provider.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-emerald-800/70 hover:text-emerald-900 dark:text-emerald-300/70 dark:hover:text-emerald-200"
                >
                  获取 API Key
                  <ExternalLink size={10} aria-hidden="true" />
                </a>
              )}
            </p>

            <div className="mt-5">
              <label
                htmlFor="ai-base-url"
                className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-slate-400"
              >
                Base URL
              </label>
              <div className="relative mt-2">
                <Server
                  size={15}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-800/55 dark:text-emerald-400/70"
                />
                <input
                  id="ai-base-url"
                  value={baseUrl}
                  onChange={(event) => {
                    setBaseUrl(event.target.value);
                    resetConnection();
                  }}
                  placeholder="https://api.example.com/v1"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full rounded-xl border border-stone-900/10 bg-white/70 py-3 pl-10 pr-4 font-mono text-[12px] text-[#15231d] outline-none transition-colors placeholder:text-stone-400 focus:border-emerald-700/35 focus:bg-white focus:ring-4 focus:ring-emerald-700/10 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400/30 dark:focus:bg-white/[0.08] dark:focus:ring-emerald-400/10"
                />
              </div>
              <p className="mt-1.5 text-[10px] text-stone-400 dark:text-slate-500">
                OpenAI 兼容地址，通常以 <span className="font-mono">/v1</span> 结尾。
              </p>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="ai-api-key"
                  className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-slate-400"
                >
                  API Key
                </label>
                {isConfigured && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-400 transition-colors hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-300"
                  >
                    <Trash2 size={11} aria-hidden="true" />
                    清除已保存配置
                  </button>
                )}
              </div>
              <div className="relative mt-2">
                <KeyRound
                  size={15}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-800/55 dark:text-emerald-400/70"
                />
                <input
                  id="ai-api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => {
                    setApiKey(event.target.value);
                    resetConnection();
                  }}
                  placeholder="sk-…（仅保存在你的浏览器）"
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  className="w-full rounded-xl border border-stone-900/10 bg-white/70 py-3 pl-10 pr-11 font-mono text-[12px] text-[#15231d] outline-none transition-colors placeholder:text-stone-400 focus:border-emerald-700/35 focus:bg-white focus:ring-4 focus:ring-emerald-700/10 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400/30 dark:focus:bg-white/[0.08] dark:focus:ring-emerald-400/10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((previous) => !previous)}
                  aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-900/[0.04] hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
                >
                  {showKey ? (
                    <EyeOff size={15} aria-hidden="true" />
                  ) : (
                    <Eye size={15} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-stone-900/[0.06] bg-white/35 px-3.5 py-3 dark:border-white/10 dark:bg-white/[0.035]">
              <input
                type="checkbox"
                checked={rememberKey}
                onChange={(event) => setRememberKey(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-800 dark:accent-emerald-400"
              />
              <span>
                <span className="block text-[11px] font-medium text-stone-700 dark:text-slate-200">
                  在此设备记住 API Key
                </span>
                <span className="mt-0.5 block text-[10px] leading-4 text-stone-400 dark:text-slate-500">
                  取消勾选时只存入 sessionStorage，关闭标签页后失效；勾选后写入
                  localStorage，下次打开仍会保留。
                </span>
              </span>
            </label>

            <div className="mt-4 rounded-xl border border-emerald-800/10 bg-emerald-50/65 p-3.5 dark:border-emerald-400/15 dark:bg-emerald-400/[0.06]">
              <div className="flex items-start gap-2.5">
                <ShieldCheck
                  size={15}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300"
                />
                <div className="text-[10px] leading-5 text-emerald-950/65 dark:text-emerald-100/65">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    密钥只在你的浏览器中
                  </p>
                  <p>
                    请求从浏览器直接发送给你选择的模型服务商，不经过 ExamFlash
                    服务器。请注意：部分服务商禁止浏览器跨域直连（CORS），若测试失败请更换兼容服务或代理地址。
                  </p>
                </div>
              </div>
            </div>

            {connection.status !== "idle" && (
              <div
                role="status"
                aria-live="polite"
                className={cn(
                  "mt-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[11px] leading-5",
                  connection.status === "testing" &&
                    "border-stone-900/10 bg-white/50 text-stone-500 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-400",
                  connection.status === "success" &&
                    "border-emerald-600/15 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/[0.06] dark:text-emerald-200",
                  connection.status === "error" &&
                    "border-rose-300/50 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/[0.06] dark:text-rose-200",
                )}
              >
                {connection.status === "testing" ? (
                  <LoaderCircle
                    size={14}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 animate-spin"
                  />
                ) : connection.status === "success" ? (
                  <Check
                    size={14}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                  />
                ) : (
                  <CircleAlert
                    size={14}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                  />
                )}
                <span>{connection.message}</span>
              </div>
            )}

            {connection.status === "idle" && connection.message && (
              <p className="mt-4 text-[10px] text-stone-400 dark:text-slate-500">
                {connection.message}
              </p>
            )}
          </div>

          <footer className="shrink-0 border-t border-stone-900/[0.07] bg-[#f7f2e7]/90 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-[#0b1512]/90 sm:px-7">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-xs font-medium text-stone-500 transition-colors hover:bg-white/60 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/10 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white sm:mr-auto"
              >
                取消
              </button>

              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={!canTest}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20",
                  canTest
                    ? "border-emerald-900/15 bg-white/60 text-emerald-900 hover:bg-white dark:border-emerald-400/20 dark:bg-white/[0.045] dark:text-emerald-200 dark:hover:bg-white/[0.08]"
                    : "cursor-not-allowed border-stone-900/[0.06] bg-white/30 text-stone-400 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-600",
                )}
              >
                {connection.status === "testing" ? (
                  <LoaderCircle
                    size={14}
                    aria-hidden="true"
                    className="animate-spin"
                  />
                ) : (
                  <Wifi size={14} aria-hidden="true" />
                )}
                测试连接并获取模型
              </button>

              <button
                type="submit"
                disabled={!canSave}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/20",
                  canSave
                    ? "bg-[#173b2e] text-[#f8f2e4] shadow-[0_12px_26px_-14px_rgba(23,59,46,0.8)] hover:-translate-y-0.5 hover:bg-[#0f2f24] dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_24px_-10px_rgba(16,185,129,0.6)] dark:hover:bg-emerald-400"
                    : "cursor-not-allowed bg-stone-900/10 text-stone-400",
                )}
              >
                <Check size={14} aria-hidden="true" />
                保存 AI 配置
              </button>
            </div>
          </footer>
        </form>
      </motion.section>
    </div>
  );
}
