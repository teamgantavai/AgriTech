// ============================================================
// Crop Calendar Types
// ============================================================

export type CropPhase = 'sowing' | 'growing' | 'harvesting' | 'off';

export interface CropCalendarItem {
  id: string;
  crop: string;
  localName: string;
  season: string;
  primaryCategory: string;
  phase: CropPhase;
  timing?: string;
  timingDisplay: string;
  sowingWindow: string;
  growingWindow: string;
  harvestingWindow: string;
  source: string;
}

export interface CropCalendarResponse {
  success: boolean;
  state: string;
  stateHi?: string;
  month: number;
  monthName: string;
  monthNameHi: string;
  phases: {
    sowing: CropCalendarItem[];
    growing: CropCalendarItem[];
    harvesting: CropCalendarItem[];
  };
  totalCrops: number;
  source: string;
  dataNote: string;
  isCached: boolean;
  liveApiUsed: boolean;
  aiVoiceSummary: string;
}

export interface MonthTimelineItem {
  month: number;
  monthName: string;
  monthNameHi: string;
  phase: CropPhase;
  timing?: string;
}

export interface CropDetailsResponse {
  success: boolean;
  crop: string;
  localName: string;
  state: string;
  season: string;
  primaryCategory: string;
  sowingWindow: string;
  growingWindow: string;
  harvestingWindow: string;
  timeline: MonthTimelineItem[];
  source: string;
  dataNote: string;
}

export interface StateOption {
  id: string;
  name: string;
  nameHi: string;
}
