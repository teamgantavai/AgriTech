// ============================================================
// AgentConfirmationModal — L2/L3 action confirmation UI
// User must explicitly confirm before consequential actions
// Branch: agent-control
// ============================================================

import { useState, useEffect } from 'react';
import type { ConfirmationRequest } from '../agent/agentStateMachine';
import { respondToConfirmation } from '../agent/agentBridge';

interface Props {
  confirmation: ConfirmationRequest | null;
  langCode?: string;
  onResponse: (response: 'confirmed' | 'denied') => void;
}

const ACTION_ICONS: Record<string, string> = {
  submit_form: '📋',
  fill_field: '✏️',
  open_external_service: '🔗',
  click_action: '👆',
  select_option: '☑️',
  default: '⚠️',
};

export function AgentConfirmationModal({ confirmation, langCode = 'hi', onResponse }: Props) {
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!confirmation) {
      setCountdown(null);
      return;
    }
    const remaining = Math.max(0, Math.floor((confirmation.expiresAt - Date.now()) / 1000));
    setCountdown(remaining);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c === null || c <= 1) {
          clearInterval(interval);
          onResponse('denied');
          return null;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [confirmation, onResponse]);

  if (!confirmation) return null;

  const icon = ACTION_ICONS[confirmation.actionType] || ACTION_ICONS.default;
  const isHindi = langCode === 'hi' || langCode === 'pa';
  const message = isHindi && confirmation.messageHi ? confirmation.messageHi : confirmation.message;

  const handleConfirm = async () => {
    await respondToConfirmation(confirmation.confirmationId, 'confirmed');
    onResponse('confirmed');
  };

  const handleDeny = async () => {
    await respondToConfirmation(confirmation.confirmationId, 'denied');
    onResponse('denied');
  };

  const isConsequential = confirmation.actionType === 'submit_form' || confirmation.actionType === 'click_action';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md mx-4 mb-6 sm:mb-0 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className={`px-5 py-4 flex items-start gap-3 ${isConsequential ? 'bg-amber-50 border-b border-amber-200' : 'bg-blue-50 border-b border-blue-200'}`}>
          <span className="text-2xl mt-0.5">{icon}</span>
          <div>
            <h2
              id="confirm-modal-title"
              className={`font-bold text-base ${isConsequential ? 'text-amber-900' : 'text-blue-900'}`}
            >
              {isHindi ? 'पुष्टि करें' : 'Confirm Action'}
            </h2>
            <p className={`text-xs mt-0.5 ${isConsequential ? 'text-amber-700' : 'text-blue-700'}`}>
              {isConsequential
                ? (isHindi ? '⚠️ यह एक महत्वपूर्ण कार्य है।' : '⚠️ This is a consequential action.')
                : (isHindi ? 'ग्राम साथी अनुमति माँग रहा है।' : 'Gram Sathi is requesting permission.')}
            </p>
          </div>
          {countdown !== null && (
            <span className="ml-auto text-xs text-slate-400 tabular-nums">{countdown}s</span>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-slate-800 text-sm leading-relaxed">{message}</p>

          {/* Review data — show what will be submitted */}
          {confirmation.reviewData && Object.keys(confirmation.reviewData).length > 0 && (
            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  {isHindi ? 'जानकारी की समीक्षा करें' : 'Review Information'}
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {Object.entries(confirmation.reviewData).map(([key, value]) => (
                  <div key={key} className="px-4 py-2.5 flex justify-between items-center">
                    <span className="text-xs text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-medium text-slate-800 text-right max-w-[60%] truncate">
                      {value || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button
            id="confirm-deny-btn"
            onClick={handleDeny}
            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all cursor-pointer active:scale-95"
          >
            {isHindi ? 'रद्द करें' : 'Cancel'}
          </button>
          <button
            id="confirm-proceed-btn"
            onClick={handleConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all cursor-pointer active:scale-95 ${
              isConsequential
                ? 'bg-amber-600 hover:bg-amber-700 border-2 border-amber-600'
                : 'bg-green-600 hover:bg-green-700 border-2 border-green-600'
            }`}
          >
            {isHindi ? 'हाँ, आगे बढ़ें' : 'Yes, Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
}
