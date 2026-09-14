import React, { useState, useRef, useEffect } from 'react';
import type { StateOption } from '../../types/cropCalendar';

interface StateSelectorProps {
  selectedState: string;
  onSelectState: (state: string) => void;
  states: StateOption[];
  isHindi?: boolean;
}

export const StateSelector: React.FC<StateSelectorProps> = ({
  selectedState,
  onSelectState,
  states,
  isHindi = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredStates = states.filter((s) => {
    const q = search.toLowerCase().trim();
    return s.name.toLowerCase().includes(q) || s.nameHi.includes(search.trim());
  });

  const activeStateObj = states.find(
    (s) => s.name.toLowerCase() === selectedState.toLowerCase()
  );

  const displayStateName = isHindi
    ? (activeStateObj?.nameHi ? `${activeStateObj.nameHi} (${activeStateObj.name})` : selectedState)
    : (activeStateObj?.name || selectedState);

  return (
    <div className="simple-selector-field" ref={dropdownRef}>
      <label className="simple-field-label" id="state-select-label">
        {isHindi ? 'अपना राज्य' : 'Select State'}
      </label>

      <button
        type="button"
        className={`simple-select-box ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby="state-select-label"
      >
        <span className="select-box-value">{displayStateName}</span>
        <span className="select-box-chevron" aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div className="simple-dropdown-menu" role="listbox">
          <div className="simple-search-row">
            <input
              ref={searchInputRef}
              type="text"
              className="simple-search-input"
              placeholder={isHindi ? 'राज्य खोजें...' : 'Search state...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="simple-clear-search-btn"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="simple-options-scroll">
            {filteredStates.length > 0 ? (
              filteredStates.map((s) => {
                const isSelected = s.name.toLowerCase() === selectedState.toLowerCase();
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`simple-option-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectState(s.name);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="option-name-primary">
                      {isHindi && s.nameHi ? s.nameHi : s.name}
                    </span>
                    <span className="option-name-secondary">
                      {isHindi ? s.name : s.nameHi}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="simple-options-empty">
                {isHindi ? 'कोई राज्य नहीं मिला' : 'No state found'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
