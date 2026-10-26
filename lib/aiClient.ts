import type { AIConfig } from "@/types/ai";

export class AIRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AIRequestError";
    this.status = status;
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AIRequestError(
      "Base URL 格式不正确，应类似 https://api.example.com/v1。",
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new AIRequestError("Base URL 只支持 http:// 或 https:// 地址。");
  }

  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload)) {
      if (isRecord(payload.error) && typeof payload.error.message === "string") {
        return payload.error.message;
      }
      if (typeof payload.message === "string") return payload.message;
    }
  } catch {
    // Fall through to a status-based message.
  }

  return response.statusText || `HTTP ${response.status}`;
}

function requestErrorMessage(status: number, detail: string): string {
  if (status === 401) {
    return `API Key 无效或已过期。请重新检查密钥。（${detail}）`;
  }
  if (status === 403) {
    return `当前 API Key 没有访问该模型的权限。（${detail}）`;
  }
  if (status === 404) {
    return `接口地址不存在。Base URL 通常需要以 /v1 结尾。（${detail}）`;
  }
  if (status === 429) {
    return `请求频率或额度已受限，请稍后再试。（${detail}）`;
  }
  if (status >= 500) {
    return `模型服务暂时不可用，请稍后再试。（${detail}）`;
  }

  return `连接失败（HTTP ${status}）：${detail}`;
}

/**
 * Fetches the provider's model list using the user's own key.
 * The request goes directly from this browser to the selected provider.
 */
export async function fetchAvailableModels(
  config: AIConfig,
): Promise<string[]> {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const apiKey = config.apiKey.trim();

  if (!apiKey) {
    throw new AIRequestError("请先填写 API Key。");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      cache: "no-store",
      mode: "cors",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AIRequestError("连接超时（20 秒），请检查网络或 Base URL。");
    }

    throw new AIRequestError(
      "无法连接模型服务。可能是网络问题，或该服务商不允许浏览器跨域直连（CORS）。",
    );
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await readApiErrorMessage(response);
    throw new AIRequestError(
      requestErrorMessage(response.status, detail),
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AIRequestError("接口返回的内容不是有效的 JSON。");
  }

  const rawModels = isRecord(payload) && Array.isArray(payload.data)
    ? payload.data
    : [];
  const models = [
    ...new Set(
      rawModels.flatMap((item) => {
        if (typeof item === "string") return [item];
        if (isRecord(item) && typeof item.id === "string") return [item.id];
        return [];
      }),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return models;
}

function extractAssistantContent(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return null;

  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice)) return null;

  const message = firstChoice.message;
  if (!isRecord(message)) return null;

  if (typeof message.content === "string") {
    return message.content.trim();
  }

  if (Array.isArray(message.content)) {
    const text = message.content
      .flatMap((part) => {
        if (!isRecord(part)) return [];
        if (typeof part.text === "string") return [part.text];
        return [];
      })
      .join("")
      .trim();

    return text || null;
  }

  return null;
}

/**
 * Calls an OpenAI-compatible chat completion endpoint from the browser.
 * The user's API key is sent only to the provider configured by that user.
 */
export async function createChatCompletion(
  config: AIConfig,
  messages: readonly ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<string> {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const apiKey = config.apiKey.trim();
  const model = config.model.trim();

  if (!apiKey) throw new AIRequestError("请先填写 API Key。");
  if (!model) throw new AIRequestError("请先选择或填写模型名称。");
  if (messages.length === 0) {
    throw new AIRequestError("请求内容不能为空。");
  }

  if (options.signal?.aborted) {
    throw new AIRequestError("请求已取消。");
  }

  const controller = new AbortController();
  let timedOut = false;
  const handleExternalAbort = () => controller.abort();
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 90000);

  options.signal?.addEventListener("abort", handleExternalAbort, {
    once: true,
  });

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.4,
        stream: false,
      }),
      signal: controller.signal,
      cache: "no-store",
      mode: "cors",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      if (options.signal?.aborted) {
        throw new AIRequestError("请求已取消。");
      }
      if (timedOut) {
        throw new AIRequestError(
          "模型响应超时（90 秒），请稍后重试或换用更快的模型。",
        );
      }
    }

    throw new AIRequestError(
      "无法连接模型服务。可能是网络问题，或该服务商不允许浏览器跨域直连（CORS）。",
    );
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", handleExternalAbort);
  }

  if (!response.ok) {
    const detail = await readApiErrorMessage(response);
    throw new AIRequestError(
      requestErrorMessage(response.status, detail),
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AIRequestError("模型接口返回的内容不是有效的 JSON。");
  }

  if (isRecord(payload) && isRecord(payload.error)) {
    const detail =
      typeof payload.error.message === "string"
        ? payload.error.message
        : "模型服务返回错误。";
    throw new AIRequestError(detail);
  }

  const content = extractAssistantContent(payload);
  if (!content) {
    throw new AIRequestError("模型没有返回可用的文本内容。");
  }

  return content;
}

function extractDeltaContent(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return null;

  const choice = payload.choices[0];
  if (!isRecord(choice) || !isRecord(choice.delta)) return null;

  const content = choice.delta.content;
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .flatMap((part) => {
        if (!isRecord(part)) return [];
        if (typeof part.text === "string") return [part.text];
        return [];
      })
      .join("");
  }

  return null;
}

/**
 * Streams an OpenAI-compatible chat completion from the browser.
 *
 * The async generator yields content deltas as they arrive. Callers can stop
 * consumption at any time, which closes the underlying request.
 */
export async function* streamChatCompletion(
  config: AIConfig,
  messages: readonly ChatMessage[],
  options: ChatCompletionOptions = {},
): AsyncGenerator<string> {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const apiKey = config.apiKey.trim();
  const model = config.model.trim();

  if (!apiKey) throw new AIRequestError("请先填写 API Key。");
  if (!model) throw new AIRequestError("请先选择或填写模型名称。");
  if (messages.length === 0) {
    throw new AIRequestError("请求内容不能为空。");
  }

  if (options.signal?.aborted) {
    throw new AIRequestError("请求已取消。");
  }

  const controller = new AbortController();
  let timedOut = false;
  const handleExternalAbort = () => controller.abort();
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 120000);

  options.signal?.addEventListener("abort", handleExternalAbort, {
    once: true,
  });

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.5,
        stream: true,
      }),
      signal: controller.signal,
      cache: "no-store",
      mode: "cors",
    });
  } catch (error) {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", handleExternalAbort);

    if (error instanceof DOMException && error.name === "AbortError") {
      if (options.signal?.aborted) {
        throw new AIRequestError("请求已取消。");
      }
      if (timedOut) {
        throw new AIRequestError(
          "模型响应超时（120 秒），请稍后重试或换用更快的模型。",
        );
      }
    }

    throw new AIRequestError(
      "无法连接模型服务。可能是网络问题，或该服务商不允许浏览器跨域直连（CORS）。",
    );
  }

  try {
    if (!response.ok) {
      const detail = await readApiErrorMessage(response);
      throw new AIRequestError(
        requestErrorMessage(response.status, detail),
        response.status,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("text/event-stream")) {
      const payload: unknown = await response.json();
      if (isRecord(payload) && isRecord(payload.error)) {
        throw new AIRequestError(
          typeof payload.error.message === "string"
            ? payload.error.message
            : "模型服务返回错误。",
        );
      }

      const content = extractAssistantContent(payload);
      if (!content) {
        throw new AIRequestError("模型没有返回可用的文本内容。");
      }
      yield content;
      return;
    }

    if (!response.body) {
      throw new AIRequestError("模型响应没有可读取的内容流。");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let hasContent = false;
    let finished = false;

    try {
      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;

          const data = trimmed.startsWith("data:")
            ? trimmed.slice(5).trim()
            : trimmed.startsWith("{")
              ? trimmed
              : null;

          if (!data) continue;
          if (data === "[DONE]") {
            finished = true;
            break;
          }

          let payload: unknown;
          try {
            payload = JSON.parse(data);
          } catch {
            continue;
          }

          if (isRecord(payload) && isRecord(payload.error)) {
            throw new AIRequestError(
              typeof payload.error.message === "string"
                ? payload.error.message
                : "模型流式响应返回错误。",
            );
          }

          const delta = extractDeltaContent(payload);
          if (delta) {
            hasContent = true;
            yield delta;
          }
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }

    if (!hasContent) {
      throw new AIRequestError("模型没有返回可用的文本内容。");
    }
  } catch (error) {
    if (error instanceof AIRequestError) throw error;

    if (error instanceof DOMException && error.name === "AbortError") {
      if (options.signal?.aborted) {
        throw new AIRequestError("请求已取消。");
      }
      if (timedOut) {
        throw new AIRequestError(
          "模型响应超时（120 秒），请稍后重试或换用更快的模型。",
        );
      }
    }

    throw new AIRequestError(
      "读取模型流式响应失败。可能是网络中断，或该服务商不支持流式输出。",
    );
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", handleExternalAbort);
  }
}
