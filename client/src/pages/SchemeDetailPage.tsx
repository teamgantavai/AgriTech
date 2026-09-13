import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  HelpCircle,
  Award,
  CreditCard,
  MapPin,
  ExternalLink,
  Volume2,
  Sparkles,
  ShieldCheck,
  ListOrdered
} from 'lucide-react';
import { useVoiceModal } from '../context/VoiceModalContext';
import { clsx } from 'clsx';

interface SchemeData {
  id: string;
  slug: string;
  topic: string;
  title: string;
  category: string;
  question: string;
  answer: string;
  source: string;
  url: string;
  sections: {
    about: string;
    eligibility: string[];
    benefits: string[];
    applicationSteps: string[];
    documents: string[];
    fees: string;
    whereToApply: {
      channel: string;
      details: string;
      portalUrl: string;
    };
    warnings: string[];
    links: { title: string; url: string }[];
  };
}

export function SchemeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [scheme, setScheme] = useState<SchemeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    currentSchemeId,
    setCurrentSchemeId,
    highlightSection,
    setHighlightSection,
    explainCurrentScheme,
    openVoiceModal,
    isAssistantActive,
  } = useVoiceModal();

  // Section card refs for auto-scrolling on voice query
  const sectionRefs = {
    about: useRef<HTMLDivElement>(null),
    eligibility: useRef<HTMLDivElement>(null),
    benefits: useRef<HTMLDivElement>(null),
    applicationSteps: useRef<HTMLDivElement>(null),
    documents: useRef<HTMLDivElement>(null),
    fees: useRef<HTMLDivElement>(null),
    whereToApply: useRef<HTMLDivElement>(null),
    warnings: useRef<HTMLDivElement>(null),
    links: useRef<HTMLDivElement>(null),
  };

  useEffect(() => {
    if (!id) return;
    setCurrentSchemeId(id);

    async function fetchScheme() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/schemes/${id}`);
        if (!res.ok) {
          throw new Error('योजना की जानकारी लोड नहीं हो पाई।');
        }
        const data = await res.json();
        setScheme(data);
      } catch (err: any) {
        console.error('Error fetching scheme:', err);
        setError(err.message || 'योजना लोड करने में समस्या आई।');
      } finally {
        setLoading(false);
      }
    }

    fetchScheme();
  }, [id, setCurrentSchemeId]);

  // Handle section highlighting & auto-scroll
  useEffect(() => {
    if (highlightSection && sectionRefs[highlightSection as keyof typeof sectionRefs]?.current) {
      const el = sectionRefs[highlightSection as keyof typeof sectionRefs].current;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Automatically remove highlight after 6 seconds
      const timer = setTimeout(() => {
        setHighlightSection(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [highlightSection, setHighlightSection]);

  const handleSpeakSummary = () => {
    if (scheme) {
      if (!isAssistantActive) {
        openVoiceModal();
      }
      explainCurrentScheme(scheme.title, scheme.sections?.about || scheme.answer || '');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto text-emerald-700">
            <Sparkles size={24} className="animate-spin" />
          </div>
          <p className="text-base font-bold text-neutral-700">योजना की जानकारी लोड हो रही है...</p>
        </div>
      </div>
    );
  }

  if (error || !scheme) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-6 rounded-3xl border border-neutral-200 text-center space-y-4 shadow-sm">
          <AlertTriangle size={36} className="text-amber-600 mx-auto" />
          <h2 className="text-xl font-bold text-neutral-900">योजना नहीं मिली</h2>
          <p className="text-sm text-neutral-600">{error || 'इस योजना का विवरण उपलब्ध नहीं है।'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-2xl bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-800 transition-colors"
          >
            ← मुख्य पृष्ठ पर लौटें
          </button>
        </div>
      </div>
    );
  }

  const sections = scheme?.sections || {
    about: scheme?.answer || '',
    eligibility: [],
    benefits: [],
    applicationSteps: [],
    documents: [],
    fees: 'निःशुल्क',
    whereToApply: { channel: 'सरकारी पोर्टल', details: '', portalUrl: '' },
    warnings: [],
    links: [],
  };

  return (
    <div className="min-h-screen bg-[#fbfdfa] text-neutral-900 pb-28">
      {/* Header & Breadcrumbs */}
      <div className="bg-white border-b border-emerald-100/80 sticky top-0 z-20 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <ArrowLeft size={15} />
            <span>वापस जाएं</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSpeakSummary}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all active:scale-95"
              title="सुनें"
            >
              <Volume2 size={15} className="text-emerald-700 animate-pulse" />
              <span>बोलकर समझाएं</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Title Hero Banner */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-emerald-950/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-extrabold uppercase tracking-wider text-emerald-100 border border-white/20">
                {scheme.category || 'सरकारी योजना'}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-200 text-[11px] font-bold border border-emerald-400/30">
                <ShieldCheck size={13} />
                <span>सत्यापित सरकारी सूचना</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              {scheme.title}
            </h1>

            <p className="text-xs sm:text-sm text-emerald-100/90 font-medium">
              स्रोत: {scheme.source}
            </p>
          </div>
        </div>

        {/* 1. योजना क्या है? (About) */}
        <section
          ref={sectionRefs.about}
          className={clsx(
            'p-5 sm:p-6 rounded-3xl bg-white border transition-all duration-300 shadow-xs',
            highlightSection === 'about'
              ? 'border-emerald-500 ring-4 ring-emerald-200/70 bg-emerald-50/40'
              : 'border-emerald-100/90 hover:border-emerald-200'
          )}
        >
          <div className="flex items-center gap-2.5 mb-3 text-emerald-800">
            <HelpCircle size={22} className="text-emerald-600" />
            <h2 className="text-lg sm:text-xl font-extrabold">1. योजना क्या है?</h2>
          </div>
          <p className="text-sm sm:text-base text-neutral-700 leading-relaxed font-normal">
            {sections.about}
          </p>
        </section>

        {/* 2. किसे मिलेगी? (Eligibility) */}
        <section
          ref={sectionRefs.eligibility}
          className={clsx(
            'p-5 sm:p-6 rounded-3xl bg-white border transition-all duration-300 shadow-xs',
            highlightSection === 'eligibility'
              ? 'border-emerald-500 ring-4 ring-emerald-200/70 bg-emerald-50/40'
              : 'border-emerald-100/90 hover:border-emerald-200'
          )}
        >
          <div className="flex items-center gap-2.5 mb-3.5 text-emerald-800">
            <CheckCircle2 size={22} className="text-emerald-600" />
            <h2 className="text-lg sm:text-xl font-extrabold">2. किसे मिलेगी? (पात्रता)</h2>
          </div>
          <ul className="space-y-2.5">
            {sections.eligibility.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm sm:text-base text-neutral-800">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. क्या लाभ मिलेगा? (Benefits) */}
        <section
          ref={sectionRefs.benefits}
          className={clsx(
            'p-5 sm:p-6 rounded-3xl bg-white border transition-all duration-300 shadow-xs',
            highlightSection === 'benefits'
              ? 'border-emerald-500 ring-4 ring-emerald-200/70 bg-emerald-50/40'
              : 'border-emerald-100/90 hover:border-emerald-200'
          )}
        >
          <div className="flex items-center gap-2.5 mb-3.5 text-emerald-800">
            <Award size={22} className="text-emerald-600" />
            <h2 className="text-lg sm:text-xl font-extrabold">3. क्या लाभ मिलेगा? (आर्थिक सहायता / लाभ)</h2>
          </div>
          <div className="space-y-2.5">
            {sections.benefits.map((benefit, i) => (
              <div
                key={i}
                className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-950 text-sm sm:text-base font-semibold flex items-start gap-2.5"
              >
                <span className="text-base">💰</span>
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 4. आवेदन कैसे करें? (Application Steps) */}
        <section
          ref={sectionRefs.applicationSteps}
          className={clsx(
            'p-5 sm:p-6 rounded-3xl bg-white border transition-all duration-300 shadow-xs',
            highlightSection === 'applicationSteps'
              ? 'border-emerald-500 ring-4 ring-emerald-200/70 bg-emerald-50/40'
              : 'border-emerald-100/90 hover:border-emerald-200'
          )}
        >
          <div className="flex items-center gap-2.5 mb-3.5 text-emerald-800">
            <ListOrdered size={22} className="text-emerald-600" />
            <h2 className="text-lg sm:text-xl font-extrabold">4. आवेदन कैसे करें? (आसान चरण)</h2>
          </div>
          <div className="space-y-3">
            {sections.applicationSteps.map((step, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-2xl bg-neutral-50/80 border border-neutral-200/80 text-sm sm:text-base text-neutral-800"
              >
                <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center flex-shrink-0 text-xs font-black">
                  {i + 1}
                </span>
                <span className="leading-snug">{step}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 5. कौन-कौन से दस्तावेज़ चाहिए? (Documents) */}
        <section
          ref={sectionRefs.documents}
          className={clsx(
            'p-5 sm:p-6 rounded-3xl bg-white border transition-all duration-300 shadow-xs',
            highlightSection === 'documents'
              ? 'border-emerald-500 ring-4 ring-emerald-200/70 bg-emerald-50/40'
              : 'border-emerald-100/90 hover:border-emerald-200'
          )}
        >
          <div className="flex items-center gap-2.5 mb-3.5 text-emerald-800">
            <FileText size={22} className="text-emerald-600" />
            <h2 className="text-lg sm:text-xl font-extrabold">5. कौन-कौन से दस्तावेज़ चाहिए?</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {sections.documents.map((doc, i) => (
              <div
                key={i}
                className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-emerald-950 text-xs sm:text-sm font-bold flex items-center gap-2"
              >
                <span className="text-emerald-600">📄</span>
                <span>{doc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 6. कितना खर्च लगेगा? (Fees) */}
        <section
          ref={sectionRefs.fees}
          className={clsx(
            'p-5 sm:p-6 rounded-3xl bg-white border transition-all duration-300 shadow-xs',
            highlightSection === 'fees'
              ? 'border-emerald-500 ring-4 ring-emerald-200/70 bg-emerald-50/40'
              : 'border-emerald-100/90 hover:border-emerald-200'
          )}
        >
          <div className="flex items-center gap-2.5 mb-2 text-emerald-800">
            <CreditCard size={22} className="text-emerald-600" />
            <h2 className="text-lg sm:text-xl font-extrabold">6. कितना खर्च लगेगा? (आवेदन शुल्क)</h2>
          </div>
          <p className="text-sm sm:text-base text-neutral-800 font-semibold bg-green-50/60 p-3 rounded-2xl border border-green-200">
            {sections.fees}
          </p>
        </section>

        {/* 7. कहाँ आवेदन करें? (Where to apply) */}
        <section
          ref={sectionRefs.whereToApply}
          className={clsx(
            'p-5 sm:p-6 rounded-3xl bg-white border transition-all duration-300 shadow-xs',
            highlightSection === 'whereToApply'
              ? 'border-emerald-500 ring-4 ring-emerald-200/70 bg-emerald-50/40'
              : 'border-emerald-100/90 hover:border-emerald-200'
          )}
        >
          <div className="flex items-center gap-2.5 mb-2.5 text-emerald-800">
            <MapPin size={22} className="text-emerald-600" />
            <h2 className="text-lg sm:text-xl font-extrabold">7. कहाँ आवेदन करें? (स्थान / पोर्टल)</h2>
          </div>
          <div className="space-y-2">
            <p className="text-sm sm:text-base text-neutral-800 font-bold">
              {sections.whereToApply.channel}
            </p>
            <p className="text-xs sm:text-sm text-neutral-600">
              {sections.whereToApply.details}
            </p>
          </div>
        </section>

        {/* 8. सावधान रहें ⚠️ (Warnings & Risks) */}
        <section
          ref={sectionRefs.warnings}
          className={clsx(
            'p-5 sm:p-6 rounded-3xl bg-rose-50/80 border transition-all duration-300 shadow-xs',
            highlightSection === 'warnings'
              ? 'border-rose-500 ring-4 ring-rose-200'
              : 'border-rose-200'
          )}
        >
          <div className="flex items-center gap-2.5 mb-3 text-rose-800">
            <AlertTriangle size={22} className="text-rose-600" />
            <h2 className="text-lg sm:text-xl font-extrabold">8. सावधान रहें ⚠️ (धोखाधड़ी से बचें)</h2>
          </div>
          <ul className="space-y-2">
            {sections.warnings.map((warn, i) => (
              <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-rose-900 font-semibold">
                <span className="text-rose-600 font-bold mt-0.5">•</span>
                <span>{warn}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 9. जरूरी लिंक (Links) */}
        <section
          ref={sectionRefs.links}
          className={clsx(
            'p-5 sm:p-6 rounded-3xl bg-white border transition-all duration-300 shadow-xs',
            highlightSection === 'links'
              ? 'border-emerald-500 ring-4 ring-emerald-200/70 bg-emerald-50/40'
              : 'border-emerald-100/90 hover:border-emerald-200'
          )}
        >
          <div className="flex items-center gap-2.5 mb-3 text-emerald-800">
            <ExternalLink size={22} className="text-emerald-600" />
            <h2 className="text-lg sm:text-xl font-extrabold">9. जरूरी आधिकारिक लिंक</h2>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {sections.links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs sm:text-sm transition-colors"
              >
                <span>{link.title}</span>
                <ExternalLink size={14} className="text-emerald-700" />
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
