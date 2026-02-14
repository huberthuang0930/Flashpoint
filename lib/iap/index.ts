/**
 * IAP (Incident Action Plan) matching module
 * Export all IAP-related functions from a single module
 */

export { findRelevantIAPs } from "./matcher";
export { calculateIAPSimilarity } from "./scoring";
export { extractTacticalSnippet } from "./snippet-extractor";
export { generateReasoning } from "./reasoning";
export {
  FUEL_COMPATIBILITY_MAP,
  RELEVANT_SECTIONS,
  FOCUS_KEYWORDS,
  MIN_IAP_SCORE,
  MAX_IAP_INSIGHTS
} from "./constants";
