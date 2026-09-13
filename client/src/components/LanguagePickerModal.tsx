import { useState } from 'react';
import { Globe, ChevronRight, Sprout } from 'lucide-react';
import { LanguageCode, LANGUAGE_OPTIONS } from '../types';
import { useLanguage, useTranslation } from '../context/LanguageContext';
import { clsx } from 'clsx';

interface LanguagePickerModalProps {
  onSelect: (lang: LanguageCode) => void;
}

const FEATURED: LanguageCode[] = [
  'hi', 'en', 'hi-Latn', 'pa', 'mr', 'gu', 'bn', 'ta', 'te', 'kn', 'ml', 'or', 'as', 'ur'
];

const LANG_META: Record<string, { greeting: string; flag: string }> = {
  'hi':      { greeting: 'नमस्ते',          flag: '🇮🇳' },
  'en':      { greeting: 'Hello / Welcome',  flag: '🇮🇳' },
  'hi-Latn': { greeting: 'Namaste',          flag: '🇮🇳' },
  'pa':      { greeting: 'ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ',   flag: '🇮🇳' },
  'mr':      { greeting: 'नमस्कार',          flag: '🇮🇳' },
  'gu':      { greeting: 'નમસ્તે',           flag: '🇮🇳' },
  'bn':      { greeting: 'নমস্কার',          flag: '🇮🇳' },
  'ta':      { greeting: 'வணக்கம்',          flag: '🇮🇳' },
  'te':      { greeting: 'నమస్కారం',         flag: '🇮🇳' },
  'kn':      { greeting: 'ನಮಸ್ಕಾರ',          flag: '🇮🇳' },
  'ml':      { greeting: 'നമസ്കാരം',         flag: '🇮🇳' },
  'or':      { greeting: 'ନମସ୍କାର',          flag: '🇮🇳' },
  'as':      { greeting: 'নমস্কাৰ',          flag: '🇮🇳' },
  'ur':      { greeting: 'آداب / خوش آمدید', flag: '🇮🇳' },
};

export function LanguagePickerModal({ onSelect }: LanguagePickerModalProps) {
  const [hovered, setHovered] = useState<LanguageCode | null>(null);
  const { language } = useLanguage();
  const { t } = useTranslation();

  const featuredOptions = LANGUAGE_OPTIONS.filter(
    opt => FEATURED.includes(opt.code as LanguageCode)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-elevated w-full max-w-xl overflow-hidden animate-slide-up border border-neutral-100">

        {/* Header */}
        <div className="bg-brand-700 px-6 py-6 text-center text-white">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
              <Sprout size={18} className="text-white" />
            </div>
            <span className="font-bold text-xl">{t('app.name', 'Sahkar Sathi')}</span>
          </div>
          <h2 className="text-lg font-semibold text-brand-50 mt-1">
            {t('modal.title', 'Choose Your Preferred Language')}
          </h2>
          <p className="text-brand-100 text-xs mt-1.5 max-w-md mx-auto leading-relaxed">
            {t('modal.subtitle', 'Select your language for the entire website and AI voice responses. You can change this anytime from the header.')}
          </p>
        </div>

        {/* Language grid */}
        <div className="p-5">
          <div className="flex items-center gap-1.5 mb-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">
            <Globe size={13} />
            <span>{t('nav.selectLanguage', 'Select Language')}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {featuredOptions.map(opt => {
              const meta = LANG_META[opt.code] ?? { greeting: '', flag: '🇮🇳' };
              const isSelected = language === opt.code;
              const isHovered = hovered === opt.code;

              return (
                <button
                  key={opt.code}
                  onClick={() => onSelect(opt.code as LanguageCode)}
                  onMouseEnter={() => setHovered(opt.code as LanguageCode)}
                  onMouseLeave={() => setHovered(null)}
                  className={clsx(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500',
                    isSelected
                      ? 'border-brand-500 bg-brand-50 text-brand-900 shadow-sm ring-1 ring-brand-400'
                      : isHovered
                      ? 'border-brand-300 bg-brand-50/60 shadow-soft'
                      : 'border-neutral-200 bg-white hover:border-brand-200 hover:bg-neutral-50'
                  )}
                >
                  <span className="text-xl leading-none flex-shrink-0">{meta.flag}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-neutral-900 text-sm leading-tight truncate">
                      {opt.nativeLabel}
                    </div>
                    {meta.greeting && (
                      <div className="text-neutral-500 text-[11px] leading-tight truncate mt-0.5">
                        {meta.greeting}
                      </div>
                    )}
                  </div>
                  {(isHovered || isSelected) && (
                    <ChevronRight size={14} className="text-brand-600 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Auto detect option */}
        <div className="px-5 pb-5 pt-1">
          <div className="border-t border-neutral-100 pt-3">
            <button
              onClick={() => onSelect('auto')}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 hover:bg-brand-50/50 hover:border-brand-400 transition-all text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-neutral-200/80 flex items-center justify-center text-neutral-600">
                  <Globe size={15} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-neutral-800 text-xs">
                    {t('modal.autoDetectTitle', 'Auto Detect')}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {t('modal.autoDetectDesc', 'Chatbot automatically detects the language of your message')}
                  </div>
                </div>
              </div>
              <ChevronRight size={15} className="text-neutral-400 flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
