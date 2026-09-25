// ============================================================
// PII Guard — Detect and mask sensitive personal information
// Branch: agent-control
// ============================================================

export interface PIIDetectionResult {
  hasPII: boolean;
  detected: PIIField[];
  masked: string;
}

export interface PIIField {
  type: PIIType;
  original: string;
  masked: string;
  startIndex: number;
  endIndex: number;
}

export type PIIType =
  | 'aadhaar'
  | 'pan'
  | 'bank_account'
  | 'mobile'
  | 'otp'
  | 'upi_id'
  | 'credit_card'
  | 'password';

interface PIIPattern {
  type: PIIType;
  pattern: RegExp;
  mask: (match: string) => string;
  label: string;
}

const PII_PATTERNS: PIIPattern[] = [
  {
    type: 'aadhaar',
    // 12-digit number, optionally space/dash separated in groups of 4
    pattern: /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/g,
    mask: (m) => {
      const digits = m.replace(/[\s-]/g, '');
      return `XXXX XXXX ${digits.slice(-4)}`;
    },
    label: 'Aadhaar Number',
  },
  {
    type: 'pan',
    // PAN format: AAAAA1234A (5 letters + 4 digits + 1 letter)
    pattern: /\b([A-Z]{5}\d{4}[A-Z]{1})\b/g,
    mask: (m) => `XXXXX${m.slice(5, 9)}X`,
    label: 'PAN Card',
  },
  {
    type: 'bank_account',
    // Bank account: 9-18 digits, often standalone
    pattern: /\b(\d{9,18})\b/g,
    mask: (m) => `XXXX${m.slice(-4)}`,
    label: 'Bank Account',
  },
  {
    type: 'mobile',
    // Indian mobile: 10 digits starting with 6-9
    pattern: /\b([6-9]\d{9})\b/g,
    mask: (m) => `XXXXXX${m.slice(-4)}`,
    label: 'Mobile Number',
  },
  {
    type: 'otp',
    // 4 or 6 digit OTP typically mentioned with context keywords
    pattern: /\b(OTP|otp|one.?time.?password)[\s:]*(\d{4,6})\b/gi,
    mask: () => 'OTP: XXXXXX',
    label: 'OTP',
  },
  {
    type: 'upi_id',
    // UPI ID: something@bank
    pattern: /\b([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)\b/g,
    mask: (m) => {
      const parts = m.split('@');
      return `${parts[0].slice(0, 2)}XXXX@${parts[1]}`;
    },
    label: 'UPI ID',
  },
  {
    type: 'credit_card',
    // 16-digit card numbers
    pattern: /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/g,
    mask: () => 'XXXX XXXX XXXX XXXX',
    label: 'Card Number',
  },
];

/**
 * Detect and mask PII in text.
 * Returns both the masked text and metadata about what was found.
 */
export function detectAndMaskPII(text: string): PIIDetectionResult {
  if (!text) return { hasPII: false, detected: [], masked: text };

  let masked = text;
  const detected: PIIField[] = [];

  // Apply each pattern
  for (const piip of PII_PATTERNS) {
    const matches = [...text.matchAll(piip.pattern)];
    for (const match of matches) {
      const original = match[0];
      const maskedValue = piip.mask(original);
      const startIndex = match.index ?? 0;

      detected.push({
        type: piip.type,
        original,
        masked: maskedValue,
        startIndex,
        endIndex: startIndex + original.length,
      });
    }
    // Apply masking in the masked string
    masked = masked.replace(piip.pattern, piip.mask);
  }

  return {
    hasPII: detected.length > 0,
    detected,
    masked,
  };
}

/**
 * Check if a message contains highly sensitive PII that should
 * prevent it from being sent to the LLM entirely.
 * Returns advisory only — caller decides how to proceed.
 */
export function assessPIISensitivity(text: string): {
  shouldBlock: boolean;
  sensitiveTypes: PIIType[];
  warning?: string;
} {
  const result = detectAndMaskPII(text);
  const criticalTypes: PIIType[] = ['otp', 'credit_card', 'upi_id'];
  const foundCritical = result.detected
    .map((d) => d.type)
    .filter((t) => criticalTypes.includes(t));

  if (foundCritical.length > 0) {
    return {
      shouldBlock: true,
      sensitiveTypes: foundCritical,
      warning: `Sensitive information detected (${foundCritical.join(', ')}). This will not be shared with AI.`,
    };
  }

  if (result.hasPII) {
    return {
      shouldBlock: false,
      sensitiveTypes: result.detected.map((d) => d.type),
      warning: 'Personal identifiers will be masked before processing.',
    };
  }

  return { shouldBlock: false, sensitiveTypes: [] };
}
