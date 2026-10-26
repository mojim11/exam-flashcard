import { SAMPLE_DECKS } from "@/data/sampleDecks";
import type {
  Card,
  Deck,
  DeckSessionState,
  MasteryLevel,
} from "@/types";

const STORAGE_KEY = "examflash:deck-state";
const STORAGE_VERSION = 1;

type PersistedDeckState = {
  version: typeof STORAGE_VERSION;
  state: DeckSessionState;
};

function cloneDeck(deck: Deck): Deck {
  return {
    ...deck,
    mistakeCardIds: deck.mistakeCardIds ? [...deck.mistakeCardIds] : [],
    cards: deck.cards.map((card) => ({
      ...card,
      tags: card.tags ? [...card.tags] : undefined,
    })),
  };
}

/** Builds the deterministic state used on the server and on a first visit. */
export function createInitialDeckState(): DeckSessionState {
  const decks = SAMPLE_DECKS.map(cloneDeck);
  const selectedDeck = decks[0];

  return {
    decks,
    selectedDeckId: selectedDeck.id,
    currentCardIndex: 0,
    sessionCardIds: selectedDeck.cards.map((card) => card.id),
    reviewedCardIds: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMasteryLevel(value: unknown): value is MasteryLevel {
  return (
    value === "new" ||
    value === "forgot" ||
    value === "fuzzy" ||
    value === "mastered"
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCard(value: unknown): value is Card {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.question === "string" &&
    typeof value.answer === "string" &&
    typeof value.category === "string" &&
    isMasteryLevel(value.masteryLevel) &&
    (value.lastReviewedAt === null ||
      typeof value.lastReviewedAt === "string") &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    (value.explanation === undefined ||
      typeof value.explanation === "string") &&
    (value.tags === undefined || isStringArray(value.tags))
  );
}

function isDeck(value: unknown): value is Deck {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    Array.isArray(value.cards) &&
    value.cards.every(isCard) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    (value.mistakeCardIds === undefined ||
      isStringArray(value.mistakeCardIds))
  );
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string"))];
}

function normalizeDeck(deck: Deck): Deck {
  const cardIds = new Set<string>();
  const cards = deck.cards.filter((card) => {
    if (!card.id || cardIds.has(card.id)) return false;
    cardIds.add(card.id);
    return true;
  });

  return {
    ...deck,
    cards,
    mistakeCardIds: uniqueStrings(deck.mistakeCardIds ?? []).filter((id) =>
      cardIds.has(id),
    ),
  };
}

/** Validates and deduplicates imported deck data from backups or storage. */
export function normalizeDeckCollection(value: unknown): Deck[] | null {
  if (!Array.isArray(value)) return null;

  const deckIds = new Set<string>();
  const decks = value.filter(isDeck).flatMap((deck) => {
    if (!deck.id || deckIds.has(deck.id)) return [];
    deckIds.add(deck.id);
    return [normalizeDeck(deck)];
  });

  return decks.length > 0 ? decks : null;
}

function clampIndex(index: unknown, length: number): number {
  if (length === 0) return 0;
  if (typeof index !== "number" || !Number.isFinite(index)) return 0;

  return Math.min(Math.max(Math.trunc(index), 0), length - 1);
}

function parseStoredState(raw: string): DeckSessionState | null {
  let payload: unknown;

  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    !isRecord(payload) ||
    payload.version !== STORAGE_VERSION ||
    !isRecord(payload.state)
  ) {
    return null;
  }

  const state = payload.state;

  if (!Array.isArray(state.decks)) return null;

  const decks = normalizeDeckCollection(state.decks);
  if (!decks) return null;

  const selectedDeck =
    decks.find((deck) => deck.id === state.selectedDeckId) ?? decks[0];
  const deckCardIds = new Set(selectedDeck.cards.map((card) => card.id));

  const storedSessionIds = isStringArray(state.sessionCardIds)
    ? uniqueStrings(state.sessionCardIds as unknown[]).filter((id) =>
        deckCardIds.has(id),
      )
    : [];
  const sessionCardIds =
    storedSessionIds.length > 0
      ? storedSessionIds
      : selectedDeck.cards.map((card) => card.id);

  const sessionSet = new Set(sessionCardIds);
  const reviewedCardIds = isStringArray(state.reviewedCardIds)
    ? uniqueStrings(state.reviewedCardIds as unknown[]).filter((id) =>
        sessionSet.has(id),
      )
    : [];

  return {
    decks,
    selectedDeckId: selectedDeck.id,
    currentCardIndex: clampIndex(state.currentCardIndex, sessionCardIds.length),
    sessionCardIds,
    reviewedCardIds,
  };
}

/** Reads and validates saved progress. Invalid data falls back to seed data. */
export function loadDeckState(): DeckSessionState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseStoredState(raw) : null;
  } catch {
    return null;
  }
}

/** Persists the whole session so refreshing resumes the exact same round. */
export function saveDeckState(state: DeckSessionState): void {
  if (typeof window === "undefined") return;

  try {
    const payload: PersistedDeckState = {
      version: STORAGE_VERSION,
      state,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable in private mode or when the quota is full.
  }
}
