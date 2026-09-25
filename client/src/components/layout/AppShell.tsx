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

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
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

  const currentLangCode = profile.languageCode || 'hi';

  const navLinks = [
    { to: '/', label: 'Home', icon: '🏛️' },
    { to: '/schemes', label: 'Schemes', icon: '📄' },
    { to: '/calendar', label: 'Crop Calendar', icon: '🌾' },
    { to: '/chat', label: 'AI Chat', icon: '💬' },
  ];

  return (
    <div className="h-screen w-full bg-slate-50 text-slate-900 flex flex-col overflow-hidden relative font-sans">
      {/* ── Top Main Navigation Bar ── */}
      <header className="w-full border-b border-slate-200 bg-white/95 backdrop-blur-md z-30 px-4 sm:px-6 py-2.5 flex items-center justify-between flex-shrink-0 shadow-xs">
        {/* Brand */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 cursor-pointer select-none"
        >
          <div className="w-8 h-8 rounded-xl bg-green-600 text-white flex items-center justify-center text-sm shadow-xs font-bold">
            🏛️
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 leading-tight">Gram Sathi</div>
            <div className="text-[10px] text-slate-500 hidden sm:block">
              {currentLangCode === 'hi' ? 'सरकारी सेवाएं एवं कृषक सहायक' : 'Government Services & Farmer AI'}
            </div>
          </div>
        </div>

        {/* Center Route Links */}
        <nav className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl">
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
              <span className="hidden sm:inline">{link.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right Voice Trigger Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => startVoice({ defaultMode: 'expanded' })}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer border ${
              isOpen
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 hover:shadow-emerald-600/20'
            }`}
          >

            <span>🎙️</span>
            <span className="hidden sm:inline">{isOpen ? 'Voice Active' : 'Talk to AI'}</span>
          </button>
        </div>
      </header>

      {/* ── Main Application Router Outlet ── */}
      <main className="w-full flex-1 min-h-0 overflow-y-auto relative">
        {children}
      </main>

      {/* ── Persistent Voice Assistant Overlay (Floating FAB / Docked Bar / Slide-in Drawer) ── */}
      <GlobalVoiceAssistant />

      {/* ── Agent Progress Bar (fixed to top during active multi-step agent actions) ── */}
      <AgentProgressBar
        task={agentTask}
        agentState={agentState}
        langCode={currentLangCode}
      />

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
