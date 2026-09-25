// ================================================================
// DocumentAiExtractionModal.tsx — AI Document Reading & Mapping
// Displays extracted fields with approval and conflict resolution
// Satisfies Section 10, 11, 12 of Citizen Profile UX
// ================================================================

import React, { useState } from 'react';
import { Sparkles, Check, X, AlertCircle, ArrowRight } from 'lucide-react';
import type { DocumentAiExtraction, DocumentConflict, CitizenProfile } from '../../types/profile';
import {
  getFriendlyFieldLabel,
  formatFieldValueForCitizen,
} from '../../services/profileInterviewController';

interface DocumentAiExtractionModalProps {
  extraction: DocumentAiExtraction | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyDetails: (fieldsToApply: Record<string, any>) => Promise<void>;
}

export function DocumentAiExtractionModal({
  extraction,
  isOpen,
  onClose,
  onApplyDetails,
}: DocumentAiExtractionModalProps) {
  const [selectedResolutions, setSelectedResolutions] = useState<Record<string, 'profile' | 'document'>>({});
  const [isApplying, setIsApplying] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  if (!isOpen || !extraction) return null;

  const { documentTitle, extractedFields, conflicts } = extraction;

  const handleResolutionChoice = (fieldName: string, choice: 'profile' | 'document') => {
    setSelectedResolutions((prev) => ({ ...prev, [fieldName]: choice }));
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const finalFields: Record<string, any> = {};

      for (const [key, docVal] of Object.entries(extractedFields)) {
        // If there was a conflict, only use if citizen chose 'document'
        const hasConflict = conflicts.some((c) => c.fieldName === key);
        if (hasConflict) {
          const choice = selectedResolutions[key] || 'document';
          if (choice === 'document') {
            finalFields[key] = docVal;
          }
        } else {
          finalFields[key] = docVal;
        }
      }

      await onApplyDetails(finalFields);
      onClose();
    } catch (err) {
      console.error('Failed to apply document data:', err);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-start justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-lg">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">
                Read with Gram Sathi AI
              </h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                From your {documentTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div>
            <h4 className="text-sm font-bold text-slate-800">
              I found these details in your {documentTitle}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Would you like me to use them in your Gram Sathi profile?
            </p>
          </div>

          {/* Extracted Fields List */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/90 divide-y divide-slate-100 overflow-hidden">
            {Object.entries(extractedFields).map(([key, val]) => {
              const label = getFriendlyFieldLabel(key, 'en');
              const formattedVal = formatFieldValueForCitizen(key, val);
              const hasConflict = conflicts.some((c) => c.fieldName === key);

              return (
                <div key={key} className="p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-600 block">{label}</span>
                    <span className="text-[11px] text-slate-400">From your {documentTitle}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 text-sm block">
                      {formattedVal}
                    </span>
                    {hasConflict && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 mt-0.5">
                        <AlertCircle className="w-3 h-3" /> Conflict detected
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section 12: Conflict Resolution UI */}
          {conflicts.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>We found different information in your document</span>
              </div>

              {conflicts.map((conf) => {
                const choice = selectedResolutions[conf.fieldName] || 'document';
                const pVal = formatFieldValueForCitizen(conf.fieldName, conf.profileValue);
                const dVal = formatFieldValueForCitizen(conf.fieldName, conf.documentValue);

                return (
                  <div
                    key={conf.fieldName}
                    className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2.5 text-xs"
                  >
                    <div className="font-bold text-slate-800">
                      {conf.fieldLabel}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Current Profile Option */}
                      <button
                        type="button"
                        onClick={() => handleResolutionChoice(conf.fieldName, 'profile')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          choice === 'profile'
                            ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'bg-white/80 border-slate-200 hover:bg-white text-slate-600'
                        }`}
                      >
                        <span className="text-[10px] text-slate-400 block font-semibold">Your Profile</span>
                        <span className="font-bold text-slate-900 block truncate">{pVal}</span>
                        <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                          {choice === 'profile' ? '✓ Selected' : 'Keep existing'}
                        </span>
                      </button>

                      {/* Document Value Option */}
                      <button
                        type="button"
                        onClick={() => handleResolutionChoice(conf.fieldName, 'document')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          choice === 'document'
                            ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'bg-white/80 border-slate-200 hover:bg-white text-slate-600'
                        }`}
                      >
                        <span className="text-[10px] text-slate-400 block font-semibold">Document</span>
                        <span className="font-bold text-slate-900 block truncate">{dVal}</span>
                        <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                          {choice === 'document' ? '✓ Selected' : 'Use document'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2.5 flex-shrink-0">
          <button
            onClick={handleApply}
            disabled={isApplying}
            className="w-full sm:flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isApplying ? 'Saving...' : 'Use these details'}</span>
          </button>

          <button
            onClick={onClose}
            className="w-full sm:w-auto py-3 px-4 bg-white hover:bg-slate-100 text-slate-600 font-semibold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            Don't use
          </button>
        </div>
      </div>
    </div>
  );
}
