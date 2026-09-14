import React from 'react';
import { CropCard } from './CropCard';
import type { CropCalendarItem, CropPhase } from '../../types/cropCalendar';

interface CropPhaseSectionProps {
  phase: CropPhase;
  title: string;
  titleHi: string;
  icon: string;
  subtitle: string;
  subtitleHi: string;
  items: CropCalendarItem[];
  onClickDetails: (item: CropCalendarItem) => void;
  onAskAI: (item: CropCalendarItem, e: React.MouseEvent) => void;
  isHindi?: boolean;
}

export const CropPhaseSection: React.FC<CropPhaseSectionProps> = ({
  phase,
  title,
  titleHi,
  icon,
  subtitle,
  subtitleHi,
  items,
  onClickDetails,
  onAskAI,
  isHindi = true,
}) => {
  const count = items.length;

  return (
    <section className={`crop-phase-section phase-${phase}`} aria-label={title}>
      <div className="phase-section-header">
        <div className="phase-title-group">
          <span className="phase-icon" role="img" aria-hidden="true">
            {icon}
          </span>
          <div className="phase-texts">
            <h3 className="phase-main-title">
              {isHindi ? titleHi : title}
              <span className="phase-count-badge">{count}</span>
            </h3>
            <p className="phase-subtitle-text">
              {isHindi ? subtitleHi : subtitle}
            </p>
          </div>
        </div>
      </div>

      {count > 0 ? (
        <div className="crop-cards-grid">
          {items.map((item) => (
            <CropCard
              key={item.id}
              item={item}
              onClickDetails={onClickDetails}
              onAskAI={onAskAI}
              isHindi={isHindi}
            />
          ))}
        </div>
      ) : (
        <div className="phase-empty-state">
          <span className="empty-leaf-icon">🍃</span>
          <p className="empty-text">
            {isHindi
              ? `इस महीने इस चरण में कोई फसल दर्ज नहीं है`
              : `No crops currently in ${phase} phase this month`}
          </p>
        </div>
      )}
    </section>
  );
};
