import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { LanguageCode } from '../types';

import en from '../locales/en.json';
import hi from '../locales/hi.json';
import pa from '../locales/pa.json';
import mr from '../locales/mr.json';
import gu from '../locales/gu.json';
import bn from '../locales/bn.json';
import ta from '../locales/ta.json';
import te from '../locales/te.json';
import kn from '../locales/kn.json';
import ml from '../locales/ml.json';
import or_locale from '../locales/or.json';
import as_locale from '../locales/as.json';
import ur from '../locales/ur.json';
import hi_Latn from '../locales/hi-Latn.json';
import { getRecommendedLanguage } from '../utils/languageRecommender';

// Dictionary map
const TRANSLATIONS: Record<string, any> = {
  en,
  hi,
  pa,
  mr,
  gu,
  bn,
  ta,
  te,
  kn,
  ml,
  or: or_locale,
  as: as_locale,
  ur,
  'hi-Latn': hi_Latn,
};

export interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (path: string, fallback?: string) => string;
  tArray: (path: string) => string[];
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  voiceLocale: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'language';

// Voice recognition & speech synthesis locale mapping
export const VOICE_LOCALE_MAP: Record<string, string> = {
  hi: 'hi-IN',
  'hi-Latn': 'hi-IN',
  en: 'en-IN',
  pa: 'pa-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  or: 'or-IN',
  as: 'as-IN',
  ur: 'ur-IN',
  auto: 'hi-IN',
};

// Helper function to safely navigate a nested object path (e.g. "landing.stats.verifiedRecords")
function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr && typeof curr === 'object' && part in curr) {
      curr = curr[part];
    } else {
      return undefined;
    }
  }
  return curr;
}

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY) as LanguageCode | null;
      if (saved && (saved === 'auto' || saved in TRANSLATIONS)) {
        return saved;
      }
      // Also check legacy key if any
      const legacy = localStorage.getItem('sahkar_preferred_language') as LanguageCode | null;
      if (legacy && (legacy === 'auto' || legacy in TRANSLATIONS)) {
        return legacy;
      }
    } catch {
      // ignore
    }
    return getRecommendedLanguage().recommendedLanguage || 'en';
  });

  const setLanguage = (newLang: LanguageCode) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, newLang);
      localStorage.setItem('sahkar_preferred_language', newLang);
    } catch {
      // ignore
    }
  };

  const isRtl = language === 'ur';
  const dir: 'ltr' | 'rtl' = isRtl ? 'rtl' : 'ltr';

  // Apply direction and html lang to document root
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language === 'auto' ? 'en' : language;
    if (isRtl) {
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.classList.remove('rtl');
    }
  }, [dir, isRtl, language]);

  const activeDict = useMemo(() => {
    if (language === 'auto') return TRANSLATIONS['en'];
    return TRANSLATIONS[language] || TRANSLATIONS['en'];
  }, [language]);

  const t = useMemo(() => {
    return (path: string, fallback?: string): string => {
      // 1. Try active selected language
      const val = getNestedValue(activeDict, path);
      if (typeof val === 'string') return val;

      // 2. Fall back to English
      const enVal = getNestedValue(TRANSLATIONS['en'], path);
      if (typeof enVal === 'string') return enVal;

      // 3. Fall back to explicit default parameter or clean leaf key
      if (fallback !== undefined) return fallback;
      const leaf = path.split('.').pop();
      return leaf || path;
    };
  }, [activeDict]);

  const tArray = useMemo(() => {
    return (path: string): string[] => {
      const val = getNestedValue(activeDict, path);
      if (Array.isArray(val)) return val;
      const enVal = getNestedValue(TRANSLATIONS['en'], path);
      if (Array.isArray(enVal)) return enVal;
      return [];
    };
  }, [activeDict]);

  const voiceLocale = VOICE_LOCALE_MAP[language] || 'hi-IN';

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      tArray,
      dir,
      isRtl,
      voiceLocale,
    }),
    [language, t, tArray, dir, isRtl, voiceLocale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Convenient shorthand hook for translations
export const useTranslation = () => {
  const { t, tArray, language, dir, isRtl } = useLanguage();
  return { t, tArray, language, dir, isRtl };
};
