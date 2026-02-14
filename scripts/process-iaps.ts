#!/usr/bin/env tsx

/**
 * Preprocessing script to extract IAP (Incident Action Plan) data from PDF files
 * Generates structured JSON data for runtime use
 */

import { writeFileSync, readdirSync } from "fs";
import { join } from "path";
import type { IAPData } from "../lib/types";
import { processIAPFile } from "../lib/iap-processor";

// File paths
const IAP_DIR = join(process.cwd(), "IAP");
const OUTPUT_DIR = join(process.cwd(), "data", "iap");
const OUTPUT_FILE = join(OUTPUT_DIR, "iap-data.json");

/**
 * Main processing function
 */
async function main() {
  console.log("📋 IAP (Incident Action Plan) Preprocessor");
  console.log("==========================================\n");

  // Step 1: Find all PDF files
  console.log("📂 Finding PDF files in IAP directory...");
  let pdfFiles: string[];

  try {
    const allFiles = readdirSync(IAP_DIR);
    pdfFiles = allFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
    console.log(`   ✓ Found ${pdfFiles.length} PDF files\n`);
  } catch (error) {
    console.error("❌ Error reading IAP directory:", error);
    process.exit(1);
  }

  // Step 2: Process all IAP files
  console.log("⚙️  Processing IAP PDFs...");
  const startTime = Date.now();

  const processedIAPs: IAPData[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const filename of pdfFiles) {
    const filePath = join(IAP_DIR, filename);

    try {
      console.log(`   Processing ${filename}...`);
      const iapData = await processIAPFile(filePath, filename);
      console.log(`   ✓ Extracted ${iapData.sections.length} sections, ${iapData.tacticalLessons.length} lessons`);
      processedIAPs.push(iapData);
      successCount++;
    } catch (error) {
      console.error(`   ✗ Error processing ${filename}:`, error);
      failCount++;
    }
  }

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n   ✓ Processed ${successCount} IAPs successfully`);
  if (failCount > 0) {
    console.log(`   ✗ Failed to process ${failCount} IAPs`);
  }
  console.log(`   ⏱  Completed in ${elapsedTime}s\n`);

  // Step 3: Write output
  console.log("💾 Writing output file...");

  const output = {
    iaps: processedIAPs,
    processedAt: new Date().toISOString(),
    stats: {
      total: pdfFiles.length,
      successful: successCount,
      failed: failCount,
      totalSections: processedIAPs.reduce((sum, iap) => sum + iap.sections.length, 0),
      totalLessons: processedIAPs.reduce((sum, iap) => sum + iap.tacticalLessons.length, 0)
    }
  };

  try {
    writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8");
    console.log(`   ✓ Wrote ${OUTPUT_FILE}`);
    console.log(`   ✓ Total sections: ${output.stats.totalSections}`);
    console.log(`   ✓ Total lessons: ${output.stats.totalLessons}`);
  } catch (error) {
    console.error("❌ Error writing output:", error);
    process.exit(1);
  }

  console.log("\n✅ IAP processing complete!");
}

// Run the script
main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
