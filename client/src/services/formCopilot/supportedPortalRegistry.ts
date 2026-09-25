// ================================================================
// SupportedPortalRegistry — Registry of verified Indian Government Portals
// Implements Domain Validation, HTTPS checks, and Guidance Mode Fallback
// ================================================================

import type { SupportedPortal, PortalStatus } from './types';

export const SUPPORTED_PORTALS: SupportedPortal[] = [
  {
    portalId: 'nsp',
    name: 'National Scholarship Portal (NSP)',
    nameHi: 'राष्ट्रीय छात्रवृत्ति पोर्टल (NSP)',
    officialUrl: 'https://scholarships.gov.in',
    domains: ['scholarships.gov.in', 'nsp.gov.in', 'scholarships.nic.in'],
    capabilities: ['form_detection', 'field_filling', 'document_upload', 'multi_step'],
    status: 'supported',
    description: 'Central and state government pre-matric, post-matric and merit scholarships for students.',
    descriptionHi: 'छात्रों के लिए केंद्र और राज्य सरकार की प्री-मैट्रिक, पोस्ट-मैट्रिक और मेधावी छात्रवृत्ति।',
    category: 'Education & Scholarship',
  },
  {
    portalId: 'pm-kisan',
    name: 'PM-KISAN Samman Nidhi Portal',
    nameHi: 'पीएम-किसान सम्मान निधि पोर्टल',
    officialUrl: 'https://pmkisan.gov.in',
    domains: ['pmkisan.gov.in', 'pmkisan.nic.in'],
    capabilities: ['form_detection', 'field_filling', 'document_upload'],
    status: 'supported',
    description: 'Income support of ₹6,000/year directly to verified landholding farmer families.',
    descriptionHi: 'भूमिधारक किसान परिवारों को सीधे ₹6,000 प्रति वर्ष की वित्तीय सहायता।',
    category: 'Agriculture & Farming',
  },
  {
    portalId: 'kcc',
    name: 'Kisan Credit Card (KCC) Portal',
    nameHi: 'किसान क्रेडिट कार्ड (KCC) पोर्टल',
    officialUrl: 'https://myscheme.gov.in/schemes/kcc',
    domains: ['myscheme.gov.in'],
    capabilities: ['form_detection', 'field_filling'],
    status: 'supported',
    description: 'Subsidized 4% interest rate agriculture and animal husbandry credit card.',
    descriptionHi: 'कम ब्याज दर पर कृषि और पशुपालन ऋण सहायता कार्ड।',
    category: 'Credit & Loans',
  },
];

export class SupportedPortalRegistry {
  private portals: Map<string, SupportedPortal> = new Map();

  constructor() {
    for (const portal of SUPPORTED_PORTALS) {
      this.portals.set(portal.portalId, portal);
    }
  }

  /**
   * Get all registered portals
   */
  getAllPortals(): SupportedPortal[] {
    return Array.from(this.portals.values());
  }

  /**
   * Retrieve portal by ID
   */
  getPortalById(portalId: string): SupportedPortal | null {
    return this.portals.get(portalId) || null;
  }

  /**
   * Validate a URL against the official portal registry
   * Enforces HTTPS and whitelisted government domains
   */
  validateUrl(inputUrl: string): {
    isValid: boolean;
    isHttps: boolean;
    portal: SupportedPortal | null;
    status: PortalStatus;
    domain: string;
    warningMessage?: string;
  } {
    try {
      const parsed = new URL(inputUrl);
      const isHttps = parsed.protocol === 'https:';
      const domain = parsed.hostname.toLowerCase();

      if (!isHttps) {
        return {
          isValid: false,
          isHttps: false,
          portal: null,
          status: 'unsupported',
          domain,
          warningMessage: 'Insecure connection (HTTP). Gram Sathi only interacts with secure HTTPS official portals.',
        };
      }

      // Check if domain belongs to a registered portal
      for (const portal of this.portals.values()) {
        const matchesDomain = portal.domains.some(
          (d) => domain === d || domain.endsWith(`.${d}`)
        );
        if (matchesDomain) {
          return {
            isValid: true,
            isHttps: true,
            portal,
            status: portal.status,
            domain,
          };
        }
      }

      // If it's another official .gov.in or .nic.in domain not yet automated:
      if (domain.endsWith('.gov.in') || domain.endsWith('.nic.in')) {
        return {
          isValid: true,
          isHttps: true,
          portal: null,
          status: 'guidance_mode',
          domain,
          warningMessage:
            'This is an official government portal, but automated form filling is not yet registered for this portal. Gram Sathi will guide you in Guidance Mode.',
        };
      }

      // Arbitrary untrusted domain
      return {
        isValid: false,
        isHttps: true,
        portal: null,
        status: 'unsupported',
        domain,
        warningMessage:
          'Automated form filling is disabled for this domain for your safety. Only approved official government portals may be automated.',
      };
    } catch {
      return {
        isValid: false,
        isHttps: false,
        portal: null,
        status: 'unsupported',
        domain: inputUrl,
        warningMessage: 'Invalid URL format.',
      };
    }
  }

  /**
   * Find portal by scheme or text keywords (e.g. "scholarship", "nsp", "kisan")
   */
  findPortalByKeyword(query: string): SupportedPortal | null {
    const q = query.toLowerCase().trim();
    if (q.includes('scholarship') || q.includes('nsp') || q.includes('छात्रवृत्ति')) {
      return this.portals.get('nsp') || null;
    }
    if (q.includes('kisan') || q.includes('pmkisan') || q.includes('किसान')) {
      return this.portals.get('pm-kisan') || null;
    }
    if (q.includes('kcc') || q.includes('credit card')) {
      return this.portals.get('kcc') || null;
    }
    return null;
  }
}

export const supportedPortalRegistry = new SupportedPortalRegistry();
