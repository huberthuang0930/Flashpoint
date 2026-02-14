/**
 * TypeScript interfaces for AI insights
 * Shared types for AI service modules
 */

import type { Incident, Weather, RiskScore, ActionCard } from "../types";
import type { DirectionalSpread } from "../directional-spread";

export interface HistoricalIncident {
  id: string;
  name: string;
  date: string;
  location: string;
  fuel: "grass" | "brush" | "mixed" | "chaparral";
  weather: {
    windSpeedMps: number;
    humidityPct: number;
    temperatureC: number;
  };
  outcome: "contained" | "escaped" | "partial";
  containmentTimeHours: number;
  finalAcres: number;
  resources: {
    engines: number;
    dozers: number;
    airSupport: boolean;
  };
  keyLesson: string;
}

export interface AIInsight {
  type: "warning" | "recommendation" | "context";
  message: string;
  confidence: "high" | "medium" | "low";
  reasoning: string[];
  sources?: string[];
}

export interface AIInsightRequest {
  incident: Incident;
  weather: Weather;
  riskScore: RiskScore;
  spreadRate: number;
  cards: ActionCard[];
  historicalContext: HistoricalIncident[];
  directionalSpread?: {
    similarFires: DirectionalSpread[];
    prediction: {
      likelyDirection: string;
      expectedRates: {
        north: number;
        south: number;
        east: number;
        west: number;
      };
      confidence: "high" | "medium" | "low";
      reasoning: string[];
    };
  };
}
