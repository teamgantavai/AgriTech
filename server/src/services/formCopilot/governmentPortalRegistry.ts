// ================================================================
// GovernmentPortalRegistry — Verified Official Indian Government Portals
// CRITICAL: Only portals listed here can be opened by the Form Copilot.
// The AI is NOT allowed to navigate to arbitrary domains.
// ================================================================

export type PortalMode = 'browser_assist' | 'guidance';
export type PortalStatus = 'supported' | 'coming_soon' | 'guidance_mode';

export interface PortalCapabilities {
  formInspection: boolean;
  fieldFilling: boolean;
  documentUpload: boolean;
  multiPage: boolean;
  captchaStop: boolean; // Always true
  otpStop: boolean;     // Always true
}

export interface GovernmentPortal {
  id: string;
  name: string;
  nameHi: string;
  officialDomain: string;
  officialUrl: string;
  allowedUrlPrefixes: string[]; // Only these URL patterns may be visited
  category: string;
  categoryIcon: string;
  description: string;
  descriptionHi: string;
  mode: PortalMode;
  status: PortalStatus;
  capabilities: PortalCapabilities;
  loginUrl?: string;
  applicationUrl?: string;
  // Field mapping hints for the AI
  formFieldHints?: Record<string, string>;
}

const DEFAULT_CAPABILITIES: PortalCapabilities = {
  formInspection: true,
  fieldFilling: true,
  documentUpload: true,
  multiPage: true,
  captchaStop: true,
  otpStop: true,
};

export const GOVERNMENT_PORTAL_REGISTRY: GovernmentPortal[] = [
  {
    id: 'nsp',
    name: 'National Scholarship Portal',
    nameHi: 'राष्ट्रीय छात्रवृत्ति पोर्टल',
    officialDomain: 'scholarships.gov.in',
    officialUrl: 'https://scholarships.gov.in',
    loginUrl: 'https://scholarships.gov.in/otrapplication/#/login-page',
    applicationUrl: 'https://scholarships.gov.in/ApplicationForm/',
    allowedUrlPrefixes: [
      'https://scholarships.gov.in',
      'https://scholarships.nic.in',
      'https://nsp.gov.in',
    ],
    category: 'Scholarships',
    categoryIcon: '🎓',
    description: 'Central & state government scholarships for Pre-Matric, Post-Matric, and Merit students.',
    descriptionHi: 'प्री-मैट्रिक, पोस्ट-मैट्रिक और मेधावी छात्रों के लिए केंद्र एवं राज्य सरकार की छात्रवृत्तियाँ।',
    mode: 'browser_assist',
    status: 'supported',
    capabilities: DEFAULT_CAPABILITIES,
    formFieldHints: {
      'Applicant Name': 'full_name',
      'Date of Birth': 'date_of_birth',
      'Gender': 'gender',
      'Father Name': 'father_name',
      'Mother Name': 'mother_name',
      'Mobile No': 'mobile',
      'Email': 'email',
      'State': 'state',
      'District': 'district',
      'Category': 'category',
      'Annual Income': 'annual_family_income',
      'Institute Name': 'institution',
      'Course Name': 'course',
      'Bank Account': 'bank_account_number',
      'IFSC Code': 'bank_ifsc',
    },
  },
  {
    id: 'pm-kisan',
    name: 'PM-KISAN Samman Nidhi',
    nameHi: 'पीएम-किसान सम्मान निधि',
    officialDomain: 'pmkisan.gov.in',
    officialUrl: 'https://pmkisan.gov.in',
    loginUrl: 'https://pmkisan.gov.in/FarmerStatus.aspx',
    applicationUrl: 'https://pmkisan.gov.in/RegistrationFormNew.aspx',
    allowedUrlPrefixes: [
      'https://pmkisan.gov.in',
    ],
    category: 'Farmer Schemes',
    categoryIcon: '🌾',
    description: 'Direct income support of ₹6,000/year to landholding farmer families.',
    descriptionHi: 'भूमिधारक किसान परिवारों को प्रति वर्ष ₹6,000 की प्रत्यक्ष आय सहायता।',
    mode: 'browser_assist',
    status: 'supported',
    capabilities: DEFAULT_CAPABILITIES,
    formFieldHints: {
      'Farmer Name': 'full_name',
      'Father Name': 'father_name',
      'Gender': 'gender',
      'State': 'state',
      'District': 'district',
      'Sub District': 'sub_district',
      'Village': 'village_city',
      'Mobile': 'mobile',
      'Aadhaar': 'aadhaar_number',
      'Bank Account': 'bank_account_number',
      'IFSC': 'bank_ifsc',
    },
  },
  {
    id: 'kcc',
    name: 'Kisan Credit Card',
    nameHi: 'किसान क्रेडिट कार्ड',
    officialDomain: 'myscheme.gov.in',
    officialUrl: 'https://myscheme.gov.in/schemes/kcc',
    allowedUrlPrefixes: [
      'https://myscheme.gov.in',
    ],
    category: 'Credit & Loans',
    categoryIcon: '💳',
    description: 'Subsidized agricultural credit card at 4% interest for farmers.',
    descriptionHi: 'किसानों के लिए 4% ब्याज दर पर कृषि क्रेडिट कार्ड।',
    mode: 'guidance',
    status: 'guidance_mode',
    capabilities: { ...DEFAULT_CAPABILITIES, fieldFilling: false },
  },
  {
    id: 'ayushman',
    name: 'Ayushman Bharat PM-JAY',
    nameHi: 'आयुष्मान भारत पीएम-जेएवाई',
    officialDomain: 'setu.pmjay.gov.in',
    officialUrl: 'https://setu.pmjay.gov.in',
    allowedUrlPrefixes: [
      'https://setu.pmjay.gov.in',
      'https://pmjay.gov.in',
    ],
    category: 'Health',
    categoryIcon: '🏥',
    description: '₹5 Lakh free health coverage per family under government health assurance.',
    descriptionHi: 'सरकारी स्वास्थ्य बीमा के तहत प्रति परिवार ₹5 लाख का मुफ़्त इलाज।',
    mode: 'guidance',
    status: 'coming_soon',
    capabilities: { ...DEFAULT_CAPABILITIES, fieldFilling: false },
  },
  {
    id: 'pmay',
    name: 'PM Awas Yojana (Grameen)',
    nameHi: 'प्रधानमंत्री आवास योजना (ग्रामीण)',
    officialDomain: 'pmayg.nic.in',
    officialUrl: 'https://pmayg.nic.in',
    allowedUrlPrefixes: [
      'https://pmayg.nic.in',
    ],
    category: 'Housing',
    categoryIcon: '🏠',
    description: 'Rural housing scheme providing financial assistance to build permanent houses.',
    descriptionHi: 'ग्रामीण आवास योजना — स्थायी घर बनाने के लिए वित्तीय सहायता।',
    mode: 'guidance',
    status: 'coming_soon',
    capabilities: { ...DEFAULT_CAPABILITIES, fieldFilling: false },
  },
];

export class GovernmentPortalRegistry {
  private portals: Map<string, GovernmentPortal>;

  constructor() {
    this.portals = new Map();
    for (const portal of GOVERNMENT_PORTAL_REGISTRY) {
      this.portals.set(portal.id, portal);
    }
  }

  getAll(): GovernmentPortal[] {
    return Array.from(this.portals.values());
  }

  getById(id: string): GovernmentPortal | null {
    return this.portals.get(id) ?? null;
  }

  /**
   * SECURITY CRITICAL: Validate that a URL is allowed for this portal.
   * Prevents the AI from navigating to arbitrary or malicious URLs.
   */
  validateUrl(portalId: string, url: string): { valid: boolean; reason?: string } {
    const portal = this.portals.get(portalId);
    if (!portal) {
      return { valid: false, reason: `Portal "${portalId}" is not in the verified registry.` };
    }
    if (!url.startsWith('https://')) {
      return { valid: false, reason: 'Only HTTPS URLs are permitted.' };
    }
    const allowed = portal.allowedUrlPrefixes.some((prefix) => url.startsWith(prefix));
    if (!allowed) {
      return {
        valid: false,
        reason: `URL "${url}" is not within the verified domain for ${portal.name} (${portal.officialDomain}).`,
      };
    }
    return { valid: true };
  }

  /**
   * Find the best portal for a scheme keyword.
   */
  findByKeyword(query: string): GovernmentPortal | null {
    const q = query.toLowerCase();
    if (q.includes('scholarship') || q.includes('nsp') || q.includes('छात्रवृत्ति')) return this.portals.get('nsp') ?? null;
    if (q.includes('kisan') || q.includes('pmkisan') || q.includes('किसान')) return this.portals.get('pm-kisan') ?? null;
    if (q.includes('kcc') || q.includes('credit card')) return this.portals.get('kcc') ?? null;
    if (q.includes('ayushman') || q.includes('health') || q.includes('pmjay')) return this.portals.get('ayushman') ?? null;
    if (q.includes('awas') || q.includes('housing') || q.includes('pmay')) return this.portals.get('pmay') ?? null;
    return null;
  }
}

export const governmentPortalRegistry = new GovernmentPortalRegistry();
