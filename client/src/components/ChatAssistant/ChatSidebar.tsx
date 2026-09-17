// ================================================================
// ChatSidebar.tsx — Simple, quiet sidebar. No category clutter.
// Shows: Logo | New Chat | Search | Recent Chats | Help & Settings
// ================================================================

import { useState, useEffect, useRef } from 'react';
import type { Conversation } from '../../services/conversationStore';
import {
  listConversations,
  deleteConversation,
  renameConversation,
  searchConversations,
} from '../../services/conversationStore';

interface ChatSidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  isOpen: boolean;
  onClose: () => void;
}

function formatDate(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 86400000) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function SidebarContent({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onClose,
}: Omit<ChatSidebarProps, 'isOpen'>) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    setConversations(search.trim() ? searchConversations(search) : listConversations());
  };

  useEffect(() => { refresh(); }, [search, activeConversationId]);

  useEffect(() => {
    if (renamingId) renameRef.current?.focus();
  }, [renamingId]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this conversation?')) {
      deleteConversation(id);
      refresh();
      if (activeConversationId === id) onNewConversation();
    }
  };

  const handleRenameSubmit = () => {
    if (renamingId && renameValue.trim()) {
      renameConversation(renamingId, renameValue.trim());
      refresh();
    }
    setRenamingId(null);
  };

  const selectAndClose = (id: string) => {
    onSelectConversation(id);
    onClose();
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-100">

      {/* ── Header ── */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-base">🏛️</span>
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 leading-tight">Gram Sathi</div>
            <div className="text-[10px] text-slate-400 font-medium leading-tight">Government Services AI</div>
          </div>
        </div>
        {/* Close on mobile */}
        <button
          onClick={onClose}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── New Chat ── */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={() => { onNewConversation(); onClose(); }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-semibold transition-all duration-150 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* ── Search ── */}
      <div className="px-3 pb-2">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:border-green-400 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer text-sm leading-none">×</button>
          )}
        </div>
      </div>

      {/* ── Recent Chats ── */}
      <div className="flex-1 overflow-y-auto px-2">
        <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase px-2 mb-1.5">
          Recent Chats
        </p>

        {conversations.length === 0 ? (
          <div className="px-2 py-6 text-center text-slate-400 text-xs leading-relaxed">
            {search ? 'No chats found.' : 'No chats yet.\nTap "+ New Chat" to start.'}
          </div>
        ) : (
          <div className="space-y-0.5">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => selectAndClose(conv.id)}
                className={`group relative flex flex-col gap-0.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-100 ${
                  activeConversationId === conv.id
                    ? 'bg-green-50 border border-green-200'
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                {renamingId === conv.id ? (
                  <input
                    ref={renameRef}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRenameSubmit();
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                    className="w-full text-xs bg-white border border-green-300 rounded px-1.5 py-0.5 text-slate-800 focus:outline-none"
                  />
                ) : (
                  <span className={`text-xs font-medium leading-snug truncate pr-8 ${
                    activeConversationId === conv.id ? 'text-green-800' : 'text-slate-700'
                  }`}>
                    {conv.title}
                  </span>
                )}
                <span className="text-[10px] text-slate-400">{formatDate(conv.updatedAt)}</span>

                {renamingId !== conv.id && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={e => { e.stopPropagation(); setRenamingId(conv.id); setRenameValue(conv.title); }}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-400 cursor-pointer"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={e => handleDelete(e, conv.id)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-3 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Never asks for OTP or Aadhaar</span>
        </div>
      </div>
    </div>
  );
}

export function ChatSidebar({ isOpen, onClose, ...rest }: ChatSidebarProps) {
  return (
    <>
      {/* Desktop: persistent */}
      <aside className="hidden lg:flex flex-col w-60 xl:w-64 flex-shrink-0 h-full">
        <SidebarContent {...rest} onClose={onClose} />
      </aside>

      {/* Mobile: overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <aside className="relative w-64 h-full flex-shrink-0 flex flex-col shadow-2xl">
            <SidebarContent {...rest} onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
