export interface TutorContext {
  cardId?: string;
  deckTitle?: string;
  question: string;
  answer: string;
  explanation?: string;
  category?: string;
  /** The wrong option selected during a quiz, if any. */
  wrongAnswer?: string;
  /** Extra quiz stem context (for example a true/false statement). */
  additionalContext?: string;
  source: "flashcard" | "quiz";
}
