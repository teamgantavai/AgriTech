import React, { useState, useRef, useEffect } from 'react';
import type { CropOption } from '../../services/cropCalendarClient';

interface CropSelectorProps {
  selectedCrop: CropOption | null;
  onSelectCrop: (crop: CropOption) => void;
  crops: CropOption[];
  isHindi?: boolean;
}

export const CropSelector: React.FC<CropSelectorProps> = ({
  selectedCrop,
  onSelectCrop,
  crops,
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

  const filteredCrops = crops.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.crop.toLowerCase().includes(q) ||
      c.localName.toLowerCase().includes(q) ||
      c.season.toLowerCase().includes(q)
    );
  });

  const getCleanEnglishName = (cropStr: string) => cropStr.split('(')[0].trim();

  const displayCropName = selectedCrop
    ? (isHindi
        ? (selectedCrop.localName
            ? `${selectedCrop.localName} (${getCleanEnglishName(selectedCrop.crop)})`
            : selectedCrop.crop)
        : selectedCrop.crop)
    : (isHindi ? 'फसल चुनें...' : 'Select crop...');

  return (
    <div className="simple-selector-field" ref={dropdownRef}>
      <label className="simple-field-label" id="crop-select-label">
        {isHindi ? 'फसल चुनें' : 'Select Crop'}
      </label>

      <button
        type="button"
        className={`simple-select-box ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby="crop-select-label"
      >
        <span className="select-box-value">{displayCropName}</span>
        <span className="select-box-chevron" aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div className="simple-dropdown-menu" role="listbox">
          <div className="simple-search-row">
            <input
              ref={searchInputRef}
              type="text"
              className="simple-search-input"
              placeholder={isHindi ? 'गेहूं खोजें...' : 'Search crop (e.g. Wheat)...'}
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
            {filteredCrops.length > 0 ? (
              filteredCrops.map((c) => {
                const isSelected = selectedCrop?.id === c.id;
                const cleanEn = getCleanEnglishName(c.crop);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`simple-option-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectCrop(c);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="option-name-primary">
                      {isHindi && c.localName ? c.localName : c.crop}
                    </span>
                    <span className="option-name-secondary">
                      {isHindi ? cleanEn : c.localName} · {c.season}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="simple-options-empty">
                {isHindi ? 'कोई फसल नहीं मिली' : 'No crop found'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
