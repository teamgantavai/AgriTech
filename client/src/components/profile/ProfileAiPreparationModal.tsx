// ================================================================
// ProfileAiPreparationModal.tsx — Preparation Screen before AI Interview
// Satisfies Section 1 & 29: AI MUST NOT start until explicitly clicked
// ================================================================

import React from 'react';
import { Mic, FileText, X, Check, Shield } from 'lucide-react';

interface ProfileAiPreparationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartVoice: () => void;
  onUploadDocuments: () => void;
}

export function ProfileAiPreparationModal({
  isOpen,
  onClose,
  onStartVoice,
  onUploadDocuments,
}: ProfileAiPreparationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prep-modal-title"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 bg-gradient-to-b from-emerald-50/70 to-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
              <Mic className="w-6 h-6" />
            </div>
            <div>
              <h3 id="prep-modal-title" className="text-lg font-bold text-slate-900 leading-tight">
                Gram Sathi AI
              </h3>
              <p className="text-xs text-emerald-700 font-medium mt-0.5">
                Guided Citizen Profile Assistant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-4 space-y-4">
          <div className="text-center">
            <h4 className="text-base font-extrabold text-slate-800">
              Let's create your profile
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Speak in any language you prefer — Gram Sathi will automatically detect your language and guide you step by step.
            </p>
          </div>

          {/* Citizen Guarantees */}
          <div className="bg-emerald-50/60 rounded-2xl p-3.5 border border-emerald-100/80 space-y-2">
            <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] flex-shrink-0">
                <Check className="w-3 h-3" />
              </span>
              <span>Automatic language detection (Hindi, English, Punjabi & more)</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] flex-shrink-0">
                <Check className="w-3 h-3" />
              </span>
              <span>You stay in control and confirm details before saving</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] flex-shrink-0">
                <Check className="w-3 h-3" />
              </span>
              <span>You can skip any question whenever you wish</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-2 space-y-2.5">
          <button
            onClick={() => {
              onClose();
              onStartVoice();
            }}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>Start with Voice</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onUploadDocuments();
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold text-xs rounded-2xl transition-all border border-slate-200/80 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            <span>Upload Documents</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-center text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
