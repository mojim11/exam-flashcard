"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Check,
  ChevronDown,
  Database,
  Layers,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import AISettingsModal from "@/components/AISettingsModal";
import AITutorDrawer from "@/components/AITutorDrawer";
import DataSettingsModal from "@/components/DataSettingsModal";
import FlashcardViewer from "@/components/FlashcardViewer";
import ImportModal from "@/components/ImportModal";
import QuizMode from "@/components/QuizMode";
import RoundSummary from "@/components/RoundSummary";
import ThemeToggle from "@/components/ThemeToggle";
import { useAIConfig } from "@/context/AIConfigContext";
import { useDeck } from "@/context/DeckContext";
import { cn } from "@/lib/utils";
import type { TutorContext } from "@/types/tutor";

type StudyMode = "flashcards" | "quiz";

function AmbientBackdrop() {
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[#f3eee2] dark:bg-[#070d0b]"
      />
      <div
        aria-hidden="true"
        className="grid-overlay absolute inset-0 opacity-70 dark:opacity-50"
      />
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-40 h-[34rem] w-[34rem] rounded-full bg-emerald-200/35 blur-[110px] dark:bg-emerald-500/10"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-52 -left-24 h-[30rem] w-[30rem] rounded-full bg-amber-200/35 blur-[110px] dark:bg-amber-500/[0.07]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-[#e8dfcf]/70 to-transparent dark:from-[#0b1512]/80"
      />
    </>
  );
}

function LoadingScreen() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <AmbientBackdrop />
      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#173b2e] text-amber-100 shadow-[0_18px_40px_-18px_rgba(23,59,46,0.8)]">
          <Layers size={24} aria-hidden="true" className="animate-pulse" />
        </div>
        <div>
          <p className="font-display text-lg font-semibold text-[#15231d]">
            ExamFlash
          </p>
          <p className="mt-1 text-xs text-stone-500">正在恢复学习进度…</p>
        </div>
      </div>
    </main>
  );
}

function EmptyDeck({ onImport }: { onImport: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative overflow-hidden rounded-[30px] border border-[#dcd2bf] bg-[#fcf9f1] p-8 text-center shadow-[0_28px_75px_-36px_rgba(27,43,35,0.5)] dark:border-white/10 dark:bg-[#0b1613] dark:shadow-[0_0_70px_-30px_rgba(16,185,129,0.35)] sm:p-12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]"
      >
        <div className="absolute -right-24 -top-28 h-64 w-64 rounded-full bg-emerald-100/70 blur-3xl dark:bg-emerald-500/10" />
        <div className="absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-amber-100/60 blur-3xl dark:bg-amber-500/[0.06]" />
      </div>

      <div className="relative">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-900/10 bg-[#173b2e] text-amber-100 shadow-[0_16px_34px_-18px_rgba(23,59,46,0.8)] dark:border-emerald-400/20 dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_34px_-10px_rgba(16,185,129,0.65)]">
          <BookOpen size={27} aria-hidden="true" />
        </div>
        <p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-800/55 dark:text-emerald-400/60">
          Empty deck
        </p>
        <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight text-[#15231d] dark:text-slate-100 sm:text-3xl">
          这张题库还是空的。
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500 dark:text-slate-400">
          把零散的笔记变成可以反复回忆的卡片。
          <br className="hidden sm:block" />
          去导入第一批考点，ExamFlash 才能开始陪你练习。
        </p>
        <button
          type="button"
          onClick={onImport}
          className="group mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#173b2e] px-5 py-3.5 text-sm font-semibold text-[#f8f2e4] shadow-[0_14px_30px_-16px_rgba(23,59,46,0.8)] transition-all hover:-translate-y-0.5 hover:bg-[#0f2f24] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25 dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_30px_-12px_rgba(16,185,129,0.65)] dark:hover:bg-emerald-400"
        >
          <Plus size={16} aria-hidden="true" />
          去导入第一批考点
        </button>
      </div>
    </motion.section>
  );
}

export default function StudyWorkspace() {
  const {
    decks,
    selectedDeck,
    selectedDeckId,
    isHydrated,
    isComplete,
    currentPosition,
    roundTotal,
    deckCardCount,
    reviewedCount,
    masteredCount,
    mistakeCount,
    masteryPercent,
    selectDeck,
    resetCurrentDeck,
  } = useDeck();
  const {
    config: aiConfig,
    isConfigured: isAIConfigured,
  } = useAIConfig();
  const [mode, setMode] = useState<StudyMode>("flashcards");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [isDataSettingsOpen, setIsDataSettingsOpen] = useState(false);
  const [tutorContext, setTutorContext] = useState<TutorContext | null>(null);

  if (!isHydrated) {
    return <LoadingScreen />;
  }

  const isDeckEmpty = selectedDeck.cards.length === 0;

  const handleReset = () => {
    const confirmed = window.confirm(
      "确定重置当前题库吗？所有卡片的掌握度、本轮进度和错题集合都会被清空。",
    );
    if (confirmed) resetCurrentDeck();
  };

  return (
    <main className="relative min-h-screen overflow-hidden text-[#15231d] dark:text-slate-100">
      <AmbientBackdrop />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-6 pt-5 sm:px-6 sm:pt-7 lg:px-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#173b2e] text-amber-100 shadow-[0_10px_24px_-12px_rgba(23,59,46,0.9)] dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_28px_-8px_rgba(16,185,129,0.55)]">
              <Layers size={19} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold leading-none tracking-tight">
                ExamFlash
              </p>
              <p className="mt-1.5 hidden truncate text-[9px] font-medium uppercase tracking-[0.22em] text-stone-400 dark:text-slate-500 min-[360px]:block">
                Flashcards &amp; recall
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsAISettingsOpen(true)}
              aria-label={
                isAIConfigured
                  ? "AI 模型已配置，打开设置"
                  : "打开 AI 模型设置"
              }
              title={
                isAIConfigured
                  ? `当前模型：${aiConfig?.model ?? ""}`
                  : "配置你自己的 API Key 与模型"
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-900/[0.07] bg-white/50 px-2.5 py-2 text-[10px] font-medium text-stone-500 backdrop-blur transition-colors hover:bg-white/80 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Sparkles
                size={12}
                aria-hidden="true"
                className={cn(
                  isAIConfigured
                    ? "text-amber-600"
                    : "text-stone-400",
                  "dark:text-amber-300/80",
                )}
              />
              <span className="hidden sm:inline">
                {isAIConfigured ? "AI 已配置" : "AI 设置"}
              </span>
              <span className="hidden min-[360px]:inline sm:hidden">AI</span>
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isAIConfigured
                    ? "bg-emerald-500 dark:bg-emerald-400"
                    : "bg-stone-300 dark:bg-slate-600",
                )}
              />
            </button>

            <button
              type="button"
              onClick={() => setIsDataSettingsOpen(true)}
              aria-label="打开数据与备份"
              title="数据与备份"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-stone-900/[0.07] bg-white/50 px-2.5 text-[10px] font-medium text-stone-500 backdrop-blur transition-colors hover:bg-white/80 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Database size={13} aria-hidden="true" />
              <span className="hidden sm:inline">数据</span>
            </button>

            <ThemeToggle />

            <div className="hidden items-center gap-2 rounded-full border border-stone-900/[0.07] bg-white/50 px-3 py-2 text-[10px] font-medium text-stone-500 backdrop-blur md:inline-flex dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-400">
              <Check
                size={12}
                aria-hidden="true"
                className="text-emerald-700 dark:text-emerald-400"
              />
              进度自动保存在本机
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col py-6 sm:py-8">
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                role="group"
                aria-label="学习模式"
                className="inline-flex self-start rounded-full border border-stone-900/[0.07] bg-white/45 p-1 backdrop-blur dark:border-white/10 dark:bg-slate-900/60"
              >
                <button
                  type="button"
                  onClick={() => setMode("flashcards")}
                  aria-pressed={mode === "flashcards"}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/25 sm:px-4",
                    mode === "flashcards"
                      ? "bg-[#173b2e] text-[#f8f2e4] shadow-[0_8px_20px_-12px_rgba(23,59,46,0.9)] dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_20px_-6px_rgba(16,185,129,0.55)]"
                      : "text-stone-500 hover:bg-white/60 hover:text-stone-800 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100",
                  )}
                >
                  <Layers size={13} aria-hidden="true" />
                  闪卡记忆
                </button>
                <button
                  type="button"
                  onClick={() => setMode("quiz")}
                  aria-pressed={mode === "quiz"}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/25 sm:px-4",
                    mode === "quiz"
                      ? "bg-[#173b2e] text-[#f8f2e4] shadow-[0_8px_20px_-12px_rgba(23,59,46,0.9)] dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_20px_-6px_rgba(16,185,129,0.55)]"
                      : "text-stone-500 hover:bg-white/60 hover:text-stone-800 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100",
                  )}
                >
                  <Target size={13} aria-hidden="true" />
                  闯关自测
                </button>
              </div>

              <div className="flex min-w-0 items-center gap-2">
                <div className="relative flex min-w-0 flex-1 items-center rounded-xl border border-stone-900/[0.08] bg-white/50 backdrop-blur transition-colors focus-within:border-emerald-700/25 focus-within:bg-white/75 dark:border-white/10 dark:bg-slate-900/60 dark:focus-within:border-emerald-400/30 dark:focus-within:bg-slate-900/80 sm:w-[230px] sm:flex-none">
                  <BookOpen
                    size={13}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 text-emerald-800/55 dark:text-emerald-400/70"
                  />
                  <select
                    value={selectedDeckId}
                    onChange={(event) => selectDeck(event.target.value)}
                    aria-label="切换题库"
                    className="w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent py-2.5 pl-8 pr-7 text-[11px] font-semibold text-stone-700 outline-none dark:text-slate-200"
                  >
                    {decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {deck.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={13}
                    aria-hidden="true"
                    className="pointer-events-none absolute right-2.5 text-stone-400 dark:text-slate-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#173b2e] px-3 py-2.5 text-[11px] font-semibold text-[#f8f2e4] shadow-[0_10px_22px_-14px_rgba(23,59,46,0.9)] transition-all hover:-translate-y-0.5 hover:bg-[#0f2f24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/25 dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_24px_-10px_rgba(16,185,129,0.65)] dark:hover:bg-emerald-400"
                >
                  <Plus size={13} aria-hidden="true" />
                  导入新题库
                </button>
              </div>
            </div>

            <div
              aria-label="题库进度摘要"
              className="mb-3 flex items-center gap-3 rounded-2xl border border-white/70 bg-white/55 px-3.5 py-2.5 shadow-[0_10px_30px_-26px_rgba(27,43,35,0.55)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/55 sm:hidden"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[10px] font-medium text-stone-600 dark:text-slate-300">
                    {selectedDeck.title}
                  </p>
                  <span className="shrink-0 font-mono text-[9px] tabular-nums text-stone-400 dark:text-slate-500">
                    {masteryPercent}%
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-stone-900/[0.08] dark:bg-white/10">
                  <motion.div
                    initial={false}
                    animate={{ width: `${masteryPercent}%` }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full bg-emerald-700 dark:bg-emerald-400"
                  />
                </div>
              </div>
              <div className="shrink-0 border-l border-stone-900/[0.07] pl-3 text-right dark:border-white/10">
                <p className="font-mono text-[11px] font-semibold tabular-nums text-[#173b2e] dark:text-emerald-300">
                  {mode === "quiz"
                    ? `${mistakeCount} 错题`
                    : `${reviewedCount}/${roundTotal}`}
                </p>
                <p className="mt-0.5 whitespace-nowrap text-[8px] text-stone-400 dark:text-slate-500">
                  掌握 {masteredCount}/{deckCardCount}
                </p>
              </div>
            </div>

            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="hidden rounded-[24px] border border-white/70 bg-white/55 p-4 shadow-[0_16px_45px_-32px_rgba(27,43,35,0.5)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/55 dark:shadow-[0_20px_60px_-34px_rgba(0,0,0,0.8)] sm:block sm:p-5"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-800/70 dark:text-emerald-400/70">
                    <BookOpen size={12} aria-hidden="true" />
                    当前题库
                  </p>
                  <h1 className="font-display mt-1.5 text-xl font-semibold tracking-tight text-[#15231d] dark:text-slate-100 sm:text-2xl">
                    {selectedDeck.title}
                  </h1>
                  <p className="mt-1.5 hidden max-w-xl text-xs leading-5 text-stone-500 dark:text-slate-400 sm:block sm:text-[13px]">
                    {selectedDeck.description}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-4 self-stretch border-t border-stone-900/[0.06] pt-4 dark:border-white/10 sm:gap-5 sm:self-center sm:border-0 sm:pt-0">
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-stone-400 dark:text-slate-500">
                      {mode === "quiz" ? "错题集合" : "本轮进度"}
                    </p>
                    <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#173b2e] dark:text-emerald-300">
                      {mode === "quiz" ? mistakeCount : reviewedCount}
                      <span className="text-xs font-normal text-stone-400 dark:text-slate-500">
                        {mode === "quiz" ? (
                          " 张"
                        ) : (
                          <> / {roundTotal}</>
                        )}
                      </span>
                    </p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="h-8 w-px bg-stone-900/[0.08] dark:bg-white/10"
                  />
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-stone-400 dark:text-slate-500">
                      已掌握
                    </p>
                    <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#173b2e] dark:text-emerald-300">
                      {masteredCount}
                      <span className="text-xs font-normal text-stone-400 dark:text-slate-500">
                        {" "}
                        / {deckCardCount}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div
                  role="progressbar"
                  aria-label="题库掌握度"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={masteryPercent}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-900/[0.08] dark:bg-white/10"
                >
                  <motion.div
                    initial={false}
                    animate={{ width: `${masteryPercent}%` }}
                    transition={{
                      duration: 0.55,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-800 to-emerald-500 dark:from-emerald-400 dark:to-emerald-300"
                  />
                </div>
                <span className="min-w-8 text-right font-mono text-[10px] font-medium tabular-nums text-stone-400 dark:text-slate-500">
                  {masteryPercent}%
                </span>
              </div>
            </motion.section>

            <div className="mt-6">
              <AnimatePresence mode="wait" initial={false}>
                {isDeckEmpty ? (
                  <EmptyDeck
                    key="empty-deck"
                    onImport={() => setIsImportOpen(true)}
                  />
                ) : mode === "quiz" ? (
                  <QuizMode
                    key={`quiz-${selectedDeckId}`}
                    onAskTutor={setTutorContext}
                  />
                ) : isComplete ? (
                  <RoundSummary key={`summary-${selectedDeckId}`} />
                ) : (
                  <FlashcardViewer
                    key={`flashcards-${selectedDeckId}`}
                    onAskTutor={setTutorContext}
                  />
                )}
              </AnimatePresence>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 text-[10px] text-stone-400 dark:text-slate-500">
              <span className="font-mono uppercase tracking-[0.16em]">
                {mode === "quiz" ? (
                  <>Quiz mode · 错题随堂记录</>
                ) : (
                  <>
                    Card {String(currentPosition).padStart(2, "0")} /{" "}
                    {String(roundTotal).padStart(2, "0")}
                  </>
                )}
              </span>
              <span className="hidden items-center gap-1.5 sm:flex">
                <span className="h-1 w-1 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                localStorage 已同步
              </span>
            </div>
          </div>
        </div>

        <footer className="mt-auto flex items-center justify-between gap-4 border-t border-stone-900/[0.06] pt-4 dark:border-white/10">
          <p className="text-[10px] tracking-wide text-stone-400 dark:text-slate-500">
            Study slow. Recall deep.
            <span className="mx-2 text-stone-300 dark:text-slate-700">/</span>
            本地学习模式
          </p>
          {!isDeckEmpty && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-medium text-stone-400 transition-colors hover:bg-white/50 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/10 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300"
            >
              <RotateCcw size={12} aria-hidden="true" />
              重置当前题库
            </button>
          )}
        </footer>
      </div>

      {isImportOpen && (
        <ImportModal
          onClose={() => {
            setIsImportOpen(false);
            setIsAISettingsOpen(false);
          }}
          onImported={() => {
            setIsImportOpen(false);
            setMode("flashcards");
          }}
          onOpenAISettings={() => setIsAISettingsOpen(true)}
          suspended={isAISettingsOpen}
        />
      )}

      {isAISettingsOpen && (
        <AISettingsModal onClose={() => setIsAISettingsOpen(false)} />
      )}

      {isDataSettingsOpen && (
        <DataSettingsModal onClose={() => setIsDataSettingsOpen(false)} />
      )}

      <AnimatePresence>
        {tutorContext && (
          <AITutorDrawer
            key={`${tutorContext.source}-${tutorContext.cardId ?? tutorContext.question}`}
            context={tutorContext}
            onClose={() => setTutorContext(null)}
            onOpenAISettings={() => setIsAISettingsOpen(true)}
            suspended={isAISettingsOpen}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
