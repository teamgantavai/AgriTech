export type LanguageCode =
  | 'hi' | 'en' | 'hi-Latn' | 'pa' | 'bn' | 'mr' | 'gu'
  | 'ta' | 'te' | 'kn' | 'ml' | 'or' | 'as' | 'ur' | 'unknown';

export interface DetectedLanguage {
  code: LanguageCode;
  displayName: string;
  confidence: 'high' | 'medium' | 'low';
}

// Unicode range checks
const UNICODE_RANGES: Array<{ code: LanguageCode; displayName: string; ranges: [number, number][] }> = [
  { code: 'hi',  displayName: 'हिन्दी',    ranges: [[0x0900, 0x097F]] },
  { code: 'pa',  displayName: 'ਪੰਜਾਬੀ',   ranges: [[0x0A00, 0x0A7F]] },
  { code: 'bn',  displayName: 'বাংলা',     ranges: [[0x0980, 0x09FF]] },
  { code: 'mr',  displayName: 'मराठी',     ranges: [[0x0900, 0x097F]] }, // Devanagari (overlap with Hindi)
  { code: 'gu',  displayName: 'ગુજરાતી',  ranges: [[0x0A80, 0x0AFF]] },
  { code: 'or',  displayName: 'ଓଡ଼ିଆ',    ranges: [[0x0B00, 0x0B7F]] },
  { code: 'ta',  displayName: 'தமிழ்',    ranges: [[0x0B80, 0x0BFF]] },
  { code: 'te',  displayName: 'తెలుగు',   ranges: [[0x0C00, 0x0C7F]] },
  { code: 'kn',  displayName: 'ಕನ್ನಡ',   ranges: [[0x0C80, 0x0CFF]] },
  { code: 'ml',  displayName: 'മലയാളം',  ranges: [[0x0D00, 0x0D7F]] },
  { code: 'as',  displayName: 'অসমীয়া',  ranges: [[0x0980, 0x09FF]] }, // Bengali script
  { code: 'ur',  displayName: 'اردو',     ranges: [[0x0600, 0x06FF]] },
];

// Hinglish indicators — common Hindi words in Roman script
const HINGLISH_KEYWORDS = [
  'kya', 'hai', 'hain', 'mein', 'me', 'ka', 'ki', 'ke', 'se', 'ko', 'ho',
  'kaise', 'kab', 'kahan', 'kyun', 'nahi', 'nahin', 'bhi', 'aur', 'ya',
  'agar', 'toh', 'tab', 'jab', 'yeh', 'woh', 'apna', 'mera', 'tera',
  'hamara', 'unka', 'inke', 'farmer', 'kisan', 'fasal', 'bima', 'yojana',
  'sahakari', 'samiti', 'pacs', 'pmfby', 'rin', 'loan', 'byaj', 'shikayat',
  'complain', 'bijai', 'kheti', 'krishi', 'paisa', 'paise', 'kitna', 'kitne',
  'document', 'kaun', 'koi', 'bahut', 'thoda', 'jyada', 'kam', 'sabse',
  'hona', 'karna', 'milna', 'lena', 'dena', 'padhna', 'samajhna',
];

function countCharsInRange(text: string, ranges: [number, number][]): number {
  let count = 0;
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if (ranges.some(([start, end]) => cp >= start && cp <= end)) count++;
  }
  return count;
}

function isHinglish(text: string): boolean {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const matches = words.filter(w => HINGLISH_KEYWORDS.includes(w));
  // At least 2 Hinglish keywords, no Devanagari, text is mostly Latin
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  if (hasDevanagari) return false;
  return matches.length >= 2;
}

export function detectLanguage(text: string): DetectedLanguage {
  if (!text || text.trim().length === 0) {
    return { code: 'en', displayName: 'English', confidence: 'low' };
  }

  const trimmed = text.trim();
  const totalChars = trimmed.replace(/\s/g, '').length;

  // Check unicode scripts first
  let bestMatch: { code: LanguageCode; displayName: string; count: number } | null = null;

  for (const lang of UNICODE_RANGES) {
    const count = countCharsInRange(trimmed, lang.ranges);
    if (count > 0 && (!bestMatch || count > bestMatch.count)) {
      bestMatch = { code: lang.code, displayName: lang.displayName, count };
    }
  }

  if (bestMatch && bestMatch.count / totalChars > 0.2) {
    // Special case: distinguish Marathi from Hindi (both Devanagari)
    // Check for Marathi-specific words if needed; default to Hindi for Devanagari
    return {
      code: bestMatch.code,
      displayName: bestMatch.displayName,
      confidence: bestMatch.count / totalChars > 0.5 ? 'high' : 'medium',
    };
  }

  // Check for Hinglish (Roman-script Hindi)
  if (isHinglish(trimmed)) {
    return { code: 'hi-Latn', displayName: 'Hinglish', confidence: 'medium' };
  }

  // Default to English
  return { code: 'en', displayName: 'English', confidence: 'high' };
}

export function getLanguageDisplayName(code: LanguageCode): string {
  const map: Record<LanguageCode, string> = {
    hi: 'हिन्दी', en: 'English', 'hi-Latn': 'Hinglish',
    pa: 'ਪੰਜਾਬੀ', bn: 'বাংলা', mr: 'मराठी', gu: 'ગુજરાતી',
    ta: 'தமிழ்', te: 'తెలుగు', kn: 'ಕನ್ನಡ', ml: 'മലയാളം',
    or: 'ଓଡ଼ିଆ', as: 'অসমীয়া', ur: 'اردو', unknown: 'Unknown',
  };
  return map[code] || 'Unknown';
}
