import { Link, useLocation } from 'react-router-dom';
import { Sprout, Globe, ChevronDown, MessageSquare, Mic } from 'lucide-react';
import { useLanguage, useTranslation } from '../context/LanguageContext';
import { useVoiceModal } from '../context/VoiceModalContext';
import { LanguageCode, LANGUAGE_OPTIONS } from '../types';
import { clsx } from 'clsx';

interface HeaderProps {
  detectedLanguage?: string;
}

export function Header({ detectedLanguage }: HeaderProps) {
  const { language, setLanguage } = useLanguage();
  const { openVoiceModal } = useVoiceModal();
  const { t } = useTranslation();
  const location = useLocation();
  const isChatPage = location.pathname === '/chat';

  const isForced = language !== 'auto';
  const currentLang = LANGUAGE_OPTIONS.find(o => o.code === language);
  const displayLabel = currentLang
    ? (currentLang.nativeLabel !== currentLang.label ? currentLang.nativeLabel : currentLang.label)
    : t('nav.autoDetect', 'Auto Detect');

  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
      <div className="max-w-screen-xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-2">

          {/* Logo + Brand */}
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            <Link to="/" className="flex items-center gap-2 hover:opacity-85 transition-opacity min-w-0">
              <div className="w-8 h-8 rounded-lg bg-brand-700 flex items-center justify-center flex-shrink-0 shadow-soft">
                <Sprout size={18} className="text-white" />
              </div>
              <div className="leading-tight min-w-0">
                <div className="font-bold text-neutral-900 text-sm tracking-tight truncate">{t('app.name', 'Sahkar Sathi')}</div>
                <div className="text-neutral-400 text-[10px] leading-none font-medium hidden sm:block">
                  {t('app.nativeName', 'सहकार साथी')}
                </div>
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/"
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  !isChatPage ? 'text-brand-700 bg-brand-50 font-semibold' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                )}
              >
                {t('nav.home', 'Home')}
              </Link>
              <Link
                to="/chat"
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                  isChatPage ? 'text-brand-700 bg-brand-50 font-semibold' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                )}
              >
                <MessageSquare size={13} />
                <span>{t('nav.chat', 'Chat Assistant')}</span>
              </Link>
              <a
                href="/#services"
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
              >
                {t('nav.services', 'Services')}
              </a>
            </nav>
          </div>

          {/* Center: language badge */}
          <div className="hidden lg:flex items-center gap-2">
            {isChatPage && detectedLanguage && !isForced && (
              <div className="flex items-center gap-1.5 badge badge-green">
                <Globe size={11} />
                <span className="text-[11px]">{detectedLanguage}</span>
              </div>
            )}
            {isForced && (
              <div className="flex items-center gap-1.5 badge badge-blue">
                <Globe size={11} />
                <span className="text-[11px] font-semibold">{displayLabel}</span>
              </div>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
            {/* Talk to Sahkar Sathi Voice Button */}
            <button
              onClick={() => openVoiceModal()}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-brand-700 hover:from-emerald-700 hover:to-brand-800 text-white text-xs font-bold shadow-soft transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
              title="Talk to Sahkar Sathi via Voice"
            >
              <Mic size={14} className="animate-pulse text-emerald-200 flex-shrink-0" />
              <span className="hidden sm:inline">🎙 Talk to Sahkar Sathi</span>
              <span className="sm:hidden">🎙 Talk</span>
            </button>

            {/* Voice Setup Button */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-onboarding-modal'))}
              className="btn-ghost text-xs py-1.5 px-2.5 hidden md:inline-flex items-center gap-1.5 text-neutral-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl border border-transparent hover:border-emerald-200 transition-all"
              title="अपनी भाषा व पेशा बदलें / AI Voice Setup"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Voice Setup</span>
            </button>

            {!isChatPage && (
              <Link
                to="/chat"
                className="btn-secondary text-xs py-1.5 px-3 hidden sm:inline-flex"
              >
                {t('nav.startChat', 'Text Chat')}
              </Link>
            )}

            {/* Language selector */}
            <div className="relative flex items-center">
              <label htmlFor="language-select" className="sr-only">
                {t('nav.selectLanguage', 'Select Language')}
              </label>
              <div className="relative">
                <select
                  id="language-select"
                  value={language}
                  onChange={e => setLanguage(e.target.value as LanguageCode)}
                  className={clsx(
                    'appearance-none text-xs border rounded-lg pl-2 sm:pl-3 pr-6 sm:pr-7 py-1.5 bg-white cursor-pointer',
                    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-400',
                    'transition-all duration-150 w-[88px] sm:w-auto sm:min-w-[125px] font-medium text-ellipsis',
                    isForced
                      ? 'border-brand-500 text-brand-800 font-semibold bg-brand-50 shadow-sm'
                      : 'border-neutral-200 text-neutral-700 hover:border-neutral-300'
                  )}
                  title={t('nav.selectLanguage', 'Select Language')}
                >
                  {LANGUAGE_OPTIONS.map(opt => (
                    <option key={opt.code} value={opt.code}>
                      {opt.code === 'auto' ? t('nav.autoDetect', 'Auto Detect') : opt.nativeLabel}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className={clsx(
                    'absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 pointer-events-none',
                    isForced ? 'text-brand-600' : 'text-neutral-400'
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
