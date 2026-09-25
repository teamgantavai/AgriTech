// ================================================================
// OfficialPortalBrowserView — Live Government Website Simulation
// Renders the authentic portal UI with visible field-by-field filling,
// active field highlights, manual takeover, and live security challenges
// ================================================================

import { useEffect, useRef, useState } from 'react';
import type { FormSessionSnapshot } from '../../services/formCopilot/formSessionManager';
import type { FormFieldDefinition } from '../../services/formCopilot/types';

interface Props {
  session: FormSessionSnapshot;
  onManualFieldChange: (fieldId: string, value: any) => void;
  onResolveUserAction: (val?: any) => void;
}

export function OfficialPortalBrowserView({ session, onManualFieldChange, onResolveUserAction }: Props) {
  const { schema, portal, currentStep, filledValues, currentlyFillingFieldId, userActionRequired } = session;
  const [captchaInput, setCaptchaInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [manualInputVal, setManualInputVal] = useState('');

  // Auto-scroll to currently filling field (Rule 14: Smart Scrolling)
  useEffect(() => {
    if (currentlyFillingFieldId) {
      const el = document.getElementById(`field-${currentlyFillingFieldId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentlyFillingFieldId]);

  if (!schema || !portal) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 bg-slate-100">
        <div className="text-4xl mb-3">🏛️</div>
        <p className="font-semibold text-sm">No government portal open.</p>
        <p className="text-xs text-slate-400 mt-1">Select a supported portal from Gram Sathi to start.</p>
      </div>
    );
  }

  const currentStepFields = schema.fields.filter((f) => f.stepNumber === currentStep);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100/90 overflow-hidden border-r border-slate-200">
      {/* ── Browser Window Address Bar ── */}
      <div className="bg-slate-200/90 px-3 py-2 border-b border-slate-300/80 flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
        </div>

        {/* Secure URL Badge */}
        <div className="flex-1 max-w-xl mx-auto flex items-center gap-2 bg-white px-3 py-1 rounded-lg text-xs font-mono border border-slate-300 shadow-2xs">
          <span className="text-emerald-700 font-bold flex items-center gap-1">
            <span>🔒</span>
            <span>https://</span>
          </span>
          <span className="text-slate-800 font-medium truncate">
            {portal.domains[0]}/fresh-application/2026-27
          </span>
          <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded font-sans">
            GOV.IN
          </span>
        </div>

        <div className="text-xs text-slate-500 hidden sm:block">
          Official Server
        </div>
      </div>

      {/* ── Government Portal Header Emblem ── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🇮🇳</div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Government of India • Ministry of Electronics & IT
            </div>
            <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
              {portal.name}
            </div>
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end text-xs text-slate-500">
          <span className="font-semibold text-slate-800">Academic Year 2026–2027</span>
          <span className="text-emerald-700 font-medium">✓ Secure Official Portal</span>
        </div>
      </div>

      {/* ── Multi-Step Form Stepper (Rule 15) ── */}
      <div className="bg-slate-50 px-4 sm:px-6 py-2.5 border-b border-slate-200 flex-shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 sm:gap-4 min-w-max">
          {schema.stepTitles.map((title, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;

            return (
              <div key={idx} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isCompleted ? '✓' : stepNum}
                </div>
                <span
                  className={`text-xs font-semibold ${
                    isCurrent ? 'text-blue-900 font-bold' : isCompleted ? 'text-emerald-800' : 'text-slate-400'
                  }`}
                >
                  {title}
                </span>
                {idx < schema.stepTitles.length - 1 && <span className="text-slate-300 text-xs">→</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main Form Page Body ── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6 max-w-4xl mx-auto">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {schema.stepTitles[currentStep - 1] || 'Application Form'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fields marked with an asterisk (<span className="text-red-500">*</span>) are mandatory.
            </p>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {currentStepFields.map((field) => {
              const val = filledValues[field.id] ?? '';
              const isCurrentlyFilling = currentlyFillingFieldId === field.id;
              const isFilled = val !== '' && val !== null && val !== undefined;

              return (
                <div
                  key={field.id}
                  id={`field-${field.id}`}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isCurrentlyFilling
                      ? 'border-blue-500 bg-blue-50/50 shadow-md ring-2 ring-blue-200'
                      : isFilled
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>{field.label}</span>
                      {field.required && <span className="text-red-500">*</span>}
                    </label>

                    {/* Filling Status Indicator */}
                    {isCurrentlyFilling && (
                      <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        <span>Filling...</span>
                      </span>
                    )}
                    {!isCurrentlyFilling && isFilled && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>✓</span>
                        <span>Filled</span>
                      </span>
                    )}
                  </div>

                  {/* Field Explanation Note if present (Rule 18 & 19) */}
                  {field.explanation && (
                    <div className="mb-2 p-2 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 leading-snug">
                      <span className="font-bold mr-1">ℹ️ What this means:</span>
                      <span>{field.explanation.en}</span>
                    </div>
                  )}

                  {/* Render based on field type */}
                  {field.type === 'select' ? (
                    <select
                      value={val}
                      onChange={(e) => onManualFieldChange(field.id, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">-- Select Option --</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'radio' ? (
                    <div className="flex items-center gap-4 mt-1">
                      {field.options?.map((opt) => (
                        <label key={opt.value} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name={field.name}
                            value={opt.value}
                            checked={val === opt.value}
                            onChange={(e) => onManualFieldChange(field.id, e.target.value)}
                            className="text-blue-600 focus:ring-blue-400"
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : field.type === 'file' ? (
                    <div className="p-3 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📄</span>
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            {isFilled ? '✓ Document Uploaded' : 'Attach Document (PDF/JPG)'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {isFilled ? String(val) : 'Max 2 MB'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onManualFieldChange(field.id, 'manual_doc_uploaded.pdf')}
                        className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg shadow-2xs"
                      >
                        {isFilled ? 'Replace' : 'Upload'}
                      </button>
                    </div>
                  ) : field.type === 'captcha' ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="px-4 py-2 bg-slate-900 text-emerald-400 font-mono font-bold tracking-widest text-base rounded-lg select-none border border-slate-700 line-through">
                          7K9WX4
                        </div>
                        <button
                          type="button"
                          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                        >
                          🔄 Refresh
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={captchaInput}
                          onChange={(e) => setCaptchaInput(e.target.value)}
                          placeholder="Enter letters shown in image"
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-blue-400"
                        />
                        {userActionRequired?.type === 'CAPTCHA' && (
                          <button
                            type="button"
                            onClick={() => onResolveUserAction(captchaInput || '7K9WX4')}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                          >
                            Verify
                          </button>
                        )}
                      </div>
                    </div>
                  ) : field.type === 'otp' ? (
                    <div className="space-y-2">
                      <div className="text-[11px] text-slate-600 font-medium">
                        OTP sent to Aadhaar-linked mobile ending in ******3210
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          placeholder="Enter 6-digit OTP"
                          maxLength={6}
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold tracking-widest focus:ring-2 focus:ring-blue-400"
                        />
                        {userActionRequired?.type === 'OTP' && (
                          <button
                            type="button"
                            onClick={() => onResolveUserAction(otpInput || '482910')}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                          >
                            Submit OTP
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <input
                      type={field.type}
                      value={val}
                      onChange={(e) => onManualFieldChange(field.id, e.target.value)}
                      placeholder={field.placeholder || ''}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* User Takeover Notice (Rule 29: User Manual Control) */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>✍️</span>
              <span>You can type or edit any field directly on this government form anytime. Gram Sathi will respect your changes.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
