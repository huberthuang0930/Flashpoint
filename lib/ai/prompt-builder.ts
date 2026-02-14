/**
 * AI prompt building logic
 * Constructs context-rich prompts for Claude API
 */

import { calculateSpreadStatistics } from "../directional-spread";
import type { AIInsightRequest } from "./types";

/**
 * Build a detailed prompt for AI insights generation
 */
export function buildPrompt(request: AIInsightRequest): string {
  const { incident, weather, riskScore, spreadRate, historicalContext, directionalSpread } = request;

  const evacuationCard = request.cards.find(c => c.type === "evacuation");
  const assetsAtRisk = evacuationCard?.why
    .filter(w => w.includes("envelope"))
    .join("; ") || "No immediate asset threats";

  const historicalSummary = historicalContext.length > 0
    ? historicalContext.map(h =>
        `- ${h.name} (${h.date}): ${h.fuel} fire, wind ${h.weather.windSpeedMps} m/s, humidity ${h.weather.humidityPct}%, ${h.outcome} in ${h.containmentTimeHours}h, ${h.finalAcres} acres. Lesson: ${h.keyLesson}`
      ).join("\n")
    : "No similar historical incidents found";

  // Add directional spread analysis
  let directionalSpreadSummary = "No directional spread data available";
  if (directionalSpread && directionalSpread.similarFires.length > 0) {
    const { prediction, similarFires } = directionalSpread;
    const stats = calculateSpreadStatistics(similarFires);

    directionalSpreadSummary = `
DIRECTIONAL SPREAD ANALYSIS (${similarFires.length} similar fires within 100km):
- Dominant historical direction: ${stats.dominantDirection}
- Predicted likely direction: ${prediction.likelyDirection} (confidence: ${prediction.confidence})
- Expected expansion rates: N ${prediction.expectedRates.north.toFixed(2)} km/h, S ${prediction.expectedRates.south.toFixed(2)} km/h, E ${prediction.expectedRates.east.toFixed(2)} km/h, W ${prediction.expectedRates.west.toFixed(2)} km/h
- Average shape elongation: ${stats.avgElongation.toFixed(1)}x (1.0 = circular, >1.0 = elongated)
- Pattern reasoning: ${prediction.reasoning.join("; ")}
- Sample fires: ${similarFires.slice(0, 3).map(f => `${f.fireName} (${f.year}, ${f.acres.toFixed(0)} acres, ${f.shape.dominantDirection} spread)`).join(", ")}`;
  }

  return `You are a wildfire behavior analyst assisting an incident commander during initial attack (0-3 hours). Your role is to translate technical data into actionable, time-sensitive insights.

CURRENT SITUATION:
- Incident: ${incident.name}
- Location: ${incident.lat.toFixed(2)}, ${incident.lon.toFixed(2)}
- Fuel Type: ${incident.fuelProxy}
- Weather: Wind ${weather.windSpeedMps} m/s from ${weather.windDirDeg}°, Humidity ${weather.humidityPct}%, Temp ${weather.temperatureC}°C
- Risk Score: ${riskScore.total}/100 (Wind severity: ${riskScore.breakdown.windSeverity}, Humidity severity: ${riskScore.breakdown.humiditySeverity}, Time-to-impact: ${riskScore.breakdown.timeToImpactSeverity})
- Spread Rate: ${spreadRate.toFixed(1)} km/h
- Assets at Risk: ${assetsAtRisk}

HISTORICAL CONTEXT (${historicalContext.length} similar incidents):
${historicalSummary}

${directionalSpreadSummary}

TASK: Generate 2-3 tactical briefing points in incident commander style:
1. Time-critical threats with directional specificity - use directional spread data
2. Historical patterns - reference similar fire behavior from directional spread analysis
3. Resource recommendations - backed by historical outcomes

REQUIREMENTS:
- Each insight message: 8-12 words maximum. Use IC brevity. Example: "NORTHEAST expansion 3.2 km/h. Highway 101 threatened in 90 min."
- Confidence levels:
  * High: 5+ similar historical incidents with consistent patterns (>80% agreement)
  * Medium: 3-4 similar incidents or 50-80% pattern agreement
  * Low: 1-2 similar incidents or <50% pattern agreement
- Provide 1-2 concise reasoning points (one sentence each, no fluff)
- Reference specific incident IDs in sources array when applicable
- Use tactical IC language: directional calls (NORTH, SOUTHEAST), time windows, asset names, action verbs
- NO explanatory phrases. NO "based on" or "considering". State facts only.
- Focus on what matters NOW in the 0-3 hour window

FORMAT: Return valid JSON only (no markdown, no explanations):
{
  "insights": [
    {
      "type": "warning" | "recommendation" | "context",
      "message": "8-12 word tactical brief in IC style",
      "confidence": "high" | "medium" | "low",
      "reasoning": ["Concise fact 1", "Concise fact 2 (optional)"],
      "sources": ["incident_id_1", "incident_id_2"]
    }
  ]
}

EXAMPLE OUTPUT:
{
  "insights": [
    {
      "type": "warning",
      "message": "NORTHEAST spread 4.1 km/h. Town boundary threatened 75 minutes.",
      "confidence": "high",
      "reasoning": ["6 similar fires averaged 3.8 km/h NE expansion", "Current wind aligns with historical pattern"],
      "sources": ["fire_2018_001", "fire_2019_045"]
    }
  ]
}`;
}
