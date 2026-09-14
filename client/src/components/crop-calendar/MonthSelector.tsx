import React, { useRef, useEffect } from 'react';

interface MonthSelectorProps {
  selectedMonth: number; // 1 to 12
  onSelectMonth: (month: number) => void;
  isHindi?: boolean;
}

const MONTHS = [
  { num: 1, name: 'January', nameHi: 'जनवरी' },
  { num: 2, name: 'February', nameHi: 'फरवरी' },
  { num: 3, name: 'March', nameHi: 'मार्च' },
  { num: 4, name: 'April', nameHi: 'अप्रैल' },
  { num: 5, name: 'May', nameHi: 'मई' },
  { num: 6, name: 'June', nameHi: 'जून' },
  { num: 7, name: 'July', nameHi: 'जुलाई' },
  { num: 8, name: 'August', nameHi: 'अगस्त' },
  { num: 9, name: 'September', nameHi: 'सितंबर' },
  { num: 10, name: 'October', nameHi: 'अक्टूबर' },
  { num: 11, name: 'November', nameHi: 'नवंबर' },
  { num: 12, name: 'December', nameHi: 'दिसंबर' },
];

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  selectedMonth,
  onSelectMonth,
  isHindi = true,
}) => {
  const currentDeviceMonth = new Date().getMonth() + 1; // 1-12
  const currentYear = new Date().getFullYear();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const activeMonthObj = MONTHS[selectedMonth - 1] || MONTHS[8];

  const handlePrev = () => {
    const next = selectedMonth === 1 ? 12 : selectedMonth - 1;
    onSelectMonth(next);
  };

  const handleNext = () => {
    const next = selectedMonth === 12 ? 1 : selectedMonth + 1;
    onSelectMonth(next);
  };

  // Auto-scroll selected month into view smoothly
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector(
        `[data-month="${selectedMonth}"]`
      ) as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedMonth]);

  return (
    <div className="month-selector-wrapper">
      {/* Header bar showing: 📅 September 2026 with ‹ and › */}
      <div className="month-navigation-header">
        <button
          type="button"
          className="month-nav-arrow-btn"
          onClick={handlePrev}
          aria-label="Previous month"
          title="Previous month"
        >
          ‹
        </button>

        <div className="month-header-title">
          <span className="month-calendar-icon">📅</span>
          <span className="month-header-text">
            {isHindi ? activeMonthObj.nameHi : activeMonthObj.name} {currentYear}
          </span>
          {selectedMonth === currentDeviceMonth && (
            <span className="current-month-badge">
              {isHindi ? 'वर्तमान महीना' : 'Current'}
            </span>
          )}
        </div>

        <button
          type="button"
          className="month-nav-arrow-btn"
          onClick={handleNext}
          aria-label="Next month"
          title="Next month"
        >
          ›
        </button>
      </div>

      {/* Horizontal Month Chips Carousel */}
      <div className="month-chips-carousel" ref={scrollContainerRef}>
        {MONTHS.map((m) => {
          const isSelected = m.num === selectedMonth;
          const isCurrent = m.num === currentDeviceMonth;

          return (
            <button
              key={m.num}
              type="button"
              data-month={m.num}
              className={`month-chip-btn ${isSelected ? 'selected' : ''} ${
                isCurrent ? 'is-device-month' : ''
              }`}
              onClick={() => onSelectMonth(m.num)}
            >
              <span className="month-chip-name">{isHindi ? m.nameHi : m.name}</span>
              {isCurrent && <span className="month-chip-dot" title="Current month" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
