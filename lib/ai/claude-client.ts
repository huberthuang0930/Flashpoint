/**
 * Claude API client wrapper
 * Handles API calls to Anthropic Claude
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AIInsight } from "./types";

const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Call Claude API with a prompt and return parsed insights
 */
export async function callClaudeAPI(prompt: string): Promise<AIInsight[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    throw new Error("Anthropic API key not configured");
  }

  const client = new Anthropic({
    apiKey: apiKey,
  });

  const modelName = process.env.AI_MODEL || "claude-sonnet-4-5";

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("AI service timeout")), REQUEST_TIMEOUT_MS);
  });

  // Race between API call and timeout
  const response = await Promise.race([
    client.messages.create({
      model: modelName,
      max_tokens: 1500,
      temperature: 0.3,
      messages: [{
        role: "user",
        content: prompt
      }]
    }),
    timeoutPromise
  ]);

  // Parse response
  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  // Strip markdown code fences if present
  let jsonText = content.text.trim();
  if (jsonText.startsWith("```")) {
    // Remove opening fence (```json or ```)
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "");
    // Remove closing fence
    jsonText = jsonText.replace(/\n?```$/, "");
    jsonText = jsonText.trim();
  }

  const parsed = JSON.parse(jsonText);

  if (!parsed.insights || !Array.isArray(parsed.insights)) {
    throw new Error("Invalid response format");
  }

  return parsed.insights;
}

/**
 * Filter insights by confidence threshold
 */
export function filterInsightsByConfidence(insights: AIInsight[], minConfidence: number = 40): AIInsight[] {
  return insights.filter(insight => {
    const confScore = insight.confidence === "high" ? 100 : insight.confidence === "medium" ? 70 : 40;
    return confScore >= minConfidence;
  });
}
