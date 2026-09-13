import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { VoiceModalProvider, useVoiceModal } from './context/VoiceModalContext';
import { Header } from './components/Header';
import { LandingPage } from './pages/LandingPage';
import { ChatPage } from './pages/ChatPage';
import { SchemeDetailPage } from './pages/SchemeDetailPage';
import { VoiceOnboardingModal } from './components/Voice/VoiceOnboardingModal';
import { VoiceAssistant } from './components/Voice/VoiceAssistant';
import { LanguageCode, UserRole } from './types';

const LS_LANG_PICKED = 'sahkar_sathi_lang_picked';
const LS_ONBOARDING_DONE = 'sahkar_onboarding_completed';

function getHasPicked(): boolean {
  try {
    return localStorage.getItem(LS_ONBOARDING_DONE) === 'true';
  } catch {
    return false;
  }
}

function MainLayout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const { setLanguage } = useLanguage();
  const { openVoiceModal } = useVoiceModal();
  const [showOnboarding, setShowOnboarding] = useState<boolean>(!getHasPicked());

  useEffect(() => {
    const handleOpenOnboarding = () => setShowOnboarding(true);
    window.addEventListener('open-onboarding-modal', handleOpenOnboarding);
    return () => window.removeEventListener('open-onboarding-modal', handleOpenOnboarding);
  }, []);

  const handleOnboardingComplete = (lang: LanguageCode, role: UserRole, interest?: string) => {
    setLanguage(lang);
    setShowOnboarding(false);
    try {
      localStorage.setItem(LS_LANG_PICKED, 'true');
      localStorage.setItem(LS_ONBOARDING_DONE, 'true');
      localStorage.setItem('sahkar_user_role', role);
      if (interest) localStorage.setItem('sahkar_user_interest', interest);
      window.dispatchEvent(new CustomEvent('user-role-updated', { detail: { role, lang, interest } }));
    } catch { }

    // Start personalized talk with AI immediately
    setTimeout(() => {
      openVoiceModal(lang);
    }, 300);
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Startup AI Voice & Visual Onboarding Modal */}
      <VoiceOnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={handleOnboardingComplete}
      />

      {/* Global Floating Draggable Voice Assistant (persists across routes) */}
      <VoiceAssistant />

      {!isLanding && <Header />}
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/schemes/:id" element={<SchemeDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <VoiceModalProvider>
          <MainLayout />
        </VoiceModalProvider>
      </BrowserRouter>
    </LanguageProvider>
  );
}
