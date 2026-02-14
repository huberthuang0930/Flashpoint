/**
 * Loader for IAP (Incident Action Plan) data
 * Provides consistent interface for accessing preprocessed IAP data
 */

import type { IAPData } from "../types";
import { SimpleCache } from "../cache";
import { readFileSync } from "fs";
import { join } from "path";

// Cache for loaded data
const cache = new SimpleCache<IAPData[]>();

/**
 * Load IAP data from JSON file
 * Uses in-memory cache after first load
 */
export function loadIAPData(): IAPData[] {
  // Check cache first
  const cached = cache.get();
  if (cached) {
    return cached;
  }

  try {
    const dataPath = join(process.cwd(), "data", "iap", "iap-data.json");
    const rawData = readFileSync(dataPath, "utf-8");
    const parsed = JSON.parse(rawData);
    const iaps = parsed.iaps || [];

    // Cache for future use
    cache.set(iaps);

    return iaps;
  } catch (error) {
    console.warn("Failed to load IAP data:", error);

    // Cache empty array to avoid repeated file reads
    cache.set([]);

    return [];
  }
}

/**
 * Clear the cache (useful for testing or reloading data)
 */
export function clearIAPCache(): void {
  cache.clear();
}

/**
 * Get statistics about loaded IAPs
 */
export function getIAPStats(): {
  total: number;
  byFuel: Record<string, number>;
  totalSections: number;
  totalLessons: number;
} {
  const iaps = loadIAPData();

  const byFuel: Record<string, number> = {};
  let totalSections = 0;
  let totalLessons = 0;

  for (const iap of iaps) {
    if (iap.conditions.fuel) {
      byFuel[iap.conditions.fuel] = (byFuel[iap.conditions.fuel] || 0) + 1;
    }
    totalSections += iap.sections.length;
    totalLessons += iap.tacticalLessons.length;
  }

  return {
    total: iaps.length,
    byFuel,
    totalSections,
    totalLessons
  };
}