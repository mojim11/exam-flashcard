"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createInitialDeckState,
  loadDeckState,
  saveDeckState,
} from "@/lib/deckStorage";
import type {
  Card,
  CreateDeckInput,
  Deck,
  DeckSessionState,
  ReviewRating,
} from "@/types";

interface DeckContextValue {
  decks: Deck[];
  selectedDeck: Deck;
  selectedDeckId: string;
  currentCard: Card | null;
  currentIndex: number;
  currentPosition: number;
  roundTotal: number;
  deckCardCount: number;
  reviewedCount: number;
  masteredCount: number;
  weakCount: number;
  mistakeCount: number;
  roundPercent: number;
  masteryPercent: number;
  isComplete: boolean;
  isHydrated: boolean;
  selectDeck: (deckId: string) => void;
  addDeck: (input: CreateDeckInput) => string;
  replaceAllData: (decks: Deck[], selectedDeckId?: string) => void;
  resetAllData: () => void;
  nextCard: () => void;
  previousCard: () => void;
  rateCurrentCard: (rating: ReviewRating) => void;
  resetCurrentDeck: () => void;
  reviewWeakCards: () => void;
  recordMistake: (cardId: string) => void;
  clearMistake: (cardId: string) => void;
}

const DeckContext = createContext<DeckContextValue | null>(null);

function createId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isWeak(card: Card): boolean {
  return card.masteryLevel === "forgot" || card.masteryLevel === "fuzzy";
}

export function DeckProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DeckSessionState>(createInitialDeckState);
  const [isHydrated, setIsHydrated] = useState(false);

  // localStorage is browser-only, so restore after the first client render.
  // The update is a non-urgent transition: it reconciles external persisted
  // data without turning hydration into a synchronous cascading render.
  useEffect(() => {
    const persisted = loadDeckState();

    startTransition(() => {
      if (persisted) {
        setState(persisted);
      }
      setIsHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    saveDeckState(state);
  }, [isHydrated, state]);

  const selectDeck = useCallback((deckId: string) => {
    setState((previous) => {
      if (deckId === previous.selectedDeckId) return previous;

      const deck = previous.decks.find((item) => item.id === deckId);
      if (!deck) return previous;

      return {
        ...previous,
        selectedDeckId: deck.id,
        currentCardIndex: 0,
        sessionCardIds: deck.cards.map((card) => card.id),
        reviewedCardIds: [],
      };
    });
  }, []);

  const addDeck = useCallback((input: CreateDeckInput): string => {
    const now = new Date().toISOString();
    const cards: Card[] = input.cards
      .filter(
        (draft) =>
          draft.question.trim().length > 0 && draft.answer.trim().length > 0,
      )
      .map((draft) => ({
        id: createId("card"),
        question: draft.question.trim(),
        answer: draft.answer.trim(),
        category: draft.category?.trim() || "导入考点",
        masteryLevel: "new",
        lastReviewedAt: null,
        createdAt: now,
        updatedAt: now,
        explanation: draft.explanation?.trim() || undefined,
        tags: draft.tags?.length ? draft.tags : undefined,
      }));

    const deck: Deck = {
      id: createId("deck"),
      title: input.title.trim() || "未命名题库",
      description:
        input.description?.trim() ||
        `从文本导入 · ${cards.length} 张卡片`,
      cards,
      createdAt: now,
      updatedAt: now,
      mistakeCardIds: [],
    };

    setState((previous) => ({
      ...previous,
      decks: [...previous.decks, deck],
      selectedDeckId: deck.id,
      currentCardIndex: 0,
      sessionCardIds: deck.cards.map((card) => card.id),
      reviewedCardIds: [],
    }));

    return deck.id;
  }, []);

  const replaceAllData = useCallback(
    (decks: Deck[], selectedDeckId?: string) => {
      if (decks.length === 0) return;

      const selectedDeck =
        decks.find((deck) => deck.id === selectedDeckId) ?? decks[0];

      setState({
        decks,
        selectedDeckId: selectedDeck.id,
        currentCardIndex: 0,
        sessionCardIds: selectedDeck.cards.map((card) => card.id),
        reviewedCardIds: [],
      });
    },
    [],
  );

  const resetAllData = useCallback(() => {
    setState(createInitialDeckState());
  }, []);

  const nextCard = useCallback(() => {
    setState((previous) => {
      const total = previous.sessionCardIds.length;
      if (total === 0) return previous;

      return {
        ...previous,
        currentCardIndex: (previous.currentCardIndex + 1) % total,
      };
    });
  }, []);

  const previousCard = useCallback(() => {
    setState((previous) => {
      const total = previous.sessionCardIds.length;
      if (total === 0) return previous;

      return {
        ...previous,
        currentCardIndex:
          (previous.currentCardIndex - 1 + total) % total,
      };
    });
  }, []);

  const rateCurrentCard = useCallback((rating: ReviewRating) => {
    setState((previous) => {
      const currentCardId =
        previous.sessionCardIds[previous.currentCardIndex];
      if (!currentCardId) return previous;

      const now = new Date().toISOString();
      const reviewedCardIds = previous.reviewedCardIds.includes(currentCardId)
        ? previous.reviewedCardIds
        : [...previous.reviewedCardIds, currentCardId];
      const reviewedSet = new Set(reviewedCardIds);

      let nextIndex = previous.currentCardIndex;
      for (let offset = 1; offset <= previous.sessionCardIds.length; offset += 1) {
        const candidateIndex =
          (previous.currentCardIndex + offset) %
          previous.sessionCardIds.length;
        if (!reviewedSet.has(previous.sessionCardIds[candidateIndex])) {
          nextIndex = candidateIndex;
          break;
        }
      }

      const decks = previous.decks.map((deck) => {
        if (deck.id !== previous.selectedDeckId) return deck;

        return {
          ...deck,
          updatedAt: now,
          cards: deck.cards.map((card) =>
            card.id === currentCardId
              ? {
                  ...card,
                  masteryLevel: rating,
                  lastReviewedAt: now,
                  updatedAt: now,
                }
              : card,
          ),
        };
      });

      return {
        ...previous,
        decks,
        currentCardIndex: nextIndex,
        reviewedCardIds,
      };
    });
  }, []);

  const resetCurrentDeck = useCallback(() => {
    setState((previous) => {
      const now = new Date().toISOString();
      const decks = previous.decks.map((deck) => {
        if (deck.id !== previous.selectedDeckId) return deck;

        return {
          ...deck,
          updatedAt: now,
          mistakeCardIds: [],
          cards: deck.cards.map((card) => ({
            ...card,
            masteryLevel: "new" as const,
            lastReviewedAt: null,
            updatedAt: now,
          })),
        };
      });

      const selectedDeck =
        decks.find((deck) => deck.id === previous.selectedDeckId) ?? decks[0];

      return {
        ...previous,
        decks,
        currentCardIndex: 0,
        sessionCardIds: selectedDeck.cards.map((card) => card.id),
        reviewedCardIds: [],
      };
    });
  }, []);

  const reviewWeakCards = useCallback(() => {
    setState((previous) => {
      const selectedDeck = previous.decks.find(
        (deck) => deck.id === previous.selectedDeckId,
      );
      if (!selectedDeck) return previous;

      const weakCardIds = selectedDeck.cards
        .filter(isWeak)
        .map((card) => card.id);
      if (weakCardIds.length === 0) return previous;

      return {
        ...previous,
        currentCardIndex: 0,
        sessionCardIds: weakCardIds,
        reviewedCardIds: [],
      };
    });
  }, []);

  const recordMistake = useCallback((cardId: string) => {
    setState((previous) => {
      const selectedDeck = previous.decks.find(
        (deck) => deck.id === previous.selectedDeckId,
      );
      if (!selectedDeck?.cards.some((card) => card.id === cardId)) {
        return previous;
      }

      const mistakeCardIds = selectedDeck.mistakeCardIds ?? [];
      if (mistakeCardIds.includes(cardId)) return previous;

      const now = new Date().toISOString();

      return {
        ...previous,
        decks: previous.decks.map((deck) =>
          deck.id === previous.selectedDeckId
            ? {
                ...deck,
                mistakeCardIds: [...mistakeCardIds, cardId],
                updatedAt: now,
              }
            : deck,
        ),
      };
    });
  }, []);

  const clearMistake = useCallback((cardId: string) => {
    setState((previous) => {
      const selectedDeck = previous.decks.find(
        (deck) => deck.id === previous.selectedDeckId,
      );
      if (!selectedDeck?.mistakeCardIds?.includes(cardId)) return previous;

      return {
        ...previous,
        decks: previous.decks.map((deck) =>
          deck.id === previous.selectedDeckId
            ? {
                ...deck,
                mistakeCardIds: (deck.mistakeCardIds ?? []).filter(
                  (id) => id !== cardId,
                ),
                updatedAt: new Date().toISOString(),
              }
            : deck,
        ),
      };
    });
  }, []);

  const selectedDeck =
    state.decks.find((deck) => deck.id === state.selectedDeckId) ??
    state.decks[0];

  if (!selectedDeck) {
    throw new Error("DeckProvider requires at least one deck.");
  }

  const sessionCards = useMemo(() => {
    const cardsById = new Map(
      selectedDeck.cards.map((card) => [card.id, card] as const),
    );

    return state.sessionCardIds.flatMap((id) => {
      const card = cardsById.get(id);
      return card ? [card] : [];
    });
  }, [selectedDeck, state.sessionCardIds]);

  const sessionIdSet = useMemo(
    () => new Set(sessionCards.map((card) => card.id)),
    [sessionCards],
  );

  const reviewedCount = state.reviewedCardIds.filter((id) =>
    sessionIdSet.has(id),
  ).length;
  const masteredCount = selectedDeck.cards.filter(
    (card) => card.masteryLevel === "mastered",
  ).length;
  const weakCount = selectedDeck.cards.filter(isWeak).length;
  const mistakeCount = selectedDeck.mistakeCardIds?.length ?? 0;
  const roundTotal = sessionCards.length;
  const deckCardCount = selectedDeck.cards.length;
  const currentCard = sessionCards[state.currentCardIndex] ?? null;

  const value = useMemo<DeckContextValue>(
    () => ({
      decks: state.decks,
      selectedDeck,
      selectedDeckId: selectedDeck.id,
      currentCard,
      currentIndex: state.currentCardIndex,
      currentPosition:
        roundTotal === 0
          ? 0
          : Math.min(state.currentCardIndex + 1, roundTotal),
      roundTotal,
      deckCardCount,
      reviewedCount,
      masteredCount,
      weakCount,
      mistakeCount,
      roundPercent:
        roundTotal === 0 ? 0 : Math.round((reviewedCount / roundTotal) * 100),
      masteryPercent:
        deckCardCount === 0
          ? 0
          : Math.round((masteredCount / deckCardCount) * 100),
      isComplete: roundTotal > 0 && reviewedCount >= roundTotal,
      isHydrated,
      selectDeck,
      addDeck,
      replaceAllData,
      resetAllData,
      nextCard,
      previousCard,
      rateCurrentCard,
      resetCurrentDeck,
      reviewWeakCards,
      recordMistake,
      clearMistake,
    }),
    [
      state.decks,
      selectedDeck,
      currentCard,
      state.currentCardIndex,
      roundTotal,
      deckCardCount,
      reviewedCount,
      masteredCount,
      weakCount,
      mistakeCount,
      isHydrated,
      selectDeck,
      addDeck,
      replaceAllData,
      resetAllData,
      nextCard,
      previousCard,
      rateCurrentCard,
      resetCurrentDeck,
      reviewWeakCards,
      recordMistake,
      clearMistake,
    ],
  );

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDeck(): DeckContextValue {
  const context = useContext(DeckContext);

  if (!context) {
    throw new Error("useDeck must be used within a DeckProvider.");
  }

  return context;
}
