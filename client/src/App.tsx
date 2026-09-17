// ================================================================
// App.tsx — Gram Sathi Router Configuration
// Full page service routes (/services/:slug) + main assistant
// ================================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { VoiceAssistantApp } from './components/VoiceAssistantApp';
import { ServiceDetailPage } from './pages/ServiceDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main Assistant Homepage */}
        <Route path="/" element={<VoiceAssistantApp defaultTab="chat" />} />
        <Route path="/chat" element={<VoiceAssistantApp defaultTab="chat" />} />
        <Route path="/voice" element={<VoiceAssistantApp defaultTab="schemes" />} />
        <Route path="/calendar" element={<VoiceAssistantApp defaultTab="calendar" />} />
        <Route path="/services" element={<VoiceAssistantApp defaultTab="chat" />} />

        {/* Dedicated Full Page for Government Services */}
        <Route path="/services/:slug" element={<ServiceDetailPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
