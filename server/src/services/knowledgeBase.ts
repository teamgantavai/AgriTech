import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

export interface KBRecord {
  id?: string;
  category?: string;
  topic?: string;
  title?: string;
  question?: string;
  answer?: string;
  keywords?: string;
  source?: string;
  url?: string;
  [key: string]: string | undefined;
}

interface KBStats {
  totalRecords: number;
  categories: string[];
}

let records: KBRecord[] = [];
let headers: string[] = [];
let stats: KBStats = { totalRecords: 0, categories: [] };
let cachedCategoryCatalog = '';

const CSV_PATH = path.resolve(__dirname, '../../../data/knowledge.csv');

// Multilingual & agricultural synonym expansion
const SYNONYMS: Record<string, string[]> = {
  'loan': ['loan', 'ऋण', 'कर्ज', 'credit', 'kcc', 'udyami', 'finance', 'bank', 'assistance'],
  'ऋण': ['loan', 'कर्ज', 'credit', 'kcc', 'udyami', 'finance', 'bank'],
  'कर्ज': ['loan', 'ऋण', 'credit', 'kcc', 'udyami', 'finance', 'bank'],
  'लोन': ['loan', 'ऋण', 'कर्ज', 'credit', 'kcc', 'udyami', 'finance', 'bank'],
  'bima': ['insurance', 'bima', 'बीमा', 'pmfby', 'claim', 'fasal'],
  'insurance': ['bima', 'बीमा', 'pmfby', 'claim', 'fasal', 'insurance'],
  'बीमा': ['insurance', 'bima', 'pmfby', 'claim', 'fasal'],
  'fasal': ['crop', 'agriculture', 'krishi', 'खेती', 'फसल', 'harvest'],
  'crop': ['fasal', 'agriculture', 'krishi', 'खेती', 'फसल', 'harvest'],
  'फसल': ['crop', 'fasal', 'agriculture', 'krishi', 'खेती', 'bima'],
  'subsidy': ['subsidy', 'सब्सिडी', 'अनुदान', 'financial assistance', 'grant', 'concession'],
  'सब्सिडी': ['subsidy', 'अनुदान', 'financial assistance', 'grant'],
  'अनुदान': ['subsidy', 'सब्सिडी', 'financial assistance', 'grant'],
  'pacs': ['pacs', 'cooperative', 'credit society', 'पैक्स', 'सहकारी', 'समिति'],
  'पैक्स': ['pacs', 'cooperative', 'credit society', 'सहकारी'],
  'cooperative': ['cooperative', 'sahkari', 'सहकारी', 'samiti', 'society', 'bylaws'],
  'सहकारी': ['cooperative', 'sahkari', 'samiti', 'society', 'pacs'],
  'dairy': ['dairy', 'milk', 'milch', 'cow', 'cattle', 'animal husbandry', 'दुग्ध', 'पशु'],
  'पशु': ['animal', 'cattle', 'milch', 'dairy', 'goat', 'bakri', 'livestock'],
  'दुग्ध': ['dairy', 'milk', 'milch', 'cow', 'cattle', 'animal husbandry'],
  'tractor': ['tractor', 'machinery', 'equipment', 'pump', 'उपकरण', 'मशीन', 'mechanization'],
  'मशीन': ['machinery', 'equipment', 'tractor', 'pump', 'tools'],
  'fishery': ['fishery', 'fish', 'matsya', 'मत्स्य', 'मछली', 'boat'],
  'मछली': ['fish', 'fishery', 'matsya', 'boat', 'marine'],
  'pmkisan': ['pm-kisan', 'pmkisan', 'kisan samman', 'सम्मान निधि'],
  'kcc': ['kcc', 'kisan credit card', 'loan', 'credit', 'ऋण'],
};

export async function initKnowledgeBase(): Promise<void> {
  if (!fs.existsSync(CSV_PATH)) {
    console.warn(`⚠️  knowledge.csv not found at ${CSV_PATH}`);
    records = [];
    stats = { totalRecords: 0, categories: [] };
    return;
  }

  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as KBRecord[];

  headers = records.length > 0 ? Object.keys(records[0]) : [];

  const categorySet = new Set<string>();
  records.forEach(r => {
    if (r.category) categorySet.add(r.category.trim());
  });

  const categories = Array.from(categorySet);
  stats = {
    totalRecords: records.length,
    categories,
  };

  // Build a structured catalog of all schemes grouped by domain for Gemini's comprehensive awareness
  const categoryGroups: Record<string, string[]> = {};
  records.forEach(r => {
    const cat = r.category || 'General';
    if (!categoryGroups[cat]) categoryGroups[cat] = [];
    const name = r.title || r.topic || '';
    if (name && categoryGroups[cat].length < 35) { // concise representative catalog per category
      categoryGroups[cat].push(name);
    }
  });

  let catalogText = '=== COMPREHENSIVE SCHEMES & DOMAINS DIRECTORY (870+ VERIFIED GOVERNMENT SCHEMES) ===\n';
  for (const [cat, schemeNames] of Object.entries(categoryGroups)) {
    catalogText += `\n[${cat.toUpperCase()}] (${schemeNames.length}+ schemes):\n- ${schemeNames.join('\n- ')}\n`;
  }
  cachedCategoryCatalog = catalogText;
}

export function getKBStats(): KBStats {
  return stats;
}

export function getAllRecords(): KBRecord[] {
  return records;
}

export function getKnowledgeCatalog(): string {
  return cachedCategoryCatalog;
}

// ── Tokenization and Keyword Scoring ─────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F\u0A00-\u0A7F\u0980-\u09FF\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function expandTokensWithSynonyms(tokens: string[]): string[] {
  const expanded = new Set<string>(tokens);
  for (const t of tokens) {
    if (SYNONYMS[t]) {
      SYNONYMS[t].forEach(s => expanded.add(s.toLowerCase()));
    }
  }
  return Array.from(expanded);
}

function scoreRecord(record: KBRecord, queryTokens: string[]): number {
  const title = (record.title || '').toLowerCase();
  const topic = (record.topic || '').toLowerCase();
  const keywords = (record.keywords || '').toLowerCase();
  const question = (record.question || '').toLowerCase();
  const category = (record.category || '').toLowerCase();
  const answer = (record.answer || '').toLowerCase();

  let score = 0;

  for (const qt of queryTokens) {
    if (title.includes(qt)) score += 3.0; // Strongest match on title
    if (topic.includes(qt)) score += 2.5;
    if (keywords.includes(qt)) score += 2.0;
    if (question.includes(qt)) score += 1.5;
    if (category.includes(qt)) score += 1.0;
    if (answer.includes(qt)) score += 0.8;
  }

  return score;
}

/**
 * Retrieves top matching records and builds a detailed, structured context string for Gemini.
 */
export function retrieveContext(query: string, topN = 8, compact = false): string {
  if (records.length === 0) return '';

  const rawTokens = tokenize(query);
  if (rawTokens.length === 0) return '';

  const expandedTokens = expandTokensWithSynonyms(rawTokens);

  const limit = compact ? Math.min(topN, 2) : topN;
  const scored = records
    .map(r => ({ record: r, score: scoreRecord(r, expandedTokens) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) {
    // In compact voice mode, don't dump catalog to save tokens and eliminate latency
    return compact ? '' : cachedCategoryCatalog;
  }

  const detailedSchemes = scored.map(({ record }, idx) => {
    if (compact) {
      return `[SCHEME ${idx + 1}]: Title: ${record.title || record.topic || 'N/A'} | Benefits: ${(record.answer || '').slice(0, 250)}`;
    }
    return `[SCHEME ${idx + 1}]:
Title: ${record.title || record.topic || 'N/A'}
Category: ${record.category || 'N/A'}
Topic: ${record.topic || 'N/A'}
Summary / Question: ${record.question || 'N/A'}
Official Details & Benefits: ${record.answer || 'N/A'}
Keywords: ${record.keywords || 'N/A'}
Official Portal / Source: ${record.url || record.source || 'Official Government Portal'}`;
  }).join(compact ? '\n' : '\n\n---\n\n');

  if (compact) {
    return detailedSchemes;
  }

  // Combine top matching scheme details with the overarching catalog summary
  return `${detailedSchemes}\n\n---\n${cachedCategoryCatalog}`;
}

/**
 * Extracts relevant follow-up suggestions grounded in the matched CSV schemes.
 */
export function getSuggestionsForQuery(query: string, language: string = 'hi'): string[] {
  const rawTokens = tokenize(query);
  const expandedTokens = expandTokensWithSynonyms(rawTokens);

  const scored = records
    .map(r => ({ record: r, score: scoreRecord(r, expandedTokens) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const suggestions: string[] = [];

  for (const { record } of scored) {
    if (record.title && suggestions.length < 3) {
      if (language === 'hi' || language === 'hi-Latn') {
        suggestions.push(`${record.title} के बारे में बताएं`);
      } else {
        suggestions.push(`Tell me about ${record.title}`);
      }
    }
  }

  // Fallbacks if not enough matches
  if (suggestions.length < 3) {
    if (language === 'hi' || language === 'hi-Latn') {
      const defaults = [
        'PMFBY फसल बीमा में क्लेम कैसे करें?',
        'KCC (किसान क्रेडिट कार्ड) लोन के नियम क्या हैं?',
        'PACS समिति की सदस्यता कैसे लें?',
      ];
      for (const d of defaults) {
        if (!suggestions.includes(d) && suggestions.length < 3) suggestions.push(d);
      }
    } else {
      const defaults = [
        'How to apply for PMFBY crop insurance claim?',
        'What are the eligibility criteria for KCC loans?',
        'What services does a PACS cooperative provide?',
      ];
      for (const d of defaults) {
        if (!suggestions.includes(d) && suggestions.length < 3) suggestions.push(d);
      }
    }
  }

  return suggestions.slice(0, 3);
}
