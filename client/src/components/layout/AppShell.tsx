// ================================================================
// AppShell.tsx — Unified Application Shell
// Main Navigation + Router View + Persistent Voice Assistant Overlay
// NEVER unmounts during route changes
// ================================================================

import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAssistant } from '../../context/AssistantContext';
import { GlobalVoiceAssistant } from '../voice/GlobalVoiceAssistant';
import { AgentProgressBar } from '../../agent/AgentProgressBar';
import { AgentConfirmationModal } from '../../agent/AgentConfirmationModal';
import { ExternalWebsiteBoundary } from '../../agent/ExternalWebsiteBoundary';
import { VoiceFieldConfirmationModal } from '../profile/VoiceFieldConfirmationModal';

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const {
    isOpen,
    uiMode,
    startVoice,
    profile,
    agentState,
    agentTask,
    agentConfirmation,
    handleConfirmationResponse,
    externalNav,
    closeExternalNav,
    proceedExternalNav,
  } = useAssistant();

  // Auto-close mobile menu on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const currentLangCode = profile.languageCode || 'hi';

  const navLinks = [
    { to: '/', label: 'Home', icon: '🏛️' },
    { to: '/profile', label: 'Citizen Profile', icon: '👤' },
    { to: '/copilot', label: 'Form Copilot', icon: '⚡' },
    { to: '/schemes', label: 'Schemes', icon: '📄' },
    { to: '/calendar', label: 'Crop Calendar', icon: '🌾' },
    { to: '/chat', label: 'AI Chat', icon: '💬' },
  ];

  return (
    <div className="h-screen w-full bg-slate-50 text-slate-900 flex flex-col overflow-hidden relative font-sans">
      {/* ── Top Main Navigation Bar ── */}
      <header className="w-full border-b border-slate-200 bg-white/95 backdrop-blur-md z-30 px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between flex-shrink-0 shadow-xs">
        {/* Brand */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2 sm:gap-2.5 cursor-pointer select-none"
        >
          <div className="w-8 h-8 rounded-xl bg-green-600 text-white flex items-center justify-center text-sm shadow-xs font-bold flex-shrink-0">
            🏛️
          </div>
          <div>
            <div className="text-sm sm:text-base font-bold text-slate-900 leading-tight">Gram Sathi</div>
            <div className="text-[10px] text-slate-500 hidden sm:block">
              {currentLangCode === 'hi' ? 'सरकारी सेवाएं एवं कृषक सहायक' : 'Government Services & Farmer AI'}
            </div>
          </div>
        </div>

        {/* Center Route Links (Desktop Only - Clean horizontal pill) */}
        <nav className="hidden sm:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`
              }
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right Actions: Voice Trigger + Mobile Hamburger */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => {
              const isProfile = location.pathname === '/profile';
              startVoice({ defaultMode: 'expanded', profileMode: isProfile });
            }}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer border ${
              isOpen
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 hover:shadow-emerald-600/20'
            }`}
          >
            <span>🎙️</span>
            <span className="text-[11px] sm:text-xs">{isOpen ? 'Active' : 'Talk AI'}</span>
          </button>

          {/* Mobile Hamburger Toggle (Mobile Only) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="sm:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all border border-slate-200/90"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <span className="text-sm font-bold">✕</span>
            ) : (
              <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ── Mobile Navigation Dropdown (Clean, well-spaced, zero chaos) ── */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b border-slate-200 bg-white/98 backdrop-blur-md px-4 py-3 shadow-lg z-30 animate-fade-down flex-shrink-0">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Menu Navigation
          </div>
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/90 shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{link.icon}</span>
                  <span>{link.label}</span>
                </div>
                <span className="text-slate-400 text-xs">→</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Application Router Outlet ── */}
      <main className="w-full flex-1 min-h-0 overflow-y-auto relative">
        {children}
      </main>

      {/* ── Persistent Voice Assistant Overlay (Floating FAB / Docked Bar / Slide-in Drawer) ── */}
      <GlobalVoiceAssistant />

      {/* ── Voice Profile Field Confirmation Dialog (Section 13) ── */}
      <VoiceFieldConfirmationModal />

      {/* ── L2/L3 Consequential Action Confirmation Modal ── */}
      <AgentConfirmationModal
        confirmation={agentConfirmation}
        langCode={currentLangCode}
        onResponse={handleConfirmationResponse}
      />

      {/* ── External Government Website Boundary Warning ── */}
      {externalNav && (
        <ExternalWebsiteBoundary
          url={externalNav.url}
          siteName={externalNav.siteName}
          langCode={currentLangCode}
          onProceed={proceedExternalNav}
          onCancel={closeExternalNav}
        />
      )}
    </div>
  );
}
