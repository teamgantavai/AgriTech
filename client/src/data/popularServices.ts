// ================================================================
// popularServices.ts — Curated government services for instant browsing
// Simplified "What You Get" language directly matching citizen needs
// ================================================================

import SERVICES_HI from './services_hi.json';

export interface GovernmentServiceItem {
  id: string;
  title: string;
  category: string;
  forWhom: string;
  helpsWith: string;
  whatIsIt: string;
  whoCanGet: string[];
  whatYouGet: string[];
  whatPapers: string[];
  howToApply: string[];
  officialUrl: string;
  source: string;
}

export const POPULAR_SERVICES_HI: GovernmentServiceItem[] = SERVICES_HI as unknown as GovernmentServiceItem[];

export const POPULAR_SERVICES: GovernmentServiceItem[] = [
  {
    id: 'kcc',
    title: 'Kisan Credit Card (KCC)',
    category: 'Farming',
    forWhom: 'Farmers & Animal Keepers',
    helpsWith: 'Low-interest loans for farming inputs, seeds, fertilizers and equipment.',
    whatIsIt: 'A government card that provides farmers with affordable short-term credit from banks without high interest or complicated paperwork.',
    whoCanGet: [
      'All farmers (individual, joint, tenant farmers, and sharecroppers).',
      'Fishermen and animal husbandry / dairy farmers.',
      'Self Help Groups (SHGs) of farmers.',
    ],
    whatYouGet: [
      'Loans up to ₹3 Lakh at a subsidized 4% interest rate with prompt repayment.',
      'Collateral-free loan up to ₹1.60 Lakh without pledging land documents.',
      'ATM-enabled RuPay debit card for easy money withdrawal.',
    ],
    whatPapers: [
      'Aadhaar card or Voter ID',
      'Land revenue records (Khata / Khatauni / Jamabandi)',
      'Passport size photograph',
    ],
    howToApply: [
      'Visit your nearest rural bank, cooperative bank, or commercial bank branch.',
      'Ask for the 1-page simplified KCC application form.',
      'Attach land record copy and ID proof.',
      'The bank processes and issues the card within 14 days.',
    ],
    officialUrl: 'https://www.myscheme.gov.in/schemes/kcc',
    source: 'Ministry of Agriculture & Farmers Welfare',
  },
  {
    id: 'pm-kisan',
    title: 'PM-KISAN Samman Nidhi',
    category: 'Farming',
    forWhom: 'Landholding Farmer Families',
    helpsWith: 'Direct cash support of ₹6,000 every year directly in your bank account.',
    whatIsIt: 'A central government initiative providing income support to small and marginal farmer families across the country.',
    whoCanGet: [
      'Farmer families having cultivable landholding in their names.',
      'Bank account must be linked with Aadhaar and eKYC completed.',
    ],
    whatYouGet: [
      '₹6,000 every year sent in 3 equal installments of ₹2,000 directly into your bank account.',
      'Direct benefit transfer with no middlemen.',
    ],
    whatPapers: [
      'Aadhaar card',
      'Land ownership documents / Land records',
      'Bank account passbook (Aadhaar-seeded)',
    ],
    howToApply: [
      'Open the official PM-KISAN portal (pmkisan.gov.in) or visit your nearest CSC / Jan Seva Kendra.',
      'Click on "New Farmer Registration" and enter Aadhaar number.',
      'Fill your land details and bank account information.',
      'Complete biometric or OTP-based eKYC.',
    ],
    officialUrl: 'https://pmkisan.gov.in',
    source: 'Department of Agriculture & Farmers Welfare',
  },
  {
    id: 'pm-mudra',
    title: 'PM MUDRA Yojana',
    category: 'Loans',
    forWhom: 'Small Business Owners & Entrepreneurs',
    helpsWith: 'Collateral-free business loans up to ₹10 Lakh to start or expand a business.',
    whatIsIt: 'A government scheme facilitating micro-loans to non-corporate, non-farm small and micro enterprises.',
    whoCanGet: [
      'Any Indian citizen wishing to start a small business or shop.',
      'Existing small businesses, artisans, shopkeepers, and service providers.',
    ],
    whatYouGet: [
      'Shishu Loan: Up to ₹50,000 for starting new businesses.',
      'Kishore Loan: ₹50,000 to ₹5 Lakh for buying machinery/stock.',
      'Tarun Loan: ₹5 Lakh to ₹10 Lakh for growing established units.',
      'Zero collateral or third-party guarantee required.',
    ],
    whatPapers: [
      'Identity Proof (Aadhaar, Voter ID, PAN)',
      'Proof of Residence',
      'Business plan / estimate of machinery or goods to buy',
    ],
    howToApply: [
      'Prepare a simple quotation or list of items you want to buy for business.',
      'Visit any public sector bank, private bank, or NBFC branch.',
      'Fill the MUDRA application form and attach quotation and KYC papers.',
      'Alternatively, apply online at the Udyamimitra portal.',
    ],
    officialUrl: 'https://www.myscheme.gov.in/schemes/pmmy',
    source: 'Ministry of Finance',
  },
  {
    id: 'pm-svanidhi',
    title: 'PM SVANidhi (Street Vendor Loan)',
    category: 'Loans',
    forWhom: 'Street Vendors & Hawkers',
    helpsWith: 'Working capital loan up to ₹50,000 with interest subsidy for daily vendors.',
    whatIsIt: 'Special micro-credit facility enabling urban, peri-urban and rural street vendors to restart livelihoods with easy bank credit.',
    whoCanGet: [
      'Street vendors possessing a Certificate of Vending or Identity Card issued by Urban Local Bodies.',
      'Vendors who have been left out of survey but have a recommendation letter.',
    ],
    whatYouGet: [
      '1st loan: ₹10,000 repayable in 1 year.',
      '2nd loan: ₹20,000 upon timely repayment.',
      '3rd loan: Up to ₹50,000.',
      '7% interest subsidy credited directly to your bank account.',
    ],
    whatPapers: [
      'Aadhaar card',
      'Vending certificate or Local Body recommendation',
      'Bank account details',
    ],
    howToApply: [
      'Visit the PM SVANidhi portal or your local municipal office.',
      'Apply online through Common Service Centres (CSC).',
      'No collateral or security needed.',
    ],
    officialUrl: 'https://www.myscheme.gov.in/schemes/pm-svanidhi',
    source: 'Ministry of Housing and Urban Affairs',
  },
  {
    id: 'nsp-scholarship',
    title: 'National Scholarship Portal (NSP)',
    category: 'Education',
    forWhom: 'Students (Pre-Matric & Post-Matric)',
    helpsWith: 'Scholarships covering school/college fees and maintenance allowances.',
    whatIsIt: 'One-stop digital platform by Government of India providing central and state scholarships to students from diverse backgrounds.',
    whoCanGet: [
      'Students enrolled in recognized schools, colleges, ITIs, or universities.',
      'Scholarships available for SC, ST, OBC, Minority, and EWS students based on family income.',
      'Merit-based scholarships available for college entrance and higher education.',
    ],
    whatYouGet: [
      'Direct reimbursement of tuition fees.',
      'Monthly maintenance allowance for books and hostel expenses.',
      'Direct credit into the student’s own bank account.',
    ],
    whatPapers: [
      'Student Aadhaar card',
      'Income certificate from competent revenue authority',
      'Caste / category certificate (if applicable)',
      'Previous year mark sheet and admission fee receipt',
      'Bank passbook copy',
    ],
    howToApply: [
      'Visit scholarships.gov.in during the open application window (usually July–November).',
      'Register with Aadhaar and mobile number.',
      'Select eligible scheme and fill academic information.',
      'Submit and get verified by your school or college nodal officer.',
    ],
    officialUrl: 'https://scholarships.gov.in',
    source: 'Ministry of Electronics & IT / Ministry of Education',
  },
  {
    id: 'pmay-housing',
    title: 'Pradhan Mantri Awas Yojana (PMAY)',
    category: 'Housing',
    forWhom: 'Homeless & Families living in Kutcha Houses',
    helpsWith: 'Financial help to build a pucca house with toilet, water and power connection.',
    whatIsIt: 'Government mission providing pucca houses with basic amenities to all eligible urban and rural families who do not own a pucca home.',
    whoCanGet: [
      'Families having no pucca house in their name anywhere in India.',
      'Economically Weaker Section (EWS) and Low Income Group (LIG) families.',
      'Families identified under SECC / Awas+ survey list.',
    ],
    whatYouGet: [
      'Rural (Gramin): ₹1.20 Lakh to ₹1.30 Lakh direct grant in installments.',
      'Urban: Interest subsidy on home loans up to ₹2.67 Lakh.',
      'Additional wage assistance for house construction under MGNREGS.',
    ],
    whatPapers: [
      'Aadhaar number of family members',
      'Bank account details linked to Aadhaar',
      'Land ownership or site allotment document',
      'Income certificate',
    ],
    howToApply: [
      'For Gramin: Verification is done by Gram Panchayat / Village Secretary based on Awas+ list.',
      'For Urban: Apply online at pmaymis.gov.in or via municipal corporation office.',
    ],
    officialUrl: 'https://www.myscheme.gov.in/schemes/pmay-g',
    source: 'Ministry of Housing and Urban Affairs',
  },
  {
    id: 'ayushman-bharat',
    title: 'Ayushman Bharat (PM-JAY Health Card)',
    category: 'Popular',
    forWhom: 'Low-income and vulnerable families',
    helpsWith: 'Free hospital treatment and surgery up to ₹5 Lakh per family every year.',
    whatIsIt: 'The world\'s largest government-funded health assurance scheme covering secondary and tertiary healthcare in empaneled hospitals.',
    whoCanGet: [
      'Families listed in SECC database or state NFSA ration card lists.',
      'All senior citizens aged 70 and above (irrespective of income) under the expanded scheme.',
    ],
    whatYouGet: [
      'Cashless hospital care up to ₹5,00,000 per family per year.',
      'Covers medicines, diagnostics, surgery, ICU, and post-hospitalization costs.',
      'Accepted across 28,000+ public and private empaneled hospitals nationwide.',
    ],
    whatPapers: [
      'Aadhaar card',
      'Ration card or family register extract',
      'Registered mobile number',
    ],
    howToApply: [
      'Visit beneficiary.nha.gov.in or download the Ayushman App on mobile.',
      'Search using Ration Card or Aadhaar number.',
      'Complete Aadhaar eKYC with mobile OTP or face authentication.',
      'Download your Ayushman Card instantly.',
    ],
    officialUrl: 'https://www.myscheme.gov.in/schemes/ab-pmjay',
    source: 'National Health Authority',
  },
  {
    id: 'income-certificate',
    title: 'Income & Caste Certificates Guidance',
    category: 'Documents',
    forWhom: 'All Citizens',
    helpsWith: 'Step-by-step guidance to obtain government certificates needed for scholarships & schemes.',
    whatIsIt: 'Official state-issued documents certifying an individual\'s family income or social category, required for almost all welfare schemes.',
    whoCanGet: [
      'Any permanent resident of the respective state.',
      'Students and job applicants requiring eligibility certificates.',
    ],
    whatYouGet: [
      'Official digitally signed government certificate.',
      'Valid for 1 to 3 years depending on state rules.',
      'Unlocks access to government scholarships, fee waivers, and reserved schemes.',
    ],
    whatPapers: [
      'Aadhaar card',
      'Ration card or Electricity bill (proof of residence)',
      'Salary slip or Self-declaration / Patwari report',
      'Passport size photo',
    ],
    howToApply: [
      'Visit your state e-District portal (e.g., eSewa Punjab, eDistrict UP, Aaple Sarkar Maharashtra).',
      'Log in, select "Application for Income Certificate" or "Caste Certificate".',
      'Upload Aadhaar and self-declaration form.',
      'Pay nominal government fee (₹10–₹30) and download certificate once verified.',
    ],
    officialUrl: 'https://services.india.gov.in',
    source: 'State Revenue Departments / Digital India',
  },
  {
    id: 'pm-kusum',
    title: 'PM-KUSUM Solar Agriculture Pump',
    category: 'Farming',
    forWhom: 'Farmers & Agricultural Cooperatives',
    helpsWith: 'Up to 60% government subsidy to install solar water pumps for irrigation.',
    whatIsIt: 'Scheme aimed at ensuring energy security for farmers by replacing diesel pumps with standalone solar agriculture pumps.',
    whoCanGet: [
      'Individual farmers having agricultural land.',
      'Water User Associations and Farmer Producer Organizations (FPOs).',
    ],
    whatYouGet: [
      '60% total subsidy (30% Central Govt + 30% State Govt).',
      '30% bank loan available; farmer pays only 10% upfront.',
      'Reliable daytime electricity for irrigation with zero diesel cost.',
    ],
    whatPapers: [
      'Aadhaar card',
      'Land revenue records (Fard / Jamabandi)',
      'Bank passbook',
      'Source of water certificate',
    ],
    howToApply: [
      'Visit your state renewable energy development agency portal (e.g., PEDA in Punjab, HAREDA in Haryana).',
      'Register for the PM-KUSUM Component-B pump allotment.',
      'Deposit the 10% farmer share after verification.',
    ],
    officialUrl: 'https://www.myscheme.gov.in/schemes/pm-kusum',
    source: 'Ministry of New & Renewable Energy',
  },
  {
    id: 'pmegp',
    title: 'PMEGP (Employment Generation Programme)',
    category: 'Jobs',
    forWhom: 'Unemployed Youth & Rural Entrepreneurs',
    helpsWith: 'Credit-linked subsidy of 15% to 35% on bank loans for setting up manufacturing or service units.',
    whatIsIt: 'Major employment generation program aimed at creating self-employment opportunities in rural and urban areas.',
    whoCanGet: [
      'Any individual aged 18+ years.',
      'At least 8th standard pass for manufacturing units above ₹10 Lakh or service units above ₹5 Lakh.',
    ],
    whatYouGet: [
      'Manufacturing project loan up to ₹50 Lakh.',
      'Service sector project loan up to ₹20 Lakh.',
      'Subsidy: 25% to 35% for rural projects; 15% to 25% for urban projects.',
    ],
    whatPapers: [
      'Educational qualification certificate',
      'Project report / business proposal',
      'Aadhaar and PAN card',
      'Special category certificate (SC/ST/OBC/Women/Ex-serviceman if applicable)',
    ],
    howToApply: [
      'Apply online on the official PMEGP portal on myScheme.',
      'Fill project details and choose your preferred lending bank.',
      'District task force reviews and sanctions the proposal.',
    ],
    officialUrl: 'https://www.myscheme.gov.in/schemes/pmegp',
    source: 'Ministry of Micro, Small and Medium Enterprises',
  },
];

export function getServiceById(slugOrId: string, lang: 'en' | 'hi' = 'en'): GovernmentServiceItem | null {
  const clean = slugOrId.toLowerCase().trim();
  const list = lang === 'hi' ? POPULAR_SERVICES_HI : POPULAR_SERVICES;

  const found = list.find((s) => {
    const idMatch = s.id.toLowerCase() === clean;
    const titleSlug = s.title
      .toLowerCase()
      .replace(/[^a-z0-9\u0900-\u097F]+/g, '-')
      .replace(/^-|-$/g, '');
    return idMatch || titleSlug === clean;
  });

  if (found) return found;

  const fallbackList = lang === 'hi' ? POPULAR_SERVICES : POPULAR_SERVICES_HI;
  return fallbackList.find((s) => s.id.toLowerCase() === clean) || null;
}

