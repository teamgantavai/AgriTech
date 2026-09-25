// ================================================================
// VoiceFieldConfirmationModal.tsx — Realtime Voice Confirmation UI
// Clean citizen-facing confirmation card with zero technical jargon
// Satisfies Section 5, 6, 7, 24, 25 of Citizen Profile UX
// ================================================================

import React from 'react';
import { useAssistant } from '../../context/AssistantContext';
import { Check, Edit3, FastForward } from 'lucide-react';
import {
  getFriendlyFieldLabel,
  formatFieldValueForCitizen,
} from '../../services/profileInterviewController';

export function VoiceFieldConfirmationModal() {
  const {
    activeDetectedField,
    confirmDetectedField,
    rejectDetectedField,
    skipDetectedField,
    isListening,
  } = useAssistant();

  if (!activeDetectedField || activeDetectedField.status !== 'CONFIRMING') {
    return null;
  }

  const { fieldName, value, confirmationPrompt } = activeDetectedField;

  const friendlyField = getFriendlyFieldLabel(fieldName, 'en');
  const friendlyHindi = getFriendlyFieldLabel(fieldName, 'hi');
  const formattedValue = formatFieldValueForCitizen(fieldName, value);

  // Natural spoken prompt
  const displayPrompt =
    confirmationPrompt && !confirmationPrompt.includes('_')
      ? confirmationPrompt
      : `You said your ${friendlyField.toLowerCase()} is ${formattedValue}. Is that correct?`;

  return (
    <aside
      aria-label="Voice confirmation dialog"
      className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border-2 border-emerald-500/40 p-5 animate-in fade-in slide-in-from-bottom-5 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
            🎙️
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 tracking-tight">
              Gram Sathi
            </h4>
            <p className="text-[11px] text-emerald-700 font-semibold">
              Please confirm
            </p>
          </div>
        </div>
      </div>

      {/* Field Title & Formatted Value */}
      <div className="my-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-center">
        <div className="text-xs font-semibold text-slate-500 mb-1">
          {friendlyField} <span className="text-[11px] text-slate-400">({friendlyHindi})</span>
        </div>
        <div className="text-xl font-extrabold text-slate-900 tracking-tight break-words">
          {formattedValue}
        </div>
      </div>

      {/* Spoken Question Prompt */}
      <p className="text-xs text-slate-600 text-center font-medium mb-4 px-2 italic">
        "{displayPrompt}"
      </p>

      {/* Interactive Action Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => confirmDetectedField(fieldName, value)}
          className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Yes, correct</span>
        </button>

        <button
          onClick={() => rejectDetectedField(fieldName)}
          className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs border border-slate-200 transition-all cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5 text-slate-500" />
          <span>Change</span>
        </button>

        <button
          onClick={() => skipDetectedField(fieldName)}
          className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 font-semibold text-xs border border-slate-200 transition-all cursor-pointer"
        >
          <FastForward className="w-3.5 h-3.5 text-slate-400" />
          <span>Skip</span>
        </button>
      </div>

      {/* Spoken Voice Hint */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isListening ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
            }`}
          />
          <span>
            Say <strong className="text-slate-700">"Haan"</strong> or <strong className="text-slate-700">"Nahi"</strong>
          </span>
        </span>
        <span className="text-[10px] text-slate-400">Touch or voice</span>
      </div>
    </aside>
  );
}
