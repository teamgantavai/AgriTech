// ================================================================
// FindSchemesModal.tsx — Guided "Find Schemes for Me" questionnaire
// One simple question at a time. No government jargon.
// ================================================================

import { useState } from 'react';

interface FindSchemesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (searchQuery: string) => void;
}

const STATES = [
  'Punjab',
  'Haryana',
  'Uttar Pradesh',
  'Rajasthan',
  'Bihar',
  'Madhya Pradesh',
  'Maharashtra',
  'Gujarat',
  'Karnataka',
  'Tamil Nadu',
  'Telangana',
  'Andhra Pradesh',
  'West Bengal',
  'All India / Central',
];

const OCCUPATIONS = [
  { label: '🌾 Farmer', value: 'Farmer' },
  { label: '🎓 Student', value: 'Student' },
  { label: '💼 Worker', value: 'Daily Wage / Worker' },
  { label: '🏪 Business Owner', value: 'Small Business / Shopkeeper' },
  { label: '👩 Homemaker', value: 'Homemaker' },
  { label: '👴 Senior / Retired', value: 'Senior Citizen' },
  { label: '🔧 Other', value: 'Self-employed / Other' },
];

const HELP_TYPES = [
  { label: '💰 Money / Loan', value: 'Loan & Financial assistance' },
  { label: '🎓 Education / Scholarship', value: 'Scholarships & Education help' },
  { label: '🌾 Farming Subsidies', value: 'Farming subsidies and crop support' },
  { label: '🏠 Home / Housing', value: 'Housing support and PMAY' },
  { label: '💼 Job or Business', value: 'Employment and business setup' },
  { label: '🏥 Health & Hospital', value: 'Health insurance and free treatment' },
  { label: '📄 Certificates & Papers', value: 'Government certificates & documents' },
  { label: '🚜 Machinery & Equipment', value: 'Equipment subsidy and solar pump' },
];

export function FindSchemesModal({ isOpen, onClose, onSubmit }: FindSchemesModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedState, setSelectedState] = useState('');
  const [selectedOccupation, setSelectedOccupation] = useState('');
  const [selectedHelp, setSelectedHelp] = useState('');

  if (!isOpen) return null;

  const handleFinish = () => {
    const query = `I am a ${selectedOccupation || 'citizen'} living in ${selectedState || 'India'} and I need help with ${selectedHelp || 'government schemes'}. Which government schemes, subsidies, or benefits can I apply for?`;
    onClose();
    setStep(1);
    setSelectedState('');
    setSelectedOccupation('');
    setSelectedHelp('');
    onSubmit(query);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar & Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s === step ? 'w-8 bg-green-600' : s < step ? 'w-4 bg-green-200' : 'w-4 bg-slate-200'
                }`}
              />
            ))}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Step 1: State */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-green-700 tracking-wider uppercase">Step 1 of 3</span>
              <h2 className="text-xl font-bold text-slate-800 mt-1">Which state do you live in?</h2>
              <p className="text-xs text-slate-500">Government schemes vary by state.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {STATES.map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedState(st)}
                  className={`p-3 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer ${
                    selectedState === st
                      ? 'border-green-600 bg-green-50 text-green-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-green-300'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                disabled={!selectedState}
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all cursor-pointer"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Occupation */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-green-700 tracking-wider uppercase">Step 2 of 3</span>
              <h2 className="text-xl font-bold text-slate-800 mt-1">What do you do?</h2>
              <p className="text-xs text-slate-500">Select what best describes your primary work.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {OCCUPATIONS.map((occ) => (
                <button
                  key={occ.value}
                  onClick={() => setSelectedOccupation(occ.value)}
                  className={`p-3 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer ${
                    selectedOccupation === occ.value
                      ? 'border-green-600 bg-green-50 text-green-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-green-300'
                  }`}
                >
                  {occ.label}
                </button>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
              >
                ← Back
              </button>
              <button
                disabled={!selectedOccupation}
                onClick={() => setStep(3)}
                className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all cursor-pointer"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Help Type */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-green-700 tracking-wider uppercase">Step 3 of 3</span>
              <h2 className="text-xl font-bold text-slate-800 mt-1">What kind of help do you need?</h2>
              <p className="text-xs text-slate-500">Tell us your main goal.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {HELP_TYPES.map((ht) => (
                <button
                  key={ht.value}
                  onClick={() => setSelectedHelp(ht.value)}
                  className={`p-3 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer ${
                    selectedHelp === ht.value
                      ? 'border-green-600 bg-green-50 text-green-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-green-300'
                  }`}
                >
                  {ht.label}
                </button>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
              >
                ← Back
              </button>
              <button
                disabled={!selectedHelp}
                onClick={handleFinish}
                className="px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Find My Schemes →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
