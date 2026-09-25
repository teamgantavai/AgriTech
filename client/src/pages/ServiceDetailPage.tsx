// ================================================================
// ServiceDetailPage.tsx — Dedicated Full Page for Government Services
// Direct URL, shareable, bookmarkable, context-aware AI integration
// ================================================================

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getServiceById, type GovernmentServiceItem } from '../data/popularServices';
import { setActiveServiceContext } from '../services/sessionManager';
import { supportedPortalRegistry } from '../services/formCopilot/supportedPortalRegistry';

export function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [language, setLanguage] = useState<'en' | 'hi'>(() => {
    return (searchParams.get('lang') === 'hi' ? 'hi' : 'en');
  });
  const [service, setService] = useState<GovernmentServiceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isHi = language === 'hi';

  const toggleLanguage = (newLang: 'en' | 'hi') => {
    setLanguage(newLang);
    setSearchParams(newLang === 'hi' ? { lang: 'hi' } : {});
  };

  useEffect(() => {
    window.scrollTo(0, 0);

    if (!slug) {
      setError(isHi ? 'सेवा नहीं मिली।' : 'Service not found.');
      setLoading(false);
      return;
    }

    const cleanSlug = slug.toLowerCase().trim();

    // 1. Check in curated popular services (supports English and Hindi JSON)
    const foundLocal = getServiceById(cleanSlug, language);

    if (foundLocal) {
      setService(foundLocal);
      setActiveServiceContext({
        id: foundLocal.id,
        title: foundLocal.title,
        category: foundLocal.category,
        helpsWith: foundLocal.helpsWith,
        source: foundLocal.source,
        officialUrl: foundLocal.officialUrl,
        sections: {
          overview: foundLocal.whatIsIt || foundLocal.helpsWith,
          benefits: foundLocal.whatYouGet?.join('; ') || '',
          eligibility: foundLocal.whoCanGet?.join('; ') || '',
          documents: foundLocal.whatPapers?.join('; ') || '',
          application: foundLocal.howToApply?.join('; ') || '',
          faq: foundLocal.officialUrl ? `Official portal: ${foundLocal.officialUrl}` : '',
        },
      });
      setLoading(false);
      return;
    }

    // 2. Fetch from backend API /api/schemes/:id for all 870 government schemes
    fetch(`/api/schemes/${encodeURIComponent(cleanSlug)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Service not found in government database');
        return res.json();
      })
      .then((data) => {
        const sec = data.sections || {};
        const mapped: GovernmentServiceItem = {
          id: data.slug || data.id || cleanSlug,
          title: data.title || cleanSlug,
          category: (data.category as any) || (isHi ? 'सरकारी योजना' : 'Government Scheme'),
          forWhom: (sec.eligibility && sec.eligibility[0]) || (isHi ? 'पात्र भारतीय नागरिक' : 'Eligible Indian citizens'),
          helpsWith: sec.about || data.question || data.answer || (isHi ? 'सरकारी सहायता एवं कल्याणकारी योजना।' : 'Government support and welfare scheme.'),
          whatIsIt: sec.about || data.answer || (isHi ? 'आधिकारिक सरकारी कल्याण योजना।' : 'Official government welfare scheme.'),
          whoCanGet: sec.eligibility && sec.eligibility.length > 0 ? sec.eligibility : [isHi ? 'विस्तृत पात्रता नियमों के लिए आधिकारिक वेबसाइट देखें।' : 'Check the official website for detailed eligibility criteria.'],
          whatYouGet: sec.benefits && sec.benefits.length > 0 ? sec.benefits : [isHi ? 'सरकारी नियमों अनुसार वित्तीय सहायता और योजना के लाभ।' : 'Financial assistance and scheme benefits as per government norms.'],
          whatPapers: sec.documents && sec.documents.length > 0 ? sec.documents : [isHi ? 'दस्तावेज़ की आवश्यकता भिन्न हो सकती है। आधिकारिक पोर्टल पर जांचें।' : 'Document requirements may vary. Check the official website for the latest requirements.'],
          howToApply: sec.applicationSteps && sec.applicationSteps.length > 0 ? sec.applicationSteps : [isHi ? 'आवेदन प्रक्रिया भिन्न हो सकती है। वर्तमान प्रक्रिया आधिकारिक वेबसाइट पर देखें।' : 'The application process can vary. Please check the official website for the current process.'],
          officialUrl: data.url || (sec.whereToApply && sec.whereToApply.portalUrl) || 'https://www.myscheme.gov.in',
          source: data.source || (isHi ? 'भारत सरकार' : 'Government of India'),
        };
        setService(mapped);
        setActiveServiceContext({
          id: mapped.id,
          title: mapped.title,
          category: mapped.category,
          helpsWith: mapped.helpsWith,
          source: mapped.source,
          officialUrl: mapped.officialUrl,
          sections: {
            overview: mapped.whatIsIt || mapped.helpsWith,
            benefits: mapped.whatYouGet?.join('; ') || '',
            eligibility: mapped.whoCanGet?.join('; ') || '',
            documents: mapped.whatPapers?.join('; ') || '',
            application: mapped.howToApply?.join('; ') || '',
            faq: mapped.officialUrl ? `Official portal: ${mapped.officialUrl}` : '',
          },
        });
        setLoading(false);
      })
      .catch(() => {
        setError(isHi ? 'यह सरकारी योजना नहीं मिली।' : 'We couldn\'t find this government service.');
        setLoading(false);
      });
  }, [slug, language, isHi]);

  const handleAskInChat = () => {
    if (!service) return;
    setActiveServiceContext({
      id: service.id,
      title: service.title,
      category: service.category,
      helpsWith: service.helpsWith,
      source: service.source,
      officialUrl: service.officialUrl,
    });
    const promptId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    navigate('/chat', {
      state: {
        initialQuery: isHi
          ? `मुझे ${service.title} के बारे में बताएं। इसके लिए कौन आवेदन कर सकता है और क्या लाभ मिलते हैं?`
          : `Tell me about ${service.title}. Who can apply and what are the benefits?`,
        serviceContext: service,
        promptId,
      },
    });
  };

  const handleTalkInVoice = () => {
    if (!service) return;
    setActiveServiceContext({
      id: service.id,
      title: service.title,
      category: service.category,
      helpsWith: service.helpsWith,
      source: service.source,
      officialUrl: service.officialUrl,
    });
    navigate('/voice?start=true', {
      state: {
        serviceContext: service,
      },
    });
  };

  const matchedPortal = useMemo(() => {
    if (!service) return null;
    if (service.officialUrl) {
      const validation = supportedPortalRegistry.validateUrl(service.officialUrl);
      if (validation.portal) return validation.portal;
    }
    return supportedPortalRegistry.findPortalByKeyword(`${service.title} ${service.id} ${service.category}`);
  }, [service]);

  // Loading Skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafaf9] text-slate-900">
        <div className="border-b border-slate-200 bg-white px-4 sm:px-6 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link to="/schemes" className="text-xs font-bold text-slate-600 hover:text-green-700 flex items-center gap-1.5">
              <span>←</span>
              <span>Back to Schemes</span>
            </Link>
          </div>
        </div>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6 animate-pulse">
          <div className="h-6 w-32 bg-slate-200 rounded-full" />
          <div className="h-10 w-3/4 bg-slate-200 rounded-2xl" />
          <div className="h-4 w-full bg-slate-200 rounded-xl" />
          <div className="h-4 w-5/6 bg-slate-200 rounded-xl" />
          <div className="h-40 w-full bg-slate-200 rounded-3xl mt-6" />
        </main>
      </div>
    );
  }

  // Error / Not found
  if (error || !service) {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex flex-col items-center justify-center px-4 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Service not found</h1>
        <p className="text-sm text-slate-500 mb-6 max-w-sm">
          {error || 'We couldn\'t find the requested government scheme.'}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-all shadow-xs"
        >
          <span>← Back to Services</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#fafaf9] text-slate-900 flex flex-col">
      {/* ── Sub-Navigation / Breadcrumb Bar ── */}
      <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xs px-4 sm:px-6 py-2.5 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            to="/schemes"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-green-700 transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-100"
          >
            <span className="text-sm">←</span>
            <span>{isHi ? 'सभी योजनाएं (Schemes)' : 'Back to Schemes'}</span>
          </Link>

          <div className="flex items-center gap-3">
            {/* Language Switcher Pill */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => toggleLanguage('en')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !isHi ? 'bg-white text-green-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => toggleLanguage('hi')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isHi ? 'bg-white text-green-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                हिन्दी
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Container ── */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">

        {/* ── Service Header ── */}
        <div
          data-ai-section="overview"
          data-ai-title={isHi ? 'योजना का परिचय' : 'Scheme Overview'}
          className="space-y-3 scroll-mt-24"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-800 border border-green-200">
              {service.category}
            </span>
            <span className="text-xs text-slate-500">
              {service.source}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
            {service.title}
          </h1>

          <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-medium">
            {service.helpsWith}
          </p>
        </div>

        {/* ── Ask Gram Sathi AI Feature Card (Hero Position) ── */}
        <div className="bg-white rounded-3xl border border-green-200/90 bg-gradient-to-br from-green-50/60 to-emerald-50/40 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-green-800 tracking-wide uppercase">
                {isHi ? 'कोई प्रश्न है?' : 'Have questions?'}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                {isHi ? 'ग्राम साथी इस सेवा को सरल भाषा में समझा सकता है' : 'Gram Sathi can explain this service in simple words'}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {isHi ? 'पात्रता, ज़रूरी दस्तावेज़, राज्य के नियम या आवेदन प्रक्रिया पूछें।' : 'Ask about eligibility, documents, state rules, or how to apply.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
              {matchedPortal && (
                <button
                  type="button"
                  onClick={() => navigate(`/copilot/${matchedPortal.portalId}`)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white text-xs sm:text-sm font-extrabold shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95 min-h-[44px]"
                  title="Open Gram Sathi Form Copilot for official portal"
                >
                  <span className="text-amber-300">⚡</span>
                  <span>{isHi ? 'फॉर्म कोपायलट से भरें' : 'Apply with Form Copilot'}</span>
                </button>
              )}
              <button
                onClick={handleAskInChat}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer active:scale-95 min-h-[44px]"
              >
                <span>{isHi ? '💬 चैट में पूछें' : '💬 Ask in Chat'}</span>
              </button>
              <button
                onClick={handleTalkInVoice}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-green-600 bg-white hover:bg-green-50 text-green-700 text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 min-h-[44px]"
              >
                <span>{isHi ? '🎙️ बोलकर पूछें' : '🎙️ Talk to Gram Sathi'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Section: What is it? (Overview) ── */}
        <section
          data-ai-section="overview"
          data-ai-title={isHi ? 'योजना का परिचय' : 'Scheme Overview'}
          className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-3 scroll-mt-24"
        >
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>{isHi ? 'यह योजना क्या है?' : 'What is it?'}</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
            {service.whatIsIt}
          </p>
        </section>

        {/* ── Section: Who is it for? (Eligibility) ── */}
        <section
          data-ai-section="eligibility"
          data-ai-title={isHi ? 'पात्रता नियम' : 'Eligibility Requirements'}
          className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-3 scroll-mt-24"
        >
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            {isHi ? 'यह किसके लिए है?' : 'Who is it for?'}
          </h2>
          <ul className="space-y-2 text-sm text-slate-700 pl-4 list-disc">
            {service.whoCanGet.map((eligibility, i) => (
              <li key={i} className="leading-relaxed">
                {eligibility}
              </li>
            ))}
          </ul>
        </section>

        {/* ── Section: What do you get? (Benefits) ── */}
        <section
          data-ai-section="benefits"
          data-ai-title={isHi ? 'योजना के लाभ' : 'Benefits & Assistance'}
          className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-4 scroll-mt-24"
        >
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            {isHi ? 'आपको क्या लाभ मिलेगा?' : 'What do you get?'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {service.whatYouGet.map((benefit, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3.5 rounded-2xl bg-green-50/70 border border-green-100 text-sm text-slate-800"
              >
                <span className="text-green-600 font-bold text-base mt-0.5">✓</span>
                <span className="leading-relaxed font-medium">{benefit}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section: What do I need? (Documents) ── */}
        <section
          data-ai-section="documents"
          data-ai-title={isHi ? 'ज़रूरी दस्तावेज़' : 'Documents Required'}
          className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-3 scroll-mt-24"
        >
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            {isHi ? 'कौन-से दस्तावेज़ चाहिए?' : 'What papers do I need?'}
          </h2>
          <ul className="space-y-2 text-sm text-slate-700 pl-4 list-disc">
            {service.whatPapers.map((doc, i) => (
              <li key={i} className="leading-relaxed">
                {doc}
              </li>
            ))}
          </ul>
        </section>

        {/* ── Section: How to Apply (Application Timeline) ── */}
        <section
          data-ai-section="application"
          data-ai-title={isHi ? 'आवेदन प्रक्रिया' : 'How to Apply'}
          className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-5 scroll-mt-24"
        >
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {isHi ? 'आवेदन कैसे करें?' : 'How do I apply?'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isHi ? 'आवेदन करने के लिए इन आसान चरणों का पालन करें' : 'Follow these simple steps to submit your application'}
            </p>
          </div>

          <div className="space-y-4">
            {service.howToApply.map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-800 font-extrabold text-sm flex items-center justify-center flex-shrink-0 mt-0.5 border border-green-200">
                  {i + 1}
                </div>
                <div className="flex-1 pt-1 text-sm text-slate-800 leading-relaxed font-medium">
                  {step}
                </div>
              </div>
            ))}
          </div>

          {/* Form Copilot Assisted Application Banner */}
          {matchedPortal && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-extrabold uppercase tracking-wide">
                    <span>⚡</span>
                    <span>{isHi ? 'ग्राम साथी फ़ॉर्म कोपायलट' : 'Gram Sathi Form Copilot'}</span>
                  </span>
                  <span className="text-[11px] text-emerald-800 font-semibold">
                    {matchedPortal.name}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 font-medium">
                  {isHi
                    ? 'अपनी सत्यापित ग्राम साथी प्रोफ़ाइल और दस्तावेज़ों का उपयोग करके इस आधिकारिक पोर्टल का फ़ॉर्म सुरक्षित और स्वचालित रूप से भरें।'
                    : 'Intelligently prepare and fill this official government application using your verified profile and uploaded documents.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/copilot/${matchedPortal.portalId}`)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex-shrink-0 min-h-[40px]"
              >
                <span>⚡</span>
                <span>{isHi ? 'फ़ॉर्म भरना शुरू करें' : 'Start Form Copilot'}</span>
                <span>→</span>
              </button>
            </div>
          )}

          {/* Visit Official Website Button / FAQ Section */}
          {service.officialUrl && (
            <div
              data-ai-section="faq"
              data-ai-title={isHi ? 'आधिकारिक पोर्टल' : 'Official Portal'}
              className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 scroll-mt-24"
            >
              <p className="text-xs text-slate-500">
                {isHi ? 'आधिकारिक आवेदन सीधे संबंधित सरकारी विभाग के पोर्टल पर होते हैं।' : 'Official applications are hosted directly by the government department.'}
              </p>
              <a
                href={service.officialUrl.startsWith('http') ? service.officialUrl : `https://${service.officialUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white text-xs sm:text-sm font-bold transition-all shadow-xs min-h-[44px]"
              >
                <span>{isHi ? 'आधिकारिक पोर्टल पर जाएं' : 'Visit Official Website'}</span>
                <span>→</span>
              </a>
            </div>
          )}
        </section>

        {/* ── Bottom Trust Strip ── */}
        <div className="text-center pt-4 pb-8 border-t border-slate-200 text-xs text-slate-400 space-y-1">
          <p>{isHi ? 'सरकारी डेटाबेस एवं आधिकारिक पोर्टलों से सत्यापित जानकारी।' : 'Verified information from official government databases and portals.'}</p>
          <p>{isHi ? 'ग्राम साथी कभी भी ओटीपी, पासवर्ड या बैंक विवरण नहीं मांगता।' : 'Gram Sathi never asks for OTP, passwords, or personal banking details.'}</p>
        </div>

      </main>
    </div>
  );
}
