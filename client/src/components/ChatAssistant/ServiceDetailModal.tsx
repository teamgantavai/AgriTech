// ================================================================
// ServiceDetailModal.tsx — Simple, readable government service detail
// "What You Get" language without bureaucratic clutter
// ================================================================

import React from 'react';
import type { GovernmentServiceItem } from '../../data/popularServices';

interface ServiceDetailModalProps {
  service: GovernmentServiceItem | null;
  onClose: () => void;
  onAskChat: (query: string) => void;
}

export function ServiceDetailModal({ service, onClose, onAskChat }: ServiceDetailModalProps) {
  if (!service) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 mb-1.5">
              {service.category}
            </span>
            <h2 className="text-xl font-bold text-slate-900 leading-snug">
              {service.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Source: {service.source}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 text-sm">
          {/* What is it? */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              What is it?
            </h3>
            <p className="text-slate-800 leading-relaxed font-medium">
              {service.whatIsIt}
            </p>
          </div>

          {/* Who can get this? */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Who can get this?
            </h3>
            <ul className="space-y-1.5 pl-4 list-disc text-slate-700">
              {service.whoCanGet.map((item, i) => (
                <li key={i} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </div>

          {/* What do you get? */}
          <div className="p-4 rounded-2xl bg-green-50/70 border border-green-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-green-800 mb-2">
              What do you get?
            </h3>
            <ul className="space-y-1.5 text-green-950 font-medium">
              {service.whatYouGet.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What papers do I need? */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              What papers do I need?
            </h3>
            <ul className="space-y-1.5 pl-4 list-disc text-slate-700">
              {service.whatPapers.map((doc, i) => (
                <li key={i} className="leading-relaxed">{doc}</li>
              ))}
            </ul>
          </div>

          {/* How do I apply? */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              How do I apply?
            </h3>
            <ol className="space-y-2 text-slate-700">
              {service.howToApply.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center gap-2.5 justify-between">
          {service.officialUrl && (
            <a
              href={service.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              <span>Visit Official Website</span>
              <span>→</span>
            </a>
          )}
          <button
            onClick={() => {
              onClose();
              onAskChat(`I want to know more about ${service.title}. How can I apply and what are the exact steps?`);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <span>💬 Ask Gram Sathi about this</span>
          </button>
        </div>
      </div>
    </div>
  );
}
