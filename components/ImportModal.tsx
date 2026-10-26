"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleAlert,
  Cpu,
  FileText,
  FileUp,
  ListChecks,
  LoaderCircle,
  ScanText,
  Settings2,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { useAIConfig } from "@/context/AIConfigContext";
import { useDeck } from "@/context/DeckContext";
import {
  AIRequestError,
} from "@/lib/aiClient";
import {
  MAX_AI_SOURCE_CHARS,
  generateStudyQuestions,
  type AIGeneratedQuestion,
  type StudyQuestionType,
} from "@/lib/aiQuestionGenerator";
import {
  extractDocument,
  getDocumentFileKind,
} from "@/lib/documentExtract";
import { parseCards, type ParseFormat } from "@/lib/parser";
import { cn } from "@/lib/utils";

interface ImportModalProps {
  onClose: () => void;
  onImported: (deckId: string) => void;
  onOpenAISettings: () => void;
  suspended?: boolean;
}

interface DocumentInfo {
  kind: "pdf" | "pptx";
  pageCount: number;
  structured: boolean;
  warning?: string;
}

interface PreviewCard {
  key: string;
  question: string;
  answer: string;
  category: string;
  badge: string;
  explanation?: string;
  sourceRef?: string;
}

const FORMAT_LABELS: Record<ParseFormat, string> = {
  qa: "问答",
  markdown: "列表",
  shorthand: "简写",
};

const AI_TYPE_LABELS: Record<StudyQuestionType, string> = {
  mechanism: "机制",
  comparison: "对比",
  application: "应用",
  boundary: "边界",
  misconception: "纠错",
  causal: "因果",
};

const EXAMPLE_TEXT = `# 计算机网络 · 导入示例

Q: TCP 为什么需要三次握手？
A: 三次握手可以同步双方初始序列号，并确认彼此的收发能力。

- **HTTP/2 多路复用**：在一条 TCP 连接上并行交错多个请求，减少应用层队头阻塞。
- **CORS 预检**：浏览器在跨域复杂请求前发送 OPTIONS 请求确认权限。

机会成本 ?? 为了得到某个结果而放弃的最高价值选项。

Q：DNS 解析发生在什么时候？
A：通常发生在建立 TCP/TLS 连接之前，用于把域名转换成 IP 地址。`;

function stripExtension(fileName: string): string {
  return fileName.replace(/\.(md|txt|pdf|pptx|ppt)$/i, "").trim();
}

export default function ImportModal({
  onClose,
  onImported,
  onOpenAISettings,
  suspended = false,
}: ImportModalProps) {
  const { addDeck } = useDeck();
  const { config: aiConfig, isConfigured: isAIConfigured } = useAIConfig();
  const [deckTitle, setDeckTitle] = useState("");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("正在读取文件…");
  const [documentInfo, setDocumentInfo] = useState<DocumentInfo | null>(null);
  const [aiCards, setAiCards] = useState<AIGeneratedQuestion[] | null>(null);
  const [aiCount, setAiCount] = useState(8);
  const [aiStatus, setAiStatus] = useState<{
    status: "idle" | "generating" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiAbortRef = useRef<AbortController | null>(null);

  const parsed = useMemo(() => parseCards(text), [text]);
  const isGenerating = aiStatus.status === "generating";

  const previewCards = useMemo<PreviewCard[]>(() => {
    if (aiCards) {
      return aiCards.map((card, index) => ({
        key: `ai-${index}-${card.question}`,
        question: card.question,
        answer: card.answer,
        category: card.category,
        badge: AI_TYPE_LABELS[card.type],
        explanation: card.explanation,
        sourceRef: card.sourceRef,
      }));
    }

    return parsed.cards.map((card, index) => ({
      key: `text-${index}-${card.question}`,
      question: card.question,
      answer: card.answer,
      category: card.category,
      badge: FORMAT_LABELS[card.format],
    }));
  }, [aiCards, parsed.cards]);

  const previewIssues = aiCards ? [] : parsed.issues;
  const canSubmit =
    deckTitle.trim().length > 0 &&
    previewCards.length > 0 &&
    !isReadingFile &&
    !isGenerating;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !suspended) onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, suspended]);

  useEffect(() => {
    return () => {
      aiAbortRef.current?.abort();
    };
  }, []);

  const readFile = async (file: File) => {
    setFileError(null);
    setDocumentInfo(null);
    setAiCards(null);
    setAiStatus({ status: "idle", message: "" });
    aiAbortRef.current?.abort();

    const documentKind = getDocumentFileKind(file.name);
    const isPlainText = /\.(md|txt)$/i.test(file.name);

    if (!documentKind && !isPlainText) {
      setFileError(
        "仅支持 .md、.txt、.pdf 与 .pptx 文件，请重新选择。",
      );
      return;
    }

    if (documentKind === "ppt") {
      setFileError(
        "旧版 .ppt 是二进制格式，浏览器端无法可靠解析。请在 PowerPoint 中另存为 .pptx 后再导入。",
      );
      return;
    }

    const maxBytes = documentKind ? 20 * 1024 * 1024 : 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setFileError(
        documentKind
          ? "PDF / PPTX 文件不能超过 20MB，请拆分后再导入。"
          : "文本文件不能超过 2MB，请拆分后再导入。",
      );
      return;
    }

    setIsReadingFile(true);
    setLoadingLabel(
      documentKind === "pdf"
        ? "正在提取 PDF 文本…"
        : documentKind === "pptx"
          ? "正在解析 PPTX 幻灯片…"
          : "正在读取文本文件…",
    );

    try {
      let content: string;

      if (documentKind === "pdf" || documentKind === "pptx") {
        const extracted = await extractDocument(file);
        content = extracted.text;
        setDocumentInfo({
          kind: extracted.kind,
          pageCount: extracted.pageCount,
          structured: extracted.structured,
          warning: extracted.warning,
        });
      } else {
        content = await file.text();
      }

      setText(content);
      setFileName(file.name);
      if (!deckTitle.trim()) {
        setDeckTitle(stripExtension(file.name).slice(0, 60));
      }
    } catch (error) {
      setFileError(
        error instanceof Error
          ? error.message
          : "读取文件失败，请检查文件后重试。",
      );
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file && !isGenerating) void readFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (isGenerating) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  };

  const insertExample = () => {
    aiAbortRef.current?.abort();
    setText(EXAMPLE_TEXT);
    setFileName(null);
    setFileError(null);
    setDocumentInfo(null);
    setAiCards(null);
    setAiStatus({ status: "idle", message: "" });
    if (!deckTitle.trim()) {
      setDeckTitle("导入格式示例题库");
    }
  };

  const handleGenerateAI = async () => {
    if (
      !aiConfig ||
      !isAIConfigured ||
      !text.trim() ||
      isGenerating ||
      aiAbortRef.current
    ) {
      return;
    }

    const controller = new AbortController();
    aiAbortRef.current = controller;
    setAiStatus({
      status: "generating",
      message: "正在通读全文、筛选核心理解点并命题…",
    });

    try {
      const result = await generateStudyQuestions(aiConfig, text, {
        count: aiCount,
        signal: controller.signal,
      });

      setAiCards(result.questions);
      setAiStatus({
        status: "success",
        message: `已生成 ${result.questions.length} 道深度题 · ${result.model}${
          result.truncated
            ? ` · 文本较长，本次分析前约 ${MAX_AI_SOURCE_CHARS.toLocaleString("zh-CN")} 字符`
            : ""
        }`,
      });
    } catch (error) {
      if (
        error instanceof AIRequestError &&
        error.message.includes("请求已取消")
      ) {
        setAiStatus({ status: "idle", message: "已取消本次 AI 出题。" });
      } else {
        setAiStatus({
          status: "error",
          message:
            error instanceof AIRequestError
              ? error.message
              : "AI 出题失败，请检查模型配置后重试。",
        });
      }
    } finally {
      aiAbortRef.current = null;
    }
  };

  const handleImport = () => {
    if (!canSubmit) return;

    const cards = aiCards
      ? aiCards.map((card) => ({
          question: card.question,
          answer: card.answer,
          category: card.category,
          explanation: card.explanation,
        }))
      : parsed.cards.map((card) => ({
          question: card.question,
          answer: card.answer,
          category: card.category,
        }));

    const description = aiCards
      ? `AI 深度出题 · ${cards.length} 张卡片${
          documentInfo ? ` · 源自 ${documentInfo.kind.toUpperCase()}` : ""
        }`
      : documentInfo
        ? `由 ${documentInfo.kind.toUpperCase()} 文档导入 · ${cards.length} 张卡片`
        : `由文本导入生成 · ${cards.length} 张卡片`;

    const deckId = addDeck({
      title: deckTitle,
      description,
      cards,
    });

    onImported(deckId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-[#10251c]/55 backdrop-blur-[6px]"
      />

      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
        aria-describedby="import-modal-description"
        inert={suspended}
        aria-hidden={suspended}
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-white/70 bg-[#f7f2e7] shadow-[0_40px_100px_-30px_rgba(16,37,28,0.65)] dark:border-white/10 dark:bg-[#0b1512] dark:shadow-[0_0_90px_-30px_rgba(16,185,129,0.22)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-900/[0.07] px-5 py-4 dark:border-white/10 sm:px-7 sm:py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#173b2e] text-amber-100 shadow-[0_12px_26px_-14px_rgba(23,59,46,0.9)] dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.6)]">
              <FileUp size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-800/65 dark:text-emerald-400/70">
                Import workspace
              </p>
              <h2
                id="import-modal-title"
                className="font-display mt-1 text-xl font-semibold tracking-tight text-[#15231d] dark:text-slate-100 sm:text-2xl"
              >
                导入新题库
              </h2>
              <p
                id="import-modal-description"
                className="mt-1 max-w-xl text-xs leading-5 text-stone-500 dark:text-slate-400"
              >
                粘贴考点文本，或拖入 .md / .txt / .pdf / .pptx 文件。文档会先提取全文，可交给 AI 深度出题，也可按三种格式手动整理。
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="关闭导入弹窗"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-900/[0.08] bg-white/50 text-stone-500 transition-colors hover:bg-white hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/25 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-6 lg:p-7">
            <div className="min-w-0">
              <label
                htmlFor="deck-title"
                className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-slate-400"
              >
                新题库名称
              </label>
              <div className="relative mt-2">
                <BookOpen
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-800/60 dark:text-emerald-400/70"
                />
                <input
                  id="deck-title"
                  value={deckTitle}
                  onChange={(event) => setDeckTitle(event.target.value)}
                  maxLength={60}
                  placeholder="例如：计算机网络冲刺 01"
                  autoFocus
                  className="w-full rounded-2xl border border-stone-900/10 bg-white/70 py-3 pl-10 pr-4 text-sm font-medium text-[#15231d] outline-none transition-colors placeholder:text-stone-400 focus:border-emerald-700/35 focus:bg-white focus:ring-4 focus:ring-emerald-700/10 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400/30 dark:focus:bg-white/[0.08] dark:focus:ring-emerald-400/10"
                />
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <label
                  htmlFor="exam-text"
                  className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-slate-400"
                >
                  考点文本
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={insertExample}
                    className="rounded-full px-2.5 py-1.5 text-[10px] font-medium text-stone-500 transition-colors hover:bg-white/70 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
                  >
                    填入示例
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-900/10 bg-white/65 px-3 py-1.5 text-[10px] font-medium text-stone-600 transition-colors hover:border-emerald-800/25 hover:bg-white hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <Upload size={12} aria-hidden="true" />
                    选择文件
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.txt,.pdf,.pptx,.ppt,text/markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
                    onChange={handleFileInput}
                    disabled={isGenerating}
                    className="sr-only"
                    aria-label="上传 Markdown、文本、PDF 或 PPTX 文件"
                  />
                </div>
              </div>

              <div
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={handleDrop}
                className={cn(
                  "relative mt-2 overflow-hidden rounded-2xl border bg-white/55 transition-all dark:bg-white/[0.03]",
                  isDragging
                    ? "border-emerald-700/55 bg-emerald-50/70 ring-4 ring-emerald-700/10 dark:border-emerald-400/40 dark:bg-emerald-400/[0.06]"
                    : "border-stone-900/10 dark:border-white/10",
                )}
              >
                <textarea
                  id="exam-text"
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    setFileError(null);
                    setAiCards(null);
                    setAiStatus({ status: "idle", message: "" });
                  }}
                  disabled={isGenerating}
                  placeholder={`支持以下格式，可混合使用：

Q: 问题在这里
A: 答案写在这里

- **考点或概念**：对应解释

概念或问题 ?? 解释或答案`}
                  spellCheck={false}
                  className="min-h-[280px] w-full resize-y bg-transparent px-4 py-4 font-mono text-[12px] leading-6 text-stone-700 outline-none placeholder:text-stone-400/80 disabled:cursor-wait disabled:opacity-60 dark:text-slate-300 dark:placeholder:text-slate-400/70 sm:min-h-[320px] sm:text-[13px]"
                />

                {isDragging && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-50/90 text-emerald-900 backdrop-blur-sm dark:bg-[#0b1512]/90 dark:text-emerald-200">
                    <FileText size={28} aria-hidden="true" />
                    <p className="text-sm font-semibold">松开以读取文件</p>
                    <p className="text-[10px] text-emerald-800/60 dark:text-emerald-300/55">
                      支持 .md / .txt / .pdf / .pptx
                    </p>
                  </div>
                )}

                {isReadingFile && (
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 border-t border-emerald-800/10 bg-emerald-50/95 px-4 py-2 text-[10px] text-emerald-900 dark:border-emerald-400/15 dark:bg-[#0f1b17]/95 dark:text-emerald-200">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600 dark:bg-emerald-400" />
                    {loadingLabel}
                  </div>
                )}
              </div>

              <div className="mt-2 flex min-h-5 items-center justify-between gap-3 text-[10px]">
                <span className="truncate text-stone-400 dark:text-slate-500">
                  {fileName ? (
                    <span className="inline-flex items-center gap-1.5">
                      <FileText size={11} aria-hidden="true" />
                      {fileName}
                      {documentInfo && (
                        <span className="rounded-full bg-emerald-900/5 px-1.5 py-0.5 font-mono text-[9px] uppercase text-emerald-900/60 dark:bg-white/[0.06] dark:text-emerald-300/60">
                          {documentInfo.kind} · {documentInfo.pageCount} 页
                        </span>
                      )}
                    </span>
                  ) : (
                    "也可以将文件直接拖入文本框"
                  )}
                </span>
                <span className="shrink-0 text-stone-400 dark:text-slate-500">
                  {text.length.toLocaleString("zh-CN")} 字符
                </span>
              </div>

              {fileError && (
                <p className="mt-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] leading-5 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/[0.06] dark:text-rose-200">
                  <CircleAlert
                    size={13}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                  />
                  {fileError}
                </p>
              )}

              {documentInfo && (
                <div className="mt-2 rounded-xl border border-emerald-800/10 bg-emerald-50/70 px-3 py-2.5 dark:border-emerald-400/15 dark:bg-emerald-400/[0.06]">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-900 dark:text-emerald-200">
                    <ScanText size={12} aria-hidden="true" />
                    {documentInfo.kind === "pdf"
                      ? `已提取 PDF 共 ${documentInfo.pageCount} 页`
                      : `已解析 PPTX 共 ${documentInfo.pageCount} 页幻灯片`}
                    <span className="font-normal text-emerald-900/45 dark:text-emerald-200/45">
                      {documentInfo.structured
                        ? "· 已识别现成问答"
                        : "· 已提取全文，可用 AI 深度出题"}
                    </span>
                  </p>
                  {documentInfo.warning && (
                    <p className="mt-1 text-[10px] leading-5 text-emerald-900/60 dark:text-emerald-200/55">
                      {documentInfo.warning}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 overflow-hidden rounded-2xl border border-amber-800/15 bg-[#fffaf0] dark:border-amber-300/15 dark:bg-[#101b17]">
                <div className="flex items-start gap-3 px-4 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#173b2e] text-amber-100 dark:bg-emerald-500 dark:text-[#062018]">
                    <WandSparkles size={17} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold text-[#173b2e] dark:text-emerald-100">
                        AI 深度出题
                      </p>
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-300/10 dark:text-amber-200">
                        推荐
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-5 text-stone-500 dark:text-slate-400">
                      分析全文后只挑选少量核心理解点，问机制、对比、条件与应用，不再逐页机械出题。
                    </p>
                  </div>
                </div>

                <div className="border-t border-amber-900/10 px-4 py-3.5 dark:border-amber-300/10">
                  {!isAIConfigured ? (
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[10px] leading-5 text-stone-500 dark:text-slate-400">
                        使用你自己的 API Key 和模型。配置后即可在这里分析 PDF /
                        PPTX / 文本。
                      </p>
                      <button
                        type="button"
                        onClick={onOpenAISettings}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-900/15 bg-white/70 px-3 py-2 text-[10px] font-semibold text-emerald-900 transition-colors hover:bg-white dark:border-emerald-400/20 dark:bg-white/[0.055] dark:text-emerald-200 dark:hover:bg-white/10"
                      >
                        <Settings2 size={12} aria-hidden="true" />
                        配置 AI 模型
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5 text-[9px] text-stone-500 dark:text-slate-400">
                          <Cpu
                            size={11}
                            aria-hidden="true"
                            className="shrink-0 text-emerald-700 dark:text-emerald-400"
                          />
                          <span className="truncate font-mono">
                            {aiConfig?.model}
                          </span>
                          <button
                            type="button"
                            onClick={onOpenAISettings}
                            disabled={isGenerating}
                            className="shrink-0 font-medium text-emerald-800/70 underline decoration-emerald-800/20 underline-offset-2 hover:text-emerald-900 disabled:opacity-40 dark:text-emerald-300/70 dark:decoration-emerald-300/20 dark:hover:text-emerald-200"
                          >
                            更换
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="ai-question-count"
                            className="sr-only"
                          >
                            AI 题目数量
                          </label>
                          <div className="relative">
                            <select
                              id="ai-question-count"
                              value={aiCount}
                              onChange={(event) =>
                                setAiCount(Number(event.target.value))
                              }
                              disabled={isGenerating}
                              className="cursor-pointer appearance-none rounded-lg border border-stone-900/10 bg-white/70 py-1.5 pl-2.5 pr-7 text-[10px] font-medium text-stone-600 outline-none focus:border-emerald-700/30 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300 dark:focus:border-emerald-400/30"
                            >
                              {[6, 8, 10, 12].map((count) => (
                                <option key={count} value={count}>
                                  {count} 题
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              size={11}
                              aria-hidden="true"
                              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 dark:text-slate-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleGenerateAI()}
                            disabled={
                              !text.trim() ||
                              text.trim().length < 80 ||
                              isGenerating
                            }
                            className={cn(
                              "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[10px] font-semibold transition-all",
                              !text.trim() ||
                                text.trim().length < 80 ||
                                isGenerating
                                ? "cursor-not-allowed bg-stone-900/[0.06] text-stone-400 dark:bg-white/[0.06] dark:text-slate-600"
                                : "bg-[#173b2e] text-[#f8f2e4] shadow-[0_10px_22px_-14px_rgba(23,59,46,0.8)] hover:-translate-y-0.5 hover:bg-[#0f2f24] dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_24px_-10px_rgba(16,185,129,0.6)] dark:hover:bg-emerald-400",
                            )}
                          >
                            {isGenerating ? (
                              <LoaderCircle
                                size={12}
                                aria-hidden="true"
                                className="animate-spin"
                              />
                            ) : (
                              <Sparkles size={12} aria-hidden="true" />
                            )}
                            {isGenerating
                              ? "分析中…"
                              : aiCards
                                ? "重新生成"
                                : "AI 深度出题"}
                          </button>
                        </div>
                      </div>

                      {text.length > MAX_AI_SOURCE_CHARS && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-300/40 bg-amber-50/70 px-2.5 py-2 text-[9px] leading-4 text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/[0.07] dark:text-amber-200/80">
                          <CircleAlert
                            size={11}
                            aria-hidden="true"
                            className="mt-0.5 shrink-0"
                          />
                          文本较长。本次会分析前约{" "}
                          {MAX_AI_SOURCE_CHARS.toLocaleString("zh-CN")}{" "}
                          字符；如需覆盖全文，请拆分文件分批生成。
                        </p>
                      )}

                      {isGenerating && (
                        <div className="mt-2 flex items-start justify-between gap-3 rounded-lg border border-stone-900/[0.07] bg-white/55 px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.045]">
                          <p className="flex items-start gap-1.5 text-[9px] leading-4 text-stone-500 dark:text-slate-400">
                            <LoaderCircle
                              size={11}
                              aria-hidden="true"
                              className="mt-0.5 shrink-0 animate-spin text-emerald-700 dark:text-emerald-400"
                            />
                            {aiStatus.message}
                          </p>
                          <button
                            type="button"
                            onClick={() => aiAbortRef.current?.abort()}
                            className="shrink-0 text-[9px] font-medium text-stone-400 underline underline-offset-2 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-300"
                          >
                            取消
                          </button>
                        </div>
                      )}

                      {aiStatus.status === "error" && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[9px] leading-4 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/[0.06] dark:text-rose-200">
                          <CircleAlert
                            size={11}
                            aria-hidden="true"
                            className="mt-0.5 shrink-0"
                          />
                          {aiStatus.message}
                        </p>
                      )}

                      {aiStatus.status === "success" && aiCards && (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-600/15 bg-emerald-50 px-2.5 py-2 dark:border-emerald-400/20 dark:bg-emerald-400/[0.06]">
                          <p className="flex items-start gap-1.5 text-[9px] leading-4 text-emerald-800 dark:text-emerald-200">
                            <Check
                              size={11}
                              aria-hidden="true"
                              className="mt-0.5 shrink-0"
                            />
                            {aiStatus.message}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setAiCards(null);
                              setAiStatus({
                                status: "idle",
                                message: "已恢复为文本解析结果。",
                              });
                            }}
                            className="shrink-0 text-[9px] font-medium text-emerald-900/55 underline underline-offset-2 hover:text-emerald-900 dark:text-emerald-200/55 dark:hover:text-emerald-100"
                          >
                            改用文本解析
                          </button>
                        </div>
                      )}

                      {aiStatus.status === "idle" && aiStatus.message && (
                        <p className="mt-2 text-[9px] text-stone-400 dark:text-slate-500">
                          {aiStatus.message}
                        </p>
                      )}

                      <p className="mt-2 text-[9px] leading-4 text-stone-400 dark:text-slate-500">
                        调用会消耗你选择的模型服务额度。生成结果会先通过机械题、原文重复和长度校验。
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-stone-900/[0.07] bg-white/35 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-slate-500">
                  <ListChecks size={12} aria-hidden="true" />
                  支持格式
                </p>
                <div className="mt-2 grid gap-1.5 text-[10px] text-stone-500 dark:text-slate-400">
                  <p>
                    <span className="mr-2 inline-block rounded bg-emerald-800/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-300">
                      A
                    </span>
                    Q: 问题 / A: 答案，可跨多行
                  </p>
                  <p>
                    <span className="mr-2 inline-block rounded bg-emerald-800/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-300">
                      B
                    </span>
                    - **考点**：解释，可配合 Markdown 标题分类
                  </p>
                  <p>
                    <span className="mr-2 inline-block rounded bg-emerald-800/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-300">
                      C
                    </span>
                    概念 ?? 解释，支持全角 ？？
                  </p>
                  <p className="mt-1.5 border-t border-stone-900/[0.06] pt-2 text-[9px] leading-5 text-stone-400 dark:border-white/10 dark:text-slate-500">
                    文档：PDF / PPTX 提取全文并优先识别现成问答；没有结构化格式时，请使用上方 AI 深度出题。旧版 .ppt
                    请先在 PowerPoint 中另存为 .pptx。
                  </p>
                </div>
              </div>
            </div>

            <aside className="min-w-0">
              <div className="flex h-full min-h-[360px] flex-col overflow-hidden rounded-[22px] bg-[#173b2e] text-[#f8f2e4] shadow-[0_22px_55px_-30px_rgba(16,37,28,0.8)]">
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
                  <div>
                    <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-200/55">
                      <ScanText size={12} aria-hidden="true" />
                      Live preview
                    </p>
                    <p className="mt-1 text-sm font-medium text-white/85">
                      {aiCards ? "AI 深度题目" : "实时解析预览"}
                    </p>
                  </div>
                  <div
                    className="text-right"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <p className="font-mono text-3xl font-semibold leading-none text-amber-200">
                      {previewCards.length}
                    </p>
                    <p className="mt-1 text-[9px] text-white/50">张卡片</p>
                  </div>
                </div>

                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                  {previewCards.length === 0 ? (
                    <div className="flex min-h-[210px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 px-6 text-center">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-amber-100/70">
                        <Sparkles size={18} aria-hidden="true" />
                      </div>
                      <p className="mt-3 text-xs font-medium text-white/65">
                        等待识别考点
                      </p>
                      <p className="mt-1 max-w-[230px] text-[10px] leading-5 text-white/35">
                        {text.trim()
                          ? "当前文本没有解析出卡片。可以点击“AI 深度出题”，或按左侧格式整理文本。"
                          : "在左侧输入内容、上传文件，或点击“填入示例”快速体验。"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {previewCards.slice(0, 4).map((card, index) => (
                        <article
                          key={card.key}
                          className="rounded-2xl border border-white/10 bg-white/[0.055] p-3.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-amber-200/10 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-amber-200/80">
                              {card.badge}
                            </span>
                            <span className="truncate text-[9px] text-white/55">
                              {card.category}
                            </span>
                            {card.sourceRef && (
                              <span className="truncate text-[8px] text-white/30">
                                {card.sourceRef}
                              </span>
                            )}
                            <span className="ml-auto font-mono text-[9px] text-white/40">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-5 text-white/90">
                            {card.question}
                          </p>
                          <p className="mt-1.5 line-clamp-2 text-[10px] leading-5 text-white/60">
                            {card.answer}
                          </p>
                          {card.explanation && (
                            <p className="mt-1.5 line-clamp-1 text-[9px] leading-4 text-emerald-200/45">
                              解析：{card.explanation}
                            </p>
                          )}
                        </article>
                      ))}

                      {previewCards.length > 4 && (
                        <p className="text-center text-[9px] text-white/45">
                          还有 {previewCards.length - 4} 张卡片将在导入后显示
                        </p>
                      )}

                      {previewIssues.length > 0 && (
                        <div className="rounded-xl border border-amber-200/15 bg-amber-200/[0.06] p-3">
                          <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-200/65">
                            <CircleAlert size={11} aria-hidden="true" />
                            {previewIssues.length} 处待检查
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {previewIssues.slice(0, 3).map((issue) => (
                              <li
                                key={`${issue.line}-${issue.message}`}
                                className="text-[9px] leading-4 text-amber-100/50"
                              >
                                <span className="font-mono text-amber-200/40">
                                  L{issue.line}
                                </span>
                                <span className="mx-1.5">·</span>
                                {issue.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {previewIssues.length === 0 && (
                        <p className="flex items-center justify-center gap-1.5 pt-1 text-[9px] text-emerald-200/45">
                          <Check size={11} aria-hidden="true" />
                          {aiCards ? "AI 题目已通过基础校验" : "格式检查通过"}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="hidden shrink-0 border-t border-white/10 p-4 sm:p-5 lg:block">
                  <div className="flex items-center justify-between gap-3 text-[9px] text-white/50">
                    <span>识别 {previewCards.length} 张卡片</span>
                    <span>
                      {previewIssues.length > 0
                        ? `${previewIssues.length} 处提示`
                        : aiCards
                          ? "AI 题目可直接保存"
                          : "可以直接保存"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={!canSubmit}
                    className={cn(
                      "group mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/20",
                      canSubmit
                        ? "bg-amber-100 text-[#173b2e] shadow-[0_12px_26px_-14px_rgba(0,0,0,0.55)] hover:-translate-y-0.5 hover:bg-amber-50"
                        : "cursor-not-allowed bg-white/[0.07] text-white/25",
                    )}
                  >
                    保存并切换题库
                    <ArrowRight
                      size={15}
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </button>
                  <p className="mt-2 text-center text-[9px] text-white/40">
                    导入后自动保存在浏览器本地
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div className="shrink-0 border-t border-stone-900/10 bg-[#f7f2e7]/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#0b1512]/95 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-lg font-semibold leading-none text-[#173b2e] dark:text-emerald-300">
                {previewCards.length}
                <span className="ml-1 text-[10px] font-normal text-stone-400 dark:text-slate-500">
                  张卡片
                </span>
              </p>
              <p className="mt-1 text-[9px] text-stone-400 dark:text-slate-500">
                {previewIssues.length > 0
                  ? `${previewIssues.length} 处待检查，仍可保存`
                  : aiCards
                    ? "AI 题目已通过基础校验"
                    : "格式检查通过，可以保存"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleImport}
              disabled={!canSubmit}
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25",
                canSubmit
                  ? "bg-[#173b2e] text-[#f8f2e4] hover:bg-[#0f2f24] dark:bg-emerald-500 dark:text-[#062018] dark:hover:bg-emerald-400"
                  : "cursor-not-allowed bg-stone-900/10 text-stone-400 dark:bg-white/10 dark:text-slate-500",
              )}
            >
              保存并切换
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
