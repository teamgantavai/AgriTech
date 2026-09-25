// ================================================================
// HomePage.tsx — Gram Sathi AI Citizen & Farmer Portal
// Rich government service cards, live categories, and voice control
// ================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { POPULAR_SERVICES } from '../data/popularServices';
import { useAssistant } from '../context/AssistantContext';

const CATEGORIES = [
  { id: 'agriculture', title: 'Agriculture & Farming', icon: '🌾', count: '12 Schemes', path: '/schemes/agriculture' },
  { id: 'scholarships', title: 'Scholarships & Education', icon: '🎓', count: '8 Schemes', path: '/schemes/scholarships' },
  { id: 'business', title: 'Business & Loans (MUDRA)', icon: '💼', count: '9 Schemes', path: '/schemes/business' },
  { id: 'health', title: 'Health & Ayushman Bharat', icon: '🏥', count: '6 Schemes', path: '/schemes/health' },
  { id: 'housing', title: 'Housing & Solar (KUSUM)', icon: '☀️', count: '5 Schemes', path: '/schemes/housing' },
  { id: 'all', title: 'All Government Schemes', icon: '🏛️', count: '870+ Schemes', path: '/schemes' },
];

export function HomePage() {
  const navigate = useNavigate();
  const { startVoice } = useAssistant();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/schemes?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 pb-16">
      {/* ── Top Hero Banner ── */}
      <section className="bg-gradient-to-b from-green-800 via-emerald-900 to-slate-900 text-white px-4 sm:px-6 pt-8 sm:pt-16 pb-10 sm:pb-20 text-center relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl mx-auto relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] sm:text-xs font-semibold mb-3 sm:mb-4 border border-emerald-400/30">
            <span>🇮🇳</span>
            <span>Digital India • Voice-First Citizen Services</span>
          </div>

          <h1 className="text-2xl sm:text-5xl font-extrabold tracking-tight mb-2.5 sm:mb-4 leading-tight">
            Gram Sathi AI
          </h1>
          <p className="text-xs sm:text-lg text-slate-200 max-w-xl mb-6 sm:mb-8 leading-relaxed px-1">
            Your voice-controlled guide to Indian government schemes, farmer subsidies, scholarships, and official portals.
          </p>

          {/* Quick Voice Launch CTA */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 w-full max-w-sm sm:max-w-none mb-6 sm:mb-8">
            <button
              onClick={() => startVoice({ defaultMode: 'expanded' })}
              className="flex items-center justify-center gap-2.5 px-6 py-3 sm:py-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold rounded-xl sm:rounded-full shadow-lg shadow-emerald-500/30 transition-all text-sm sm:text-base cursor-pointer"
            >
              <span className="text-lg">🎙️</span>
              <span>Talk to Gram Sathi</span>
            </button>
            <button
              onClick={() => navigate('/calendar')}
              className="flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-semibold rounded-xl sm:rounded-full border border-white/20 transition-all text-xs sm:text-sm cursor-pointer"
            >
              <span>🌾</span>
              <span>Crop Calendar</span>
            </button>
          </div>

          {/* Direct Search Bar */}
          <form onSubmit={handleSearchSubmit} className="w-full max-w-xl relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search schemes (PM-Kisan, KUSUM, MUDRA)..."
              className="w-full px-4 sm:px-5 py-2.5 sm:py-3.5 pl-10 sm:pl-12 pr-20 sm:pr-24 rounded-full bg-white/95 text-slate-800 placeholder-slate-400 text-xs sm:text-sm font-medium shadow-xl shadow-black/20 focus:outline-none focus:ring-2 focus:ring-emerald-400 border border-white/20"
            />
            <span className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm sm:text-base">
              🔍
            </span>
            <button
              type="submit"
              className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 px-3 sm:px-4 py-1 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-full shadow-xs transition-all cursor-pointer"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* ── Citizen Trust Bar ── */}
      <div className="bg-emerald-950/90 text-emerald-200 border-b border-emerald-900/50 py-2 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-around sm:justify-center gap-4 sm:gap-12 text-[10px] sm:text-xs font-semibold tracking-wide">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">🏛️</span>
            <span>870+ Schemes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">⚡</span>
            <span>Voice-First AI</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">🛡️</span>
            <span>100% Free & Official</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 pt-5 sm:pt-8">
        {/* ── Agriculture News Ticker ── */}
        <div 
          data-ai-section="advisory"
          data-ai-title="Government Advisory"
          className="bg-white rounded-xl sm:rounded-2xl shadow-xs border border-slate-200 p-3 sm:p-4 mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3"
        >
          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 sm:py-1.5 rounded-lg border border-emerald-100 flex-shrink-0">
            <span>📢</span>
            <span>Government Advisory</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 flex-1 leading-relaxed">
            PM-Kisan 17th installment release active. Farmers can update eKYC with OTP or nearest CSC center.
          </p>
          <button
            onClick={() => navigate('/services/pm-kisan')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex-shrink-0 flex items-center gap-1 cursor-pointer self-end sm:self-auto"
          >
            Check PM-Kisan Details →
          </button>
        </div>

        {/* ── Category Quick Grid ── */}
        <section 
          data-ai-section="categories"
          data-ai-title="Scheme Categories"
          className="mb-8 sm:mb-10"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-xl font-bold text-slate-900">Explore by Category</h2>
            <button
              onClick={() => navigate('/schemes')}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              View all 870+ schemes →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => navigate(cat.path)}
                className="bg-white hover:bg-emerald-50/50 active:scale-[0.98] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 hover:border-emerald-300 shadow-2xs text-left transition-all group flex flex-col justify-between cursor-pointer"
              >
                <div className="text-xl sm:text-2xl mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform">
                  {cat.icon}
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-800 leading-tight">
                    {cat.title}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1">{cat.count}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── Featured Government Schemes ── */}
        <section 
          data-ai-section="featured-schemes"
          data-ai-title="Featured Government Schemes"
          className="mb-10 sm:mb-12"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <h2 className="text-base sm:text-xl font-bold text-slate-900">Featured Government Schemes</h2>
              <p className="text-[11px] sm:text-xs text-slate-500">Curated high-impact services for citizens and rural households</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {POPULAR_SERVICES.slice(0, 6).map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {service.category}
                    </span>
                    <span className="text-[11px] sm:text-xs text-slate-400">Official</span>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1 leading-snug">
                    {service.title}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3 sm:mb-4 leading-relaxed">
                    {service.helpsWith || service.whatIsIt}
                  </p>
                </div>

                <div className="pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate max-w-[140px] sm:max-w-[150px]">
                    {service.forWhom}
                  </span>
                  <button
                    onClick={() => navigate(`/services/${service.id}`)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
