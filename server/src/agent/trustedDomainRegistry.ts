// ============================================================
// Trusted Domain Registry — Government website allowlist
// SSRF protection: only whitelisted gov domains may be fetched
// Branch: agent-control
// ============================================================

export interface TrustedDomain {
  pattern: RegExp;
  name: string;
  category: 'central_gov' | 'state_gov' | 'portal' | 'research';
  description: string;
}

/**
 * Allowlist of trusted Indian government domains.
 * Configurable — add patterns as new portals are verified.
 */
export const TRUSTED_DOMAINS: TrustedDomain[] = [
  // Central government wildcard domains
  { pattern: /^https:\/\/[a-z0-9.-]+\.gov\.in(\/.*)?$/, name: 'Government of India', category: 'central_gov', description: 'All .gov.in domains' },
  { pattern: /^https:\/\/[a-z0-9.-]+\.nic\.in(\/.*)?$/, name: 'NIC India', category: 'central_gov', description: 'National Informatics Centre portals' },

  // Key government portals (exact domains)
  { pattern: /^https:\/\/scholarships\.gov\.in(\/.*)?$/, name: 'NSP Scholarships', category: 'portal', description: 'National Scholarship Portal' },
  { pattern: /^https:\/\/myscheme\.gov\.in(\/.*)?$/, name: 'MyScheme', category: 'portal', description: 'Central government scheme discovery portal' },
  { pattern: /^https:\/\/pmkisan\.gov\.in(\/.*)?$/, name: 'PM-KISAN', category: 'portal', description: 'PM Kisan Samman Nidhi' },
  { pattern: /^https:\/\/pmfby\.gov\.in(\/.*)?$/, name: 'PMFBY', category: 'portal', description: 'PM Fasal Bima Yojana' },
  { pattern: /^https:\/\/agmarknet\.gov\.in(\/.*)?$/, name: 'Agmarknet', category: 'portal', description: 'Agricultural Marketing Network (mandi prices)' },
  { pattern: /^https:\/\/enam\.gov\.in(\/.*)?$/, name: 'eNAM', category: 'portal', description: 'Electronic National Agriculture Market' },
  { pattern: /^https:\/\/icar\.org\.in(\/.*)?$/, name: 'ICAR', category: 'research', description: 'Indian Council of Agricultural Research' },
  { pattern: /^https:\/\/agricoop\.gov\.in(\/.*)?$/, name: 'Dept of Agriculture', category: 'central_gov', description: 'Ministry of Agriculture & Farmers Welfare' },
  { pattern: /^https:\/\/vikaspedia\.in(\/.*)?$/, name: 'Vikaspedia', category: 'portal', description: 'Government development information portal' },
  { pattern: /^https:\/\/india\.gov\.in(\/.*)?$/, name: 'National Portal of India', category: 'portal', description: 'National Portal of India' },
  { pattern: /^https:\/\/digitalindia\.gov\.in(\/.*)?$/, name: 'Digital India', category: 'portal', description: 'Digital India Programme' },
  { pattern: /^https:\/\/pmgsy\.nic\.in(\/.*)?$/, name: 'PMGSY', category: 'portal', description: 'Pradhan Mantri Gram Sadak Yojana' },
  { pattern: /^https:\/\/nrega\.nic\.in(\/.*)?$/, name: 'MGNREGA', category: 'portal', description: 'MGNREGA portal' },
  { pattern: /^https:\/\/www\.india\.gov\.in(\/.*)?$/, name: 'India.gov.in', category: 'portal', description: 'National portal' },
  { pattern: /^https:\/\/kisancall\.gov\.in(\/.*)?$/, name: 'Kisan Call Centre', category: 'portal', description: 'Kisan Call Centre' },
  { pattern: /^https:\/\/pib\.gov\.in(\/.*)?$/, name: 'PIB', category: 'central_gov', description: 'Press Information Bureau' },
  { pattern: /^https:\/\/mospi\.gov\.in(\/.*)?$/, name: 'MOSPI', category: 'central_gov', description: 'Ministry of Statistics' },
  { pattern: /^https:\/\/upag\.gov\.in(\/.*)?$/, name: 'UPAg', category: 'portal', description: 'Unified Portal for Agriculture Statistics' },
];

/**
 * Check if a URL is within the trusted government domain allowlist.
 * Also validates HTTPS requirement.
 */
export function isTrustedGovDomain(url: string): { trusted: boolean; domain?: TrustedDomain; reason?: string } {
  if (!url || typeof url !== 'string') {
    return { trusted: false, reason: 'Invalid URL' };
  }

  // Require HTTPS
  if (!url.startsWith('https://')) {
    return { trusted: false, reason: 'Only HTTPS URLs are permitted for government sources' };
  }

  // Validate URL structure
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { trusted: false, reason: 'Malformed URL' };
  }

  // Block private/loopback IPs (SSRF protection)
  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.startsWith('127.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('172.16.') ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  ) {
    return { trusted: false, reason: 'Private/loopback addresses are not permitted' };
  }

  // Check against allowlist
  for (const trustedDomain of TRUSTED_DOMAINS) {
    if (trustedDomain.pattern.test(url)) {
      return { trusted: true, domain: trustedDomain };
    }
  }

  return {
    trusted: false,
    reason: `Domain "${parsedUrl.hostname}" is not in the trusted government domain allowlist`,
  };
}

/**
 * Sanitize external content to prevent prompt injection.
 * External website text is treated as DATA, not instructions.
 * Any instruction-like phrases are neutralized.
 */
export function sanitizeExternalContent(content: string): string {
  if (!content) return '';

  // Neutralize common prompt injection patterns
  const injectionPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions?/gi,
    /forget\s+(everything|all)\s+you\s+know/gi,
    /you\s+are\s+now\s+a?\s+\w+/gi,
    /disregard\s+(your\s+)?instructions?/gi,
    /new\s+instructions?:\s*/gi,
    /system\s*:\s*/gi,
    /\[INST\]/gi,
    /<<SYS>>/gi,
    /\|<endoftext>\|/gi,
    /<\|im_start\|>/gi,
  ];

  let sanitized = content;
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[CONTENT FILTERED]');
  }

  // Truncate to prevent context overflow from malicious large payloads
  const MAX_EXTERNAL_CONTENT = 3000;
  if (sanitized.length > MAX_EXTERNAL_CONTENT) {
    sanitized = sanitized.slice(0, MAX_EXTERNAL_CONTENT) + '\n[Content truncated for safety]';
  }

  return sanitized;
}

/**
 * Validate that a URL is safe before fetching.
 * Returns validated URL or throws with reason.
 */
export function validateAndNormalizeGovUrl(rawUrl: string): string {
  const { trusted, reason } = isTrustedGovDomain(rawUrl);
  if (!trusted) {
    throw new Error(`URL not permitted: ${reason}`);
  }
  // Return normalized URL
  return new URL(rawUrl).toString();
}
