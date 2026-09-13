import { useState, useRef, useEffect } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Search, ChevronDown, Building2, BookOpen, Landmark, Shield, Users, MessageSquareWarning } from 'lucide-react';
import { Conversation } from '../../types';
import { useTranslation } from '../../context/LanguageContext';
import { clsx } from 'clsx';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onCategorySelect: (question: string) => void;
  isOpen: boolean;
  onClose?: () => void;
}

const CATEGORY_ITEMS = [
  { id: 'pacs', key: 'pacs', icon: Building2, color: 'green', sample: 'How to become a member of PACS?' },
  { id: 'laws', key: 'laws', icon: BookOpen, color: 'blue', sample: 'What are member voting rights in cooperatives?' },
  { id: 'schemes', key: 'schemes', icon: Landmark, color: 'amber', sample: 'What government subsidies are available for farmers?' },
  { id: 'pmfby', key: 'pmfby', icon: Shield, color: 'purple', sample: 'What is PMFBY crop insurance and premium rates?' },
  { id: 'finance', key: 'finance', icon: Users, color: 'teal', sample: 'How to apply for Kisan Credit Card (KCC)?' },
  { id: 'grievance', key: 'grievance', icon: MessageSquareWarning, color: 'red', sample: 'How to file a complaint against cooperative society?' },
];

export function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onCategorySelect,
  isOpen,
  onClose,
}: SidebarProps) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showCategories, setShowCategories] = useState(true);
  const editInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (id: string, title: string) => {
    setEditingId(id);
    setEditValue(title);
  };

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      onRenameConversation(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const handleConversationClick = (id: string) => {
    onSelectConversation(id);
    if (window.innerWidth < 768 && onClose) {
      onClose();
    }
  };

  const handleNewConversationClick = () => {
    onNewConversation();
    if (window.innerWidth < 768 && onClose) {
      onClose();
    }
  };

  const handleCategoryClick = (title: string) => {
    onCategorySelect(title);
    if (window.innerWidth < 768 && onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'fixed md:static inset-y-0 left-0 z-50 md:z-auto flex flex-col bg-white border-r border-neutral-200 transition-all duration-300 overflow-hidden shadow-xl md:shadow-none',
          isOpen
            ? 'w-72 max-w-[85vw] md:w-64 md:min-w-[16rem] translate-x-0'
            : '-translate-x-full md:translate-x-0 md:w-0'
        )}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Mobile header close button & New chat button */}
          <div className="p-3 border-b border-neutral-100 flex items-center gap-2">
            <button
              onClick={handleNewConversationClick}
              className="btn-primary flex-1 text-xs font-semibold py-2.5 shadow-sm"
            >
              <Plus size={15} />
              <span>{t('chat.newChat', 'New Conversation')}</span>
            </button>

            {/* Mobile close sidebar icon */}
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
              title="Close sidebar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-neutral-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" size={13} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('chat.recentChats', 'Search conversations...')}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length > 0 ? (
              <div className="p-2 space-y-0.5">
                <div className="px-2 py-1 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  {t('chat.recentChats', 'Saved Conversations')}
                </div>
                {filtered.map(conv => (
                  <div
                    key={conv.id}
                    className={clsx(
                      'group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all',
                      conv.id === activeConversationId
                        ? 'bg-brand-50 text-brand-800 font-semibold shadow-soft'
                        : 'hover:bg-neutral-50 text-neutral-700 font-medium',
                    )}
                    onClick={() => handleConversationClick(conv.id)}
                  >
                    <MessageSquare size={13} className={conv.id === activeConversationId ? 'text-brand-600' : 'text-neutral-400'} />

                    {editingId === conv.id ? (
                      <input
                        ref={editInputRef}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                        onBlur={commitEdit}
                        onClick={e => e.stopPropagation()}
                        className="flex-1 min-w-0 text-xs bg-white border border-brand-400 rounded px-1 focus:outline-none"
                      />
                    ) : (
                      <span className="flex-1 min-w-0 text-xs truncate leading-snug">{conv.title}</span>
                    )}

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      {editingId === conv.id ? (
                        <>
                          <button onClick={commitEdit} className="p-0.5 hover:text-brand-700 rounded"><Check size={11} /></button>
                          <button onClick={() => setEditingId(null)} className="p-0.5 hover:text-red-600 rounded"><X size={11} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(conv.id, conv.title)} className="p-0.5 hover:text-neutral-700 rounded text-neutral-400"><Edit2 size={11} /></button>
                          <button onClick={() => onDeleteConversation(conv.id)} className="p-0.5 hover:text-red-600 rounded text-neutral-400"><Trash2 size={11} /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-neutral-400">
                {t('chat.emptyHistory', 'No previous conversations')}
              </div>
            )}
          </div>

          {/* Quick Topics */}
          <div className="border-t border-neutral-100 p-3 bg-neutral-50/70">
            <button
              onClick={() => setShowCategories(v => !v)}
              className="flex items-center justify-between w-full text-xs font-bold text-neutral-600 hover:text-neutral-900 mb-2"
            >
              <span>{t('nav.services', 'Services')}</span>
              <ChevronDown size={13} className={clsx('transition-transform duration-150', !showCategories && '-rotate-90')} />
            </button>

            {showCategories && (
              <div className="space-y-1">
                {CATEGORY_ITEMS.map(cat => {
                  const title = t(`services.${cat.key}.title`, cat.key);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryClick(title)}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-medium text-neutral-600 hover:bg-white hover:text-brand-700 hover:shadow-soft transition-all truncate block"
                      title={title}
                    >
                      {title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
