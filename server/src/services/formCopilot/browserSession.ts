// ================================================================
// BrowserSession.ts — Real Isolated Playwright Browser Session
// Manages real government website interactions, authentication,
// form detection, action queue, and realtime streaming updates.
// ================================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { governmentPortalRegistry, type GovernmentPortal } from './governmentPortalRegistry';

export type SessionState =
  | 'CREATING'
  | 'READY'
  | 'NAVIGATING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'WAITING_FOR_USER'
  | 'CLOSED'
  | 'ERROR'
  | 'GUIDANCE_MODE'
  | 'FILLING'
  | 'READY_TO_SUBMIT'
  | 'SUBMITTING'
  | 'COMPLETED';

export type SecurityStopType = 'CAPTCHA' | 'OTP' | 'AADHAAR_AUTH' | 'ESIGN' | 'PAYMENT' | 'LOGIN_REQUIRED';

export type FieldStatus = 'CONFIRMED' | 'UNCONFIRMED' | 'SENSITIVE' | 'DOCUMENT_DERIVED' | 'MISSING' | 'USER_MODIFIED';

export interface PageDetectionState {
  portal: string;
  currentStep: string;
  pageTitle: string;
  formDetected: boolean;
  loginRequired: boolean;
  captchaDetected: boolean;
  otpRequired: boolean;
  userActionRequired: boolean;
}

export interface InspectedField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'select' | 'radio' | 'checkbox' | 'date' | 'file' | 'textarea' | 'password' | 'unknown';
  selector: string; // CSS selector used internally
  required: boolean;
  currentValue?: string;
  options?: string[]; // For select/radio
  stepIndex: number;
  pageIndex: number;
}

export interface MappedField {
  fieldId: string;
  label: string;
  type: InspectedField['type'];
  stepIndex: number;
  profileKey?: string;
  resolvedValue?: string;
  displayValue: string;
  status: FieldStatus;
  source: 'profile' | 'document' | 'user_input' | 'empty';
  sourceLabel: string;
  confidence: number;
  isUserModified: boolean;
}

export interface FillingProgress {
  fieldId: string;
  label: string;
  status: 'pending' | 'filling' | 'done' | 'skipped' | 'user_modified' | 'error';
  displayValue?: string;
}

export interface SecurityStop {
  type: SecurityStopType;
  title: string;
  message: string;
  resumeLabel: string;
}

export interface SessionSnapshot {
  sessionId: string;
  state: SessionState;
  portalId: string | null;
  portal: GovernmentPortal | null;
  currentUrl: string;
  pageTitle: string;
  screenshotBase64: string | null;
  pageDetection: PageDetectionState;
  inspectedFields: InspectedField[];
  mappedFields: MappedField[];
  fillingProgress: FillingProgress[];
  currentlyFillingFieldId: string | null;
  securityStop: SecurityStop | null;
  error: string | null;
  guidanceSteps: string[];
  totalFieldsCount: number;
  completedFieldsCount: number;
  userControlActive: boolean;
  actionQueueLength: number;
  submissionResult: { referenceNumber?: string; message: string; url?: string } | null;
}

export type SessionEventListener = (snapshot: SessionSnapshot) => void;

interface ActionItem {
  id: string;
  name: string;
  execute: () => Promise<void>;
}

// ── Controlled Browser Action Queue ─────────────────────────────
class BrowserActionQueue {
  private queue: ActionItem[] = [];
  private isProcessing = false;
  private isPaused = false;

  enqueue(item: ActionItem): void {
    this.queue.push(item);
    this.process();
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    this.process();
  }

  clear(): void {
    this.queue = [];
    this.isProcessing = false;
    this.isPaused = false;
  }

  get length(): number {
    return this.queue.length;
  }

  private async process(): Promise<void> {
    if (this.isProcessing || this.isPaused || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0 && !this.isPaused) {
      const item = this.queue.shift();
      if (item) {
        try {
          await item.execute();
        } catch (err) {
          console.warn(`[BrowserActionQueue] Error executing action ${item.name}:`, err);
        }
      }
    }

    this.isProcessing = false;
  }
}

const SCREENSHOT_QUALITY = 65;
const SCREENSHOT_INTERVAL_MS = 1000;
const ALWAYS_MANUAL_FIELD_TYPES = new Set(['password', 'hidden']);
const SENSITIVE_PROFILE_KEYS = new Set(['aadhaar_number', 'bank_account_number', 'bank_ifsc', 'pan_number']);

export class BrowserSession {
  private sessionId: string;
  private portalId: string | null = null;
  private portal: GovernmentPortal | null = null;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  private state: SessionState = 'CREATING';
  private currentUrl = '';
  private pageTitle = '';
  private latestScreenshot: string | null = null;
  private inspectedFields: InspectedField[] = [];
  private mappedFields: MappedField[] = [];
  private fillingProgress: FillingProgress[] = [];
  private currentlyFillingFieldId: string | null = null;
  private securityStop: SecurityStop | null = null;
  private error: string | null = null;
  private guidanceSteps: string[] = [];
  private submissionResult: SessionSnapshot['submissionResult'] = null;

  private pageDetection: PageDetectionState = {
    portal: 'Government Portal',
    currentStep: 'opening',
    pageTitle: '',
    formDetected: false,
    loginRequired: false,
    captchaDetected: false,
    otpRequired: false,
    userActionRequired: false,
  };

  private actionQueue = new BrowserActionQueue();
  private userControlActive = false;
  private isFullPageCapture = true;

  private screenshotTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<SessionEventListener>();
  private profileData: Record<string, string> = {};

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  subscribe(listener: SessionEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try { listener(snapshot); } catch {}
    }
  }

  getSnapshot(): SessionSnapshot {
    const done = this.fillingProgress.filter((p) => p.status === 'done' || p.status === 'user_modified').length;
    return {
      sessionId: this.sessionId,
      state: this.state,
      portalId: this.portalId,
      portal: this.portal,
      currentUrl: this.currentUrl,
      pageTitle: this.pageTitle,
      screenshotBase64: this.latestScreenshot,
      pageDetection: this.pageDetection,
      inspectedFields: this.inspectedFields,
      mappedFields: this.mappedFields,
      fillingProgress: this.fillingProgress,
      currentlyFillingFieldId: this.currentlyFillingFieldId,
      securityStop: this.securityStop,
      error: this.error,
      guidanceSteps: this.guidanceSteps,
      totalFieldsCount: this.mappedFields.filter((f) => f.status !== 'MISSING').length,
      completedFieldsCount: done,
      userControlActive: this.userControlActive,
      actionQueueLength: this.actionQueue.length,
      submissionResult: this.submissionResult,
    };
  }

  // ── Open Portal & Launch Isolated Browser Context ────────────

  async openPortal(portalId: string, profileData: Record<string, string>): Promise<void> {
    const portal = governmentPortalRegistry.getById(portalId);
    if (!portal) {
      this.state = 'ERROR';
      this.error = `Portal "${portalId}" is not in the verified government registry.`;
      this.emit();
      return;
    }

    this.portalId = portalId;
    this.portal = portal;
    this.profileData = profileData;
    this.state = 'CREATING';
    this.error = null;
    this.securityStop = null;
    this.emit();

    try {
      // 1. Launch isolated Chromium instance
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security=false',
        ],
      });

      // 2. Create isolated Browser Context — dedicated cookies, localStorage, sessionStorage
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
      });

      // Listen for popup / new tabs (e.g. when user clicks Login or Apply)
      this.context.on('page', (newPage) => {
        console.log('[BrowserSession] New tab / popup opened:', newPage.url());
        this.attachPage(newPage);
      });

      this.page = await this.context.newPage();
      this.setupPageListeners(this.page);

      // Start screenshot streaming
      this.startScreenshotStream();

      // If portal is configured as guidance mode
      if (portal.mode === 'guidance') {
        this.state = 'GUIDANCE_MODE';
        this.guidanceSteps = this.buildGuidanceSteps(portal);
        this.emit();
        return;
      }

      // 3. Navigate to official government portal
      this.state = 'NAVIGATING';
      this.emit();

      await this.page.goto(portal.officialUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      this.currentUrl = this.page.url();
      this.pageTitle = await this.page.title().catch(() => '');

      // 4. Initial page detection
      await this.detectCurrentPage();

      // 5. Ready for user interaction! Do NOT auto-inspect or auto-fill yet.
      // User is in control: they can log in, click links, open the form.
      if ((this.state as SessionState) !== 'WAITING_FOR_USER') {
        this.state = 'READY';
      }
      this.emit();
    } catch (err: any) {
      this.state = 'ERROR';
      this.error = `Failed to open official website: ${err?.message || 'Network timeout'}`;
      this.emit();
    }
  }

  // ── Continuous Page Detection ────────────────────────────────

  async detectCurrentPage(): Promise<PageDetectionState> {
    if (!this.page || this.page.isClosed()) {
      return this.pageDetection;
    }

    try {
      this.currentUrl = this.page.url();
      this.pageTitle = await this.page.title().catch(() => '');

      const detection = await this.page.evaluate(() => {
        const bodyText = (document.body?.innerText || '').toLowerCase();
        const url = window.location.href.toLowerCase();

        // 1. Password or Login detection
        const passwordInput = document.querySelector('input[type="password"]');
        const loginRequired = !!passwordInput || url.includes('/login') || url.includes('/signin');

        // 2. CAPTCHA detection
        const captchaEl = document.querySelector(
          '[id*="captcha" i], [class*="captcha" i], img[src*="captcha" i], iframe[src*="recaptcha" i], iframe[src*="hcaptcha" i]'
        );
        const captchaDetected = !!captchaEl || bodyText.includes('enter captcha') || bodyText.includes('type the characters');

        // 3. OTP detection
        const otpInput = document.querySelector('input[name*="otp" i], input[id*="otp" i], input[placeholder*="otp" i]');
        const otpRequired = !!otpInput || bodyText.includes('enter otp') || bodyText.includes('one time password');

        // 4. Genuine application form detection (filter out search & language switcher)
        const inputs = Array.from(document.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="search"]), select, textarea'
        )).filter((el) => {
          const name = (el.getAttribute('name') || '').toLowerCase();
          const id = (el.getAttribute('id') || '').toLowerCase();
          if (name === 'optradio' || id.includes('language') || id.includes('search')) return false;
          if (el.closest('header') || el.closest('nav') || el.closest('#header')) return false;
          return true;
        });

        const isApplicationUrl = url.includes('/apply') || url.includes('/register') || url.includes('/scheme') || url.includes('/form') || url.includes('/application');
        const formDetected = inputs.length >= 3 || (inputs.length >= 1 && isApplicationUrl);

        let currentStep = 'browsing';
        if (loginRequired) currentStep = 'login';
        else if (otpRequired) currentStep = 'otp_verification';
        else if (captchaDetected) currentStep = 'captcha_verification';
        else if (formDetected) currentStep = 'application_form';

        return {
          currentStep,
          formDetected,
          loginRequired,
          captchaDetected,
          otpRequired,
          userActionRequired: loginRequired || captchaDetected || otpRequired,
          inputsCount: inputs.length,
        };
      });

      this.pageDetection = {
        portal: this.portal?.name || 'Government Portal',
        currentStep: detection.currentStep,
        pageTitle: this.pageTitle,
        formDetected: detection.formDetected,
        loginRequired: detection.loginRequired,
        captchaDetected: detection.captchaDetected,
        otpRequired: detection.otpRequired,
        userActionRequired: detection.userActionRequired,
      };

      // Handle security pause
      if (detection.captchaDetected) {
        this.securityStop = {
          type: 'CAPTCHA',
          title: '🧩 Security Check Required',
          message: 'The official website requires solving a CAPTCHA. Please solve it directly on the government page.',
          resumeLabel: "I've solved the CAPTCHA — continue",
        };
        this.state = 'WAITING_FOR_USER';
      } else if (detection.otpRequired) {
        this.securityStop = {
          type: 'OTP',
          title: '🔐 Verification Code Required',
          message: 'The official website is asking for an OTP. Please enter it yourself on the official website.',
          resumeLabel: "I've entered the OTP — continue",
        };
        this.state = 'WAITING_FOR_USER';
      } else if (this.state === 'WAITING_FOR_USER' && !detection.userActionRequired) {
        this.securityStop = null;
        this.state = 'READY';
      }

      return this.pageDetection;
    } catch {
      return this.pageDetection;
    }
  }

  // ── Inspect Form (Called When On Form Page) ──────────────────

  async inspectRealForm(): Promise<void> {
    if (!this.page) return;

    try {
      this.state = 'ACTIVE';
      this.emit();

      const fields: InspectedField[] = await this.page.evaluate(() => {
        const results: any[] = [];
        let idx = 0;

        const getLabel = (el: Element): string => {
          const ariaLabel = el.getAttribute('aria-label');
          if (ariaLabel) return ariaLabel.trim();

          const labelledById = el.getAttribute('aria-labelledby');
          if (labelledById) {
            const labelEl = document.getElementById(labelledById);
            if (labelEl) return labelEl.textContent?.trim() || '';
          }

          const id = el.getAttribute('id');
          if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) return label.textContent?.trim() || '';
          }

          const closestLabel = el.closest('label');
          if (closestLabel) return closestLabel.textContent?.trim() || '';

          return (el as HTMLInputElement).placeholder?.trim() || `Field ${idx + 1}`;
        };

        const getSelector = (el: Element): string => {
          const id = el.getAttribute('id');
          if (id) return `#${CSS.escape(id)}`;
          const name = el.getAttribute('name');
          if (name) return `[name="${name}"]`;
          return `input:nth-of-type(${idx + 1})`;
        };

        // Filter out non-form elements, language radio switches, search bars
        const inputs = Array.from(document.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="search"]), select, textarea'
        )).filter((el) => {
          const name = (el.getAttribute('name') || '').toLowerCase();
          const id = (el.getAttribute('id') || '').toLowerCase();
          if (name === 'optradio' || id.includes('language') || id.includes('search')) return false;
          if (el.closest('header') || el.closest('nav') || el.closest('#header')) return false;
          return true;
        });

        inputs.forEach((el) => {
          const type = (el.tagName === 'SELECT' ? 'select'
            : el.tagName === 'TEXTAREA' ? 'textarea'
            : (el as HTMLInputElement).type || 'text') as any;

          const options = type === 'select'
            ? Array.from((el as HTMLSelectElement).options).map((o) => o.text.trim()).filter(Boolean)
            : undefined;

          const baseId = el.getAttribute('id') || el.getAttribute('name') || `field`;
          // Guaranteed strictly unique ID
          const uniqueId = `${baseId}_${idx}`;

          results.push({
            id: uniqueId,
            label: getLabel(el),
            type,
            selector: getSelector(el),
            required: (el as HTMLInputElement).required || el.getAttribute('aria-required') === 'true',
            currentValue: (el as HTMLInputElement).value || undefined,
            options,
            stepIndex: 0,
            pageIndex: 0,
          });
          idx++;
        });

        return results;
      });

      this.inspectedFields = fields.slice(0, 60);

      // Map fields to profile
      await this.mapFieldsToProfile();
      this.state = 'ACTIVE';
      this.emit();
    } catch (err: any) {
      console.warn('[BrowserSession] inspectRealForm error:', err);
      this.state = 'READY';
      this.emit();
    }
  }

  private async mapFieldsToProfile(): Promise<void> {
    const mapped: MappedField[] = [];

    for (const field of this.inspectedFields) {
      if (ALWAYS_MANUAL_FIELD_TYPES.has(field.type)) continue;

      const profileMatch = this.findProfileMatch(field.label);
      if (profileMatch && this.profileData[profileMatch.key]) {
        const rawValue = this.profileData[profileMatch.key];
        const isSensitive = SENSITIVE_PROFILE_KEYS.has(profileMatch.key);

        mapped.push({
          fieldId: field.id,
          label: field.label,
          type: field.type,
          stepIndex: field.stepIndex,
          profileKey: profileMatch.key,
          resolvedValue: rawValue,
          displayValue: isSensitive ? '••••••••' : rawValue,
          status: isSensitive ? 'SENSITIVE' : 'CONFIRMED',
          source: 'profile',
          sourceLabel: `Profile (${profileMatch.label})`,
          confidence: profileMatch.confidence,
          isUserModified: false,
        });
      } else {
        mapped.push({
          fieldId: field.id,
          label: field.label,
          type: field.type,
          stepIndex: field.stepIndex,
          displayValue: '',
          status: 'MISSING',
          source: 'empty',
          sourceLabel: 'Need your input',
          confidence: 0,
          isUserModified: false,
        });
      }
    }

    this.mappedFields = mapped;
    this.fillingProgress = mapped.map((f) => ({
      fieldId: f.fieldId,
      label: f.label,
      status: 'pending',
      displayValue: f.displayValue,
    }));
  }

  private findProfileMatch(label: string): { key: string; label: string; confidence: number } | null {
    const l = label.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    if (!l) return null;

    const rules: Array<{ patterns: string[]; key: string; name: string }> = [
      { patterns: ['name', 'applicant name', 'full name', 'candidate name'], key: 'full_name', name: 'Full Name' },
      { patterns: ['dob', 'date of birth', 'birth date'], key: 'date_of_birth', name: 'Date of Birth' },
      { patterns: ['father', 'father name', 'guardian'], key: 'father_name', name: "Father's Name" },
      { patterns: ['mother', 'mother name'], key: 'mother_name', name: "Mother's Name" },
      { patterns: ['gender', 'sex'], key: 'gender', name: 'Gender' },
      { patterns: ['category', 'caste', 'social category'], key: 'social_category', name: 'Social Category' },
      { patterns: ['state', 'domicile state', 'residence state'], key: 'state', name: 'State' },
      { patterns: ['district'], key: 'district', name: 'District' },
      { patterns: ['pin', 'pincode', 'postal code', 'zip'], key: 'pincode', name: 'PIN Code' },
      { patterns: ['mobile', 'phone', 'contact number'], key: 'phone', name: 'Mobile Number' },
      { patterns: ['email', 'email id', 'email address'], key: 'email', name: 'Email' },
      { patterns: ['aadhaar', 'uid'], key: 'aadhaar_number', name: 'Aadhaar Number' },
    ];

    for (const rule of rules) {
      if (rule.patterns.some((p) => l.includes(p) || p.includes(l))) {
        return { key: rule.key, label: rule.name, confidence: 0.9 };
      }
    }

    return null;
  }

  // ── Controlled Action Execution: Auto-Fill Form ───────────────

  async startFilling(): Promise<void> {
    if (!this.page || this.mappedFields.length === 0) return;
    this.state = 'FILLING';
    this.userControlActive = false;
    this.actionQueue.clear();
    this.emit();

    const toFill = this.mappedFields.filter(
      (f) => f.resolvedValue && f.status !== 'MISSING' && !ALWAYS_MANUAL_FIELD_TYPES.has(f.type)
    );

    for (const field of toFill) {
      this.actionQueue.enqueue({
        id: field.fieldId,
        name: `fill_${field.label}`,
        execute: async () => {
          if (!this.page || this.userControlActive || this.state !== 'FILLING') return;

          this.currentlyFillingFieldId = field.fieldId;
          const prog = this.fillingProgress.find((p) => p.fieldId === field.fieldId);
          if (prog) prog.status = 'filling';
          this.emit();

          try {
            const inspected = this.inspectedFields.find((f) => f.id === field.fieldId);
            if (!inspected) return;

            // 1. Scroll field into view
            await this.page.evaluate((sel) => {
              const el = document.querySelector(sel);
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, inspected.selector);

            await this.delay(200);

            // 2. Focus and fill
            if (inspected.type === 'select') {
              await this.page.selectOption(inspected.selector, { label: field.resolvedValue }).catch(async () => {
                await this.page?.selectOption(inspected.selector, { value: field.resolvedValue });
              });
            } else {
              await this.page.fill(inspected.selector, field.resolvedValue || '');
            }

            await this.page.evaluate((sel) => {
              const el = document.querySelector(sel);
              if (el) {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, inspected.selector);

            if (prog) {
              prog.status = 'done';
              prog.displayValue = field.displayValue;
            }

            await this.captureScreenshot();
            this.emit();
            await this.delay(350);
          } catch (err) {
            console.warn(`[BrowserSession] Error filling field ${field.label}:`, err);
            if (prog) prog.status = 'error';
          }
        },
      });
    }

    // After all items finished
    this.actionQueue.enqueue({
      id: 'completion_check',
      name: 'completion_check',
      execute: async () => {
        this.currentlyFillingFieldId = null;
        this.state = 'READY_TO_SUBMIT';
        await this.captureScreenshot();
        this.emit();
      },
    });
  }

  pause(): void {
    this.state = 'PAUSED';
    this.actionQueue.pause();
    this.emit();
  }

  resume(): void {
    if (this.state === 'PAUSED') {
      this.state = 'FILLING';
      this.actionQueue.resume();
      this.emit();
    }
  }

  stop(): void {
    this.actionQueue.clear();
    this.currentlyFillingFieldId = null;
    this.state = 'READY';
    this.emit();
  }

  async resumeAfterUserAction(): Promise<void> {
    this.securityStop = null;
    await this.detectCurrentPage();
    this.state = 'READY';
    await this.captureScreenshot();
    this.emit();
  }

  handleUserModifiedField(fieldId: string): void {
    const prog = this.fillingProgress.find((p) => p.fieldId === fieldId);
    if (prog) prog.status = 'user_modified';
    const mapped = this.mappedFields.find((f) => f.fieldId === fieldId);
    if (mapped) mapped.isUserModified = true;
    this.emit();
  }

  // ── Multi-Tab & Page Lifecycle Management ─────────────────

  private setupPageListeners(page: Page): void {
    page.on('load', async () => {
      await this.detectCurrentPage();
      await this.captureScreenshot();
      this.emit();
    });

    page.on('domcontentloaded', async () => {
      await this.detectCurrentPage();
      await this.captureScreenshot();
      this.emit();
    });

    page.on('framenavigated', async () => {
      this.currentUrl = page.url();
      await this.detectCurrentPage();
      await this.captureScreenshot();
      this.emit();
    });
  }

  private attachPage(newPage: Page): void {
    this.page = newPage;
    this.setupPageListeners(newPage);
    this.currentUrl = newPage.url();
    newPage.bringToFront().catch(() => {});
    newPage.waitForLoadState('domcontentloaded').then(async () => {
      await this.detectCurrentPage();
      await this.captureScreenshot();
      this.emit();
    }).catch(() => {});
  }

  async goToLogin(): Promise<void> {
    const url = this.portal?.loginUrl || `${this.portal?.officialUrl}/login`;
    await this.navigate(url);
  }

  async goToApplication(): Promise<void> {
    const url = this.portal?.applicationUrl || this.portal?.officialUrl;
    if (url) await this.navigate(url);
  }

  // ── Remote User Interaction (Mouse, Keyboard, Scroll) ─────────

  async userClick(x: number, y: number): Promise<void> {
    if (!this.page || this.page.isClosed()) return;
    try {
      this.userControlActive = true;

      // 1. Calculate scroll and find target element
      const targetState = await this.page.evaluate(({ docX, docY }) => {
        const vpHeight = window.innerHeight || 800;
        const curScroll = window.scrollY || 0;

        // If docY is outside current viewport or close to edges, scroll smoothly/instantly to center it
        if (docY < curScroll + 40 || docY > curScroll + vpHeight - 40) {
          const newScroll = Math.max(0, Math.round(docY - vpHeight / 2));
          window.scrollTo({ top: newScroll, behavior: 'instant' });
        }

        const effectiveVpY = Math.round(docY - (window.scrollY || 0));
        const el = document.elementFromPoint(docX, effectiveVpY) as HTMLElement;

        if (!el) {
          return { found: false, vpX: docX, vpY: effectiveVpY, isInput: false, href: null };
        }

        // Check if it's an input or focusable element
        const inputEl = el.closest('input, textarea, select, [contenteditable="true"]') as HTMLElement;
        if (inputEl) {
          if (typeof inputEl.focus === 'function') inputEl.focus();
          return { found: true, vpX: docX, vpY: effectiveVpY, isInput: true, href: null };
        }

        const linkEl = el.closest('a') as HTMLAnchorElement;
        const btnEl = el.closest('button, [role="button"]') as HTMLElement;
        const href = linkEl ? linkEl.href : null;

        // For non-input elements, make sure we focus if focusable
        if (typeof el.focus === 'function') el.focus();

        return {
          found: true,
          vpX: docX,
          vpY: effectiveVpY,
          isInput: false,
          isLink: !!linkEl,
          isBtn: !!btnEl,
          href,
        };
      }, { docX: x, docY: y });

      await this.delay(50);

      // 2. Perform authentic OS-level mouse click via Playwright
      const clickY = targetState.vpY >= 0 && targetState.vpY <= 800 ? targetState.vpY : Math.min(800, Math.max(0, targetState.vpY));
      await this.page.mouse.click(x, clickY).catch(() => {});

      // 3. Fallback: If it's a link with an explicit HTTP/HTTPS href and navigation hasn't begun after a short delay
      if (targetState.href && targetState.href.startsWith('http') && !targetState.href.includes('#')) {
        await this.delay(350);
        if (this.page.url() === this.currentUrl) {
          try {
            await this.page.evaluate((targetHref) => {
              window.location.href = targetHref;
            }, targetState.href);
          } catch {}
        }
      }

      await this.delay(500);
      await this.detectCurrentPage();
      await this.captureScreenshot();
      this.emit();
    } catch (err) {
      console.warn('[BrowserSession] userClick error:', err);
    }
  }

  async userDblClick(x: number, y: number): Promise<void> {
    if (!this.page || this.page.isClosed()) return;
    try {
      this.userControlActive = true;
      await this.page.mouse.dblclick(x, y);
      await this.delay(300);
      await this.captureScreenshot();
      this.emit();
    } catch (err) {
      console.warn('[BrowserSession] userDblClick error:', err);
    }
  }

  async userScroll(deltaY: number): Promise<void> {
    if (!this.page || this.page.isClosed()) return;
    try {
      this.userControlActive = true;
      await this.page.mouse.wheel(0, deltaY);
      await this.delay(100);
      await this.captureScreenshot();
      this.emit();
    } catch (err) {
      console.warn('[BrowserSession] userScroll error:', err);
    }
  }

  async userScrollTo(y: number): Promise<void> {
    if (!this.page || this.page.isClosed()) return;
    try {
      await this.page.evaluate((top) => window.scrollTo({ top, behavior: 'auto' }), y);
      await this.captureScreenshot();
      this.emit();
    } catch {}
  }

  async userType(text: string): Promise<void> {
    if (!this.page || this.page.isClosed()) return;
    try {
      this.userControlActive = true;
      await this.page.keyboard.type(text, { delay: 25 });
      await this.captureScreenshot();
      this.emit();
    } catch (err) {
      console.warn('[BrowserSession] userType error:', err);
    }
  }

  async userKeyPress(key: string): Promise<void> {
    if (!this.page || this.page.isClosed()) return;
    try {
      this.userControlActive = true;
      await this.page.keyboard.press(key);
      await this.delay(150);
      await this.detectCurrentPage();
      await this.captureScreenshot();
      this.emit();
    } catch (err) {
      console.warn('[BrowserSession] userKeyPress error:', err);
    }
  }

  async navigate(url: string): Promise<void> {
    if (!this.page || this.page.isClosed()) return;
    try {
      this.state = 'NAVIGATING';
      this.emit();
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.detectCurrentPage();
      this.state = 'READY';
      await this.captureScreenshot();
      this.emit();
    } catch (err: any) {
      this.error = `Failed to navigate: ${err?.message || ''}`;
      this.state = 'READY';
      this.emit();
    }
  }

  async goBack(): Promise<void> {
    if (!this.page || this.page.isClosed()) return;
    try {
      await this.page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await this.detectCurrentPage();
      await this.captureScreenshot();
      this.emit();
    } catch {}
  }

  async goForward(): Promise<void> {
    if (!this.page || this.page.isClosed()) return;
    try {
      await this.page.goForward({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await this.detectCurrentPage();
      await this.captureScreenshot();
      this.emit();
    } catch {}
  }

  async reload(): Promise<void> {
    if (!this.page || this.page.isClosed()) return;
    try {
      await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await this.detectCurrentPage();
      await this.captureScreenshot();
      this.emit();
    } catch {}
  }

  // ── Final Submission ─────────────────────────────────────────

  async submitApplication(): Promise<void> {
    if (!this.page) return;
    this.state = 'SUBMITTING';
    this.emit();

    try {
      await this.page.evaluate(() => {
        const submitBtn = document.querySelector(
          'button[type="submit"], input[type="submit"], button.btn-submit, [id*="submit" i]'
        ) as HTMLElement;
        if (submitBtn) submitBtn.click();
      });

      await this.delay(2000);
      await this.captureScreenshot();

      const result = await this.page.evaluate(() => {
        const text = document.body.innerText;
        const refMatch = text.match(/(?:application|reference|ack(?:nowledgement)?)\s*(?:no\.?|number|id)?\s*[:#-]?\s*([A-Z0-9-]{6,20})/i);
        return {
          referenceNumber: refMatch ? refMatch[1] : undefined,
          message: 'Application submitted successfully to official government portal.',
          url: window.location.href,
        };
      });

      this.submissionResult = result;
      this.state = 'COMPLETED';
      this.emit();
    } catch (err: any) {
      this.state = 'ERROR';
      this.error = `Submission error: ${err?.message || ''}`;
      this.emit();
    }
  }

  // ── Screenshot Streaming ─────────────────────────────────────

  private startScreenshotStream(): void {
    this.screenshotTimer = setInterval(async () => {
      await this.captureScreenshot();
    }, SCREENSHOT_INTERVAL_MS);
  }

  private async captureScreenshot(): Promise<void> {
    if (!this.page || this.page.isClosed()) return;
    try {
      const buf = await this.page.screenshot({
        type: 'jpeg',
        quality: SCREENSHOT_QUALITY,
        fullPage: this.isFullPageCapture,
      });
      this.latestScreenshot = buf.toString('base64');
      this.currentUrl = this.page.url();
    } catch {
      try {
        const buf = await this.page.screenshot({ type: 'jpeg', quality: SCREENSHOT_QUALITY });
        this.latestScreenshot = buf.toString('base64');
        this.currentUrl = this.page.url();
      } catch {}
    }
  }

  setCaptureMode(fullPage: boolean): void {
    this.isFullPageCapture = fullPage;
  }

  private buildGuidanceSteps(portal: GovernmentPortal): string[] {
    return [
      `Open the official portal at ${portal.officialDomain}`,
      'Navigate to the registration or application section.',
      'Fill in your personal details — Gram Sathi can show you what information to enter.',
      'Upload required documents when prompted.',
      'Complete any OTP or CAPTCHA verification directly on the page.',
      'Review all information before submitting.',
      'Note your application reference number after submission.',
    ];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ── Cleanup ──────────────────────────────────────────────────

  async destroy(): Promise<void> {
    if (this.screenshotTimer) clearInterval(this.screenshotTimer);
    this.actionQueue.clear();
    this.listeners.clear();

    try { await this.context?.clearCookies(); } catch {}
    try { await this.page?.close(); } catch {}
    try { await this.context?.close(); } catch {}
    try { await this.browser?.close(); } catch {}

    this.browser = null;
    this.context = null;
    this.page = null;
    this.latestScreenshot = null;
    this.state = 'CLOSED';
  }
}
