/**
 * Loader for historical incidents data
 * Provides consistent interface for accessing incidents.json
 */

import type { HistoricalIncident } from "../ai";
import { SimpleCache } from "../cache";
import incidentsData from "@/data/historical/incidents.json";

// Cache for loaded data
const cache = new SimpleCache<HistoricalIncident[]>();

/**
 * Load historical incidents data
 * Uses in-memory cache after first load
 */
export function loadHistoricalIncidents(): HistoricalIncident[] {
  // Check cache first
  const cached = cache.get();
  if (cached) {
    return cached;
  }

  // Load and validate data
  const incidents = (incidentsData.incidents || []) as HistoricalIncident[];

  if (incidents.length === 0) {
    console.warn("No historical incidents data available");
  }

  // Cache for future use
  cache.set(incidents);

  return incidents;
}

/**
 * Clear the cache (useful for testing)
 */
export function clearIncidentsCache(): void {
  cache.clear();
}

/**
 * Get statistics about loaded incidents
 */
export function getIncidentsStats(): {
  total: number;
  byOutcome: Record<string, number>;
  byFuel: Record<string, number>;
} {
  const incidents = loadHistoricalIncidents();

  const byOutcome: Record<string, number> = {};
  const byFuel: Record<string, number> = {};

  for (const incident of incidents) {
    byOutcome[incident.outcome] = (byOutcome[incident.outcome] || 0) + 1;
    byFuel[incident.fuel] = (byFuel[incident.fuel] || 0) + 1;
  }

  return {
    total: incidents.length,
    byOutcome,
    byFuel
  };
}
