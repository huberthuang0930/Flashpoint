#!/usr/bin/env tsx

/**
 * Preprocessing script to extract historical fire perimeter data from query.json
 * Generates processed data files for runtime use
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { processAllPerimeters } from "../lib/perimeter-processor";
import type { ProcessedPerimeter } from "../lib/perimeter-processor";

// File paths
const QUERY_JSON_PATH = join(process.cwd(), "query.json");
const OUTPUT_DIR = join(process.cwd(), "data", "historical");
const PROCESSED_OUTPUT = join(OUTPUT_DIR, "perimeters-processed.json");

interface QueryJsonData {
  type: "FeatureCollection";
  properties: {
    exceededTransferLimit: boolean;
  };
  features: any[];
}

/**
 * Main processing function
 */
function main() {
  console.log("🔥 Wildfire Perimeter Preprocessor");
  console.log("=====================================\n");

  // Step 1: Load query.json
  console.log("📂 Loading query.json...");
  let queryData: QueryJsonData;

  try {
    const rawData = readFileSync(QUERY_JSON_PATH, "utf-8");
    queryData = JSON.parse(rawData);
    console.log(`   ✓ Loaded ${queryData.features.length} fire features\n`);
  } catch (error) {
    console.error("❌ Error loading query.json:", error);
    process.exit(1);
  }

  // Step 2: Process all perimeters
  console.log("⚙️  Processing fire perimeters...");
  const startTime = Date.now();

  const { processed, stats } = processAllPerimeters(queryData.features);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`   ✓ Processing complete in ${duration}s\n`);

  // Step 3: Display statistics
  console.log("📊 Processing Statistics:");
  console.log(`   Total features:     ${stats.total}`);
  console.log(`   Successfully processed: ${stats.successful} (${((stats.successful / stats.total) * 100).toFixed(1)}%)`);
  console.log(`   Skipped (incomplete): ${stats.skipped}`);
  console.log(`   Failed (errors):    ${stats.failed}\n`);

  // Step 4: Analyze processed data
  console.log("📈 Data Analysis:");

  const totalAcres = processed.reduce((sum, p) => sum + p.metrics.totalAcres, 0);
  const avgAcres = totalAcres / processed.length;
  const avgDuration = processed.reduce((sum, p) => sum + p.temporal.durationHours, 0) / processed.length;
  const avgGrowthRate = processed.reduce((sum, p) => sum + p.growthRate.acresPerHour, 0) / processed.length;

  console.log(`   Total acreage:      ${totalAcres.toLocaleString()} acres`);
  console.log(`   Average fire size:  ${avgAcres.toFixed(1)} acres`);
  console.log(`   Average duration:   ${avgDuration.toFixed(1)} hours`);
  console.log(`   Average growth rate: ${avgGrowthRate.toFixed(2)} acres/hour\n`);

  // Identify outliers (largest fires)
  const largest = [...processed]
    .sort((a, b) => b.metrics.totalAcres - a.metrics.totalAcres)
    .slice(0, 5);

  console.log("🔥 Largest Fires:");
  largest.forEach((fire, i) => {
    console.log(`   ${i + 1}. ${fire.fireName}: ${fire.metrics.totalAcres.toLocaleString()} acres`);
  });
  console.log();

  // Step 5: Ensure output directory exists
  try {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  } catch (error) {
    console.error("❌ Error creating output directory:", error);
    process.exit(1);
  }

  // Step 6: Write processed data
  console.log("💾 Writing output files...");

  try {
    // Write full processed data
    writeFileSync(
      PROCESSED_OUTPUT,
      JSON.stringify({ fires: processed, processedAt: new Date().toISOString(), stats }, null, 2)
    );

    const fileSize = (Buffer.byteLength(JSON.stringify({ fires: processed, stats })) / 1024 / 1024).toFixed(2);
    console.log(`   ✓ ${PROCESSED_OUTPUT}`);
    console.log(`     (${fileSize} MB, ${processed.length} fires)\n`);
  } catch (error) {
    console.error("❌ Error writing output files:", error);
    process.exit(1);
  }

  // Step 7: Summary
  console.log("✅ Preprocessing complete!");
  console.log(`   Output: ${PROCESSED_OUTPUT}`);
  console.log(`   Ready for pattern matching and growth calibration.\n`);
}

// Run main function
try {
  main();
} catch (error) {
  console.error("❌ Fatal error:", error);
  process.exit(1);
}
