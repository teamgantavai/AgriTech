// ============================================================
// ExternalWebsiteBoundary — "Leaving Gram Sathi" warning modal
// Branch: agent-control
// ============================================================

interface Props {
  url: string;
  siteName: string;
  langCode?: string;
  onProceed: () => void;
  onCancel: () => void;
}

export function ExternalWebsiteBoundary({ url, siteName, langCode = 'hi', onProceed, onCancel }: Props) {
  const isHindi = langCode === 'hi' || langCode === 'pa';

  let hostname = '';
  let isSecure = false;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname;
    isSecure = parsed.protocol === 'https:';
  } catch {
    hostname = url;
  }

  const isGovDomain = hostname.endsWith('.gov.in') || hostname.endsWith('.nic.in');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
          <span className="text-2xl">🔗</span>
          <div>
            <h2 className="font-bold text-blue-900 text-sm">
              {isHindi ? 'ग्राम साथी से बाहर जा रहे हैं' : 'Leaving Gram Sathi'}
            </h2>
            <p className="text-blue-700 text-xs mt-0.5">
              {isHindi
                ? 'आप एक सरकारी वेबसाइट खोलने वाले हैं'
                : 'You are about to open an official government website'}
            </p>
          </div>
        </div>

        {/* Website info */}
        <div className="px-5 py-4">
          {/* Site name + URL */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-4">
            <div className="flex items-center gap-2 mb-1">
              {isGovDomain ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                  🏛️ {isHindi ? 'सरकारी वेबसाइट' : 'Official Gov Website'}
                </span>
              ) : (
                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                  🌐 {isHindi ? 'बाहरी वेबसाइट' : 'External Website'}
                </span>
              )}
              {isSecure && (
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  🔒 HTTPS
                </span>
              )}
            </div>
            <div className="font-semibold text-slate-800 text-sm">{siteName}</div>
            <div className="text-xs text-slate-500 mt-0.5 truncate">{hostname}</div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {isHindi
              ? 'ग्राम साथी इस वेबसाइट को नियंत्रित नहीं कर सकता। आपको खुद इस पर काम करना होगा। हम आपको बाहरी वेबसाइट पर गाइड कर सकते हैं।'
              : 'Gram Sathi cannot control this website. You will need to interact with it yourself. We can guide you step by step.'}
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button
            id="external-boundary-cancel-btn"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all cursor-pointer active:scale-95"
          >
            {isHindi ? 'रहने दें' : 'Stay Here'}
          </button>
          <button
            id="external-boundary-proceed-btn"
            onClick={onProceed}
            className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-all cursor-pointer active:scale-95"
          >
            {isHindi ? 'वेबसाइट खोलें' : 'Open Website'}
          </button>
        </div>
      </div>
    </div>
  );
}
