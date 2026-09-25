// ================================================================
// CopilotAssistantPanel — Floating AI Form Copilot Panel
// Handles Pre-Fill Review, Live Action Checklist, Question Explanations,
// Security Stop Handoffs, and Explicit Final Submission Confirmation
// ================================================================

import { useState } from 'react';
import { FormSessionState } from '../../services/formCopilot/types';
import type { FormSessionSnapshot } from '../../services/formCopilot/formSessionManager';

interface Props {
  session: FormSessionSnapshot;
  onStartFilling: () => void;
  onPause: () => void;
  onStop: () => void;
  onResolveUserAction: (val?: any) => void;
  onSubmitApplication: () => void;
}

export function CopilotAssistantPanel({
  session,
  onStartFilling,
  onPause,
  onStop,
  onResolveUserAction,
  onSubmitApplication,
}: Props) {
  const {
    state,
    portal,
    schema,
    mappedFields,
    currentlyFillingFieldId,
    progressItems,
    userActionRequired,
    submissionReceipt,
    isPaused,
    completedFieldsCount,
    totalFieldsCount,
  } = session;

  const [showFinalConfirmModal, setShowFinalConfirmModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'copilot' | 'review' | 'audit'>('copilot');

  // Categorize mapped fields for Pre-Fill Review (Rule 11)
  const profileFields = mappedFields.filter((f) => f.source === 'profile');
  const documentFields = mappedFields.filter((f) => f.source === 'document');
  const needsInputFields = mappedFields.filter((f) => f.status === 'missing' || f.status === 'needs_confirmation');

  return (
    <aside aria-label="Government Form Copilot" className="w-full md:w-[420px] lg:w-[460px] h-full bg-white flex flex-col border-l border-slate-200 shadow-xl flex-shrink-0 z-20">
      {/* ── Top Header / Boundary Indicator (Rule 4) ── */}
      <div className="p-4 bg-slate-900 text-white flex-shrink-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎙️</span>
            <div>
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Gram Sathi • Form Copilot
              </div>
              <div className="text-sm font-extrabold truncate">
                {portal?.name || 'Government Application'}
              </div>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
            Live
          </span>
        </div>

        {/* Boundary subtitle */}
        <div className="text-[11px] text-slate-300 flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg">
          <span>🌐</span>
          <span className="truncate">
            Official government website: <span className="text-white font-mono">{portal?.domains[0] || 'gov.in'}</span>
          </span>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center border-b border-slate-200 bg-slate-50 px-3 pt-2 text-xs font-bold gap-1 flex-shrink-0">
        <button
          onClick={() => setActiveTab('copilot')}
          className={`px-3 py-2 border-b-2 transition-all ${
            activeTab === 'copilot'
              ? 'border-emerald-600 text-emerald-800 bg-white rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Copilot Assistant
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`px-3 py-2 border-b-2 transition-all ${
            activeTab === 'review'
              ? 'border-emerald-600 text-emerald-800 bg-white rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Information Review ({mappedFields.length})
        </button>
      </div>

      {/* ── Main Panel Content ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ============================================================== */}
        {/* 1. PRE-FILL REVIEW SCREEN (Rule 1 & Rule 11)                    */}
        {/* ============================================================== */}
        {state === FormSessionState.WAITING_FOR_REVIEW && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5 mb-1">
                <span>✓</span>
                <span>Application Ready for Automated Filling</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Gram Sathi inspected the official portal and matched verified information from your profile and documents.
              </p>
            </div>

            {/* Counts Summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-lg font-extrabold text-slate-900">{profileFields.length}</div>
                <div className="text-[10px] text-slate-500 font-semibold leading-tight mt-0.5">From Profile</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-lg font-extrabold text-slate-900">{documentFields.length}</div>
                <div className="text-[10px] text-slate-500 font-semibold leading-tight mt-0.5">From Documents</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-lg font-extrabold text-amber-900">{needsInputFields.length}</div>
                <div className="text-[10px] text-amber-700 font-semibold leading-tight mt-0.5">Need Input</div>
              </div>
            </div>

            {/* Category breakdown snippet */}
            <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2.5">
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Information Checklist</span>
                <span className="text-[11px] text-slate-400">Step 1 of 4</span>
              </div>

              <div className="space-y-2 text-xs">
                {mappedFields.slice(0, 5).map((f) => (
                  <div key={f.fieldId} className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1.5">
                    <div>
                      <div className="font-semibold text-slate-800">{f.fieldLabel}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                        {f.displayValue}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {f.sourceLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={onStartFilling}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>⚡</span>
                <span>Start Filling Automatically</span>
              </button>
              <button
                onClick={() => setActiveTab('review')}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
              >
                Review All {mappedFields.length} Fields First
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. LIVE FILLING CHECKLIST (Rule 12 & Rule 13 & Rule 45)         */}
        {/* ============================================================== */}
        {(state === FormSessionState.FILLING ||
          state === FormSessionState.PAUSED ||
          state === FormSessionState.STOPPED ||
          state === FormSessionState.WAITING_FOR_USER) && (
          <div className="space-y-4 animate-fade-in">
            {/* Status Header */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {state === FormSessionState.FILLING
                    ? 'Filling Application Form...'
                    : state === FormSessionState.PAUSED
                    ? 'Automation Paused'
                    : state === FormSessionState.WAITING_FOR_USER
                    ? 'Waiting for Your Action'
                    : 'Automation Stopped'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {completedFieldsCount} of {totalFieldsCount} mandatory fields completed
                </div>
              </div>

              {/* Pause / Resume / Stop Controls (Rule 28) */}
              <div className="flex items-center gap-1.5">
                {state === FormSessionState.FILLING ? (
                  <button
                    onClick={onPause}
                    className="px-2.5 py-1 text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-all"
                  >
                    Pause
                  </button>
                ) : state === FormSessionState.PAUSED ? (
                  <button
                    onClick={onStartFilling}
                    className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all"
                  >
                    Resume
                  </button>
                ) : null}

                <button
                  onClick={onStop}
                  className="px-2.5 py-1 text-xs font-bold bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-all"
                >
                  Stop
                </button>
              </div>
            </div>

            {/* Checklist items */}
            <div className="space-y-1.5">
              {progressItems.map((item) => {
                const isFilling = currentlyFillingFieldId === item.fieldId;
                const isDone = item.status === 'completed';

                return (
                  <div
                    key={item.fieldId}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                      isFilling
                        ? 'border-blue-400 bg-blue-50 text-blue-950 shadow-xs font-bold ring-2 ring-blue-200'
                        : isDone
                        ? 'border-slate-200 bg-slate-50 text-slate-800'
                        : 'border-slate-100 bg-white text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-sm">
                        {isFilling ? '→' : isDone ? '✓' : '○'}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                      {isDone && (
                        <span className="font-semibold text-slate-700 truncate max-w-[120px]">
                          {item.displayValue}
                        </span>
                      )}
                      {isFilling && (
                        <span className="text-[10px] text-blue-700 font-bold animate-pulse">
                          Typing...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. USER ACTION INTERVENTION (OTP, CAPTCHA, Question Explanation) */}
        {/* ============================================================== */}
        {userActionRequired && (
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-md space-y-3 animate-slide-up">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
              <span className="text-lg">🔐</span>
              <span>{userActionRequired.title}</span>
            </div>

            <p className="text-xs text-amber-800 leading-relaxed">
              {userActionRequired.description}
            </p>

            {/* Options choice (Confusing Question or Document Confirmation) */}
            {userActionRequired.options && userActionRequired.options.length > 0 ? (
              <div className="flex items-center gap-2 pt-1">
                {userActionRequired.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => onResolveUserAction(opt.value)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold shadow-2xs transition-all ${
                      opt.isPrimary
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <button
                onClick={() => onResolveUserAction()}
                className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all"
              >
                {userActionRequired.suggestedAction || "I've completed this step on website"}
              </button>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. READY FOR FINAL SUBMISSION (Rule 25 & Rule 46)               */}
        {/* ============================================================== */}
        {state === FormSessionState.READY_TO_SUBMIT && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="text-sm font-extrabold text-emerald-950 flex items-center gap-1.5">
                <span>🎉</span>
                <span>Application Form Completely Filled</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                All {totalFieldsCount} required fields have been filled and verified documents attached. No validation errors found.
              </p>
            </div>

            {/* Summary Highlights */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-700">
                <span>Required fields filled:</span>
                <span className="font-bold text-emerald-800">✓ {completedFieldsCount} / {totalFieldsCount}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Official certificates attached:</span>
                <span className="font-bold text-emerald-800">✓ {documentFields.length}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Security validation:</span>
                <span className="font-bold text-emerald-800">✓ Complete</span>
              </div>
            </div>

            {/* Explicit Submission Confirmation Trigger */}
            <div className="pt-2 space-y-2">
              <button
                onClick={() => setShowFinalConfirmModal(true)}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🚀</span>
                <span>Submit Application to Official Portal</span>
              </button>
              <button
                onClick={() => setActiveTab('review')}
                className="w-full py-2 px-3 text-xs text-slate-600 hover:text-slate-900 font-semibold text-center"
              >
                Review all fields again
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 5. POST-SUBMISSION RECEIPT (Rule 26)                            */}
        {/* ============================================================== */}
        {state === FormSessionState.COMPLETED && submissionReceipt && (
          <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 space-y-4 animate-scale-up">
            <div className="flex items-center gap-2 text-emerald-950 font-extrabold text-sm">
              <span className="text-2xl">✓</span>
              <span>Application Successfully Submitted</span>
            </div>

            <div className="bg-white rounded-xl p-3.5 border border-emerald-200 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-medium">Application Reference No:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{submissionReceipt.applicationNumber}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-medium">Submission Date:</span>
                <span className="font-semibold text-slate-800">{submissionReceipt.submissionDate}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-medium">Applicant:</span>
                <span className="font-semibold text-slate-800">{submissionReceipt.applicantName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Portal:</span>
                <span className="font-semibold text-emerald-800">{submissionReceipt.portalName}</span>
              </div>
            </div>

            <a
              href={submissionReceipt.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold text-center block shadow-sm"
            >
              View Application on Official Portal ↗
            </a>
          </div>
        )}

        {/* ============================================================== */}
        {/* 6. INFORMATION REVIEW TAB                                       */}
        {/* ============================================================== */}
        {activeTab === 'review' && (
          <div className="space-y-3 animate-fade-in">
            <div className="text-xs font-bold text-slate-900">
              All Form Fields & Data Sources
            </div>
            <div className="space-y-2">
              {mappedFields.map((f) => (
                <div key={f.fieldId} className="p-3 rounded-xl border border-slate-200 bg-white space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{f.fieldLabel}</span>
                    <span className="text-[10px] font-semibold text-slate-500 px-1.5 py-0.2 rounded bg-slate-100">
                      Step {f.stepNumber}
                    </span>
                  </div>
                  <div className="text-slate-700 font-medium">{f.displayValue}</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold pt-1">
                    <span>✓</span>
                    <span>{f.sourceLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── EXPLICIT SUBMISSION CONFIRMATION MODAL (Rule 25) ── */}
      {showFinalConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600 font-bold text-sm">
              <span className="text-2xl">⚠️</span>
              <span>Final Government Submission</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will officially transmit your application to the{' '}
              <strong className="text-slate-900">{portal?.name}</strong> portal. Are you sure all information is accurate and you wish to submit?
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowFinalConfirmModal(false)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
              >
                Go Back & Review
              </button>
              <button
                onClick={() => {
                  setShowFinalConfirmModal(false);
                  onSubmitApplication();
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
              >
                Yes, Submit Application
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
