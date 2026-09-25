// ================================================================
// SchemesPage.tsx — Dedicated Government Schemes Explorer
// Supports categories (/schemes/agriculture, /schemes/scholarships, etc.)
// Real-time filtering, search, and voice assistant awareness
// ================================================================

import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { POPULAR_SERVICES, type GovernmentServiceItem } from '../data/popularServices';
import { updateUIState } from '../agent/agentBridge';
import { eventBus } from '../services/eventBus';

// Additional mock/extended government schemes for scholarships, health, business
const EXTENDED_SCHEMES: GovernmentServiceItem[] = [
  {
    id: 'pm-kisan',
    title: 'PM-KISAN Samman Nidhi',
    category: 'Agriculture',
    forWhom: 'Small & Marginal Landholding Farmers',
    helpsWith: '₹6,000 per year direct income support in three ₹2,000 installments into Aadhaar-linked bank accounts.',
    whatIsIt: 'Central Sector scheme to provide income support to all landholding farmer families in the country.',
    whoCanGet: ['All landholding farmer families with cultivable land.'],
    whatYouGet: ['₹6,000 per year directly in bank accounts through DBT.'],
    whatPapers: ['Aadhaar Card', 'Land holding papers (Khatauni)', 'Active bank account'],
    howToApply: ['Apply online on pmkisan.gov.in or through nearest CSC center.'],
    officialUrl: 'https://pmkisan.gov.in',
    source: 'Ministry of Agriculture & Farmers Welfare',
  },
  {
    id: 'pmfby',
    title: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    category: 'Agriculture',
    forWhom: 'All Farmers Growing Notified Crops',
    helpsWith: 'Comprehensive insurance coverage against crop damage due to drought, floods, pest attacks and natural disasters.',
    whatIsIt: 'Low-premium crop insurance scheme where farmers pay only 1.5% to 2% premium.',
    whoCanGet: ['All farmers including sharecroppers and tenant farmers.'],
    whatYouGet: ['Full sum insured paid directly for localized calamities and post-harvest losses within 72 hours of reporting.'],
    whatPapers: ['Aadhaar Card', 'Land possession certificate or tenancy agreement', 'Sowing certificate from Patwari'],
    howToApply: ['Apply through PMFBY portal, bank branch, or Crop Insurance App within 72h of loss.'],
    officialUrl: 'https://pmfby.gov.in',
    source: 'Ministry of Agriculture',
  },
  {
    id: 'nsp-pre-matric',
    title: 'National Scholarship Scheme (Pre-Matric)',
    category: 'Scholarships',
    forWhom: 'Minority & Underprivileged Students (Class 1 to 10)',
    helpsWith: 'Financial support for tuition fees, school books, and maintenance to prevent school dropout.',
    whatIsIt: 'Central government scholarship to assist parents in educating their children from primary to matric level.',
    whoCanGet: ['Students studying in Class 1 to 10 with family income below ₹1 Lakh per year.'],
    whatYouGet: ['Annual financial assistance of ₹1,000 to ₹10,000 based on class and state norms.'],
    whatPapers: ['Aadhaar card', 'Income certificate', 'Previous year marksheet', 'Bank passbook'],
    howToApply: ['Register on scholarships.gov.in (National Scholarship Portal) with school verification.'],
    officialUrl: 'https://scholarships.gov.in',
    source: 'Ministry of Minority Affairs',
  },
  {
    id: 'nsp-post-matric',
    title: 'National Scholarship Scheme (Post-Matric)',
    category: 'Scholarships',
    forWhom: 'College, Higher Secondary & Diploma Students',
    helpsWith: 'Tuition fees, study allowances, and living costs for higher education.',
    whatIsIt: 'Government financial grant to encourage post-secondary education among marginalized communities.',
    whoCanGet: ['Class 11, 12, ITI, Diploma, Undergraduate and Postgraduate students.'],
    whatYouGet: ['Full course fees reimbursement plus monthly maintenance allowance.'],
    whatPapers: ['Aadhaar card', 'Caste/Category certificate', 'College admission receipt', 'Income certificate'],
    howToApply: ['Submit application online via NSP Portal scholarships.gov.in.'],
    officialUrl: 'https://scholarships.gov.in',
    source: 'Ministry of Social Justice & Empowerment',
  },
];

const ALL_SCHEMES: GovernmentServiceItem[] = [
  ...POPULAR_SERVICES.map((s) => ({
    ...s,
    category: s.category === 'Farming' ? 'Agriculture' : s.category,
  })),
  ...EXTENDED_SCHEMES,
];

const CATEGORY_TABS = [
  { id: 'all', label: 'All Schemes', icon: '🏛️' },
  { id: 'agriculture', label: 'Agriculture & Farming', icon: '🌾' },
  { id: 'scholarships', label: 'Scholarships', icon: '🎓' },
  { id: 'business', label: 'Business & Loans', icon: '💼' },
  { id: 'health', label: 'Health & Medical', icon: '🏥' },
  { id: 'housing', label: 'Housing & Solar', icon: '☀️' },
];

export function SchemesPage() {
  const { category: routeCategory } = useParams<{ category?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeCategory = (routeCategory || searchParams.get('category') || 'all').toLowerCase();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  // Synchronize document title and UIState for AI Assistant awareness
  useEffect(() => {
    const pageTitle = activeCategory === 'all'
      ? 'Government Schemes Catalog — Gram Sathi'
      : `${activeCategory.toUpperCase()} Government Schemes — Gram Sathi`;

    document.title = pageTitle;
    updateUIState({
      route: window.location.pathname,
      pageName: pageTitle,
      activeTab: activeCategory,
      visibleActions: ['filter_category', 'search_scheme', 'open_scheme_details'],
    });

    eventBus.emit({
      type: 'PAGE_READY',
      route: window.location.pathname,
      title: pageTitle,
    });
  }, [activeCategory]);

  // Filter schemes by category and search
  const filteredSchemes = useMemo(() => {
    let list = ALL_SCHEMES;

    if (activeCategory !== 'all') {
      if (activeCategory === 'agriculture' || activeCategory === 'farming') {
        list = list.filter((s) => s.category.toLowerCase().includes('agri') || s.category.toLowerCase().includes('farm'));
      } else if (activeCategory === 'scholarships' || activeCategory === 'education') {
        list = list.filter((s) => s.category.toLowerCase().includes('scholar') || s.category.toLowerCase().includes('edu'));
      } else if (activeCategory === 'business' || activeCategory === 'loans') {
        list = list.filter((s) => s.category.toLowerCase().includes('business') || s.category.toLowerCase().includes('loan'));
      } else if (activeCategory === 'health' || activeCategory === 'medical') {
        list = list.filter((s) => s.category.toLowerCase().includes('health') || s.category.toLowerCase().includes('medic'));
      } else if (activeCategory === 'housing' || activeCategory === 'solar') {
        list = list.filter((s) => s.category.toLowerCase().includes('hous') || s.category.toLowerCase().includes('solar'));
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.helpsWith.toLowerCase().includes(q) ||
          s.whatIsIt.toLowerCase().includes(q) ||
          s.forWhom.toLowerCase().includes(q)
      );
    }

    return list;
  }, [activeCategory, searchQuery]);

  const handleCategoryClick = (catId: string) => {
    if (catId === 'all') {
      navigate('/schemes');
    } else {
      navigate(`/schemes/${catId}`);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 pb-20">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">
                Official Directory • 870+ Central & State Schemes
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {activeCategory === 'all'
                  ? 'Government Schemes Directory'
                  : activeCategory === 'agriculture'
                  ? 'Agriculture & Farmer Schemes'
                  : activeCategory === 'scholarships'
                  ? 'Scholarships & Educational Grants'
                  : `${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Schemes`}
              </h1>
            </div>

            {/* Search Input */}
            <div data-ai-section="search" data-ai-title="Search Schemes" className="w-full sm:w-80 relative scroll-mt-24">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search within schemes..."
                className="w-full px-4 py-2.5 pl-10 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* ── Category Filter Tabs ── */}
          <div data-ai-section="categories" data-ai-title="Scheme Categories" className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none scroll-mt-24">
            {CATEGORY_TABS.map((tab) => {
              const isSelected = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleCategoryClick(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer border ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/30'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Schemes Cards Grid ── */}
      <main data-ai-section="scheme-list" data-ai-title="Government Schemes" className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 scroll-mt-24">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{filteredSchemes.length}</strong> verified government schemes
          </p>
          <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
            <span>✓</span>
            <span>Direct Citizen Eligibility</span>
          </div>
        </div>

        {filteredSchemes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center my-6">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-base font-bold text-slate-800 mb-1">No schemes found</h3>
            <p className="text-xs text-slate-500 mb-4">
              Try searching with different keywords or switch categories.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                navigate('/schemes');
              }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSchemes.map((scheme) => (
              <div
                key={scheme.id}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-emerald-300 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider">
                      {scheme.category}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">Direct Benefit</span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-800 transition-colors mb-2 leading-tight">
                    {scheme.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-3 mb-4 leading-relaxed">
                    {scheme.helpsWith || scheme.whatIsIt}
                  </p>

                  <div className="bg-slate-50 rounded-xl p-2.5 mb-4 border border-slate-100 text-[11px]">
                    <div className="text-slate-400 font-medium mb-0.5">Target Beneficiaries:</div>
                    <div className="text-slate-700 font-semibold truncate">{scheme.forWhom}</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => navigate(`/services/${scheme.id}`)}
                    className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>View Scheme Details & Apply</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
