/**
 * Scheme Intent Detection Engine
 * 
 * Accurately detects which government scheme or section the user is referring to
 * across Hindi, Hinglish, Punjabi, and English natural speech.
 * 
 * Searches the 870+ schemes knowledge base to resolve ANY government scheme,
 * reads its verified 'about' data, and triggers smooth page navigation.
 */

export interface SchemeIntentResult {
  schemeId: string | null;
  schemeTitle: string | null;
  confidence: number; // 0.0 to 1.0
  intent: 'open_scheme' | 'section_query' | 'clarification_needed' | 'general';
  targetSection?: 'about' | 'eligibility' | 'benefits' | 'applicationSteps' | 'documents' | 'fees' | 'whereToApply' | 'warnings' | 'links';
  clarificationPrompt?: string;
  explanationText?: string;
  schemeData?: any;
}

interface SchemePattern {
  id: string;
  title: string;
  hindiTitle: string;
  matchers: RegExp[];
  strongMatchers: RegExp[];
}

const SCHEME_PATTERNS: SchemePattern[] = [
  {
    id: 'pm-kisan',
    title: 'PM-KISAN',
    hindiTitle: 'प्रधानमंत्री किसान सम्मान निधि',
    strongMatchers: [
      /pm[\s-]?kisan/i,
      /पीएम[\s-]?किसान/i,
      /सम्मान[\s-]?निधि/i,
      /samman[\s-]?nidhi/i,
      /दो[\s-]?हजार[\s-]?रुपए/i,
      /6000.*किस्त/i,
      /छह[\s-]?हजार/i,
    ],
    matchers: [
      /kisan.*samman/i,
      /किसान.*सम्मान/i,
      /kisan.*paisa/i,
      /किसान.*पैसा/i,
      /char[\s-]?mahine.*kist/i,
      /चार[\s-]?महीने.*किस्त/i,
      /2000.*kist/i,
    ],
  },
  {
    id: 'kcc',
    title: 'Kisan Credit Card (KCC)',
    hindiTitle: 'किसान क्रेडिट कार्ड (KCC)',
    strongMatchers: [
      /\bkcc\b/i,
      /kisan[\s-]?credit[\s-]?card/i,
      /किसान[\s-]?क्रेडिट[\s-]?कार्ड/i,
      /केसीसी/i,
      /के[\s-]?सी[\s-]?सी/i,
    ],
    matchers: [
      /kisan.*loan/i,
      /किसान.*लोन/i,
      /kheti.*karz/i,
      /खेती.*कर्ज/i,
      /fasal.*loan/i,
      /फसल.*लोन/i,
      /4%.*byaj/i,
      /char.*pratishat.*byaj/i,
      /4%.*ब्याज/i,
      /credit.*card.*kisan/i,
    ],
  },
  {
    id: 'pmfby',
    title: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    hindiTitle: 'प्रधानमंत्री फसल बीमा योजना',
    strongMatchers: [
      /\bpmfby\b/i,
      /fasal[\s-]?bima/i,
      /फसल[\s-]?बीमा/i,
      /crop[\s-]?insurance/i,
      /पीएम[\s-]?एफबीवाई/i,
    ],
    matchers: [
      /bima.*claim/i,
      /बीमा.*क्लेम/i,
      /sukha.*fasal.*muavza/i,
      /सूखा.*फसल.*मुआवजा/i,
      /baarish.*fasal.*kharab/i,
      /बारिश.*फसल.*खराब/i,
      /olavrishti/i,
      /ओलावृष्टि/i,
      /fasal.*nuksan/i,
      /फसल.*नुकसान/i,
      /bima.*karwaye/i,
      /बीमा.*करवाएं/i,
    ],
  },
  {
    id: 'tractor-subsidy',
    title: 'Tractor & Machinery Subsidy',
    hindiTitle: 'कृषि यंत्रीकरण एवं ट्रैक्टर सब्सिडी',
    strongMatchers: [
      /tractor.*subsidy/i,
      /ट्रैक्टर.*सब्सिडी/i,
      /tractor.*lene/i,
      /ट्रैक्टर.*लेने/i,
      /krishi[\s-]?yantra.*subsidy/i,
      /कृषि[\s-]?यंत्र.*सब्सिडी/i,
      /farm[\s-]?mechanization/i,
    ],
    matchers: [
      /tractor/i,
      /ट्रैक्टर/i,
      /rotavator/i,
      /रोटावेटर/i,
      /kheti.*machine.*subsidy/i,
      /मशीन.*सब्सिडी/i,
      /yantra.*anudan/i,
      /यंत्र.*अनुदान/i,
    ],
  },
  {
    id: 'pacs',
    title: 'PACS (Primary Agricultural Credit Society)',
    hindiTitle: 'पैक्स (प्राथमिक कृषि ऋण समिति)',
    strongMatchers: [
      /\bpacs\b/i,
      /पैक्स/i,
      /cooperative.*society/i,
      /सहकारी[\s-]?समिति/i,
      /सहकारी[\s-]?सोसायटी/i,
    ],
    matchers: [
      /gram.*samiti/i,
      /ग्राम.*समिति/i,
      /khad.*beej.*samiti/i,
      /खाद.*बीज.*समिति/i,
      /pacs.*kya.*hoti/i,
      /पैक्स.*क्या.*है/i,
      /samiti.*sadasya/i,
      /समिति.*सदस्य/i,
    ],
  },
  {
    id: 'pm-kusum',
    title: 'PM-KUSUM Solar Pump Scheme',
    hindiTitle: 'प्रधानमंत्री कुसुम सोलर पंप योजना',
    strongMatchers: [
      /kusum/i,
      /कुसुम/i,
      /solar[\s-]?pump/i,
      /सोलर[\s-]?पंप/i,
    ],
    matchers: [
      /solar.*sinchai/i,
      /सोलर.*सिंचाई/i,
      /bijli.*chhoot.*sinchai/i,
      /solar.*subsidy/i,
    ],
  }
];

// In-page Section Intent Matching
const SECTION_MATCHERS: { section: SchemeIntentResult['targetSection']; regex: RegExp }[] = [
  {
    section: 'documents',
    regex: /(document|dastavez|kagaz|kaghaz|praman|aadhaar|khatauni|दस्तावेज़|कागजात|कागज|पहचान पत्र|कागद)/i,
  },
  {
    section: 'eligibility',
    regex: /(eligible|patrata|patra|kisko|kaun|apply kar sakta|पात्रता|पात्र|किसे|कौन|योग्यता)/i,
  },
  {
    section: 'benefits',
    regex: /(benefit|labh|rupaye|paise|subsidy|anudan|kitna milega|faida|लाभ|पैसे|कितना मिलेगा|फायदा|अनुदान|सब्सिडी)/i,
  },
  {
    section: 'applicationSteps',
    regex: /(apply kaise|kaise karein|process|step|tarika|registration|आवेदन कैसे|कैसे करें|तरीका|प्रक्रिया|पंजीकरण)/i,
  },
  {
    section: 'fees',
    regex: /(fee|fees|kharch|charg|lagat|paisa lagega|फीस|खर्च|लागत|चार्ज)/i,
  },
  {
    section: 'whereToApply',
    regex: /(kahan|csc|portal|website|office|kendra|kiske paas|जाना होगा|कहाँ|कहा|सीएससी|पोर्टल|कार्यालय|शाखा)/i,
  },
  {
    section: 'warnings',
    regex: /(savdhan|warning|fraud|dhokha|galti|khatra|सावधान|धोखा|गलती|सावधानी|फ्रॉड)/i,
  },
  {
    section: 'links',
    regex: /(link|website|portal|url|आधिकारिक लिंक|वेबसाइट)/i,
  },
];

/**
 * Searches the 870+ scheme records in knowledge base for any matching topic or keywords
 */
export async function searchSchemeDatabase(queryText: string): Promise<any | null> {
  try {
    const stopWords = new Set([
      'ke', 'baare', 'mein', 'batao', 'bataiye', 'kya', 'hai', 'kaise', 'milega', 'chahiye',
      'yojana', 'scheme', 'sarkari', 'bata', 'humein', 'mujhe', 'karna', 'karo', 'about', 'tell', 'me'
    ]);

    const words = queryText
      .toLowerCase()
      .replace(/[^\w\s\u0900-\u097F]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    const cleanQuery = words.join(' ') || queryText.trim();
    if (!cleanQuery) return null;

    const res = await fetch(`/api/schemes?q=${encodeURIComponent(cleanQuery)}&limit=3`);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.schemes && data.schemes.length > 0) {
      return data.schemes[0];
    }
  } catch (err) {
    console.warn('[searchSchemeDatabase] Error searching scheme database:', err);
  }
  return null;
}

/**
 * Synchronous regex intent matching
 */
export function detectSchemeIntent(
  transcript: string,
  currentSchemeId?: string | null
): SchemeIntentResult {
  if (!transcript || !transcript.trim()) {
    return {
      schemeId: null,
      schemeTitle: null,
      confidence: 0,
      intent: 'general',
    };
  }

  const clean = transcript.trim().toLowerCase();

  // 1. Check for specific well-known scheme patterns
  for (const scheme of SCHEME_PATTERNS) {
    for (const rx of scheme.strongMatchers) {
      if (rx.test(clean)) {
        let targetSection: SchemeIntentResult['targetSection'] = undefined;
        for (const s of SECTION_MATCHERS) {
          if (s.regex.test(clean)) {
            targetSection = s.section;
            break;
          }
        }

        return {
          schemeId: scheme.id,
          schemeTitle: scheme.hindiTitle,
          confidence: 0.95,
          intent: 'open_scheme',
          targetSection,
        };
      }
    }

    for (const rx of scheme.matchers) {
      if (rx.test(clean)) {
        return {
          schemeId: scheme.id,
          schemeTitle: scheme.hindiTitle,
          confidence: 0.80,
          intent: 'open_scheme',
        };
      }
    }
  }

  // 2. If user is already on a scheme page and asks a follow-up
  if (currentSchemeId) {
    for (const s of SECTION_MATCHERS) {
      if (s.regex.test(clean)) {
        return {
          schemeId: currentSchemeId,
          schemeTitle: null,
          confidence: 0.88,
          intent: 'section_query',
          targetSection: s.section,
        };
      }
    }

    if (/(isme|is yojana|ismein|iss yojana|yahan|yaha|इसमें|इस योजना)/i.test(clean)) {
      return {
        schemeId: currentSchemeId,
        schemeTitle: null,
        confidence: 0.82,
        intent: 'section_query',
        targetSection: 'benefits',
      };
    }
  }

  // 3. Ambiguous generic scheme query
  if (/^(yojana|scheme|sarkari yojana|योजना|सरकारी योजना|स्कीम|योजनाएं|योजनाओ)$/i.test(clean)) {
    return {
      schemeId: null,
      schemeTitle: null,
      confidence: 0.4,
      intent: 'clarification_needed',
      clarificationPrompt: 'आप किस योजना के बारे में जानना चाहते हैं? जैसे पीएम-किसान, किसान क्रेडिट कार्ड (KCC), फसल बीमा, या ट्रैक्टर सब्सिडी?',
    };
  }

  return {
    schemeId: null,
    schemeTitle: null,
    confidence: 0,
    intent: 'general',
  };
}

/**
 * Detects intent AND reads verified data directly from the 870+ scheme database.
 * Returns the exact database explanation and scheme record so the AI reads it out loud
 * and opens the scheme page simultaneously.
 */
export async function detectAndFetchScheme(
  transcript: string,
  currentSchemeId?: string | null
): Promise<SchemeIntentResult> {
  const baseResult = detectSchemeIntent(transcript, currentSchemeId);

  // 1. If high confidence match on a known scheme slug
  if (baseResult.intent === 'open_scheme' && baseResult.schemeId) {
    try {
      const res = await fetch(`/api/schemes/${baseResult.schemeId}`);
      if (res.ok) {
        const scheme = await res.json();
        const aboutText = scheme.sections?.about || scheme.answer || '';
        const benefitsText = scheme.sections?.benefits?.[0] ? ` इसमें मुख्य लाभ: ${scheme.sections.benefits[0]}` : '';
        const explanation = `यह ${scheme.title} योजना है। ${aboutText}${benefitsText} मैं आपको इसके पात्रता, दस्तावेज़ और आवेदन की पूरी प्रक्रिया बताता हूँ।`;

        return {
          ...baseResult,
          schemeTitle: scheme.title,
          explanationText: explanation,
          schemeData: scheme,
        };
      }
    } catch (e) {
      console.warn('[detectAndFetchScheme] Error fetching scheme details:', e);
    }
    return baseResult;
  }

  // 2. If it is a section query while on a scheme page
  if (baseResult.intent === 'section_query') {
    return baseResult;
  }

  // 3. If query mentions any topic or scheme from the entire 870+ scheme knowledge base
  const dbMatch = await searchSchemeDatabase(transcript);
  if (dbMatch) {
    const aboutText = dbMatch.sections?.about || dbMatch.answer || '';
    const benefitsText = dbMatch.sections?.benefits?.[0] ? ` इसमें मुख्य लाभ: ${dbMatch.sections.benefits[0]}` : '';
    const explanation = `यह ${dbMatch.title} योजना है। ${aboutText}${benefitsText} आप इसके दस्तावेज़ और आवेदन की प्रक्रिया पूछ सकते हैं।`;

    return {
      schemeId: dbMatch.slug || dbMatch.id,
      schemeTitle: dbMatch.title,
      confidence: 0.88,
      intent: 'open_scheme',
      explanationText: explanation,
      schemeData: dbMatch,
    };
  }

  return baseResult;
}
