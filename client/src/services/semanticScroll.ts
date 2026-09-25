// ================================================================
// semanticScroll.ts — Semantic Page Scrolling & Section Registry
// Controls AI-driven smooth scrolling, section highlighting,
// user scroll conflict detection, and page structure extraction.
// ================================================================

import { eventBus } from './eventBus';

export interface PageSectionInfo {
  id: string;
  title: string;
  element?: HTMLElement;
}

export interface PageStructure {
  page: string;
  sections: PageSectionInfo[];
}

export interface ScrollOptions {
  behavior?: ScrollBehavior;
  reason?: string;
  highlight?: boolean;
  highlightDurationMs?: number;
}

// Canonical section aliases for forgiving voice matching
const SECTION_ALIASES: Record<string, string> = {
  overview: 'overview',
  about: 'overview',
  intro: 'overview',
  introduction: 'overview',
  details: 'overview',
  what_is_it: 'overview',
  whatisit: 'overview',
  'what-is-it': 'overview',

  benefits: 'benefits',
  benefit: 'benefits',
  what_you_get: 'benefits',
  whatyouget: 'benefits',
  'what-you-get': 'benefits',
  financial_assistance: 'benefits',
  assistance: 'benefits',
  subsidy: 'benefits',
  fayde: 'benefits',
  laabh: 'benefits',

  eligibility: 'eligibility',
  eligible: 'eligibility',
  criteria: 'eligibility',
  who_can_get: 'eligibility',
  whocanget: 'eligibility',
  'who-can-get': 'eligibility',
  patrata: 'eligibility',

  documents: 'documents',
  document: 'documents',
  papers: 'documents',
  what_papers: 'documents',
  whatpapers: 'documents',
  'what-papers': 'documents',
  required_documents: 'documents',
  dastavej: 'documents',
  kagaz: 'documents',

  application: 'application',
  apply: 'application',
  how_to_apply: 'application',
  howtoapply: 'application',
  'how-to-apply': 'application',
  process: 'application',
  steps: 'application',
  aavedan: 'application',

  faq: 'faq',
  faqs: 'faq',
  questions: 'faq',
  portal: 'faq',
  'official-portal': 'faq',
  official_portal: 'faq',
};

class SemanticScrollManager {
  private userScrolling = false;
  private userScrollTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentHighlightedElement: HTMLElement | null = null;
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;
  private highlightingEnabled = true;
  private lastScrolledSection: string | null = null;
  private lastScrollTime = 0;
  private pendingScrollTimeout: ReturnType<typeof setTimeout> | null = null;

  private isProgrammaticScrolling = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initUserScrollDetection();
    }
  }

  /**
   * Detects manual user scrolling across window and internal scroll containers.
   * Pauses automatic AI scrolling while the user is actively touching / scrolling.
   */
  private initUserScrollDetection() {
    const handleUserScrollAction = () => {
      if (this.isProgrammaticScrolling) return;
      this.userScrolling = true;
      if (this.userScrollTimeout) {
        clearTimeout(this.userScrollTimeout);
      }
      // Resume AI scrolling 1.5 seconds after user stops manually scrolling
      this.userScrollTimeout = setTimeout(() => {
        this.userScrolling = false;
      }, 1500);
    };

    window.addEventListener('wheel', handleUserScrollAction, { passive: true });
    window.addEventListener('touchmove', handleUserScrollAction, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) {
        handleUserScrollAction();
      }
    }, { passive: true });
  }

  /**
   * Find the actual scrolling parent element for a given element.
   * In AppShell, `<main className="overflow-y-auto">` is the scroll container.
   */
  public findScrollContainer(element: HTMLElement): HTMLElement | Window {
    // Check main element specifically if available
    const mainEl = document.querySelector('main.overflow-y-auto') as HTMLElement;
    if (mainEl && mainEl.scrollHeight > mainEl.clientHeight) {
      return mainEl;
    }

    let parent = element.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      const style = window.getComputedStyle(parent);
      const overflowY = style.overflowY;
      const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
      if (isScrollable && parent.scrollHeight > parent.clientHeight) {
        return parent;
      }
      parent = parent.parentElement;
    }

    return window;
  }

  /**
   * Retrieve all registered semantic sections on the active page.
   */
  public getRegisteredSections(): PageSectionInfo[] {
    if (typeof document === 'undefined') return [];
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-ai-section]'));
    return elements.map((el) => ({
      id: el.getAttribute('data-ai-section') || '',
      title: el.getAttribute('data-ai-title') || el.innerText.slice(0, 40) || '',
      element: el,
    })).filter((s) => Boolean(s.id));
  }

  /**
   * Returns current page structure for AI awareness.
   */
  public getPageStructure(): PageStructure {
    const sections = this.getRegisteredSections().map(({ id, title }) => ({ id, title }));
    return {
      page: document.title || 'Government Scheme',
      sections,
    };
  }

  /**
   * Resolve a section identifier using alias normalization.
   */
  public resolveSectionId(section: string): string {
    const clean = section.toLowerCase().trim().replace(/[\s_-]+/g, '_');
    return SECTION_ALIASES[clean] || SECTION_ALIASES[clean.replace(/_/g, '-')] || clean;
  }

  /**
   * Checks if an element is currently sufficiently visible within its scroll container.
   */
  public isElementSufficientlyVisible(element: HTMLElement, container: HTMLElement | Window): boolean {
    const rect = element.getBoundingClientRect();
    if (container === window) {
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      // Element is visible if top is within upper half and bottom is in view
      return rect.top >= 60 && rect.top <= windowHeight * 0.55;
    } else {
      const cRect = (container as HTMLElement).getBoundingClientRect();
      const relativeTop = rect.top - cRect.top;
      return relativeTop >= 50 && relativeTop <= (container as HTMLElement).clientHeight * 0.55;
    }
  }

  /**
   * Scroll smoothly to a semantic section.
   */
  public scrollToSection(
    sectionInput: string,
    options: ScrollOptions = {}
  ): { success: boolean; section: string; message: string } {
    if (typeof document === 'undefined') {
      return { success: false, section: sectionInput, message: 'Document not available' };
    }

    const {
      behavior = 'smooth',
      reason = 'Viewing section',
      highlight = true,
      highlightDurationMs = 1800,
    } = options;

    const normalizedId = this.resolveSectionId(sectionInput);

    // If user is actively scrolling manually, do NOT fight the user
    if (this.userScrolling) {
      console.log(`[SemanticScroll] User is manually scrolling — ignoring automatic scroll to "${normalizedId}"`);
      return {
        success: false,
        section: normalizedId,
        message: 'Paused because user is manually scrolling',
      };
    }

    // Find the target element
    let targetEl = document.querySelector<HTMLElement>(`[data-ai-section="${normalizedId}"]`);

    // Fallback: look for partial match or ID attribute
    if (!targetEl) {
      targetEl = document.querySelector<HTMLElement>(`#${normalizedId}`);
    }
    if (!targetEl) {
      const allSections = document.querySelectorAll<HTMLElement>('[data-ai-section]');
      for (const el of Array.from(allSections)) {
        const sec = (el.getAttribute('data-ai-section') || '').toLowerCase();
        if (sec.includes(normalizedId) || normalizedId.includes(sec)) {
          targetEl = el;
          break;
        }
      }
    }

    if (!targetEl) {
      console.warn(`[SemanticScroll] Section "${normalizedId}" not found on current page.`);
      return {
        success: false,
        section: normalizedId,
        message: `Section "${normalizedId}" not found on page`,
      };
    }

    const container = this.findScrollContainer(targetEl);

    // Prevent excessive jitter: don't scroll if already there recently and visible
    const now = Date.now();
    if (
      this.lastScrolledSection === normalizedId &&
      now - this.lastScrollTime < 3000 &&
      this.isElementSufficientlyVisible(targetEl, container)
    ) {
      return {
        success: true,
        section: normalizedId,
        message: `Section "${normalizedId}" is already visible`,
      };
    }

    this.lastScrolledSection = normalizedId;
    this.lastScrollTime = now;
    this.isProgrammaticScrolling = true;

    // Use container-relative scrolling combined with scrollIntoView
    try {
      if (container !== window && container instanceof HTMLElement) {
        const cRect = container.getBoundingClientRect();
        const elRect = targetEl.getBoundingClientRect();
        const offset = elRect.top - cRect.top + container.scrollTop - 90;
        container.scrollTo({ top: Math.max(0, offset), behavior });
      }
      targetEl.scrollIntoView({
        behavior,
        block: 'start',
      });
    } catch {
      targetEl.scrollIntoView({ behavior, block: 'start' });
    }

    setTimeout(() => {
      this.isProgrammaticScrolling = false;
    }, 1200);

    // Trigger subtle temporary highlight
    if (highlight && this.highlightingEnabled) {
      this.applyHighlight(targetEl, highlightDurationMs);
    }

    const title = targetEl.getAttribute('data-ai-title') || normalizedId;

    // Emit event to eventBus for UI timeline / feedback
    eventBus.emit({
      type: 'ACTION_STARTED',
      action: 'scroll_to_section',
      data: { section: normalizedId, title, reason },
      message: `Scrolled to ${title}`,
    });

    console.log(`[SemanticScroll] Scrolled to section "${normalizedId}" (${title}): ${reason}`);

    return {
      success: true,
      section: normalizedId,
      message: `Scrolled to ${title}`,
    };
  }

  /**
   * Apply a subtle temporary highlight (~1.5–2s) to the section.
   */
  private applyHighlight(element: HTMLElement, durationMs: number) {
    if (this.currentHighlightedElement) {
      this.currentHighlightedElement.classList.remove('ai-section-highlighted');
    }
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
    }

    element.classList.add('ai-section-highlighted');
    this.currentHighlightedElement = element;

    this.highlightTimer = setTimeout(() => {
      element.classList.remove('ai-section-highlighted');
      if (this.currentHighlightedElement === element) {
        this.currentHighlightedElement = null;
      }
    }, durationMs);
  }

  /**
   * Immediately cancel any ongoing highlight, scroll timeout, or active movement.
   */
  public cancelScrolling() {
    if (this.pendingScrollTimeout) {
      clearTimeout(this.pendingScrollTimeout);
      this.pendingScrollTimeout = null;
    }
    if (this.currentHighlightedElement) {
      this.currentHighlightedElement.classList.remove('ai-section-highlighted');
      this.currentHighlightedElement = null;
    }
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
      this.highlightTimer = null;
    }
    this.lastScrolledSection = null;
  }

  public setHighlightingEnabled(enabled: boolean) {
    this.highlightingEnabled = enabled;
  }

  public isHighlightingEnabled(): boolean {
    return this.highlightingEnabled;
  }

  public isUserActivelyScrolling(): boolean {
    return this.userScrolling;
  }

  /**
   * Realtime speech synchronization:
   * Inspects spoken words streaming from the AI in real-time. When a semantic topic
   * is introduced in the speech, smoothly scrolls the page to that section immediately.
   */
  public handleSpokenTranscript(text: string) {
    if (!text || this.userScrolling) return;
    const lower = text.toLowerCase();

    // 1. Benefits (financial assistance, 6000, laabh, fayde, etc.)
    if (
      lower.includes('benefit') ||
      lower.includes('fayde') ||
      lower.includes('fayda') ||
      lower.includes('laabh') ||
      lower.includes('financial assistance') ||
      lower.includes('sahayata') ||
      lower.includes('6,000') ||
      lower.includes('6000') ||
      lower.includes('kist') ||
      lower.includes('installment')
    ) {
      this.scrollToSection('benefits', { reason: 'AI speaking about scheme benefits' });
      return;
    }

    // 2. Eligibility (who can apply, conditions, patrata, eligible)
    if (
      lower.includes('eligib') ||
      lower.includes('patrata') ||
      lower.includes('patra') ||
      lower.includes('criteria') ||
      lower.includes('conditions') ||
      lower.includes('who can apply') ||
      lower.includes('who is eligible') ||
      lower.includes('kaun aavedan')
    ) {
      this.scrollToSection('eligibility', { reason: 'AI speaking about eligibility criteria' });
      return;
    }

    // 3. Documents (papers, documents required, dastavej, kagaz, aadhaar)
    if (
      lower.includes('document') ||
      lower.includes('dastavej') ||
      lower.includes('dastaavez') ||
      lower.includes('kagaz') ||
      lower.includes('paper') ||
      lower.includes('aadhaar') ||
      lower.includes('khata') ||
      lower.includes('land record')
    ) {
      this.scrollToSection('documents', { reason: 'AI speaking about required documents' });
      return;
    }

    // 4. How to apply (application, apply, aavedan, process, registration)
    if (
      lower.includes('apply') ||
      lower.includes('aavedan') ||
      lower.includes('application') ||
      lower.includes('process') ||
      lower.includes('registration') ||
      lower.includes('csc center') ||
      lower.includes('online aavedan')
    ) {
      this.scrollToSection('application', { reason: 'AI speaking about application process' });
      return;
    }

    // 5. Overview (what is it, scheme overview, ke baare mein)
    if (
      lower.includes('overview') ||
      lower.includes('pehle scheme') ||
      lower.includes('kya hai') ||
      lower.includes('samjhte hain') ||
      lower.includes('central sector') ||
      lower.includes('kisan samman nidhi')
    ) {
      this.scrollToSection('overview', { reason: 'AI speaking about scheme overview' });
      return;
    }
  }
}

// Global Singleton Instance
export const semanticScroll = new SemanticScrollManager();
