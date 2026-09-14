// ============================================================
// Crop Calendar Service — Business Logic & Data Orchestrator
// Unified Single Source of Truth for Web UI and Gemini Live
// ============================================================

import { cropCalendarCache } from '../lib/cache';
import { upagApiClient } from './upagApiClient';
import {
  UPAG_DOMESTIC_CROP_CALENDAR,
  OFFICIAL_INDIAN_STATES,
  MONTH_NAMES,
  MONTH_NAMES_HI,
  UPAgCropRecord,
  CropPhase,
  MonthPhaseDetail,
} from './upagDataset';

export interface CropCalendarQuery {
  state: string;
  month: number; // 1 - 12
  crop?: string | null;
  phase?: 'sowing' | 'growing' | 'harvesting' | 'all';
}

export interface CropCalendarPhaseItem {
  id: string;
  crop: string;
  localName: string;
  season: string;
  primaryCategory: string;
  phase: CropPhase;
  timing?: string;
  timingDisplay: string; // e.g. "October — Early" or "Late September"
  sowingWindow: string;
  growingWindow: string;
  harvestingWindow: string;
  source: string;
}

export interface CropCalendarResult {
  success: boolean;
  state: string;
  stateHi?: string;
  month: number;
  monthName: string;
  monthNameHi: string;
  phases: {
    sowing: CropCalendarPhaseItem[];
    growing: CropCalendarPhaseItem[];
    harvesting: CropCalendarPhaseItem[];
  };
  totalCrops: number;
  source: string;
  dataNote: string;
  isCached: boolean;
  liveApiUsed: boolean;
  aiVoiceSummary: string; // Concise, natural 1-3 sentence summary for Gemini Live
}

export interface CropTimelineResponse {
  success: boolean;
  crop: string;
  localName: string;
  state: string;
  season: string;
  primaryCategory: string;
  sowingWindow: string;
  growingWindow: string;
  harvestingWindow: string;
  timeline: Array<{
    month: number;
    monthName: string;
    monthNameHi: string;
    phase: CropPhase;
    timing?: string;
  }>;
  source: string;
  dataNote: string;
}

/**
 * Normalize state name for robust matching (e.g. "rajasthan", "Rajasthan", "UP" -> "Uttar Pradesh")
 */
export function normalizeState(inputState: string): string {
  if (!inputState || !inputState.trim()) return 'Rajasthan'; // Default
  const clean = inputState.trim().toLowerCase();

  const match = OFFICIAL_INDIAN_STATES.find(
    (s) =>
      s.name.toLowerCase() === clean ||
      s.nameHi.includes(inputState.trim()) ||
      s.id === clean
  );
  if (match) return match.name;

  if (clean.includes('raj') || clean.includes('राज')) return 'Rajasthan';
  if (clean.includes('pun') || clean.includes('पंज')) return 'Punjab';
  if (clean.includes('har') || clean.includes('हरि')) return 'Haryana';
  if (clean.includes('uttar p') || clean.includes('u.p') || clean.includes('up') || clean.includes('उत्तर')) return 'Uttar Pradesh';
  if (clean.includes('madhya') || clean.includes('m.p') || clean.includes('mp') || clean.includes('मध्य')) return 'Madhya Pradesh';
  if (clean.includes('guj') || clean.includes('गुज')) return 'Gujarat';
  if (clean.includes('mah') || clean.includes('महा')) return 'Maharashtra';
  if (clean.includes('bih') || clean.includes('बिहा')) return 'Bihar';
  if (clean.includes('kar') || clean.includes('कर्ना')) return 'Karnataka';
  if (clean.includes('tam') || clean.includes('तमिल')) return 'Tamil Nadu';
  if (clean.includes('andhra') || clean.includes('आंध्र')) return 'Andhra Pradesh';
  if (clean.includes('bengal') || clean.includes('बंगाल')) return 'West Bengal';

  return 'Rajasthan';
}

/**
 * Format timing nicely without fabricating exact dates
 * Example: "September (Late)" -> "Late September"
 */
function formatTimingDisplay(timing: string | undefined, monthName: string): string {
  if (!timing || timing === 'Normal') return monthName;
  return `${timing} ${monthName}`;
}

/**
 * Core query function used by both Web UI and Gemini Live Tool
 */
export async function getCropCalendar(query: CropCalendarQuery): Promise<CropCalendarResult> {
  const normState = normalizeState(query.state);
  const targetMonth = Math.min(Math.max(Number(query.month) || new Date().getMonth() + 1, 1), 12);
  const monthName = MONTH_NAMES[targetMonth - 1];
  const monthNameHi = MONTH_NAMES_HI[targetMonth - 1];
  const targetCrop = query.crop?.trim().toLowerCase() || null;
  const targetPhase = query.phase || 'all';

  const cacheKey = `crop-calendar:${normState}:${targetMonth}:${targetCrop || 'all'}:${targetPhase}`;
  const cached = cropCalendarCache.get<CropCalendarResult>(cacheKey);

  if (cached && !cached.isStale) {
    return { ...cached.data, isCached: true };
  }

  // Attempt live UPAg API if credentials are configured
  let liveApiUsed = false;
  if (upagApiClient.hasAuth()) {
    const liveResp = await upagApiClient.fetchLiveCropData({ state: normState });
    if (liveResp.success) {
      liveApiUsed = true;
    }
  }

  // Retrieve records from official UPAg dataset
  let stateRecords = UPAG_DOMESTIC_CROP_CALENDAR.filter(
    (r) => r.state.toLowerCase() === normState.toLowerCase()
  );

  // If specific state records not yet present, fall back to National Reference Calendar
  if (stateRecords.length === 0) {
    stateRecords = UPAG_DOMESTIC_CROP_CALENDAR.filter((r) => r.state === 'All India');
  }

  // Filter by crop search query if provided
  if (targetCrop) {
    stateRecords = stateRecords.filter(
      (r) =>
        r.crop.toLowerCase().includes(targetCrop) ||
        r.localName.toLowerCase().includes(targetCrop) ||
        r.primaryCategory.toLowerCase().includes(targetCrop)
    );
  }

  const sowingItems: CropCalendarPhaseItem[] = [];
  const growingItems: CropCalendarPhaseItem[] = [];
  const harvestingItems: CropCalendarPhaseItem[] = [];

  for (const record of stateRecords) {
    const monthData: MonthPhaseDetail | undefined = record.months[targetMonth];
    if (!monthData || monthData.phase === 'off') continue;

    const item: CropCalendarPhaseItem = {
      id: record.id,
      crop: record.crop,
      localName: record.localName,
      season: record.season,
      primaryCategory: record.primaryCategory,
      phase: monthData.phase,
      timing: monthData.timing,
      timingDisplay: formatTimingDisplay(monthData.timing, monthName),
      sowingWindow: record.sowingWindow,
      growingWindow: record.growingWindow,
      harvestingWindow: record.harvestingWindow,
      source: record.source,
    };

    if (monthData.phase === 'sowing') {
      sowingItems.push(item);
    } else if (monthData.phase === 'growing') {
      growingItems.push(item);
    } else if (monthData.phase === 'harvesting') {
      harvestingItems.push(item);
    }
  }

  // Filter phases if requested
  const filteredSowing = targetPhase === 'all' || targetPhase === 'sowing' ? sowingItems : [];
  const filteredGrowing = targetPhase === 'all' || targetPhase === 'growing' ? growingItems : [];
  const filteredHarvesting = targetPhase === 'all' || targetPhase === 'harvesting' ? harvestingItems : [];

  const totalCrops = filteredSowing.length + filteredGrowing.length + filteredHarvesting.length;

  const stateObj = OFFICIAL_INDIAN_STATES.find((s) => s.name === normState);

  // Generate concise, natural AI spoken summary for Gemini Live
  let aiVoiceSummary = '';
  if (totalCrops === 0) {
    aiVoiceSummary = `${normState} के लिए ${monthNameHi} महीने में UPAg के सामान्य फसल कैलेंडर में कोई फसल इस चरण में दर्ज नहीं है।`;
  } else {
    const sowNames = filteredSowing.map((c) => c.localName.split(' ')[0]).slice(0, 3).join(', ');
    const harvNames = filteredHarvesting.map((c) => c.localName.split(' ')[0]).slice(0, 3).join(', ');

    const parts: string[] = [];
    if (sowNames) parts.push(`बुवाई के लिए: ${sowNames}`);
    if (harvNames) parts.push(`कटाई के लिए: ${harvNames}`);

    aiVoiceSummary = `${normState} में ${monthNameHi} के UPAg फसल कैलेंडर के अनुसार ${parts.join('; ')} की जानकारी है। यह एक सामान्य संदर्भ कैलेंडर है।`;
  }

  const result: CropCalendarResult = {
    success: true,
    state: normState,
    stateHi: stateObj?.nameHi || normState,
    month: targetMonth,
    monthName,
    monthNameHi,
    phases: {
      sowing: filteredSowing,
      growing: filteredGrowing,
      harvesting: filteredHarvesting,
    },
    totalCrops,
    source: 'General crop calendar (UPAg / ICAR & Indian Horticulture Database - 2014)',
    dataNote: 'General crop calendar information. Data may vary by local conditions, variety and agricultural practice.',
    isCached: true,
    liveApiUsed,
    aiVoiceSummary,
  };

  // Cache result for 1 hour
  cropCalendarCache.set(cacheKey, result, 3600);

  return result;
}

/**
 * Get annual 12-month timeline for a single crop
 */
export function getCropDetails(state: string, cropName: string): CropTimelineResponse | null {
  const normState = normalizeState(state);
  const cleanCrop = cropName.trim().toLowerCase();

  let record = UPAG_DOMESTIC_CROP_CALENDAR.find(
    (r) =>
      r.state.toLowerCase() === normState.toLowerCase() &&
      (r.crop.toLowerCase().includes(cleanCrop) || r.localName.toLowerCase().includes(cleanCrop))
  );

  if (!record) {
    record = UPAG_DOMESTIC_CROP_CALENDAR.find(
      (r) =>
        r.crop.toLowerCase().includes(cleanCrop) ||
        r.localName.toLowerCase().includes(cleanCrop)
    );
  }

  if (!record) return null;

  const timeline = [];
  for (let m = 1; m <= 12; m++) {
    const detail = record.months[m];
    timeline.push({
      month: m,
      monthName: MONTH_NAMES[m - 1],
      monthNameHi: MONTH_NAMES_HI[m - 1],
      phase: detail?.phase || 'off',
      timing: detail?.timing,
    });
  }

  return {
    success: true,
    crop: record.crop,
    localName: record.localName,
    state: record.state,
    season: record.season,
    primaryCategory: record.primaryCategory,
    sowingWindow: record.sowingWindow,
    growingWindow: record.growingWindow,
    harvestingWindow: record.harvestingWindow,
    timeline,
    source: record.source,
    dataNote: 'General crop calendar information. Data may vary by local conditions, variety and agricultural practice.',
  };
}

/**
 * Return all verified Indian States & UTs
 */
export function getAvailableStates() {
  return OFFICIAL_INDIAN_STATES;
}

/**
 * Return all available crops for a given state from UPAg dataset
 */
export function getStateCrops(state: string) {
  const normState = normalizeState(state);
  let stateRecords = UPAG_DOMESTIC_CROP_CALENDAR.filter(
    (r) => r.state.toLowerCase() === normState.toLowerCase()
  );
  if (stateRecords.length === 0) {
    stateRecords = UPAG_DOMESTIC_CROP_CALENDAR.filter((r) => r.state === 'All India');
  }

  return stateRecords.map((r) => ({
    id: r.id,
    crop: r.crop,
    localName: r.localName,
    season: r.season,
    primaryCategory: r.primaryCategory,
    sowingWindow: r.sowingWindow,
    harvestingWindow: r.harvestingWindow,
  }));
}

