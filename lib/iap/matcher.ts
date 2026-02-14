/**
 * IAP matcher - main orchestration logic
 * Finds relevant IAPs and generates insights
 */

import type { Incident, Weather, CardType, IAPInsight, TerrainMetrics } from "../types";
import { loadIAPData } from "../data-loaders";
import { calculateIAPSimilarity } from "./scoring";
import { extractTacticalSnippet } from "./snippet-extractor";
import { generateReasoning } from "./reasoning";
import { RELEVANT_SECTIONS, MIN_IAP_SCORE, MAX_IAP_INSIGHTS } from "./constants";

/**
 * Find relevant IAPs for current incident and generate insights
 * Returns up to 3 IAP insights, sorted by relevance score
 * Optional terrain parameter enhances scoring for tactics cards
 */
export function findRelevantIAPs(
  incident: Incident,
  weather: Weather,
  cardType: CardType,
  terrain?: TerrainMetrics
): IAPInsight[] {
  const iapData = loadIAPData();

  if (iapData.length === 0) {
    return [];
  }

  // Score all IAPs (pass terrain for enhanced tactics scoring)
  const scored = iapData.map(iap => ({
    iap,
    score: calculateIAPSimilarity(incident, weather, cardType, iap, terrain)
  }));

  // Filter by minimum score threshold and sort by score descending
  const filtered = scored
    .filter(s => s.score >= MIN_IAP_SCORE)
    .sort((a, b) => b.score - a.score);

  // Generate insights for top matches
  const insights: IAPInsight[] = [];

  for (const { iap, score } of filtered.slice(0, MAX_IAP_INSIGHTS)) {
    // Find the most relevant section
    const relevantSectionTypes = RELEVANT_SECTIONS[cardType];
    const relevantSection = iap.sections.find(s =>
      relevantSectionTypes.includes(s.type)
    ) || iap.sections[0];

    if (!relevantSection) {
      continue;
    }

    const tacticalSnippet = extractTacticalSnippet(relevantSection, cardType, iap);
    const reasoning = generateReasoning(incident, weather, iap, score, cardType);

    insights.push({
      iapId: iap.id,
      iapName: iap.incidentName,
      relevanceScore: score,
      tacticalSnippet,
      sectionType: relevantSection.type,
      reasoning
    });
  }

  return insights;
}
