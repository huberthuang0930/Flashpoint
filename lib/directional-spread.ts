import type { Incident } from "./types";
import queryData from "@/query.json";

/**
 * Directional spread analysis for a historical fire
 */
export interface DirectionalSpread {
  fireId: string;
  fireName: string;
  year: number;
  acres: number;
  durationHours: number;

  // Bounding box
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
    centerLat: number;
    centerLon: number;
  };

  // Directional extents (in km from center)
  extents: {
    north: number;
    south: number;
    east: number;
    west: number;
  };

  // Expansion rates (km/hour in each direction)
  rates: {
    north: number;
    south: number;
    east: number;
    west: number;
    avgRate: number;
  };

  // Shape characteristics
  shape: {
    aspectRatio: number; // width/height ratio
    dominantDirection: "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW" | "UNIFORM";
    elongation: number; // 1.0 = circular, >1.0 = elongated
  };
}

/**
 * Feature from the GeoJSON query.json file
 */
interface GeoJSONFeature {
  type: "Feature";
  id: number;
  properties: {
    OBJECTID: number;
    YEAR_: number;
    STATE: string;
    FIRE_NAME: string;
    INC_NUM: string;
    ALARM_DATE: number; // Unix timestamp in ms
    CONT_DATE: number; // Unix timestamp in ms
    GIS_ACRES: number;
    UNIT_ID?: string;
    AGENCY?: string;
  };
  geometry: {
    type: "MultiPolygon";
    coordinates: number[][][][]; // [[[lon, lat]]]
  };
}

interface GeoJSONData {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

// In-memory index for fast retrieval
interface SpreadIndex {
  byName: Map<string, DirectionalSpread[]>;
  byLocation: Map<string, DirectionalSpread[]>; // Grid-based spatial index
  byYear: Map<number, DirectionalSpread[]>;
  all: DirectionalSpread[];
}

let cachedIndex: SpreadIndex | null = null;

/**
 * Calculate distance in km between two lat/lon points using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get grid key for spatial indexing (roughly 0.5 degree grid cells)
 */
function getGridKey(lat: number, lon: number): string {
  const gridSize = 0.5;
  const gridLat = Math.floor(lat / gridSize) * gridSize;
  const gridLon = Math.floor(lon / gridSize) * gridSize;
  return `${gridLat.toFixed(1)},${gridLon.toFixed(1)}`;
}

/**
 * Extract all coordinates from a MultiPolygon geometry
 */
function extractAllCoordinates(geometry: GeoJSONFeature["geometry"]): [number, number][] {
  const coords: [number, number][] = [];

  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      for (const point of ring) {
        coords.push([point[0], point[1]]); // [lon, lat]
      }
    }
  }

  return coords;
}

/**
 * Analyze directional spread for a single fire feature
 */
function analyzeFeatureSpread(feature: GeoJSONFeature): DirectionalSpread | null {
  try {
    const coords = extractAllCoordinates(feature.geometry);

    if (coords.length === 0) {
      return null;
    }

    // Calculate bounding box
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    for (const [lon, lat] of coords) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }

    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;

    // Calculate extents from center (in km)
    const northExtent = calculateDistance(centerLat, centerLon, maxLat, centerLon);
    const southExtent = calculateDistance(centerLat, centerLon, minLat, centerLon);
    const eastExtent = calculateDistance(centerLat, centerLon, centerLat, maxLon);
    const westExtent = calculateDistance(centerLat, centerLon, centerLat, minLon);

    // Calculate duration in hours
    const durationHours = feature.properties.CONT_DATE && feature.properties.ALARM_DATE
      ? (feature.properties.CONT_DATE - feature.properties.ALARM_DATE) / (1000 * 60 * 60)
      : 0;

    // Calculate expansion rates (km/hour)
    const safeHours = Math.max(durationHours, 0.1); // Avoid division by zero
    const northRate = northExtent / safeHours;
    const southRate = southExtent / safeHours;
    const eastRate = eastExtent / safeHours;
    const westRate = westExtent / safeHours;
    const avgRate = (northRate + southRate + eastRate + westRate) / 4;

    // Determine shape characteristics
    const width = eastExtent + westExtent;
    const height = northExtent + southExtent;
    const aspectRatio = width / Math.max(height, 0.1);
    const elongation = Math.max(width, height) / Math.min(width, height);

    // Determine dominant direction
    let dominantDirection: DirectionalSpread["shape"]["dominantDirection"] = "UNIFORM";
    const maxExtent = Math.max(northExtent, southExtent, eastExtent, westExtent);
    const threshold = 1.3; // 30% larger to be considered dominant

    if (northExtent > maxExtent * 0.95 && eastExtent > maxExtent * 0.8) {
      dominantDirection = "NE";
    } else if (northExtent > maxExtent * 0.95 && westExtent > maxExtent * 0.8) {
      dominantDirection = "NW";
    } else if (southExtent > maxExtent * 0.95 && eastExtent > maxExtent * 0.8) {
      dominantDirection = "SE";
    } else if (southExtent > maxExtent * 0.95 && westExtent > maxExtent * 0.8) {
      dominantDirection = "SW";
    } else if (northExtent >= maxExtent) {
      dominantDirection = "N";
    } else if (southExtent >= maxExtent) {
      dominantDirection = "S";
    } else if (eastExtent >= maxExtent) {
      dominantDirection = "E";
    } else if (westExtent >= maxExtent) {
      dominantDirection = "W";
    }

    return {
      fireId: feature.properties.INC_NUM || `FIRE_${feature.id}`,
      fireName: feature.properties.FIRE_NAME || "UNKNOWN",
      year: feature.properties.YEAR_ || 0,
      acres: feature.properties.GIS_ACRES || 0,
      durationHours,
      bounds: {
        north: maxLat,
        south: minLat,
        east: maxLon,
        west: minLon,
        centerLat,
        centerLon,
      },
      extents: {
        north: northExtent,
        south: southExtent,
        east: eastExtent,
        west: westExtent,
      },
      rates: {
        north: northRate,
        south: southRate,
        east: eastRate,
        west: westRate,
        avgRate,
      },
      shape: {
        aspectRatio,
        dominantDirection,
        elongation,
      },
    };
  } catch (error) {
    console.error(`Error analyzing feature ${feature.id}:`, error);
    return null;
  }
}

/**
 * Build index from query.json data (lazy loaded, cached)
 */
function buildSpreadIndex(): SpreadIndex {
  if (cachedIndex) {
    return cachedIndex;
  }

  console.log("Building directional spread index from query.json...");
  const startTime = Date.now();

  const data = queryData as GeoJSONData;
  const byName = new Map<string, DirectionalSpread[]>();
  const byLocation = new Map<string, DirectionalSpread[]>();
  const byYear = new Map<number, DirectionalSpread[]>();
  const all: DirectionalSpread[] = [];

  let processed = 0;
  let failed = 0;

  for (const feature of data.features) {
    const spread = analyzeFeatureSpread(feature);

    if (spread) {
      all.push(spread);

      // Index by name
      const nameKey = spread.fireName.toUpperCase();
      if (!byName.has(nameKey)) {
        byName.set(nameKey, []);
      }
      byName.get(nameKey)!.push(spread);

      // Index by location (grid-based)
      const gridKey = getGridKey(spread.bounds.centerLat, spread.bounds.centerLon);
      if (!byLocation.has(gridKey)) {
        byLocation.set(gridKey, []);
      }
      byLocation.get(gridKey)!.push(spread);

      // Index by year
      if (!byYear.has(spread.year)) {
        byYear.set(spread.year, []);
      }
      byYear.get(spread.year)!.push(spread);

      processed++;
    } else {
      failed++;
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`Indexed ${processed} fires in ${elapsed}ms (${failed} failed)`);

  cachedIndex = { byName, byLocation, byYear, all };
  return cachedIndex;
}

/**
 * Find fires near a given location within a radius (in km)
 */
export function findFiresNearLocation(
  lat: number,
  lon: number,
  radiusKm: number = 50,
  limit: number = 10
): DirectionalSpread[] {
  const index = buildSpreadIndex();

  // Get the grid cell and neighboring cells
  const gridKeys = new Set<string>();
  const gridSize = 0.5;
  const cellRadius = Math.ceil(radiusKm / 50); // Approximate cells to check

  for (let dLat = -cellRadius; dLat <= cellRadius; dLat++) {
    for (let dLon = -cellRadius; dLon <= cellRadius; dLon++) {
      const checkLat = Math.floor(lat / gridSize) * gridSize + dLat * gridSize;
      const checkLon = Math.floor(lon / gridSize) * gridSize + dLon * gridSize;
      gridKeys.add(getGridKey(checkLat, checkLon));
    }
  }

  // Collect candidates from nearby grid cells
  const candidates: DirectionalSpread[] = [];
  for (const key of gridKeys) {
    const fires = index.byLocation.get(key);
    if (fires) {
      candidates.push(...fires);
    }
  }

  // Filter by actual distance and sort by proximity
  const nearby = candidates
    .map(fire => ({
      fire,
      distance: calculateDistance(lat, lon, fire.bounds.centerLat, fire.bounds.centerLon),
    }))
    .filter(item => item.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(item => item.fire);

  return nearby;
}

/**
 * Find fires by name (partial match)
 */
export function findFiresByName(name: string, limit: number = 10): DirectionalSpread[] {
  const index = buildSpreadIndex();
  const searchName = name.toUpperCase();

  const results: DirectionalSpread[] = [];
  for (const [key, fires] of index.byName.entries()) {
    if (key.includes(searchName)) {
      results.push(...fires);
    }
  }

  return results.slice(0, limit);
}

/**
 * Find fires similar to current incident based on size and location
 */
export function findSimilarFires(
  incident: Incident,
  radiusKm: number = 100,
  limit: number = 10
): DirectionalSpread[] {
  const nearby = findFiresNearLocation(incident.lat, incident.lon, radiusKm, limit * 2);

  // Sort by recency (prefer more recent fires)
  const sorted = nearby.sort((a, b) => b.year - a.year);

  return sorted.slice(0, limit);
}

/**
 * Get statistics for directional spread patterns
 */
export function calculateSpreadStatistics(fires: DirectionalSpread[]): {
  avgNorthRate: number;
  avgSouthRate: number;
  avgEastRate: number;
  avgWestRate: number;
  dominantDirection: string;
  avgElongation: number;
} {
  if (fires.length === 0) {
    return {
      avgNorthRate: 0,
      avgSouthRate: 0,
      avgEastRate: 0,
      avgWestRate: 0,
      dominantDirection: "UNKNOWN",
      avgElongation: 1.0,
    };
  }

  const avgNorthRate = fires.reduce((sum, f) => sum + f.rates.north, 0) / fires.length;
  const avgSouthRate = fires.reduce((sum, f) => sum + f.rates.south, 0) / fires.length;
  const avgEastRate = fires.reduce((sum, f) => sum + f.rates.east, 0) / fires.length;
  const avgWestRate = fires.reduce((sum, f) => sum + f.rates.west, 0) / fires.length;
  const avgElongation = fires.reduce((sum, f) => sum + f.shape.elongation, 0) / fires.length;

  // Find most common dominant direction
  const directionCounts = new Map<string, number>();
  for (const fire of fires) {
    const dir = fire.shape.dominantDirection;
    directionCounts.set(dir, (directionCounts.get(dir) || 0) + 1);
  }

  let dominantDirection = "UNIFORM";
  let maxCount = 0;
  for (const [dir, count] of directionCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      dominantDirection = dir;
    }
  }

  return {
    avgNorthRate,
    avgSouthRate,
    avgEastRate,
    avgWestRate,
    dominantDirection,
    avgElongation,
  };
}

/**
 * Predict spread pattern for current fire based on similar historical fires
 */
export function predictSpreadPattern(
  incident: Incident,
  windDirDeg: number
): {
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
} {
  const similarFires = findSimilarFires(incident, 100, 15);

  if (similarFires.length === 0) {
    return {
      similarFires: [],
      prediction: {
        likelyDirection: "UNKNOWN",
        expectedRates: { north: 0, south: 0, east: 0, west: 0 },
        confidence: "low",
        reasoning: ["No similar historical fires found in the area"],
      },
    };
  }

  const stats = calculateSpreadStatistics(similarFires);

  // Adjust for wind direction
  const windDirCardinal = getCardinalDirection(windDirDeg);

  const reasoning: string[] = [
    `Found ${similarFires.length} similar fires within 100km`,
    `Historical dominant direction: ${stats.dominantDirection}`,
    `Current wind from ${windDirCardinal} (${windDirDeg}°)`,
    `Avg expansion rates: N ${stats.avgNorthRate.toFixed(2)} km/h, S ${stats.avgSouthRate.toFixed(2)} km/h, E ${stats.avgEastRate.toFixed(2)} km/h, W ${stats.avgWestRate.toFixed(2)} km/h`,
  ];

  const confidence = similarFires.length >= 10 ? "high" : similarFires.length >= 5 ? "medium" : "low";

  return {
    similarFires,
    prediction: {
      likelyDirection: stats.dominantDirection,
      expectedRates: {
        north: stats.avgNorthRate,
        south: stats.avgSouthRate,
        east: stats.avgEastRate,
        west: stats.avgWestRate,
      },
      confidence,
      reasoning,
    },
  };
}

/**
 * Convert degrees to cardinal direction
 */
function getCardinalDirection(degrees: number): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

/**
 * Clear cached index (useful for testing or if data changes)
 */
export function clearSpreadCache(): void {
  cachedIndex = null;
}
