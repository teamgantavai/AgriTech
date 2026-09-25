// ================================================================
// Profile Field Definitions & Completion Calculator
// Configures field order, multilingual voice prompts & smart skip logic
// ================================================================

import type { CitizenProfile, InterviewFieldDefinition, ProfileType, ProfileCompletionStats, FieldStatus } from '../types/profile';

export const PROFILE_INTERVIEW_FIELDS: InterviewFieldDefinition[] = [
  // ── 1. PERSONAL INFORMATION ──
  {
    key: 'full_name',
    label: 'Full Name',
    labelHi: 'पूरा नाम',
    labelPa: 'ਪੂਰਾ ਨਾਮ',
    section: 'personal',
    type: 'text',
    questionPromptHi: 'नमस्ते! सबसे पहले, आपका पूरा नाम क्या है?',
    questionPromptPa: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਸਭ ਤੋਂ ਪਹਿਲਾਂ, ਤੁਹਾਡਾ ਪੂਰਾ ਨਾਮ ਕੀ ਹੈ?',
    questionPromptEn: 'Hello! First, what is your full legal name?',
    extractHint: 'Extract full legal name exactly as confirmed, do not translate or alter spelling.',
    requiredFor: ['general', 'student', 'farmer', 'all'],
  },
  {
    key: 'date_of_birth',
    label: 'Date of Birth',
    labelHi: 'जन्म तिथि',
    labelPa: 'ਜਨਮ ਮਿਤੀ',
    section: 'personal',
    type: 'date',
    questionPromptHi: 'आपकी जन्म तिथि (Date of Birth) क्या है?',
    questionPromptPa: 'ਤੁਹਾਡੀ ਜਨਮ ਮਿਤੀ (Date of Birth) ਕੀ ਹੈ?',
    questionPromptEn: 'What is your date of birth?',
    extractHint: 'Normalize to YYYY-MM-DD but confirm with user in conversational format (e.g. 12 March 2007).',
    requiredFor: ['general', 'student', 'farmer', 'all'],
  },
  {
    key: 'gender',
    label: 'Gender',
    labelHi: 'लिंग',
    labelPa: 'ਲਿੰਗ',
    section: 'personal',
    type: 'select',
    options: ['male', 'female', 'other', 'prefer_not_to_say'],
    questionPromptHi: 'आपका जेंडर क्या है — पुरुष, महिला या अन्य?',
    questionPromptPa: 'ਤੁਹਾਡਾ ਜੈਂਡਰ ਕੀ ਹੈ — ਪੁਰਸ਼, ਔਰਤ ਜਾਂ ਹੋਰ?',
    questionPromptEn: 'What is your gender — Male, Female, or Other?',
    extractHint: 'Values: male, female, other, prefer_not_to_say',
    requiredFor: ['general', 'student', 'farmer', 'all'],
  },
  {
    key: 'mobile',
    label: 'Mobile Number',
    labelHi: 'मोबाइल नंबर',
    labelPa: 'ਮੋਬਾਈਲ ਨੰਬਰ',
    section: 'personal',
    type: 'text',
    questionPromptHi: 'सरकारी संदेशों के लिए आपका 10 अंकों का मोबाइल नंबर क्या है?',
    questionPromptPa: 'ਸਰਕਾਰੀ ਸੂਚਨਾਵਾਂ ਲਈ ਤੁਹਾਡਾ 10 ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ ਕੀ ਹੈ?',
    questionPromptEn: 'What is your 10-digit mobile number for official alerts?',
    extractHint: '10 digit Indian mobile number',
    requiredFor: ['general', 'student', 'farmer', 'all'],
  },
  {
    key: 'email',
    label: 'Email (Optional)',
    labelHi: 'ईमेल (वैकल्पिक)',
    labelPa: 'ਈਮੇਲ (ਵਿਕਲਪਿਕ)',
    section: 'personal',
    type: 'text',
    questionPromptHi: 'क्या आपका कोई ईमेल पता है? यदि नहीं है तो आप Skip कह सकते हैं।',
    questionPromptPa: 'ਕੀ ਤੁਹਾਡਾ ਕੋਈ ਈਮੇਲ ਪਤਾ ਹੈ? ਜੇਕਰ ਨਹੀਂ ਹੈ ਤਾਂ ਤੁਸੀਂ ਛੱਡ ਸਕਦੇ ਹੋ।',
    questionPromptEn: 'Do you have an email address? If not, you can say skip.',
    extractHint: 'Valid email string or skip',
    requiredFor: ['general', 'student', 'farmer', 'all'],
  },

  // ── 2. ADDRESS ──
  {
    key: 'state',
    label: 'State',
    labelHi: 'राज्य',
    labelPa: 'ਰਾਜ',
    section: 'address',
    type: 'text',
    questionPromptHi: 'आप किस राज्य से हैं?',
    questionPromptPa: 'ਤੁਸੀਂ ਕਿਸ ਰਾਜ ਤੋਂ ਹੋ?',
    questionPromptEn: 'Which state do you reside in?',
    extractHint: 'Indian state name, e.g. Punjab, Rajasthan, Haryana, Bihar, Uttar Pradesh, etc.',
    requiredFor: ['general', 'student', 'farmer', 'all'],
  },
  {
    key: 'district',
    label: 'District',
    labelHi: 'ज़िला',
    labelPa: 'ਜ਼ਿਲ੍ਹਾ',
    section: 'address',
    type: 'text',
    questionPromptHi: 'आपका ज़िला (District) कौन सा है?',
    questionPromptPa: 'ਤੁਹਾਡਾ ਜ਼ਿਲ੍ਹਾ ਕਿਹੜਾ ਹੈ?',
    questionPromptEn: 'What is your district?',
    extractHint: 'District name within the confirmed state.',
    requiredFor: ['general', 'student', 'farmer', 'all'],
  },
  {
    key: 'sub_district',
    label: 'Tehsil / Sub-district',
    labelHi: 'तहसील / उप-ज़िला',
    labelPa: 'ਤਹਿਸੀਲ / ਸਬ-ਡਵੀਜ਼ਨ',
    section: 'address',
    type: 'text',
    questionPromptHi: 'आपकी तहसील या ब्लॉक का नाम क्या है?',
    questionPromptPa: 'ਤੁਹਾਡੀ ਤਹਿਸੀਲ ਜਾਂ ਬਲਾਕ ਦਾ ਨਾਮ ਕੀ ਹੈ?',
    questionPromptEn: 'What is your tehsil or sub-district?',
    extractHint: 'Tehsil, taluka or block name.',
    requiredFor: ['general', 'student', 'farmer', 'all'],
  },
  {
    key: 'village_city',
    label: 'Village / Town / City',
    labelHi: 'गाँव / कस्बा / शहर',
    labelPa: 'ਪਿੰਡ / ਕਸਬਾ / ਸ਼ਹਿਰ',
    section: 'address',
    type: 'text',
    questionPromptHi: 'आपके गाँव या शहर का नाम क्या है?',
    questionPromptPa: 'ਤੁਹਾਡੇ ਪਿੰਡ ਜਾਂ ਸ਼ਹਿਰ ਦਾ ਨਾਮ ਕੀ ਹੈ?',
    questionPromptEn: 'What is your village, town, or city name?',
    extractHint: 'Locality name',
    requiredFor: ['general', 'student', 'farmer', 'all'],
  },
  {
    key: 'pin_code',
    label: 'PIN Code',
    labelHi: 'पिन कोड',
    labelPa: 'ਪਿੰਨ ਕੋਡ',
    section: 'address',
    type: 'text',
    questionPromptHi: 'आपके क्षेत्र का 6 अंकों का पिन कोड (PIN Code) क्या है?',
    questionPromptPa: 'ਤੁਹਾਡੇ ਇਲਾਕੇ ਦਾ 6 ਅੰਕਾਂ ਦਾ ਪਿੰਨ ਕੋਡ ਕੀ ਹੈ?',
    questionPromptEn: 'What is your 6-digit postal PIN code?',
    extractHint: '6 digit postal PIN code',
    requiredFor: ['general', 'student', 'farmer', 'all'],
  },
  {
    key: 'address',
    label: 'Complete Address',
    labelHi: 'पूरा पता',
    labelPa: 'ਪੂਰਾ ਪਤਾ',
    section: 'address',
    type: 'text',
    questionPromptHi: 'आपका मकान नंबर, गली या स्थानीय पता क्या है?',
    questionPromptPa: 'ਤੁਹਾਡਾ ਮਕਾਨ ਨੰਬਰ, ਗਲੀ ਜਾਂ ਸਥਾਨਕ ਪਤਾ ਕੀ ਹੈ?',
    questionPromptEn: 'What is your house number, street, or specific local address?',
    extractHint: 'Street address line',
    requiredFor: ['general', 'student', 'farmer', 'all'],
  },

  // ── 3. EDUCATION ──
  {
    key: 'highest_qualification',
    label: 'Highest Qualification',
    labelHi: 'उच्चतम योग्यता',
    labelPa: 'ਉੱਚਤਮ ਯੋਗਤਾ',
    section: 'education',
    type: 'select',
    options: ['Below 10th', '10th Pass', '12th Pass', 'Diploma', 'Graduate / B.Tech / B.Sc / BA', 'Post Graduate / Masters', 'Doctorate / PhD', 'No Formal Education'],
    questionPromptHi: 'आपकी उच्चतम शैक्षिक योग्यता (Highest Qualification) क्या है?',
    questionPromptPa: 'ਤੁਹਾਡੀ ਸਭ ਤੋਂ ਉੱਚੀ ਵਿੱਦਿਅਕ ਯੋਗਤਾ ਕੀ ਹੈ?',
    questionPromptEn: 'What is your highest educational qualification?',
    extractHint: 'Highest completed or pursuing degree/level.',
    requiredFor: ['general', 'student', 'all'],
  },
  {
    key: 'course',
    label: 'Course / Class',
    labelHi: 'कोर्स / कक्षा',
    labelPa: 'ਕੋਰਸ / ਜਮਾਤ',
    section: 'education',
    type: 'text',
    questionPromptHi: 'आपने कौन सा कोर्स या विषय चुना है?',
    questionPromptPa: 'ਤੁਸੀਂ ਕਿਹੜਾ ਕੋਰਸ ਜਾਂ ਵਿਸ਼ਾ ਚੁਣਿਆ ਹੈ?',
    questionPromptEn: 'What course, stream, or class are you studying or have completed?',
    extractHint: 'Degree / stream name, e.g. B.Tech Computer Science, Arts, Agriculture, etc.',
    requiredFor: ['student', 'all'],
  },
  {
    key: 'institution',
    label: 'School / College / University',
    labelHi: 'संस्थान / कॉलेज',
    labelPa: 'ਸੰਸਥਾ / ਕਾਲਜ',
    section: 'education',
    type: 'text',
    questionPromptHi: 'आपके स्कूल, कॉलेज या विश्वविद्यालय का नाम क्या है?',
    questionPromptPa: 'ਤੁਹਾਡੇ ਸਕੂਲ, ਕਾਲਜ ਜਾਂ ਯੂਨੀਵਰਸਿਟੀ ਦਾ ਨਾਮ ਕੀ ਹੈ?',
    questionPromptEn: 'What is the name of your school, college, or university?',
    extractHint: 'Educational institution name.',
    requiredFor: ['student', 'all'],
  },
  {
    key: 'passing_year',
    label: 'Passing Year',
    labelHi: 'उत्तीर्ण वर्ष',
    labelPa: 'ਪਾਸ ਹੋਣ ਦਾ ਸਾਲ',
    section: 'education',
    type: 'number',
    questionPromptHi: 'आपने किस वर्ष में पास किया या पूरा करेंगे?',
    questionPromptPa: 'ਤੁਸੀਂ ਕਿਸ ਸਾਲ ਪਾਸ ਕੀਤਾ ਜਾਂ ਪੂਰਾ ਕਰੋਗੇ?',
    questionPromptEn: 'In which year did you pass or do you expect to complete?',
    extractHint: '4 digit year, e.g. 2024, 2025',
    requiredFor: ['student', 'all'],
  },

  // ── 4. SOCIAL & ELIGIBILITY ──
  {
    key: 'occupation',
    label: 'Occupation',
    labelHi: 'व्यवसाय / कार्य',
    labelPa: 'ਕਿੱਤਾ / ਕੰਮ',
    section: 'eligibility',
    type: 'select',
    options: ['Farmer', 'Student', 'Daily Wage Worker', 'Self Employed / Business', 'Private Sector Employee', 'Government Employee', 'Homemaker', 'Retired / Pensioner', 'Unemployed'],
    questionPromptHi: 'आपका मुख्य व्यवसाय या कार्य क्या है, जैसे किसान, विद्यार्थी, या अन्य?',
    questionPromptPa: 'ਤੁਹਾਡਾ ਮੁੱਖ ਕੰਮ ਕੀ ਹੈ, ਜਿਵੇਂ ਕਿਸਾਨ, ਵਿਦਿਆਰਥੀ, ਜਾਂ ਹੋਰ?',
    questionPromptEn: 'What is your primary occupation (e.g. Farmer, Student, Self-employed)?',
    extractHint: 'Primary occupation category.',
    requiredFor: ['general', 'student', 'farmer', 'all'],
  },
  {
    key: 'category',
    label: 'Social Category',
    labelHi: 'सामाजिक वर्ग (Category)',
    labelPa: 'ਸਮਾਜਿਕ ਸ਼੍ਰੇਣੀ',
    section: 'eligibility',
    type: 'select',
    options: ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'],
    questionPromptHi: 'सरकारी योजनाओं की पात्रता के लिए आपकी सामाजिक श्रेणी क्या है — General, OBC, SC, ST या EWS?',
    questionPromptPa: 'ਸਰਕਾਰੀ ਸਕੀਮਾਂ ਲਈ ਤੁਹਾਡੀ ਸ਼੍ਰੇਣੀ ਕਿਹੜੀ ਹੈ — General, OBC, SC, ST ਜਾਂ EWS?',
    questionPromptEn: 'For welfare scheme eligibility, what is your social category (General, OBC, SC, ST, EWS)?',
    extractHint: 'Category: General, OBC, SC, ST, EWS, Other',
    requiredFor: ['general', 'student', 'farmer', 'all'],
  },
  {
    key: 'annual_family_income',
    label: 'Annual Family Income (₹)',
    labelHi: 'वार्षिक पारिवारिक आय (₹)',
    labelPa: 'ਸਾਲਾਨਾ ਪਰਿਵਾਰਕ ਆਮਦਨ (₹)',
    section: 'eligibility',
    type: 'number',
    questionPromptHi: 'आपके परिवार की कुल वार्षिक आय लगभग कितनी है (रुपयों में)?',
    questionPromptPa: 'ਤੁਹਾਡੇ ਪਰਿਵਾਰ ਦੀ ਕੁੱਲ ਸਾਲਾਨਾ ਆਮਦਨ ਲਗਭਗ ਕਿੰਨੀ ਹੈ?',
    questionPromptEn: 'Approximately what is your total annual family income in Rupees?',
    extractHint: 'Annual family income in INR number, e.g. 150000 or 2.5 lakh -> 250000',
    requiredFor: ['general', 'student', 'farmer', 'all'],
  },

  // ── 5. OPTIONAL FARMER PROFILE ──
  {
    key: 'farmer_land_details',
    label: 'Landholding Details',
    labelHi: 'कृषि भूमि विवरण',
    labelPa: 'ਜ਼ਮੀਨ ਦਾ ਵੇਰਵਾ',
    section: 'farmer',
    type: 'text',
    questionPromptHi: 'आपके पास कितनी कृषि भूमि (ज़मीन) है (एकड़ या बीघा में)?',
    questionPromptPa: 'ਤੁਹਾਡੇ ਕੋਲ ਕਿੰਨੀ ਖੇਤੀਬਾੜੀ ਜ਼ਮੀਨ ਹੈ (ਏਕੜ ਜਾਂ ਬਿੱਘਾ ਵਿੱਚ)?',
    questionPromptEn: 'How much agricultural land do you own or cultivate (in acres/hectares)?',
    extractHint: 'Land size with unit e.g. 2 acres, 5 bigha, marginal landholder',
    requiredFor: ['farmer', 'all'],
  },
  {
    key: 'farmer_crops',
    label: 'Primary Crops Grown',
    labelHi: 'मुख्य फसलें',
    labelPa: 'ਮੁੱਖ ਫਸਲਾਂ',
    section: 'farmer',
    type: 'text',
    questionPromptHi: 'आप मुख्य रूप से कौन सी फसलें उगाते हैं, जैसे गेहूँ, धान, कपास या सरसों?',
    questionPromptPa: 'ਤੁਸੀਂ ਮੁੱਖ ਤੌਰ ਤੇ ਕਿਹੜੀਆਂ ਫਸਲਾਂ ਉਗਾਉਂਦੇ ਹੋ, ਜਿਵੇਂ ਕਣਕ, ਝੋਨਾ, ਜਾਂ ਨਰਮਾ?',
    questionPromptEn: 'What are the main crops you grow, such as wheat, rice, mustard, or cotton?',
    extractHint: 'Crops comma-separated',
    requiredFor: ['farmer', 'all'],
  },
  {
    key: 'farmer_irrigation',
    label: 'Irrigation Source',
    labelHi: 'सिंचाई का साधन',
    labelPa: 'ਸਿੰਚਾਈ ਦਾ ਸਾਧਨ',
    section: 'farmer',
    type: 'select',
    options: ['Tube Well / Borewell', 'Canal Water', 'Rainfed / Monsoon', 'Drip / Sprinkler', 'Pond / River'],
    questionPromptHi: 'आपके खेत में सिंचाई का क्या मुख्य साधन है — ट्यूबवेल, नहर, या वर्षा?',
    questionPromptPa: 'ਤੁਹਾਡੇ ਖੇਤ ਵਿੱਚ ਸਿੰਚਾਈ ਦਾ ਮੁੱਖ ਸਾਧਨ ਕੀ ਹੈ — ਟਿਊਬਵੈੱਲ, ਨਹਿਰ, ਜਾਂ ਮੀਂਹ?',
    questionPromptEn: 'What is your primary source of irrigation (tube well, canal, rainfed, drip)?',
    extractHint: 'Irrigation type',
    requiredFor: ['farmer', 'all'],
  },
  {
    key: 'farmer_type',
    label: 'Farmer Category',
    labelHi: 'किसान वर्ग',
    labelPa: 'ਕਿਸਾਨ ਸ਼੍ਰੇਣੀ',
    section: 'farmer',
    type: 'select',
    options: ['Marginal (< 1 hectare)', 'Small (1 - 2 hectares)', 'Semi-Medium (2 - 4 hectares)', 'Medium (4 - 10 hectares)', 'Large (> 10 hectares)', 'Tenant / Sharecropper'],
    questionPromptHi: 'आप किस श्रेणी के किसान हैं — सीमांत (Marginal), लघु (Small) या मध्यम?',
    questionPromptPa: 'ਤੁਸੀਂ ਕਿਸ ਸ਼੍ਰੇਣੀ ਦੇ ਕਿਸਾਨ ਹੋ — ਸੀਮਾਂਤ, ਛੋਟੇ ਜਾਂ ਦਰਮਿਆਨੇ?',
    questionPromptEn: 'Which farmer category describes you: Marginal (<1 ha), Small (1-2 ha), Medium or Large?',
    extractHint: 'Farmer size category',
    requiredFor: ['farmer', 'all'],
  },
];

/**
 * Filter fields relevant to the chosen profile type
 */
export function getRelevantFields(profileType: ProfileType = 'general', isFarmer: boolean = false): InterviewFieldDefinition[] {
  return PROFILE_INTERVIEW_FIELDS.filter((f) => {
    if (f.section === 'farmer') {
      return isFarmer || profileType === 'farmer' || profileType === 'all';
    }
    if (f.section === 'education') {
      if (profileType === 'student') return true;
      if (f.key === 'highest_qualification') return true;
      return profileType === 'all';
    }
    return true;
  });
}

/**
 * Calculate completion score strictly based on relevant fields
 */
export function calculateProfileCompletion(
  profile: Partial<CitizenProfile>,
  verifications: Record<string, { status: FieldStatus; value?: any }> = {}
): ProfileCompletionStats {
  const isFarmer = Boolean(profile.is_farmer || profile.profile_type === 'farmer' || profile.occupation?.toLowerCase().includes('farmer') || profile.occupation?.toLowerCase().includes('kisan'));
  const profileType: ProfileType = profile.profile_type || (isFarmer ? 'farmer' : 'general');
  const relevantFields = getRelevantFields(profileType, isFarmer);

  let completedCount = 0;
  const missingFields: { key: string; label: string; section: string }[] = [];
  const completedList: { key: string; label: string; value: any; status: FieldStatus }[] = [];

  for (const field of relevantFields) {
    const rawVal = profile[field.key];
    const verif = verifications[field.key];
    const isFilled = rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '';

    if (isFilled) {
      completedCount++;
      completedList.push({
        key: field.key,
        label: field.label,
        value: rawVal,
        status: verif?.status || 'CONFIRMED',
      });
    } else {
      missingFields.push({
        key: field.key,
        label: field.label,
        section: field.section,
      });
    }
  }

  const totalFields = relevantFields.length;
  const percentage = totalFields > 0 ? Math.round((completedCount / totalFields) * 100) : 0;

  return {
    percentage,
    completedFields: completedCount,
    totalFields,
    missingFields,
    completedList,
  };
}

/**
 * Pre-configured Form Field Requirements for Government Schemes
 * Form Copilot maps Gram Sathi Profile -> Government Form Fields
 */
export const FORM_FIELD_MAPPINGS: Record<string, { title: string; requiredFields: (keyof CitizenProfile)[] }> = {
  nsp: {
    title: 'National Scholarship Portal (NSP)',
    requiredFields: [
      'full_name',
      'date_of_birth',
      'gender',
      'state',
      'district',
      'highest_qualification',
      'course',
      'institution',
      'category',
      'annual_family_income',
    ],
  },
  'pm-kisan': {
    title: 'PM-KISAN Samman Nidhi',
    requiredFields: [
      'full_name',
      'date_of_birth',
      'gender',
      'mobile',
      'state',
      'district',
      'sub_district',
      'village_city',
      'farmer_land_details',
      'category',
    ],
  },
  'ayushman-bharat': {
    title: 'Ayushman Bharat (PM-JAY)',
    requiredFields: [
      'full_name',
      'date_of_birth',
      'gender',
      'mobile',
      'state',
      'district',
      'village_city',
      'pin_code',
      'annual_family_income',
      'category',
    ],
  },
  'ration-card': {
    title: 'National Food Security (Ration Card)',
    requiredFields: [
      'full_name',
      'date_of_birth',
      'gender',
      'mobile',
      'state',
      'district',
      'sub_district',
      'village_city',
      'pin_code',
      'address',
      'annual_family_income',
      'category',
      'occupation',
    ],
  },
};
