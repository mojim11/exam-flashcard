/**
 * ISO 8601 timestamp, e.g. "2026-10-25T14:30:00.000Z".
 * Stored as a string so the same shape can be serialized to localStorage.
 */
export type ISODateString = string;

/** Learning progress for a single flashcard. */
export type MasteryLevel = "new" | "forgot" | "fuzzy" | "mastered";

/** A rating the learner can submit after revealing an answer. */
export type ReviewRating = Exclude<MasteryLevel, "new">;

/** A single question/answer flashcard. */
export interface Card {
  id: string;
  question: string;
  answer: string;
  category: string;
  masteryLevel: MasteryLevel;
  /** `null` means the card has never been reviewed. */
  lastReviewedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  /** Explanation revealed with the answer. */
  explanation?: string;
  tags?: string[];
}

/** Input shape used by the import flow before IDs and timestamps exist. */
export interface CardDraft {
  question: string;
  answer: string;
  category?: string;
  explanation?: string;
  tags?: string[];
}

/** Payload for creating a new user-owned deck. */
export interface CreateDeckInput {
  title: string;
  description?: string;
  cards: CardDraft[];
}

/** A named collection of flashcards. */
export interface Deck {
  id: string;
  title: string;
  description: string;
  cards: Card[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
  /** Card IDs recorded by quiz mode; optional for backward compatibility. */
  mistakeCardIds?: string[];
}

/**
 * Everything needed to restore a study session.
 * `sessionCardIds` is deliberately separate from the deck order so a future
 * "review weak cards" round can contain a filtered subset.
 */
export interface DeckSessionState {
  decks: Deck[];
  selectedDeckId: string;
  currentCardIndex: number;
  sessionCardIds: string[];
  reviewedCardIds: string[];
}
