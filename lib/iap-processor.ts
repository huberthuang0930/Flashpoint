/**
 * IAP (Incident Action Plan) processing logic
 * Extracted from scripts/process-iaps.ts for reusability and testability
 */

import { readFileSync } from "fs";
import type { IAPData, IAPSection } from "./types";

// Dynamic import for pdf-parse (ESM module)
let pdfParse: any;

/**
 * Extract text from a PDF file
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  if (!pdfParse) {
    pdfParse = (await import("pdf-parse")).default;
  }

  const dataBuffer = readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

/**
 * Extract objectives from ICS-202 content
 */
export function extractObjectives(content: string): string[] {
  const objectives: string[] = [];

  // Look for numbered objectives (1., 2., etc.) or bullet points
  const objectiveMatches = content.match(/(?:^|\n)\s*(?:\d+\.|[•\-])\s*(.+?)(?=\n|$)/gm);
  if (objectiveMatches) {
    objectiveMatches.forEach(match => {
      const cleaned = match.replace(/^\s*(?:\d+\.|[•\-])\s*/, '').trim();
      if (cleaned.length > 10 && cleaned.length < 200) {
        objectives.push(cleaned);
      }
    });
  }

  return objectives.slice(0, 5); // Limit to 5 objectives
}

/**
 * Extract resources from ICS-204 content
 */
export function extractResources(content: string): string[] {
  const resources: string[] = [];

  // Look for common resource keywords
  const resourcePatterns = [
    /(?:engine|dozer|helicopter|tanker|crew)\s*\d+/gi,
    /(?:type\s*[1-3]\s*(?:engine|dozer|helicopter))/gi,
    /(?:hand crew|strike team|task force)/gi
  ];

  resourcePatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (!resources.includes(match.toLowerCase())) {
          resources.push(match);
        }
      });
    }
  });

  return resources.slice(0, 10); // Limit to 10 resources
}

/**
 * Extract air tactics from ICS-220 content
 */
export function extractAirTactics(content: string): string[] {
  const tactics: string[] = [];

  // Look for air operation keywords
  const tacticKeywords = ['drop', 'water', 'retardant', 'bucket', 'recon', 'surveillance', 'patrol'];
  const lines = content.split('\n');

  lines.forEach(line => {
    if (tacticKeywords.some(keyword => line.toLowerCase().includes(keyword)) && line.length > 20 && line.length < 150) {
      tactics.push(line.trim());
    }
  });

  return tactics.slice(0, 5); // Limit to 5 tactics
}

/**
 * Parse IAP sections from extracted text using regex patterns
 */
export function parseIAPSections(text: string): IAPSection[] {
  const sections: IAPSection[] = [];

  // ICS-202 (Incident Objectives)
  const ics202Match = text.match(/(?:ICS[\s-]?202|INCIDENT OBJECTIVES)[\s\S]{0,2000}?(?=ICS[\s-]?20[3-9]|$)/i);
  if (ics202Match) {
    const content = ics202Match[0].trim();
    sections.push({
      type: "ICS-202",
      content: content.substring(0, 2000), // Limit to 2000 chars
      extractedData: {
        objectives: extractObjectives(content)
      }
    });
  }

  // ICS-203 (Organization Assignment)
  const ics203Match = text.match(/(?:ICS[\s-]?203|ORGANIZATION ASSIGNMENT)[\s\S]{0,2000}?(?=ICS[\s-]?20[4-9]|$)/i);
  if (ics203Match) {
    sections.push({
      type: "ICS-203",
      content: ics203Match[0].trim().substring(0, 2000)
    });
  }

  // ICS-204 (Division/Assignment List)
  const ics204Match = text.match(/(?:ICS[\s-]?204|DIVISION.*ASSIGNMENT|ASSIGNMENT LIST)[\s\S]{0,2000}?(?=ICS[\s-]?20[5-9]|$)/i);
  if (ics204Match) {
    const content = ics204Match[0].trim();
    sections.push({
      type: "ICS-204",
      content: content.substring(0, 2000),
      extractedData: {
        resources: extractResources(content)
      }
    });
  }

  // ICS-205 (Communications)
  const ics205Match = text.match(/(?:ICS[\s-]?205|COMMUNICATIONS)[\s\S]{0,1500}?(?=ICS[\s-]?20[6-9]|$)/i);
  if (ics205Match) {
    sections.push({
      type: "ICS-205",
      content: ics205Match[0].trim().substring(0, 1500)
    });
  }

  // ICS-220 (Air Operations)
  const ics220Match = text.match(/(?:ICS[\s-]?220|AIR OPERATIONS)[\s\S]{0,2000}?(?=ICS[\s-]?22[1-9]|$)/i);
  if (ics220Match) {
    const content = ics220Match[0].trim();
    sections.push({
      type: "ICS-220",
      content: content.substring(0, 2000),
      extractedData: {
        airTactics: extractAirTactics(content)
      }
    });
  }

  // If no sections found, add full text as general section
  if (sections.length === 0) {
    sections.push({
      type: "general",
      content: text.substring(0, 3000)
    });
  }

  return sections;
}

/**
 * Extract metadata from filename and first page text
 */
export function extractMetadata(filename: string, text: string): Partial<IAPData> {
  const metadata: Partial<IAPData> = {
    location: { state: "California" }
  };

  // Extract incident name from filename
  const nameMatch = filename.match(/^(.+?)\.pdf$/i);
  if (nameMatch) {
    let incidentName = nameMatch[1]
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2');

    // Special case handling for known fire names
    if (incidentName.toLowerCase().includes('campfire')) {
      incidentName = 'Camp Fire';
    } else if (incidentName.toLowerCase().includes('lnu')) {
      incidentName = 'LNU Lightning Complex';
    }

    metadata.incidentName = incidentName;
  }

  // Extract date (look for patterns like YYYY-MM-DD or MM/DD/YYYY)
  const dateMatch = text.match(/(?:date|prepared)[\s:]*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);
  if (dateMatch) {
    metadata.dateCreated = dateMatch[1];
  }

  // Extract county
  const countyMatch = text.match(/(Butte|Shasta|Sonoma|Napa|Los Angeles|San Diego|Ventura)\s*County/i);
  if (countyMatch) {
    metadata.location!.county = countyMatch[1];
  }

  // Extract acres
  const acresMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*acres?/i);
  if (acresMatch) {
    const acres = parseInt(acresMatch[1].replace(/,/g, ''));
    if (!isNaN(acres)) {
      metadata.conditions = { acres };
    }
  }

  return metadata;
}

/**
 * Extract tactical lessons from IAP content
 */
export function extractTacticalLessons(text: string, sections: IAPSection[]): string[] {
  const lessons: string[] = [];

  // Look for tactical keywords in objectives and assignments
  const tacticalKeywords = [
    'indirect attack',
    'direct attack',
    'dozer line',
    'structure protection',
    'air support',
    'helicopter',
    'hand line',
    'anchor point',
    'flank',
    'backfire',
    'burnout'
  ];

  const relevantSections = sections.filter(s =>
    s.type === 'ICS-202' || s.type === 'ICS-204' || s.type === 'ICS-220'
  );

  relevantSections.forEach(section => {
    const sentences = section.content.match(/[^.!?]+[.!?]+/g) || [];
    sentences.forEach(sentence => {
      if (tacticalKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        const cleaned = sentence.trim();
        if (cleaned.length > 30 && cleaned.length < 200 && !lessons.includes(cleaned)) {
          lessons.push(cleaned);
        }
      }
    });
  });

  return lessons.slice(0, 5); // Limit to 5 lessons
}

/**
 * Determine fuel type from text content
 */
export function inferFuelType(text: string): "grass" | "brush" | "mixed" | "chaparral" | undefined {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('grass') && !lowerText.includes('brush')) {
    return 'grass';
  } else if (lowerText.includes('chaparral')) {
    return 'chaparral';
  } else if (lowerText.includes('brush') || lowerText.includes('shrub')) {
    return 'brush';
  } else if (lowerText.includes('mixed') || (lowerText.includes('grass') && lowerText.includes('brush'))) {
    return 'mixed';
  }

  return undefined;
}

/**
 * Process a single IAP PDF file and return structured data
 */
export async function processIAPFile(filePath: string, filename: string): Promise<IAPData> {
  // Extract text
  const text = await extractTextFromPDF(filePath);

  // Parse sections
  const sections = parseIAPSections(text);

  // Extract metadata
  const metadata = extractMetadata(filename, text);

  // Extract tactical lessons
  const tacticalLessons = extractTacticalLessons(text, sections);

  // Infer fuel type
  const fuelType = inferFuelType(text);

  // Generate ID
  const id = `iap_${filename.replace('.pdf', '').toLowerCase().replace(/\s+/g, '_')}`;

  const iapData: IAPData = {
    id,
    incidentName: metadata.incidentName || filename.replace('.pdf', ''),
    dateCreated: metadata.dateCreated || 'unknown',
    location: metadata.location!,
    conditions: {
      ...metadata.conditions,
      fuel: fuelType
    },
    sections,
    tacticalLessons,
    rawText: text.substring(0, 5000) // Store first 5000 chars as backup
  };

  return iapData;
}

/**
 * Process result for a single IAP file
 */
export interface ProcessResult {
  success: boolean;
  filename: string;
  data?: IAPData;
  error?: string;
}

/**
 * Process multiple IAP files
 */
export async function processIAPFiles(
  files: { path: string; name: string }[],
  onProgress?: (current: number, total: number, filename: string) => void
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (onProgress) {
      onProgress(i + 1, files.length, file.name);
    }

    try {
      const data = await processIAPFile(file.path, file.name);
      results.push({
        success: true,
        filename: file.name,
        data
      });
    } catch (error) {
      results.push({
        success: false,
        filename: file.name,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
}
