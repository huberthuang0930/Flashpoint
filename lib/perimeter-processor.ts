import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon, Position } from "geojson";

/**
 * Processed perimeter data structure with geometric analysis
 */
export interface ProcessedPerimeter {
  fireId: string;
  fireName: string;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][];
    centroid: [number, number];
  };
  temporal: {
    alarmDate: string;
    containmentDate: string;
    durationHours: number;
  };
  metrics: {
    totalAcres: number;
    perimeterKm: number;
    aspectRatio: number;
    compactness: number;
  };
  directionalExtent: {
    N: number;
    E: number;
    S: number;
    W: number;
    NE: number;
    SE: number;
    SW: number;
    NW: number;
    dominantDirection: number; // degrees 0-360
  };
  growthRate: {
    acresPerHour: number;
    estimatedSpreadRateKmH: number;
  };
}

/**
 * Raw fire feature from query.json
 */
interface RawFireFeature {
  type: "Feature";
  id: number;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  properties: {
    OBJECTID: number;
    YEAR_: number;
    STATE: string;
    AGENCY: string;
    UNIT_ID: string;
    FIRE_NAME: string;
    INC_NUM: string;
    ALARM_DATE: number; // Unix timestamp in milliseconds
    CONT_DATE: number | null; // Unix timestamp in milliseconds
    CAUSE: number;
    C_METHOD: number;
    OBJECTIVE: number;
    GIS_ACRES: number;
    COMMENTS: string | null;
    COMPLEX_NAME: string | null;
    IRWINID: string | null;
    FIRE_NUM: string | null;
    COMPLEX_ID: string | null;
    DECADES: string;
    Shape__Area: number;
    Shape__Length: number;
  };
}

/**
 * Convert Unix timestamp (milliseconds) to ISO date string
 */
function timestampToISO(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Calculate fire duration in hours
 */
function calculateDuration(alarmDate: number, contDate: number): number {
  const durationMs = contDate - alarmDate;
  return durationMs / (1000 * 60 * 60); // Convert to hours
}

/**
 * Normalize MultiPolygon to use the largest polygon
 * (simplification: treat multi-polygon fires as their largest component)
 */
function normalizeGeometry(
  geometry: RawFireFeature["geometry"]
): { type: "Polygon"; coordinates: number[][][] } {
  if (geometry.type === "Polygon") {
    return geometry as { type: "Polygon"; coordinates: number[][][] };
  }

  // MultiPolygon: find the largest polygon by area
  const multiCoords = geometry.coordinates as number[][][][];
  const polygons = multiCoords.map((coords) =>
    turf.polygon(coords)
  );

  const areas = polygons.map((poly) => turf.area(poly));
  const maxIndex = areas.indexOf(Math.max(...areas));

  return {
    type: "Polygon",
    coordinates: multiCoords[maxIndex],
  };
}

/**
 * Calculate directional extent from centroid
 * Measures distance from centroid in 8 cardinal directions
 */
function calculateDirectionalExtent(
  polygon: Feature<Polygon>,
  centroid: Position
): {
  N: number;
  E: number;
  S: number;
  W: number;
  NE: number;
  SE: number;
  SW: number;
  NW: number;
  dominantDirection: number;
} {
  const [centLon, centLat] = centroid;

  // Get all coordinates from the polygon (outer ring only)
  const coords = polygon.geometry.coordinates[0];

  // Define the 8 directions (in degrees)
  const directions = {
    N: 0,
    NE: 45,
    E: 90,
    SE: 135,
    S: 180,
    SW: 225,
    W: 270,
    NW: 315,
  };

  // Calculate extent in each direction
  const extents: Record<string, number> = {};
  let maxExtent = 0;
  let dominantDirection = 0;

  for (const [dirName, dirBearing] of Object.entries(directions)) {
    let maxDistInDir = 0;

    // Find the furthest point in this direction (±22.5 degrees tolerance)
    for (const coord of coords) {
      const [lon, lat] = coord;
      const bearing = turf.bearing([centLon, centLat], [lon, lat]);
      const normalizedBearing = (bearing + 360) % 360;

      // Check if point is within ±22.5 degrees of this direction
      const angleDiff = Math.min(
        Math.abs(normalizedBearing - dirBearing),
        Math.abs(normalizedBearing - dirBearing + 360),
        Math.abs(normalizedBearing - dirBearing - 360)
      );

      if (angleDiff <= 22.5) {
        const distance = turf.distance([centLon, centLat], [lon, lat], {
          units: "kilometers",
        });
        maxDistInDir = Math.max(maxDistInDir, distance);
      }
    }

    extents[dirName] = maxDistInDir;

    // Track dominant direction (furthest point overall)
    if (maxDistInDir > maxExtent) {
      maxExtent = maxDistInDir;
      dominantDirection = dirBearing;
    }
  }

  return {
    N: extents.N,
    E: extents.E,
    S: extents.S,
    W: extents.W,
    NE: extents.NE,
    SE: extents.SE,
    SW: extents.SW,
    NW: extents.NW,
    dominantDirection,
  };
}

/**
 * Calculate aspect ratio (elongation measure)
 * Returns max_extent / min_extent
 */
function calculateAspectRatio(directionalExtent: Record<string, number>): number {
  const extents = [
    directionalExtent.N,
    directionalExtent.E,
    directionalExtent.S,
    directionalExtent.W,
    directionalExtent.NE,
    directionalExtent.SE,
    directionalExtent.SW,
    directionalExtent.NW,
  ].filter((e) => e > 0);

  if (extents.length === 0) return 1;

  const maxExtent = Math.max(...extents);
  const minExtent = Math.min(...extents);

  return minExtent > 0 ? maxExtent / minExtent : maxExtent;
}

/**
 * Calculate compactness (shape regularity)
 * Uses isoperimetric quotient: 4π * area / perimeter²
 * Returns 1.0 for perfect circle, lower for irregular shapes
 */
function calculateCompactness(areaKm2: number, perimeterKm: number): number {
  if (perimeterKm === 0) return 0;
  return (4 * Math.PI * areaKm2) / (perimeterKm * perimeterKm);
}

/**
 * Convert acres to square kilometers
 */
function acresToKm2(acres: number): number {
  return acres * 0.00404686; // 1 acre = 0.00404686 km²
}

/**
 * Estimate spread rate from area growth
 * Assumes circular growth: radius = sqrt(area/π)
 */
function estimateSpreadRate(acres: number, durationHours: number): number {
  if (durationHours === 0) return 0;

  const areaKm2 = acresToKm2(acres);
  const finalRadius = Math.sqrt(areaKm2 / Math.PI);

  // Assume fire started as point source
  return finalRadius / durationHours;
}

/**
 * Process a single fire feature from query.json
 */
export function processFirePerimeter(
  feature: RawFireFeature
): ProcessedPerimeter | null {
  try {
    const { properties, geometry } = feature;

    // Validate required fields
    if (
      !properties.FIRE_NAME ||
      !properties.ALARM_DATE ||
      !properties.CONT_DATE ||
      properties.GIS_ACRES === undefined
    ) {
      return null; // Skip incomplete records
    }

    // Calculate duration
    const durationHours = calculateDuration(
      properties.ALARM_DATE,
      properties.CONT_DATE
    );

    // Skip fires with invalid duration
    if (durationHours <= 0 || durationHours > 8760) {
      // > 1 year is likely data error
      return null;
    }

    // Normalize geometry (handle MultiPolygon)
    const normalizedGeom = normalizeGeometry(geometry);
    const polygon = turf.polygon(normalizedGeom.coordinates);

    // Calculate centroid
    const centroidFeature = turf.centroid(polygon);
    const centroid = centroidFeature.geometry.coordinates as [number, number];

    // Calculate perimeter length
    const perimeterKm = turf.length(polygon, { units: "kilometers" });

    // Calculate area in km²
    const areaKm2 = acresToKm2(properties.GIS_ACRES);

    // Calculate directional extent
    const directionalExtent = calculateDirectionalExtent(polygon, centroid);

    // Calculate aspect ratio
    const aspectRatio = calculateAspectRatio(directionalExtent);

    // Calculate compactness
    const compactness = calculateCompactness(areaKm2, perimeterKm);

    // Calculate growth rates
    const acresPerHour = properties.GIS_ACRES / durationHours;
    const estimatedSpreadRateKmH = estimateSpreadRate(
      properties.GIS_ACRES,
      durationHours
    );

    // Generate fire ID
    const fireId =
      properties.IRWINID ||
      `cal_fire_${properties.YEAR_}_${properties.OBJECTID}`;

    return {
      fireId,
      fireName: properties.FIRE_NAME,
      geometry: {
        type: normalizedGeom.type,
        coordinates: normalizedGeom.coordinates,
        centroid,
      },
      temporal: {
        alarmDate: timestampToISO(properties.ALARM_DATE),
        containmentDate: timestampToISO(properties.CONT_DATE),
        durationHours,
      },
      metrics: {
        totalAcres: properties.GIS_ACRES,
        perimeterKm,
        aspectRatio,
        compactness,
      },
      directionalExtent: {
        ...directionalExtent,
      },
      growthRate: {
        acresPerHour,
        estimatedSpreadRateKmH,
      },
    };
  } catch (error) {
    console.error(`Error processing fire feature ${feature.id}:`, error);
    return null;
  }
}

/**
 * Process all fire features from query.json
 */
export function processAllPerimeters(
  features: RawFireFeature[]
): {
  processed: ProcessedPerimeter[];
  stats: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
} {
  const processed: ProcessedPerimeter[] = [];
  let failed = 0;
  let skipped = 0;

  for (const feature of features) {
    const result = processFirePerimeter(feature);
    if (result) {
      processed.push(result);
    } else {
      // Check if skipped due to missing data or failed due to error
      if (
        !feature.properties.FIRE_NAME ||
        !feature.properties.ALARM_DATE ||
        !feature.properties.CONT_DATE
      ) {
        skipped++;
      } else {
        failed++;
      }
    }
  }

  return {
    processed,
    stats: {
      total: features.length,
      successful: processed.length,
      failed,
      skipped,
    },
  };
}
