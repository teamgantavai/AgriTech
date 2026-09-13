import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Globe,
  Radio,
  UserCheck,
  ChevronRight,
  Target,
  X
} from 'lucide-react';
import { LanguageCode, LANGUAGE_OPTIONS, UserRole, USER_ROLES } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { speakText, stopSpeaking, LANGUAGE_BCP47_MAP } from '../../services/textToSpeech';
import { clsx } from 'clsx';

interface VoiceOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (language: LanguageCode, role: UserRole, interest?: string) => void;
}

export const FEATURED_LANGUAGES: LanguageCode[] = [
  'hi', 'en', 'hi-Latn', 'pa', 'mr', 'gu', 'bn', 'ta', 'te', 'kn', 'ml', 'or', 'as', 'ur'
];

export const LANG_META: Record<string, { greeting: string; flag: string; spokenKeywords: string[] }> = {
  hi: {
    greeting: 'नमस्ते',
    flag: '🇮🇳',
    spokenKeywords: ['hindi', 'हिन्दी', 'हिंदी', 'hindee']
  },
  en: {
    greeting: 'Hello / Welcome',
    flag: '🇮🇳',
    spokenKeywords: ['english', 'inglish', 'अंग्रेजी', 'angreji']
  },
  'hi-Latn': {
    greeting: 'Namaste (Hinglish)',
    flag: '🇮🇳',
    spokenKeywords: ['hinglish', 'hymglish', 'हिंग्लिश']
  },
  pa: {
    greeting: 'ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ',
    flag: '🇮🇳',
    spokenKeywords: ['punjabi', 'panjabi', 'ਪੰਜਾਬੀ', 'पंजाबी']
  },
  mr: {
    greeting: 'नमस्कार',
    flag: '🇮🇳',
    spokenKeywords: ['marathi', 'मराठी', 'marathi bhasha']
  },
  gu: {
    greeting: 'નમસ્તે',
    flag: '🇮🇳',
    spokenKeywords: ['gujarati', 'ગુજરાતી', 'गुजराती']
  },
  bn: {
    greeting: 'নমস্কার',
    flag: '🇮🇳',
    spokenKeywords: ['bengali', 'bangla', 'বাংলা', 'बंगाली']
  },
  ta: {
    greeting: 'வணக்கம்',
    flag: '🇮🇳',
    spokenKeywords: ['tamil', 'தமிழ்', 'तमिल']
  },
  te: {
    greeting: 'నమస్కారం',
    flag: '🇮🇳',
    spokenKeywords: ['telugu', 'తెలుగు', 'तेलुगु']
  },
  kn: {
    greeting: 'ನಮಸ್ಕಾರ',
    flag: '🇮🇳',
    spokenKeywords: ['kannada', 'ಕನ್ನಡ', 'ಕನ್ನಡ']
  },
  ml: {
    greeting: 'നമസ്കാരം',
    flag: '🇮🇳',
    spokenKeywords: ['malayalam', 'മലയാളം', 'मलयालम']
  },
  or: {
    greeting: 'ନମସ୍କାର',
    flag: '🇮🇳',
    spokenKeywords: ['odia', 'oriya', 'ଓଡ଼ିଆ', 'उड़िया']
  },
  as: {
    greeting: 'নমস্কাৰ',
    flag: '🇮🇳',
    spokenKeywords: ['assamese', 'asomiya', 'অসমীয়া', 'অসমিয়া']
  },
  ur: {
    greeting: 'آداب / خوش آمدید',
    flag: '🇮🇳',
    spokenKeywords: ['urdu', 'اردو', 'उर्दू']
  },
};

// 3 Deterministic Audio Questions in User's Selected Language
export const VOICE_PROMPTS: Record<'step1' | 'step2' | 'step3' | 'confirm', Record<string, string>> = {
  // Question 1: Language selection
  step1: {
    hi: 'नमस्ते! आप कौन सी भाषा में शुरू करना चाहेंगे? अपनी भाषा चुनें या बोलें।',
    en: 'Welcome! Which language would you like to start in? Please choose or speak your language.',
    'hi-Latn': 'Namaste! Aap kaun si bhasha me start karenge? Apni bhasha chunein ya bolein.',
    pa: 'ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ! ਤੁਸੀਂ ਕਿਹੜੀ ਭਾਸ਼ਾ ਵਿੱਚ ਸ਼ੁਰੂ ਕਰਨਾ ਚਾਹੋਗੇ? ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ ਜਾਂ ਬੋਲੋ।',
    mr: 'नमस्कार! तुम्ही कोणत्या भाषेत सुरू करू इच्छिता? आपली भाषा निवडा किंवा बोला.',
    gu: 'નમસ્તે! તમે કઈ ભાષામાં શરૂ કરવા માંગો છો? તમારી ભાષા પસંદ કરો અથવા બોલો.',
    bn: 'নমস্কার! আপনি কোন ভাষায় শুরু করতে চান? আপনার ভাষা বেছে নিন বা বলুন।',
    ta: 'வணக்கம்! நீங்கள் எந்த மொழியில் தொடங்க விரும்புகிறீர்கள்? உங்கள் மொழியைத் தேர்வு செய்யவும் அல்லது பேசவும்.',
    te: 'నమస్కారం! మీరు ఏ భాషలో ప్రారంభించాలనుకుంటున్నారు? మీ భాషను ఎంచుకోండి లేదా మాట్లాడండి.',
    kn: 'ನಮಸ್ಕಾರ! ನೀವು ಯಾವ ಭಾಷೆಯಲ್ಲಿ ಪ್ರಾರಂಭಿಸಲು ಬಯಸುತ್ತೀರಿ? ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ ಅಥವಾ ಮಾತನಾಡಿ.',
    ml: 'നമസ്കാരം! നിങ്ങൾ ഏത് ഭാഷയിലാണ് ആരംഭിക്കാൻ ആഗ്രഹിക്കുന്നത്? നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക അല്ലെങ്കിൽ സംസാരിക്കുക.',
    or: 'ନମସ୍କାର! ଆପଣ କେଉଁ ଭାଷାରେ ଆରମ୍ଭ କରିବାକୁ ଚାହାଁନ୍ତି? ଆପଣଙ୍କ ଭାଷା ବାଛନ୍ତୁ କିମ୍ବା କୁହନ୍ତୁ।',
    as: 'নমস্কাৰ! আপুনি কোনটো ভাষাত আৰম্ভ কৰিব বিচাৰে? আপোনাৰ ভাষা বাছক বা কওক।',
    ur: 'آداب! آپ کس زبان میں شروع کرنا چاہتے ہیں؟ اپنی زبان منتخب کریں یا بولیں۔',
  },
  // Question 2: Occupation / Profession (in chosen language)
  step2: {
    hi: 'आपका व्यवसाय क्या है? जैसे - किसान, व्यापारी, कारीगर, या पशुपालक?',
    en: 'What is your profession? For example - Farmer, Trader, Artisan, or Livestock owner?',
    'hi-Latn': 'Aapka vyavsay kya hai? Jaise - Kisan, Vyapari, Karigar, ya Pashupalak?',
    pa: 'ਤੁਹਾਡਾ ਕਾਰੋਬਾਰ ਜਾਂ ਪੇਸ਼ਾ ਕੀ ਹੈ? ਜਿਵੇਂ - ਕਿਸਾਨ, ਵਪਾਰੀ, ਕਾਰੀਗਰ, ਜਾਂ ਡੇਅਰੀ ਕਿਸਾਨ?',
    mr: 'आपला व्यवसाय काय आहे? जसे - शेतकरी, व्यापारी, कारागीर, किंवा पशुपालक?',
    gu: 'તમારો વ્યવસાય શું છે? જેમ કે - ખેડૂત, વેપારી, કારીગર, અથવા પશુપાલક?',
    bn: 'আপনার পেশা কি? যেমন - কৃষক, ব্যবসায়ী, কারিগর, বা পশুপালক?',
    ta: 'உங்கள் தொழில் என்ன? விவசாயி, வணிகர், கைவினைஞர், அல்லது கால்நடை வளர்ப்பவரா?',
    te: 'మీ వృత్తి ఏమిటి? రైతు, వ్యాపారి, చేతివృత్తులవారు, లేదా పశువుల పెంపకందారా?',
    kn: 'ನಿಮ್ಮ ವೃತ್ತಿ ಏನು? ರೈತ, ವ್ಯಾಪಾರಿ, ಕುಶಲಕರ್ಮಿ, ಅಥವಾ ಪಶುಪಾಲಕ?',
    ml: 'നിങ്ങളുടെ തൊഴിൽ എന്താണ്? കർഷകൻ, വ്യാപാരി, കരകൗശല വിദഗ്ധൻ, അല്ലെങ്കിൽ ക്ഷീരകർഷകൻ?',
    or: 'ଆପଣଙ୍କର ବ୍ୟବସାୟ କ’ଣ? ଯେପରିକି - କୃଷକ, ବ୍ୟବସାୟୀ, କାରିଗର, କିମ୍ବା ପଶୁପାଳକ?',
    as: 'আপোনাৰ বৃত্তি কি? যেনে - কৃষক, ব্যৱসায়ী, শিপিনী, বা পশুপালক?',
    ur: 'آپ کا پیشہ کیا ہے؟ جیسے کسان، تاجر، دستکار، یا مویشی پالک؟',
  },
  // Question 3: What are you looking for? (in chosen language)
  step3: {
    hi: 'आप क्या चीज़ ढूंढ रहे हैं? जैसे - फसल ऋण (KCC), सरकारी सब्सिडी, फसल बीमा, या खाद-बीज?',
    en: 'What are you looking for? For example - Crop loan (KCC), government subsidy, crop insurance, or seeds & fertilizer?',
    'hi-Latn': 'Aap kya cheez dhoondh rahe hain? Jaise - KCC Loan, Subsidy, Fasal Bima, ya Khaad-Beej?',
    pa: 'ਤੁਸੀਂ ਕੀ ਚੀਜ਼ ਲੱਭ ਰਹੇ ਹੋ? ਜਿਵੇਂ - ਫ਼ਸਲੀ ਕਰਜ਼ਾ (KCC), ਸਬਸਿਡੀ, ਫ਼ਸਲ ਬੀਮਾ, ਜਾਂ ਖਾਦ-ਬੀਜ?',
    mr: 'तुम्ही काय शोधत आहात? जसे - पीक कर्ज (KCC), सरकारी अनुदान, पीक विमा, किंवा खत-बियाणे?',
    gu: 'તમે શું શોધી રહ્યા છો? જેમ કે - પાક ધિરાણ (KCC), સબસિડી, પાક વીમો, અથવા ખાતર-બિયારણ?',
    bn: 'আপনি কি খুঁজছেন? যেমন - ফসল ঋণ (KCC), সরকারি ভর্তুকি, ফসল বীমা, বা সার-বীজ?',
    ta: 'நீங்கள் என்ன தேடுகிறீர்கள்? பயிர்க் கடன் (KCC), அரசு மானியம், பயிர் காப்பீடு, அல்லது உரம்-விதை?',
    te: 'మీరు ఏమి వెతుకుతున్నారు? పంట రుణం (KCC), ప్రభుత్వ సబ్సిడీ, పంట బీమా, లేదా ఎరువులు-విత్తనాలు?',
    kn: 'ನೀವು ಏನು ಹುಡುಕುತ್ತಿದ್ದೀರಿ? ಬೆಳೆ ಸಾಲ (KCC), ಸರ್ಕಾರಿ ಸಬ್ಸಿಡಿ, ಬೆಳೆ ವಿಮೆ, ಅಥವಾ ಗೊಬ್ಬರ-ಬೀಜ?',
    ml: 'നിങ്ങൾ എന്താണ് തിരയുന്നത്? വിള വായ്പ (KCC), സർക്കാർ സബ്സിഡി, വിള ഇൻഷുറൻസ്, അല്ലെങ്കിൽ വളം-വിത്ത്?',
    or: 'ଆପଣ କ’ଣ ଖୋଜୁଛନ୍ତି? ଯେପରିକି - ଫସଲ ଋଣ (KCC), ସରକାରୀ ସବସିଡି, ଫସଲ ବୀମା, କିମ୍ବା ସାର-ବିହନ?',
    as: 'আপুনি কি বিচাৰিছে? যেনে - শস্য ঋণ (KCC), ৰাজসাহায্য, শস্য বীমা, বা সাৰ-বীজ?',
    ur: 'آپ کیا چیز تلاش کر رہے ہیں؟ جیسے فصلی قرض (KCC)، सरकारी سبسڈی، فصل بیمہ، یا کھاد اور بیج؟',
  },
  confirm: {
    hi: 'बहुत बढ़िया! आपकी पसंद के अनुसार सहकार साथी तैयार है। आप सीधे बोलकर सवाल पूछ सकते हैं।',
    en: 'Awesome! Sahkar Sathi is personalized and ready for you. You can speak directly with AI right now.',
    'hi-Latn': 'Bahut badhiya! Aapki personalization ke anusaar Sahkar Saathi ready hai. Aap seedhe bolkar sawaal poochhein.',
    pa: 'ਬਹੁਤ ਵਧੀਆ! ਤੁਹਾਡੀ ਪਸੰਦ ਅਨੁਸਾਰ ਸਹਿਕਾਰ ਸਾਥੀ ਤਿਆਰ ਹੈ। ਤੁਸੀਂ ਸਿੱਧਾ ਬੋਲ ਕੇ ਸਵਾਲ ਪੁੱਛ ਸਕਦੇ ਹੋ।',
    mr: 'खूप छान! तुमच्या पसंतीनुसार सहकार साथी सज्ज आहे. आपण थेट बोलून प्रश्न विचारू शकता.',
    gu: 'ખૂબ સરસ! તમારી પસંદગી મુજબ સહકાર સાથી તૈયાર છે. તમે સીધા બોલીને પ્રશ્ન પૂછી શકો છો.',
    bn: 'দারুণ! আপনার পছন্দ অনুযায়ী সহকার সাথী প্রস্তুত। আপনি সরাসরি কথা বলে প্রশ্ন করতে পারেন।',
    ta: 'அருமை! உங்கள் விருப்பப்படி சககார் சாதி தயாராக உள்ளது. நீங்கள் நேரடியாகப் பேசி கேள்வி கேட்கலாம்.',
    te: 'చాలా బాగుంది! మీ ప్రాధాన్యతల ప్రకారం సహకార్ సాథీ సిద్ధంగా ఉంది. మీరు నేరుగా మాట్లాడి ప్రశ్నలు అడగవచ్చు.',
    kn: 'ಅತ್ಯುತ್ತಮ! ನಿಮ್ಮ ಆಯ್ಕೆಯಂತೆ ಸಹಕಾರ ಸಾಥಿ ಸಿದ್ಧವಾಗಿದೆ. ನೀವು ನೇರವಾಗಿ ಮಾತನಾಡಿ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಬಹುದು.',
    ml: 'വളരെ നല്ലത്! നിങ്ങളുടെ മുൻഗണന അനുസരിച്ച് സഹകാർ സാഥി തയ്യാറാണ്. നിങ്ങൾക്ക് നേരിട്ട് സംസാരിച്ച് ചോദ്യങ്ങൾ ചോദിക്കാം.',
    or: 'ବହୁତ ଭଲ! ଆପଣଙ୍କ ପସନ୍ଦ ଅନୁସାରେ ସହକାର ସାଥୀ ପ୍ରସ୍ତୁତ। ଆପଣ ସିଧା କଥା କହି ପ୍ରଶ୍ନ ପଚାରିପାରିବେ।',
    as: 'বৰ ভাল কথা! আপোনাৰ পছন্দ অনুসৰি সহকাৰ সাথী সাজু হৈছে। আপুনি পোনপটীয়াকৈ কথা কৈ প্ৰশ্ন সুধিব পাৰে।',
    ur: 'بہت خوب! آپ کی ترجیح کے مطابق سہکار ساتھی تیار ہے۔ آپ براہ راست بول کر سوال پوچھ سکتے ہیں۔',
  }
};

export interface InterestOption {
  id: string;
  emoji: string;
  titleHi: string;
  titleEn: string;
  benefitHi: string;
  speechKeywords: string[];
}

export const ROLE_INTEREST_MAP: Record<UserRole, InterestOption[]> = {
  farmer: [
    {
      id: 'kcc',
      emoji: '💳',
      titleHi: 'किसान क्रेडिट कार्ड (KCC)',
      titleEn: 'KCC Crop Loan',
      benefitHi: '4% ब्याज पर ₹3 लाख तक का सस्ता फसली ऋण',
      speechKeywords: ['kcc', 'loan', 'credit', 'लोन', 'कर्ज', 'ऋण', 'केसीसी', 'फसली कर्ज']
    },
    {
      id: 'pm-kisan',
      emoji: '🎁',
      titleHi: 'पीएम किसान (PM-KISAN)',
      titleEn: 'PM-KISAN ₹6,000',
      benefitHi: 'हर साल ₹6,000 की सीधी आर्थिक सहायता',
      speechKeywords: ['pm-kisan', 'kisan samman', 'सम्मान', '६०००', '6000', 'किस्त', 'पीएम किसान']
    },
    {
      id: 'pmfby',
      emoji: '🛡️',
      titleHi: 'फसल बीमा (PMFBY)',
      titleEn: 'Crop Insurance',
      benefitHi: 'सूखा, बाढ़ या कीट से फसल नुकसान पर पूरा मुआवजा',
      speechKeywords: ['bima', 'fasal bima', 'insurance', 'बीमा', 'मुआवजा', 'नुकसान', 'फसल बीमा']
    },
    {
      id: 'tractor-subsidy',
      emoji: '🚜',
      titleHi: 'ट्रैक्टर व कृषि यंत्र सब्सिडी',
      titleEn: 'Machinery Subsidy',
      benefitHi: 'कृषि उपकरणों पर 40% से 50% सरकारी छूट',
      speechKeywords: ['tractor', 'subsidy', 'ट्रैक्टर', 'सब्सिडी', 'मशीन', 'यंत्र', 'उपकरण']
    },
    {
      id: 'fertilizer-seeds',
      emoji: '🌱',
      titleHi: 'रियायती खाद व उन्नत बीज',
      titleEn: 'Subsidized Seeds & Fertilizer',
      benefitHi: 'पैक्स समिति से सरकारी दर पर खाद व प्रमाणित बीज',
      speechKeywords: ['khaad', 'beej', 'fertilizer', 'seed', 'खाद', 'बीज', 'यूरिया', 'डीएपी']
    },
    {
      id: 'pm-kusum',
      emoji: '☀️',
      titleHi: 'सोलर पंप (PM-KUSUM)',
      titleEn: 'Solar Water Pump',
      benefitHi: 'खेत में सोलर वाटर पंप लगाने हेतु 60% सब्सिडी',
      speechKeywords: ['solar', 'pump', 'kusum', 'सोलर', 'पंप', 'सिंचाई', 'कुसुम']
    },
  ],
  shopkeeper: [
    {
      id: 'svanidhi',
      emoji: '🏪',
      titleHi: 'पीएम स्वनिधि (PM SVANidhi)',
      titleEn: 'Street Vendor Loan',
      benefitHi: '₹10,000 से ₹50,000 तक बिना गारंटी कार्यशील लोन',
      speechKeywords: ['svanidhi', 'vendor', 'स्वनिधि', 'रेहड़ी', 'दुकान', 'लोन']
    },
    {
      id: 'mudra',
      emoji: '💼',
      titleHi: 'मुद्रा व्यापार ऋण (PMMY Mudra)',
      titleEn: 'Mudra Business Loan',
      benefitHi: 'दुकान या व्यापार बढ़ाने हेतु ₹10 लाख तक लोन',
      speechKeywords: ['mudra', 'business loan', 'मुद्रा', 'व्यापार', 'लोन']
    },
    {
      id: 'working-capital',
      emoji: '📊',
      titleHi: 'व्यापार वर्किंग कैपिटल व क्रेडिट',
      titleEn: 'Working Capital',
      benefitHi: 'दुकान के माल व इन्वेंटरी हेतु सुलभ साख',
      speechKeywords: ['credit', 'capital', 'पूंजी', 'उधार', 'स्टॉक']
    },
  ],
  trader: [
    {
      id: 'mudra',
      emoji: '💼',
      titleHi: 'मुद्रा व्यापार ऋण (PMMY Mudra)',
      titleEn: 'Mudra Trader Loan',
      benefitHi: 'व्यापार विस्तार हेतु ₹10 लाख तक सुलभ लोन',
      speechKeywords: ['mudra', 'business loan', 'मुद्रा', 'व्यापार', 'लोन']
    },
    {
      id: 'mandi-license',
      emoji: '🏛️',
      titleHi: 'मंडी व ई-नाम (e-NAM) व्यापार',
      titleEn: 'e-NAM Trading',
      benefitHi: 'राष्ट्रीय कृषि बाजार पर फसल खरीद-बिक्री व लाइसेंस',
      speechKeywords: ['mandi', 'enam', 'मंडी', 'ई-नाम', 'लाइसेंस']
    },
  ],
  artisan: [
    {
      id: 'vishwakarma-kit',
      emoji: '⚒️',
      titleHi: 'पीएम विश्वकर्मा ₹15,000 टूलकिट वाउचर',
      titleEn: 'Toolkit e-Voucher',
      benefitHi: '18 पारंपरिक दस्तकारों हेतु ₹15,000 मुफ्त टूलकिट',
      speechKeywords: ['vishwakarma', 'toolkit', 'विश्वकर्मा', 'टूलकिट', 'औजार']
    },
    {
      id: 'vishwakarma-loan',
      emoji: '🪙',
      titleHi: '₹3 लाख सस्ता विश्वकर्मा ऋण',
      titleEn: '5% Collateral-Free Loan',
      benefitHi: 'केवल 5% रियायती ब्याज पर बिना गारंटी ऋण',
      speechKeywords: ['loan', 'credit', 'लोन', 'ऋण', 'सस्ता', 'विश्वकर्मा लोन']
    },
    {
      id: 'artisan-training',
      emoji: '📚',
      titleHi: 'हुनर प्रशिक्षण व ₹500/दिन स्टाइपेंड',
      titleEn: 'Skill Training & Stipend',
      benefitHi: 'आधुनिक कौशल ट्रेनिंग और प्रतिदिन ₹500 भत्ता',
      speechKeywords: ['training', 'stipend', 'ट्रेनिंग', 'हुनर', 'स्टाइपेंड']
    },
  ],
  dairy_livestock: [
    {
      id: 'pashu-kcc',
      emoji: '🐄',
      titleHi: 'पशु किसान क्रेडिट कार्ड (Pashu KCC)',
      titleEn: 'Livestock KCC Loan',
      benefitHi: 'गाय, भैंस, बकरी हेतु ₹1.60 लाख तक बिना गारंटी लोन',
      speechKeywords: ['pashu kcc', 'cow', 'dairy', 'पशु', 'गाय', 'भैंस', 'केसीसी']
    },
    {
      id: 'dairy-infra',
      emoji: '🥛',
      titleHi: 'डेयरी इंफ्रास्ट्रक्चर व शेड सब्सिडी',
      titleEn: 'Dairy Farm Subsidy',
      benefitHi: 'डेयरी फार्म, चिलिंग प्लांट व शेड निर्माण पर अनुदान',
      speechKeywords: ['dairy subsidy', 'shed', 'डेयरी', 'फार्म', 'सब्सिडी']
    },
    {
      id: 'animal-health',
      emoji: '💉',
      titleHi: 'पशु टीकाकरण व नस्ल सुधार',
      titleEn: 'Animal Health & Breeding',
      benefitHi: 'निःशुल्क खुरपका-मुंहपका टीका व कृत्रिम गर्भाधान',
      speechKeywords: ['vaccine', 'health', 'टीका', 'इलाज', 'नस्ल']
    },
  ],
  cooperative_member: [
    {
      id: 'pacs-membership',
      emoji: '🏛️',
      titleHi: 'पैक्स समिति सदस्यता व शेयर पूँजी',
      titleEn: 'PACS Membership',
      benefitHi: 'गांव की पैक्स में शेयरधारक बनकर सरकारी लाभ पाएं',
      speechKeywords: ['pacs', 'member', 'पैक्स', 'सदस्य', 'शेयर']
    },
    {
      id: 'storage-godown',
      emoji: '🏢',
      titleHi: 'गांव का गोदाम व कोल्ड स्टोरेज',
      titleEn: 'Cooperative Storage',
      benefitHi: 'फसल सुरक्षित रखने हेतु पैक्स गोदाम सुविधा',
      speechKeywords: ['storage', 'godown', 'गोदाम', 'भंडारण']
    },
  ],
  women_shg: [
    {
      id: 'lakhpati-didi',
      emoji: '👩‍🌾',
      titleHi: 'लखपति दीदी व स्वयं सहायता समूह',
      titleEn: 'Lakhpati Didi SHG',
      benefitHi: 'ग्रामीण महिलाओं की ₹1 लाख वार्षिक आय का लक्ष्य',
      speechKeywords: ['lakhpati', 'shg', 'लखपति', 'दीदी', 'समूह']
    },
    {
      id: 'drone-didi',
      emoji: '🚁',
      titleHi: 'नमो ड्रोन दीदी (80% सब्सिडी)',
      titleEn: 'Drone Didi Subsidy',
      benefitHi: 'कृषि ड्रोन पायलट प्रशिक्षण व 80% सरकारी सब्सिडी',
      speechKeywords: ['drone', 'drone didi', 'ड्रोन', 'दीदी']
    },
  ],
  student_citizen: [
    {
      id: 'agri-startup',
      emoji: '🚀',
      titleHi: 'कृषि स्टार्ट-अप व युवा उद्यमी योजना',
      titleEn: 'Agri Startup Grant',
      benefitHi: 'युवाओं के लिए कृषि व्यवसाय हेतु सीड फंड व अनुदान',
      speechKeywords: ['startup', 'entrepreneur', 'स्टार्टअप', 'उद्यमी']
    },
    {
      id: 'skill-dev',
      emoji: '🎓',
      titleHi: 'कृषि कौशल विकास व छात्रवृत्ति',
      titleEn: 'Skill Training & Fellowship',
      benefitHi: 'आधुनिक कृषि तकनीक प्रशिक्षण व प्रमाणन',
      speechKeywords: ['skill', 'training', 'कौशल', 'ट्रेनिंग']
    },
  ],
};

export function VoiceOnboardingModal({
  isOpen,
  onClose,
  onComplete,
}: VoiceOnboardingModalProps) {
  const { language: currentAppLanguage, setLanguage } = useLanguage();

  // 3-Step sequential onboarding questionnaire
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(currentAppLanguage || 'hi');
  const [selectedRole, setSelectedRole] = useState<UserRole>('farmer');
  const [selectedInterest, setSelectedInterest] = useState<string>('');

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedTranscript, setRecognizedTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [hasAutoplayBlocked, setHasAutoplayBlocked] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isComponentMounted = useRef(true);

  const startListeningRef = useRef<() => void>(() => {});
  const handleSelectLanguageRef = useRef<(lang: LanguageCode, byVoice?: boolean) => void>(() => {});
  const handleSelectRoleRef = useRef<(role: UserRole, byVoice?: boolean) => void>(() => {});
  const handleSelectInterestRef = useRef<(interest: string, byVoice?: boolean) => void>(() => {});

  // Initialize Speech Recognition
  const initSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) return null;

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      recognition.lang = step === 1 ? 'hi-IN' : (LANGUAGE_BCP47_MAP[selectedLanguage] || 'hi-IN');
      return recognition;
    } catch (err) {
      console.warn('[Onboarding] Speech recognition init failed:', err);
      return null;
    }
  }, [step, selectedLanguage]);

  // Start listening for voice commands
  const startListeningMode = useCallback(() => {
    if (!recognitionRef.current) {
      const rec = initSpeechRecognition();
      if (rec) recognitionRef.current = rec;
    }

    const rec = recognitionRef.current;
    if (!rec) return;

    try {
      rec.onstart = () => {
        setIsListening(true);
        setStatusMessage(
          step === 1
            ? '🎙️ बोलें अपनी भाषा (उदा. हिंदी, English, मराठी, ਪੰਜਾਬੀ...)'
            : step === 2
            ? '🎙️ बोलें अपना व्यवसाय (उदा. किसान, व्यापारी, कारीगर, पशुपालक...)'
            : '🎙️ बोलें आप क्या ढूंढ रहे हैं (उदा. KCC लोन, पीएम किसान, सब्सिडी...)'
        );
      };

      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript.toLowerCase();
        }
        setRecognizedTranscript(transcript);

        if (step === 1) {
          // Question 1: Detect language match
          for (const [code, meta] of Object.entries(LANG_META)) {
            if (meta.spokenKeywords.some((kw) => transcript.includes(kw.toLowerCase()))) {
              handleSelectLanguageRef.current(code as LanguageCode, true);
              return;
            }
          }
        } else if (step === 2) {
          // Question 2: Detect occupation / role match
          for (const role of USER_ROLES) {
            if (role.speechKeywords.some((kw) => transcript.includes(kw.toLowerCase()))) {
              handleSelectRoleRef.current(role.id, true);
              return;
            }
          }
        } else if (step === 3) {
          // Question 3: Detect interest / search item
          const currentOptions = ROLE_INTEREST_MAP[selectedRole] || ROLE_INTEREST_MAP.farmer;
          for (const opt of currentOptions) {
            if (opt.speechKeywords.some((kw) => transcript.includes(kw.toLowerCase()))) {
              handleSelectInterestRef.current(opt.titleHi, true);
              return;
            }
          }
          // If phrase is clear, take full phrase
          if (transcript.trim().length > 4) {
            handleSelectInterestRef.current(transcript.trim(), true);
          }
        }
      };

      rec.onerror = (e: any) => {
        console.warn('[Onboarding] Speech recognition event:', e.error);
        if (e.error !== 'no-speech') {
          setIsListening(false);
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.start();
    } catch {
      // Already active
    }
  }, [initSpeechRecognition, step, selectedRole]);

  useEffect(() => {
    startListeningRef.current = startListeningMode;
  }, [startListeningMode]);

  const stopListeningMode = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Instant local speech synthesizer (0ms network delay)
  const speakPrompt = useCallback((text: string, langCode: string = 'hi') => {
    if (isMuted) return;

    stopSpeaking();
    setIsSpeaking(true);

    try {
      const utterance = speakText(text, langCode, {
        rate: 0.98,
        pitch: 1.02,
        onStart: () => {
          setIsSpeaking(true);
          setHasAutoplayBlocked(false);
        },
        onEnd: () => {
          setIsSpeaking(false);
          startListeningRef.current();
        },
        onError: (err) => {
          setIsSpeaking(false);
          if (err && err.error === 'not-allowed') {
            setHasAutoplayBlocked(true);
          }
        },
      });

      if (!utterance) setIsSpeaking(false);
    } catch {
      setIsSpeaking(false);
      setHasAutoplayBlocked(true);
    }
  }, [isMuted]);

  // Transition to Question 2 (Occupation / Vyavsay)
  const transitionToStep2 = useCallback((chosenLang: LanguageCode) => {
    setStep(2);
    setRecognizedTranscript('');
    stopListeningMode();

    const promptText =
      (VOICE_PROMPTS.step2 as Record<string, string>)[chosenLang] ||
      VOICE_PROMPTS.step2.hi;

    setTimeout(() => {
      speakPrompt(promptText, chosenLang);
    }, 200);
  }, [speakPrompt, stopListeningMode]);

  // Transition to Question 3 (What are you looking for?)
  const transitionToStep3 = useCallback((chosenRole: UserRole, chosenLang: LanguageCode) => {
    setStep(3);
    setRecognizedTranscript('');
    stopListeningMode();

    const promptText =
      (VOICE_PROMPTS.step3 as Record<string, string>)[chosenLang] ||
      VOICE_PROMPTS.step3.hi;

    setTimeout(() => {
      speakPrompt(promptText, chosenLang);
    }, 200);
  }, [speakPrompt, stopListeningMode]);

  // Handle Question 1 Answer (Language)
  const handleSelectLanguage = useCallback((lang: LanguageCode, byVoice: boolean = false) => {
    setSelectedLanguage(lang);
    setLanguage(lang);
    if (byVoice) {
      setStatusMessage(`✅ भाषा पहचानी गई: ${LANG_META[lang]?.greeting || lang}`);
    }
    transitionToStep2(lang);
  }, [setLanguage, transitionToStep2]);

  // Handle Question 2 Answer (Occupation / Vyavsay)
  const handleSelectRole = useCallback((role: UserRole, byVoice: boolean = false) => {
    setSelectedRole(role);
    if (byVoice) {
      const found = USER_ROLES.find((r) => r.id === role);
      setStatusMessage(`✅ व्यवसाय पहचाना गया: ${found?.titleHi || role}`);
    }
    transitionToStep3(role, selectedLanguage);
  }, [selectedLanguage, transitionToStep3]);

  // Handle Question 3 Answer (What are you looking for?) & Complete Personalization
  const handleSelectInterest = useCallback((interest: string, byVoice: boolean = false) => {
    setSelectedInterest(interest);
    stopListeningMode();

    if (byVoice) {
      setStatusMessage(`✅ पसंद पहचानी गई: ${interest}`);
    }

    const confirmText =
      (VOICE_PROMPTS.confirm as Record<string, string>)[selectedLanguage] ||
      VOICE_PROMPTS.confirm.hi;

    // Instant spoken confirmation
    speakPrompt(confirmText, selectedLanguage);

    // Save preferences
    try {
      localStorage.setItem('sahkar_user_role', selectedRole);
      localStorage.setItem('sahkar_user_lang', selectedLanguage);
      localStorage.setItem('sahkar_user_interest', interest);
      localStorage.setItem('sahkar_onboarding_completed', 'true');
      localStorage.setItem('sahkar_sathi_lang_picked', 'true');
      window.dispatchEvent(
        new CustomEvent('user-role-updated', {
          detail: { role: selectedRole, lang: selectedLanguage, interest },
        })
      );
    } catch {}

    // Complete & hand off to personalized AI talk
    setTimeout(() => {
      onComplete(selectedLanguage, selectedRole, interest);
    }, 1200);
  }, [selectedLanguage, selectedRole, stopListeningMode, speakPrompt, onComplete]);

  useEffect(() => {
    handleSelectLanguageRef.current = handleSelectLanguage;
  }, [handleSelectLanguage]);

  useEffect(() => {
    handleSelectRoleRef.current = handleSelectRole;
  }, [handleSelectRole]);

  useEffect(() => {
    handleSelectInterestRef.current = handleSelectInterest;
  }, [handleSelectInterest]);

  // Initial Question 1 trigger on open
  useEffect(() => {
    isComponentMounted.current = true;

    if (isOpen) {
      const timer = setTimeout(() => {
        const q1Text = `${VOICE_PROMPTS.step1.hi} ${VOICE_PROMPTS.step1.en}`;
        speakPrompt(q1Text, 'hi');
      }, 300);

      return () => {
        clearTimeout(timer);
        stopSpeaking();
        stopListeningMode();
      };
    }
  }, [isOpen, speakPrompt, stopListeningMode]);

  const handleReplayVoice = () => {
    if (step === 1) {
      speakPrompt(`${VOICE_PROMPTS.step1.hi} ${VOICE_PROMPTS.step1.en}`, 'hi');
    } else if (step === 2) {
      const promptText =
        (VOICE_PROMPTS.step2 as Record<string, string>)[selectedLanguage] ||
        VOICE_PROMPTS.step2.hi;
      speakPrompt(promptText, selectedLanguage);
    } else {
      const promptText =
        (VOICE_PROMPTS.step3 as Record<string, string>)[selectedLanguage] ||
        VOICE_PROMPTS.step3.hi;
      speakPrompt(promptText, selectedLanguage);
    }
  };

  const toggleMute = () => {
    if (!isMuted) {
      stopSpeaking();
      setIsSpeaking(false);
      setIsMuted(true);
    } else {
      setIsMuted(false);
      handleReplayVoice();
    }
  };

  if (!isOpen) return null;

  const featuredOptions = LANGUAGE_OPTIONS.filter((opt) =>
    FEATURED_LANGUAGES.includes(opt.code as LanguageCode)
  );

  const interestOptions = ROLE_INTEREST_MAP[selectedRole] || ROLE_INTEREST_MAP.farmer;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-neutral-950/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-100 flex flex-col max-h-[92vh]">
        {/* Soft Ambient Background Glows */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-emerald-100/70 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-amber-100/60 blur-3xl pointer-events-none" />

        {/* Top Header with Step Progress */}
        <div className="relative z-10 bg-gradient-to-r from-emerald-700 via-emerald-800 to-brand-900 text-white px-5 sm:px-8 py-4 sm:py-5 flex items-center justify-between border-b border-emerald-600/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Sparkles size={20} className="text-emerald-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">
                  सहकार साथी
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                  सवाल {step} of 3
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 font-medium mt-0.5">
                {step === 1
                  ? 'प्रश्न 1: आप कौन सी भाषा में शुरू करेंगे?'
                  : step === 2
                  ? 'प्रश्न 2: आपका व्यवसाय क्या है?'
                  : 'प्रश्न 3: आप क्या चीज़ ढूंढ रहे हैं?'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReplayVoice}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-100 hover:text-white transition-colors"
              title="पुनः सुनें / Replay Voice"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={toggleMute}
              className={clsx(
                'p-2 rounded-xl transition-colors',
                isMuted
                  ? 'bg-red-500/30 text-red-200 hover:bg-red-500/40'
                  : 'bg-white/10 hover:bg-white/20 text-emerald-100 hover:text-white'
              )}
              title={isMuted ? 'Unmute AI' : 'Mute AI'}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors ml-1"
              title="बंद करें / Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Real-time Speaking / Listening Wave Banner */}
        <div className="relative z-10 bg-gradient-to-r from-emerald-50 via-brand-50/70 to-amber-50/50 border-b border-neutral-100 px-5 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white shadow-sm flex-shrink-0">
              {isSpeaking ? (
                <div className="flex items-center gap-0.5">
                  <span className="w-1 h-3 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1 h-5 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1 h-2.5 bg-white rounded-full animate-bounce" />
                </div>
              ) : isListening ? (
                <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
              ) : (
                <Radio size={16} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-neutral-800">
                  {isSpeaking
                    ? 'AI आवाज़ बोल रही है...'
                    : isListening
                    ? '🎙️ AI आपकी आवाज़ सुन रहा है...'
                    : 'बोलें या नीचे कार्ड पर क्लिक करें'}
                </span>
                {isListening && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full animate-pulse">
                    माइक सक्रिय
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                {statusMessage ||
                  (step === 1
                    ? 'Say "Hindi", "English", "मराठी", "ਪੰਜਾਬੀ" or click below'
                    : step === 2
                    ? 'Say "Kisan", "Farmer", "Vyapari", "Karigar" or click below'
                    : 'Say "KCC Loan", "Fasal Bima", "Subsidy" or click below')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {hasAutoplayBlocked && (
              <button
                onClick={handleReplayVoice}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow hover:bg-emerald-700 active:scale-95 transition-all"
              >
                <Volume2 size={14} />
                <span>🔊 AI आवाज़ चलाएं</span>
              </button>
            )}

            <button
              onClick={() => {
                if (isListening) {
                  stopListeningMode();
                } else {
                  startListeningMode();
                }
              }}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 cursor-pointer',
                isListening
                  ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
              )}
            >
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
              <span>{isListening ? 'माइक रोकें' : 'माइक से बोलें'}</span>
            </button>
          </div>
        </div>

        {/* Live Recognized Speech Transcript */}
        {recognizedTranscript && (
          <div className="bg-emerald-100/70 border-b border-emerald-200/60 px-5 sm:px-8 py-2 flex items-center gap-2 text-xs text-emerald-900">
            <Mic size={13} className="text-emerald-700 animate-pulse flex-shrink-0" />
            <span className="font-semibold">पहचाना गया:</span>
            <span className="italic bg-white/80 px-2.5 py-0.5 rounded-md border border-emerald-300 font-medium">
              "{recognizedTranscript}"
            </span>
          </div>
        )}

        {/* Questionnaire Body (Step 1, Step 2, or Step 3) */}
        <div className="relative z-10 p-5 sm:p-7 overflow-y-auto flex-1">
          {step === 1 ? (
            /* QUESTION 1: LANGUAGE SELECTION */
            <div>
              <div className="mb-4">
                <h3 className="text-base sm:text-lg font-black text-neutral-900 flex items-center gap-2">
                  <Globe size={18} className="text-emerald-600" />
                  <span>आप कौन सी भाषा में शुरू करेंगे? / Which language?</span>
                </h3>
                <p className="text-xs text-neutral-600 mt-1">
                  सीधे बोलकर बताएं (जैसे: "हिंदी", "English", "मराठी", "पंजाबी") या नीचे क्लिक करें:
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {featuredOptions.map((opt) => {
                  const meta = LANG_META[opt.code] ?? { greeting: '', flag: '🇮🇳' };
                  const isSelected = selectedLanguage === opt.code;

                  return (
                    <button
                      key={opt.code}
                      onClick={() => handleSelectLanguage(opt.code as LanguageCode)}
                      className={clsx(
                        'group flex items-center gap-3 p-3 rounded-2xl border text-left transition-all duration-150 relative overflow-hidden cursor-pointer',
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/90 text-emerald-950 shadow-sm ring-2 ring-emerald-500/30'
                          : 'border-neutral-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/40 hover:shadow-soft'
                      )}
                    >
                      <span className="text-2xl leading-none flex-shrink-0">{meta.flag}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-neutral-900 text-sm leading-tight group-hover:text-emerald-700 transition-colors">
                          {opt.nativeLabel}
                        </div>
                        <div className="text-neutral-500 text-[11px] leading-tight mt-0.5 truncate">
                          {meta.greeting}
                        </div>
                      </div>
                      <ChevronRight
                        size={14}
                        className={clsx(
                          'text-neutral-300 transition-all group-hover:text-emerald-600 group-hover:translate-x-0.5 flex-shrink-0',
                          isSelected && 'text-emerald-600 font-bold'
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : step === 2 ? (
            /* QUESTION 2: OCCUPATION / VYAVSAY */
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-black text-neutral-900 flex items-center gap-2">
                    <UserCheck size={18} className="text-emerald-600" />
                    <span>आपका व्यवसाय क्या है? / What is your occupation?</span>
                  </h3>
                  <button
                    onClick={() => {
                      setStep(1);
                      speakPrompt(VOICE_PROMPTS.step1.hi, 'hi');
                    }}
                    className="text-xs text-emerald-700 hover:underline font-bold cursor-pointer"
                  >
                    ← भाषा बदलें
                  </button>
                </div>
                <p className="text-xs text-neutral-600 mt-1">
                  सीधे बोलें या अपना व्यवसाय चुनें ताकि सहकार साथी आपके अनुकूल सटीक योजनाएं बताए:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {USER_ROLES.map((role) => {
                  const isSelected = selectedRole === role.id;

                  return (
                    <button
                      key={role.id}
                      onClick={() => handleSelectRole(role.id)}
                      className={clsx(
                        'group text-left p-3.5 rounded-2xl border transition-all duration-150 relative flex flex-col justify-between cursor-pointer',
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/90 shadow-md ring-2 ring-emerald-500/40'
                          : 'border-neutral-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/30 hover:shadow-soft'
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-2xl p-1 rounded-xl bg-neutral-50 border border-neutral-100 shadow-2xs">
                            {role.emoji}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {role.subtitleHi}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-neutral-900 text-sm leading-snug group-hover:text-emerald-700 transition-colors">
                          {role.titleHi}
                        </h4>
                        <p className="text-[11px] text-neutral-600 mt-0.5 leading-relaxed line-clamp-2">
                          {role.descHi}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-neutral-100 text-xs font-bold text-emerald-700">
                        <span>{isSelected ? 'चयनित ✅' : 'यह चुनें'}</span>
                        <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* QUESTION 3: WHAT ARE YOU LOOKING FOR? (AAP KYA CHEEZ DHUNDH RHE HAI) */
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-black text-neutral-900 flex items-center gap-2">
                    <Target size={18} className="text-emerald-600" />
                    <span>आप क्या चीज़ ढूंढ रहे हैं? / What are you looking for?</span>
                  </h3>
                  <button
                    onClick={() => {
                      setStep(2);
                      const promptText =
                        (VOICE_PROMPTS.step2 as Record<string, string>)[selectedLanguage] ||
                        VOICE_PROMPTS.step2.hi;
                      speakPrompt(promptText, selectedLanguage === 'en' ? 'en' : 'hi');
                    }}
                    className="text-xs text-emerald-700 hover:underline font-bold cursor-pointer"
                  >
                    ← व्यवसाय बदलें
                  </button>
                </div>
                <p className="text-xs text-neutral-600 mt-1">
                  माइक में बोलें या अपनी प्राथमिकता चुनें (उदा. KCC लोन, सब्सिडी, फसल बीमा):
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {interestOptions.map((opt) => {
                  const isSelected = selectedInterest === opt.titleHi;

                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectInterest(opt.titleHi)}
                      className={clsx(
                        'group text-left p-3.5 rounded-2xl border transition-all duration-150 relative flex flex-col justify-between cursor-pointer',
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/90 shadow-md ring-2 ring-emerald-500/40'
                          : 'border-neutral-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/30 hover:shadow-soft'
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-2xl p-1 rounded-xl bg-neutral-50 border border-neutral-100 shadow-2xs">
                            {opt.emoji}
                          </span>
                          <div>
                            <h4 className="font-extrabold text-neutral-900 text-sm leading-snug group-hover:text-emerald-700 transition-colors">
                              {opt.titleHi}
                            </h4>
                            <span className="text-[10px] text-neutral-400 font-medium">
                              {opt.titleEn}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-emerald-700 font-semibold mt-1 leading-relaxed">
                          {opt.benefitHi}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-neutral-100 text-xs font-bold text-emerald-700">
                        <span>{isSelected ? 'चयनित ✅' : 'यह जानकारी चाहिए'}</span>
                        <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="relative z-10 bg-neutral-50 border-t border-neutral-200/80 px-5 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>तीनों सवालों के बाद AI से सीधा संवाद शुरू होगा</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-neutral-200 text-neutral-600 text-xs font-semibold hover:bg-neutral-100 cursor-pointer"
            >
              रद्द करें
            </button>
            {step === 1 && (
              <button
                onClick={() => transitionToStep2(selectedLanguage)}
                className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow flex items-center gap-1 cursor-pointer"
              >
                <span>आगे बढ़ें</span>
                <ArrowRight size={13} />
              </button>
            )}
            {step === 2 && (
              <button
                onClick={() => transitionToStep3(selectedRole, selectedLanguage)}
                className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow flex items-center gap-1 cursor-pointer"
              >
                <span>आगे बढ़ें</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
