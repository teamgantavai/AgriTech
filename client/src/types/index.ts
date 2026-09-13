// Core message types
export type MessageRole = 'user' | 'assistant';
export type SourceType = 'knowledge_base' | 'ai_general' | 'knowledge_base_and_ai' | 'error';
export type LanguageCode =
  | 'hi' | 'en' | 'hi-Latn' | 'pa' | 'bn' | 'mr' | 'gu'
  | 'ta' | 'te' | 'kn' | 'ml' | 'or' | 'as' | 'ur' | 'auto' | 'unknown';

export interface DetectedLanguage {
  code: LanguageCode;
  displayName: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  language?: LanguageCode;
  detectedLanguage?: DetectedLanguage;
  sourceType?: SourceType;
  hasKBContext?: boolean;
  isLoading?: boolean;
  suggestions?: string[];
}

// Chat conversation in localStorage
export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
}

// API types
export interface ChatRequest {
  message: string;
  history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  forceLanguage?: LanguageCode;
  voiceMode?: boolean;
  role?: string;
  interest?: string;
}

export interface ChatApiResponse {
  answer: string;
  language?: LanguageCode;
  sourceType: SourceType;
  detectedLanguage: DetectedLanguage;
  hasKBContext: boolean;
  suggestions?: string[];
}

export interface StatsApiResponse {
  totalRecords: number;
  categories: string[];
  languagesSupported: number;
  domains: number;
  aiModel: string;
  voiceEnabled: boolean;
}

// Language options for the selector
export const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; label: string; nativeLabel: string }> = [
  { code: 'auto', label: 'Auto Detect', nativeLabel: 'Auto Detect' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'hi-Latn', label: 'Hinglish', nativeLabel: 'Hinglish' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം' },
  { code: 'or', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ' },
  { code: 'as', label: 'Assamese', nativeLabel: 'অসমীয়া' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو' },
];

// User Persona / Role types
export type UserRole =
  | 'farmer'
  | 'shopkeeper'
  | 'artisan'
  | 'dairy_livestock'
  | 'women_shg'
  | 'cooperative_member'
  | 'trader'
  | 'student_citizen';

export interface UserRoleOption {
  id: UserRole;
  emoji: string;
  title: string;
  titleHi: string;
  titleEn?: string;
  subtitle: string;
  subtitleHi: string;
  desc: string;
  descHi: string;
  speechKeywords: string[];
  recommendedPrompts: { text: string; lang: string }[];
}

export interface PersonalizedService {
  id: string;
  schemeId: string;
  emoji: string;
  title: string;
  titleHi: string;
  badge: string;
  benefitHi: string;
  descHi: string;
  voicePrompt: string;
}

export interface PersonalizedCategory {
  id: UserRole;
  emoji: string;
  title: string;
  titleHi: string;
  subtitleHi: string;
  tag: string;
  color: {
    bg: string;
    border: string;
    text: string;
    activeTab: string;
    pill: string;
  };
  services: PersonalizedService[];
  quickQuestions: string[];
}

export const PERSONALIZED_CATEGORIES: PersonalizedCategory[] = [
  {
    id: 'farmer',
    emoji: '🌾',
    title: 'Farmer',
    titleHi: 'किसान',
    subtitleHi: 'खेती, फसल बीमा, सस्ता लोन व ट्रैक्टर छूट',
    tag: 'अन्नदाता',
    color: {
      bg: 'from-emerald-50 to-green-100/60',
      border: 'border-emerald-300',
      text: 'text-emerald-950',
      activeTab: 'bg-emerald-700 text-white shadow-emerald-700/30 ring-2 ring-emerald-500/50',
      pill: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    services: [
      {
        id: 'pm-kisan',
        schemeId: 'pm-kisan',
        emoji: '🎁',
        title: 'PM-KISAN',
        titleHi: 'पीएम किसान',
        badge: 'पैसा बैंक में',
        benefitHi: 'हर साल ₹6,000 सीधे बैंक में',
        descHi: 'सालाना ₹6,000 की सरकारी मदद।',
        voicePrompt: 'पीएम किसान सम्मान निधि योजना के बारे में आसान शब्दों में बताएं।',
      },
      {
        id: 'kcc',
        schemeId: 'kcc',
        emoji: '💳',
        title: 'KCC Loan',
        titleHi: 'किसान क्रेडिट कार्ड',
        badge: 'सस्ता लोन',
        benefitHi: 'खेती हेतु 4% ब्याज पर सस्ता लोन',
        descHi: 'खाद-बीज के लिए सबसे सस्ता ऋण।',
        voicePrompt: 'किसान क्रेडिट कार्ड पर सस्ता लोन कैसे मिलता है?',
      },
      {
        id: 'pmfby',
        schemeId: 'pmfby',
        emoji: '🛡️',
        title: 'Fasal Bima',
        titleHi: 'फसल बीमा',
        badge: 'सुरक्षा कवच',
        benefitHi: 'फसल खराब होने पर पूरा पैसा वापस',
        descHi: 'सूखा या बारिश से नुकसान पर मुआवजा।',
        voicePrompt: 'फसल बीमा का क्लेम कैसे मिलता है?',
      },
      {
        id: 'tractor-subsidy',
        schemeId: 'tractor-subsidy',
        emoji: '🚜',
        title: 'Tractor Subsidy',
        titleHi: 'ट्रैक्टर सब्सिडी',
        badge: 'सरकारी छूट',
        benefitHi: 'नया ट्रैक्टर खरीदने पर ₹1 लाख तक छूट',
        descHi: 'कृषि यंत्रों पर 20% से 50% सब्सिडी।',
        voicePrompt: 'ट्रैक्टर सब्सिडी कैसे प्राप्त करें?',
      },
      {
        id: 'pm-kusum',
        schemeId: 'pm-kusum',
        emoji: '☀️',
        title: 'Solar Pump',
        titleHi: 'सोलर पंप',
        badge: 'मुफ्त बिजली',
        benefitHi: 'खेत में मुफ्त दिन की बिजली और पंप',
        descHi: 'डीजल खर्च खत्म, सौर ऊर्जा से सिंचाई।',
        voicePrompt: 'कुसुम सोलर पंप योजना के क्या फायदे हैं?',
      },
    ],
    quickQuestions: [
      'पीएम किसान किस्त कब आएगी?',
      'सस्ता खेती लोन कैसे लें?',
      'फसल बीमा क्लेम कैसे करें?',
    ],
  },
  {
    id: 'shopkeeper',
    emoji: '🏪',
    title: 'Shopkeeper',
    titleHi: 'दुकानदार',
    subtitleHi: 'दुकान बढ़ाने के लिए बिना गारंटी लोन व मंडी',
    tag: 'व्यापार व दुकान',
    color: {
      bg: 'from-blue-50 to-indigo-100/60',
      border: 'border-blue-300',
      text: 'text-blue-950',
      activeTab: 'bg-blue-700 text-white shadow-blue-700/30 ring-2 ring-blue-500/50',
      pill: 'bg-blue-100 text-blue-900 border-blue-300',
    },
    services: [
      {
        id: 'pm-svanidhi',
        schemeId: 'pm-svanidhi',
        emoji: '🏪',
        title: 'PM SVANidhi',
        titleHi: 'पीएम स्वनिधि लोन',
        badge: 'बिना गारंटी',
        benefitHi: 'दुकान के लिए ₹50,000 बिना गारंटी लोन',
        descHi: 'दुकानदारों को आसान लोन व कैशबैक।',
        voicePrompt: 'दुकानदारों के लिए पीएम स्वनिधि लोन कैसे मिलेगा?',
      },
      {
        id: 'mudra',
        schemeId: 'mudra',
        emoji: '💼',
        title: 'Mudra Loan',
        titleHi: 'मुद्रा व्यापार लोन',
        badge: 'व्यापार लोन',
        benefitHi: 'दुकान व व्यापार हेतु ₹10 लाख तक लोन',
        descHi: 'नया काम शुरू करने के लिए सुगम ऋण।',
        voicePrompt: 'दुकान के लिए मुद्रा लोन कैसे प्राप्त करें?',
      },
      {
        id: 'enam-mandi',
        schemeId: 'trader',
        emoji: '📱',
        title: 'e-NAM Trade',
        titleHi: 'ई-नाम ऑनलाइन मंडी',
        badge: 'सीधा व्यापार',
        benefitHi: 'मोबाइल से देशभर में फसल खरीद-बिक्री',
        descHi: 'बिना बिचौलियों के सीधा व्यापार।',
        voicePrompt: 'e-NAM पोर्टल पर व्यापार कैसे करें?',
      },
      {
        id: 'udyam-msme',
        schemeId: 'pacs',
        emoji: '📜',
        title: 'Udyam Registration',
        titleHi: 'दुकान का उद्यम कार्ड',
        badge: 'सरकारी पहचान',
        benefitHi: 'दुकान का मुफ्त सरकारी पंजीकरण कार्ड',
        descHi: 'बिजली बिल में छूट व सरकारी लाभ।',
        voicePrompt: 'दुकान का उद्यम रजिस्ट्रेशन कैसे करें?',
      },
    ],
    quickQuestions: [
      'दुकान के लिए स्वनिधि लोन कैसे मिलेगा?',
      'मुद्रा लोन के नियम क्या हैं?',
      'दुकान का उद्यम कार्ड कैसे बनाएं?',
    ],
  },
  {
    id: 'artisan',
    emoji: '🧵',
    title: 'Artisans',
    titleHi: 'कारीगर',
    subtitleHi: 'मुफ्त टूलकिट, औजार सहायता व 5% रियायती लोन',
    tag: 'शिल्पकार',
    color: {
      bg: 'from-amber-50 to-orange-100/60',
      border: 'border-amber-300',
      text: 'text-amber-950',
      activeTab: 'bg-amber-700 text-white shadow-amber-700/30 ring-2 ring-amber-500/50',
      pill: 'bg-amber-100 text-amber-900 border-amber-300',
    },
    services: [
      {
        id: 'pm-vishwakarma',
        schemeId: 'pm-vishwakarma',
        emoji: '🔨',
        title: 'PM Vishwakarma',
        titleHi: 'पीएम विश्वकर्मा',
        badge: 'फ्री टूलकिट',
        benefitHi: '₹15,000 फ्री औजार + ₹3 लाख सस्ता लोन',
        descHi: '18 पारंपरिक ट्रेडों को सरकारी सहायता।',
        voicePrompt: 'पीएम विश्वकर्मा योजना में ₹15,000 टूलकिट कैसे मिलेगा?',
      },
      {
        id: 'artisan-mudra',
        schemeId: 'mudra',
        emoji: '🪙',
        title: 'Artisan Loan',
        titleHi: 'कारीगर क्रेडिट कार्ड',
        badge: 'आसान ऋण',
        benefitHi: 'सामान बनाने हेतु कच्चा माल और लोन',
        descHi: 'शिल्पकारों को कार्यशील पूंजी।',
        voicePrompt: 'कारीगरों के लिए रियायती लोन कैसे लें?',
      },
      {
        id: 'hunar-haat',
        schemeId: 'pacs',
        emoji: '🎪',
        title: 'Hunar Haat',
        titleHi: 'हुनर हाट व मेले',
        badge: 'मुफ्त स्टॉल',
        benefitHi: 'बड़े शहरों में मुफ्त स्टॉल पर बिक्री',
        descHi: 'सरकारी मेलों में मुफ्त जगह।',
        voicePrompt: 'हुनर हाट में सामान बेचने के लिए कैसे जुड़ें?',
      },
      {
        id: 'weavers-mudra',
        schemeId: 'kcc',
        emoji: '🪡',
        title: 'Weavers Mudra',
        titleHi: 'बुनकर सहायता',
        badge: 'धागा सब्सिडी',
        benefitHi: 'धागे पर छूट और हथकरघा अनुदान',
        descHi: 'बुनकर परिवारों को आर्थिक मदद।',
        voicePrompt: 'बुनकर साथियों के लिए क्या योजनाएं हैं?',
      },
    ],
    quickQuestions: [
      'विश्वकर्मा में ₹15,000 टूलकिट कैसे लें?',
      'कारीगरों को 5% ब्याज पर लोन कैसे मिलेगा?',
      'हुनर हाट मेले में कैसे शामिल हों?',
    ],
  },
  {
    id: 'dairy_livestock',
    emoji: '🐄',
    title: 'Dairy & Livestock',
    titleHi: 'पशुपालक',
    subtitleHi: 'गाय-भैंस, चारा, शेड व डेयरी अनुदान',
    tag: 'पशुधन',
    color: {
      bg: 'from-teal-50 to-emerald-100/60',
      border: 'border-teal-300',
      text: 'text-teal-950',
      activeTab: 'bg-teal-700 text-white shadow-teal-700/30 ring-2 ring-teal-500/50',
      pill: 'bg-teal-100 text-teal-900 border-teal-300',
    },
    services: [
      {
        id: 'pashu-kcc',
        schemeId: 'pashu-kcc',
        emoji: '🐄',
        title: 'Pashu KCC',
        titleHi: 'पशु क्रेडिट कार्ड',
        badge: 'पशु लोन',
        benefitHi: 'गाय-भैंस पालन हेतु ₹1.60 लाख लोन',
        descHi: 'चारे और देखभाल के लिए 4% ब्याज पर लोन।',
        voicePrompt: 'पशु किसान क्रेडिट कार्ड कैसे बनवाएं?',
      },
      {
        id: 'gokul-mission',
        schemeId: 'kcc',
        emoji: '🥛',
        title: 'Gokul Mission',
        titleHi: 'डेयरी व गोकुल मिशन',
        badge: 'नस्ल सुधार',
        benefitHi: 'अच्छी नस्ल के पशुओं पर सरकारी मदद',
        descHi: 'दूध उत्पादन बढ़ाने हेतु अनुदान।',
        voicePrompt: 'डेयरी फार्मिंग पर सरकारी अनुदान कैसे लें?',
      },
      {
        id: 'goat-poultry',
        schemeId: 'pm-kisan',
        emoji: '🐐',
        title: 'Goat Farming',
        titleHi: 'बकरी व मुर्गी पालन',
        badge: '50% छूट',
        benefitHi: 'शेड व फार्म बनाने पर 50% सरकारी छूट',
        descHi: 'छोटे पशुपालकों को सीधा अनुदान।',
        voicePrompt: 'बकरी पालन पर सरकारी सब्सिडी कैसे लें?',
      },
    ],
    quickQuestions: [
      'पशु केसीसी पर कितना लोन मिलता है?',
      'डेयरी फार्मिंग पर सरकारी सब्सिडी कैसे लें?',
      'बकरी पालन में क्या छूट है?',
    ],
  },
  {
    id: 'women_shg',
    emoji: '👩‍🌾',
    title: 'Women SHG',
    titleHi: 'महिला समूह',
    subtitleHi: 'लखपति दीदी, नमो ड्रोन व ब्याज-मुक्त सहायता',
    tag: 'महिला शक्ति',
    color: {
      bg: 'from-rose-50 to-pink-100/60',
      border: 'border-rose-300',
      text: 'text-rose-950',
      activeTab: 'bg-rose-700 text-white shadow-rose-700/30 ring-2 ring-rose-500/50',
      pill: 'bg-rose-100 text-rose-900 border-rose-300',
    },
    services: [
      {
        id: 'lakhpati-didi',
        schemeId: 'lakhpati-didi',
        emoji: '👩‍💼',
        title: 'Lakhpati Didi',
        titleHi: 'लखपति दीदी',
        badge: '₹5 लाख लोन',
        benefitHi: 'महिला समूह को ₹5 लाख तक आसान ऋण',
        descHi: 'काम सीखने व आमदनी बढ़ाने की योजना।',
        voicePrompt: 'लखपति दीदी योजना के क्या फायदे हैं?',
      },
      {
        id: 'drone-didi',
        schemeId: 'tractor-subsidy',
        emoji: '🚁',
        title: 'Drone Didi',
        titleHi: 'नमो ड्रोन दीदी',
        badge: 'फ्री ड्रोन',
        benefitHi: 'फ्री खेती ड्रोन और हर महीने कमाई',
        descHi: 'ड्रोन पायलट ट्रेनिंग और रोजगार।',
        voicePrompt: 'ड्रोन दीदी योजना में क्या लाभ मिलता है?',
      },
      {
        id: 'nrlm-cif',
        schemeId: 'pacs',
        emoji: '💰',
        title: 'NRLM Fund',
        titleHi: 'समूह सहायता फंड',
        badge: 'सस्ता लोन',
        benefitHi: 'नया काम शुरू करने हेतु सीधी आर्थिक मदद',
        descHi: 'समूह को कम ब्याज पर बैंक लोन।',
        voicePrompt: 'महिला स्वयं सहायता समूह को फंड कैसे मिलता है?',
      },
    ],
    quickQuestions: [
      'लखपति दीदी योजना का लाभ कैसे लें?',
      'ड्रोन दीदी कैसे बनें?',
      'समूह को बैंक से लोन कैसे मिलता है?',
    ],
  },
  {
    id: 'cooperative_member',
    emoji: '🏛️',
    title: 'PACS',
    titleHi: 'पैक्स समिति',
    subtitleHi: 'गांव की समिति, असली खाद, बीज व पक्का गोदाम',
    tag: 'सहकारिता',
    color: {
      bg: 'from-purple-50 to-indigo-100/60',
      border: 'border-purple-300',
      text: 'text-purple-950',
      activeTab: 'bg-purple-700 text-white shadow-purple-700/30 ring-2 ring-purple-500/50',
      pill: 'bg-purple-100 text-purple-900 border-purple-300',
    },
    services: [
      {
        id: 'pacs-membership',
        schemeId: 'pacs',
        emoji: '🏛️',
        title: 'PACS Membership',
        titleHi: 'पैक्स खाद-बीज',
        badge: 'गांव में सुविधा',
        benefitHi: 'गांव में असली खाद और सरकारी बीज',
        descHi: 'बिना बिचौलियों के उचित दाम पर सामान।',
        voicePrompt: 'पैक्स समिति का सदस्य कैसे बनें?',
      },
      {
        id: 'grain-storage',
        schemeId: 'pacs',
        emoji: '🌾',
        title: 'Grain Storage',
        titleHi: 'अनाज गोदाम',
        badge: 'पक्का गोदाम',
        benefitHi: 'फसल सुरक्षित रखने हेतु पक्का गोदाम',
        descHi: 'गांव में ही सुरक्षित फसल भंडारण।',
        voicePrompt: 'पैक्स गोदाम में अनाज भंडारण कैसे करें?',
      },
      {
        id: 'pmksk',
        schemeId: 'pacs',
        emoji: '🏢',
        title: 'PMKSK Center',
        titleHi: 'समृद्धि केंद्र',
        badge: 'एक जगह सब',
        benefitHi: 'खाद, बीज, दवाई और सलाह एक ही जगह',
        descHi: 'किसानों के लिए वन-स्टॉप केंद्र।',
        voicePrompt: 'पीएम किसान समृद्धि केंद्र पर क्या सुविधाएं मिलती हैं?',
      },
    ],
    quickQuestions: [
      'पैक्स समिति से खाद-बीज कैसे लें?',
      'गांव के गोदाम में फसल कैसे रखें?',
      'समृद्धि केंद्र पर क्या सहायता मिलती है?',
    ],
  },
];

export const USER_ROLES: UserRoleOption[] = PERSONALIZED_CATEGORIES.map((cat) => ({
  id: cat.id,
  emoji: cat.emoji,
  title: cat.title,
  titleHi: cat.titleHi,
  titleEn: cat.title,
  subtitle: cat.tag,
  subtitleHi: cat.subtitleHi,
  desc: cat.subtitleHi,
  descHi: cat.subtitleHi,
  speechKeywords: [cat.id, cat.title.toLowerCase(), cat.titleHi],
  recommendedPrompts: cat.quickQuestions.map((q) => ({ text: q, lang: 'hi' })),
}));

// Service categories
export interface ServiceCategory {
  id: string;
  icon: string;
  title: string;
  titleHi: string;
  description: string;
  sampleQuestion: string;
  color: string;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'pmfby',
    icon: 'Shield',
    title: 'Crop Insurance',
    titleHi: 'फसल बीमा',
    description: 'PMFBY and agricultural insurance guidance',
    sampleQuestion: 'PMFBY क्या है और इसमें किसान को क्या लाभ मिलता है?',
    color: 'green',
  },
  {
    id: 'pacs',
    icon: 'Building2',
    title: 'PACS Services',
    titleHi: 'पैक्स सेवाएं',
    description: 'Credit societies, loans and input services',
    sampleQuestion: 'What services does PACS provide to farmers?',
    color: 'blue',
  },
  {
    id: 'cooperative',
    icon: 'Users',
    title: 'Cooperative Laws',
    titleHi: 'सहकारी कानून',
    description: 'Member rights, governance and registration',
    sampleQuestion: 'Cooperative society ke member ke kya rights hote hain?',
    color: 'amber',
  },
  {
    id: 'schemes',
    icon: 'Landmark',
    title: 'Govt Schemes',
    titleHi: 'सरकारी योजनाएं',
    description: 'PM-KISAN, PM-KUSUM and other schemes',
    sampleQuestion: 'PM-KISAN yojana mein kitna paisa milta hai?',
    color: 'purple',
  },
  {
    id: 'financial',
    icon: 'BookOpen',
    title: 'Financial Literacy',
    titleHi: 'वित्तीय साक्षरता',
    description: 'Interest, loans, savings and EMI',
    sampleQuestion: 'ब्याज क्या होता है? सरल भाषा में समझाइए।',
    color: 'teal',
  },
  {
    id: 'grievance',
    icon: 'MessageSquareWarning',
    title: 'Grievance Support',
    titleHi: 'शिकायत सहायता',
    description: 'File complaints and seek redressal',
    sampleQuestion: 'मुझे सहकारी समिति के खिलाफ शिकायत करनी है, क्या करूं?',
    color: 'red',
  },
];

export const DEMO_QUESTIONS = [
  { text: 'PMFBY क्या है और इसमें किसान को क्या लाभ मिलता है?', lang: 'Hindi' },
  { text: 'What services does PACS provide to farmers?', lang: 'English' },
  { text: 'ਮੇਰੀ ਫਸਲ ਦਾ ਬੀਮਾ ਕਿਵੇਂ ਕਰਵਾਇਆ ਜਾ ਸਕਦਾ ਹੈ?', lang: 'Punjabi' },
  { text: 'Cooperative society ke member ke kya rights hote hain?', lang: 'Hinglish' },
  { text: 'मुझे सहकारी समिति के खिलाफ शिकायत करनी है, क्या करूं?', lang: 'Hindi' },
  { text: 'PMFBY ka premium kitna hota hai kharif mein?', lang: 'Hinglish' },
];

