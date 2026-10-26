"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleCheck,
  CircleX,
  Clock3,
  Flame,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { useDeck } from "@/context/DeckContext";
import { cn } from "@/lib/utils";
import type { Card } from "@/types";
import type { TutorContext } from "@/types/tutor";

const MAX_QUESTIONS = 10;
const ADVANCE_DELAY_MS = 1800;

interface QuizModeProps {
  onAskTutor?: (context: TutorContext) => void;
}

type QuizPhase = "ready" | "playing" | "summary";
type QuizSource = "all" | "mistakes";
type QuizQuestionType = "choice" | "boolean";

interface QuizQuestion {
  id: string;
  cardId: string;
  prompt: string;
  helper?: string;
  options: string[];
  correctIndex: number;
  correctAnswer: string;
  category: string;
  type: QuizQuestionType;
}

interface AnswerFeedback {
  kind: "correct" | "wrong";
  title: string;
  detail?: string;
}

interface QuizSummary {
  total: number;
  correctCount: number;
  accuracy: number;
  elapsedSeconds: number;
  maxCombo: number;
  beatPercent: number;
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function uniqueAnswersFrom(cards: readonly Card[], excludedCardId: string): string[] {
  const seen = new Set<string>();
  const answers: string[] = [];

  for (const card of cards) {
    if (card.id === excludedCardId) continue;
    const answer = card.answer.trim();
    if (!answer || seen.has(answer)) continue;
    seen.add(answer);
    answers.push(answer);
  }

  return answers;
}

function buildQuestion(card: Card, allCards: readonly Card[]): QuizQuestion | null {
  const correctAnswer = card.answer.trim();
  const distractors = uniqueAnswersFrom(allCards, card.id);

  if (distractors.length >= 3) {
    const options = shuffle([
      correctAnswer,
      ...shuffle(distractors).slice(0, 3),
    ]);

    return {
      id: `question-${card.id}`,
      cardId: card.id,
      prompt: card.question,
      options,
      correctIndex: options.indexOf(correctAnswer),
      correctAnswer,
      category: card.category,
      type: "choice",
    };
  }

  if (distractors.length === 0) return null;

  const isTrueStatement = Math.random() >= 0.5;
  const shownAnswer = isTrueStatement
    ? correctAnswer
    : distractors[Math.floor(Math.random() * distractors.length)];
  const options = ["正确", "错误"];

  return {
    id: `question-${card.id}`,
    cardId: card.id,
    prompt: card.question,
    helper: `判断以下答案是否正确：\n“${shownAnswer}”`,
    options,
    correctIndex: isTrueStatement ? 0 : 1,
    correctAnswer,
    category: card.category,
    type: "boolean",
  };
}

function buildQuizQuestions(
  allCards: readonly Card[],
  sourceCardIds: readonly string[],
): QuizQuestion[] {
  const cardsById = new Map(allCards.map((card) => [card.id, card]));
  const sourceCards = [
    ...new Set(sourceCardIds),
  ].flatMap((id) => {
    const card = cardsById.get(id);
    return card ? [card] : [];
  });

  return shuffle(sourceCards)
    .slice(0, MAX_QUESTIONS)
    .flatMap((card) => {
      const question = buildQuestion(card, allCards);
      return question ? [question] : [];
    });
}

function formatTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function estimateBeatPercent(
  accuracy: number,
  maxCombo: number,
  total: number,
): number {
  const comboRatio = total === 0 ? 0 : maxCombo / total;
  const speedBonus = accuracy >= 80 ? 4 : 0;
  return Math.min(
    99,
    Math.max(0, Math.round(accuracy * 0.8 + comboRatio * 15 + speedBonus)),
  );
}

function optionMarker(question: QuizQuestion, index: number): string {
  if (question.type === "boolean") {
    return index === 0 ? "T" : "F";
  }
  return String.fromCharCode(65 + index);
}

function fireConfetti(combo: number): void {
  void import("canvas-confetti")
    .then(({ default: confetti }) => {
      confetti({
        particleCount: Math.min(150, 55 + combo * 14),
        spread: 68 + Math.min(32, combo * 4),
        startVelocity: 30,
        gravity: 0.9,
        scalar: 0.9,
        ticks: 180,
        origin: { x: 0.5, y: 0.68 },
        colors: ["#1f6f54", "#2e8b66", "#e2b85b", "#f4e5be", "#f8f2e4"],
        disableForReducedMotion: true,
      });
    })
    .catch(() => undefined);
}

export default function QuizMode({ onAskTutor }: QuizModeProps) {
  const {
    selectedDeck,
    deckCardCount,
    mistakeCount,
    recordMistake,
    clearMistake,
  } = useDeck();
  const [phase, setPhase] = useState<QuizPhase>("ready");
  const [source, setSource] = useState<QuizSource>("all");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [summary, setSummary] = useState<QuizSummary | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const elapsedRef = useRef(0);
  const prefersReducedMotion = useReducedMotion() ?? false;

  const currentQuestion = questions[questionIndex] ?? null;
  const currentSourceCard = currentQuestion
    ? selectedDeck.cards.find((card) => card.id === currentQuestion.cardId)
    : null;
  const answered = selectedOption !== null;
  const mistakeCardIds = selectedDeck.mistakeCardIds ?? [];
  const roundSize = Math.min(MAX_QUESTIONS, deckCardCount);
  const canPlay = deckCardCount >= 2;

  const finishQuiz = useCallback(() => {
    const elapsed = Math.max(1, elapsedRef.current);
    const accuracy =
      questions.length === 0
        ? 0
        : Math.round((correctCount / questions.length) * 100);

    setSummary({
      total: questions.length,
      correctCount,
      accuracy,
      elapsedSeconds: elapsed,
      maxCombo,
      beatPercent: estimateBeatPercent(accuracy, maxCombo, questions.length),
    });
    setPhase("summary");
  }, [correctCount, maxCombo, questions.length]);

  const advanceQuestion = useCallback(() => {
    if (questionIndex >= questions.length - 1) {
      finishQuiz();
      return;
    }

    setQuestionIndex((previous) => previous + 1);
    setSelectedOption(null);
    setFeedback(null);
  }, [finishQuiz, questionIndex, questions.length]);

  useEffect(() => {
    if (phase !== "playing" || startedAt === null) return;

    const timer = window.setInterval(() => {
      const nextElapsed = Math.floor((Date.now() - startedAt) / 1000);
      elapsedRef.current = nextElapsed;
      setElapsedSeconds(nextElapsed);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, startedAt]);

  useEffect(() => {
    if (
      phase !== "playing" ||
      selectedOption === null ||
      feedback?.kind !== "correct"
    ) {
      return;
    }

    const timer = window.setTimeout(advanceQuestion, ADVANCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [phase, selectedOption, feedback?.kind, advanceQuestion]);

  const startQuiz = (nextSource: QuizSource) => {
    if (!canPlay) {
      setSetupError("至少需要 2 张卡片，才能生成判断题或四选一题目。");
      return;
    }

    const sourceIds =
      nextSource === "mistakes"
        ? mistakeCardIds
        : selectedDeck.cards.map((card) => card.id);
    const generatedQuestions = buildQuizQuestions(
      selectedDeck.cards,
      sourceIds,
    );

    if (generatedQuestions.length === 0) {
      setSetupError(
        nextSource === "mistakes"
          ? "错题集合还是空的，先完成一轮普通闯关吧。"
          : "卡片答案过于相似，暂时无法生成足够的选项。",
      );
      return;
    }

    setSetupError(null);
    setSource(nextSource);
    setQuestions(generatedQuestions);
    setQuestionIndex(0);
    setSelectedOption(null);
    setCombo(0);
    setMaxCombo(0);
    setCorrectCount(0);
    setFeedback(null);
    setSummary(null);
    setStartedAt(Date.now());
    setElapsedSeconds(0);
    elapsedRef.current = 0;
    setPhase("playing");
  };

  const handleAnswer = (optionIndex: number) => {
    if (!currentQuestion || selectedOption !== null) return;

    const isCorrect = optionIndex === currentQuestion.correctIndex;
    setSelectedOption(optionIndex);

    if (isCorrect) {
      const nextCombo = combo + 1;
      const wasMistake = mistakeCardIds.includes(currentQuestion.cardId);
      setCombo(nextCombo);
      setMaxCombo((previous) => Math.max(previous, nextCombo));
      setCorrectCount((previous) => previous + 1);
      clearMistake(currentQuestion.cardId);
      setFeedback({
        kind: "correct",
        title:
          nextCombo >= 4
            ? `连击 ×${nextCombo}，火力全开！`
            : ["漂亮，拿下一题。", "稳准狠，继续保持。", "状态在线！"][
                (nextCombo - 1) % 3
              ],
        detail: wasMistake
          ? "已从错题集合中移除这张卡片。"
          : "这题稳稳拿下，继续保持。",
      });
      fireConfetti(nextCombo);
    } else {
      setCombo(0);
      recordMistake(currentQuestion.cardId);
      setFeedback({
        kind: "wrong",
        title: "没关系，这张已经加入错题集合。",
        detail: `正确答案：${currentQuestion.correctAnswer}`,
      });
    }
  };

  if (!canPlay) {
    return (
      <section className="relative overflow-hidden rounded-[30px] border border-[#dcd2bf] bg-[#fcf9f1] p-6 text-center shadow-[0_28px_75px_-36px_rgba(27,43,35,0.5)] dark:border-white/10 dark:bg-[#0b1613] dark:shadow-[0_0_70px_-30px_rgba(16,185,129,0.3)] sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#173b2e] text-amber-100 dark:bg-emerald-500 dark:text-[#062018]">
          <Target size={24} aria-hidden="true" />
        </div>
        <h2 className="font-display mt-5 text-2xl font-semibold text-[#15231d] dark:text-slate-100">
          还差一点，才能开始闯关。
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500 dark:text-slate-400">
          自测模式至少需要 2 张卡片来生成选项。当前题库只有 {deckCardCount} 张，
          建议先导入或添加更多考点。
        </p>
      </section>
    );
  }

  if (phase === "summary" && summary) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative overflow-hidden rounded-[30px] border border-[#dcd2bf] bg-[#fcf9f1] p-6 shadow-[0_28px_75px_-36px_rgba(27,43,35,0.5)] dark:border-white/10 dark:bg-[#0b1613] dark:shadow-[0_0_75px_-30px_rgba(16,185,129,0.28)] sm:p-9"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]"
        >
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-emerald-100/80 blur-3xl dark:bg-emerald-500/10" />
          <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-amber-100/60 blur-3xl dark:bg-amber-500/[0.05]" />
        </div>

        <div className="relative">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-900 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:text-emerald-200">
              <Sparkles size={12} aria-hidden="true" />
              Quiz complete
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-400 dark:text-slate-500">
              ExamFlash Arena
            </span>
          </div>

          <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-[#15231d] dark:text-slate-100 sm:text-4xl">
                闯关完成。
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-stone-500 dark:text-slate-400">
                {summary.correctCount} / {summary.total} 题答对。
                {summary.accuracy >= 80
                  ? "状态很不错，把这份手感带进下一轮。"
                  : "错题已经收好，下一次专攻它们。"}
              </p>
            </div>
            <div className="flex items-end gap-2">
              <p className="font-mono text-6xl font-semibold leading-none tracking-[-0.05em] text-[#173b2e] dark:text-emerald-300 sm:text-7xl">
                {summary.accuracy}
              </p>
              <span className="mb-1.5 text-xl font-medium text-emerald-700 dark:text-emerald-400">
                %
              </span>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-stone-900/[0.07] bg-white/55 px-3 py-4 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-[10px] text-stone-400 dark:text-slate-500">答对题数</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-[#173b2e] dark:text-emerald-300">
                {summary.correctCount}
                <span className="text-xs font-normal text-stone-400 dark:text-slate-500">
                  {" "}
                  / {summary.total}
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-stone-900/[0.07] bg-white/55 px-3 py-4 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-[10px] text-stone-400 dark:text-slate-500">本轮用时</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-[#173b2e] dark:text-emerald-300">
                {formatTime(summary.elapsedSeconds)}
              </p>
            </div>
            <div className="rounded-2xl border border-stone-900/[0.07] bg-white/55 px-3 py-4 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-[10px] text-stone-400 dark:text-slate-500">最高连击</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-[#173b2e] dark:text-emerald-300">
                {summary.maxCombo}
                <span className="ml-1 text-[10px] font-normal text-stone-400 dark:text-slate-500">
                  COMBO
                </span>
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-900/10 bg-emerald-900/[0.045] p-4 dark:border-emerald-400/15 dark:bg-emerald-400/[0.06]">
            <div className="flex items-center justify-between gap-4">
              <p className="flex items-center gap-2 text-xs font-medium text-emerald-950 dark:text-emerald-200">
                <Flame size={15} aria-hidden="true" className="text-amber-600 dark:text-amber-300" />
                击败了 {summary.beatPercent}% 的挑战者
              </p>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-900/40 dark:text-emerald-200/40">
                Estimated
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-950/10 dark:bg-black/20">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${summary.beatPercent}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-800 via-emerald-600 to-amber-400 dark:from-emerald-400 dark:via-emerald-300 dark:to-amber-300"
              />
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => startQuiz("mistakes")}
              disabled={mistakeCount === 0}
              className={cn(
                "group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-semibold shadow-[0_14px_30px_-16px_rgba(23,59,46,0.8)] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25",
                mistakeCount > 0
                  ? "bg-[#173b2e] text-[#f8f2e4] hover:-translate-y-0.5 hover:bg-[#0f2f24] dark:bg-emerald-500 dark:text-[#062018] dark:hover:bg-emerald-400"
                  : "cursor-not-allowed bg-stone-900/10 text-stone-400 shadow-none dark:bg-white/10 dark:text-slate-500",
              )}
            >
              <Target size={17} aria-hidden="true" />
              针对错题发起专项攻坚
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] dark:bg-black/15">
                {mistakeCount}
              </span>
              <ArrowRight
                size={15}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>
            <button
              type="button"
              onClick={() => startQuiz("all")}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-stone-900/10 bg-white/60 px-5 py-4 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-900/20 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-stone-900/10 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/[0.08]"
            >
              <RotateCcw size={16} aria-hidden="true" />
              再测一轮
            </button>
          </div>

          {mistakeCount === 0 && (
            <p className="mt-3 text-center text-[11px] text-emerald-800/60 dark:text-emerald-300/70">
              本轮没有留下错题，状态满分。
            </p>
          )}
        </div>
      </motion.section>
    );
  }

  if (phase === "playing" && currentQuestion) {
    const progress =
      questions.length === 0
        ? 0
        : Math.round(
            ((questionIndex + (answered ? 1 : 0)) / questions.length) * 100,
          );
    const isWrongFeedback = feedback?.kind === "wrong";

    return (
      <div className="w-full">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-stone-900/[0.07] bg-white/50 px-3 py-1.5 text-[10px] font-medium text-stone-500 backdrop-blur dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-400">
            <Target size={12} aria-hidden="true" className="text-emerald-700 dark:text-emerald-400" />
            {source === "mistakes" ? "错题专项攻坚" : "闯关自测"}
            <span className="text-stone-300 dark:text-slate-600">/</span>
            <span className="font-mono">
              {String(questionIndex + 1).padStart(2, "0")} /{" "}
              {String(questions.length).padStart(2, "0")}
            </span>
          </span>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-900/[0.07] bg-white/50 px-3 py-1.5 font-mono text-[10px] tabular-nums text-stone-500 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-400">
              <Clock3 size={12} aria-hidden="true" />
              {formatTime(elapsedSeconds)}
            </span>
            <motion.span
              key={combo}
              initial={prefersReducedMotion ? false : { scale: 0.88 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 360, damping: 20 }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] font-semibold tabular-nums transition-colors",
                combo > 0
                  ? "border-amber-300/40 bg-amber-100/70 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200"
                  : "border-stone-900/[0.07] bg-white/45 text-stone-400 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-500",
              )}
            >
              <Flame
                size={12}
                aria-hidden="true"
                className={combo > 0 ? "text-amber-600 dark:text-amber-300" : "text-stone-400 dark:text-slate-500"}
              />
              COMBO {combo}
            </motion.span>
          </div>
        </div>

        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-stone-900/[0.08] dark:bg-white/10">
          <motion.div
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full bg-gradient-to-r from-emerald-800 to-emerald-500 dark:from-emerald-400 dark:to-emerald-300"
          />
        </div>

        <motion.section
          animate={
            isWrongFeedback
              ? { x: [0, -8, 8, -6, 6, 0], scale: 1 }
              : feedback?.kind === "correct"
                ? { x: 0, scale: [1, 1.008, 1] }
                : { x: 0, scale: 1 }
          }
          transition={{
            duration: prefersReducedMotion ? 0.01 : isWrongFeedback ? 0.4 : 0.3,
            ease: "easeInOut",
          }}
          className="relative overflow-hidden rounded-[30px] border border-[#dcd2bf] bg-[#fcf9f1] p-5 shadow-[0_28px_75px_-36px_rgba(27,43,35,0.5)] dark:border-white/10 dark:bg-[#0b1613] dark:shadow-[0_0_70px_-30px_rgba(16,185,129,0.3)] sm:p-8"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full bg-emerald-100/70 blur-3xl dark:bg-emerald-500/[0.08]"
          />

          <div className="relative flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-emerald-50/90 px-3 py-1.5 text-[10px] font-semibold text-emerald-900 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              {currentQuestion.category}
            </span>
            <span className="rounded-full border border-stone-900/[0.07] bg-white/55 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-stone-400 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-500">
              {currentQuestion.type === "choice" ? "单项选择" : "判断正误"}
            </span>
          </div>

          <h2 className="font-display relative mt-6 max-w-2xl text-[1.55rem] font-semibold leading-[1.45] tracking-[-0.015em] text-[#15231d] dark:text-slate-100 sm:text-[2rem]">
            {currentQuestion.prompt}
          </h2>

          {currentQuestion.helper && (
            <div className="relative mt-4 rounded-2xl border border-emerald-900/10 bg-emerald-900/[0.045] px-4 py-3 dark:border-emerald-400/15 dark:bg-emerald-400/[0.06]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-900/45 dark:text-emerald-300/55">
                Statement
              </p>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-7 text-emerald-950/80 dark:text-emerald-100/75">
                {currentQuestion.helper}
              </p>
            </div>
          )}

          <div
            className={cn(
              "relative mt-6 grid gap-2.5",
              currentQuestion.type === "boolean" && "sm:grid-cols-2",
            )}
          >
            {currentQuestion.options.map((option, optionIndex) => {
              const isCorrect = optionIndex === currentQuestion.correctIndex;
              const isSelected = optionIndex === selectedOption;
              const showCorrect = answered && isCorrect;
              const showWrong = answered && isSelected && !isCorrect;

              return (
                <button
                  key={`${currentQuestion.id}-${optionIndex}`}
                  type="button"
                  onClick={() => handleAnswer(optionIndex)}
                  disabled={answered}
                  aria-label={`${optionMarker(currentQuestion, optionIndex)}. ${option}`}
                  className={cn(
                    "group flex w-full touch-manipulation items-start gap-3 rounded-2xl border px-3.5 py-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-4 sm:px-4",
                    !answered &&
                      "border-stone-900/10 bg-white/55 hover:-translate-y-0.5 hover:border-emerald-700/25 hover:bg-white hover:shadow-[0_10px_24px_-20px_rgba(23,59,46,0.5)] focus-visible:ring-emerald-700/15 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-emerald-400/25 dark:hover:bg-white/[0.075] dark:focus-visible:ring-emerald-400/20",
                    showCorrect &&
                      "border-emerald-600/35 bg-emerald-50 ring-1 ring-emerald-600/15 dark:border-emerald-400/30 dark:bg-emerald-400/[0.09] dark:ring-emerald-400/20",
                    showWrong &&
                      "border-rose-500/35 bg-rose-50 ring-1 ring-rose-500/15 dark:border-rose-400/30 dark:bg-rose-400/[0.09] dark:ring-rose-400/20",
                    answered &&
                      !showCorrect &&
                      !showWrong &&
                      "border-stone-900/[0.04] bg-white/25 opacity-55 dark:border-white/[0.05] dark:bg-white/[0.02]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border font-mono text-[10px] font-semibold",
                      !answered
                        ? "border-stone-900/10 bg-stone-900/[0.035] text-stone-400 group-hover:border-emerald-700/20 group-hover:text-emerald-800 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400 dark:group-hover:border-emerald-400/25 dark:group-hover:text-emerald-300"
                        : showCorrect
                          ? "border-emerald-600/20 bg-emerald-600 text-white dark:border-emerald-400/20 dark:bg-emerald-500 dark:text-[#062018]"
                          : showWrong
                            ? "border-rose-500/20 bg-rose-500 text-white dark:bg-rose-500"
                            : "border-stone-900/5 text-stone-300 dark:border-white/5 dark:text-slate-600",
                    )}
                  >
                    {optionMarker(currentQuestion, optionIndex)}
                  </span>
                  <span className="flex-1 text-[13px] leading-6 text-stone-700 dark:text-slate-300 sm:text-sm">
                    {option}
                  </span>
                  {showCorrect && (
                    <CircleCheck
                      size={17}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300"
                    />
                  )}
                  {showWrong && (
                    <CircleX
                      size={17}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-rose-500 dark:text-rose-300"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {feedback && (
              <motion.div
                key={feedback.kind}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                aria-live="polite"
                className={cn(
                  "relative mt-5 overflow-hidden rounded-2xl border p-4",
                  feedback.kind === "correct"
                    ? "border-emerald-600/15 bg-emerald-50/80 dark:border-emerald-400/20 dark:bg-emerald-400/[0.08]"
                    : "border-rose-500/15 bg-rose-50/80 dark:border-rose-400/20 dark:bg-rose-400/[0.08]",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white",
                      feedback.kind === "correct"
                        ? "bg-emerald-600 dark:bg-emerald-500 dark:text-[#062018]"
                        : "bg-rose-500",
                    )}
                  >
                    {feedback.kind === "correct" ? (
                      <Check size={16} aria-hidden="true" />
                    ) : (
                      <X size={16} aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        feedback.kind === "correct"
                          ? "text-emerald-900 dark:text-emerald-200"
                          : "text-rose-900 dark:text-rose-200",
                      )}
                    >
                      {feedback.title}
                    </p>
                    {feedback.detail && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-stone-500 dark:text-slate-400">
                        {feedback.detail}
                      </p>
                    )}
                  </div>
                  {feedback.kind === "correct" && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-700 px-2 py-1 font-mono text-[9px] font-semibold text-white dark:bg-emerald-500 dark:text-[#062018]">
                      <Flame size={10} aria-hidden="true" />
                      +1
                    </span>
                  )}
                </div>

                {feedback.kind === "wrong" && (
                  <div className="mt-3 border-t border-rose-500/10 pt-3 dark:border-rose-300/10">
                    <p className="text-[9px] text-rose-900/45 dark:text-rose-100/50">
                      已暂停自动跳题。可以先用 AI 助教弄懂，再继续。
                    </p>
                    <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          if (!onAskTutor || selectedOption === null) return;
                          onAskTutor({
                            cardId: currentQuestion.cardId,
                            deckTitle: selectedDeck.title,
                            question: currentQuestion.prompt,
                            answer: currentQuestion.correctAnswer,
                            explanation: currentSourceCard?.explanation,
                            category: currentQuestion.category,
                            wrongAnswer:
                              currentQuestion.options[selectedOption],
                            additionalContext: currentQuestion.helper,
                            source: "quiz",
                          });
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-300/40 bg-amber-100/70 px-3 py-2.5 text-[11px] font-semibold text-amber-950 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/30 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200 dark:hover:bg-amber-300/15"
                      >
                        <Sparkles size={13} aria-hidden="true" />
                        没太懂？让 AI 助教深挖
                      </button>
                      <button
                        type="button"
                        onClick={advanceQuestion}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#173b2e] px-4 py-2.5 text-[11px] font-semibold text-[#f8f2e4] transition-colors hover:bg-[#0f2f24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/25 dark:bg-emerald-500 dark:text-[#062018] dark:hover:bg-emerald-400"
                      >
                        {questionIndex >= questions.length - 1
                          ? "查看结果"
                          : "下一题"}
                        <ArrowRight size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}

                {feedback.kind === "correct" && (
                  <motion.div
                    initial={{ width: "100%" }}
                    animate={{ width: 0 }}
                    transition={{
                      duration: prefersReducedMotion
                        ? 0.01
                        : ADVANCE_DELAY_MS / 1000,
                      ease: "linear",
                    }}
                    className="absolute bottom-0 left-0 h-0.5 bg-emerald-600/50 dark:bg-emerald-400/50"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
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
            <Target size={12} aria-hidden="true" />
            Quiz arena
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-400 dark:text-slate-500">
            {roundSize} questions
          </span>
        </div>

        <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[#15231d] dark:text-slate-100 sm:text-4xl">
              把记忆送上考场。
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-stone-500 dark:text-slate-400">
              从「{selectedDeck.title}」中随机抽题，用答案生成四选一或判断正误。
              答对触发彩带与连击，答错自动收入错题集合。
            </p>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-emerald-900/10 bg-[#173b2e] text-amber-100 shadow-[0_14px_30px_-16px_rgba(20,60,46,0.8)] dark:border-emerald-400/20 dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_34px_-10px_rgba(16,185,129,0.6)]">
            <Trophy size={28} aria-hidden="true" />
          </div>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl border border-stone-900/[0.07] bg-white/55 px-3 py-4 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-[10px] text-stone-400 dark:text-slate-500">本轮题量</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-[#173b2e] dark:text-emerald-300">
              {roundSize}
              <span className="ml-1 text-[10px] font-normal text-stone-400 dark:text-slate-500">
                题
              </span>
            </p>
          </div>
          <div className="rounded-2xl border border-stone-900/[0.07] bg-white/55 px-3 py-4 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-[10px] text-stone-400 dark:text-slate-500">题库卡片</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-[#173b2e] dark:text-emerald-300">
              {deckCardCount}
              <span className="ml-1 text-[10px] font-normal text-stone-400 dark:text-slate-500">
                张
              </span>
            </p>
          </div>
          <div className="rounded-2xl border border-stone-900/[0.07] bg-white/55 px-3 py-4 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-[10px] text-stone-400 dark:text-slate-500">错题集合</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-[#173b2e] dark:text-emerald-300">
              {mistakeCount}
              <span className="ml-1 text-[10px] font-normal text-stone-400 dark:text-slate-500">
                张
              </span>
            </p>
          </div>
        </div>

        {setupError && (
          <p className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/[0.06] dark:text-amber-100/80">
            {setupError}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => startQuiz("all")}
            className="group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#173b2e] px-5 py-4 text-sm font-semibold text-[#f8f2e4] shadow-[0_14px_30px_-16px_rgba(23,59,46,0.8)] transition-all hover:-translate-y-0.5 hover:bg-[#0f2f24] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25 dark:bg-emerald-500 dark:text-[#062018] dark:shadow-[0_0_28px_-10px_rgba(16,185,129,0.6)] dark:hover:bg-emerald-400 dark:focus-visible:ring-emerald-400/30"
          >
            <Play size={16} aria-hidden="true" />
            开始 {roundSize} 题挑战
            <ArrowRight
              size={15}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
          <button
            type="button"
            onClick={() => startQuiz("mistakes")}
            disabled={mistakeCount === 0}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-5 py-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4",
              mistakeCount > 0
                ? "border-emerald-900/15 bg-white/55 text-emerald-900 hover:border-emerald-900/25 hover:bg-white focus-visible:ring-emerald-700/15 dark:border-emerald-400/20 dark:bg-white/[0.045] dark:text-emerald-200 dark:hover:border-emerald-400/30 dark:hover:bg-white/[0.08]"
                : "cursor-not-allowed border-stone-900/[0.06] bg-white/30 text-stone-400 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-600",
            )}
          >
            <Target size={16} aria-hidden="true" />
            错题专项
            <span className="rounded-full bg-emerald-900/5 px-2 py-0.5 font-mono text-[10px] dark:bg-white/[0.06]">
              {mistakeCount}
            </span>
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-stone-400 dark:text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen size={12} aria-hidden="true" />
            题干来自卡片问题
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={12} aria-hidden="true" />
            答对触发彩带与连击
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CircleX size={12} aria-hidden="true" />
            答错自动加入错题集合
          </span>
        </div>
      </div>
    </motion.section>
  );
}
