// ================================================================
// CropCalendarPage.tsx — Dedicated Farmer Crop Calendar Page
// ================================================================

import { useEffect } from 'react';
import { CropCalendar } from '../components/crop-calendar/CropCalendar';
import { useAssistant } from '../context/AssistantContext';
import { updateUIState } from '../agent/agentBridge';
import { eventBus } from '../services/eventBus';

export function CropCalendarPage() {
  const { profile, startVoice } = useAssistant();
  const currentLangCode = profile.languageCode || 'hi';

  useEffect(() => {
    document.title = 'Farmer Crop Calendar — Gram Sathi';
    updateUIState({
      route: '/calendar',
      pageName: 'Farmer Crop Calendar',
      activeTab: 'calendar',
      visibleActions: ['select_state', 'select_crop', 'view_sowing_harvesting'],
    });

    eventBus.emit({
      type: 'PAGE_READY',
      route: '/calendar',
      title: 'Farmer Crop Calendar',
    });
  }, []);

  const handleOpenVoiceWithCrop = (cropName?: string, stateName?: string, _monthNum?: number) => {
    startVoice({
      defaultMode: 'compact',
      serviceContext: {
        currentCrop: cropName || null,
        selectedState: stateName || null,
      },
    });
  };

  return (
    <div className="min-h-full bg-slate-50 py-6 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <CropCalendar
          onOpenVoiceAssistant={handleOpenVoiceWithCrop}
          isHindi={currentLangCode === 'hi'}
          languageCode={currentLangCode}
        />
      </div>
    </div>
  );
}
