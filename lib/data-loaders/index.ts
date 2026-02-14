/**
 * Unified data loaders
 * Export all data loading functions from a single module
 */

export {
  loadHistoricalIncidents,
  clearIncidentsCache,
  getIncidentsStats
} from "./incidents-loader";

export {
  loadIAPData,
  clearIAPCache,
  getIAPStats
} from "./iap-loader";
