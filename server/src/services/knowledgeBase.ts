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

// ── Comprehensive multilingual synonym expansion for Gram Sathi ──────────────
const SYNONYMS: Record<string, string[]> = {
  // Financial / Loans
  'loan': ['loan', 'ऋण', 'कर्ज', 'credit', 'kcc', 'udyami', 'finance', 'bank', 'assistance', 'mudra'],
  'ऋण': ['loan', 'कर्ज', 'credit', 'kcc', 'finance', 'bank'],
  'कर्ज': ['loan', 'ऋण', 'credit', 'finance', 'bank'],
  'लोन': ['loan', 'ऋण', 'कर्ज', 'credit', 'finance', 'bank'],
  // Insurance
  'bima': ['insurance', 'bima', 'बीमा', 'pmfby', 'claim', 'fasal'],
  'insurance': ['bima', 'बीमा', 'pmfby', 'claim', 'fasal', 'insurance'],
  'बीमा': ['insurance', 'bima', 'pmfby', 'claim', 'fasal'],
  // Agriculture
  'fasal': ['crop', 'agriculture', 'krishi', 'खेती', 'फसल', 'harvest'],
  'crop': ['fasal', 'agriculture', 'krishi', 'खेती', 'फसल', 'harvest'],
  'फसल': ['crop', 'fasal', 'agriculture', 'krishi', 'खेती', 'bima'],
  'kisan': ['farmer', 'kisan', 'किसान', 'agriculture', 'krishi', 'fasal'],
  'किसान': ['farmer', 'kisan', 'agriculture', 'krishi', 'fasal'],
  'farmer': ['kisan', 'किसान', 'agriculture', 'krishi', 'fasal', 'farmer'],
  // Subsidy
  'subsidy': ['subsidy', 'सब्सिडी', 'अनुदान', 'financial assistance', 'grant', 'concession'],
  'सब्सिडी': ['subsidy', 'अनुदान', 'financial assistance', 'grant'],
  'अनुदान': ['subsidy', 'सब्सिडी', 'financial assistance', 'grant'],
  // Cooperative
  'pacs': ['pacs', 'cooperative', 'credit society', 'पैक्स', 'सहकारी', 'समिति'],
  'पैक्स': ['pacs', 'cooperative', 'credit society', 'सहकारी'],
  'cooperative': ['cooperative', 'sahkari', 'सहकारी', 'samiti', 'society', 'bylaws'],
  'सहकारी': ['cooperative', 'sahkari', 'samiti', 'society', 'pacs'],
  // Farm equipment
  'tractor': ['tractor', 'machinery', 'equipment', 'pump', 'उपकरण', 'मशीन', 'mechanization'],
  'मशीन': ['machinery', 'equipment', 'tractor', 'pump', 'tools'],
  // Dairy / Animal
  'dairy': ['dairy', 'milk', 'milch', 'cow', 'cattle', 'animal husbandry', 'दुग्ध', 'पशु'],
  'पशु': ['animal', 'cattle', 'milch', 'dairy', 'goat', 'bakri', 'livestock'],
  'दुग्ध': ['dairy', 'milk', 'milch', 'cow', 'cattle', 'animal husbandry'],
  // Fishery
  'fishery': ['fishery', 'fish', 'matsya', 'मत्स्य', 'मछली', 'boat'],
  'मछली': ['fish', 'fishery', 'matsya', 'boat', 'marine'],
  // Central schemes
  'pmkisan': ['pm-kisan', 'pmkisan', 'kisan samman', 'सम्मान निधि', 'pm kisan'],
  'kcc': ['kcc', 'kisan credit card', 'loan', 'credit', 'ऋण'],
  'pmfby': ['pmfby', 'fasal bima', 'crop insurance', 'फसल बीमा'],
  'pmay': ['pmay', 'pradhan mantri awas', 'housing', 'आवास', 'house', 'ghar'],
  'mudra': ['mudra', 'pm mudra', 'business loan', 'micro loan', 'व्यापार', 'business'],
  // Education / Students
  'scholarship': ['scholarship', 'छात्रवृत्ति', 'fellowship', 'education', 'student', 'study', 'vidyarthi'],
  'छात्रवृत्ति': ['scholarship', 'fellowship', 'education', 'student', 'study'],
  'student': ['student', 'vidyarthi', 'छात्र', 'scholarship', 'education', 'padhai'],
  'education': ['education', 'scholarship', 'school', 'college', 'study', 'vidya', 'शिक्षा'],
  'शिक्षा': ['education', 'scholarship', 'school', 'college', 'study'],
  // Women
  'women': ['women', 'mahila', 'महिला', 'lady', 'ladies', 'beti', 'girl'],
  'महिला': ['women', 'mahila', 'lady', 'beti', 'girl'],
  'beti': ['girl', 'daughter', 'beti', 'women', 'mahila', 'बेटी'],
  // Senior citizens
  'pension': ['pension', 'old age', 'senior citizen', 'वृद्ध', 'बुजुर्ग', 'elderly', 'retirement'],
  'बुजुर्ग': ['pension', 'old age', 'senior citizen', 'elderly', 'वृद्ध'],
  // Disability
  'disability': ['disability', 'divyang', 'दिव्यांग', 'handicap', 'disabled', 'adip', 'nhfdc'],
  'दिव्यांग': ['disability', 'divyang', 'handicap', 'disabled'],
  // SC/ST/OBC
  'sc': ['scheduled caste', 'sc', 'dalit', 'अनुसूचित जाति', 'harijans'],
  'st': ['scheduled tribe', 'st', 'tribal', 'आदिवासी', 'अनुसूचित जनजाति'],
  'obc': ['obc', 'other backward class', 'पिछड़ा वर्ग'],
  // Certificates / Documents
  'certificate': ['certificate', 'प्रमाण पत्र', 'caste certificate', 'income certificate', 'domicile', 'document'],
  'प्रमाण': ['certificate', 'document', 'proof', 'caste', 'income', 'domicile'],
  'aadhaar': ['aadhaar', 'aadhar', 'uid', 'आधार', 'identity', 'id card'],
  'आधार': ['aadhaar', 'aadhar', 'uid', 'identity', 'id card'],
  'ration': ['ration', 'ration card', 'राशन', 'food security', 'pds', 'annapurna'],
  'राशन': ['ration', 'ration card', 'food security', 'pds'],
  // Employment / Business
  'employment': ['employment', 'job', 'rozgar', 'रोज़गार', 'unemployment', 'mgnregs', 'nrega'],
  'रोज़गार': ['employment', 'job', 'rozgar', 'unemployment', 'nrega'],
  'business': ['business', 'व्यापार', 'enterprise', 'startup', 'mudra', 'msme', 'udyam'],
  'व्यापार': ['business', 'enterprise', 'startup', 'mudra', 'msme'],
  // Housing
  'housing': ['housing', 'awas', 'आवास', 'ghar', 'house', 'pmay', 'shelter'],
  'आवास': ['housing', 'awas', 'ghar', 'house', 'pmay'],
  // Health
  'health': ['health', 'swasthya', 'स्वास्थ्य', 'medical', 'hospital', 'ayushman', 'insurance'],
  'स्वास्थ्य': ['health', 'medical', 'hospital', 'ayushman'],
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

  // Build a structured catalog of all schemes grouped by domain
  const categoryGroups: Record<string, string[]> = {};
  records.forEach(r => {
    const cat = r.category || 'General';
    if (!categoryGroups[cat]) categoryGroups[cat] = [];
    const name = r.title || r.topic || '';
    if (name && categoryGroups[cat].length < 35) {
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

function scoreRecord(record: KBRecord, queryTokens: string[], stateHint?: string): number {
  const title = (record.title || '').toLowerCase();
  const topic = (record.topic || '').toLowerCase();
  const keywords = (record.keywords || '').toLowerCase();
  const question = (record.question || '').toLowerCase();
  const category = (record.category || '').toLowerCase();
  const answer = (record.answer || '').toLowerCase();

  let score = 0;

  for (const qt of queryTokens) {
    if (title.includes(qt)) score += 3.0;
    if (topic.includes(qt)) score += 2.5;
    if (keywords.includes(qt)) score += 2.0;
    if (question.includes(qt)) score += 1.5;
    if (category.includes(qt)) score += 1.0;
    if (answer.includes(qt)) score += 0.8;
  }

  // State-aware boost: if a state is mentioned and the record's answer/keywords match
  if (stateHint && score > 0) {
    const stateLower = stateHint.toLowerCase();
    if (
      answer.includes(stateLower) ||
      keywords.includes(stateLower) ||
      title.includes(stateLower) ||
      question.includes(stateLower)
    ) {
      score += 2.0; // Boost state-specific records
    }
  }

  return score;
}

/**
 * Extracts a state hint from the query (e.g., "Punjab", "UP", "Rajasthan")
 */
function extractStateHint(query: string): string | undefined {
  const stateNames = [
    'punjab', 'haryana', 'himachal pradesh', 'himachal', 'uttarakhand', 'uttar pradesh',
    'up', 'bihar', 'jharkhand', 'rajasthan', 'gujarat', 'maharashtra', 'goa',
    'madhya pradesh', 'mp', 'chhattisgarh', 'west bengal', 'odisha', 'assam',
    'meghalaya', 'manipur', 'nagaland', 'mizoram', 'tripura', 'arunachal pradesh',
    'sikkim', 'telangana', 'andhra pradesh', 'karnataka', 'kerala', 'tamil nadu',
    'delhi', 'jammu', 'kashmir', 'ladakh', 'chandigarh', 'lakshadweep', 'puducherry',
    'andaman', 'nicobar', 'dadra', 'daman', 'diu',
  ];
  const queryLower = query.toLowerCase();
  return stateNames.find(s => queryLower.includes(s));
}

/**
 * Retrieves top matching records and builds a detailed, structured context string for Gemini.
 */
export function retrieveContext(query: string, topN = 8, compact = false): string {
  if (records.length === 0) return '';

  const rawTokens = tokenize(query);
  if (rawTokens.length === 0) return '';

  const expandedTokens = expandTokensWithSynonyms(rawTokens);
  const stateHint = extractStateHint(query);

  const limit = compact ? Math.min(topN, 2) : topN;
  const scored = records
    .map(r => ({ record: r, score: scoreRecord(r, expandedTokens, stateHint) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) {
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
Source Type: ${record.source || 'N/A'}
Official Portal / Source: ${record.url || 'Official Government Portal'}`;
  }).join(compact ? '\n' : '\n\n---\n\n');

  if (compact) {
    return detailedSchemes;
  }

  return `${detailedSchemes}\n\n---\n${cachedCategoryCatalog}`;
}

/**
 * Returns top matching scheme records as structured objects for scheme cards.
 */
export function retrieveSchemeRecords(query: string, topN = 6): KBRecord[] {
  if (records.length === 0) return [];

  const rawTokens = tokenize(query);
  if (rawTokens.length === 0) return [];

  const expandedTokens = expandTokensWithSynonyms(rawTokens);
  const stateHint = extractStateHint(query);

  return records
    .map(r => ({ record: r, score: scoreRecord(r, expandedTokens, stateHint) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(x => x.record);
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
      } else if (language === 'pa') {
        suggestions.push(`${record.title} ਬਾਰੇ ਦੱਸੋ`);
      } else {
        suggestions.push(`Tell me about ${record.title}`);
      }
    }
  }

  // Fallbacks
  if (suggestions.length < 3) {
    if (language === 'hi' || language === 'hi-Latn') {
      const defaults = [
        'मेरे लिए कौन सी सरकारी योजना सही है?',
        'जाति प्रमाण पत्र कैसे बनवाएं?',
        'PM-KISAN योजना की जानकारी दें',
      ];
      for (const d of defaults) {
        if (!suggestions.includes(d) && suggestions.length < 3) suggestions.push(d);
      }
    } else if (language === 'pa') {
      const defaults = [
        'ਮੇਰੇ ਲਈ ਕਿਹੜੀਆਂ ਸਕੀਮਾਂ ਹਨ?',
        'ਜਾਤੀ ਸਰਟੀਫਿਕੇਟ ਕਿਵੇਂ ਬਣਵਾਈਏ?',
        'PM-KISAN ਯੋਜਨਾ ਬਾਰੇ ਦੱਸੋ',
      ];
      for (const d of defaults) {
        if (!suggestions.includes(d) && suggestions.length < 3) suggestions.push(d);
      }
    } else {
      const defaults = [
        'Find government schemes for me',
        'How to get a caste certificate?',
        'What benefits can I get from PM-KISAN?',
      ];
      for (const d of defaults) {
        if (!suggestions.includes(d) && suggestions.length < 3) suggestions.push(d);
      }
    }
  }

  return suggestions.slice(0, 3);
}
