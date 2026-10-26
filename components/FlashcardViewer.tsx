"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleQuestionMark,
  Keyboard,
  Lightbulb,
  MousePointerClick,
  Sparkles,
  X,
} from "lucide-react";
import { useDeck } from "@/context/DeckContext";
import { cn } from "@/lib/utils";
import type { ReviewRating } from "@/types";
import type { TutorContext } from "@/types/tutor";

interface FlashcardViewerProps {
  onAskTutor?: (context: TutorContext) => void;
}

const RATING_ACTIONS = [
  {
    rating: "forgot",
    label: "完全忘了",
    shortcut: "1",
    icon: X,
    className:
      "border-rose-300/25 bg-rose-400/10 text-rose-100 hover:border-rose-300/60 hover:bg-rose-400/20 focus-visible:ring-rose-300/60",
    iconClassName: "text-rose-300",
  },
  {
    rating: "fuzzy",
    label: "印象模糊",
    shortcut: "2",
    icon: CircleQuestionMark,
    className:
      "border-amber-300/25 bg-amber-400/10 text-amber-100 hover:border-amber-300/60 hover:bg-amber-400/20 focus-visible:ring-amber-300/60",
    iconClassName: "text-amber-300",
  },
  {
    rating: "mastered",
    label: "牢固掌握",
    shortcut: "3",
    icon: Check,
    className:
      "border-emerald-300/25 bg-emerald-400/10 text-emerald-100 hover:border-emerald-300/60 hover:bg-emerald-400/20 focus-visible:ring-emerald-300/60",
    iconClassName: "text-emerald-300",
  },
] as const satisfies ReadonlyArray<{
  rating: ReviewRating;
  label: string;
  shortcut: string;
  icon: typeof X;
  className: string;
  iconClassName: string;
}>;

function formatCounter(value: number): string {
  return String(value).padStart(2, "0");
}

export default function FlashcardViewer({
  onAskTutor,
}: FlashcardViewerProps) {
  const {
    currentCard,
    selectedDeck,
    currentPosition,
    roundTotal,
    rateCurrentCard,
    nextCard,
    previousCard,
  } = useDeck();
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  const cardRegionRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion() ?? false;

  const isFlipped = currentCard
    ? flippedCardId === currentCard.id
    : false;

  const jumpToCard = useCallback(
    (nextDirection: 1 | -1) => {
      setDirection(nextDirection);
      if (nextDirection === 1) {
        nextCard();
      } else {
        previousCard();
      }
    },
    [nextCard, previousCard],
  );

  const flipToBack = useCallback(() => {
    if (!currentCard) return;

    setFlippedCardId(currentCard.id);
    requestAnimationFrame(() => {
      cardRegionRef.current?.focus({ preventScroll: true });
    });
  }, [currentCard]);

  const submitRating = useCallback(
    (rating: ReviewRating) => {
      if (!isFlipped) return;

      setDirection(1);
      rateCurrentCard(rating);
    },
    [isFlipped, rateCurrentCard],
  );

  useEffect(() => {
    if (!currentCard) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          "input, textarea, select, [contenteditable='true']",
        )
      ) {
        return;
      }

      if (event.code === "Space") {
        // Let a focused button or link handle its native Space activation.
        if (
          target instanceof HTMLElement &&
          target.closest("button, a")
        ) {
          return;
        }

        event.preventDefault();
        setFlippedCardId((previous) =>
          previous === currentCard.id ? null : currentCard.id,
        );
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        jumpToCard(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        jumpToCard(1);
        return;
      }

      if (
        isFlipped &&
        (event.key === "1" || event.key === "2" || event.key === "3")
      ) {
        event.preventDefault();
        const rating = RATING_ACTIONS[Number(event.key) - 1].rating;
        setDirection(1);
        rateCurrentCard(rating);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentCard,
    isFlipped,
    jumpToCard,
    rateCurrentCard,
  ]);

  if (!currentCard) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-[30px] border border-stone-900/10 bg-white/60 p-10 text-center text-sm text-stone-500">
        这套题库暂时没有卡片。
      </div>
    );
  }

  const tags = currentCard.tags ?? [];
  const slideOffset = prefersReducedMotion ? 0 : 32;

  return (
    <div className="w-full">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0, x: direction * slideOffset }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -slideOffset }}
          transition={{
            duration: prefersReducedMotion ? 0.01 : 0.24,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <div
            ref={cardRegionRef}
            tabIndex={-1}
            role="group"
            className="flashcard-stage w-full rounded-[30px] outline-none"
            aria-label={`第 ${currentPosition} 张，共 ${roundTotal} 张`}
          >
            <motion.div
              className="flashcard-rotator flashcard-frame relative w-full"
              initial={false}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.01 }
                  : {
                      type: "spring",
                      stiffness: 88,
                      damping: 17,
                      mass: 0.85,
                    }
              }
            >
              <button
                type="button"
                onClick={flipToBack}
                aria-label="翻转卡片查看答案"
                aria-hidden={isFlipped}
                inert={isFlipped}
                tabIndex={isFlipped ? -1 : 0}
                className={cn(
                  "flashcard-face group absolute inset-0 flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[30px] border border-[#dcd2bf] bg-[#fcf9f1] p-5 text-left shadow-[0_28px_75px_-34px_rgba(27,43,35,0.55)] transition-shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25 dark:border-white/10 dark:bg-[#0d1815] dark:shadow-[0_0_70px_-28px_rgba(16,185,129,0.35)] dark:focus-visible:ring-emerald-400/30 sm:p-8",
                  isFlipped && "pointer-events-none",
                )}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]"
                >
                  <span className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-100/80 blur-3xl dark:bg-emerald-500/[0.08]" />
                  <span className="absolute -bottom-28 -left-24 h-64 w-64 rounded-full bg-amber-100/60 blur-3xl dark:bg-amber-500/[0.05]" />
                  <span className="absolute inset-x-6 bottom-24 top-24 rounded-[24px] border border-dashed border-stone-900/[0.045] dark:border-white/[0.06]" />
                </span>

                <span className="relative flex w-full items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-emerald-50/90 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-emerald-900 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                    {currentCard.category}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-stone-400 dark:text-slate-500">
                    {formatCounter(currentPosition)} /{" "}
                    {formatCounter(roundTotal)}
                  </span>
                </span>

                <span className="relative flex flex-1 flex-col items-center justify-center py-7 text-center">
                  <span className="mb-4 text-[10px] font-semibold uppercase tracking-[0.32em] text-stone-400 dark:text-slate-500">
                    Question
                  </span>
                  <span className="font-display max-w-[25ch] text-balance text-[1.5rem] font-semibold leading-[1.55] tracking-[-0.015em] text-[#15231d] dark:text-slate-100 sm:text-[2rem]">
                    {currentCard.question}
                  </span>
                </span>

                <span className="relative flex w-full flex-col gap-4 border-t border-stone-900/10 pt-4 dark:border-white/10">
                  {tags.length > 0 && (
                    <span className="flex flex-wrap justify-center gap-1.5">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-stone-900/[0.045] px-2.5 py-1 font-mono text-[10px] text-stone-500 dark:bg-white/5 dark:text-slate-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </span>
                  )}

                  <span className="flex items-center justify-between gap-3 text-[11px] text-stone-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <MousePointerClick
                        size={14}
                        aria-hidden="true"
                        className="text-emerald-700 dark:text-emerald-400"
                      />
                      点击卡片或按
                      <kbd className="keycap">Space</kbd>
                      翻转
                    </span>
                    <span className="hidden items-center gap-1.5 text-stone-400 dark:text-slate-500 sm:inline-flex">
                      <Keyboard size={13} aria-hidden="true" />
                      <span className="font-mono">1 / 2 / 3</span>
                      评分
                    </span>
                  </span>
                </span>
              </button>

              <div
                aria-hidden={!isFlipped}
                inert={!isFlipped}
                className={cn(
                  "flashcard-face flashcard-back absolute inset-0 flex h-full w-full flex-col overflow-hidden rounded-[30px] border border-white/5 bg-[#173b2e] p-5 text-[#f8f2e4] shadow-[0_28px_75px_-30px_rgba(14,35,27,0.7)] dark:border-white/10 dark:bg-[#0a1713] dark:shadow-[0_0_70px_-25px_rgba(16,185,129,0.4)] sm:p-8",
                  !isFlipped && "pointer-events-none",
                )}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]"
                >
                  <span className="absolute -right-24 top-0 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />
                  <span className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-amber-200/[0.07] blur-3xl" />
                  <span className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </span>

                <div className="relative flex shrink-0 items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[#f8f2e4]">
                    <Sparkles
                      size={12}
                      aria-hidden="true"
                      className="text-amber-300"
                    />
                    参考答案
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                    {currentCard.category}
                  </span>
                </div>

                <div className="relative mt-5 min-h-0 flex-1">
                  <div className="no-scrollbar h-full overflow-y-auto pr-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-200/55">
                      Answer
                    </p>
                    <p className="font-display mt-2 text-[1.12rem] font-medium leading-[1.75] tracking-[-0.005em] text-[#fffaf0] sm:text-[1.38rem] sm:leading-[1.72]">
                      {currentCard.answer}
                    </p>

                    {currentCard.explanation && (
                      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/65">
                          <Lightbulb
                            size={13}
                            aria-hidden="true"
                            className="text-amber-300"
                          />
                          解析
                        </p>
                        <p className="mt-2 text-[13px] leading-6 text-white/70 sm:text-sm">
                          {currentCard.explanation}
                        </p>
                      </div>
                    )}

                    {tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] text-white/45"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative mt-4 shrink-0 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (!onAskTutor) return;
                      onAskTutor({
                        cardId: currentCard.id,
                        deckTitle: selectedDeck.title,
                        question: currentCard.question,
                        answer: currentCard.answer,
                        explanation: currentCard.explanation,
                        category: currentCard.category,
                        source: "flashcard",
                      });
                    }}
                    className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/20 bg-amber-200/[0.08] px-3 py-2.5 text-[11px] font-semibold text-amber-100 transition-colors hover:border-amber-200/35 hover:bg-amber-200/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/40"
                  >
                    <Sparkles size={13} aria-hidden="true" />
                    没太懂？让 AI 助教深挖
                  </button>

                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-white/65">
                      这张卡掌握得如何？
                    </p>
                    <p className="hidden font-mono text-[10px] text-white/35 sm:block">
                      SHORTCUT 1 / 2 / 3
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {RATING_ACTIONS.map((action) => {
                      const Icon = action.icon;

                      return (
                        <button
                          key={action.rating}
                          type="button"
                          onClick={(event: MouseEvent<HTMLButtonElement>) => {
                            event.stopPropagation();
                            submitRating(action.rating);
                          }}
                          aria-label={`${action.label}，快捷键 ${action.shortcut}`}
                          className={cn(
                            "group/rating relative flex min-h-[64px] touch-manipulation flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#173b2e]",
                            action.className,
                          )}
                        >
                          <Icon
                            size={17}
                            aria-hidden="true"
                            className={action.iconClassName}
                          />
                          <span className="text-[11px] font-semibold tracking-wide sm:text-xs">
                            {action.label}
                          </span>
                          <kbd className="absolute right-1.5 top-1.5 rounded border border-white/10 bg-black/10 px-1 font-mono text-[9px] leading-4 text-white/40">
                            {action.shortcut}
                          </kbd>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      <p className="sr-only" aria-live="polite">
        {isFlipped ? "答案已显示，可以评价掌握度。" : "问题已显示。"}
      </p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => jumpToCard(-1)}
          aria-label="上一张卡片"
          className="group inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-white/55 px-4 py-2.5 text-xs font-medium text-stone-600 backdrop-blur transition-colors hover:border-stone-900/20 hover:bg-white/80 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-emerald-400/30"
        >
          <ArrowLeft
            size={15}
            aria-hidden="true"
            className="transition-transform group-hover:-translate-x-0.5"
          />
          <span className="hidden sm:inline">上一张</span>
        </button>

        <div
          className="flex items-center gap-1.5"
          aria-label={`第 ${currentPosition} 张，共 ${roundTotal} 张`}
        >
          {Array.from({ length: roundTotal }, (_, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                index === currentPosition - 1
                  ? "w-6 bg-emerald-800 dark:bg-emerald-400"
                  : "w-1.5 bg-stone-900/15 dark:bg-white/15",
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => jumpToCard(1)}
          aria-label="下一张卡片"
          className="group inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-white/55 px-4 py-2.5 text-xs font-medium text-stone-600 backdrop-blur transition-colors hover:border-stone-900/20 hover:bg-white/80 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-emerald-400/30"
        >
          <span className="hidden sm:inline">下一张</span>
          <ArrowRight
            size={15}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-stone-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <kbd className="keycap">Space</kbd>
          翻转
        </span>
        <span className="inline-flex items-center gap-1.5">
          <kbd className="keycap">←</kbd>
          <kbd className="keycap">→</kbd>
          切题
        </span>
        <span className="inline-flex items-center gap-1.5">
          <kbd className="keycap">1</kbd>
          <kbd className="keycap">2</kbd>
          <kbd className="keycap">3</kbd>
          翻面后评分
        </span>
      </div>
    </div>
  );
}
