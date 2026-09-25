// ================================================================
// profileInterviewController.ts — Deterministic Profile Interview Controller
// Moves field progression OUT of the LLM into a deterministic state machine
// Satisfies Sections 1, 2, 3, 4, 16, 17, 20, 24, 25 of Citizen Profile UX
// ================================================================

import type { CitizenProfile } from '../types/profile';

export interface InterviewStep {
  field: keyof CitizenProfile;
  label: string;
  hindiLabel: string;
  category: 'CORE' | 'OPTIONAL' | 'FARMER';
  spokenQuestion: string;
  spokenHindiQuestion: string;
  formatValue?: (val: any) => string;
}

/**
 * Format dates nicely for human citizens (e.g. "2007-05-05" -> "5 May 2007")
 * Section 5: Never show raw technical database formats
 */
export function formatDateNicely(dateStr: any): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const year = match[1];
    const monthIdx = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${months[monthIdx]} ${year}`;
    }
  }
  return str;
}

/**
 * Format income into readable Indian Currency format (e.g. 85000 -> "₹85,000")
 */
export function formatIncomeNicely(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  const num = typeof val === 'number' ? val : parseInt(String(val).replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) return String(val);
  return `₹${num.toLocaleString('en-IN')}`;
}

/**
 * Citizen-friendly label mapper for any profile field
 * Section 5 & 23: NEVER display internal field names like date_of_birth
 */
export const FRIENDLY_FIELD_LABELS: Record<string, { en: string; hi: string }> = {
  full_name: { en: 'Full Name', hi: 'पूरा नाम' },
  date_of_birth: { en: 'Date of Birth', hi: 'जन्म तिथि' },
  gender: { en: 'Gender', hi: 'लिंग' },
  mobile: { en: 'Mobile Number', hi: 'मोबाइल नंबर' },
  state: { en: 'State', hi: 'राज्य' },
  district: { en: 'District', hi: 'ज़िला' },
  sub_district: { en: 'Tehsil', hi: 'तहसील' },
  village_city: { en: 'City or Village', hi: 'गाँव या शहर' },
  pin_code: { en: 'PIN Code', hi: 'पिन कोड' },
  address: { en: 'Address', hi: 'पूरा पता' },
  occupation: { en: 'Occupation', hi: 'व्यवसाय' },
  highest_qualification: { en: 'Education', hi: 'उच्चतम शिक्षा' },
  course: { en: 'Course', hi: 'कोर्स' },
  institution: { en: 'School / College', hi: 'संस्थान' },
  passing_year: { en: 'Passing Year', hi: 'उत्तीर्ण वर्ष' },
  category: { en: 'Social Category', hi: 'वर्ग / श्रेणी' },
  annual_family_income: { en: 'Family Income', hi: 'वार्षिक पारिवारिक आय' },
  is_farmer: { en: 'Farmer Status', hi: 'किसान स्थिति' },
  farmer_land_details: { en: 'Land Details', hi: 'ज़मीन का विवरण' },
  farmer_crops: { en: 'Primary Crops', hi: 'मुख्य फसलें' },
  farmer_irrigation: { en: 'Irrigation Facility', hi: 'सिंचाई साधन' },
  farmer_type: { en: 'Farmer Category', hi: 'किसान श्रेणी' },
};

export function getFriendlyFieldLabel(field: string, lang: 'en' | 'hi' = 'en'): string {
  const item = FRIENDLY_FIELD_LABELS[field];
  if (!item) {
    return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return lang === 'hi' ? item.hi : item.en;
}

export function formatFieldValueForCitizen(field: string, val: any): string {
  if (val === null || val === undefined || val === '') return 'Not provided';
  if (field === 'date_of_birth') return formatDateNicely(val);
  if (field === 'annual_family_income') return formatIncomeNicely(val);
  return String(val);
}

/**
 * Deterministic Question Order (Section 3)
 * The AI MUST NOT randomly decide the next field.
 */
export const DETERMINISTIC_INTERVIEW_STEPS: InterviewStep[] = [
  {
    field: 'full_name',
    label: 'Full Name',
    hindiLabel: 'पूरा नाम',
    category: 'CORE',
    spokenQuestion: 'What is your full name?',
    spokenHindiQuestion: 'Sabse pehle, aapka poora naam kya hai?',
  },
  {
    field: 'date_of_birth',
    label: 'Date of Birth',
    hindiLabel: 'जन्म तिथि',
    category: 'CORE',
    spokenQuestion: 'What is your date of birth?',
    spokenHindiQuestion: 'Aapki date of birth (janm tithi) kya hai?',
    formatValue: formatDateNicely,
  },
  {
    field: 'gender',
    label: 'Gender',
    hindiLabel: 'लिंग',
    category: 'CORE',
    spokenQuestion: 'What is your gender?',
    spokenHindiQuestion: 'Aapka gender kya hai? Male, Female ya Other?',
  },
  {
    field: 'mobile',
    label: 'Mobile Number',
    hindiLabel: 'मोबाइल नंबर',
    category: 'CORE',
    spokenQuestion: 'What is your mobile number?',
    spokenHindiQuestion: 'Aapka 10-digit mobile number kya hai?',
  },
  {
    field: 'state',
    label: 'State',
    hindiLabel: 'राज्य',
    category: 'CORE',
    spokenQuestion: 'Which state do you live in?',
    spokenHindiQuestion: 'Aap kis rajya (State) se hain?',
  },
  {
    field: 'district',
    label: 'District',
    hindiLabel: 'ज़िला',
    category: 'CORE',
    spokenQuestion: 'Which district are you from?',
    spokenHindiQuestion: 'Aapka zila (District) kaunsa hai?',
  },
  {
    field: 'village_city',
    label: 'City or Village',
    hindiLabel: 'गाँव या शहर',
    category: 'CORE',
    spokenQuestion: 'What is your village or town name?',
    spokenHindiQuestion: 'Aapke shahar ya gaon ka naam kya hai?',
  },
  {
    field: 'pin_code',
    label: 'PIN Code',
    hindiLabel: 'पिन कोड',
    category: 'CORE',
    spokenQuestion: 'What is your 6-digit postal PIN code?',
    spokenHindiQuestion: 'Aapka 6-digit PIN code kya hai?',
  },
  {
    field: 'address',
    label: 'Address',
    hindiLabel: 'पता',
    category: 'OPTIONAL',
    spokenQuestion: 'What is your complete street address?',
    spokenHindiQuestion: 'Aapka poora pata (Address) kya hai?',
  },
  {
    field: 'occupation',
    label: 'Occupation',
    hindiLabel: 'व्यवसाय',
    category: 'OPTIONAL',
    spokenQuestion: 'What is your current occupation?',
    spokenHindiQuestion: 'Aapka vyavsay (Occupation) kya hai? Jaise Farmer, Student, Self-employed ya Job?',
  },
  {
    field: 'highest_qualification',
    label: 'Education',
    hindiLabel: 'उच्चतम शिक्षा',
    category: 'OPTIONAL',
    spokenQuestion: 'What is your highest educational qualification?',
    spokenHindiQuestion: 'Aapki highest education (uchhatam shiksha) kya hai?',
  },
  {
    field: 'category',
    label: 'Category',
    hindiLabel: 'वर्ग / श्रेणी',
    category: 'OPTIONAL',
    spokenQuestion: 'What is your social category?',
    spokenHindiQuestion: 'Aap kis category se aate hain? General, OBC, SC, ST ya EWS?',
  },
  {
    field: 'annual_family_income',
    label: 'Family Income',
    hindiLabel: 'पारिवारिक आय',
    category: 'OPTIONAL',
    spokenQuestion: 'What is your annual family income?',
    spokenHindiQuestion: 'Aapke parivar ki saalana aay (Annual Family Income) kitni hai?',
    formatValue: formatIncomeNicely,
  },
];

/**
 * Controller class to manage the deterministic interview state
 */
export class ProfileInterviewController {
  private currentStepIndex = 0;
  private skippedFields: Set<string> = new Set();
  private confirmedFields: Map<string, any> = new Map();
  private profile: Partial<CitizenProfile> = {};

  constructor(initialProfile: Partial<CitizenProfile> = {}) {
    this.profile = { ...initialProfile };
  }

  /**
   * Updates profile baseline (e.g. after manual edits or document extractions)
   */
  public updateProfileBaseline(profile: Partial<CitizenProfile>) {
    this.profile = { ...this.profile, ...profile };
  }

  /**
   * Find the next required field that hasn't been filled or skipped.
   * Section 16: Manual + AI should work together seamlessly.
   */
  public getNextStep(): InterviewStep | null {
    for (let i = 0; i < DETERMINISTIC_INTERVIEW_STEPS.length; i++) {
      const step = DETERMINISTIC_INTERVIEW_STEPS[i];
      const fieldKey = step.field;

      // If user already skipped this question
      if (this.skippedFields.has(fieldKey as string)) {
        continue;
      }

      // If already has a value in profile
      const val = this.profile[fieldKey];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        continue;
      }

      this.currentStepIndex = i;
      return step;
    }
    return null;
  }

  /**
   * Get already completed fields summary for natural introduction
   * Section 2 & 16: "Your name and location are already saved..."
   */
  public getIntroductoryMessage(lang: 'hi' | 'en' = 'hi'): { greeting: string; questionText: string } {
    const nextStep = this.getNextStep();
    if (!nextStep) {
      return {
        greeting: lang === 'hi'
          ? 'Aapka profile pehle se complete hai! Agar aap kuch update karna chahte hain toh batayein.'
          : 'Your profile is already complete! Let me know if you would like to update anything.',
        questionText: '',
      };
    }

    const hasName = Boolean(this.profile.full_name);
    const hasLocation = Boolean(this.profile.state || this.profile.district);

    let greeting = '';
    if (hasName && hasLocation) {
      greeting = lang === 'hi'
        ? `Namaste! Aapka naam aur location pehle se saved hai. Chaliye baaki zaroori jaankari complete karte hain.`
        : `Namaste! Your name and location are already saved. Let's complete the remaining details.`;
    } else if (hasName) {
      greeting = lang === 'hi'
        ? `Namaste! Main aapka Gram Sathi profile complete karne mein help karunga.`
        : `Namaste! I will help you complete your Gram Sathi profile.`;
    } else {
      greeting = lang === 'hi'
        ? `Namaste! Main aapka Gram Sathi profile complete karne mein help karunga. Main ek-ek information poochunga aur save karne se pehle aapse confirm karunga.`
        : `Namaste! I will help you complete your Gram Sathi profile. I will ask simple questions and confirm each one before saving.`;
    }

    const questionText = lang === 'hi' ? nextStep.spokenHindiQuestion : nextStep.spokenQuestion;
    return { greeting, questionText };
  }

  /**
   * Record confirmed field (Section 21 & 22: Optimistic update)
   */
  public confirmField(field: string, value: any) {
    this.confirmedFields.set(field, value);
    (this.profile as any)[field] = value;
  }

  /**
   * Record skipped field (Section 17: Skip support)
   */
  public skipField(field: string) {
    this.skippedFields.add(field);
  }

  /**
   * Get list of skipped fields to display at the end (Section 17)
   */
  public getSkippedFields(): InterviewStep[] {
    return DETERMINISTIC_INTERVIEW_STEPS.filter((s) => this.skippedFields.has(s.field as string));
  }
}
