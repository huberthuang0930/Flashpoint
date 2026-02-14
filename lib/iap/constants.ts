/**
 * Shared constants for IAP matching and processing
 */

import type { CardType } from "../types";

// Fuel compatibility map (reuse from historical-data.ts pattern)
export const FUEL_COMPATIBILITY_MAP: Record<string, string[]> = {
  grass: ["grass", "mixed"],
  brush: ["brush", "chaparral", "mixed"],
  mixed: ["mixed", "grass", "brush"],
  chaparral: ["chaparral", "brush"],
};

// Relevant ICS sections for each card type
export const RELEVANT_SECTIONS: Record<CardType, string[]> = {
  tactics: ["ICS-202", "ICS-204", "ICS-220"],
  resources: ["ICS-203", "ICS-204"],
  evacuation: ["ICS-202"],
};

// Focus keywords for each card type (used in snippet extraction)
export const FOCUS_KEYWORDS: Record<CardType, string[]> = {
  evacuation: [
    'wind',
    'gust',
    'humidity',
    'weather',
    'rapid spread',
    'extreme fire behavior',
    'red flag',
    'wind shift',
    'wind-driven'
  ],
  resources: [
    'contained',
    'containment',
    'escaped',
    'successful',
    'effective',
    'additional resources',
    'resource',
    'personnel',
    'equipment',
    'initial attack'
  ],
  tactics: [
    'terrain',
    'slope',
    'ridge',
    'topography',
    'uphill',
    'downhill',
    'canyon',
    'valley',
    'elevation',
    'natural barrier',
    'road',
    'highway'
  ]
};

// Minimum score threshold for IAP relevance
export const MIN_IAP_SCORE = 60;

// Maximum number of IAP insights to return
export const MAX_IAP_INSIGHTS = 3;
