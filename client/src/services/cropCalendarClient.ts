// ============================================================
// Crop Calendar Client — Frontend Service Layer
// Single Source of Truth fetching from /api/crop-calendar
// ============================================================

import type { CropCalendarResponse, CropDetailsResponse, StateOption } from '../types/cropCalendar';

const CLIENT_CACHE = new Map<string, { data: CropCalendarResponse; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes local client cache

let activeAbortController: AbortController | null = null;

const STATE_STORAGE_KEY = 'gram_sathi_selected_state';
const DEFAULT_STATE = 'Rajasthan';

/**
 * Get persisted state from localStorage
 */
export function getSavedState(): string {
  try {
    const saved = localStorage.getItem(STATE_STORAGE_KEY);
    return saved && saved.trim() ? saved.trim() : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

/**
 * Save user selected state to localStorage
 */
export function saveState(state: string): void {
  try {
    if (state && state.trim()) {
      localStorage.setItem(STATE_STORAGE_KEY, state.trim());
    }
  } catch {
    // localStorage unavailable
  }
}

/**
 * Fetch crop calendar for given state, month, and optional crop query
 * Aborts any pending request when state or month changes.
 */
export async function fetchCropCalendar(
  state: string,
  month: number,
  crop?: string | null,
  phase?: string
): Promise<CropCalendarResponse> {
  const normState = state.trim() || DEFAULT_STATE;
  const cacheKey = `${normState}:${month}:${crop?.trim().toLowerCase() || ''}:${phase || 'all'}`;

  const cached = CLIENT_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Cancel previous in-flight request to handle rapid clicks
  if (activeAbortController) {
    activeAbortController.abort();
  }
  activeAbortController = new AbortController();

  const params = new URLSearchParams({
    state: normState,
    month: String(month),
  });

  if (crop && crop.trim()) {
    params.set('crop', crop.trim());
  }
  if (phase && phase !== 'all') {
    params.set('phase', phase);
  }

  try {
    const resp = await fetch(`/api/crop-calendar?${params.toString()}`, {
      signal: activeAbortController.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!resp.ok) {
      throw new Error(`Failed to load crop calendar: ${resp.status}`);
    }

    const data: CropCalendarResponse = await resp.json();
    CLIENT_CACHE.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      // Re-throw or ignore aborts
      throw err;
    }
    console.error('[cropCalendarClient] Fetch error:', err);
    throw err;
  }
}

/**
 * Fetch verified Indian states list
 */
export async function fetchStatesList(): Promise<StateOption[]> {
  try {
    const resp = await fetch('/api/crop-calendar/states');
    if (resp.ok) {
      const data = await resp.json();
      return data.states || [];
    }
  } catch (err) {
    console.warn('[cropCalendarClient] fetchStatesList error:', err);
  }

  // Fallback state list if server endpoint temporarily offline
  return [
    { id: 'rajasthan', name: 'Rajasthan', nameHi: 'राजस्थान' },
    { id: 'punjab', name: 'Punjab', nameHi: 'पंजाब' },
    { id: 'haryana', name: 'Haryana', nameHi: 'हरियाणा' },
    { id: 'uttar-pradesh', name: 'Uttar Pradesh', nameHi: 'उत्तर प्रदेश' },
    { id: 'madhya-pradesh', name: 'Madhya Pradesh', nameHi: 'मध्य प्रदेश' },
    { id: 'gujarat', name: 'Gujarat', nameHi: 'गुजरात' },
    { id: 'maharashtra', name: 'Maharashtra', nameHi: 'महाराष्ट्र' },
    { id: 'bihar', name: 'Bihar', nameHi: 'बिहार' },
    { id: 'karnataka', name: 'Karnataka', nameHi: 'कर्नाटक' },
    { id: 'tamil-nadu', name: 'Tamil Nadu', nameHi: 'तमिलनाडु' },
    { id: 'andhra-pradesh', name: 'Andhra Pradesh', nameHi: 'आंध्र प्रदेश' },
    { id: 'west-bengal', name: 'West Bengal', nameHi: 'पश्चिम बंगाल' },
    { id: 'all-india', name: 'All India', nameHi: 'अखिल भारतीय' },
  ];
}

/**
 * Fetch crops available for a given state
 */
export interface CropOption {
  id: string;
  crop: string;
  localName: string;
  season: string;
  primaryCategory: string;
  sowingWindow: string;
  harvestingWindow: string;
}

export async function fetchStateCrops(state: string): Promise<CropOption[]> {
  try {
    const resp = await fetch(`/api/crop-calendar/crops?state=${encodeURIComponent(state)}`);
    if (resp.ok) {
      const data = await resp.json();
      return data.crops || [];
    }
  } catch (err) {
    console.warn('[cropCalendarClient] fetchStateCrops error:', err);
  }
  return [];
}

/**
 * Fetch annual 12-month timeline for a crop
 */
export async function fetchCropDetails(state: string, crop: string): Promise<CropDetailsResponse | null> {
  try {
    const params = new URLSearchParams({ state, crop });
    const resp = await fetch(`/api/crop-calendar/crop-details?${params.toString()}`);
    if (resp.ok) {
      const data = await resp.json();
      return data.details || null;
    }
  } catch (err) {
    console.error('[cropCalendarClient] fetchCropDetails error:', err);
  }
  return null;
}
