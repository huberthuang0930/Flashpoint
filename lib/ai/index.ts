/**
 * AI insights module
 * Export all AI-related functions and types from a single module
 */

export { generateAIInsights, clearExpiredCache } from "./service";
export { buildPrompt } from "./prompt-builder";
export { callClaudeAPI, filterInsightsByConfidence } from "./claude-client";
export type { AIInsight, AIInsightRequest, HistoricalIncident } from "./types";
