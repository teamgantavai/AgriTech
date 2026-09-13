import { Sprout, ArrowRight, Building2, BookOpen, Landmark, Shield, Users, MessageSquareWarning } from 'lucide-react';
import { useLanguage, useTranslation } from '../../context/LanguageContext';
import { clsx } from 'clsx';

const SERVICE_ITEMS = [
  { id: 'pacs', key: 'pacs', icon: Building2, color: 'green', q: 'How to become a member of PACS?' },
  { id: 'laws', key: 'laws', icon: BookOpen, color: 'blue', q: 'What are member voting rights in cooperatives?' },
  { id: 'schemes', key: 'schemes', icon: Landmark, color: 'amber', q: 'What government subsidies are available for farmers?' },
  { id: 'pmfby', key: 'pmfby', icon: Shield, color: 'purple', q: 'What is PMFBY crop insurance and premium rates?' },
  { id: 'finance', key: 'finance', icon: Users, color: 'teal', q: 'How to apply for Kisan Credit Card (KCC)?' },
  { id: 'grievance', key: 'grievance', icon: MessageSquareWarning, color: 'red', q: 'How to file a complaint against cooperative society?' },
];

const COLOR_CLASSES: Record<string, { card: string; icon: string }> = {
  green: { card: 'hover:border-green-300 hover:bg-green-50/50', icon: 'bg-green-100 text-green-700' },
  blue: { card: 'hover:border-blue-300 hover:bg-blue-50/50', icon: 'bg-blue-100 text-blue-700' },
  amber: { card: 'hover:border-amber-300 hover:bg-amber-50/50', icon: 'bg-amber-100 text-amber-700' },
  purple: { card: 'hover:border-purple-300 hover:bg-purple-50/50', icon: 'bg-purple-100 text-purple-700' },
  teal: { card: 'hover:border-teal-300 hover:bg-teal-50/50', icon: 'bg-teal-100 text-teal-700' },
  red: { card: 'hover:border-red-300 hover:bg-red-50/50', icon: 'bg-red-100 text-red-700' },
};

interface WelcomeScreenProps {
  onQuestionClick: (q: string) => void;
}

export function WelcomeScreen({ onQuestionClick }: WelcomeScreenProps) {
  const { t, tArray } = useTranslation();
  const { language } = useLanguage();

  const suggestedQuestions = tArray('chat.quickQuestions');

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">

        {/* Greeting */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold mb-3 shadow-soft">
            <Sprout size={13} />
            <span>{t('app.name', 'Sahkar Sathi')} · {t('app.nativeName', 'सहकार साथी')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 leading-tight">
            {t('chat.welcomeTitle', 'How can we help you today?')}
          </h1>
          <p className="text-neutral-500 text-sm leading-relaxed max-w-lg mx-auto">
            {t('chat.welcomeSubtitle', 'Ask anything about cooperative societies, PACS, PMFBY crop insurance, or government schemes. Type or speak in your preferred language.')}
          </p>
        </div>

        {/* Service Categories */}
        <div>
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
            {t('nav.services', 'Services')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SERVICE_ITEMS.map(item => {
              const Icon = item.icon;
              const colors = COLOR_CLASSES[item.color] ?? COLOR_CLASSES.green;
              const title = t(`services.${item.key}.title`, item.key);
              const desc = t(`services.${item.key}.desc`, '');

              return (
                <button
                  key={item.id}
                  onClick={() => onQuestionClick(title)}
                  className={clsx(
                    'group text-left p-3.5 rounded-xl border border-neutral-200 bg-white transition-all duration-150',
                    colors.card,
                    'hover:shadow-card focus:outline-none focus:ring-2 focus:ring-brand-500 flex flex-col justify-between'
                  )}
                >
                  <div>
                    <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mb-2.5', colors.icon)}>
                      <Icon size={16} />
                    </div>
                    <div className="font-bold text-neutral-900 text-xs leading-snug">{title}</div>
                    <div className="text-neutral-500 text-[11px] mt-1 leading-snug line-clamp-2">{desc}</div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-brand-700 font-semibold mt-2.5">
                    <span>Ask</span>
                    <ArrowRight size={11} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Suggested Questions */}
        {suggestedQuestions.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
              {t('chat.quickQuestionsTitle', 'Suggested Questions')}
            </h2>
            <div className="space-y-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => onQuestionClick(q)}
                  className="group w-full text-left flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-neutral-200 bg-white hover:border-brand-300 hover:bg-brand-50/50 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-soft"
                >
                  <span className="text-sm text-neutral-800 font-medium leading-snug">{q}</span>
                  <ArrowRight size={14} className="text-neutral-400 group-hover:text-brand-600 flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Trust Note / Disclaimer */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-center">
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            {t('chat.disclaimer', 'Sahkar Sathi provides informational guidance based on verified records. Please verify with official portals for formal legal or financial filings.')}
          </p>
        </div>
      </div>
    </div>
  );
}
