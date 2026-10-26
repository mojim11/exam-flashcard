"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { motion } from "framer-motion";
import {
  ArchiveRestore,
  Check,
  CircleAlert,
  Database,
  Download,
  FileJson,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import { useDeck } from "@/context/DeckContext";
import {
  backupFileName,
  createExamFlashBackup,
  parseExamFlashBackup,
  type ParsedBackup,
} from "@/lib/dataBackup";
import { cn } from "@/lib/utils";

interface DataSettingsModalProps {
  onClose: () => void;
}

type ActionNotice = {
  kind: "success" | "error";
  message: string;
} | null;

export default function DataSettingsModal({
  onClose,
}: DataSettingsModalProps) {
  const {
    decks,
    selectedDeckId,
    replaceAllData,
    resetAllData,
  } = useDeck();
  const [importPreview, setImportPreview] = useState<ParsedBackup | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [notice, setNotice] = useState<ActionNotice>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const cards = decks.reduce((total, deck) => total + deck.cards.length, 0);
    const mistakes = decks.reduce(
      (total, deck) => total + (deck.mistakeCardIds?.length ?? 0),
      0,
    );
    return { decks: decks.length, cards, mistakes };
  }, [decks]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showResetConfirm) {
        setShowResetConfirm(false);
      } else {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, showResetConfirm]);

  const handleExport = () => {
    const backup = createExamFlashBackup(decks, selectedDeckId);
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = backupFileName(backup.exportedAt);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    setNotice({
      kind: "success",
      message: "备份已生成，包含全部题库、掌握度与错题记录。",
    });
  };

  const handleFile = async (file: File) => {
    setNotice(null);
    setImportPreview(null);
    setImportFileName(file.name);

    if (!file.name.toLowerCase().endsWith(".json")) {
      setNotice({ kind: "error", message: "请选择 .json 备份文件。" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setNotice({
        kind: "error",
        message: "备份文件不能超过 10MB，请确认文件是否正确。",
      });
      return;
    }

    setIsReading(true);
    try {
      const raw = await file.text();
      setImportPreview(parseExamFlashBackup(raw));
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "读取备份文件失败，请检查文件。",
      });
    } finally {
      setIsReading(false);
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleFile(file);
  };

  const handleRestore = () => {
    if (!importPreview) return;

    replaceAllData(importPreview.decks, importPreview.selectedDeckId);
    setNotice({
      kind: "success",
      message: `已恢复 ${importPreview.decks.length} 套题库，共 ${importPreview.cardCount} 张卡片。`,
    });
    setImportPreview(null);
  };

  const handleResetAll = () => {
    resetAllData();
    setShowResetConfirm(false);
    setImportPreview(null);
    setImportFileName(null);
    setNotice({
      kind: "success",
      message: "已清空自定义数据并恢复初始预设题库。AI 配置与主题设置未受影响。",
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-5">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-[#10251c]/55 backdrop-blur-[6px] dark:bg-black/70"
      />

      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-settings-title"
        aria-describedby="data-settings-description"
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-white/70 bg-[#f7f2e7] shadow-[0_40px_100px_-30px_rgba(16,37,28,0.65)] dark:border-white/10 dark:bg-[#0b1512] dark:shadow-[0_0_80px_-30px_rgba(16,185,129,0.22)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-900/[0.07] px-5 py-4 dark:border-white/10 sm:px-7 sm:py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#173b2e] text-amber-100 shadow-[0_12px_26px_-14px_rgba(23,59,46,0.9)] dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.6)]">
              <Database size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-800/65 dark:text-emerald-400/70">
                Local data vault
              </p>
              <h2
                id="data-settings-title"
                className="font-display mt-1 text-xl font-semibold tracking-tight text-[#15231d] dark:text-slate-100 sm:text-2xl"
              >
                数据与备份
              </h2>
              <p
                id="data-settings-description"
                className="mt-1 max-w-lg text-xs leading-5 text-stone-500 dark:text-slate-400"
              >
                所有题库与进度仅保存在当前浏览器。建议定期导出 JSON 备份。
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="关闭数据设置"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-900/[0.08] bg-white/50 text-stone-500 transition-colors hover:bg-white hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/25 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "题库", value: stats.decks, unit: "套" },
              { label: "卡片", value: stats.cards, unit: "张" },
              { label: "错题", value: stats.mistakes, unit: "张" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-stone-900/[0.07] bg-white/55 px-3 py-3.5 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <p className="text-[9px] text-stone-400 dark:text-slate-500">
                  {item.label}
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold text-[#173b2e] dark:text-emerald-300">
                  {item.value}
                  <span className="ml-1 text-[10px] font-normal text-stone-400 dark:text-slate-500">
                    {item.unit}
                  </span>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <section className="flex flex-col rounded-2xl border border-stone-900/[0.07] bg-white/55 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-800/10 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
                  <Download size={15} aria-hidden="true" />
                </div>
                <h3 className="text-sm font-semibold text-[#15231d] dark:text-slate-100">
                  导出所有数据
                </h3>
              </div>
              <p className="mt-2 flex-1 text-[11px] leading-5 text-stone-500 dark:text-slate-400">
                下载包含全部题库、卡片掌握度、当前题库与错题记录的 JSON
                备份。不包含 API Key。
              </p>
              <button
                type="button"
                onClick={handleExport}
                className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#173b2e] px-4 py-2.5 text-xs font-semibold text-[#f8f2e4] transition-colors hover:bg-[#0f2f24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20 dark:bg-emerald-500 dark:text-[#062018] dark:hover:bg-emerald-400"
              >
                <Download size={13} aria-hidden="true" />
                下载 JSON 备份
              </button>
            </section>

            <section className="flex flex-col rounded-2xl border border-stone-900/[0.07] bg-white/55 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-700/10 text-amber-800 dark:bg-amber-300/10 dark:text-amber-300">
                  <Upload size={15} aria-hidden="true" />
                </div>
                <h3 className="text-sm font-semibold text-[#15231d] dark:text-slate-100">
                  导入数据
                </h3>
              </div>
              <p className="mt-2 flex-1 text-[11px] leading-5 text-stone-500 dark:text-slate-400">
                从 ExamFlash 导出的 JSON
                恢复题库。导入前会显示预览，确认后才覆盖当前数据。
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileInput}
                className="sr-only"
                aria-label="选择 ExamFlash JSON 备份文件"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isReading}
                className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-900/10 bg-white/70 px-4 py-2.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20 disabled:cursor-wait disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10"
              >
                {isReading ? (
                  <LoaderCircle
                    size={13}
                    aria-hidden="true"
                    className="animate-spin"
                  />
                ) : (
                  <FileJson size={13} aria-hidden="true" />
                )}
                选择备份文件
              </button>
            </section>
          </div>

          {importPreview && (
            <div className="mt-3 rounded-2xl border border-amber-300/50 bg-amber-50/80 p-4 dark:border-amber-300/15 dark:bg-amber-300/[0.06]">
              <div className="flex items-start gap-2.5">
                <ArchiveRestore
                  size={17}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                    已读取备份，确认后将覆盖当前数据
                  </p>
                  <p className="mt-1 truncate text-[10px] text-amber-800/60 dark:text-amber-100/50">
                    {importFileName ?? "backup.json"}
                    {importPreview.exportedAt
                      ? ` · 导出于 ${importPreview.exportedAt.slice(0, 10)}`
                      : ""}
                  </p>
                  <p className="mt-2 text-[10px] leading-5 text-amber-800/75 dark:text-amber-100/65">
                    {importPreview.decks.length} 套题库 ·{" "}
                    {importPreview.cardCount} 张卡片 ·{" "}
                    {importPreview.mistakeCount} 条错题记录
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleRestore}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-700 px-3.5 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-amber-800 dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200"
                    >
                      <Check size={12} aria-hidden="true" />
                      确认覆盖恢复
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImportPreview(null);
                        setImportFileName(null);
                      }}
                      className="rounded-xl px-3 py-2 text-[11px] font-medium text-amber-800/60 transition-colors hover:bg-amber-100/70 hover:text-amber-900 dark:text-amber-100/55 dark:hover:bg-white/5 dark:hover:text-amber-100"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {notice && (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[11px] leading-5",
                notice.kind === "success"
                  ? "border-emerald-600/15 bg-emerald-50 text-emerald-800 dark:border-emerald-400/15 dark:bg-emerald-400/[0.06] dark:text-emerald-200"
                  : "border-rose-300/50 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/[0.06] dark:text-rose-200",
              )}
            >
              {notice.kind === "success" ? (
                <Check size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
              ) : (
                <CircleAlert
                  size={13}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0"
                />
              )}
              {notice.message}
            </div>
          )}

          <section className="mt-5 rounded-2xl border border-rose-300/40 bg-rose-50/50 p-4 dark:border-rose-400/15 dark:bg-rose-400/[0.045]">
            <div className="flex items-start gap-2.5">
              <ShieldAlert
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-300"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-100">
                    清空所有数据
                  </h3>
                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-200">
                    Danger
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-rose-800/60 dark:text-rose-100/50">
                  删除自建题库、掌握度和错题记录，并恢复两套初始预设。AI
                  配置与主题设置不会受影响。
                </p>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-rose-400/30 bg-white/50 px-3.5 py-2 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/30 dark:border-rose-300/15 dark:bg-white/[0.04] dark:text-rose-200 dark:hover:bg-rose-400/10"
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  清空并恢复初始预设
                </button>
              </div>
            </div>
          </section>

          <p className="mt-4 text-center text-[9px] leading-5 text-stone-400 dark:text-slate-500">
            备份文件仅在浏览器内解析，不会上传到服务器。导入的数据会经过结构校验。
          </p>
        </div>

        <footer className="shrink-0 border-t border-stone-900/[0.07] bg-[#f7f2e7]/90 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-[#0b1512]/90 sm:px-7">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-xl border border-stone-900/10 bg-white/55 px-4 py-2.5 text-xs font-semibold text-stone-600 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 dark:hover:bg-white/[0.08] sm:w-auto"
          >
            完成
          </button>
        </footer>

        {showResetConfirm && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#10251c]/45 p-4 backdrop-blur-[3px] dark:bg-black/60">
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="reset-data-title"
              aria-describedby="reset-data-description"
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-sm rounded-2xl border border-white/70 bg-[#fcf9f1] p-5 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.55)] dark:border-white/10 dark:bg-[#0f1b17]"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-300">
                  <ShieldAlert size={17} aria-hidden="true" />
                </div>
                <h3
                  id="reset-data-title"
                  className="text-sm font-semibold text-[#15231d] dark:text-slate-100"
                >
                  确认清空所有数据？
                </h3>
              </div>
              <p
                id="reset-data-description"
                className="mt-3 text-[11px] leading-5 text-stone-500 dark:text-slate-400"
              >
                自建题库、卡片掌握度、当前进度和错题记录都会被删除，并恢复初始预设。此操作不可撤销，建议先导出备份。
              </p>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="rounded-xl px-3.5 py-2.5 text-xs font-medium text-stone-500 transition-colors hover:bg-white/60 hover:text-stone-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
                >
                  确认清空并恢复
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.section>
    </div>
  );
}
