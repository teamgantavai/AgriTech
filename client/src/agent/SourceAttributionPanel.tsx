// ============================================================
// SourceAttributionPanel — Shows source + retrieved timestamp
// Displayed when AI retrieves information from gov sources
// Branch: agent-control
// ============================================================

import type { SourceInfo } from '../agent/agentStateMachine';

interface Props {
  sources: SourceInfo[];
  langCode?: string;
  onDismiss?: () => void;
}

export function SourceAttributionPanel({ sources, langCode = 'hi', onDismiss }: Props) {
  const isHindi = langCode === 'hi' || langCode === 'pa';

  if (!sources.length) return null;

  return (
    <div
      id="source-attribution-panel"
      className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border-b border-slate-200">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">📌</span>
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            {isHindi ? 'जानकारी के स्रोत' : 'Information Sources'}
          </span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>

      {/* Sources */}
      <div className="divide-y divide-slate-100">
        {sources.map((source, i) => (
          <div key={i} className="px-3 py-2.5 flex items-start gap-2">
            {/* Official gov badge */}
            <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              source.isOfficialGov
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-200 text-slate-500'
            }`}>
              {source.isOfficialGov ? '🏛' : '🌐'}
            </span>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-800 truncate">{source.title}</div>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-green-700 hover:underline truncate block"
              >
                {source.url.replace(/^https?:\/\//, '')}
              </a>
              <div className="flex items-center gap-2 mt-0.5">
                {source.isOfficialGov && (
                  <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                    {isHindi ? 'सरकारी स्रोत ✓' : 'Official Gov ✓'}
                  </span>
                )}
                <span className="text-[9px] text-slate-400">
                  {isHindi ? 'प्राप्त:' : 'Retrieved:'} {source.retrievedAt}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="px-3 py-2 bg-slate-100 border-t border-slate-100">
        <p className="text-[9px] text-slate-400 leading-relaxed">
          {isHindi
            ? 'ग्राम साथी केवल आधिकारिक सरकारी वेबसाइटों से जानकारी प्रदान करता है।'
            : 'Gram Sathi retrieves information only from official government websites.'}
        </p>
      </div>
    </div>
  );
}
