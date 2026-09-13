import languageRecommendationData from '../locales/languageRecommendation.json';
import { LanguageCode } from '../types';

export interface LanguageRecommendationResult {
  recommendedLanguage: LanguageCode;
  confidence: 'high' | 'medium' | 'low';
  source: 'stored_preference' | 'navigator_locale' | 'state_region' | 'fallback';
  nativeName: string;
  englishName: string;
  flag: string;
  prompt?: {
    title: string;
    message: string;
    confirm: string;
    dismiss: string;
    remember: string;
  };
}

/**
 * Inspects user environment (stored preferences, browser locales, optional state)
 * and determines the user's recommended language using languageRecommendation.json
 */
export function getRecommendedLanguage(userStateOrRegion?: string): LanguageRecommendationResult {
  const { metadata, browserLocaleMappings, indianStateMappings, recommendationPrompts, supportedLanguages } =
    languageRecommendationData;

  // 1. Check if user already explicitly selected a language
  try {
    const saved = localStorage.getItem(metadata.storageKeys.preferredLanguage) as LanguageCode | null;
    if (saved && saved !== 'auto') {
      const match = supportedLanguages.find((l) => l.code === saved);
      if (match) {
        return {
          recommendedLanguage: saved,
          confidence: 'high',
          source: 'stored_preference',
          nativeName: match.nativeName,
          englishName: match.name,
          flag: match.flag,
          prompt: (recommendationPrompts as Record<string, any>)[saved],
        };
      }
    }
  } catch {
    // localStorage unavailable or restricted
  }

  // 2. Check browser navigator languages (high confidence if Indian regional locale matches)
  if (typeof navigator !== 'undefined') {
    const browserLangs = navigator.languages ? [...navigator.languages] : [navigator.language];
    for (const rawLang of browserLangs) {
      if (!rawLang) continue;
      const normalized = rawLang.toLowerCase().trim();
      const mappedCode = (browserLocaleMappings as Record<string, string>)[normalized];
      if (mappedCode) {
        const langObj = supportedLanguages.find((l) => l.code === mappedCode);
        return {
          recommendedLanguage: mappedCode as LanguageCode,
          confidence: mappedCode === 'en' ? 'medium' : 'high',
          source: 'navigator_locale',
          nativeName: langObj?.nativeName || mappedCode,
          englishName: langObj?.name || mappedCode,
          flag: langObj?.flag || '🇮🇳',
          prompt: (recommendationPrompts as Record<string, any>)[mappedCode],
        };
      }
    }
  }

  // 3. Check Indian state / region if provided or detected via IP geolocation
  if (userStateOrRegion) {
    const cleanState = userStateOrRegion.toLowerCase().trim();
    const stateMatch = (indianStateMappings as Record<string, { primary: string; secondary: string }>)[cleanState];
    if (stateMatch) {
      const primaryLang = stateMatch.primary as LanguageCode;
      const langObj = supportedLanguages.find((l) => l.code === primaryLang);
      return {
        recommendedLanguage: primaryLang,
        confidence: 'medium',
        source: 'state_region',
        nativeName: langObj?.nativeName || primaryLang,
        englishName: langObj?.name || primaryLang,
        flag: langObj?.flag || '🇮🇳',
        prompt: (recommendationPrompts as Record<string, any>)[primaryLang],
      };
    }
  }

  // 4. Default fallback
  const fallbackCode = metadata.defaultLanguage as LanguageCode;
  const defaultLangObj = supportedLanguages.find((l) => l.code === fallbackCode);
  return {
    recommendedLanguage: fallbackCode,
    confidence: 'low',
    source: 'fallback',
    nativeName: defaultLangObj?.nativeName || 'English',
    englishName: defaultLangObj?.name || 'English',
    flag: defaultLangObj?.flag || '🇮🇳',
    prompt: (recommendationPrompts as Record<string, any>)[fallbackCode],
  };
}

/**
 * Converts website DOM attributes and applies the user recommended language to localStorage and document tags
 */
export function convertWebsiteToLanguage(
  targetLanguage: LanguageCode,
  setLanguageState?: (lang: LanguageCode) => void
): void {
  const { metadata, conversionDirectives, supportedLanguages } = languageRecommendationData;
  const langObj = supportedLanguages.find((l) => l.code === targetLanguage);
  const isRtl = langObj?.direction === 'rtl';

  // 1. Update localStorage
  try {
    localStorage.setItem(metadata.storageKeys.preferredLanguage, targetLanguage);
    localStorage.setItem(metadata.storageKeys.legacyLanguage, targetLanguage);
    localStorage.setItem(metadata.storageKeys.autoConverted, 'true');
  } catch {
    // Ignore storage errors
  }

  // 2. Update React Context state if hook handler passed
  if (setLanguageState) {
    setLanguageState(targetLanguage);
  }

  // 3. Update HTML DOM document attributes
  if (typeof document !== 'undefined' && conversionDirectives.updateDocumentAttributes) {
    document.documentElement.lang = targetLanguage === 'auto' ? 'en' : targetLanguage;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    if (isRtl) {
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.classList.remove('rtl');
    }
  }

  // 4. Dispatch global event for listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('website-language-converted', {
        detail: {
          language: targetLanguage,
          isRtl,
          voiceLocale: langObj?.voiceLocale || 'hi-IN',
        },
      })
    );
  }
}

export default languageRecommendationData;
