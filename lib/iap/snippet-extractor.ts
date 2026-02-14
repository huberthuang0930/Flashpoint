/**
 * IAP snippet extraction logic
 * Extracts focused, context-aware snippets from IAP sections
 */

import type { CardType, IAPData, IAPSection } from "../types";
import { FOCUS_KEYWORDS } from "./constants";

/**
 * Extract focused snippet from IAP section based on card type and focus
 * Returns 2-3 sentences containing relevant information
 */
export function extractTacticalSnippet(
  section: IAPSection,
  cardType: CardType,
  iap: IAPData
): string {
  const content = section.content;
  const rawText = iap.rawText || content;

  // Get focus keywords based on card type
  const focusKeywords = FOCUS_KEYWORDS[cardType];

  // Find sentences with focus keywords
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
  let relevantSentences = sentences.filter(s =>
    focusKeywords.some(keyword => s.toLowerCase().includes(keyword))
  );

  // If no matches in section, search tactical lessons
  if (relevantSentences.length === 0 && iap.tacticalLessons.length > 0) {
    relevantSentences = iap.tacticalLessons.filter(lesson =>
      focusKeywords.some(keyword => lesson.toLowerCase().includes(keyword))
    );
  }

  // If still no matches, search raw text
  if (relevantSentences.length === 0 && rawText) {
    const rawSentences = rawText.match(/[^.!?]+[.!?]+/g) || [];
    relevantSentences = rawSentences.filter(s =>
      focusKeywords.some(keyword => s.toLowerCase().includes(keyword))
    ).slice(0, 3);
  }

  if (relevantSentences.length > 0) {
    // Return first 2-3 relevant sentences
    const snippet = relevantSentences.slice(0, 2).join(' ').trim();
    return snippet.length > 300 ? snippet.substring(0, 297) + '...' : snippet;
  }

  // Fallback: return first 2 sentences from section
  const fallbackSnippet = sentences.slice(0, 2).join(' ').trim();
  return fallbackSnippet.length > 300 ? fallbackSnippet.substring(0, 297) + '...' : fallbackSnippet;
}
