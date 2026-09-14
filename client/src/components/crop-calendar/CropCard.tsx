import React from 'react';
import type { CropCalendarItem } from '../../types/cropCalendar';

interface CropCardProps {
  item: CropCalendarItem;
  onClickDetails: (item: CropCalendarItem) => void;
  onAskAI: (item: CropCalendarItem, e: React.MouseEvent) => void;
  isHindi?: boolean;
}

/**
 * Get visual icon for crops
 */
function getCropIcon(cropName: string): string {
  const lower = cropName.toLowerCase();
  if (lower.includes('wheat') || lower.includes('गेहूं')) return '🌾';
  if (lower.includes('rice') || lower.includes('paddy') || lower.includes('धान')) return '🌾';
  if (lower.includes('bajra') || lower.includes('बाजरा')) return '🌾';
  if (lower.includes('mustard') || lower.includes('सरसों') || lower.includes('rai')) return '🌻';
  if (lower.includes('cotton') || lower.includes('कपास')) return '☁️';
  if (lower.includes('gram') || lower.includes('chana') || lower.includes('चना')) return '🌱';
  if (lower.includes('soybean') || lower.includes('सोयाबीन')) return '🫘';
  if (lower.includes('sugarcane') || lower.includes('गन्ना')) return '🎋';
  if (lower.includes('potato') || lower.includes('आलू')) return '🥔';
  if (lower.includes('onion') || lower.includes('प्याज')) return '🧅';
  if (lower.includes('tomato') || lower.includes('टमाटर')) return '🍅';
  if (lower.includes('chill') || lower.includes('मिर्च')) return '🌶️';
  if (lower.includes('maize') || lower.includes('मक्का')) return '🌽';
  if (lower.includes('groundnut') || lower.includes('मूंगफली')) return '🥜';
  return '🌱';
}

export const CropCard: React.FC<CropCardProps> = ({
  item,
  onClickDetails,
  onAskAI,
  isHindi = true,
}) => {
  const icon = getCropIcon(item.crop);

  return (
    <div
      className="crop-card"
      onClick={() => onClickDetails(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClickDetails(item);
        }
      }}
      aria-label={`View details for ${item.crop}`}
    >
      <div className="crop-card-header">
        <span className="crop-card-icon">{icon}</span>
        <div className="crop-card-names">
          <h4 className="crop-name-en">{item.crop}</h4>
          <span className="crop-name-hi">{item.localName}</span>
        </div>
        <span className="crop-season-badge">{item.season}</span>
      </div>

      <div className="crop-card-body">
        {item.timingDisplay && (
          <div className="crop-timing-pill">
            <span className="timing-bullet">●</span>
            <span className="timing-text">{item.timingDisplay}</span>
          </div>
        )}

        <div className="crop-category-tag">
          {item.primaryCategory}
        </div>
      </div>

      <div className="crop-card-footer">
        <span className="tap-details-hint">
          {isHindi ? 'विवरण देखें →' : 'Details →'}
        </span>

        <button
          type="button"
          className="ask-ai-crop-btn"
          onClick={(e) => {
            e.stopPropagation();
            onAskAI(item, e);
          }}
          title={isHindi ? `${item.crop} के बारे में AI से पूछें` : `Ask AI about ${item.crop}`}
        >
          <span className="ai-btn-icon">🎙️</span>
          <span className="ai-btn-text">{isHindi ? 'पूछें' : 'Ask AI'}</span>
        </button>
      </div>
    </div>
  );
};
