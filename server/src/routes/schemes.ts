import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getAllRecords, KBRecord } from '../services/knowledgeBase';

export const schemesRouter = Router();

// Well-known scheme alias mapping for direct, accurate slug lookups
const SCHEME_SLUG_MAP: Record<string, { topic: string; id: string }> = {
  'pm-kisan': { topic: 'PM-KISAN', id: '692' },
  'pmkisan': { topic: 'PM-KISAN', id: '692' },
  'kcc': { topic: 'KCC', id: '110' },
  'kisan-credit-card': { topic: 'KCC', id: '110' },
  'pmfby': { topic: 'PMFBY', id: '515' },
  'fasal-bima': { topic: 'PMFBY', id: '515' },
  'tractor': { topic: 'AGR50S-APT', id: '398' },
  'tractor-subsidy': { topic: 'AGR50S-APT', id: '398' },
  'pacs': { topic: 'FACIPCD', id: '750' },
  'cooperative': { topic: 'FACIPCD', id: '750' },
  'pm-kusum': { topic: 'PM-KUSUMUK', id: '725' },
  'kusum': { topic: 'PM-KUSUMUK', id: '725' },
  'solar-pump': { topic: 'PM-KUSUMUK', id: '725' },
  'pm-vishwakarma': { topic: 'VISHWAKARMA', id: '901' },
  'vishwakarma': { topic: 'VISHWAKARMA', id: '901' },
  'pm-svanidhi': { topic: 'SVANIDHI', id: '902' },
  'svanidhi': { topic: 'SVANIDHI', id: '902' },
  'mudra': { topic: 'MUDRA', id: '903' },
  'pashu-kcc': { topic: 'PASHUKCC', id: '904' },
  'lakhpati-didi': { topic: 'LAKHPATI', id: '905' },
  'nsp-scholarship': { topic: 'NSP Scholarships', id: 'nsp-scholarship' },
  'scholarship': { topic: 'NSP Scholarships', id: 'nsp-scholarship' },
  'student': { topic: 'NSP Scholarships', id: 'nsp-scholarship' },
  'student-scholarship': { topic: 'NSP Scholarships', id: 'nsp-scholarship' },
  'chhatravriti': { topic: 'NSP Scholarships', id: 'nsp-scholarship' },
  'education-loan': { topic: 'Education Loan', id: 'education-loan' },
  'pm-vidyalaxmi': { topic: 'PM Vidyalaxmi', id: 'pm-vidyalaxmi' },
  'ayushman-bharat': { topic: 'Ayushman Bharat', id: 'ayushman-bharat' },
  'pmay': { topic: 'PMAY Housing', id: 'pmay-housing' },
  'pmegp': { topic: 'PMEGP', id: 'pmegp' },
  'income-certificate': { topic: 'Income Certificate', id: 'income-certificate' },
};

export interface FormattedScheme {
  id: string;
  slug: string;
  topic: string;
  title: string;
  category: string;
  question: string;
  answer: string;
  keywords: string;
  source: string;
  url: string;
  sections: {
    about: string;
    eligibility: string[];
    benefits: string[];
    applicationSteps: string[];
    documents: string[];
    fees: string;
    whereToApply: {
      channel: string;
      details: string;
      portalUrl: string;
    };
    warnings: string[];
    links: { title: string; url: string }[];
  };
}

/**
 * Parses raw CSV record into the 9 user-friendly rural-oriented sections
 */
export function formatSchemeRecord(record: KBRecord): FormattedScheme {
  const rawId = (record['\ufeffid'] || record.id || '').trim();
  const topic = (record.topic || '').trim();
  const title = (record.title || topic || 'सरकारी योजना').trim();
  const category = (record.category || 'कृषि एवं ग्रामीण विकास').trim();
  const answer = (record.answer || '').trim();
  const url = (record.url || 'https://www.myscheme.gov.in').trim();
  const source = (record.source || 'भारत सरकार / संबंधित विभाग').trim();

  // Determine clean slug
  let slug = (topic || title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (!slug) slug = rawId || 'scheme';

  let about = answer;
  let eligibility: string[] = [];
  let benefits: string[] = [];
  let applicationSteps: string[] = [];
  let documents: string[] = [];
  let fees = 'निःशुल्क (Official Portal पर आवेदन का कोई शुल्क नहीं है)';
  let whereChannel = source;
  let whereDetails = `आधिकारिक सरकारी पोर्टल (${url}) या नजदीकी कॉमन सर्विस सेंटर (CSC) / जन सेवा केंद्र`;
  let warnings: string[] = [
    'किसी भी अनधिकृत व्यक्ति या बिचौलिए को नकद पैसे न दें।',
    'अपना आधार OTP, बैंक पासवर्ड या बायोमेट्रिक किसी अनजान व्यक्ति के साथ साझा न करें।',
    'आवेदन केवल आधिकारिक सरकारी पोर्टल या अधिकृत CSC केंद्र से ही करें।',
  ];

  // Tailored high-accuracy data for core agricultural schemes
  if (topic === 'PM-KISAN' || rawId === '692' || /pm-kisan/i.test(slug)) {
    about = 'प्रधानमंत्री किसान सम्मान निधि (PM-KISAN) भारत सरकार की एक प्रमुख योजना है, जिसके तहत देश के सभी पात्र भूमिधारक किसान परिवारों को प्रति वर्ष ₹6,000 की वित्तीय सहायता प्रदान की जाती है। यह राशि ₹2,000 की तीन समान किस्तों में सीधे किसानों के बैंक खाते (DBT) में भेजी जाती है।';
    eligibility = [
      'सभी भूमिधारक किसान परिवार जिनके नाम पर खेती योग्य जमीन के वैध कागजात हैं।',
      'किसान के बैंक खाते का आधार से लिंक होना और e-KYC पूरा होना अनिवार्य है।',
      'संस्थागत भूमिधारक, सरकारी कर्मचारी, और आयकर (Income Tax) दाता इस योजना के पात्र नहीं हैं।',
    ];
    benefits = [
      'सालाना ₹6,000 की सीधी आर्थिक सहायता।',
      'प्रत्येक 4 माह में ₹2,000 की किस्त सीधे बैंक खाते (DBT) में।',
      'खाद, बीज और खेती की आकस्मिक जरूरतों को पूरा करने में सहायता।',
    ];
    applicationSteps = [
      'आधिकारिक पोर्टल pmkisan.gov.in पर जाएं या नजदीकी CSC केंद्र पहुंचें।',
      '"Farmers Corner" में जाकर "New Farmer Registration" पर क्लिक करें।',
      'अपना आधार नंबर, मोबाइल नंबर और राज्य दर्ज कर OTP सत्यापित करें।',
      'अपनी जमीन का विवरण (खसरा/खतौनी) और बैंक खाता संख्या भरें।',
      'दस्तावेज़ अपलोड कर सबमिट करें और पंजीकरण संख्या सुरक्षित रखें।',
    ];
    documents = [
      'आधार कार्ड (Aadhaar Card)',
      'जमीन के वैध कागजात (खतौनी / जमाबंदी / Land Ownership Records)',
      'सक्रिय बैंक खाता विवरण (Aadhaar Seeded Bank Account)',
      'आधार से लिंक चालू मोबाइल नंबर',
    ];
    fees = 'पोर्टल पर आवेदन बिल्कुल निःशुल्क है। CSC पर केवल मामूली सरकारी सेवा शुल्क लग सकता है।';
    whereChannel = 'पीएम-किसान आधिकारिक पोर्टल (pmkisan.gov.in)';
    whereDetails = 'pmkisan.gov.in पोर्टल, पीएम-किसान मोबाइल ऐप, या ग्राम पंचायत / CSC केंद्र।';
    warnings = [
      'बिना e-KYC के अगली किस्त रुक सकती है, पोर्टल या बायोमेट्रिक से e-KYC अवश्य पूरी रखें।',
      'जमीन का भू-सत्यापन (Land Seeding) अपने पटवारी/लेखपाल से सत्यापित करवाएं।',
      'फर्जी कॉल या एसएमएस से सावधान रहें जो किस्त दिलवाने के नाम पर पैसे मांगते हैं।',
    ];
  } else if (topic === 'KCC' || rawId === '110' || /kcc|kisan-credit/i.test(slug)) {
    about = 'किसान क्रेडिट कार्ड (KCC) योजना किसानों को खेती, फसलों की देखरेख, खाद-बीज और पशुपालन के लिए बहुत ही सस्ती ब्याज दर पर आसान ऋण (लोन) उपलब्ध कराती है। समय पर भुगतान करने पर ब्याज दर मात्र 4% प्रति वर्ष रह जाती है।';
    eligibility = [
      'सभी व्यक्तिगत या संयुक्त किसान, काश्तकार और पट्टेदार किसान।',
      'बटाईदार किसान (Oral lessees / sharecroppers) और स्वयं सहायता समूह (SHGs)।',
      'पशुपालक, डेयरी किसान और मत्स्य पालक भी KCC के पात्र हैं।',
    ];
    benefits = [
      '₹3 लाख तक का कृषि ऋण मात्र 4% की रियायती ब्याज दर पर (समय पर भुगतान पर 3% छूट)।',
      '₹1.60 लाख तक के ऋण पर किसी गारंटी (बंधक) की आवश्यकता नहीं होती।',
      'एटीएम सह किसान क्रेडिट कार्ड से कभी भी जरूरत के समय पैसे निकालने की सुविधा।',
    ];
    applicationSteps = [
      'अपने नजदीकी ग्रामीण बैंक, सहकारी बैंक (DCCB) या वाणिज्यिक बैंक शाखा में जाएं।',
      'KCC आवेदन फॉर्म भरें और अपनी जमीन का विवरण जोड़ें।',
      'आधार कार्ड, पैन कार्ड और खतौनी की प्रति संलग्न करें।',
      'बैंक द्वारा 14 दिनों के भीतर कार्ड स्वीकृत कर वितरित किया जाता है।',
    ];
    documents = [
      'पहचान प्रमाण (आधार कार्ड / वोटर आईडी)',
      'निवास प्रमाण पत्र',
      'खेती की जमीन के दस्तावेज (खसरा, खतौनी की प्रमाणित प्रति)',
      'पासपोर्ट साइज फोटो और बैंक विवरण',
    ];
    fees = '₹1.60 लाख तक के ऋण पर कोई प्रोसेसिंग फीस या इंस्पेक्शन चार्ज नहीं लगता।';
    whereChannel = 'नजदीकी बैंक शाखा या पैक्स (PACS)';
    whereDetails = 'अपनी ग्राम पंचायत की PACS समिति, जिला सहकारी बैंक, या क्षेत्रीय ग्रामीण बैंक शाखा।';
    warnings = [
      'ऋण की राशि का भुगतान निर्धारित समय सीमा में करें ताकि 3% ब्याज छूट का लाभ मिले।',
      'बिचौलियों या दलालों को कमीशन न दें; बैंक सीधे आवेदन स्वीकार करते हैं।',
    ];
  } else if (topic === 'PMFBY' || rawId === '515' || /pmfby|fasal-bima/i.test(slug)) {
    about = 'प्रधानमंत्री फसल बीमा योजना (PMFBY) किसानों को प्राकृतिक आपदाओं (सूखा, बाढ़, ओलावृष्टि, कीट रोग, बेमौसम बारिश) से फसल को होने वाले नुकसान पर आर्थिक सुरक्षा और पूरा बीमा क्लेम प्रदान करती है।';
    eligibility = [
      'अधिसूचित क्षेत्रों में अधिसूचित फसलें उगाने वाले सभी किसान (ऋणी और गैर-ऋणी दोनों)।',
      'बटाईदार और पट्टेदार किसान भी योजना का लाभ उठा सकते हैं।',
    ];
    benefits = [
      'किसानों के लिए बेहद कम प्रीमियम: खरीफ फसल पर मात्र 2%, रबी फसल पर 1.5%, और बागवानी फसलों पर 5%।',
      'बाकी प्रीमियम केंद्र और राज्य सरकार वहन करती है।',
      'फसल नुकसान होने पर सीधा बैंक खाते में पारदर्शी क्लेम भुगतान।',
    ];
    applicationSteps = [
      'फसल बुवाई के तुरंत बाद pmfby.gov.in या बैंक / CSC पर जाएं।',
      'फसल का विवरण, खतौनी और बुवाई प्रमाण पत्र दर्ज करें।',
      'निर्धारित न्यूनतम प्रीमियम का भुगतान करें और बीमा पावती रसीद प्राप्त करें।',
      'प्राकृतिक आपदा होने पर 72 घंटे के भीतर टोल-फ्री नंबर 14447 या ऐप पर शिकायत दर्ज करें।',
    ];
    documents = [
      'आधार कार्ड',
      'जमीन का रिकॉर्ड (खतौनी / जमाबंदी)',
      'फसल बुवाई प्रमाण पत्र (पटवारी या ग्राम सेवक द्वारा प्रदत्त)',
      'बैंक पासबुक की प्रति (Aadhaar linked)',
    ];
    fees = 'खरीफ फसल के लिए 2%, रबी फसल के लिए 1.5% का मामूली प्रीमियम अंशदान।';
    whereChannel = 'PMFBY पोर्टल या बैंक शाखा';
    whereDetails = 'pmfby.gov.in पोर्टल, क्रॉप इंश्योरेंस मोबाइल ऐप, या नजदीकी बैंक / पैक्स शाखा।';
    warnings = [
      'आपदा या ओलावृष्टि होने के 72 घंटे के भीतर क्लेम सूचना अवश्य दें, देरी होने पर क्लेम खारिज हो सकता है।',
      'बैंक खाते में सही फसल का नाम और सर्वे नंबर दर्ज होना सुनिश्चित करें।',
    ];
  } else if (/tractor/i.test(topic) || /tractor/i.test(title) || rawId === '398' || rawId === '190' || rawId === '783') {
    about = 'कृषि यंत्रीकरण एवं ट्रैक्टर सब्सिडी योजना के अंतर्गत किसानों को आधुनिक ट्रैक्टर, रोटावेटर, कल्टीवेटर और कृषि यंत्र खरीदने पर 20% से लेकर 50% तक सरकारी अनुदान (सब्सिडी) प्रदान किया जाता है।';
    eligibility = [
      'ऐसे किसान जिनके नाम पर कृषि भूमि है और पिछले 7 वर्षों में ट्रैक्टर सब्सिडी न ली हो।',
      'छोटे, सीमांत किसान, महिला किसान और अनुसूचित जाति/जनजाति के किसानों को विशेष प्राथमिकता।',
    ];
    benefits = [
      'ट्रैक्टर खरीद पर ₹50,000 से ₹1,00,000 तक की प्रत्यक्ष सब्सिडी (राज्य के नियमों के अनुसार)।',
      'खेती में समय और श्रम की बचत, उत्पादन क्षमता में वृद्धि।',
    ];
    applicationSteps = [
      'राज्य के कृषि विभाग पोर्टल (जैसे DBT Agriculture / Agrisnet / e-Krishi yantra) पर पंजीकरण करें।',
      'यंत्र का चयन करें और अनुमोदित अधिकृत डीलर से कोटेशन प्राप्त करें।',
      'ऑनलाइन लॉटरी या पहले आओ पहले पाओ के आधार पर स्वीकृति प्राप्त करें।',
      'यंत्र का भौतिक सत्यापन होने के बाद सब्सिडी राशि सीधे बैंक खाते में जमा होती है।',
    ];
    documents = [
      'आधार कार्ड व पैन कार्ड',
      'जमीन के कागजात (खतौनी/भूलेख)',
      'बैंक पासबुक',
      'ट्रैक्टर कोटेशन और किसान का जाति प्रमाण पत्र (यदि लागू हो)',
    ];
    fees = 'आवेदन निःशुल्क है। डीलर को टोकन मनी सब्सिडी स्वीकृति आदेश के बाद ही देनी होती है।';
    whereChannel = 'राज्य कृषि यंत्रीकरण पोर्टल / जिला कृषि कार्यालय';
    whereDetails = 'कृषि विभाग की आधिकारिक वेबसाइट या जिला उप कृषि निदेशक कार्यालय।';
    warnings = [
      'केवल कृषि विभाग द्वारा अधिकृत (Empaneled) डीलर से ही ट्रैक्टर खरीदें।',
      'भौतिक सत्यापन (Physical Verification) से पूर्व मशीन में कोई छेड़छाड़ न करें।',
    ];
  } else if (/pacs|cooperative|credit society/i.test(topic) || /pacs|cooperative/i.test(title) || rawId === '750' || rawId === '717') {
    about = 'प्राथमिक कृषि ऋण समिति (PACS - पैक्स) ग्राम स्तर पर किसानों की अपनी सहकारी संस्था है। यह किसानों को खाद, प्रमाणित बीज, सस्ता फसल ऋण, भंडारण (गोदाम), और फसलों के विपणन की सुविधाएं सीधे गांव में उपलब्ध कराती है।';
    eligibility = [
      'संबंधित ग्राम पंचायत क्षेत्र का कोई भी किसान या ग्रामीण निवासी।',
      'न्यूनतम शेयर पूंजी और सदस्यता शुल्क जमा करने वाला कोई भी पात्र कृषक।',
    ];
    benefits = [
      'गांव में ही बिना बिचौलियों के उचित मूल्य पर डीएपी/यूरिया खाद और उन्नत बीज।',
      'सस्ता अल्पकालिक कृषि ऋण (KCC लोन)।',
      'कंप्यूटरीकृत पारदर्शी लेखा-जोखा और ग्रामीण बैंकिंग सुविधाएं।',
    ];
    applicationSteps = [
      'अपनी ग्राम पंचायत के पैक्स (PACS) कार्यालय या सचिव से संपर्क करें।',
      'सदस्यता आवेदन पत्र (फॉर्म) प्राप्त करें और भरें।',
      'आवश्यक शेयर राशि और सदस्यता शुल्क जमा कर रसीद प्राप्त करें।',
      'समिति की प्रबंध समिति द्वारा अनुमोदन के बाद सदस्य पासबुक प्राप्त करें।',
    ];
    documents = [
      'आधार कार्ड व पासपोर्ट फोटो',
      'निवास प्रमाण पत्र (राशन कार्ड / वोटर कार्ड)',
      'जमीन की खतौनी / किसान पहचान पत्र',
      'बैंक खाता विवरण',
    ];
    fees = 'न्यूनतम शेयर राशि (सामान्यतः ₹100 से ₹500) जो सदस्य की अपनी शेयर पूंजी रहती है।';
    whereChannel = 'ग्राम पंचायत पैक्स (PACS) कार्यालय';
    whereDetails = 'अपनी स्थानीय प्राथमिक कृषि ऋण सहकारी समिति कार्यालय।';
    warnings = [
      'खाद-बीज या ऋण लेते समय हमेशा आधिकारिक रसीद (Cash Receipt) अवश्य लें।',
      'समिति की आम सभा में भाग लेकर अपने अधिकारों और खातों की जानकारी रखें।',
    ];
  } else if (/kusum|solar/i.test(topic) || /kusum|solar/i.test(title) || rawId === '725' || rawId === '183' || rawId === '395') {
    about = 'प्रधानमंत्री कुसुम योजना (PM-KUSUM) के अंतर्गत किसानों को खेतों में सिंचाई के लिए सोलर पंप लगाने पर 60% से 90% तक सरकारी सब्सिडी दी जाती है। इससे डीजल का खर्च खत्म होता है और दिन में मुफ्त बिजली से सिंचाई होती है।';
    eligibility = [
      'सभी किसान जिनके पास कृषि भूमि है और सिंचाई का जल स्रोत उपलब्ध है।',
      'विद्युत रहित क्षेत्रों के किसानों को प्राथमिकता दी जाती है।',
    ];
    benefits = [
      'सोलर पंप स्थापना पर भारी सरकारी सब्सिडी (केंद्र व राज्य सरकार द्वारा)।',
      'डीजल व भारी बिजली बिल के खर्च से हमेशा के लिए मुक्ति।',
      'अतिरिक्त सोलर बिजली को ग्रिड में बेचकर अतिरिक्त आमदनी की सुविधा।',
    ];
    applicationSteps = [
      'राज्य के नवीन एवं नवीकरणीय ऊर्जा विभाग (REDA/KUSUM) पोर्टल पर ऑनलाइन आवेदन करें।',
      'अपनी भूमि व जल स्रोत का विवरण दर्ज करें।',
      'किसान अंश (10% से 40%) का भुगतान करें।',
      'अधिकृत एजेंसी द्वारा खेत में सोलर पंप की स्थापना व सत्यापन किया जाता है।',
    ];
    documents = [
      'आधार कार्ड',
      'जमीन के दस्तावेज (खतौनी)',
      'बैंक पासबुक',
      'सिंचाई जल स्रोत का प्रमाण',
    ];
    fees = 'केवल निर्धारित किसान अंशदान (पोर्टल पर स्पष्ट उल्लिखित)।';
    whereChannel = 'PM-KUSUM राज्य पोर्टल / अक्षय ऊर्जा विभाग';
    whereDetails = 'pmkusum.mnre.gov.in या संबंधित राज्य का ऊर्जा विकास निगम पोर्टल।';
    warnings = [
      'केवल आधिकारिक सरकारी कुसुम पोर्टल पर ही आवेदन करें, किसी फर्जी वेबसाइट पर पैसे न भरें।',
    ];
  } else if (/vishwakarma|karigar/i.test(topic) || /vishwakarma|karigar/i.test(title) || /pm-vishwakarma/i.test(slug)) {
    about = 'पीएम विश्वकर्मा योजना (PM Vishwakarma) देश के पारंपरिक कारीगरों और शिल्पकारों (बढ़ई, लोहार, कुम्हार, राजमिस्त्री, दर्जी, मोची, नाई, मालाकार, धोबी, बुनकर आदि 18 पारंपरिक ट्रेड) को सरकारी पहचान पत्र, कौशल प्रशिक्षण, ₹15,000 की टूलकिट प्रोत्साहन राशि, और मात्र 5% ब्याज दर पर बिना किसी गारंटी के ₹3 लाख तक का रियायती ऋण प्रदान करती है।';
    eligibility = [
      'हाथ और औजारों से काम करने वाले 18 पारंपरिक शिल्पों में कार्यरत कारीगर/शिल्पकार।',
      'आयु कम से कम 18 वर्ष होनी चाहिए।',
      'परिवार में केवल एक सदस्य को योजना का लाभ मिलेगा।',
      'पिछले 5 वर्षों में पीएमईजीपी, पीएम स्वनिधि या मुद्रा का बकाया न हो।',
    ];
    benefits = [
      'पीएम विश्वकर्मा प्रमाण पत्र और डिजिटल आईडी कार्ड।',
      '5 से 7 दिन की बेसिक ट्रेनिंग और ₹500 प्रति दिन का स्टाइपेंड।',
      'आधुनिक औजार खरीदने हेतु ₹15,000 का निःशुल्क ई-वाउचर (Toolkit Grant)।',
      'बिना किसी गारंटी के ₹1 लाख (प्रथम चरण) व ₹2 लाख (द्वितीय चरण) का ऋण मात्र 5% ब्याज पर।',
    ];
    applicationSteps = [
      'नजदीकी सीएससी (CSC) जन सेवा केंद्र पर जाएं और बायोमेट्रिक सत्यापन करवाएं।',
      'अपने 18 पारंपरिक ट्रेड का चयन करें और बैंक खाता विवरण दें।',
      'ग्राम पंचायत प्रधान या यूएलबी (नगर पालिका) स्तर पर 3-स्तरीय सत्यापन होगा।',
      'स्वीकृति के बाद स्किल ट्रेनिंग केंद्र से बुलावा आएगा और टूलकिट वाउचर मिलेगा।',
    ];
    documents = [
      'आधार कार्ड (Aadhaar Card)',
      'सक्रिय मोबाइल नंबर (आधार से लिंक)',
      'बैंक खाता पासबुक',
      'राशन कार्ड या परिवार पहचान पत्र',
    ];
    fees = 'आवेदन और ट्रेनिंग पूरी तरह निःशुल्क है। ₹15,000 टूलकिट अनुदान सरकार द्वारा फ्री दिया जाता है।';
    whereChannel = 'पीएम विश्वकर्मा आधिकारिक पोर्टल (pmvishwakarma.gov.in)';
    whereDetails = 'pmvishwakarma.gov.in पोर्टल या नजदीकी सीएससी (CSC) केंद्र।';
    warnings = [
      'टूलकिट वाउचर का उपयोग केवल अधिकृत ई-रूपी (e-RUPI) मर्चेंट से औजार खरीदने में ही करें।',
      'बिचौलियों को फॉर्म भरने का कोई अतिरिक्त पैसा न दें।',
    ];
  } else if (/svanidhi|street vendor/i.test(topic) || /svanidhi/i.test(title) || /pm-svanidhi/i.test(slug)) {
    about = 'पीएम स्वनिधि (PM SVANidhi) योजना छोटे दुकानदारों, व्यापारियों और रेहड़ी-पटरी विक्रेताओं को कारोबार बढ़ाने के लिए बिना किसी गारंटी (Collateral-Free) के आसान कार्यशील पूंजी ऋण प्रदान करती है। इसमें समय पर भुगतान पर 7% ब्याज सब्सिडी और ₹1,200 सालाना डिजिटल कैशबैक मिलता है।';
    eligibility = [
      'शहरी और ग्रामीण क्षेत्रों के छोटे दुकानदार, खोखा, ठेला, रेहड़ी-पटरी और फेरी लगाने वाले विक्रेता।',
      'स्थानीय निकाय द्वारा जारी वेंडिंग प्रमाण पत्र या पहचान पत्र धारक।',
    ];
    benefits = [
      'प्रथम चरण में ₹10,000, दूसरे चरण में ₹20,000, और तीसरे चरण में ₹50,000 तक का लोन।',
      'किसी भी प्रकार की गारंटी या संपत्ति गिरवी रखने की आवश्यकता नहीं।',
      'डिजिटल लेन-देन (QR Code) पर ₹100 प्रतिमाह तक का कैशबैक।',
    ];
    applicationSteps = [
      'pmsvanidhi.mohua.gov.in पोर्टल पर जाएं या नजदीकी बैंक / सीएससी केंद्र पहुंचें।',
      'आधार से जुड़ा मोबाइल नंबर दर्ज कर OTP सत्यापित करें।',
      'वेंडर पहचान पत्र (CoR/LoR) और बैंक विवरण दर्ज कर ऋणदाता बैंक चुनें।',
      'बैंक द्वारा सत्यापन के बाद लोन राशि सीधे खाते में जमा होती है।',
    ];
    documents = [
      'आधार कार्ड व वोटर आईडी',
      'वेंडिंग सर्टिफिकेट (CoR) या अनुशंसा पत्र (LoR)',
      'बैंक पासबुक व सक्रिय मोबाइल नंबर',
    ];
    fees = 'आवेदन निःशुल्क है, किसी प्रकार का प्रोसेसिंग शुल्क देय नहीं है।';
    whereChannel = 'पीएम स्वनिधि पोर्टल (pmsvanidhi.mohua.gov.in)';
    whereDetails = 'pmsvanidhi.mohua.gov.in पोर्टल, पीएम स्वनिधि मोबाइल ऐप या नजदीकी बैंक शाखा।';
    warnings = [
      'नियमित ईएमआई भरने पर स्वतः 7% ब्याज सब्सिडी खाते में आती है और क्रेडिट लिमिट बढ़ती है।',
    ];
  } else if (/mudra/i.test(topic) || /mudra/i.test(title) || /mudra/i.test(slug)) {
    about = 'प्रधानमंत्री मुद्रा योजना (PMMY) गैर-कॉर्पोरेट, गैर-कृषि लघु और सूक्ष्म व्यवसायों, दुकानदारों और उद्यमों को ₹10 लाख तक का ऋण प्रदान करती है। यह तीन श्रेणियों में मिलता है: शिशु (₹50,000 तक), किशोर (₹5 लाख तक), और तरुण (₹10 लाख तक)।';
    eligibility = [
      'दुकानदार, व्यापारी, कारीगर, विनिर्माता और सेवा प्रदाता।',
      'भारत का कोई भी नागरिक जिसका कोई पूर्व बैंक डिफॉल्ट न हो।',
    ];
    benefits = [
      'बिना किसी गारंटी (Collateral-free) के ₹10 लाख तक का व्यवसाय ऋण।',
      'दुकान में नया माल भरने, मशीनरी खरीदने या नया काउंटर लगाने के लिए आदर्श।',
      'मुद्रा कार्ड (Mudra Card) द्वारा कार्यशील पूंजी की निकासी की सुविधा।',
    ];
    applicationSteps = [
      'उद्यमी मित्र पोर्टल (udyamimitra.in) या किसी भी बैंक/एनबीएफसी शाखा में जाएं।',
      'मुद्रा लोन फॉर्म भरें और अपने व्यवसाय का संक्षिप्त प्रस्ताव (Quotation) संलग्न करें।',
      'बैंक द्वारा 7 से 10 दिनों में ऋण स्वीकृत किया जाता है।',
    ];
    documents = [
      'पहचान प्रमाण (आधार/पैन कार्ड)',
      'दुकान/व्यवसाय का पता प्रमाण व लाइसेंस (यदि हो)',
      'पिछले 6 माह का बैंक खाता विवरण',
    ];
    fees = 'शिशु और किशोर ऋण पर कोई प्रोसेसिंग फीस नहीं लगती।';
    whereChannel = 'उद्यमी मित्र पोर्टल (udyamimitra.in) / राष्ट्रीयकृत बैंक';
    whereDetails = 'किसी भी सरकारी, ग्रामीण या निजी बैंक शाखा।';
    warnings = [
      'मुद्रा लोन स्वीकृत कराने के नाम पर अग्रिम कमीशन मांगने वाले धोखेबाजों से सावधान रहें।',
    ];
  } else if (/pashu|dairy|livestock/i.test(topic) || /pashu/i.test(title) || /pashu-kcc/i.test(slug)) {
    about = 'पशु किसान क्रेडिट कार्ड (Pashu KCC) योजना पशुपालकों, डेयरी किसानों, भेड़-बकरी पालकों और मुर्गी पालकों को पशुओं के दाना, चारे, दवाओं और देखभाल के खर्च के लिए ₹1.60 लाख तक का बिना गारंटी ऋण मात्र 4% की रियायती ब्याज दर पर उपलब्ध कराती है।';
    eligibility = [
      'गाय, भैंस, भेड़, बकरी, सुअर या मुर्गी पालन करने वाले सभी ग्रामीण किसान व पशुपालक।',
      'भूमिहीन पशुपालक भी इसके पूर्ण पात्र हैं।',
    ];
    benefits = [
      'बिना किसी जमीन बंधक के ₹1.60 लाख तक का लोन।',
      'समय पर अदायगी करने पर 3% ब्याज छूट के साथ मात्र 4% प्रभावी ब्याज।',
      'पशु स्वास्थ्य और चारा खरीदने हेतु निरंतर कार्यशील पूंजी।',
    ];
    applicationSteps = [
      'अपने नजदीकी सरकारी पशु चिकित्सालय (Veterinary Hospital) या बैंक में जाएं।',
      'पशु केसीसी फॉर्म भरें और पशुओं का स्वास्थ्य प्रमाण पत्र संलग्न करें।',
      'पशुओं का टैगिंग (Ear Tagging) विवरण दर्ज कर बैंक में जमा करें।',
    ];
    documents = [
      'आधार कार्ड व पैन कार्ड',
      'पशुओं के कान का टैग नंबर (Ear Tag)',
      'बैंक पासबुक और पासपोर्ट साइज फोटो',
    ];
    fees = '₹1.60 लाख तक के ऋण पर कोई प्रोसेसिंग चार्ज नहीं।';
    whereChannel = 'नजदीकी बैंक शाखा या जिला पशुपालन विभाग';
    whereDetails = 'पशु चिकित्सा अधिकारी या स्थानीय बैंक शाखा।';
    warnings = [
      'पशुओं की अनिवार्य टैगिंग और बीमा अवश्य करवाएं ताकि क्लेम में कोई बाधा न आए।',
    ];
  } else if (/lakhpati|didi|shg/i.test(topic) || /lakhpati/i.test(title) || /lakhpati-didi/i.test(slug)) {
    about = 'लखपति दीदी योजना ग्रामीण महिला स्वयं सहायता समूह (SHG) की दीदियों को आत्मनिर्भर और आर्थिक रूप से सशक्त बनाने के लिए शुरू की गई है। इसके अंतर्गत महिलाओं को सिलाई, फूड प्रोसेसिंग, मशरूम, डेयरी, एलईडी बल्ब व ड्रोन संचालन जैसे आजीविका व्यवसायों में ट्रेनिंग व आसान वित्तीय सहायता दी जाती है।';
    eligibility = [
      'राष्ट्रीय ग्रामीण आजीविका मिशन (NRLM) से जुड़े स्वयं सहायता समूह की सक्रिय महिला सदस्य।',
    ];
    benefits = [
      'वार्षिक ₹1,00,000 से अधिक की आय अर्जित करने हेतु संपूर्ण मार्गदर्शन व सहयोग।',
      'कौशल विकास, वित्तीय साक्षरता, पैकेजिंग और डिजिटल मार्केटिंग में प्रशिक्षण।',
      'कम ब्याज पर आजीविका ऋण (CIF व बैंक लिंकेज)।',
    ];
    applicationSteps = [
      'अपनी ग्राम संगठन (VO) या क्लस्टर लेवल फेडरेशन (CLF) की बैठक में अपनी आजीविका योजना पेश करें।',
      'ब्लॉक मिशन मैनेजमेंट यूनिट (BMMU) में लखपति दीदी सर्वेक्षण में नाम दर्ज कराएं।',
      'आरसेटी (RSETI) या ब्लॉक ट्रेनिंग सेंटर से व्यावसायिक प्रशिक्षण प्राप्त करें।',
    ];
    documents = [
      'आधार कार्ड',
      'समूह सदस्यता पासबुक',
      'बैंक खाता पासबुक',
    ];
    fees = 'ट्रेनिंग और सरकारी पंजीकरण पूर्णतः निःशुल्क है।';
    whereChannel = 'ग्राम संगठन (VO) / ब्लॉक आजीविका मिशन (NRLM) कार्यालय';
    whereDetails = 'स्थानीय ब्लॉक मिशन प्रबंधक (BMM) या सीएलएफ कार्यालय।';
    warnings = [
      'समूह के आंतरिक ऋण का नियमित भुगतान रखें ताकि बैंक की क्रेडिट ग्रेडिंग उत्तम रहे।',
    ];
  } else {
    // Dynamic structured extraction for any of the 870+ schemes in knowledge.csv
    eligibility = [
      'योजना से जुड़े संबंधित वर्ग (किसान / ग्रामीण नागरिक / पशुपालक)।',
      'मान्य आधार कार्ड और स्थानीय निवास प्रमाण पत्र धारक।',
      'विभागीय दिशा-निर्देशों के अनुसार पात्रता शर्तें पूरी करने वाले व्यक्ति।',
    ];
    benefits = [
      answer ? (answer.length > 200 ? answer.slice(0, 200) + '...' : answer) : 'सरकारी अनुदान, वित्तीय सहायता या तकनीकी सहयोग।',
      'पारदर्शी रूप से सीधे बैंक खाते (DBT) या अधिकृत संस्था के माध्यम से लाभ।',
    ];
    applicationSteps = [
      `आधिकारिक पोर्टल (${url}) पर जाएं या नजदीकी सेवा केंद्र पहुंचें।`,
      'ऑनलाइन आवेदन फॉर्म में अपनी आवश्यक व्यक्तिगत व कृषि जानकारी भरें।',
      'आवश्यक दस्तावेज़ संलग्न कर आवेदन सबमिट करें और पावती रसीद सुरक्षित रखें।',
    ];
    documents = [
      'आधार कार्ड (Aadhaar Card)',
      'बैंक पासबुक (Aadhaar linked)',
      'निवास एवं आय प्रमाण पत्र (यदि लागू हो)',
      'संबंधित कार्य/जमीन का आधिकारिक दस्तावेज',
    ];
  }

  return {
    id: rawId,
    slug,
    topic,
    title,
    category,
    question: record.question || `What is ${title}?`,
    answer,
    keywords: record.keywords || '',
    source,
    url,
    sections: {
      about,
      eligibility,
      benefits,
      applicationSteps,
      documents,
      fees,
      whereToApply: {
        channel: whereChannel,
        details: whereDetails,
        portalUrl: url,
      },
      warnings,
      links: [
        { title: `${title} - आधिकारिक पोर्टल`, url },
        { title: 'myScheme राष्ट्रीय सरकारी पोर्टल', url: 'https://www.myscheme.gov.in' },
      ],
    },
  };
}

// GET /api/schemes - List schemes with pagination, search, and category filter
schemesRouter.get('/', (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').toLowerCase().trim();
  const category = ((req.query.category as string) || '').trim();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

  const all = getAllRecords();
  let filtered = all;

  if (category) {
    filtered = filtered.filter((r) => (r.category || '').toLowerCase() === category.toLowerCase());
  }

  if (q) {
    filtered = filtered.filter((r) => {
      const text = `${r.title || ''} ${r.topic || ''} ${r.keywords || ''} ${r.answer || ''}`.toLowerCase();
      return text.includes(q);
    });
  }

  const total = filtered.length;
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit).map(formatSchemeRecord);

  return res.json({
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    schemes: paginated,
  });
});

// Helper to load curated services from disk
function loadCuratedServices(): any[] {
  const candidates = [
    path.resolve(process.cwd(), '../data/services_hi.json'),
    path.resolve(process.cwd(), 'data/services_hi.json'),
    path.resolve(__dirname, '../../../data/services_hi.json'),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        // ignore
      }
    }
  }
  return [];
}

function formatCuratedService(s: any): FormattedScheme {
  return {
    id: s.id,
    slug: s.id,
    topic: s.title,
    title: s.title,
    category: s.category || 'सरकारी सेवा',
    question: `${s.title} क्या है और इसके क्या लाभ हैं?`,
    answer: s.whatIsIt || s.helpsWith || '',
    keywords: `${s.forWhom || ''} ${s.category || ''} ${s.helpsWith || ''}`,
    source: s.source || 'भारत सरकार',
    url: s.officialUrl || 'https://www.myscheme.gov.in',
    sections: {
      about: `${s.whatIsIt || ''} ${s.helpsWith ? 'मुख्य लाभ: ' + s.helpsWith : ''}`.trim(),
      eligibility: s.whoCanGet || [],
      benefits: s.whatYouGet || [],
      applicationSteps: s.howToApply || [],
      documents: s.whatPapers || [],
      fees: 'निःशुल्क (Official Portal पर आवेदन)',
      whereToApply: {
        channel: s.source || 'आधिकारिक पोर्टल',
        details: `ऑनलाइन पोर्टल (${s.officialUrl || 'https://www.myscheme.gov.in'}) या नजदीकी CSC केंद्र`,
        portalUrl: s.officialUrl || 'https://www.myscheme.gov.in',
      },
      warnings: [
        'अनधिकृत दलालों या बिचौलियों को पैसे न दें।',
        'आवेदन केवल आधिकारिक सरकारी पोर्टल से करें।',
      ],
      links: [
        { title: `${s.title} - आधिकारिक पोर्टल`, url: s.officialUrl || 'https://www.myscheme.gov.in' },
        { title: 'myScheme सरकारी पोर्टल', url: 'https://www.myscheme.gov.in' },
      ],
    },
  };
}

// GET /api/schemes/curated - Curated government services in Hindi (or English)
schemesRouter.get('/curated', (req: Request, res: Response) => {
  const lang = ((req.query.lang as string) || 'hi').toLowerCase();
  const services = loadCuratedServices();
  if (services.length > 0) {
    return res.json({
      language: lang,
      total: services.length,
      services,
    });
  }
  return res.status(500).json({ error: 'Could not load Hindi services' });
});

// GET /api/schemes/search - Dedicated search endpoint for voice assistant and search UI
schemesRouter.get('/search', (req: Request, res: Response) => {
  const q = ((req.query.q as string) || (req.query.query as string) || '').toLowerCase().trim();
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 5));

  if (!q) {
    return res.json({ success: true, results: [] });
  }

  const results: any[] = [];
  const addedIds = new Set<string>();

  // 1. Search curated popular services first (NSP scholarships, MUDRA, SVANidhi, etc.)
  const curated = loadCuratedServices();
  for (const s of curated) {
    const text = `${s.id || ''} ${s.title || ''} ${s.category || ''} ${s.forWhom || ''} ${s.helpsWith || ''} ${s.whatIsIt || ''}`.toLowerCase();
    const isStudentQuery = q.includes('student') || q.includes('छात्र') || q.includes('scholarship') || q.includes('विद्यार्थी') || q.includes('पढ़ाई');
    const matchesStudentService = s.id === 'nsp-scholarship' || text.includes('छात्र') || text.includes('scholarship');

    if (text.includes(q) || (isStudentQuery && matchesStudentService)) {
      if (!addedIds.has(s.id)) {
        addedIds.add(s.id);
        const formatted = formatCuratedService(s);
        results.push({
          id: formatted.id,
          slug: formatted.slug,
          title: formatted.title,
          category: formatted.category,
          description: formatted.sections.about,
          benefits: formatted.sections.benefits,
          eligibility: formatted.sections.eligibility,
          url: formatted.url,
          source: formatted.source,
          scheme: formatted,
        });
      }
    }
  }

  // 2. Search CSV knowledge base (870+ records)
  const all = getAllRecords();
  for (const r of all) {
    if (results.length >= limit) break;
    const text = `${r.title || ''} ${r.topic || ''} ${r.keywords || ''} ${r.answer || ''} ${r.category || ''}`.toLowerCase();
    const rawId = (r['\ufeffid'] || r.id || '').trim();

    if (text.includes(q)) {
      if (!addedIds.has(rawId)) {
        addedIds.add(rawId);
        const formatted = formatSchemeRecord(r);
        results.push({
          id: formatted.id,
          slug: formatted.slug,
          title: formatted.title,
          category: formatted.category,
          description: formatted.sections.about,
          benefits: formatted.sections.benefits,
          eligibility: formatted.sections.eligibility,
          url: formatted.url,
          source: formatted.source,
          scheme: formatted,
        });
      }
    }
  }

  return res.json({
    success: true,
    query: q,
    total: results.length,
    results: results.slice(0, limit),
  });
});

// GET /api/schemes/:id - Get scheme details by id, slug, or topic
schemesRouter.get('/:id', (req: Request, res: Response) => {
  const rawParam = req.params.id;
  const param = (Array.isArray(rawParam) ? rawParam[0] : rawParam || '').trim().toLowerCase();

  const all = getAllRecords();

  // Check alias map first
  const alias = SCHEME_SLUG_MAP[param];

  let found = all.find((r) => {
    const rawId = (r['\ufeffid'] || r.id || '').trim();
    const topic = (r.topic || '').trim().toLowerCase();
    const slug = (r.topic || r.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (alias) {
      if (alias.id && rawId === alias.id) return true;
      if (alias.topic && topic === alias.topic.toLowerCase()) return true;
    }

    return rawId.toLowerCase() === param || topic === param || slug === param;
  });

  // Fallback: title includes param
  if (!found) {
    found = all.find((r) => (r.title || '').toLowerCase().includes(param));
  }

  // Check curated services if not found in CSV
  if (!found) {
    const curated = loadCuratedServices();
    const curatedMatch = curated.find((s) => {
      const matchId = (s.id || '').toLowerCase() === param;
      const matchSlug = (s.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === param;
      const matchAlias = alias && alias.id && s.id === alias.id;
      return matchId || matchSlug || matchAlias;
    });
    if (curatedMatch) {
      return res.json(formatCuratedService(curatedMatch));
    }
  }

  // If still not found but alias exists in our well-known map or is a known slug
  if (!found && alias) {
    found = {
      id: alias.id,
      '\ufeffid': alias.id,
      topic: alias.topic,
      title: alias.topic,
      category: 'government-services',
      question: `${alias.topic} योजना क्या है और इसका लाभ कैसे लें?`,
      answer: `${alias.topic} योजना के बारे में संपूर्ण विवरण।`,
      keywords: param,
      source: 'Government Portal',
      url: 'https://www.myscheme.gov.in',
    } as any;
  }

  if (!found) {
    return res.status(404).json({ error: 'Scheme not found.' });
  }

  return res.json(formatSchemeRecord(found));
});
