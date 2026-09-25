// ================================================================
// FormCopilotPage.tsx — Real Government Website Form Copilot
// Isolated Playwright Browser Session with interactive remote control
// and Gram Sathi safe profile-assisted automation layer
// ================================================================

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  fetchPortals,
  startBrowserSession,
  sendSessionAction,
  destroySession,
  createSnapshotStream,
  resolveProfileForForm,
  goToLoginSession,
  goToApplicationSession,
  type PortalInfo,
  type SessionSnapshot,
} from '../services/formCopilot/formCopilotService';
import { getProfile } from '../services/profileService';

const CATEGORIES = [
  { key: 'Scholarships', icon: '🎓', label: 'Scholarships', labelHi: 'छात्रवृत्ति' },
  { key: 'Farmer Schemes', icon: '🌾', label: 'Farmer Schemes', labelHi: 'किसान योजनाएं' },
  { key: 'Health', icon: '🏥', label: 'Health', labelHi: 'स्वास्थ्य' },
  { key: 'Housing', icon: '🏠', label: 'Housing', labelHi: 'आवास' },
  { key: 'Credit & Loans', icon: '💳', label: 'Credit & Loans', labelHi: 'ऋण' },
];

type Phase = 'select_scheme' | 'select_portal' | 'portal_open' | 'active_session';

export function FormCopilotPage() {
  const { portalId: urlPortalId } = useParams<{ portalId?: string }>();
  const navigate = useNavigate();

  // Portal Registry Data
  const [portals, setPortals] = useState<PortalInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPortal, setSelectedPortal] = useState<PortalInfo | null>(null);

  // Active Session State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [phase, setPhase] = useState<Phase>('select_scheme');
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'copilot' | 'review' | 'guidance'>('copilot');

  // Interactive Remote Typing
  const [remoteInputText, setRemoteInputText] = useState('');
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; id: number } | null>(null);

  // Refs
  const streamCleanupRef = useRef<(() => void) | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const screenshotImgRef = useRef<HTMLImageElement>(null);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load portal registry ──────────────────────────────────
  useEffect(() => {
    fetchPortals().then(setPortals).catch(console.error);
  }, []);

  // ── Auto-select from URL param ────────────────────────────
  useEffect(() => {
    if (urlPortalId && portals.length > 0) {
      const portal = portals.find((p) => p.id === urlPortalId);
      if (portal) {
        setSelectedPortal(portal);
        setSelectedCategory(portal.category);
        setPhase('portal_open');
      }
    }
  }, [urlPortalId, portals]);

  // ── Cleanup session on unmount ────────────────────────────
  useEffect(() => {
    return () => {
      streamCleanupRef.current?.();
      if (sessionIdRef.current) {
        destroySession(sessionIdRef.current).catch(() => {});
      }
    };
  }, []);

  // ── Send Action to Server Session ────────────────────────
  const sendAction = useCallback(async (action: string, extra?: Record<string, any>) => {
    if (!sessionId) return;
    try {
      const { snapshot: snap } = await sendSessionAction(sessionId, action, extra);
      if (snap) setSnapshot(snap);
    } catch (err: any) {
      console.error('[FormCopilotPage] Action error:', err);
    }
  }, [sessionId]);

  // ── Open the Real Government Website ─────────────────────
  const handleOpenApplication = useCallback(async () => {
    if (!selectedPortal) return;
    setIsStarting(true);
    setStartError(null);

    try {
      // 1. Resolve user profile safely
      const profileRaw = await getProfile().catch(() => ({}));
      const profileData = resolveProfileForForm(profileRaw as any);

      // 2. Start server-side isolated browser session
      const { sessionId: newId } = await startBrowserSession(selectedPortal.id, profileData);

      setSessionId(newId);
      sessionIdRef.current = newId;
      setPhase('active_session');

      // 3. Start realtime snapshot stream
      if (streamCleanupRef.current) streamCleanupRef.current();

      const cleanup = createSnapshotStream(
        newId,
        (snap) => {
          setSnapshot(snap);
          if (snap.state === 'GUIDANCE_MODE') setActiveTab('guidance');
        },
        (err) => console.warn('[FormCopilotPage] Stream update:', err.message)
      );
      streamCleanupRef.current = cleanup;
    } catch (err: any) {
      setStartError(err?.message || 'Failed to open the government website. Please try again.');
    } finally {
      setIsStarting(false);
    }
  }, [selectedPortal]);

  const handleDestroyAndReset = useCallback(async () => {
    streamCleanupRef.current?.();
    streamCleanupRef.current = null;
    if (sessionId) await destroySession(sessionId);
    setSessionId(null);
    sessionIdRef.current = null;
    setSnapshot(null);
    setPhase('select_scheme');
    setSelectedPortal(null);
    setSelectedCategory(null);
    setActiveTab('copilot');
  }, [sessionId]);

  // ── Direct Login & Application Shortcuts ─────────────────
  const handleGoToLogin = useCallback(async () => {
    if (!sessionId) return;
    try {
      const { snapshot: snap } = await goToLoginSession(sessionId);
      if (snap) setSnapshot(snap);
    } catch (err: any) {
      console.error('[FormCopilotPage] Go to login error:', err);
    }
  }, [sessionId]);

  const handleGoToApplication = useCallback(async () => {
    if (!sessionId) return;
    try {
      const { snapshot: snap } = await goToApplicationSession(sessionId);
      if (snap) setSnapshot(snap);
    } catch (err: any) {
      console.error('[FormCopilotPage] Go to application error:', err);
    }
  }, [sessionId]);

  // ── Remote Browser Interaction Handlers ──────────────────

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!screenshotImgRef.current) return;
    const rect = screenshotImgRef.current.getBoundingClientRect();
    // Remote browser viewport is 1280px wide
    const scale = 1280 / rect.width;
    const x = Math.round((e.clientX - rect.left) * scale);
    const y = Math.round((e.clientY - rect.top) * scale);

    // Show visual click ripple at click position
    setClickRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, id: Date.now() });
    setTimeout(() => setClickRipple(null), 800);

    // Focus scroll container so physical typing works immediately
    scrollContainerRef.current?.focus();

    sendAction('click', { x, y });
  }, [sendAction]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // If the user is currently typing in an input element inside the app UI, don't forward
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (
      e.key === 'Backspace' ||
      e.key === 'Enter' ||
      e.key === 'Tab' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'Escape'
    ) {
      e.preventDefault();
      sendAction('key_press', { key: e.key });
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      sendAction('type', { text: e.key });
    }
  }, [sendAction]);

  const handleImageDblClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!screenshotImgRef.current) return;
    const rect = screenshotImgRef.current.getBoundingClientRect();
    const scale = 1280 / rect.width;
    const x = Math.round((e.clientX - rect.left) * scale);
    const y = Math.round((e.clientY - rect.top) * scale);
    sendAction('dblclick', { x, y });
  }, [sendAction]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // Forward mouse wheel to remote session
    if (Math.abs(e.deltaY) > 5) {
      sendAction('scroll', { deltaY: Math.round(e.deltaY) });
    }
  }, [sendAction]);

  const handleScrollStep = useCallback((deltaY: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ top: deltaY, behavior: 'smooth' });
    }
    sendAction('scroll', { deltaY });
  }, [sendAction]);

  const handleScrollTo = useCallback((position: 'top' | 'bottom') => {
    if (scrollContainerRef.current) {
      const top = position === 'top' ? 0 : scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollTo({ top, behavior: 'smooth' });
      sendAction('scroll_to', { y: top });
    }
  }, [sendAction]);

  const handleSendType = useCallback(() => {
    if (!remoteInputText.trim()) return;
    sendAction('type', { text: remoteInputText });
    setRemoteInputText('');
  }, [remoteInputText, sendAction]);

  const handleKeyPress = useCallback((key: string) => {
    sendAction('key_press', { key });
  }, [sendAction]);

  const handleContainerScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const currentTop = scrollContainerRef.current.scrollTop;
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    scrollDebounceRef.current = setTimeout(() => {
      sendAction('scroll_to', { y: Math.round(currentTop) });
    }, 250);
  }, [sendAction]);

  // ── Voice Command Listener ────────────────────────────────
  useEffect(() => {
    const handleVoiceCommand = (e: any) => {
      const { action, detail } = e.detail || {};
      if (action === 'scrollDown') handleScrollStep(400);
      else if (action === 'scrollUp') handleScrollStep(-400);
      else if (action === 'goBack') sendAction('go_back');
      else if (action === 'reload') sendAction('reload');
      else if (action === 'stop') sendAction('stop');
      else if (action === 'inspect') sendAction('inspect_form');
      else if (action === 'startFilling') sendAction('start_filling');
    };

    window.addEventListener('gs_browser_command' as any, handleVoiceCommand);
    return () => window.removeEventListener('gs_browser_command' as any, handleVoiceCommand);
  }, [handleScrollStep, sendAction]);

  // ── Categorized Portals ───────────────────────────────────
  const filteredPortals = selectedCategory
    ? portals.filter((p) => p.category === selectedCategory)
    : portals;

  return (
    <div className="h-full w-full flex flex-col bg-[#f5f5f0] overflow-hidden font-sans">

      {/* ── TOP HEADER ── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-2xs z-10">
        <div className="flex items-center gap-3">
          {phase !== 'select_scheme' && (
            <button
              onClick={handleDestroyAndReset}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
            >
              ←
            </button>
          )}
          <div>
            <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
              Gram Sathi • Form Copilot
            </div>
            <div className="text-sm font-extrabold text-slate-900 leading-tight">
              {phase === 'active_session' && (snapshot?.portal?.name || selectedPortal?.name)
                ? snapshot?.portal?.name || selectedPortal?.name
                : 'Government Application Assistant'}
            </div>
          </div>
        </div>

        {phase === 'active_session' && (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-mono">
              <span className="text-emerald-600 font-bold">🔒</span>
              <span className="text-slate-700 truncate max-w-[200px]">
                {snapshot?.currentUrl || selectedPortal?.officialDomain}
              </span>
            </div>
            <Link
              to="/copilot"
              onClick={handleDestroyAndReset}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Change Portal
            </Link>
          </div>
        )}
      </div>

      {/* ── PHASE 1: SELECT SCHEME ── */}
      {phase === 'select_scheme' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-3xl mx-auto w-full space-y-8">
          <div className="text-center space-y-2 pt-4">
            <div className="text-4xl mb-2">🏛️</div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Choose a Government Service
            </h1>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Gram Sathi will launch an isolated browser session to the official government portal and assist you in completing your application.
            </p>
          </div>

          {/* Category Filter */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {CATEGORIES.map((cat, idx) => (
              <button
                key={`cat-${cat.key}-${idx}`}
                onClick={() => setSelectedCategory(cat.key === selectedCategory ? null : cat.key)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 font-bold text-xs transition-all cursor-pointer ${
                  selectedCategory === cat.key
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50'
                }`}
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-center leading-tight">{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Portal List */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              {selectedCategory ? `${selectedCategory} Portals` : 'All Supported Government Portals'}
            </div>
            {filteredPortals.map((portal, idx) => (
              <PortalCard
                key={`portal-${portal.id}-${idx}`}
                portal={portal}
                onSelect={() => {
                  setSelectedPortal(portal);
                  setPhase('portal_open');
                  navigate(`/copilot/${portal.id}`);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── PHASE 2: CONFIRM PORTAL LAUNCH ── */}
      {phase === 'portal_open' && selectedPortal && (
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-md space-y-4 text-center">
              <div className="text-5xl">{selectedPortal.categoryIcon}</div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Official Government Portal</div>
                <h2 className="text-xl font-extrabold text-slate-900 mt-1">{selectedPortal.name}</h2>
                <p className="text-sm text-slate-600 mt-1">{selectedPortal.description}</p>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                <span className="font-bold">🔒</span>
                <span>{selectedPortal.officialDomain}</span>
              </div>

              <div className="text-xs text-slate-500">
                {selectedPortal.status === 'guidance_mode'
                  ? 'Gram Sathi will guide you step-by-step through this portal.'
                  : 'An isolated browser session will open the real official portal. You can log in and interact directly.'}
              </div>

              {startError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {startError}
                </div>
              )}

              <button
                onClick={handleOpenApplication}
                disabled={isStarting}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-2xl text-sm font-extrabold shadow-lg shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isStarting ? (
                  <>
                    <span className="animate-spin text-base">⟳</span>
                    <span>Opening Official Website...</span>
                  </>
                ) : (
                  <>
                    <span>🏛️</span>
                    <span>Open Official Portal</span>
                  </>
                )}
              </button>

              <button
                onClick={() => { setPhase('select_scheme'); navigate('/copilot'); }}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
              >
                ← Choose a different service
              </button>
            </div>

            <div className="text-center text-xs text-slate-400 space-y-1">
              <p>Gram Sathi never stores your government password, OTP, or Aadhaar number.</p>
              <p>All authentication occurs directly inside your isolated browser session.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── PHASE 3: ACTIVE REAL BROWSER SESSION ── */}
      {phase === 'active_session' && (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

          {/* LEFT: Live Government Website Browser View */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-r border-slate-200 bg-slate-200">
            {/* Browser Chrome Bar */}
            <div className="bg-slate-300/90 px-3 py-2 flex items-center gap-2 flex-shrink-0 border-b border-slate-400/30">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                <div className="w-3 h-3 rounded-full bg-green-400/80" />
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-1 ml-1">
                <button
                  onClick={() => sendAction('go_back')}
                  title="Go Back"
                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  ←
                </button>
                <button
                  onClick={() => sendAction('go_forward')}
                  title="Go Forward"
                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  →
                </button>
                <button
                  onClick={() => sendAction('reload')}
                  title="Reload Portal"
                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  ⟳
                </button>
              </div>

              {/* Address Bar */}
              <div className="flex-1 max-w-xl mx-auto flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-300/80 shadow-2xs">
                <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                  <span>🔒</span>
                  <span>https://</span>
                </span>
                <span className="text-slate-800 font-medium truncate">
                  {snapshot?.currentUrl?.replace(/^https?:\/\//, '') || selectedPortal?.officialDomain + '...'}
                </span>
                <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded font-sans flex-shrink-0">
                  GOV.IN ✓
                </span>
              </div>

              {/* Quick Jump Shortcuts */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => sendAction('navigate', { url: selectedPortal?.officialUrl })}
                  title="Go to Official Home"
                  className="px-2 py-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>🏠</span>
                  <span className="hidden lg:inline">Home</span>
                </button>
                <button
                  onClick={handleGoToLogin}
                  title="Open Official Login Page directly"
                  className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>🔑</span>
                  <span>Login</span>
                </button>
                <button
                  onClick={handleGoToApplication}
                  title="Open Official Application Form / Registration"
                  className="px-2.5 py-1 text-[11px] font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>📝</span>
                  <span className="hidden sm:inline">Apply / Form</span>
                </button>
                <a
                  href={snapshot?.currentUrl || selectedPortal?.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open official portal in new tab for direct biometric/hardware access"
                  className="hidden md:flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors"
                >
                  <span>↗</span>
                  <span>Tab</span>
                </a>
              </div>
            </div>

            {/* Interactive Mode & Page Status Banner */}
            <div className="bg-emerald-50 border-b border-emerald-200/70 px-4 py-1.5 flex items-center justify-between text-[11px] text-emerald-800 flex-shrink-0">
              <div className="flex items-center gap-2 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  <strong>Live Browser Session:</strong> Click links, scroll, or fill forms directly on the government page.
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700">
                <span className="bg-emerald-100 px-2 py-0.5 rounded-full uppercase">
                  {snapshot?.pageDetection?.currentStep?.replace('_', ' ') || 'Browsing'}
                </span>
              </div>
            </div>

            {/* Scrollable & Interactive Browser Viewport */}
            <div
              ref={scrollContainerRef}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onWheel={handleWheel}
              onScroll={handleContainerScroll}
              className="flex-1 relative overflow-y-auto overflow-x-hidden bg-slate-100 scroll-smooth select-none outline-none focus:ring-1 focus:ring-emerald-500/40"
              style={{ maxHeight: '100%' }}
            >
              {snapshot?.screenshotBase64 ? (
                <div className="relative w-full flex flex-col items-center">
                  <img
                    ref={screenshotImgRef}
                    src={`data:image/jpeg;base64,${snapshot.screenshotBase64}`}
                    alt="Official government website — live browser view"
                    className="w-full h-auto block select-none cursor-pointer"
                    onClick={handleImageClick}
                    onDoubleClick={handleImageDblClick}
                    title="Click anywhere to interact or focus inputs, then type on your keyboard"
                  />

                  {/* Click Ripple Feedback Indicator */}
                  {clickRipple && (
                    <div
                      key={clickRipple.id}
                      className="absolute pointer-events-none rounded-full border-2 border-emerald-500 bg-emerald-400/40 animate-ping z-30"
                      style={{
                        left: clickRipple.x - 14,
                        top: clickRipple.y - 14,
                        width: 28,
                        height: 28,
                      }}
                    />
                  )}

                  {/* Floating Remote Browser Toolbar */}
                  <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-1.5 bg-slate-900/90 hover:bg-slate-900 backdrop-blur-md text-white px-3 py-1.5 rounded-2xl shadow-xl border border-slate-700 transition-all text-xs font-semibold my-2">
                    {/* Remote Type Input Box */}
                    <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-xl border border-slate-700">
                      <input
                        type="text"
                        value={remoteInputText}
                        onChange={(e) => setRemoteInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendType();
                        }}
                        placeholder="Type text into active field..."
                        className="bg-transparent text-white text-xs outline-none w-36 sm:w-48 placeholder-slate-400"
                      />
                      <button
                        onClick={handleSendType}
                        className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-0.5 rounded-lg cursor-pointer"
                      >
                        Type
                      </button>
                      <button
                        onClick={() => handleKeyPress('Enter')}
                        className="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold px-1.5 py-0.5 rounded-lg cursor-pointer"
                        title="Press Enter"
                      >
                        ↵
                      </button>
                      <button
                        onClick={() => handleKeyPress('Tab')}
                        className="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold px-1.5 py-0.5 rounded-lg cursor-pointer"
                        title="Press Tab"
                      >
                        ⇥
                      </button>
                    </div>

                    <div className="w-px h-4 bg-slate-700 mx-0.5" />

                    {/* Quick Scroll Controls */}
                    <button
                      onClick={() => handleScrollTo('top')}
                      title="Scroll to Top"
                      className="px-2 py-1 hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>⤒</span>
                      <span className="hidden sm:inline">Top</span>
                    </button>
                    <button
                      onClick={() => handleScrollStep(-400)}
                      title="Scroll Up"
                      className="px-2 py-1 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleScrollStep(400)}
                      title="Scroll Down"
                      className="px-2 py-1 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => handleScrollTo('bottom')}
                      title="Scroll to Bottom"
                      className="px-2 py-1 hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>⤓</span>
                      <span className="hidden sm:inline">Bottom</span>
                    </button>

                    <div className="w-px h-4 bg-slate-700 mx-0.5" />

                    <a
                      href={snapshot?.currentUrl || selectedPortal?.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in new window"
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors flex items-center gap-1 font-bold"
                    >
                      <span>↗</span>
                      <span>Open Tab</span>
                    </a>
                  </div>
                </div>
              ) : (
                <SessionStatusOverlay snapshot={snapshot} />
              )}

              {/* Filling Progress Banner */}
              {snapshot?.state === 'FILLING' && snapshot.currentlyFillingFieldId && (
                <div className="sticky bottom-16 left-4 right-4 mx-4 bg-emerald-900/90 backdrop-blur-sm text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg z-40">
                  <span className="animate-pulse text-emerald-400">→</span>
                  <span>
                    Filling: {snapshot.fillingProgress.find((p) => p.fieldId === snapshot.currentlyFillingFieldId)?.label}
                  </span>
                  <span className="ml-auto text-[10px] text-emerald-300 animate-pulse">Auto-filling...</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Gram Sathi Copilot Assistant Panel */}
          <aside className="w-full md:w-[380px] lg:w-[420px] h-full bg-white flex flex-col border-l border-slate-200 shadow-lg flex-shrink-0 z-20">
            {/* Panel Header */}
            <div className="p-4 bg-slate-900 text-white flex-shrink-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Gram Sathi Copilot</div>
                  <div className="text-sm font-extrabold truncate">{snapshot?.portal?.name || selectedPortal?.name || 'Government Application'}</div>
                </div>
                <StatusBadge state={snapshot?.state} />
              </div>
              <div className="text-[11px] text-slate-300 flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg">
                <span>🌐</span>
                <span className="font-mono text-white truncate max-w-[200px]">
                  {snapshot?.portal?.officialDomain || selectedPortal?.officialDomain}
                </span>
                <span className="ml-auto text-emerald-400 font-bold">✓ Isolated Session</span>
              </div>
            </div>

            {/* Panel Tabs */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-3 text-xs font-bold flex-shrink-0">
              {[
                { key: 'copilot', label: 'Copilot' },
                { key: 'review', label: `Review (${snapshot?.mappedFields?.length ?? 0})` },
                ...(snapshot?.state === 'GUIDANCE_MODE' ? [{ key: 'guidance', label: 'Guide' }] : []),
              ].map((tab, idx) => (
                <button
                  key={`tab-${tab.key}-${idx}`}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-3 py-2.5 border-b-2 transition-all cursor-pointer ${
                    activeTab === tab.key
                      ? 'border-emerald-600 text-emerald-800 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTab === 'copilot' && (
                <CopilotMainPanel
                  snapshot={snapshot}
                  onInspectForm={() => sendAction('inspect_form')}
                  onStartFilling={() => sendAction('start_filling')}
                  onPause={() => sendAction('pause')}
                  onResume={() => sendAction('resume')}
                  onStop={() => sendAction('stop')}
                  onResumeAfterUser={() => sendAction('resume_after_user')}
                  onSubmit={() => setShowFinalConfirm(true)}
                  onSwitchToReview={() => setActiveTab('review')}
                  onGoToLogin={handleGoToLogin}
                  onGoToApplication={handleGoToApplication}
                />
              )}
              {activeTab === 'review' && (
                <ReviewPanel mappedFields={snapshot?.mappedFields ?? []} />
              )}
              {activeTab === 'guidance' && (
                <GuidancePanel
                  portal={snapshot?.portal ?? null}
                  steps={snapshot?.guidanceSteps ?? []}
                />
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ── FINAL SUBMISSION CONFIRMATION MODAL ── */}
      {showFinalConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="font-extrabold text-slate-900 text-sm">Final Official Submission</div>
                <div className="text-xs text-slate-500 mt-0.5">Official consequential action</div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              You are about to submit your application directly on{' '}
              <strong className="text-slate-900">{snapshot?.portal?.name}</strong>. The official government portal will process this application.
            </p>
            <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
              Please review all entries on the government website preview before continuing.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowFinalConfirm(false)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Go Back & Review
              </button>
              <button
                onClick={() => { setShowFinalConfirm(false); sendAction('submit'); }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Yes, Submit Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-Components ─────────────────────────────────────────────

function PortalCard({ portal, onSelect }: { portal: PortalInfo; onSelect: () => void }) {
  const isSupported = portal.status === 'supported';
  const isGuidance = portal.status === 'guidance_mode';
  const isComingSoon = portal.status === 'coming_soon';

  return (
    <button
      onClick={isComingSoon ? undefined : onSelect}
      disabled={isComingSoon}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
        isComingSoon
          ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
          : 'border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md cursor-pointer active:scale-[0.99]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0">{portal.categoryIcon}</span>
          <div className="min-w-0">
            <div className="font-extrabold text-slate-900 text-sm">{portal.name}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">{portal.officialDomain}</div>
            <div className="text-xs text-slate-600 mt-1 leading-snug">{portal.description}</div>
          </div>
        </div>
        <div className="flex-shrink-0">
          {isSupported && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
              ⚡ Live Browser
            </span>
          )}
          {isGuidance && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold">
              📖 Guided
            </span>
          )}
          {isComingSoon && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold">
              Soon
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function SessionStatusOverlay({ snapshot }: { snapshot: SessionSnapshot | null }) {
  const messages: Record<string, { icon: string; text: string; subtext?: string }> = {
    CREATING: { icon: '🔌', text: 'Starting isolated browser session...', subtext: 'Configuring secure context' },
    NAVIGATING: { icon: '📡', text: 'Loading official government website...', subtext: 'Connecting to official domain' },
    READY: { icon: '🏛️', text: 'Official website opened', subtext: 'You are in control' },
    ACTIVE: { icon: '🔍', text: 'Reading application form...', subtext: 'Matching verified information' },
    WAITING_FOR_USER: { icon: '🔐', text: 'Your action is needed', subtext: 'Please check the Copilot panel' },
    FILLING: { icon: '✍️', text: 'Auto-filling form fields...', subtext: 'Entering verified details' },
    PAUSED: { icon: '⏸️', text: 'Automation paused', subtext: 'You have full control' },
    READY_TO_SUBMIT: { icon: '🎉', text: 'Application ready for review', subtext: 'Review before final submission' },
    SUBMITTING: { icon: '🚀', text: 'Submitting to official portal...' },
    COMPLETED: { icon: '✅', text: 'Application submitted!' },
    ERROR: { icon: '❌', text: 'Browser connection issue', subtext: 'You can reload or apply directly' },
    GUIDANCE_MODE: { icon: '📖', text: 'Guidance Mode active', subtext: 'Follow the steps in the panel' },
    CLOSED: { icon: '🔒', text: 'Session closed' },
  };

  const state = snapshot?.state ?? 'CREATING';
  const info = messages[state] || { icon: '⏳', text: 'Loading...' };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-slate-100/90 backdrop-blur-xs">
      <div className="text-5xl mb-4 animate-pulse">{info.icon}</div>
      <div className="font-extrabold text-slate-800 text-base">{info.text}</div>
      {info.subtext && <div className="text-xs text-slate-500 mt-1">{info.subtext}</div>}
      {snapshot?.error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 max-w-sm">
          {snapshot.error}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ state }: { state?: string | null }) {
  if (!state) return null;
  const map: Record<string, { label: string; cls: string }> = {
    READY: { label: 'Ready', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' },
    ACTIVE: { label: 'Form Detected', cls: 'bg-blue-500/20 text-blue-200 border-blue-400/30' },
    FILLING: { label: 'Filling', cls: 'bg-blue-500/20 text-blue-200 border-blue-400/30' },
    WAITING_FOR_USER: { label: 'Action Needed', cls: 'bg-amber-500/20 text-amber-200 border-amber-400/30' },
    PAUSED: { label: 'Paused', cls: 'bg-slate-500/20 text-slate-300 border-slate-400/30' },
    READY_TO_SUBMIT: { label: 'Review', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' },
    COMPLETED: { label: 'Done ✓', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' },
    ERROR: { label: 'Error', cls: 'bg-red-500/20 text-red-200 border-red-400/30' },
    GUIDANCE_MODE: { label: 'Guidance', cls: 'bg-blue-500/20 text-blue-200 border-blue-400/30' },
  };
  const info = map[state] || { label: 'Live', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' };
  return (
    <span className={`text-[10px] border px-2 py-0.5 rounded-full font-bold ${info.cls}`}>
      {info.label}
    </span>
  );
}

function CopilotMainPanel({
  snapshot,
  onInspectForm,
  onStartFilling,
  onPause,
  onResume,
  onStop,
  onResumeAfterUser,
  onSubmit,
  onSwitchToReview,
  onGoToLogin,
  onGoToApplication,
}: {
  snapshot: SessionSnapshot | null;
  onInspectForm: () => void;
  onStartFilling: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onResumeAfterUser: () => void;
  onSubmit: () => void;
  onSwitchToReview: () => void;
  onGoToLogin: () => void;
  onGoToApplication: () => void;
}) {
  const state = snapshot?.state;
  const detection = snapshot?.pageDetection;
  const profile = snapshot?.mappedFields ?? [];
  const profileFields = profile.filter((f) => f.source === 'profile');
  const docFields = profile.filter((f) => f.source === 'document');
  const missingFields = profile.filter((f) => f.status === 'MISSING');

  // 1. Loading / Opening
  if (!state || state === 'CREATING' || state === 'NAVIGATING') {
    return (
      <div className="space-y-3 text-center p-4 text-slate-500">
        <div className="text-3xl animate-pulse">🌐</div>
        <div className="text-sm font-semibold">Opening official government website...</div>
        <div className="text-xs text-slate-400">Connecting securely to {snapshot?.portal?.officialDomain}</div>
      </div>
    );
  }

  // 2. SECURITY STOP (CAPTCHA, OTP, Login)
  if (snapshot?.securityStop) {
    return (
      <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-3">
        <div className="text-sm font-extrabold text-amber-900 flex items-center gap-2">
          <span className="text-xl">🔐</span>
          <span>{snapshot.securityStop.title}</span>
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">{snapshot.securityStop.message}</p>
        <div className="text-xs text-amber-700 bg-amber-100/70 p-2.5 rounded-xl">
          <strong>Action required on official website:</strong> Gram Sathi has paused automation so you can complete this verification directly.
        </div>
        <button
          onClick={onResumeAfterUser}
          className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md"
        >
          {snapshot.securityStop.resumeLabel}
        </button>
      </div>
    );
  }

  // 3. READY STATE: Official Website Opened — User in Control
  // As requested in Section 16 of the specification!
  if (state === 'READY') {
    const isFormPage = detection?.formDetected;
    const isLoginPage = detection?.loginRequired || detection?.currentStep === 'login';

    return (
      <div className="space-y-4">
        {/* Login Page Helper Banner */}
        {isLoginPage ? (
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-2.5">
            <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <span>🔑</span> Official Portal Login Active
            </div>
            <p className="text-xs text-amber-800 leading-snug">
              Click on the Application ID / OTR / Password field on the page to focus it. You can type directly with your keyboard or use the Remote Typing bar below.
            </p>
            <div className="text-[11px] text-amber-900/80 bg-amber-100/70 p-2 rounded-xl">
              💡 <em>Gram Sathi never stores or logs your government credentials.</em>
            </div>
          </div>
        ) : null}

        {/* Quick Navigation Shortcuts */}
        <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Official Site Shortcuts</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onGoToLogin}
              className="py-2 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🔑</span>
              <span>Go to Login</span>
            </button>
            <button
              onClick={onGoToApplication}
              className="py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>📝</span>
              <span>Apply / Form</span>
            </button>
          </div>
        </div>

        {isFormPage ? (
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2">
            <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <span>📋</span> Application Form Detected
            </div>
            <p className="text-xs text-blue-800">
              Gram Sathi detected an application form on the official page. Click below to inspect fields and match with your verified profile.
            </p>
            <button
              onClick={onInspectForm}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🔍</span>
              <span>Inspect & Match Profile</span>
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>🏛️</span> Official Website Opened
            </div>
            <div className="text-xs text-slate-600 font-semibold">You're in control:</div>
            <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside pl-1">
              <li>Sign in to the official website if required.</li>
              <li>Open the application form you want to fill.</li>
              <li>Gram Sathi will assist you once the form is open.</li>
            </ol>
            <button
              onClick={onInspectForm}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🔍</span>
              <span>Detect Application Form</span>
            </button>
          </div>
        )}

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 space-y-1">
          <div className="font-semibold text-slate-700">Security Guarantee:</div>
          <p>Gram Sathi never stores government passwords or OTPs. All official submissions are processed directly by the government portal.</p>
        </div>
      </div>
    );
  }

  // 4. ACTIVE FORM REVIEW: Form Inspected & Ready for User Confirmation
  if (state === 'ACTIVE') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
          <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
            <span>✓</span> Application Form Detected
          </div>
          <p className="text-xs text-emerald-800">
            Verified details matched from your Gram Sathi Profile. Review before filling:
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5">
            <div className="text-lg font-extrabold text-slate-900">{profileFields.length}</div>
            <div className="text-slate-500 font-semibold leading-tight">From profile</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5">
            <div className="text-lg font-extrabold text-slate-900">{docFields.length}</div>
            <div className="text-slate-500 font-semibold leading-tight">From documents</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-0.5">
            <div className="text-lg font-extrabold text-amber-900">{missingFields.length}</div>
            <div className="text-amber-700 font-semibold leading-tight">Need input</div>
          </div>
        </div>

        {/* Quick Field Preview */}
        <div className="space-y-1.5">
          {profile.slice(0, 5).map((f, idx) => (
            <div
              key={`field-preview-${f.fieldId || 'f'}-${idx}`}
              className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-white rounded-xl border border-slate-100"
            >
              <span className="text-slate-700 font-medium truncate max-w-[170px]">{f.label}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                f.source === 'profile' ? 'bg-emerald-100 text-emerald-800' :
                f.source === 'document' ? 'bg-blue-100 text-blue-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {f.sourceLabel}
              </span>
            </div>
          ))}
          {profile.length > 5 && (
            <button
              onClick={onSwitchToReview}
              className="text-xs text-emerald-700 font-semibold px-2.5 py-1 cursor-pointer hover:underline"
            >
              View all {profile.length} fields →
            </button>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={onStartFilling}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-extrabold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>⚡</span>
            <span>Start Auto-Filling on Official Portal</span>
          </button>
          <button
            onClick={onSwitchToReview}
            className="w-full py-2 text-xs text-slate-600 hover:text-slate-900 font-semibold text-center cursor-pointer"
          >
            Review all fields first
          </button>
        </div>
      </div>
    );
  }

  // 5. ACTIVE AUTO-FILLING / PAUSED
  if (state === 'FILLING' || state === 'PAUSED') {
    const progress = snapshot?.fillingProgress ?? [];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div>
            <div className="text-xs font-bold text-slate-900">
              {state === 'FILLING' ? 'Auto-filling official form...' : 'Automation paused'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {snapshot?.completedFieldsCount} of {snapshot?.totalFieldsCount} fields completed
            </div>
          </div>
          <div className="flex gap-1.5">
            {state === 'FILLING' ? (
              <button
                onClick={onPause}
                className="px-2.5 py-1 text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg cursor-pointer"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={onResume}
                className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
              >
                Resume
              </button>
            )}
            <button
              onClick={onStop}
              className="px-2.5 py-1 text-xs font-bold bg-red-100 hover:bg-red-200 text-red-700 rounded-lg cursor-pointer"
            >
              Stop
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          {progress.map((item, idx) => {
            const isCurrent = snapshot?.currentlyFillingFieldId === item.fieldId;
            const isDone = item.status === 'done' || item.status === 'user_modified';
            const isError = item.status === 'error';
            return (
              <div
                key={`prog-${item.fieldId || 'p'}-${idx}`}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
                  isCurrent ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200 font-bold text-blue-900'
                  : isDone ? 'border-slate-200 bg-slate-50 text-slate-700'
                  : isError ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-slate-100 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{isCurrent ? '→' : isDone ? '✓' : isError ? '✗' : '○'}</span>
                  <span className="truncate">{item.label}</span>
                </div>
                {isDone && item.displayValue && (
                  <span className="text-slate-600 font-medium truncate max-w-[100px] ml-2">{item.displayValue}</span>
                )}
                {isCurrent && (
                  <span className="text-blue-600 animate-pulse text-[10px] font-bold">Typing...</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 6. READY TO SUBMIT
  if (state === 'READY_TO_SUBMIT') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-2">
          <div className="text-sm font-extrabold text-emerald-900 flex items-center gap-2">
            <span>🎉</span> Form Filling Complete
          </div>
          <div className="text-xs text-emerald-800">
            {snapshot?.completedFieldsCount} fields have been filled on the official form. Please review the website before final submission.
          </div>
        </div>
        <button
          onClick={onSubmit}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-extrabold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>🚀</span> Submit to Official Portal
        </button>
      </div>
    );
  }

  // 7. COMPLETED
  if (state === 'COMPLETED' && snapshot?.submissionResult) {
    return (
      <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 space-y-4">
        <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm">
          <span className="text-2xl">✓</span>
          <span>Application Submitted</span>
        </div>
        {snapshot.submissionResult.referenceNumber && (
          <div className="bg-white rounded-xl p-3 border border-emerald-200 text-xs space-y-1">
            <div className="text-slate-500">Reference Number</div>
            <div className="font-mono font-extrabold text-slate-900 text-base">{snapshot.submissionResult.referenceNumber}</div>
          </div>
        )}
        <p className="text-xs text-emerald-800">{snapshot.submissionResult.message}</p>
      </div>
    );
  }

  // 8. ERROR
  if (state === 'ERROR') {
    return (
      <div className="p-4 rounded-2xl bg-red-50 border border-red-200 space-y-3">
        <div className="font-bold text-red-800 text-sm flex items-center gap-2">
          <span>❌</span> Connection Issue
        </div>
        <p className="text-xs text-red-700">{snapshot?.error || 'Encountered a problem reaching the government portal.'}</p>
        <p className="text-xs text-slate-600">
          You can reload or apply directly on{' '}
          <a href={snapshot?.portal?.officialUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold underline">
            {snapshot?.portal?.officialDomain}
          </a>.
        </p>
      </div>
    );
  }

  return null;
}

function ReviewPanel({ mappedFields }: { mappedFields: any[] }) {
  const profileF = mappedFields.filter((f) => f.source === 'profile');
  const docF = mappedFields.filter((f) => f.source === 'document');
  const emptyF = mappedFields.filter((f) => f.source === 'empty');

  const Section = ({ title, fields, color }: { title: string; fields: any[]; color: string }) =>
    fields.length === 0 ? null : (
      <div className="space-y-2">
        <div className={`text-xs font-bold uppercase tracking-wide ${color}`}>{title}</div>
        {fields.map((f, idx) => (
          <div
            key={`review-${f.fieldId || 'rf'}-${idx}`}
            className="p-3 rounded-xl border border-slate-200 bg-white space-y-1 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">{f.label}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                f.source === 'profile' ? 'bg-emerald-100 text-emerald-800' :
                f.source === 'document' ? 'bg-blue-100 text-blue-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {f.sourceLabel}
              </span>
            </div>
            <div className="text-slate-700 font-medium">
              {f.displayValue || <span className="text-slate-400 italic">Not available — needs your input</span>}
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="text-xs font-bold text-slate-600">All form fields and their data sources</div>
      <Section title={`From your profile (${profileF.length})`} fields={profileF} color="text-emerald-700" />
      <Section title={`From your documents (${docF.length})`} fields={docF} color="text-blue-700" />
      <Section title={`Need your input (${emptyF.length})`} fields={emptyF} color="text-amber-700" />
    </div>
  );
}

function GuidancePanel({ portal, steps }: { portal: any; steps: string[] }) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-1">
        <div className="text-xs font-bold text-blue-900">📖 Guidance Mode</div>
        <p className="text-xs text-blue-800">
          This portal requires direct interaction on the official site. Follow Gram Sathi's guidance for each step below.
        </p>
      </div>

      <div className="space-y-2">
        {steps.map((step, idx) => (
          <div
            key={`guidance-step-${idx}`}
            className="p-3 rounded-xl border border-slate-200 bg-white text-xs flex items-start gap-2.5"
          >
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[11px] flex-shrink-0">
              {idx + 1}
            </span>
            <span className="text-slate-700 leading-snug">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
