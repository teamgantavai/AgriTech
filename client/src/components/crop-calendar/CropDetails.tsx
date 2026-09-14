import React, { useEffect, useState } from 'react';
import type { CropCalendarItem, CropDetailsResponse } from '../../types/cropCalendar';
import { fetchCropDetails } from '../../services/cropCalendarClient';

interface CropDetailsProps {
  item: CropCalendarItem;
  state: string;
  onClose: () => void;
  onAskAI: (cropName: string) => void;
  isHindi?: boolean;
}

export const CropDetails: React.FC<CropDetailsProps> = ({
  item,
  state,
  onClose,
  onAskAI,
  isHindi = true,
}) => {
  const [details, setDetails] = useState<CropDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchCropDetails(state, item.crop)
      .then((data) => {
        if (active) {
          setDetails(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [state, item.crop]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="crop-details-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="crop-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-crop-icon">🌾</span>
            <div>
              <h2 className="modal-crop-title">{item.crop}</h2>
              <span className="modal-crop-sub">{item.localName}</span>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close details"
          >
            ✕
          </button>
        </div>

        <div className="modal-body-scroll">
          {/* State & Season Pill Bar */}
          <div className="modal-meta-pills">
            <span className="meta-pill state-pill">📍 {state}</span>
            <span className="meta-pill season-pill">🗓️ {item.season}</span>
            <span className="meta-pill category-pill">🏷️ {item.primaryCategory}</span>
          </div>

          {/* Sowing, Growing, Harvesting Windows */}
          <div className="lifecycle-windows-card">
            <div className="lifecycle-step sowing-step">
              <div className="step-icon">🌱</div>
              <div className="step-content">
                <span className="step-label">{isHindi ? 'बुवाई (Sowing)' : 'Sowing'}</span>
                <span className="step-value">{item.sowingWindow || 'Seasonal'}</span>
              </div>
            </div>

            <div className="lifecycle-step growing-step">
              <div className="step-icon">🌿</div>
              <div className="step-content">
                <span className="step-label">{isHindi ? 'बढ़वार (Growing)' : 'Growing'}</span>
                <span className="step-value">{item.growingWindow || 'Seasonal'}</span>
              </div>
            </div>

            <div className="lifecycle-step harvesting-step">
              <div className="step-icon">🌾</div>
              <div className="step-content">
                <span className="step-label">{isHindi ? 'कटाई (Harvesting)' : 'Harvesting'}</span>
                <span className="step-value">{item.harvestingWindow || 'Seasonal'}</span>
              </div>
            </div>
          </div>

          {/* 12-Month Annual Visual Timeline */}
          {loading ? (
            <div className="timeline-loading-state">
              <span>🌾 {isHindi ? 'कैलेंडर लोड हो रहा है...' : 'Loading annual timeline...'}</span>
            </div>
          ) : details?.timeline ? (
            <div className="annual-timeline-section">
              <h4 className="timeline-title">
                📅 {isHindi ? 'वार्षिक फसल चक्र (12 महीने)' : 'Annual Crop Cycle (12 Months)'}
              </h4>
              <div className="timeline-grid">
                {details.timeline.map((m) => {
                  let phaseClass = 'phase-off';
                  let phaseBadge = '—';
                  if (m.phase === 'sowing') {
                    phaseClass = 'phase-sow';
                    phaseBadge = isHindi ? 'बुवाई' : 'Sow';
                  } else if (m.phase === 'growing') {
                    phaseClass = 'phase-grow';
                    phaseBadge = isHindi ? 'बढ़वार' : 'Grow';
                  } else if (m.phase === 'harvesting') {
                    phaseClass = 'phase-harv';
                    phaseBadge = isHindi ? 'कटाई' : 'Harvest';
                  }

                  return (
                    <div key={m.month} className={`timeline-month-box ${phaseClass}`}>
                      <span className="t-month-name">
                        {isHindi ? m.monthNameHi.slice(0, 3) : m.monthName.slice(0, 3)}
                      </span>
                      <span className="t-phase-tag">{phaseBadge}</span>
                      {m.timing && <span className="t-timing-tag">{m.timing}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Source Attribution & Official Disclaimer */}
          <div className="modal-source-card">
            <div className="source-row">
              <span className="source-label">{isHindi ? 'डेटा स्रोत:' : 'Data Source:'}</span>
              <span className="source-value">
                UPAg (Unified Portal for Agricultural Statistics) / ICAR & Indian Horticulture Database
              </span>
            </div>
            <div className="disclaimer-row">
              <span className="disclaimer-note">
                ⚠️ {isHindi
                  ? 'यह एक सामान्य संदर्भ फसल कैलेंडर है। वास्तविक बुवाई एवं कटाई का समय स्थानीय मौसम, बीज की किस्म, सिंचाई और कृषि सलाह के अनुसार भिन्न हो सकता है।'
                  : 'General crop calendar information. Data may vary by local conditions, variety and agricultural practice.'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer with Ask AI Button */}
        <div className="modal-footer">
          <button
            type="button"
            className="modal-ask-ai-btn"
            onClick={() => {
              onAskAI(item.crop);
              onClose();
            }}
          >
            <span className="btn-icon">🎙️</span>
            <span>
              {isHindi
                ? `${item.crop} के बारे में AI से पूछें`
                : `Ask AI about ${item.crop}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
