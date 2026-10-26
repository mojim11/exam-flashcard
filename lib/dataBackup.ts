import { normalizeDeckCollection } from "@/lib/deckStorage";
import type { Deck } from "@/types";

export const BACKUP_APP = "ExamFlash";
export const BACKUP_VERSION = 1;

export interface ExamFlashBackup {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  selectedDeckId: string;
  decks: Deck[];
}

export interface ParsedBackup {
  decks: Deck[];
  selectedDeckId: string;
  exportedAt: string | null;
  cardCount: number;
  mistakeCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createExamFlashBackup(
  decks: Deck[],
  selectedDeckId: string,
): ExamFlashBackup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    selectedDeckId,
    decks,
  };
}

export function parseExamFlashBackup(raw: string): ParsedBackup {
  let payload: unknown;

  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("文件不是有效的 JSON，请确认选择了正确的备份文件。");
  }

  if (!isRecord(payload)) {
    throw new Error("备份文件结构不正确。");
  }

  if (payload.app !== BACKUP_APP) {
    throw new Error("这不是 ExamFlash 的备份文件。");
  }

  if (payload.version !== BACKUP_VERSION) {
    throw new Error(
      `备份版本 ${String(payload.version)} 暂不支持，请使用当前版本导出的文件。`,
    );
  }

  const decks = normalizeDeckCollection(payload.decks);
  if (!decks) {
    throw new Error("备份中没有可恢复的题库，或题库数据已损坏。");
  }

  const selectedDeckId =
    typeof payload.selectedDeckId === "string" &&
    decks.some((deck) => deck.id === payload.selectedDeckId)
      ? payload.selectedDeckId
      : decks[0].id;

  const cardCount = decks.reduce((total, deck) => total + deck.cards.length, 0);
  const mistakeCount = decks.reduce(
    (total, deck) => total + (deck.mistakeCardIds?.length ?? 0),
    0,
  );

  return {
    decks,
    selectedDeckId,
    exportedAt:
      typeof payload.exportedAt === "string" ? payload.exportedAt : null,
    cardCount,
    mistakeCount,
  };
}

export function backupFileName(exportedAt: string): string {
  const date = exportedAt.slice(0, 10);
  return `examflash-backup-${date}.json`;
}
