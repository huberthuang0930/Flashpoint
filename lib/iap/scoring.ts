/**
 * IAP similarity scoring logic
 * Calculates relevance scores between current incidents and historical IAPs
 */

import type { Incident, Weather, CardType, IAPData, TerrainMetrics } from "../types";
import { calculateTerrainSimilarity } from "../terrain";
import { FUEL_COMPATIBILITY_MAP, RELEVANT_SECTIONS } from "./constants";

/**
 * Calculate similarity score between current incident and an IAP
 * Returns score 0-100
 * Optional terrain parameter adds terrain-based scoring for tactics cards
 */
export function calculateIAPSimilarity(
  incident: Incident,
  weather: Weather,
  cardType: CardType,
  iap: IAPData,
  terrain?: TerrainMetrics
): number {
  let score = 0;

  // 1. Fuel Type Match (25 points)
  if (iap.conditions.fuel) {
    if (iap.conditions.fuel === incident.fuelProxy) {
      score += 25;
    } else if (FUEL_COMPATIBILITY_MAP[incident.fuelProxy]?.includes(iap.conditions.fuel)) {
      score += 12;
    }
  }

  // 2. Weather Similarity (25 points total: 15 for wind, 10 for humidity)
  if (iap.conditions.weather) {
    // Wind speed similarity (15 points max)
    if (iap.conditions.weather.windSpeedMps !== undefined) {
      const windDiff = Math.abs(weather.windSpeedMps - iap.conditions.weather.windSpeedMps);
      if (windDiff <= 3) {
        score += 15;
      } else if (windDiff <= 7) {
        score += 8;
      } else if (windDiff <= 12) {
        score += 3;
      }
    }

    // Humidity similarity (10 points max)
    if (iap.conditions.weather.humidityPct !== undefined) {
      const humidityDiff = Math.abs(weather.humidityPct - iap.conditions.weather.humidityPct);
      if (humidityDiff <= 10) {
        score += 10;
      } else if (humidityDiff <= 20) {
        score += 5;
      } else if (humidityDiff <= 30) {
        score += 2;
      }
    }
  }

  // 3. Incident Scale (15 points)
  if (iap.conditions.acres) {
    // Estimate current incident acres from radius
    const radiusKm = incident.perimeter.radiusMeters / 1000;
    const estimatedAcres = (Math.PI * radiusKm * radiusKm * 247.105); // km² to acres

    const sizeRatio = Math.min(estimatedAcres, iap.conditions.acres) /
                      Math.max(estimatedAcres, iap.conditions.acres);

    score += sizeRatio * 15;
  } else {
    // No size data, give half points
    score += 7;
  }

  // 4. Relevant Section Availability (25 points - reduced from 35 to make room for terrain)
  const relevantSectionTypes = RELEVANT_SECTIONS[cardType];
  const hasRelevantSections = iap.sections.some(s =>
    relevantSectionTypes.includes(s.type)
  );

  if (hasRelevantSections) {
    score += 25;
  } else if (iap.sections.length > 0) {
    // Has some sections, just not the most relevant ones
    score += 10;
  }

  // 5. Terrain Similarity (20 points max - for tactics cards only)
  if (cardType === "tactics" && terrain && iap.rawText) {
    const terrainScore = calculateTerrainSimilarity(terrain, iap.rawText);
    score += (terrainScore / 100) * 20; // Scale to 20 points max
  }

  return Math.round(score);
}
