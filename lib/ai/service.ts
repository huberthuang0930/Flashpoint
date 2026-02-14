/**
 * AI insights service - main orchestrator
 * Handles caching, rate limiting, and coordinates prompt building + API calls
 */

import { predictSpreadPattern } from "../directional-spread";
import { TTLCache } from "../cache";
import { buildPrompt } from "./prompt-builder";
import { callClaudeAPI, filterInsightsByConfidence } from "./claude-client";
import type { AIInsight, AIInsightRequest } from "./types";

// Cache with 5-minute TTL
const cache = new TTLCache<AIInsight[]>(5 * 60 * 1000);

// Rate limiting
let requestCount = 0;
let rateLimitWindow = Date.now();
const MAX_REQUESTS_PER_MINUTE = 10;

/**
 * Generate cache key from request
 */
function getCacheKey(request: AIInsightRequest): string {
  return `${request.incident.id}-${request.riskScore.total}-${request.weather.windSpeedMps}-${request.weather.humidityPct}`;
}

/**
 * Check if rate limit is exceeded
 */
function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - rateLimitWindow > 60000) {
    requestCount = 0;
    rateLimitWindow = now;
  }

  if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    console.warn("AI service rate limit exceeded");
    return false;
  }

  requestCount++;
  return true;
}

/**
 * Generate AI insights using Anthropic Claude API
 */
export async function generateAIInsights(
  request: AIInsightRequest
): Promise<AIInsight[]> {
  // Check feature flag
  if (process.env.AI_INSIGHTS_ENABLED !== "true") {
    return [];
  }

  // Check cache
  const cacheKey = getCacheKey(request);
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Check rate limit
  if (!checkRateLimit()) {
    // Return stale cache if available, otherwise empty
    return cache.get(cacheKey) || [];
  }

  try {
    // Selectively retrieve directional spread data if not provided
    if (!request.directionalSpread) {
      try {
        const spreadPattern = predictSpreadPattern(
          request.incident,
          request.weather.windDirDeg
        );
        request.directionalSpread = spreadPattern;
      } catch (error) {
        console.warn("Could not retrieve directional spread data:", error);
        // Continue without directional spread data
      }
    }

    // Build prompt
    const prompt = buildPrompt(request);

    // Call Claude API
    const insights = await callClaudeAPI(prompt);

    // Filter by confidence
    const filteredInsights = filterInsightsByConfidence(insights, 40);

    // Limit to 3 insights max
    const limitedInsights = filteredInsights.slice(0, 3);

    // Cache the result
    cache.set(cacheKey, limitedInsights);

    return limitedInsights;

  } catch (error) {
    console.error("AI insights generation error:", error);

    // Try to return cached result (even if expired)
    const staleCache = cache.get(cacheKey);
    if (staleCache) {
      return staleCache;
    }

    // Graceful degradation: return empty array
    return [];
  }
}

/**
 * Clear expired cache entries (call periodically)
 */
export function clearExpiredCache(): void {
  cache.clearExpired();
}
