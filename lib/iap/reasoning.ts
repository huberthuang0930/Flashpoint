/**
 * IAP reasoning generation logic
 * Generates explanation bullets for why an IAP is relevant
 */

import type { Incident, Weather, CardType, IAPData } from "../types";
import { FUEL_COMPATIBILITY_MAP } from "./constants";

/**
 * Generate reasoning bullets explaining why this IAP is relevant
 */
export function generateReasoning(
  incident: Incident,
  weather: Weather,
  iap: IAPData,
  score: number,
  cardType: CardType
): string[] {
  const reasoning: string[] = [];

  // Add focus-specific reasoning first
  if (cardType === "evacuation") {
    // Weather-focused reasoning
    if (iap.conditions.weather) {
      if (iap.conditions.weather.windSpeedMps !== undefined) {
        const windDiff = Math.abs(weather.windSpeedMps - iap.conditions.weather.windSpeedMps);
        if (windDiff <= 5) {
          reasoning.push(`Similar wind conditions: ${iap.conditions.weather.windSpeedMps.toFixed(1)} m/s affected containment`);
        }
      }
      if (iap.conditions.weather.humidityPct !== undefined && iap.conditions.weather.humidityPct < 25) {
        reasoning.push(`Low humidity (${iap.conditions.weather.humidityPct}%) drove rapid spread`);
      }
    }
  } else if (cardType === "resources") {
    // Previous fire outcomes reasoning
    if (iap.conditions.acres) {
      reasoning.push(`${iap.conditions.acres.toLocaleString()} acre fire - resource patterns applicable`);
    }
    if (iap.sections.some(s => s.type === "ICS-203" || s.type === "ICS-204")) {
      reasoning.push(`Documented resource assignments and effectiveness`);
    }
  } else if (cardType === "tactics") {
    // Terrain-focused reasoning
    if (iap.location.county) {
      reasoning.push(`Similar California terrain in ${iap.location.county} County`);
    }
    if (iap.sections.some(s => s.type === "ICS-204")) {
      reasoning.push(`Terrain-based tactical assignments documented`);
    }
    // Check for terrain similarity mentions
    if (iap.rawText) {
      const hasTerrainRefs = /steep|slope|ridge|terrain|uphill|downhill/i.test(iap.rawText);
      if (hasTerrainRefs) {
        reasoning.push(`IAP describes similar terrain features`);
      }
    }
  }

  // Fuel match (always relevant)
  if (iap.conditions.fuel === incident.fuelProxy) {
    reasoning.push(`Exact fuel type match: ${iap.conditions.fuel}`);
  } else if (iap.conditions.fuel && FUEL_COMPATIBILITY_MAP[incident.fuelProxy]?.includes(iap.conditions.fuel)) {
    reasoning.push(`Compatible fuel: ${iap.conditions.fuel}`);
  }

  // Ensure at least 2 reasoning items
  if (reasoning.length < 2) {
    reasoning.push(`Overall relevance: ${score}%`);
  }

  return reasoning.slice(0, 3); // Limit to 3 items
}
