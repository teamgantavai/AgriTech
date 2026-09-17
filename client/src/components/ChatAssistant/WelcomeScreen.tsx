// ================================================================
// WelcomeScreen.tsx — Simple, Human, Premium Citizen Services Home
// "Google Search + a friendly government guide + simple assistant"
// ================================================================

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { POPULAR_SERVICES, POPULAR_SERVICES_HI } from '../../data/popularServices';
import { FindSchemesModal } from './FindSchemesModal';

interface WelcomeScreenProps {
  onQuickAction: (query: string) => void;
  onOpenVoice?: () => void;
  onSearchSubmit?: (query: string) => void;
}

const NEED_CARDS = [
  {
    id: 'farmer',
    emoji: '🌾',
    title: 'Farmer',
    subtitle: 'Farming help & schemes',
    query: 'I am a farmer. What government schemes, subsidies and support are available for me?',
  },
  {
    id: 'student',
    emoji: '🎓',
    title: 'Student',
    subtitle: 'Scholarships & education',
    query: 'I am a student. What government scholarships and education support can I apply for?',
  },
  {
    id: 'loan',
    emoji: '💰',
    title: 'Loan',
    subtitle: 'Government-supported loans',
    query: 'I need a government-supported loan. What schemes and credit options are available?',
  },
  {
    id: 'job',
    emoji: '💼',
    title: 'Job & Business',
    subtitle: 'Work, skills & business',
    query: 'I want to start a business or find employment schemes. What government support can I get?',
  },
  {
    id: 'home',
    emoji: '🏠',
    title: 'Home',
    subtitle: 'Housing support',
    query: 'I need housing help. What government schemes like PMAY are available for building a home?',
  },
  {
    id: 'documents',
    emoji: '📄',
    title: 'Documents',
    subtitle: 'Certificates & documents',
    query: 'I need help getting government certificates like Income, Caste, or Domicile certificate. How do I apply?',
  },
  {
    id: 'women',
    emoji: '👩',
    title: 'Women & Family',
    subtitle: 'Family support',
    query: 'What government schemes are available for women, mothers, children and families?',
  },
  {
    id: 'find',
    emoji: '🔎',
    title: 'Find for Me',
    subtitle: 'Find schemes based on your situation',
    query: '__OPEN_FIND_MODAL__',
    featured: true,
  },
];

const LOAN_CARDS = [
  {
    id: 'farming-loan',
    emoji: '🌾',
    title: 'Farming',
    subtitle: 'Loans for farming needs',
    query: 'I need a government loan or credit for farming (such as KCC). How can I get it?',
  },
  {
    id: 'education-loan',
    emoji: '🎓',
    title: 'Education',
    subtitle: 'Help with education financing',
    query: 'I need an education loan scheme for studies. What government interest subsidy or loan schemes exist?',
  },
  {
    id: 'business-loan',
    emoji: '🏪',
    title: 'Business',
    subtitle: 'Help for starting or growing a business',
    query: 'I need a business loan like MUDRA or PMEGP. How do I apply and what is the eligibility?',
  },
  {
    id: 'home-loan',
    emoji: '🏠',
    title: 'Home',
    subtitle: 'Housing-related financial support',
    query: 'I need financial help or home loan subsidy for housing. What options are available?',
  },
  {
    id: 'self-emp-loan',
    emoji: '👷',
    title: 'Self Employment',
    subtitle: 'Support for starting work or a small business',
    query: 'I want to be self-employed and need startup credit or a small vendor loan. What can I apply for?',
  },
  {
    id: 'find-loan',
    emoji: '🔎',
    title: 'Find a Loan',
    subtitle: 'Let Gram Sathi ask a few questions',
    query: 'I need money for my work or personal needs. Can you ask me a few simple questions to find the right government loan or scheme?',
  },
];

const SERVICE_FILTER_TABS_EN = [
  'All',
  'Popular',
  'Loans',
  'Education',
  'Farming',
  'Documents',
  'Jobs',
  'Housing',
];

const SERVICE_FILTER_TABS_HI = [
  'सभी',
  'लोकप्रिय',
  'ऋण एवं लोन',
  'शिक्षा व छात्रवृत्ति',
  'खेती-किसानी',
  'दस्तावेज़',
  'रोजगार',
  'आवास',
];

export function WelcomeScreen({ onQuickAction, onOpenVoice, onSearchSubmit }: WelcomeScreenProps) {
  const [searchInput, setSearchInput] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceLang, setServiceLang] = useState<'en' | 'hi'>('en');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [isFindModalOpen, setIsFindModalOpen] = useState(false);

  const handleHeroSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const t = searchInput.trim();
    if (!t) return;
    if (onSearchSubmit) onSearchSubmit(t);
    else onQuickAction(t);
  };

  const handleCardClick = (query: string) => {
    if (query === '__OPEN_FIND_MODAL__') {
      setIsFindModalOpen(true);
    } else {
      onQuickAction(query);
    }
  };

  const currentTabs = serviceLang === 'hi' ? SERVICE_FILTER_TABS_HI : SERVICE_FILTER_TABS_EN;

  const handleLangSwitch = (lang: 'en' | 'hi') => {
    setServiceLang(lang);
    setSelectedFilter(lang === 'hi' ? 'सभी' : 'All');
  };

  // Filtered services
  const displayedServices = useMemo(() => {
    const list = serviceLang === 'hi' ? POPULAR_SERVICES_HI : POPULAR_SERVICES;
    return list.filter((item) => {
      const isAll = selectedFilter === 'All' || selectedFilter === 'सभी';
      const isPopular = selectedFilter === 'Popular' || selectedFilter === 'लोकप्रिय';

      const matchesCategory =
        isAll ||
        (isPopular && (item.id === 'pm-kisan' || item.id === 'kcc' || item.id === 'ayushman-bharat')) ||
        item.category.toLowerCase().includes(selectedFilter.toLowerCase()) ||
        selectedFilter.toLowerCase().includes(item.category.toLowerCase());

      const s = serviceSearch.trim().toLowerCase();
      const matchesSearch =
        !s ||
        item.title.toLowerCase().includes(s) ||
        item.helpsWith.toLowerCase().includes(s) ||
        item.forWhom.toLowerCase().includes(s);

      return matchesCategory && matchesSearch;
    });
  }, [selectedFilter, serviceSearch, serviceLang]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafaf9] scroll-smooth">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-16 space-y-12">

        {/* ── 1. HERO ── */}
        <div className="text-center">
          <div className="text-4xl sm:text-5xl mb-3">👋</div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
            Namaste!
          </h1>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">
            How can Gram Sathi help you?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto leading-relaxed">
            Find government schemes, loans, scholarships, certificates and other services.
          </p>

          {/* Main Search Input */}
          <form onSubmit={handleHeroSubmit} className="mt-6 max-w-xl mx-auto">
            <div className="relative flex items-center rounded-2xl border border-slate-300 bg-white shadow-sm focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-100 transition-all p-1.5">
              <span className="pl-3.5 pr-2 text-slate-400 text-lg">🔍</span>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="I need help with..."
                className="flex-1 text-[15px] sm:text-base text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none py-2.5 pr-2"
                aria-label="I need help with"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Ask
              </button>
            </div>
          </form>

          {/* Example prompt chips */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto">
            <span className="text-xs text-slate-400">Try:</span>
            {[
              'Find a farmer loan',
              'Scholarship for my child',
              'How do I get an income certificate?',
            ].map((example) => (
              <button
                key={example}
                onClick={() => onQuickAction(example)}
                className="px-3 py-1 rounded-full text-xs bg-white hover:bg-green-50 border border-slate-200 hover:border-green-300 text-slate-600 hover:text-green-800 transition-all cursor-pointer"
              >
                "{example}"
              </button>
            ))}
          </div>

          {/* Talk to Gram Sathi Voice Button */}
          {onOpenVoice && (
            <div className="mt-5">
              <button
                onClick={onOpenVoice}
                className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full border border-green-600 bg-white hover:bg-green-50 text-green-700 font-semibold text-xs sm:text-sm transition-all duration-150 active:scale-95 cursor-pointer shadow-xs"
              >
                <span>🎙️</span>
                <span>Talk to Gram Sathi</span>
              </button>
            </div>
          )}
        </div>

        {/* ── 2. WHAT DO YOU NEED HELP WITH? (8 Cards) ── */}
        <div>
          <div className="text-center mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              What do you need help with?
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose your need to see government schemes and guidance
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NEED_CARDS.map((card) =>
              card.featured ? (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card.query)}
                  className="sm:col-span-2 flex items-center justify-between p-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white transition-all shadow-xs cursor-pointer active:scale-[0.99] text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl sm:text-3xl">{card.emoji}</span>
                    <div>
                      <div className="text-sm sm:text-base font-bold leading-tight">{card.title}</div>
                      <div className="text-xs text-green-100 mt-0.5">{card.subtitle}</div>
                    </div>
                  </div>
                  <span className="text-lg font-bold">→</span>
                </button>
              ) : (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card.query)}
                  className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-green-300 hover:bg-green-50/50 transition-all shadow-xs cursor-pointer text-left active:scale-[0.98]"
                >
                  <span className="text-2xl mt-0.5">{card.emoji}</span>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{card.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{card.subtitle}</div>
                  </div>
                </button>
              )
            )}
          </div>
        </div>

        {/* ── 3. ALL GOVERNMENT SERVICES SECTION ── */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {serviceLang === 'hi' ? 'सरकारी योजनाएं एवं सेवाएं' : 'Government Services'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {serviceLang === 'hi'
                  ? 'सभी प्रमुख योजनाओं और लाभों की जानकारी एक ही जगह।'
                  : 'Everything you can get help with, in one place.'}
              </p>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center self-start sm:self-auto bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleLangSwitch('en')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  serviceLang === 'en'
                    ? 'bg-white text-green-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handleLangSwitch('hi')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  serviceLang === 'hi'
                    ? 'bg-white text-green-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                हिन्दी
              </button>
            </div>
          </div>

          {/* Service Search Box */}
          <div className="relative flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 mb-3 focus-within:bg-white focus-within:border-green-500 transition-all">
            <span className="text-slate-400 text-sm mr-2">🔍</span>
            <input
              type="text"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              placeholder={serviceLang === 'hi' ? 'योजना खोजें (जैसे किसान, लोन, छात्रवृत्ति)...' : 'Search for a service...'}
              className="flex-1 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
            />
            {serviceSearch && (
              <button
                onClick={() => setServiceSearch('')}
                className="text-xs text-slate-400 hover:text-slate-600 ml-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-4">
            {currentTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedFilter(tab)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedFilter === tab
                    ? 'bg-green-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayedServices.map((service) => (
              <div
                key={service.id}
                className="flex flex-col justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-green-200 hover:shadow-xs transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                      {service.category}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {serviceLang === 'hi' ? 'पात्रता:' : 'For:'} {service.forWhom}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {service.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-2">
                    {service.helpsWith}
                  </p>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {serviceLang === 'hi' ? 'आधिकारिक पोर्टल' : 'Official Portal'}
                  </span>
                  <Link
                    to={`/services/${service.id}${serviceLang === 'hi' ? '?lang=hi' : ''}`}
                    className="text-xs font-bold text-green-700 hover:text-green-900 cursor-pointer flex items-center gap-1 group py-1 px-1.5 rounded-md hover:bg-green-50 transition-colors"
                  >
                    <span>{serviceLang === 'hi' ? 'विवरण देखें' : 'View Service'}</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {displayedServices.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400">
              {serviceLang === 'hi'
                ? 'आपकी खोज के अनुसार कोई सेवा नहीं मिली। "किसान", "लोन" या "छात्रवृत्ति" खोजकर देखें।'
                : 'No services matched your search. Try searching for "loan", "farmer", or "scholarship".'}
            </div>
          )}
        </div>

        {/* ── 4. NEED A LOAN? SECTION ── */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 shadow-xs">
          <div className="mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Need a Loan?
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Tell Gram Sathi what you need money for.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {LOAN_CARDS.map((loan) => (
              <button
                key={loan.id}
                onClick={() => onQuickAction(loan.query)}
                className="flex flex-col items-start p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-green-50/60 hover:border-green-200 transition-all cursor-pointer text-left active:scale-[0.98]"
              >
                <span className="text-xl mb-1.5">{loan.emoji}</span>
                <div className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                  {loan.title}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  {loan.subtitle}
                </div>
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 mt-3.5">
            * Clearly distinguishes government interest subsidies, credit support and schemes.
          </p>
        </div>

        {/* ── 5. NOT SURE WHAT YOU QUALIFY FOR? (Find Schemes for Me) ── */}
        <div className="rounded-3xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
              Don't know which scheme you need?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Tell Gram Sathi a little about yourself. We'll find schemes tailored to your situation.
            </p>
          </div>
          <button
            onClick={() => setIsFindModalOpen(true)}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap active:scale-95 text-center"
          >
            Find Schemes For Me →
          </button>
        </div>

        {/* ── 6. TRUST FOOTER ── */}
        <div className="text-center pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500 font-medium">
            Information from official government sources (myScheme / Digital India).
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Always check the official portal for the latest rules, eligibility, and procedures.
          </p>
        </div>

      </div>

      {/* Find Schemes Wizard Modal */}
      <FindSchemesModal
        isOpen={isFindModalOpen}
        onClose={() => setIsFindModalOpen(false)}
        onSubmit={(q) => onQuickAction(q)}
      />
    </div>
  );
}
