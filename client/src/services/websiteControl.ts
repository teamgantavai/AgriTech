/**
 * Website Control Engine for Sahkar Saathi Voice AI
 * 
 * Translates natural user voice commands into instant actions:
 * - Opening any page (/chat, /, /schemes/:id)
 * - Searching the 870+ scheme database and opening the exact scheme
 * - Controlling scrolling (up, down, top)
 * - Jumping to and highlighting scheme page sections (documents, eligibility, benefits, steps, etc.)
 * - Controlling assistant window (minimize, expand, close, mute)
 */

import { searchSchemeDatabase } from './schemeIntent';

export interface WebsiteAction {
  action:
    | 'navigate'
    | 'open_scheme'
    | 'scroll_down'
    | 'scroll_up'
    | 'scroll_top'
    | 'highlight_section'
    | 'close_assistant'
    | 'minimize_assistant'
    | 'expand_assistant'
    | 'mute_mic'
    | 'unmute_mic'
    | 'open_language_modal'
    | 'none';
  targetPath?: string;
  targetSection?: string;
  schemeId?: string;
  schemeTitle?: string;
  confidence: number;
}

// Well-known direct route commands
const ROUTE_MATCHERS = [
  {
    regex: /(home|landing|mukhya|prishth|shuruat|pehle|pahle|main page|होम|मुख्य पृष्ठ|शुरुआत|पहला पेज|शुरू)/i,
    path: '/',
  },
  {
    regex: /(chat|baatchit|likhkar|likh kar|message|चैट|बातचीत|लिखकर पूछें|मैसेज|लिखकर)/i,
    path: '/chat',
  },
];

// Scheme keywords mapping for instant 0ms routing
const CORE_SCHEMES_MAP: { id: string; title: string; regex: RegExp }[] = [
  {
    id: 'pm-kisan',
    title: 'PM-KISAN',
    regex: /(pm[\s-]?kisan|पीएम[\s-]?किसान|सम्मान[\s-]?निधि|samman[\s-]?nidhi|दो[\s-]?हजार|2000.*kist|6000)/i,
  },
  {
    id: 'kcc',
    title: 'Kisan Credit Card (KCC)',
    regex: /(\bkcc\b|kisan[\s-]?credit[\s-]?card|किसान[\s-]?क्रेडिट[\s-]?कार्ड|केसीसी|के[\s-]?सी[\s-]?सी|4%.*byaj|credit card)/i,
  },
  {
    id: 'pmfby',
    title: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    regex: /(\bpmfby\b|fasal[\s-]?bima|फसल[\s-]?बीमा|crop[\s-]?insurance|पीएम[\s-]?एफबीवाई|फसल नुकसान|bima claim|बीमा)/i,
  },
  {
    id: 'tractor-subsidy',
    title: 'Tractor & Machinery Subsidy',
    regex: /(tractor|ट्रैक्टर|krishi[\s-]?yantra|कृषि[\s-]?यंत्र|रोटावेटर|rotavator|मशीन सब्सिडी|smam)/i,
  },
  {
    id: 'pacs',
    title: 'PACS (Primary Agricultural Credit Society)',
    regex: /(\bpacs\b|पैक्स|cooperative.*society|सहकारी[\s-]?समिति|सहकारी[\s-]?सोसायटी|खाद बीज समिति|सहकार)/i,
  },
  {
    id: 'pm-kusum',
    title: 'PM-KUSUM Solar Pump Scheme',
    regex: /(kusum|कुसुम|solar[\s-]?pump|सोलर[\s-]?पंप|सोलर सिंचाई|solar yojana)/i,
  },
  {
    id: 'pm-vishwakarma',
    title: 'PM Vishwakarma Scheme',
    regex: /(vishwakarma|विश्वकर्मा|karigar|कारीगर|shilpkar|शिल्पकार|bunkar|बुनकर|toolkit|टूलकिट|darji|lohar|badhai)/i,
  },
  {
    id: 'pm-svanidhi',
    title: 'PM SVANidhi Scheme',
    regex: /(svanidhi|स्वनिधि|dukan|दुकान|dukaandar|दुकानदार|street vendor|रेहड़ी|ठेला|khoja|khokha)/i,
  },
  {
    id: 'mudra',
    title: 'Pradhan Mantri Mudra Yojana',
    regex: /(mudra|मुद्रा|shishu loan|kishor loan|tarun loan|business loan|व्यापार लोन)/i,
  },
  {
    id: 'pashu-kcc',
    title: 'Pashu Kisan Credit Card',
    regex: /(pashu[\s-]?kcc|पशु[\s-]?केसीसी|पशुपालन|dairy loan|डेयरी लोन|गाय.*लोन|भैंस.*लोन|bakri.*palan|बकरी.*पालन)/i,
  },
  {
    id: 'lakhpati-didi',
    title: 'Lakhpati Didi Scheme',
    regex: /(lakhpati|लखपति|lakhpati[\s-]?didi|लखपति[\s-]?दीदी|drone[\s-]?didi|ड्रोन[\s-]?दीदी|shg|स्वयं सहायता समूह|महिला समूह)/i,
  },
];

// Section jump & highlight matchers
const SECTION_MATCHERS: { section: string; regex: RegExp }[] = [
  {
    section: 'documents',
    regex: /(document|dastavez|kagaz|kaghaz|praman|aadhaar|khatauni|दस्तावेज़|कागजात|कागज|पहचान पत्र|आधार)/i,
  },
  {
    section: 'eligibility',
    regex: /(eligible|patrata|patra|kisko|kaun|apply kar sakta|पात्रता|पात्र|किसे मिलेगी|कौन आवेदन|योग्यता|शर्तें)/i,
  },
  {
    section: 'benefits',
    regex: /(benefit|labh|rupay|paisa|paise|subsidy|anudan|kitna milega|kitna.*paisa|faida|लाभ|पैसे|पैसा|कितना मिलेगा|फायदा|सब्सिडी|अनुदान)/i,
  },
  {
    section: 'applicationSteps',
    regex: /(apply kaise|kaise karein|process|step|tarika|registration|आवेदन कैसे|कैसे करें|तरीका|प्रक्रिया|फॉर्म कैसे)/i,
  },
  {
    section: 'fees',
    regex: /(fee|fees|kharch|charg|lagat|paisa lagega|फीस|खर्च|लागत|चार्ज|कितना लगेगा)/i,
  },
  {
    section: 'whereToApply',
    regex: /(kahan|csc|portal|website|office|kendra|kiske paas|जाना होगा|कहाँ|कहा|सीएससी|कार्यालय|केंद्र)/i,
  },
  {
    section: 'warnings',
    regex: /(savdhan|warning|fraud|dhokha|galti|khatra|सावधान|धोखा|गलती|सावधानी|फ्रॉड|अलर्ट)/i,
  },
  {
    section: 'links',
    regex: /(link|website|portal|url|आधिकारिक लिंक|ऑफिशियल वेबसाइट|पोर्टल लिंक|वेबसाइट)/i,
  },
];

/**
 * Evaluates user speech to determine if a website control action should be executed.
 */
export async function evaluateWebsiteControl(
  userText: string,
  currentSchemeId: string | null
): Promise<WebsiteAction> {
  const clean = userText.trim().toLowerCase();
  if (!clean) return { action: 'none', confidence: 0 };

  // 1. Specific Mic Controls (must evaluate before generic 'band karo'!)
  if (/(mute|mic band|माइक बंद|म्यूट|आवाज बंद)/i.test(clean)) {
    return { action: 'mute_mic', confidence: 0.95 };
  }
  if (/(unmute|mic chalu|माइक चालू|अनम्यूट|माइक ऑन)/i.test(clean)) {
    return { action: 'unmute_mic', confidence: 0.95 };
  }

  // 2. Assistant Window Size & Close Controls
  if (/(chhota|minimize|छोटा|मिनीमाइज)/i.test(clean)) {
    return { action: 'minimize_assistant', confidence: 0.95 };
  }
  if (/(bada|expand|बड़ा|एक्सपैंड|वापस खोलो)/i.test(clean)) {
    return { action: 'expand_assistant', confidence: 0.95 };
  }
  if (/(band karo|close karo|window band|hatao|alvida|bye|chup ho jao|बंद करो|हटाओ|विंडो बंद|अलविदा|बंद कर दो)/i.test(clean)) {
    return { action: 'close_assistant', confidence: 0.95 };
  }
  if (/(bhasha badlo|bhasha change|language badlo|language change|भाषा बदलो|बोली बदलो|भाषा चेंज)/i.test(clean)) {
    return { action: 'open_language_modal', confidence: 0.95 };
  }

  // 2. Page Navigation (Home, Chat, Back)
  if (/(wapas jao|peeche jao|back jao|piche jao|पीछे जाओ|वापस जाओ|लौट|पीछे चलो)/i.test(clean)) {
    return { action: 'navigate', targetPath: '-1', confidence: 0.9 };
  }
  for (const r of ROUTE_MATCHERS) {
    if (r.regex.test(clean)) {
      return { action: 'navigate', targetPath: r.path, confidence: 0.9 };
    }
  }

  // 3. Scroll Controls
  if (/(scroll down|neeche scroll|neeche jao|neeche dikhao|neeche karo|नीचे|नीचे जाओ|नीचे करो|नीचे दिखाओ)/i.test(clean)) {
    return { action: 'scroll_down', confidence: 0.9 };
  }
  if (/(scroll up|upar scroll|upar jao|upar dikhao|upar karo|ऊपर|ऊपर जाओ|ऊपर करो|ऊपर दिखाओ)/i.test(clean)) {
    return { action: 'scroll_up', confidence: 0.9 };
  }
  if (/(top pe|shuruat me|sabse upar|शीर्ष|ऊपर ले जाओ|शुरू में ले चलो)/i.test(clean)) {
    return { action: 'scroll_top', confidence: 0.9 };
  }

  // 4. In-page Section Jumps (when looking at a scheme)
  if (currentSchemeId) {
    for (const s of SECTION_MATCHERS) {
      if (s.regex.test(clean)) {
        return {
          action: 'highlight_section',
          targetSection: s.section,
          confidence: 0.9,
        };
      }
    }
  }

  // 5. Open Core Schemes (Fast Pattern Match)
  for (const cs of CORE_SCHEMES_MAP) {
    if (cs.regex.test(clean)) {
      let targetSection: string | undefined;
      for (const s of SECTION_MATCHERS) {
        if (s.regex.test(clean)) {
          targetSection = s.section;
          break;
        }
      }

      return {
        action: 'open_scheme',
        schemeId: cs.id,
        schemeTitle: cs.title,
        targetSection,
        confidence: 0.95,
      };
    }
  }

  // 6. Universal Database Search for ANY Scheme in Knowledge Base (870+ schemes)
  if (/(yojana|scheme|subsidy|anudan|kisan|farming|pashu|bakri|dairy|loan|बीमा|सब्सिडी|योजना|मछली|ड्रोन)/i.test(clean)) {
    const dbMatch = await searchSchemeDatabase(clean);
    if (dbMatch) {
      return {
        action: 'open_scheme',
        schemeId: dbMatch.slug || dbMatch.id,
        schemeTitle: dbMatch.title,
        confidence: 0.85,
      };
    }
  }

  return { action: 'none', confidence: 0 };
}
