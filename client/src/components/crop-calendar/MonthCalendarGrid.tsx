import React from 'react';
import type { MonthTimelineItem } from '../../types/cropCalendar';

interface MonthCalendarGridProps {
  year: number;
  month: number; // 1 to 12
  sowingDetail?: MonthTimelineItem | null;
  cropName?: string;
  isHindi?: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const WEEKDAYS_HI = ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'];
const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTH_NAMES_HI = [
  'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर',
];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MonthCalendarGrid: React.FC<MonthCalendarGridProps> = ({
  year,
  month,
  sowingDetail,
  cropName,
  isHindi = true,
  onPrevMonth,
  onNextMonth,
}) => {
  const now = new Date();
  const todayDay = now.getDate();
  const todayMonth = now.getMonth() + 1;
  const todayYear = now.getFullYear();

  // First day of current month: 0 (Sun) to 6 (Sat)
  const firstDayRaw = new Date(year, month - 1, 1).getDay();
  // Adjust so Monday is index 0, Sunday is index 6
  const startDayIndex = firstDayRaw === 0 ? 6 : firstDayRaw - 1;

  // Number of days in current month
  const totalDays = new Date(year, month, 0).getDate();

  // Number of days in previous month for padding
  const prevMonthTotalDays = new Date(year, month - 1, 0).getDate();

  const isSowingMonth = Boolean(sowingDetail && sowingDetail.phase === 'sowing');
  const sTiming = sowingDetail?.timing?.toLowerCase() || '';

  // Helper to determine if a specific day falls into the sowing timing window
  const isDaySowing = (dayNum: number): boolean => {
    if (!isSowingMonth) return false;
    if (sTiming.includes('early') || sTiming.includes('beginning')) {
      return dayNum <= 15;
    }
    if (sTiming.includes('middle') && !sTiming.includes('late')) {
      return dayNum >= 8 && dayNum <= 22;
    }
    if (sTiming.includes('late')) {
      return dayNum >= 15;
    }
    return true; // Whole month
  };

  // Build calendar cells (35 or 42 cells)
  const cells: Array<{
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSowing: boolean;
    isViewingCrop?: boolean;
    phase?: 'sowing' | 'growing' | 'harvesting';
    otherCrops?: Array<{ name: string; phase: 'sowing' | 'growing' | 'harvesting' }>;
  }> = [];

  // Previous month padding days
  for (let i = startDayIndex - 1; i >= 0; i--) {
    const d = prevMonthTotalDays - i;
    cells.push({
      dayNumber: d,
      isCurrentMonth: false,
      isToday: false,
      isSowing: false,
    });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const isToday = d === todayDay && month === todayMonth && year === todayYear;
    const isSowing = isDaySowing(d);

    cells.push({
      dayNumber: d,
      isCurrentMonth: true,
      isToday,
      isSowing,
    });
  }

  // Next month padding days to complete row
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    cells.push({
      dayNumber: d,
      isCurrentMonth: false,
      isToday: false,
      isSowing: false,
    });
  }

  const weekdays = isHindi ? WEEKDAYS_HI : WEEKDAYS_EN;
  const monthName = isHindi ? MONTH_NAMES_HI[month - 1] : MONTH_NAMES_EN[month - 1];
  const monthTitle = `${monthName} ${year}`;

  return (
    <div className="farmer-calendar-container">
      {/* 1. Month Navigation Header */}
      <div className="calendar-nav-header">
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={onPrevMonth}
          aria-label={isHindi ? 'पिछला महीना' : 'Previous month'}
        >
          ‹ {isHindi ? 'पिछला' : 'Previous'}
        </button>

        <h3 className="calendar-month-title">{monthTitle}</h3>

        <button
          type="button"
          className="calendar-nav-btn"
          onClick={onNextMonth}
          aria-label={isHindi ? 'अगला महीना' : 'Next month'}
        >
          {isHindi ? 'अगला' : 'Next'} ›
        </button>
      </div>

      {/* 2. Month Sowing Indicator Message */}
      <div
        className={`calendar-month-status-banner ${
          isSowingMonth ? 'status-sowing' : 'status-not-sowing'
        }`}
      >
        {isSowingMonth ? (
          <span>
            ✓ {isHindi
              ? `${cropName ? `${cropName} ` : 'यह फसल '}इस महीने सामान्यतः बोई जाती है${sowingDetail?.timing ? ` (${sowingDetail.timing})` : ''}।`
              : `${cropName ? `${cropName} is ` : 'This crop is '}normally sown this month${sowingDetail?.timing ? ` (${sowingDetail.timing})` : ''}.`}
          </span>
        ) : (
          <span>
            {isHindi
              ? `इस महीने ${cropName ? `${cropName} की ` : ''}सामान्य बुवाई नहीं होती।`
              : `This is not the typical sowing month for ${cropName || 'this crop'}.`}
          </span>
        )}
      </div>

      {/* 3. Normal Clean 7-Column Calendar Grid */}
      <div className="farmer-calendar-table-wrap">
        <table className="farmer-calendar-table">
          <thead>
            <tr>
              {weekdays.map((w, idx) => (
                <th key={idx} className="calendar-th">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.ceil(cells.length / 7) }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {cells.slice(rowIndex * 7, rowIndex * 7 + 7).map((cell, colIndex) => {
                  const classes = [
                    'calendar-td',
                    cell.isCurrentMonth ? 'in-month' : 'out-month',
                    cell.isSowing ? 'sowing-day' : '',
                    cell.isToday ? 'today-day' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <td key={colIndex} className={classes}>
                      <span className="calendar-date-number">
                        {cell.dayNumber}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. Simple Single Legend */}
      <div className="farmer-calendar-legend">
        <span className="legend-green-swatch" aria-hidden="true" />
        <span className="legend-text">
          {isHindi ? 'सामान्य बुवाई का समय' : 'Normal Sowing Period'}
        </span>
      </div>
    </div>
  );
};
