// ================================================================
// App.tsx — Gram Sathi AI Persistent Voice & Application Shell Router
// The voice assistant stays mounted and active across all page navigations
// ================================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AssistantProvider } from './context/AssistantContext';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/HomePage';
import { SchemesPage } from './pages/SchemesPage';
import { CropCalendarPage } from './pages/CropCalendarPage';
import { ChatPage } from './pages/ChatPage';
import { ServiceDetailPage } from './pages/ServiceDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { FormCopilotPage } from './pages/FormCopilotPage';

export default function App() {
  return (
    <BrowserRouter>
      <AssistantProvider>
        <AppShell>
          <Routes>
            {/* Citizen Portal Home */}
            <Route path="/" element={<HomePage />} />
            <Route path="/home" element={<HomePage />} />

            {/* Citizen Profile System */}
            <Route path="/profile" element={<ProfilePage />} />

            {/* Government Website Form Copilot (Task 2) */}
            <Route path="/copilot" element={<FormCopilotPage />} />
            <Route path="/copilot/:portalId" element={<FormCopilotPage />} />

            {/* Voice Landing triggers voice overlay while showing home portal */}
            <Route path="/voice" element={<HomePage />} />

            {/* Schemes Directory & Category Filtering */}
            <Route path="/schemes" element={<SchemesPage />} />
            <Route path="/schemes/:category" element={<SchemesPage />} />
            <Route path="/services" element={<SchemesPage />} />

            {/* Dedicated 8-Section Government Service Detail Page */}
            <Route path="/services/:slug" element={<ServiceDetailPage />} />

            {/* Farmer Crop Calendar */}
            <Route path="/calendar" element={<CropCalendarPage />} />

            {/* AI Text Chat Assistant */}
            <Route path="/chat" element={<ChatPage />} />

            {/* Fallback to Home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </AssistantProvider>
    </BrowserRouter>
  );
}
