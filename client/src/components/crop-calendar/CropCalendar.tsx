import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StateSelector } from './StateSelector';
import { CropSelector } from './CropSelector';
import { MonthCalendarGrid } from './MonthCalendarGrid';
import {
  fetchStatesList,
  fetchStateCrops,
  fetchCropDetails,
  getSavedState,
  saveState,
  type CropOption,
} from '../../services/cropCalendarClient';
import type {
  CropDetailsResponse,
  StateOption,
} from '../../types/cropCalendar';
import './cropCalendar.css';

interface CropCalendarProps {
  onOpenVoiceAssistant: (cropName?: string, stateName?: string, monthNum?: number) => void;
  isHindi?: boolean;
  languageCode?: string;
}

const AI_BUTTON_LABELS: Record<string, string> = {
  hi: 'AI से बोलकर पूछें',
  en: 'Ask AI by Voice',
  pa: 'AI ਨੂੰ ਬੋਲ ਕੇ ਪੁੱਛੋ',
  mr: 'AI ला बोलून विचारा',
  gu: 'AI ને બોલીને પૂછો',
  bn: 'AI কে মুখে বলুন',
  te: 'AI తో మాట్లాడి అడగండి',
  ta: 'AI யிடம் பேசி கேளுங்கள்',
  kn: 'AI ಜೊತೆ ಮಾತನಾಡಿ ಕೇಳಿ',
  ml: 'AI യോട് സംസാരിക്കുക',
  or: 'AI କୁ କହିକି ପଚାରନ୍ତୁ',
  ur: 'AI سے بول کر پوچھیں',
  as: 'AI ক মাত মাতি সোধক',
};

export function getCleanEnglishName(cropStr: string): string {
  if (!cropStr) return '';
  let clean = cropStr.split('(')[0].trim();
  if (clean.includes('/')) {
    clean = clean.split('/')[0].trim();
  }
  return clean;
}

export function getCropIcon(cropName: string, localName: string): string {
  const text = (cropName + ' ' + localName).toLowerCase();
  if (text.includes('wheat') || text.includes('गेहूं') || text.includes('gahu') || text.includes('kanak')) return '🌾';
  if (text.includes('rice') || text.includes('धान') || text.includes('paddy') || text.includes('jhona') || text.includes('bhat') || text.includes('bhatta')) return '🌾';
  if (text.includes('bajra') || text.includes('बाजरा') || text.includes('millet')) return '🌾';
  if (text.includes('jowar') || text.includes('ज्वार') || text.includes('sorghum')) return '🌾';
  if (text.includes('ragi') || text.includes('रागी')) return '🌾';
  if (text.includes('barley') || text.includes('जौ') || text.includes('jau')) return '🌾';
  if (text.includes('maize') || text.includes('मक्का') || text.includes('makka') || text.includes('corn') || text.includes('bhutta')) return '🌽';
  if (text.includes('mustard') || text.includes('सरसों') || text.includes('rai') || text.includes('toria') || text.includes('sorshe')) return '🌼';
  if (text.includes('cotton') || text.includes('कपास') || text.includes('narma') || text.includes('kapas') || text.includes('paruthi') || text.includes('patti')) return '☁️';
  if (text.includes('sugarcane') || text.includes('गन्ना') || text.includes('us') || text.includes('karumbu') || text.includes('cheraku')) return '🎋';
  if (text.includes('potato') || text.includes('आलू') || text.includes('alu')) return '🥔';
  if (text.includes('onion') || text.includes('प्याज') || text.includes('pyaj') || text.includes('kanda') || text.includes('dungli')) return '🧅';
  if (text.includes('garlic') || text.includes('लहसुन') || text.includes('lahsun')) return '🧄';
  if (text.includes('groundnut') || text.includes('मूंगफली') || text.includes('peanut') || text.includes('kadalekayi')) return '🥜';
  if (text.includes('gram') || text.includes('चना') || text.includes('chana') || text.includes('chhole') || text.includes('harbara') || text.includes('kadale') || text.includes('sanaga')) return '🫘';
  if (text.includes('moong') || text.includes('मूंग')) return '🫘';
  if (text.includes('masoor') || text.includes('मसूर') || text.includes('lentil')) return '🫘';
  if (text.includes('tur') || text.includes('arhar') || text.includes('अरहर') || text.includes('तुअर') || text.includes('togari') || text.includes('kandi')) return '🫘';
  if (text.includes('urad') || text.includes('उड़द') || text.includes('ulundu')) return '🫘';
  if (text.includes('soybean') || text.includes('सोयाबीन')) return '🫘';
  if (text.includes('cumin') || text.includes('जीरा') || text.includes('jeera')) return '🌿';
  if (text.includes('coriander') || text.includes('धनिया') || text.includes('dhaniya')) return '🌿';
  if (text.includes('fennel') || text.includes('सौंफ') || text.includes('saunf')) return '🌿';
  if (text.includes('isabgol') || text.includes('ईसबगोल')) return '🌿';
  if (text.includes('sunflower') || text.includes('सूरजमुखी')) return '🌻';
  if (text.includes('guar') || text.includes('ग्वार') || text.includes('cluster')) return '🌱';
  if (text.includes('banana') || text.includes('केला')) return '🍌';
  if (text.includes('chilli') || text.includes('मिर्च')) return '🌶️';
  if (text.includes('jute') || text.includes('जूट') || text.includes('pat')) return '🌱';
  return '🌱';
}

export function getSeasonBadge(season: string, isHindi = true): { label: string; icon: string; className: string } {
  const s = season.toLowerCase();
  if (s.includes('kharif')) {
    return {
      label: isHindi ? 'खरीफ' : 'Kharif',
      icon: '🌧️',
      className: 'season-badge-kharif',
    };
  }
  if (s.includes('rabi')) {
    return {
      label: isHindi ? 'रबी' : 'Rabi',
      icon: '❄️',
      className: 'season-badge-rabi',
    };
  }
  if (s.includes('zaid') || s.includes('summer')) {
    return {
      label: isHindi ? 'जायद' : 'Zaid',
      icon: '☀️',
      className: 'season-badge-zaid',
    };
  }
  return {
    label: isHindi ? 'वार्षिक' : 'Annual',
    icon: '🌱',
    className: 'season-badge-annual',
  };
}

const MONTH_MAP_HI: Record<string, string> = {
  January: 'जनवरी',
  February: 'फरवरी',
  March: 'मार्च',
  April: 'अप्रैल',
  May: 'मई',
  June: 'जून',
  July: 'जुलाई',
  August: 'अगस्त',
  September: 'सितंबर',
  October: 'अक्टूबर',
  November: 'नवंबर',
  December: 'दिसंबर',
};

/**
 * Formats complex date windows into crystal-clear, friendly text
 * Example: "October (Late) – December (Beginning)" -> "अक्टूबर से दिसंबर"
 * Example: "July (Early) – July (Late)" -> "जुलाई"
 */
export function formatSuperSimpleWindow(text?: string, isHindi = true): string {
  if (!text || !text.trim()) return '—';

  // Handle dual-season text e.g. "October & February–March"
  if (text.includes('&')) {
    const parts = text.split('&');
    return parts.map((p) => formatSuperSimpleWindow(p.trim(), isHindi)).join(isHindi ? ' एवं ' : ' & ');
  }

  const matches = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi);
  if (!matches || matches.length === 0) {
    // If no month matched, return clean text without brackets
    return text.replace(/[()]/g, '').trim();
  }

  const normalized = matches.map((m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
  const uniqueMonths = Array.from(new Set(normalized));

  if (uniqueMonths.length === 1) {
    const m = uniqueMonths[0];
    return isHindi ? (MONTH_MAP_HI[m] || m) : m;
  }

  const firstMonth = uniqueMonths[0];
  const lastMonth = uniqueMonths[uniqueMonths.length - 1];

  if (isHindi) {
    const m1 = MONTH_MAP_HI[firstMonth] || firstMonth;
    const m2 = MONTH_MAP_HI[lastMonth] || lastMonth;
    return `${m1} से ${m2}`;
  } else {
    return `${firstMonth} to ${lastMonth}`;
  }
}

export const CropCalendar: React.FC<CropCalendarProps> = ({
  onOpenVoiceAssistant,
  isHindi = true,
  languageCode = 'hi',
}) => {
  const today = new Date();
  const [selectedState, setSelectedState] = useState<string>(getSavedState);
  // Default to the user's actual current month and year
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [statesList, setStatesList] = useState<StateOption[]>([]);
  const [cropsList, setCropsList] = useState<CropOption[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<CropOption | null>(null);
  const [cropDetails, setCropDetails] = useState<CropDetailsResponse | null>(null);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load available states once
  useEffect(() => {
    fetchStatesList().then(setStatesList);
  }, []);

  // Sync state change
  const handleStateChange = useCallback((newState: string) => {
    setSelectedState(newState);
    saveState(newState);
  }, []);

  // Fetch crops whenever selectedState changes
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchStateCrops(selectedState)
      .then((crops) => {
        if (!active) return;
        setCropsList(crops);
        setLoading(false);

        if (crops.length > 0) {
          // Keep current crop if available in new state, otherwise pick first
          const matching = crops.find(
            (c) =>
              c.crop.toLowerCase() === selectedCrop?.crop.toLowerCase() ||
              c.localName.toLowerCase() === selectedCrop?.localName.toLowerCase()
          );
          setSelectedCrop(matching || crops[0]);
        } else {
          setSelectedCrop(null);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error('[CropCalendar] Error loading state crops:', err);
        setError(
          isHindi
            ? 'फसल कैलेंडर की जानकारी अभी उपलब्ध नहीं है।'
            : 'Crop calendar information is temporarily unavailable.'
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedState, isHindi]);

  // Fetch 12-month details whenever selectedCrop or state changes
  useEffect(() => {
    if (!selectedCrop) {
      setCropDetails(null);
      return;
    }

    let active = true;
    fetchCropDetails(selectedState, selectedCrop.crop)
      .then((details) => {
        if (active && details) {
          setCropDetails(details);
        }
      })
      .catch((err) => {
        console.warn('[CropCalendar] fetchCropDetails error:', err);
      });

    return () => {
      active = false;
    };
  }, [selectedState, selectedCrop]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Sowing details for currently viewed month
  const currentMonthSowing = useMemo(() => {
    if (!cropDetails?.timeline) return null;
    return (
      cropDetails.timeline.find(
        (m) => m.month === viewMonth && m.phase === 'sowing'
      ) || null
    );
  }, [cropDetails, viewMonth]);

  const aiButtonLabel = AI_BUTTON_LABELS[languageCode] || (isHindi ? '🎙️ AI से पूछें' : '🎙️ Ask AI');

  const cropTitle = selectedCrop
    ? (isHindi && selectedCrop.localName ? selectedCrop.localName : selectedCrop.crop)
    : '';

  const cropSecondaryTitle = selectedCrop
    ? (isHindi ? selectedCrop.crop : selectedCrop.localName)
    : '';

  const seasonText = selectedCrop
    ? (selectedCrop.season ? `${selectedCrop.season} फसल` : '')
    : '';

  const activeStateObj = statesList.find(
    (s) => s.name.toLowerCase() === selectedState.toLowerCase()
  );

  const stateDisplayName = isHindi
    ? (activeStateObj?.nameHi || selectedState)
    : (activeStateObj?.name || selectedState);

  return (
    <div className="farmer-crop-calendar-page">
      {/* 1. Simple Page Header */}
      <header className="farmer-page-header">
        <h1 className="farmer-page-title">
          {isHindi ? 'फसल कैलेंडर' : 'Crop Calendar'}
        </h1>
        <p className="farmer-page-subtitle">
          {isHindi
            ? 'अपनी फसल चुनें और बुवाई का सही समय देखें।'
            : 'Select your crop and see the recommended sowing period.'}
        </p>
      </header>

      {/* 2. Selection Area (State + Crop) */}
      <div className="farmer-selectors-grid">
        <StateSelector
          selectedState={selectedState}
          onSelectState={handleStateChange}
          states={statesList}
          isHindi={isHindi}
        />

        <CropSelector
          selectedCrop={selectedCrop}
          onSelectCrop={setSelectedCrop}
          crops={cropsList}
          isHindi={isHindi}
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="farmer-loading-box">
          <span>{isHindi ? 'फसल की जानकारी लोड हो रही है...' : 'Loading crop information...'}</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="farmer-error-box">
          <p>{error}</p>
          <button
            type="button"
            className="farmer-retry-btn"
            onClick={() => handleStateChange(selectedState)}
          >
            {isHindi ? 'फिर से कोशिश करें' : 'Try again'}
          </button>
        </div>
      )}

      {!loading && !error && selectedCrop && (
        <>
          {/* 3. Normal Familiar Calendar */}
          <MonthCalendarGrid
            year={viewYear}
            month={viewMonth}
            sowingDetail={currentMonthSowing}
            cropName={cropTitle}
            isHindi={isHindi}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
          />

          {/* 4. Professional High-Impact AI Voice Action Button */}
          <div className="farmer-voice-action-container">
            <button
              type="button"
              id="crop-calendar-ask-ai-btn"
              className="farmer-voice-cta-btn modern-ai-pill"
              onClick={() => onOpenVoiceAssistant(selectedCrop.crop, selectedState, viewMonth)}
              title={aiButtonLabel}
            >
              <div className="voice-mic-glow-circle" aria-hidden="true">
                <svg
                  className="voice-mic-svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
              <span className="voice-btn-text">{aiButtonLabel}</span>
              <div className="voice-live-badge" aria-hidden="true">
                <span className="voice-live-dot" />
                <span className="voice-live-text">Live Voice</span>
              </div>
            </button>
            <p className="voice-btn-helper">
              {isHindi
                ? 'माइक दबाएं और अपनी भाषा में किसी भी फसल के बारे में तुरंत पूछें'
                : 'Tap microphone to ask questions about any crop in your language'}
            </p>
          </div>

          {/* 6. State Major Crops: Clean, Simple & Responsive Schedule */}
          {cropsList.length > 0 && (
            <section className="farmer-state-crops-section">
              <div className="state-crops-section-header">
                <div className="state-crops-header-text">
                  <h3 className="state-crops-title">
                    {isHindi
                      ? `${stateDisplayName} की मुख्य फसलें: कब बोएं और कब काटें`
                      : `Major Crops of ${stateDisplayName}: When to Sow & Cut`}
                  </h3>
                  <p className="state-crops-subtitle">
                    {isHindi
                      ? 'सरल गाइड: अपनी फसल देखें — सही बोने का समय और काटने का समय:'
                      : 'Simple guide: See when each major crop is sown and harvested:'}
                  </p>
                </div>
                <div className="state-crops-count-badge">
                  {cropsList.length} {isHindi ? 'फसलें' : 'Crops'}
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="state-crops-table-wrap">
                <table className="state-crops-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>{isHindi ? 'फसल' : 'Crop'}</th>
                      <th style={{ width: '16%' }}>{isHindi ? 'मौसम' : 'Season'}</th>
                      <th style={{ width: '26%' }}>
                        <span className="th-icon-label">🌱 {isHindi ? 'बोने का समय (बुवाई)' : 'When to Sow'}</span>
                      </th>
                      <th style={{ width: '26%' }}>
                        <span className="th-icon-label">🌾 {isHindi ? 'काटने का समय (कटाई)' : 'When to Cut'}</span>
                      </th>
                      <th style={{ width: '14%', textAlign: 'center' }}>{isHindi ? 'कैलेंडर' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cropsList.map((c) => {
                      const isSelected = selectedCrop?.id === c.id;
                      const cropNameHi = c.localName || c.crop;
                      const cleanEn = getCleanEnglishName(c.crop);
                      const icon = getCropIcon(c.crop, c.localName);
                      const seasonInfo = getSeasonBadge(c.season, isHindi);
                      const sowSimple = formatSuperSimpleWindow(c.sowingWindow, isHindi);
                      const harvSimple = formatSuperSimpleWindow(c.harvestingWindow, isHindi);

                      return (
                        <tr key={c.id} className={isSelected ? 'is-active-crop-row' : ''}>
                          <td className="crop-name-cell">
                            <div className="crop-cell-flex">
                              <span className="crop-cell-icon" aria-hidden="true">{icon}</span>
                              <div className="crop-cell-names">
                                <span className="cell-crop-primary">
                                  {isHindi ? cropNameHi : cleanEn}
                                </span>
                                {isHindi && cleanEn.toLowerCase() !== cropNameHi.toLowerCase() && (
                                  <span className="cell-crop-secondary">{cleanEn}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="crop-season-cell">
                            <span className={`cell-season-badge ${seasonInfo.className}`}>
                              <span className="badge-icon">{seasonInfo.icon}</span>
                              <span>{seasonInfo.label}</span>
                            </span>
                          </td>
                          <td className="crop-sowing-cell">
                            <div className="simple-time-pill sow-pill">
                              <span className="pill-dot green-dot" />
                              <span className="pill-time-val">{sowSimple}</span>
                            </div>
                          </td>
                          <td className="crop-harvest-cell">
                            <div className="simple-time-pill harvest-pill">
                              <span className="pill-dot amber-dot" />
                              <span className="pill-time-val">{harvSimple}</span>
                            </div>
                          </td>
                          <td className="crop-action-cell" style={{ textAlign: 'center' }}>
                            {isSelected ? (
                              <span className="crop-selected-tag">
                                ✓ {isHindi ? 'सक्रिय' : 'Active'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="crop-switch-btn"
                                onClick={() => {
                                  setSelectedCrop(c);
                                  window.scrollTo({ top: 120, behavior: 'smooth' });
                                }}
                                title={isHindi ? `${cropNameHi} का कैलेंडर देखें` : `View ${cleanEn} calendar`}
                              >
                                {isHindi ? 'देखें 📅' : 'View 📅'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Grid Box (< 768px) */}
              <div className="state-crops-mobile-cards">
                {cropsList.map((c) => {
                  const isSelected = selectedCrop?.id === c.id;
                  const cropNameHi = c.localName || c.crop;
                  const cleanEn = getCleanEnglishName(c.crop);
                  const icon = getCropIcon(c.crop, c.localName);
                  const seasonInfo = getSeasonBadge(c.season, isHindi);
                  const sowSimple = formatSuperSimpleWindow(c.sowingWindow, isHindi);
                  const harvSimple = formatSuperSimpleWindow(c.harvestingWindow, isHindi);

                  return (
                    <div
                      key={c.id}
                      className={`state-crop-card-item ${isSelected ? 'selected-card' : ''}`}
                      onClick={() => {
                        setSelectedCrop(c);
                        window.scrollTo({ top: 120, behavior: 'smooth' });
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedCrop(c);
                          window.scrollTo({ top: 120, behavior: 'smooth' });
                        }
                      }}
                    >
                      <div className="card-top-row">
                        <div className="card-crop-ident">
                          <span className="card-crop-emoji">{icon}</span>
                          <div className="card-crop-titles">
                            <span className="card-crop-title">
                              {isHindi ? cropNameHi : cleanEn}
                            </span>
                            {isHindi && cleanEn.toLowerCase() !== cropNameHi.toLowerCase() && (
                              <span className="card-crop-sub">{cleanEn}</span>
                            )}
                          </div>
                        </div>
                        <span className={`cell-season-badge ${seasonInfo.className}`}>
                          <span className="badge-icon">{seasonInfo.icon}</span>
                          <span className="badge-text">{seasonInfo.label}</span>
                        </span>
                      </div>

                      <div className="card-timings-grid">
                        <div className="card-timing-item sow-item">
                          <span className="timing-label">
                            🌱 {isHindi ? 'बुवाई:' : 'Sow:'}
                          </span>
                          <span className="timing-value sowing-val">
                            {sowSimple}
                          </span>
                        </div>
                        <div className="card-timing-item cut-item">
                          <span className="timing-label">
                            🌾 {isHindi ? 'कटाई:' : 'Cut:'}
                          </span>
                          <span className="timing-value harvesting-val">
                            {harvSimple}
                          </span>
                        </div>
                      </div>

                      <div className="card-action-row">
                        {isSelected ? (
                          <span className="card-selected-label">
                            ✓ {isHindi ? 'चुना गया' : 'Selected'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="card-select-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCrop(c);
                              window.scrollTo({ top: 120, behavior: 'smooth' });
                            }}
                          >
                            📅 {isHindi ? 'देखें' : 'View'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 7. Subtle Source Citation & Disclaimer */}
          <footer className="farmer-calendar-footer">
            <p className="farmer-source-text">
              {isHindi
                ? 'स्रोत: UPAg / ICAR'
                : 'Source: UPAg / ICAR'}
            </p>
            <p className="farmer-disclaimer-text">
              {isHindi
                ? 'यह सामान्य फसल कैलेंडर की जानकारी है। स्थानीय मौसम और कृषि सलाह के अनुसार समय बदल सकता है।'
                : 'General crop calendar information. Timing may vary based on local weather and agricultural advisories.'}
            </p>
          </footer>
        </>
      )}
    </div>
  );
};
