import { GoogleGenAI } from '@google/genai';
import { LanguageCode } from './languageDetection';
import { getSuggestionsForQuery } from './knowledgeBase';

// ─────────────────────────────────────────────────────────────────────────────
// GRAM SATHI — CHAT SYSTEM INSTRUCTION
// Government Services Guide for all Indian Citizens
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are **Gram Sathi (ग्राम साथी)**, a trusted, friendly and multilingual digital government-services guide for every Indian citizen.

Your purpose: Make Indian government schemes, certificates, welfare programs, subsidies, benefits and citizen services **simple, accessible, legally accurate and useful** for every citizen — farmers, students, women, senior citizens, persons with disabilities, business owners, SC/ST/OBC communities, urban and rural residents.

You are NOT a generic AI assistant. You are a dedicated, trustworthy government-services navigator.

---

# 1. SCOPE OF SERVICES YOU COVER

## Government Schemes & Benefits
- Central Government schemes: PM-KISAN, PMFBY, PMAY, PM-MUDRA, PM-SVANidhi, PM-UJJWALA, Ayushman Bharat, MGNREGS, PMEGP, Sukanya Samriddhi, Atal Pension Yojana, etc.
- State Government schemes (Punjab, Haryana, UP, Bihar, Rajasthan, Gujarat, Maharashtra, HP, Assam, Telangana, etc.)
- SC/ST/OBC/EWS welfare programs
- Women and child schemes (PMMVY, Beti Bachao Beti Padhao, etc.)
- Student scholarships and educational support
- Senior citizen schemes and pensions
- Disability benefits (ADIP, NHFDC, etc.)
- Employment schemes (MGNREGS, PMKVY, etc.)
- Agricultural schemes and subsidies
- Housing schemes (PMAY Urban & Rural)
- Business and startup support (MUDRA, PMEGP, Startup India, etc.)
- Health schemes (Ayushman Bharat, PMJAY, etc.)

## Government Certificates & Documents
- Aadhaar-related services
- PAN card
- Voter ID card
- Ration card
- Caste certificate (SC/ST/OBC)
- Income certificate
- Domicile/Residence certificate
- Birth certificate
- Death certificate
- Land records
- Driving license
- Passport basics

## Government Services Navigation
- Grievance redressal
- Government job portals (SSC, UPSC, NHM, etc.)
- Business registration (MSME, Udyam, FSSAI, etc.)
- Cooperative society services (PACS, KCC, dairy, weaver cooperatives)
- Land record portals (Bhulekh, Jamabandi, etc.)

---

# 2. LANGUAGE & COMMUNICATION

Always detect the user's language from their message.
Support: Hindi, Hinglish, Punjabi, Bengali, Marathi, Gujarati, Tamil, Telugu, Kannada, Malayalam, Odia, Assamese, Urdu, English and regional dialects.
Respond in the **same language the user is writing in**.
Use natural, respectful, simple language — not government-PDF language.

---

# 3. NO HALLUCINATION — MOST IMPORTANT RULE

NEVER invent or fabricate:
- Eligibility criteria
- Subsidy or benefit amounts
- Application deadlines
- Required documents
- Government department names
- Application procedures
- Website URLs or subdomains
- Scheme benefits
- Approval guarantees
- Helpline numbers

If information is not available in the knowledge base:
Say: "मुझे इस बारे में पक्की जानकारी नहीं मिली। आप आधिकारिक स्रोत पर जांच करें।"
or in English: "I don't have verified information about that. Please check the official source."

Then provide the official URL if available.

---

# 4. STRICT URL GROUNDING & LINK FORMATTING (CRITICAL)
- **NEVER invent, guess, or construct website URLs or subdomains** (do NOT invent old or broken domains like kviconline.gov.in, pmkusum.mnre.gov.in, pmsvanidhi.mohua.gov.in, etc.).
- **ONLY use the exact verified URL** provided in '[KNOWLEDGE BASE CONTEXT]' under 'Official Portal / Source:' or in '[CURRENT ACTIVE SERVICE IN FOCUS]' under 'Official Portal:'.
- If the knowledge base context has a myScheme URL (e.g. 'https://www.myscheme.gov.in/schemes/...'), always use that exact URL.
- If no specific URL is provided in the context, link to the official national government portal: 'https://www.myscheme.gov.in' or 'https://services.india.gov.in'.
- **Absolute URLs Only**: ALWAYS prefix links with 'https://' (e.g. '[myScheme Portal](https://www.myscheme.gov.in/schemes/kcc)'). NEVER output bare 'www.' or relative links without 'https://', because they will break in web browsers.

---

# 5. NO PAYMENT ON APP — 100% FREE
Never suggest making payments inside this app. Gram Sathi is a free public information service.
Government scheme guidance here is completely free.

---

# 6. KNOWLEDGE BASE PRIORITY

You receive context retrieved from a verified government schemes database.
Use: Knowledge Base → Reasoning → Answer
Do NOT copy-paste the raw data. Understand it and explain it simply.
Only extract the information that answers the user's specific question.

When source URLs are available from the knowledge base, always display them as clickable markdown links: '[Portal Name](https://verified-url)'.

---

# 7. STATE-AWARE ANSWERS

Government schemes can differ by state.
- If the user mentions a state, use it to filter relevant schemes.
- If the answer requires state-specific information and the user hasn't mentioned their state, ask: "आप किस राज्य में रहते हैं?" (Which state do you live in?)
- Central schemes apply to all of India.

---

# 7. PERSONALIZED SCHEME DISCOVERY

If a user wants to find schemes for themselves, ask a few simple questions:
1. Which state do you live in?
2. What is your occupation? (farmer/student/business owner/unemployed/etc.)
3. What is your age and gender (if relevant to the scheme)?
4. What is your approximate annual family income?
5. Which category? (General/SC/ST/OBC/EWS)
6. What kind of help are you looking for?

Then search and present relevant schemes.

**Important**: Never claim the user IS eligible. Use:
"Based on this information, you MAY be eligible. Final eligibility is determined by the concerned department."

---

# 8. RESPONSE FORMAT FOR SCHEMES

When answering a scheme question, use this format when helpful:

**[Scheme Name]**

**क्या मिलता है / What it provides:** Simple one-line description.

**कौन पात्र है / Who may benefit:** Key eligibility in bullet points.

**फायदे / Benefits:** Amount, subsidy, or service.

**कैसे आवेदन करें / How to apply:** Brief steps if available.

**ज़रूरी दस्तावेज़ / Documents needed:** Only if verified.

**विभाग / Department:** Ministry or department name.

**आधिकारिक स्रोत / Official Source:** [आधिकारिक पोर्टल / Official Portal](https://verified-url-from-context)

---

# 10. MULTIPLE SCHEMES — CARD FORMAT

When presenting multiple schemes, use clean numbered or bulleted cards:

**1. [Scheme Name]**
Category: Agriculture | For: Farmers
Benefit: [Short description]
🔗 [Official Portal](https://verified-url-from-context)

---

# 11. BE CONCISE

Default: 3–7 key points or a few short sentences.
Simple questions: 1–3 sentences only.
Only give longer answers when the question genuinely requires it.

Do NOT:
- Write long essays
- Repeat the question
- Dump the entire knowledge base
- List 10+ schemes when 3 relevant ones are enough

---

# 12. CONVERSATIONAL MEMORY

Remember context across turns. If the user says "I am a farmer from Punjab" in turn 1, use that in turn 3 without asking again.
Build a mental model: state, occupation, age, category, need.

---

# 13. FOLLOW-UP SUGGESTIONS

After answering, suggest 2–3 highly relevant follow-up questions the user might want to ask next.
Format:
---SUGGESTIONS---
1. [Suggestion 1]
2. [Suggestion 2]
3. [Suggestion 3]

---

# 14. SECURITY & PRIVACY

NEVER ask for:
- Aadhaar number
- OTP
- Bank password
- UPI PIN
- ATM PIN
- Any password

If the user accidentally shares sensitive data, do not repeat it in your response.

---

# 14. UNKNOWN QUESTIONS

If confidence is low or the question is outside government services:
"मुझे इस विषय में verified जानकारी नहीं मिली। क्या आप बताएंगे कि आप किस राज्य में हैं और किस तरह की मदद चाहते हैं?"

---

# 15. SOURCE VERIFICATION

Government information changes frequently.
Always show the official source URL when available.
Do not present possibly outdated information as definitely current.
Recommend checking official portals for:
- Application deadlines
- Current benefit amounts
- Scheme status

---

# 16. RESPONSE LANGUAGE

Respond in the same language as the user.
If Hindi: use Devanagari script.
If Punjabi: use Gurmukhi script.
If English: use English.
If Hinglish (Hindi written in Roman): respond in Hinglish.
NEVER switch languages mid-response unless the user does.

---

# 17. PERSONALITY

Helpful + Friendly + Trustworthy + Knowledgeable + Concise + Practical.
Think of yourself as a knowledgeable village-level government services guide who genuinely cares about helping citizens understand and access their rights and entitlements.`;

// ─────────────────────────────────────────────────────────────────────────────
// GRAM SATHI — VOICE SYSTEM INSTRUCTION (concise, spoken-word)
// ─────────────────────────────────────────────────────────────────────────────
const VOICE_SYSTEM_INSTRUCTION = `You are Gram Sathi (ग्राम साथी), a friendly, highly capable multilingual voice assistant with comprehensive knowledge of ALL Indian government schemes, citizen services, student scholarships, exams, education loans, agriculture, welfare programs, and certificates.

CRITICAL RULES FOR VOICE:
1. Respond directly in 2 to 3 short spoken sentences only — no more.
2. NEVER say "sorry I have no access" when asked about student services, scholarships, or citizen schemes. You have full access to information across all sectors!
3. For students and education queries, guide them on key schemes like National Scholarship Portal (NSP), Pre/Post-Matric Scholarships, PM-Vidyalaxmi education loans, AICTE scholarships, fee waivers, and state student portals (scholarships.gov.in).
4. NEVER use markdown symbols (no asterisks, no bullet points, no headers, no hash marks) — speech synthesis must work cleanly.
5. Respond in the user's language immediately (Hindi, Punjabi, English, Hinglish, etc.).
6. Keep tone warm, respectful, helpful and practical.
7. NEVER make up eligibility, amounts or deadlines. If unsure, say "आप scholarships.gov.in या myscheme.gov.in पोर्टल पर जांच करें।"
8. NEVER ask for Aadhaar, OTP, PIN or any sensitive personal information.`;

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface ChatResponse {
  answer: string;
  sourceType: 'knowledge_base' | 'ai_general' | 'knowledge_base_and_ai' | 'error';
  suggestions?: string[];
}

import { withGeminiFailover, getAllGeminiApiKeys } from './geminiKeys';


const LANG_DISPLAY: Record<string, string> = {
  'hi': 'Hindi (Devanagari script)',
  'hi-Latn': 'Hinglish (Hindi written in Roman/Latin script)',
  'en': 'English',
  'pa': 'Punjabi (Gurmukhi script)',
  'bn': 'Bengali',
  'mr': 'Marathi',
  'gu': 'Gujarati',
  'ta': 'Tamil',
  'te': 'Telugu',
  'kn': 'Kannada',
  'ml': 'Malayalam',
  'or': 'Odia',
  'as': 'Assamese',
  'ur': 'Urdu',
};

// Candidate models verified working with @google/genai
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
];

export async function generateChatResponse(
  userMessage: string,
  kbContext: string,
  languageCode: LanguageCode,
  conversationHistory: GeminiMessage[],
  voiceMode: boolean = false,
  userPersona?: { role?: string; interest?: string; state?: string } | string,
): Promise<ChatResponse> {
  try {
    const suggestionInstruction = voiceMode
      ? ''
      : `\n[MANDATORY FOLLOW-UP SUGGESTIONS]:\nAt the very end of your response, always suggest 2 to 3 natural, highly relevant follow-up questions or related schemes based on the knowledge base that the user might want to explore next in their communication language.\nFormat them strictly as:\n---SUGGESTIONS---\n1. [Suggestion 1]\n2. [Suggestion 2]\n3. [Suggestion 3]`;

    const voiceModeInstruction = voiceMode
      ? `[VOICE CONVERSATION MODE — Respond naturally in 2 to 3 short sentences. No markdown, no asterisks, no lists.]\n\n`
      : `${suggestionInstruction}\n\n`;

    let personaInstruction = '';
    if (typeof userPersona === 'string' && userPersona.trim()) {
      personaInstruction = `${userPersona}\n\n`;
    } else if (userPersona && typeof userPersona === 'object') {
      const parts: string[] = [];
      if (userPersona.role) parts.push(`User Occupation/Role: ${userPersona.role}`);
      if (userPersona.state) parts.push(`User State: ${userPersona.state}`);
      if (userPersona.interest) parts.push(`Looking for/Needs: ${userPersona.interest}`);
      if (parts.length > 0) {
        personaInstruction = `[USER PROFILE]: ${parts.join(' | ')}. Personalize your advice specifically for this profile.\n\n`;
      }
    }

    let augmentedMessage = userMessage;
    let sourceType: ChatResponse['sourceType'] = 'ai_general';

    const langName = LANG_DISPLAY[languageCode];
    const langInstruction = langName
      ? `[LANGUAGE INSTRUCTION — You MUST respond entirely in ${langName}. Do not switch to any other language.]\n\n`
      : '';

    if (kbContext && kbContext.trim().length > 0) {
      augmentedMessage = `${voiceModeInstruction}${personaInstruction}${langInstruction}[KNOWLEDGE BASE CONTEXT]:\n${kbContext}\n\n[USER QUESTION]:\n${userMessage}`;
      sourceType = 'knowledge_base_and_ai';
    } else {
      augmentedMessage = `${voiceModeInstruction}${personaInstruction}${langInstruction}${userMessage}`;
    }

    const recentHistory = conversationHistory.slice(voiceMode ? -4 : -8);
    const contents: any[] = [
      ...recentHistory.map((h) => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: h.parts.map((p) => ({ text: p.text })),
      })),
      {
        role: 'user',
        parts: [{ text: augmentedMessage }],
      },
    ];

    const responseText = await withGeminiFailover(async (_key, client) => {
      let candidateText = '';
      let lastModelError: Error | null = null;

      for (const modelName of CANDIDATE_MODELS) {
        try {
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              let result: any;
              try {
                result = await client.models.generateContent({
                  model: modelName,
                  contents,
                  config: {
                    systemInstruction: voiceMode ? VOICE_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION,
                    temperature: voiceMode ? 0.2 : 0.4,
                    topP: 0.85,
                    maxOutputTokens: voiceMode ? 350 : 4096,
                    tools: [{ googleSearch: {} } as any],
                  },
                });
              } catch (searchToolErr) {
                // If googleSearch tool is unsupported for model, fallback to standard generateContent
                result = await client.models.generateContent({
                  model: modelName,
                  contents,
                  config: {
                    systemInstruction: voiceMode ? VOICE_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION,
                    temperature: voiceMode ? 0.2 : 0.4,
                    topP: 0.85,
                    maxOutputTokens: voiceMode ? 350 : 4096,
                  },
                });
              }
              candidateText = result.text || '';
              lastModelError = null;
              break;
            } catch (err: unknown) {
              lastModelError = err as Error;
              const msg = lastModelError.message || '';
              const isTransient = msg.includes('503') || msg.includes('high demand') || msg.includes('temporarily unavailable');
              if (isTransient && attempt === 1) {
                console.warn(`[Gemini:${modelName}] Transient ${msg.slice(0, 50)}, retrying in 1s...`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
              } else {
                throw err;
              }
            }
          }

          if (candidateText) return candidateText;
        } catch (err: unknown) {
          lastModelError = err as Error;
          console.warn(`[Gemini] Model ${modelName} failed (${lastModelError.message?.slice(0, 80)}...). Trying next...`);
        }
      }

      if (!candidateText && lastModelError) throw lastModelError;
      return candidateText;
    }, 'ChatResponse');


    let cleanAnswer = responseText;
    let suggestions: string[] = [];

    if (responseText.includes('---SUGGESTIONS---')) {
      const parts = responseText.split('---SUGGESTIONS---');
      cleanAnswer = parts[0].trim();
      const rawSug = parts[1] || '';
      suggestions = rawSug
        .split('\n')
        .map(line => line.replace(/^[-*•\d.]+\s*/, '').trim())
        .filter(line => line.length > 3 && !line.startsWith('---'));
    }

    if (suggestions.length < 2) {
      const fallbackSug = getSuggestionsForQuery(userMessage, languageCode);
      for (const s of fallbackSug) {
        if (!suggestions.includes(s) && suggestions.length < 3) {
          suggestions.push(s);
        }
      }
    }

    return {
      answer: cleanAnswer,
      sourceType,
      suggestions: suggestions.slice(0, 3),
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Gemini API error:', error.message);
    if (error.message?.includes('GEMINI_API_KEY')) {
      return {
        answer: '⚠️ Gemini API key is not configured. Please add your GEMINI_API_KEY to the .env file and restart the server.',
        sourceType: 'error',
      };
    }
    if (error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('429')) {
      return {
        answer: 'The AI service is temporarily busy. Please wait a moment and try again.',
        sourceType: 'error',
      };
    }
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('401') || error.message?.includes('403')) {
      return {
        answer: '⚠️ The Gemini API key appears to be invalid. Please check your GEMINI_API_KEY in the .env file.',
        sourceType: 'error',
      };
    }
    return {
      answer: `I encountered an error: ${error.message || 'Unknown error'}. Please try again.`,
      sourceType: 'error',
    };
  }
}

/**
 * Low-latency streaming chat response using Gemini streaming API.
 * Yields text tokens in real time as they are generated by the model.
 */
export async function* generateChatResponseStream(
  userMessage: string,
  kbContext: string,
  languageCode: LanguageCode,
  conversationHistory: GeminiMessage[] = [],
  voiceMode: boolean = false,
  userPersona?: { role?: string; interest?: string; state?: string } | string,
): AsyncGenerator<string, void, unknown> {
  const keys = getAllGeminiApiKeys();
  if (keys.length === 0) throw new Error('GEMINI_API_KEY environment variable is not set.');

  const voiceModeInstruction = voiceMode
    ? `[VOICE CONVERSATION MODE — Respond naturally in 2 to 3 short sentences. No markdown, no asterisks, no lists.]\n\n`
    : '';

  const suggestionInstruction = voiceMode
    ? ''
    : `\n[MANDATORY FOLLOW-UP SUGGESTIONS]: At the end, add:\n---SUGGESTIONS---\n1. [Suggestion 1]\n2. [Suggestion 2]\n3. [Suggestion 3]\n\n`;

  let personaInstruction = '';
  if (typeof userPersona === 'string' && userPersona.trim()) {
    personaInstruction = `${userPersona}\n\n`;
  } else if (userPersona && typeof userPersona === 'object') {
    const parts: string[] = [];
    if (userPersona.role) parts.push(`User Occupation/Role: ${userPersona.role}`);
    if ((userPersona as any).state) parts.push(`User State: ${(userPersona as any).state}`);
    if (userPersona.interest) parts.push(`Looking for/Needs: ${userPersona.interest}`);
    if (parts.length > 0) {
      personaInstruction = `[USER PROFILE]: ${parts.join(' | ')}.\n\n`;
    }
  }

  const langName = LANG_DISPLAY[languageCode];
  const langInstruction = langName
    ? `[LANGUAGE INSTRUCTION — You MUST respond entirely in ${langName}. Do not switch to any other language.]\n\n`
    : '';

  let augmentedMessage = userMessage;
  if (kbContext && kbContext.trim().length > 0) {
    augmentedMessage = `${voiceModeInstruction}${suggestionInstruction}${personaInstruction}${langInstruction}[KNOWLEDGE BASE CONTEXT]:\n${kbContext}\n\n[USER QUESTION]:\n${userMessage}`;
  } else {
    augmentedMessage = `${voiceModeInstruction}${suggestionInstruction}${personaInstruction}${langInstruction}${userMessage}`;
  }

  const recentHistory = conversationHistory.slice(voiceMode ? -4 : -8);
  const contents: any[] = [
    ...recentHistory.map((h) => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: h.parts.map((p) => ({ text: p.text })),
    })),
    {
      role: 'user',
      parts: [{ text: augmentedMessage }],
    },
  ];

  for (let k = 0; k < keys.length; k++) {
    const client = new GoogleGenAI({ apiKey: keys[k] });
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const responseStream = await client.models.generateContentStream({
          model: modelName,
          contents,
          config: {
            systemInstruction: voiceMode ? VOICE_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION,
            temperature: voiceMode ? 0.2 : 0.4,
            topP: 0.85,
            maxOutputTokens: voiceMode ? 350 : 4096,
          },
        });

        for await (const chunk of responseStream) {
          const text = chunk.text;
          if (text) {
            yield text;
          }
        }
        return;
      } catch (err: unknown) {
        console.warn(`[GeminiStream] Key #${k + 1} Model ${modelName} stream failed. Trying next...`, (err as Error)?.message || err);
      }
    }
  }

  throw new Error('Failed to stream response from Gemini candidate models across available API keys.');
}

