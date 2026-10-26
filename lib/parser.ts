/** A card recognized from pasted text or an uploaded file. */
export type ParseFormat = "qa" | "markdown" | "shorthand";

export interface ParsedCard {
  question: string;
  answer: string;
  category: string;
  format: ParseFormat;
}

export interface ParseIssue {
  line: number;
  message: string;
}

export interface ParseResult {
  cards: ParsedCard[];
  issues: ParseIssue[];
}

const DEFAULT_CATEGORY = "导入考点";
const SEPARATOR_PATTERN = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const HEADING_PATTERN = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;
const BULLET_PATTERN = /^\s*(?:[-*+]|\d+[.)])\s+(.+)$/;

type QaLine = {
  kind: "question" | "answer";
  text: string;
};

type QaBlock = {
  question: string;
  answer: string | null;
  startLine: number;
};

function normalizeInput(input: string): string {
  return input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ");
}

function cleanText(value: string): string {
  return value
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanInlineMarkdown(value: string): string {
  return cleanText(
    value
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^[\s*_]+|[\s*_]+$/g, ""),
  );
}

function firstColonIndex(line: string): number {
  const ascii = line.indexOf(":");
  const fullWidth = line.indexOf("：");

  if (ascii === -1) return fullWidth;
  if (fullWidth === -1) return ascii;
  return Math.min(ascii, fullWidth);
}

/** Detects `Q:`, `**Q:**`, `问题1：`, `A:` and Chinese variants. */
function parseQaLine(line: string): QaLine | null {
  const colonIndex = firstColonIndex(line);
  if (colonIndex <= 0) return null;

  const rawPrefix = line
    .slice(0, colonIndex)
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "");
  const prefix = rawPrefix.replace(/[*_\s]/g, "");

  const match = prefix.match(/^(Q|问题|问|A|答案|答)(\d+)?$/i);
  if (!match) return null;

  const label = match[1].toLowerCase();
  const isQuestion = label === "q" || label === "问题" || label === "问";

  let content = line.slice(colonIndex + 1).trim();
  // Handles the `**Q:** answer` style where bold closes after the colon.
  content = content.replace(/^\*{2}\s*/, "");

  return {
    kind: isQuestion ? "question" : "answer",
    text: cleanText(content),
  };
}

/** Format B: `- **考点**：解释`. */
function parseMarkdownCard(
  line: string,
): { question: string; answer: string } | null {
  const bullet = line.match(BULLET_PATTERN);
  if (!bullet) return null;

  const content = bullet[1].trim();
  const card = content.match(/^\*\*(.+?)\*\*\s*[:：]\s*(.+)$/);
  if (!card) return null;

  const question = cleanInlineMarkdown(card[1]);
  const answer = cleanInlineMarkdown(card[2]);
  if (!question || !answer) return null;

  return { question, answer };
}

/** Format C: `概念 ?? 解释`. Full-width `？？` is accepted too. */
function parseShorthandCard(
  line: string,
): { question: string; answer: string } | null {
  const content = line.replace(BULLET_PATTERN, "$1").trim();
  const asciiIndex = content.indexOf("??");
  const fullWidthIndex = content.indexOf("？？");

  let index = -1;
  if (asciiIndex !== -1 && fullWidthIndex !== -1) {
    index = Math.min(asciiIndex, fullWidthIndex);
  } else if (asciiIndex !== -1) {
    index = asciiIndex;
  } else if (fullWidthIndex !== -1) {
    index = fullWidthIndex;
  }

  if (index <= 0) return null;

  const question = cleanInlineMarkdown(content.slice(0, index));
  const answer = cleanInlineMarkdown(content.slice(index + 2));
  if (!question || !answer) return null;

  return { question, answer };
}

function appendLine(current: string, line: string): string {
  if (!line.trim()) {
    return current.endsWith("\n") ? current : `${current}\n`;
  }

  return current ? `${current}\n${line.trim()}` : line.trim();
}

/**
 * Tolerant, line-oriented parser.
 *
 * - Headings (`# 分类`) set the category for following cards.
 * - Q/A blocks may span multiple lines and end at a new Q, heading, separator,
 *   or a new Markdown/shorthand card after a blank line.
 * - Format B and C cards can be mixed with Q/A blocks.
 * - Duplicate question/answer pairs are skipped and reported.
 */
export function parseCards(input: string): ParseResult {
  const lines = normalizeInput(input).split("\n");
  const cards: ParsedCard[] = [];
  const issues: ParseIssue[] = [];
  const seen = new Set<string>();

  let category = DEFAULT_CATEGORY;
  let activeBlock: QaBlock | null = null;
  let previousLineBlank = false;

  const addCard = (
    question: string,
    answer: string,
    format: ParseFormat,
    line: number,
  ) => {
    const cleanQuestion = cleanInlineMarkdown(question);
    const cleanAnswer = cleanInlineMarkdown(answer);
    if (!cleanQuestion || !cleanAnswer) return false;

    const key = `${cleanQuestion.toLowerCase()}\u0000${cleanAnswer.toLowerCase()}`;
    if (seen.has(key)) {
      issues.push({
        line,
        message: "检测到重复卡片，已自动跳过。",
      });
      return false;
    }

    seen.add(key);
    cards.push({
      question: cleanQuestion,
      answer: cleanAnswer,
      category,
      format,
    });
    return true;
  };

  const flushBlock = () => {
    if (!activeBlock) return;

    const question = cleanInlineMarkdown(activeBlock.question);
    const answer = activeBlock.answer
      ? cleanInlineMarkdown(activeBlock.answer)
      : "";

    if (!answer) {
      issues.push({
        line: activeBlock.startLine,
        message: "这个 Q 缺少对应的 A，已跳过。",
      });
    } else {
      addCard(question, answer, "qa", activeBlock.startLine);
    }

    activeBlock = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const lineNumber = index + 1;
    const line = rawLine.trim();

    if (!line) {
      if (activeBlock) {
        if (activeBlock.answer !== null) {
          activeBlock.answer = appendLine(activeBlock.answer, "");
        } else {
          activeBlock.question = appendLine(activeBlock.question, "");
        }
      }
      previousLineBlank = true;
      continue;
    }

    if (SEPARATOR_PATTERN.test(line)) {
      flushBlock();
      previousLineBlank = false;
      continue;
    }

    const heading = line.match(HEADING_PATTERN);
    if (heading) {
      flushBlock();
      category = cleanInlineMarkdown(heading[1]) || DEFAULT_CATEGORY;
      previousLineBlank = false;
      continue;
    }

    const qaLine = parseQaLine(line);

    if (qaLine?.kind === "question") {
      flushBlock();
      activeBlock = {
        question: qaLine.text,
        answer: null,
        startLine: lineNumber,
      };
      previousLineBlank = false;
      continue;
    }

    if (qaLine?.kind === "answer") {
      if (!activeBlock) {
        issues.push({
          line: lineNumber,
          message: "发现孤立的 A 行，前面没有对应的 Q。",
        });
      } else if (activeBlock.answer === null) {
        activeBlock.answer = qaLine.text;
      } else {
        activeBlock.answer = appendLine(activeBlock.answer, qaLine.text);
      }
      previousLineBlank = false;
      continue;
    }

    const markdownCard = parseMarkdownCard(line);
    if (markdownCard) {
      if (activeBlock && !previousLineBlank) {
        // A bold bullet inside an answer is most likely answer content.
        if (activeBlock.answer !== null) {
          activeBlock.answer = appendLine(
            activeBlock.answer,
            rawLine,
          );
        } else {
          activeBlock.question = appendLine(
            activeBlock.question,
            rawLine,
          );
        }
        previousLineBlank = false;
        continue;
      }

      flushBlock();
      addCard(
        markdownCard.question,
        markdownCard.answer,
        "markdown",
        lineNumber,
      );
      previousLineBlank = false;
      continue;
    }

    const shorthandCard = parseShorthandCard(line);
    if (shorthandCard) {
      if (activeBlock && !previousLineBlank) {
        if (activeBlock.answer !== null) {
          activeBlock.answer = appendLine(
            activeBlock.answer,
            rawLine,
          );
        } else {
          activeBlock.question = appendLine(
            activeBlock.question,
            rawLine,
          );
        }
        previousLineBlank = false;
        continue;
      }

      flushBlock();
      addCard(
        shorthandCard.question,
        shorthandCard.answer,
        "shorthand",
        lineNumber,
      );
      previousLineBlank = false;
      continue;
    }

    if (activeBlock) {
      if (activeBlock.answer !== null) {
        activeBlock.answer = appendLine(activeBlock.answer, rawLine);
      } else {
        activeBlock.question = appendLine(activeBlock.question, rawLine);
      }
    }

    previousLineBlank = false;
  }

  flushBlock();

  return { cards, issues };
}
