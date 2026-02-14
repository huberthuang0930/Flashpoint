/**
 * Terrain analysis module using Mapbox Terrain-RGB API
 * Calculates slope, aspect, and identifies ridgelines for tactical fire behavior analysis
 */

export interface TerrainMetrics {
  elevation: number; // meters above sea level
  slope: number; // percentage (0-100+)
  slopeAngle: number; // degrees (0-90)
  aspect: string; // cardinal direction: "N", "NE", "E", "SE", "S", "SW", "W", "NW", or "flat"
  aspectDegrees: number; // degrees from north (0-360)
  nearbyRidgeline: boolean; // is there a ridgeline within 2km?
  ridgelineDistKm?: number; // distance to nearest ridgeline
  ridgelineDirection?: string; // direction to ridgeline: "N", "E", "S", "W"
  terrainType: "flat" | "gentle" | "moderate" | "steep" | "extreme"; // categorized slope
  notes: string[]; // tactical notes about terrain
}

/**
 * Sample elevation points around a center point
 * Returns array of {lat, lon, elevation} for analysis
 */
interface ElevationPoint {
  lat: number;
  lon: number;
  elevation: number;
}

/**
 * Decode Mapbox Terrain-RGB tile data into elevation
 * Mapbox encodes elevation as: -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
 */
function decodeMapboxElevation(r: number, g: number, b: number): number {
  return -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
}

/**
 * Calculate distance between two lat/lon points in meters (Haversine formula)
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Calculate bearing (direction) from point1 to point2 in degrees
 */
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const toDeg = (rad: number) => rad * 180 / Math.PI;

  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);

  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360; // Normalize to 0-360
}

/**
 * Convert degrees to cardinal direction
 */
function degreesToCardinal(degrees: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

/**
 * Calculate slope between two elevation points
 * Returns slope as percentage
 */
function calculateSlope(elev1: number, elev2: number, distanceMeters: number): number {
  const elevationDiff = Math.abs(elev2 - elev1);
  const slopePercent = (elevationDiff / distanceMeters) * 100;
  return slopePercent;
}

/**
 * Calculate aspect (direction of slope) from elevation grid
 * Uses gradient method: aspect = atan2(dz/dy, dz/dx)
 */
function calculateAspect(
  centerElev: number,
  northElev: number,
  southElev: number,
  eastElev: number,
  westElev: number,
  cellSize: number
): { degrees: number; direction: string } {
  // Calculate gradients
  const dz_dx = (eastElev - westElev) / (2 * cellSize);
  const dz_dy = (northElev - southElev) / (2 * cellSize);

  // Calculate aspect in radians, then convert to degrees
  let aspectRad = Math.atan2(dz_dy, -dz_dx);
  let aspectDeg = aspectRad * 180 / Math.PI;

  // Normalize to 0-360 (0 = north, 90 = east, etc.)
  aspectDeg = (90 - aspectDeg + 360) % 360;

  // Check if slope is too flat to have meaningful aspect
  const slopeGradient = Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy);
  if (slopeGradient < 0.01) {
    return { degrees: 0, direction: "flat" };
  }

  return {
    degrees: aspectDeg,
    direction: degreesToCardinal(aspectDeg)
  };
}

/**
 * Categorize slope into terrain type
 */
function categorizeSlope(slopePercent: number): "flat" | "gentle" | "moderate" | "steep" | "extreme" {
  if (slopePercent < 5) return "flat";
  if (slopePercent < 15) return "gentle";
  if (slopePercent < 30) return "moderate";
  if (slopePercent < 50) return "steep";
  return "extreme";
}

/**
 * Detect ridgelines by finding local elevation maxima
 * Simplified: check if center point is higher than surrounding points
 */
function detectRidgeline(
  centerElev: number,
  northElev: number,
  southElev: number,
  eastElev: number,
  westElev: number,
  threshold: number = 20 // meters higher to be considered a ridge
): boolean {
  const higherThanNeighbors =
    centerElev > northElev + threshold &&
    centerElev > southElev + threshold &&
    centerElev > eastElev + threshold &&
    centerElev > westElev + threshold;

  return higherThanNeighbors;
}

/**
 * Generate tactical notes based on terrain metrics
 */
function generateTerrainNotes(metrics: TerrainMetrics): string[] {
  const notes: string[] = [];

  // Slope notes
  if (metrics.slope > 30) {
    notes.push("Steep terrain - fire can spread 3-5x faster uphill");
  } else if (metrics.slope > 15) {
    notes.push("Moderate slopes increase uphill fire spread rate by 2-3x");
  }

  // Aspect notes (south/southwest facing = drier)
  if (["S", "SW", "SE"].includes(metrics.aspect)) {
    notes.push(`${metrics.aspect}-facing slope receives more sun exposure - expect drier fuels`);
  }

  // Ridgeline notes
  if (metrics.nearbyRidgeline && metrics.ridgelineDistKm) {
    notes.push(`Ridgeline ${metrics.ridgelineDistKm.toFixed(1)}km ${metrics.ridgelineDirection} - potential natural control line`);
  }

  return notes;
}

/**
 * Mock implementation: Get terrain metrics for a location
 *
 * NOTE: This is a PLACEHOLDER that returns sample data.
 * In production, this would:
 * 1. Fetch Mapbox Terrain-RGB tiles for the location
 * 2. Sample elevation at center + N/S/E/W points
 * 3. Calculate real slope/aspect from elevation grid
 *
 * To implement real Mapbox integration:
 * - Use Mapbox Static Images API with terrain-rgb style
 * - Or use Mapbox GL JS's queryTerrainElevation() in browser
 * - Parse RGB pixel values and decode elevation
 */
export async function getTerrainMetrics(lat: number, lon: number): Promise<TerrainMetrics> {
  // MOCK DATA - Replace with real Mapbox Terrain-RGB API calls

  // Sample points around center (100m spacing)
  const sampleDist = 0.0009; // ~100m in degrees

  // For now, generate reasonable mock data based on location
  // California elevation ranges: sea level to ~4000m
  // We'll use latitude as a proxy for rough elevation patterns

  const mockElevation = 200 + Math.abs(lat - 37) * 100; // Rough elevation estimate
  const mockSlope = 10 + Math.random() * 20; // 10-30% slope

  // Calculate aspect (mock: based on longitude for variety)
  const mockAspectDeg = (lon * 10) % 360;
  const mockAspect = degreesToCardinal(mockAspectDeg);

  // Mock ridgeline detection
  const mockNearbyRidge = mockSlope > 20 && Math.random() > 0.6;
  const mockRidgeDist = mockNearbyRidge ? 0.5 + Math.random() * 1.5 : undefined;
  const mockRidgeDir = mockNearbyRidge ? degreesToCardinal(Math.random() * 360) : undefined;

  const metrics: TerrainMetrics = {
    elevation: mockElevation,
    slope: mockSlope,
    slopeAngle: Math.atan(mockSlope / 100) * 180 / Math.PI,
    aspect: mockAspect,
    aspectDegrees: mockAspectDeg,
    nearbyRidgeline: mockNearbyRidge,
    ridgelineDistKm: mockRidgeDist,
    ridgelineDirection: mockRidgeDir,
    terrainType: categorizeSlope(mockSlope),
    notes: []
  };

  metrics.notes = generateTerrainNotes(metrics);

  return metrics;
}

/**
 * Calculate fire spread rate adjustment factor based on slope
 * Fire spreads exponentially faster uphill
 *
 * Formula: multiplier = 1 + (slope/100)^2 * 2
 * Examples:
 * - 0% slope: 1.0x (no change)
 * - 20% slope: 1.08x
 * - 30% slope: 1.18x
 * - 50% slope: 1.5x
 */
export function calculateSlopeSpreadMultiplier(slopePercent: number): number {
  return 1 + Math.pow(slopePercent / 100, 2) * 2;
}

/**
 * Determine if terrain presents tactical advantages or hazards
 */
export function assessTerrainTacticalValue(metrics: TerrainMetrics): {
  advantages: string[];
  hazards: string[];
} {
  const advantages: string[] = [];
  const hazards: string[] = [];

  // Ridgeline advantages
  if (metrics.nearbyRidgeline && metrics.ridgelineDistKm && metrics.ridgelineDistKm < 1.5) {
    advantages.push(`Ridgeline ${metrics.ridgelineDistKm.toFixed(1)}km away - natural anchor for control line`);
  }

  // Slope hazards
  if (metrics.slope > 30) {
    hazards.push("Steep uphill slopes - rapid fire spread if fire runs uphill");
    hazards.push("Difficult dozer access on steep terrain");
  }

  if (metrics.slope > 40) {
    hazards.push("Extreme slopes - hand crew safety concern, maintain escape routes");
  }

  // Aspect hazards (south/southwest = drier)
  if (["S", "SW", "SE"].includes(metrics.aspect)) {
    hazards.push(`${metrics.aspect}-facing slope - drier fuels increase fire intensity`);
  }

  // Flat terrain advantages
  if (metrics.terrainType === "flat" || metrics.terrainType === "gentle") {
    advantages.push("Flat to gentle terrain - good dozer access and crew mobility");
  }

  return { advantages, hazards };
}

/**
 * Compare current terrain to terrain keywords in IAP text
 * Returns similarity score (0-100)
 */
export function calculateTerrainSimilarity(
  currentMetrics: TerrainMetrics,
  iapText: string
): number {
  let score = 0;
  const lowerText = iapText.toLowerCase();

  // Slope similarity
  if (currentMetrics.slope > 25 && (lowerText.includes('steep') || lowerText.includes('rugged'))) {
    score += 30;
  } else if (currentMetrics.slope > 15 && lowerText.includes('slope')) {
    score += 20;
  } else if (currentMetrics.slope < 10 && (lowerText.includes('flat') || lowerText.includes('level'))) {
    score += 25;
  }

  // Ridgeline similarity
  if (currentMetrics.nearbyRidgeline && lowerText.includes('ridge')) {
    score += 25;
  }

  // Terrain type keywords
  const terrainKeywords = ['terrain', 'topography', 'elevation', 'canyon', 'valley'];
  const hasTerrainKeywords = terrainKeywords.some(kw => lowerText.includes(kw));
  if (hasTerrainKeywords) {
    score += 15;
  }

  // Aspect/direction keywords
  if (lowerText.includes(currentMetrics.aspect.toLowerCase() + '-facing') ||
      lowerText.includes(currentMetrics.aspect.toLowerCase() + ' facing')) {
    score += 10;
  }

  return Math.min(score, 100);
}
