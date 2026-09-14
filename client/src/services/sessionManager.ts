// ============================================================
// Session Manager — Persists user profile across reconnects
// ============================================================

import type { SessionProfile } from '../types/voice';

const SESSION_KEY = 'sahkar_sathi_voice_profile';

const DEFAULT_PROFILE: SessionProfile = {
  selectedLanguage: null,
  language: null,
  languageCode: null,
  occupation: null,
  nameIfProvided: null,
  onboardingComplete: false,
  onboardingDone: false,
  currentTopic: null,
  preferences: {},
};

export function loadProfile(): SessionProfile {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    const selectedLanguage = parsed.selectedLanguage || parsed.language || null;
    const onboardingComplete = Boolean(parsed.onboardingComplete || parsed.onboardingDone);
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      selectedLanguage,
      language: selectedLanguage,
      onboardingComplete,
      onboardingDone: onboardingComplete,
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(profile: SessionProfile): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(profile));
  } catch {
    // sessionStorage unavailable — continue without persistence
  }
}

export function updateProfile(partial: Partial<SessionProfile>): SessionProfile {
  const current = loadProfile();
  const lang = partial.selectedLanguage !== undefined ? partial.selectedLanguage : partial.language;
  const done = partial.onboardingComplete !== undefined ? partial.onboardingComplete : partial.onboardingDone;

  const updated: SessionProfile = {
    ...current,
    ...partial,
    ...(lang !== undefined ? { selectedLanguage: lang, language: lang } : {}),
    ...(done !== undefined ? { onboardingComplete: done, onboardingDone: done } : {}),
  };
  saveProfile(updated);
  return updated;
}

export function clearProfile(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export interface FarmerContext {
  state: string;
  month: number;
  currentCrop: string | null;
}

export function setFarmerContext(ctx: Partial<FarmerContext>): void {
  if (typeof window !== 'undefined') {
    const existing = (window as any).__sahkar_farmer_ctx || {
      state: 'Rajasthan',
      month: new Date().getMonth() + 1,
      currentCrop: null,
    };
    (window as any).__sahkar_farmer_ctx = { ...existing, ...ctx };
  }
}

export function getFarmerContext(): FarmerContext {
  if (typeof window !== 'undefined' && (window as any).__sahkar_farmer_ctx) {
    return (window as any).__sahkar_farmer_ctx;
  }
  return {
    state: 'Rajasthan',
    month: new Date().getMonth() + 1,
    currentCrop: null,
  };
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'hi-Latn', name: 'Hinglish', nativeName: 'Hinglish' },
];

/**
 * Robust language detection from spoken user utterance or assistant confirmation text.
 * Matches keywords, native phrases, and character script ranges.
 */
export function detectLanguageFromText(text: string): SupportedLanguage | null {
  if (!text || !text.trim()) return null;
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Direct native names and key language terms
  if (clean.includes('मराठी') || lower.includes('marathi')) return SUPPORTED_LANGUAGES.find((l) => l.code === 'mr') || null;
  if (clean.includes('ਪੰਜਾਬੀ') || lower.includes('punjabi') || lower.includes('punjab')) return SUPPORTED_LANGUAGES.find((l) => l.code === 'pa') || null;
  if (clean.includes('हिंदी') || clean.includes('हिन्दी') || lower.includes('hindi') || lower.includes('hindustani')) return SUPPORTED_LANGUAGES.find((l) => l.code === 'hi') || null;
  if (clean.includes('English') || lower.includes('english') || clean.includes('अंग्रेजी') || clean.includes('ਅੰਗਰੇਜ਼ੀ')) return SUPPORTED_LANGUAGES.find((l) => l.code === 'en') || null;
  if (clean.includes('ગુજરાતી') || lower.includes('gujarati')) return SUPPORTED_LANGUAGES.find((l) => l.code === 'gu') || null;
  if (clean.includes('বাংলা') || lower.includes('bengali') || lower.includes('bangla')) return SUPPORTED_LANGUAGES.find((l) => l.code === 'bn') || null;
  if (clean.includes('తెలుగు') || lower.includes('telugu')) return SUPPORTED_LANGUAGES.find((l) => l.code === 'te') || null;
  if (clean.includes('தமிழ்') || lower.includes('tamil')) return SUPPORTED_LANGUAGES.find((l) => l.code === 'ta') || null;
  if (clean.includes('ಕನ್ನಡ') || lower.includes('kannada')) return SUPPORTED_LANGUAGES.find((l) => l.code === 'kn') || null;
  if (clean.includes('മലയാളം') || lower.includes('malayalam')) return SUPPORTED_LANGUAGES.find((l) => l.code === 'ml') || null;
  if (clean.includes('ଓଡ଼ିଆ') || lower.includes('odia') || lower.includes('oriya')) return SUPPORTED_LANGUAGES.find((l) => l.code === 'or') || null;
  if (clean.includes('অসমীয়া') || lower.includes('assamese')) return SUPPORTED_LANGUAGES.find((l) => l.code === 'as') || null;
  if (clean.includes('اردو') || lower.includes('urdu')) return SUPPORTED_LANGUAGES.find((l) => l.code === 'ur') || null;
  if (clean.includes('हिंग्लिश') || lower.includes('hinglish')) return SUPPORTED_LANGUAGES.find((l) => l.code === 'hi-Latn') || null;

  // 2. Assistant confirmation phrasing (e.g. "ठीक है! मैं आपकी कैसे मदद कर सकता हूँ?")
  if (clean.includes('मदद कर सकता') || clean.includes('सहायता') || clean.includes('कैसे मदद')) {
    return SUPPORTED_LANGUAGES.find((l) => l.code === 'hi') || null;
  }
  if (clean.includes('ਮਦਦ ਕਰ ਸਕਦਾ') || clean.includes('ਸਹਾਇਤਾ')) {
    return SUPPORTED_LANGUAGES.find((l) => l.code === 'pa') || null;
  }
  if (lower.includes('how can i help you') || lower.includes('how may i help you')) {
    return SUPPORTED_LANGUAGES.find((l) => l.code === 'en') || null;
  }

  // 4. Unicode Script Detection (fallback when user directly speaks in a language)
  // Gurmukhi -> Punjabi
  if (/[\u0A00-\u0A7F]/.test(clean)) {
    return SUPPORTED_LANGUAGES.find((l) => l.code === 'pa') || null;
  }
  // Gujarati
  if (/[\u0A80-\u0AFF]/.test(clean)) {
    return SUPPORTED_LANGUAGES.find((l) => l.code === 'gu') || null;
  }
  // Bengali / Assamese
  if (/[\u0980-\u09FF]/.test(clean)) {
    return SUPPORTED_LANGUAGES.find((l) => l.code === 'bn') || null;
  }
  // Telugu
  if (/[\u0C00-\u0C7F]/.test(clean)) {
    return SUPPORTED_LANGUAGES.find((l) => l.code === 'te') || null;
  }
  // Tamil
  if (/[\u0B80-\u0BFF]/.test(clean)) {
    return SUPPORTED_LANGUAGES.find((l) => l.code === 'ta') || null;
  }
  // Kannada
  if (/[\u0C80-\u0CFF]/.test(clean)) {
    return SUPPORTED_LANGUAGES.find((l) => l.code === 'kn') || null;
  }
  // Malayalam
  if (/[\u0D00-\u0D7F]/.test(clean)) {
    return SUPPORTED_LANGUAGES.find((l) => l.code === 'ml') || null;
  }
  // Odia
  if (/[\u0B00-\u0B7F]/.test(clean)) {
    return SUPPORTED_LANGUAGES.find((l) => l.code === 'or') || null;
  }
  // Urdu / Arabic
  if (/[\u0600-\u06FF]/.test(clean)) {
    return SUPPORTED_LANGUAGES.find((l) => l.code === 'ur') || null;
  }
  // Devanagari -> Check Marathi markers or default to Hindi
  if (/[\u0900-\u097F]/.test(clean)) {
    if (/\b(आहे|नाही|करा|सांगा|कसे|पाहिजे)\b/.test(clean)) {
      return SUPPORTED_LANGUAGES.find((l) => l.code === 'mr') || null;
    }
    return SUPPORTED_LANGUAGES.find((l) => l.code === 'hi') || null;
  }

  return null;
}

export interface GreetingPhrases {
  standard: string;
  crop: (cropName: string) => string;
}

export const GREETINGS_BY_LANGUAGE: Record<string, GreetingPhrases> = {
  hi: {
    standard: 'नमस्ते! मैं सहकार साथी हूँ। बताइए, मैं आपकी कैसे मदद करूँ?',
    crop: (crop) => `नमस्ते! मैं सहकार साथी हूँ। ${crop} के बारे में पूछना है या किसी और चीज़ में मदद चाहिए?`,
  },
  en: {
    standard: "Hello! I'm Sahkar Sathi. How can I help you today?",
    crop: (crop) => `Hello! I'm Sahkar Sathi. Would you like to ask about ${crop}, or do you need help with something else?`,
  },
  pa: {
    standard: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਸਹਕਾਰ ਸਾਥੀ ਹਾਂ। ਦੱਸੋ, ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?',
    crop: (crop) => `ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਸਹਕਾਰ ਸਾਥੀ ਹਾਂ। ਕੀ ਤੁਸੀਂ ${crop} ਬਾਰੇ ਪੁੱਛਣਾ ਚਾਹੁੰਦੇ ਹੋ ਜਾਂ ਕਿਸੇ ਹੋਰ ਚੀਜ਼ ਵਿੱਚ ਮਦਦ ਚਾਹੀਦੀ ਹੈ?`,
  },
  mr: {
    standard: 'नमस्कार! मी सहकार साथी आहे. सांगा, मी तुमची कशी मदत करू शकतो?',
    crop: (crop) => `नमस्कार! मी सहकार साथी आहे. तुम्हाला ${crop} बद्दल विचारायचे आहे की इतर काही मदत हवी आहे?`,
  },
  gu: {
    standard: 'નમસ્તે! હું સહકાર સાથી છું. કહો, હું તમારી શું મદદ કરી શકું?',
    crop: (crop) => `નમસ્તે! હું સહકાર સાથી છું. તમારે ${crop} વિશે પૂછવું છે કે અન્ય કોઈ બાબતમાં મદદ જોઈએ છે?`,
  },
  bn: {
    standard: 'নমস্কার! আমি সহকার সাথী। বলুন, আমি আপনাকে কীভাবে সাহায্য করতে পারি?',
    crop: (crop) => `নমস্কার! আমি সহকার সাথী। আপনি কি ${crop} সম্পর্কে জানতে চান নাকি অন্য কিছুতে সাহায্য লাগবে?`,
  },
  te: {
    standard: 'నమస్కారం! నేను సహకార్ సాథీని. చెప్పండి, నేను మీకు ఎలా సహాయపడగలను?',
    crop: (crop) => `నమస్కారం! నేను సహకార్ సాథీని. మీరు ${crop} గురించి అడగాలనుకుంటున్నారా లేదా మరేదైనా సహాయం కావాలా?`,
  },
  ta: {
    standard: 'வணக்கம்! நான் சகார் சாதி. சொல்லுங்கள், நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?',
    crop: (crop) => `வணக்கம்! நான் சகார் சாதி. நீங்கள் ${crop} பற்றி கேட்க விரும்புகிறீர்களா அல்லது வேறு ஏதேனும் உதவி தேவையா?`,
  },
  kn: {
    standard: 'ನಮಸ್ಕಾರ! ನಾನು ಸಹಕಾರ ಸಾಥಿ. ಹೇಳಿ, ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
    crop: (crop) => `ನಮಸ್ಕಾರ! ನಾನು ಸಹಕಾರ ಸಾಥಿ. ನೀವು ${crop} ಬಗ್ಗೆ ಕೇಳಲು ಬಯಸುವಿರಾ ಅಥವಾ ಬೇರೆ ಯಾವುದಾದರೂ ಸಹಾಯ ಬೇಕೇ?`,
  },
  ml: {
    standard: 'നമസ്കാരം! ഞാൻ സഹകാർ സാഥിയാണ്. പറയൂ, ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?',
    crop: (crop) => `നമസ്കാരം! ഞാൻ സഹകാർ സാഥിയാണ്. നിങ്ങൾക്ക് ${crop} നെക്കുറിച്ച് അറിയണമെന്നുണ്ടോ അതോ മറ്റെന്തെങ്കിലും സഹായം വേണമോ?`,
  },
  or: {
    standard: 'ନମସ୍କାର! ମୁଁ ସହକାର ସାଥୀ। କୁହନ୍ତୁ, ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?',
    crop: (crop) => `ନମସ୍କାର! ମୁଁ ସହକାର ସାଥୀ। ଆପଣ ${crop} ବିଷୟରେ ପଚାରିବାକୁ ଚାହାଁନ୍ତି କି ଆଉ କିଛି ସାହାଯ୍ୟ ଦରକਾਰ?`,
  },
  as: {
    standard: 'নমস্কাৰ! মই সহকাৰ সাথী। কওক, মই আপোনাক কেনেকৈ সহায় কৰিব পাৰোঁ?',
    crop: (crop) => `নমস্কাৰ! মই সহকাৰ সাথী। আপুনি ${crop} বিষয়ে জানিব বিচাৰে নেকি আন কিবাত সহায় লাগিব?`,
  },
  ur: {
    standard: 'سلام! میں سہکار ساتھی ہوں۔ بتائیے، میں آپ کی کیا مدد کر سکتا ہوں؟',
    crop: (crop) => `سلام! میں سہکار ساتھی ہوں۔ ${crop} کے بارے میں پوچھنا ہے یا کسی اور چیز میں مدد چاہیے؟`,
  },
  'hi-Latn': {
    standard: 'Namaste! Main Sahkar Sathi hoon. Batayein, main aapki kaise madad kar sakta hoon?',
    crop: (crop) => `Namaste! Main Sahkar Sathi hoon. Kya aapko ${crop} ke baare mein poochna hai ya kisi aur cheez mein madad chahiye?`,
  },
};

/**
 * Returns natural, short, localized greeting text for any of the 14 supported languages,
 * including crop calendar context when available.
 */
export function getGreetingText(langCodeOrName?: string | null, cropName?: string | null): string {
  if (!langCodeOrName) return GREETINGS_BY_LANGUAGE['hi'].standard;

  const clean = langCodeOrName.toLowerCase().trim();
  const langObj = SUPPORTED_LANGUAGES.find(
    (l) => l.code.toLowerCase() === clean || l.name.toLowerCase() === clean
  );
  const code = langObj ? langObj.code : (GREETINGS_BY_LANGUAGE[clean] ? clean : 'hi');
  const greeting = GREETINGS_BY_LANGUAGE[code] || GREETINGS_BY_LANGUAGE['hi'];

  if (cropName && cropName.trim()) {
    return greeting.crop(cropName.trim());
  }
  return greeting.standard;
}

export function buildSystemInstruction(profile: SessionProfile): string {
  const currentLang = profile.selectedLanguage || profile.language;
  const isReturningUser = Boolean(
    (profile.onboardingComplete || profile.onboardingDone) && currentLang
  );

  const selectedLangObj = SUPPORTED_LANGUAGES.find(
    (l) =>
      l.name.toLowerCase() === currentLang?.toLowerCase() ||
      l.code.toLowerCase() === profile.languageCode?.toLowerCase()
  );

  // Flow instructions based on whether language has been selected or not
  let flowInstruction = '';

  if (selectedLangObj) {
    flowInstruction = `GREETING & CONVERSATION MODE:
The user's selected language is ${selectedLangObj.name} (${selectedLangObj.nativeName}).
When the session begins, provide ONLY the short requested greeting in ${selectedLangObj.name}.
Do NOT ask which language they would like to use.
After the greeting is spoken, wait for the user to speak.
Then continue the normal conversation directly in ${selectedLangObj.name}.
Keep responses concise, natural, warm and brief (2-5 seconds for greetings).
Do not repeat introductory greetings or monologues once conversation is underway.
If the user intentionally asks to change language (e.g. "Let's speak English"), seamlessly switch to that language.`;
  } else {
    flowInstruction = `MANDATORY FIRST-TIME ONBOARDING FLOW:
At the beginning of a new voice conversation where no language has yet been selected, ask the short language question:
"नमस्ते! आप कौन सी भाषा में बात करना चाहते हैं? Which language would you like to speak in?"

Wait for the user's answer.

Once the language is determined, respond in that language with the short greeting:
"नमस्ते! मैं सहकार साथी हूँ। बताइए, मैं आपकी कैसे मदद करूँ?" (or native equivalent).

Do not ask for occupation, name, age, or other profile information during the initial language onboarding unless the user provides it voluntarily.

If the user starts asking a question instead (e.g. "Tell me about PM Kisan"):
Infer the user's language from their speech, adopt that language, and answer their question directly in that language without forcing them to repeat the language question.

After language onboarding is complete, have a normal natural conversation.`;
  }

  const languagePrompt = selectedLangObj
    ? `MANDATORY SPOKEN LANGUAGE: The user has selected ${selectedLangObj.name} (${selectedLangObj.nativeName}). You MUST generate your spoken response entirely in ${selectedLangObj.name} (${selectedLangObj.nativeName}). Use natural native phrasing, authentic vocabulary, and clear conversational pronunciation in ${selectedLangObj.name}. If the user explicitly asks you to speak in another language, seamlessly adapt to that requested language.`
    : `NATIVE MULTILINGUAL INTELLIGENCE: You understand and speak all 14 Indian languages fluently: Hindi, Punjabi, English, Marathi, Gujarati, Bengali, Telugu, Tamil, Kannada, Malayalam, Odia, Assamese, Urdu, and Hinglish. Always listen carefully to the user's spoken language and respond in that exact same language.`;

  const occupationNote = profile.occupation
    ? buildOccupationContext(profile.occupation)
    : 'Provide helpful, practical information tailored for farmers, cooperatives, and rural citizens.';

  const nameNote = profile.nameIfProvided
    ? `The user's name is ${profile.nameIfProvided}. Address them respectfully when appropriate.`
    : '';

  const farmerCtx = typeof window !== 'undefined' ? (window as any).__sahkar_farmer_ctx || { state: 'Rajasthan', month: new Date().getMonth() + 1, currentCrop: null } : { state: 'Rajasthan', month: new Date().getMonth() + 1, currentCrop: null };

  const cropCalendarContext = `
FARMER CROP CALENDAR CONTEXT:
- Active State: ${farmerCtx.state || 'Rajasthan'}
- Current Month: Month ${farmerCtx.month || (new Date().getMonth() + 1)} (${new Date().toLocaleString('en-US', { month: 'long' })})
${farmerCtx.currentCrop ? `- Currently Selected/Viewed Crop: ${farmerCtx.currentCrop}` : ''}

CROP CALENDAR TOOL RULES:
1. When the farmer asks what to sow, grow, or harvest, or asks about crop timings:
   - Call the 'getCropCalendar' tool with state, month, crop, and phase.
   - If user asks about "this crop" or "इसके बारे में", pass the viewed crop (${farmerCtx.currentCrop || 'the crop in context'}).
2. Keep spoken responses CONCISE (1 to 3 natural sentences). Name only the top 2-3 crops. Do not read huge lists.
3. Distinguish reference crop calendar from real-time farming decisions: note that actual sowing depends on local rain and soil conditions.
4. If data is not available, state honestly: "मेरे पास इस राज्य और महीने के लिए crop calendar की जानकारी उपलब्ध नहीं है।" Do not fabricate data.
5. If the farmer asks to change state (e.g. "मेरा राज्य पंजाब कर दो", "राजस्थान का कैलेंडर दिखाओ"), invoke 'setCropCalendarState' to update the UI automatically.`;

  return `You are Sahkar Sathi (सहकार साथी), a highly professional, warm, and articulate AI voice assistant dedicated to Indian agriculture, government schemes, farmers, cooperatives (PACS), dairy, fisheries, and rural livelihoods.

${flowInstruction}

${languagePrompt}

${cropCalendarContext}

NO REGISTRATION OR UNNECESSARY FORMS:
Do not ask for occupation, name, age, or registration details during initial interaction. The first interaction must feel like a natural voice assistant, not a form. If the user mentions their farming background or asks about a scheme, you may naturally personalize responses.

CORE DOMAIN EXPERTISE:
You provide accurate, up-to-date guidance on:
- PM-KISAN Samman Nidhi (installments, eKYC, eligibility, registration)
- PM Fasal Bima Yojana (PMFBY crop insurance, claims, enrollment)
- Kisan Credit Card (KCC limits, interest subvention, application)
- PM-KUSUM (solar agriculture pumps, subsidies)
- Agriculture Infrastructure Fund (AIF), Sub-Mission on Agricultural Mechanization (SMAM tractor subsidy)
- Soil Health Card, Organic Farming (PKVY), fertilizer subsidies (Nano Urea, DAP)
- PACS (Primary Agricultural Credit Societies), Dairy cooperatives, FPOs (Farmer Producer Organizations)
- Mandi prices (e-NAM), MSP, weather alerts, and crop disease management.

CONVERSATION & SPEAKING STYLE:
- Professional, empathetic, warm, and respectful.
- Conversational voice brevity: deliver clear, practical answers in 1 to 3 concise spoken sentences. Avoid overwhelming the listener with long monologues.
- Never use markdown formatting (no bold asterisks like **word**, no bullet lists, no URLs) in your spoken responses because they sound awkward when read aloud.
- Speak with natural rhythm and conversational tone.
- If you do not know a specific detail, honestly offer to look it up or guide the user to the nearest CSC/KVK/Block Agriculture Office.

${occupationNote}
${nameNote}

Remember conversation context across turns naturally. Be ready to assist immediately.`;
}

function buildOccupationContext(occupation: string): string {
  const occ = occupation.toLowerCase();

  if (occ.includes('farmer') || occ.includes('kisan') || occ.includes('किसान') || occ.includes('ਕਿਸਾਨ')) {
    return `The user is a farmer/kisan. Naturally use examples involving: crops, farming, PM-KISAN, PMFBY crop insurance, KCC (Kisan Credit Card), irrigation, fertilizers, mandi prices, agriculture loans, tractor subsidy, PM-KUSUM solar pump, weather, government agriculture schemes. Do not repeatedly say "because you are a farmer" — weave it in naturally.`;
  }
  if (occ.includes('student') || occ.includes('छात्र') || occ.includes('ਵਿਦਿਆਰਥੀ')) {
    return `The user is a student. Naturally use examples involving: education, scholarships, entrance exams, courses, internships, student loans, government schemes for students (NSP, PMMS, etc.). Speak in an encouraging, informative tone.`;
  }
  if (occ.includes('shop') || occ.includes('व्यापारी') || occ.includes('दुकानदार') || occ.includes('ਦੁਕਾਨਦਾਰ')) {
    return `The user is a shopkeeper/business owner. Use examples involving: business loans, GST, MSME schemes, PM Vishwakarma, PM SVANidhi, trade licenses, inventory, suppliers, government business subsidies.`;
  }
  if (occ.includes('teacher') || occ.includes('शिक्षक') || occ.includes('ਅਧਿਆਪਕ')) {
    return `The user is a teacher. Use examples involving: education schemes, teacher training, digital India programs, school infrastructure, salary schemes.`;
  }
  if (occ.includes('homemaker') || occ.includes('गृहिणी') || occ.includes('ਘਰੇਲੂ')) {
    return `The user is a homemaker. Use examples involving: women empowerment schemes, Lakhpati Didi, SHG (Self Help Groups), Ujjwala Yojana, Mahila schemes, nutrition programs, PMAY housing.`;
  }
  if (occ.includes('worker') || occ.includes('labour') || occ.includes('मजदूर') || occ.includes('ਮਜ਼ਦੂਰ')) {
    return `The user is a daily wage worker/labourer. Use examples involving: MGNREGA, labour welfare schemes, ESIC, construction worker schemes, e-shram, skill development.`;
  }
  return `The user's occupation is "${occupation}". Personalize examples relevant to their work naturally.`;
}
