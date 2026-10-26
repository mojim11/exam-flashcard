"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useDeck } from "@/context/DeckContext";
import { cn } from "@/lib/utils";

export default function RoundSummary() {
  const {
    selectedDeck,
    roundTotal,
    deckCardCount,
    masteredCount,
    weakCount,
    masteryPercent,
    reviewWeakCards,
    resetCurrentDeck,
  } = useDeck();

  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[30px] border border-[#dcd2bf] bg-[#fcf9f1] p-6 shadow-[0_28px_75px_-36px_rgba(27,43,35,0.5)] dark:border-white/10 dark:bg-[#0b1613] dark:shadow-[0_0_75px_-30px_rgba(16,185,129,0.28)] sm:p-9"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]"
      >
        <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-emerald-100/80 blur-3xl dark:bg-emerald-500/10" />
        <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-amber-100/60 blur-3xl dark:bg-amber-500/[0.05]" />
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/10" />
      </div>

      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-900 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:text-emerald-200">
            <Sparkles size={12} aria-hidden="true" />
            Round complete
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-400 dark:text-slate-500">
            ExamFlash
          </span>
        </div>

        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[#15231d] dark:text-slate-100 sm:text-4xl">
              这一轮，收尾了。
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-stone-500 dark:text-slate-400">
              {selectedDeck.title} 的 {roundTotal} 张卡片已完成本轮复习。
              看看哪些已经稳固，哪些还值得再见一面。
            </p>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-emerald-900/10 bg-emerald-800 text-amber-100 shadow-[0_14px_30px_-16px_rgba(20,60,46,0.8)] dark:border-emerald-400/20 dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_34px_-10px_rgba(16,185,129,0.6)]">
            <Trophy size={28} aria-hidden="true" />
          </div>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "本轮完成", value: roundTotal, unit: "张" },
            { label: "牢固掌握", value: masteredCount, unit: "张" },
            { label: "待巩固", value: weakCount, unit: "张" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-stone-900/[0.07] bg-white/55 px-3 py-4 dark:border-white/10 dark:bg-white/[0.04] sm:px-4"
            >
              <p className="text-[10px] font-medium tracking-wide text-stone-400 dark:text-slate-500">
                {stat.label}
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#173b2e] dark:text-emerald-300 sm:text-3xl">
                {stat.value}
                <span className="ml-1 text-[10px] font-normal text-stone-400 dark:text-slate-500">
                  {stat.unit}
                </span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-stone-900/[0.07] bg-white/45 p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-2 font-medium text-stone-600 dark:text-slate-300">
              <Target size={14} aria-hidden="true" className="text-emerald-700 dark:text-emerald-400" />
              本题库掌握度
            </span>
            <span className="font-mono font-semibold text-emerald-900 dark:text-emerald-300">
              {masteryPercent}%
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-900/10 dark:bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${masteryPercent}%` }}
              transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-emerald-500 dark:from-emerald-400 dark:to-emerald-300"
            />
          </div>
          <p className="mt-2 text-[11px] text-stone-400 dark:text-slate-500">
            已掌握 {masteredCount} / {deckCardCount} 张卡片
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reviewWeakCards}
            disabled={weakCount === 0}
            className={cn(
              "group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#173b2e] px-5 py-3.5 text-sm font-semibold text-[#f8f2e4] shadow-[0_14px_30px_-16px_rgba(23,59,46,0.8)] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25 dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_28px_-10px_rgba(16,185,129,0.6)] dark:focus-visible:ring-emerald-400/30",
              weakCount === 0
                ? "cursor-not-allowed opacity-40"
                : "hover:-translate-y-0.5 hover:bg-[#0f2f24] dark:hover:bg-emerald-400",
            )}
          >
            <Target size={16} aria-hidden="true" />
            重温错题 / 模糊项
            <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] dark:bg-black/15">
              {weakCount}
            </span>
            <ArrowRight
              size={15}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>

          <button
            type="button"
            onClick={resetCurrentDeck}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-stone-900/10 bg-white/60 px-5 py-3.5 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-900/20 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-stone-900/10 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/[0.08]"
          >
            <RotateCcw size={16} aria-hidden="true" />
            重新开始
          </button>
        </div>

        {weakCount === 0 && (
          <p className="mt-4 text-center text-xs text-emerald-800/70 dark:text-emerald-300/70">
            本轮没有错题或模糊项，所有卡片都已牢固掌握。
          </p>
        )}
      </div>
    </motion.section>
  );
}
