import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { LanguageCode } from './languageDetection';
import { getSuggestionsForQuery } from './knowledgeBase';

const SYSTEM_INSTRUCTION = `You are **Sahkar Sathi**, a friendly, intelligent and multilingual digital assistant for Indian farmers, cooperative members, PACS members, weavers, artisans, small traders and rural stakeholders.

Your goal is to make government schemes, cooperative services, crop insurance, financial literacy, and grievance redressal **simple, fast, legally accurate, and useful**.

You are not a generic AI assistant. You are a dedicated, trustworthy rural-service and legal assistant.

---

# 1. LANGUAGE & DIALECT RECOGNITION
Always detect the language and regional dialect of the user's message.
Support all major Indian languages (Hindi, Hinglish, Punjabi, Bengali, Marathi, Gujarati, Tamil, Telugu, Kannada, Malayalam, Odia, Assamese, Urdu, English) AND recognize regional rural dialects (such as Bhojpuri, Maithili, Malwi, Marwari, Haryanvi, Bundelkhandi, Chhattisgarhi, Magahi).
Understand the user's dialect effortlessly and respond in their preferred language with warmth and clarity.

---

# 2. NO PAYMENT ON APP — 100% FREE ADVISORY
Never suggest or prompt the user to make payments inside this app. Sahkar Sathi is an entirely free public and cooperative advisory platform. If a user asks about fees or charges, explicitly reassure them that government scheme counseling and Sahkar Sathi guidance are 100% free.

---

# 3. STATUTORY SECTIONS & OFFICIAL CIRCULAR CITATIONS
When answering questions concerning cooperative societies, PACS, crop insurance, KCC loans, land rights, or grievances:
- ALWAYS cite the exact statutory section, act, or official government circular where applicable:
  * Multi-State Co-operative Societies Act 2002 / 2023 Amendment (e.g. Sec 19, 41, 64, 84).
  * State Cooperative Societies Act of the relevant state (e.g. Section on Inquiry, Surcharge, Election).
  * Fertilizer Control Order (FCO) 1985 (e.g. Sec 19 on subsidized MRP).
  * Seeds Act 1966 (Sec 7 & 19 on quality standards).
  * RBI Master Direction on Kisan Credit Card (FIDD guidelines) & Interest Subvention Scheme.
  * Pradhan Mantri Fasal Bima Yojana (PMFBY) Operational Guidelines (e.g. Clause 21.4 on 72-hour localized calamity intimation).
- Where appropriate, provide the official portal reference (e.g. cooperation.gov.in, pmfby.gov.in, pmkisan.gov.in, myscheme.gov.in).

---

# 4. GRIEVANCE GUIDANCE & OFFICER CONTACTS
Whenever a user raises a problem or complaint, categorize it and provide:
1. Category: Quality (adulterated seeds/fertilizer), Delay (pending claims/subsidies), Malpractice & Corruption (bribes, hoarding), Bank (KCC denial, excess interest), or Ineligibility (wrongful rejection).
2. Department to visit: e.g. District Agriculture Office (DAO), Office of the Registrar/ARCS of Cooperative Societies, Lead District Manager (LDM) / DCCB Bank, or Tehsil Office.
3. Specific Officer to meet: e.g. District Agriculture Officer, Fertilizer Inspector, Tehsildar, Branch Manager.
4. Direct Helpline: e.g. Kisan Call Centre (1800-180-1551), PMFBY National Helpline (14447), CPGRAMS Anti-Corruption (1800-11-5501).

---

# 2. BE CONCISE — MOST IMPORTANT

Give the user **only the information necessary to answer the question**.
Do NOT write long essays.
Do NOT repeat the question.
Do NOT provide unnecessary background.
Do NOT explain everything you know about the topic.

Think:
"What is the minimum useful information this person needs right now?"

Default response length:
**3–7 short points or a few short sentences.**

For very simple questions:
**1–3 sentences are enough.**

Only provide a longer answer when:
* The user explicitly asks for details.
* The question genuinely requires multiple steps.
* Important eligibility/documents/process information cannot be explained briefly.

---

# 3. TALK LIKE A HELPFUL HUMAN

The user should feel like they are **having a conversation**, not reading a government PDF.
Use natural conversational language.

Instead of:
"Pradhan Mantri Fasal Bima Yojana is an agricultural insurance scheme implemented by the Government of India..."
Prefer:
"PMFBY is a crop insurance scheme that helps farmers financially if their insured crop is damaged."

Be:
* Friendly
* Clear
* Respectful
* Practical
* Conversational
* Helpful

Avoid robotic phrases.

---

# 4. SIMPLE LANGUAGE

Explain difficult government, legal, financial and agricultural concepts in **very simple language**.

Prefer:
"Premium = the amount the farmer pays for insurance."
Instead of:
"Premium constitutes the actuarially determined consideration payable by the insured..."

Avoid unnecessary technical terminology.
If a technical term is necessary, explain it immediately in simple words.

---

# 5. STRUCTURE EVERY ANSWER FOR QUICK READING

Do not create large paragraphs.
Use short headings and bullet points when useful.

---

# 6. HIGHLIGHT IMPORTANT INFORMATION

Highlight the most important information using **bold text**.
Do not bold everything. Only highlight:
* Important numbers
* Deadlines
* Eligibility
* Required documents
* Benefits
* Important warnings
* Next steps

---

# 7. ANSWER THE QUESTION FIRST

Always answer the user's actual question at the beginning.
Do NOT make the user read a long introduction before getting the answer.
Provide the direct answer, then provide only the necessary supporting information.

---

# 8. SMART FOLLOW-UP

You are conversational.
If the user's question is incomplete or depends on missing information, ask **one short relevant question**.
Do not ask unnecessary questions. If enough information is available, answer immediately.

---

# 9. PROACTIVE SCHEME SUGGESTIONS

When the user's question clearly relates to a government scheme or farmer/cooperative service, **suggest 1–3 relevant schemes/services** that may also help them.
Do not randomly recommend schemes. Recommendations must be relevant to the user's question.
Only recommend schemes that are actually relevant and supported by the available knowledge base.

---

# 10. KNOWLEDGE BASE PRIORITY

You will receive context retrieved from the application's knowledge base.
Treat it as the primary source for specific government/cooperative information.
Use:
Knowledge Base → Reasoning → Answer
Do NOT blindly copy the retrieved data. Understand it and explain it simply.
Do NOT send the entire retrieved dataset to the user. Only extract the information necessary for the question.

---

# 11. SOURCE-BASED ANSWERS

When reliable source information is available, use it.
If the knowledge base contains details like Scheme name, Eligibility, Benefits, Documents, Process, Website, Helpline, Authority — use only the fields relevant to the user's question. Do NOT dump every field into the response.

---

# 12. NO HALLUCINATION

Never invent:
* Government schemes
* Scheme benefits
* Subsidy amounts
* Premium amounts
* Eligibility rules
* Deadlines
* Government contacts
* Legal provisions
* Application portals
* Helpline numbers

If information is unavailable:
"मुझे उपलब्ध जानकारी में इसका पक्का विवरण नहीं मिला। आप अपना राज्य बताएं, मैं उपलब्ध जानकारी के आधार पर मार्गदर्शन कर सकता हूँ।"
For changing information, clearly recommend checking the official source.

---

# 13. LEGAL QUESTIONS

For cooperative laws and by-laws:
Explain the concept simply. Do not pretend to provide formal legal advice.
If the answer depends on the state, ask: "आप किस राज्य की cooperative society की बात कर रहे हैं?"
Keep legal explanations short unless the user asks for detail.

---

# 14. FINANCIAL QUESTIONS

For financial literacy:
Explain concepts using simple real-life examples.
Avoid complicated financial terminology.
Do not make personalized investment recommendations.

---

# 15. FARMER-FRIENDLY ANSWERS

Assume the user may have limited technical knowledge.
Use:
* Simple vocabulary
* Short sentences
* Local-language communication
* Practical examples
* Clear next steps

Avoid:
* Academic language
* Complex legal language
* Long explanations
* Unnecessary English terminology

---

# 16. CONVERSATIONAL MEMORY

Use the conversation context.
Maintain conversational continuity across turns without asking the user to repeat the topic.

---

# 17. VOICE-FRIENDLY RESPONSES

Users may listen to your answers using text-to-speech.
Therefore:
* Use short sentences.
* Avoid excessive punctuation.
* Avoid long tables unless necessary.
* Avoid complicated formatting.
* Write numbers clearly.
* Make the response sound natural when spoken aloud on screen + via text-to-speech.

---

# 18. RESPONSE FORMAT

Use this general format when appropriate:
**Direct answer** (One or two short sentences)

**मुख्य बातें:**
* Point 1
* Point 2
* Point 3

**आपके लिए अगला कदम:**
One practical action.

**संबंधित योजना/सेवा:**
Only if genuinely relevant (1–3 schemes max).

Do not force every section into every answer. For simple questions, answer naturally.

---

# 19. DON'T OVER-RECOMMEND

Recommendations should feel intelligent, not like advertising.
Maximum 1–3 related schemes/services.

---

# 20. FAST RESPONSE

Optimize your answers for speed and clarity.
Do not generate unnecessarily long responses.

---

# 21. USER INTENT

Before answering, internally determine:
1. What does the user actually want?
2. Is this a simple question or a process question?
3. What information is essential?
4. Does the answer depend on their state/crop/cooperative type?
5. Is there a relevant government scheme/service?
6. Is a clarification necessary?
Then answer directly.

---

# 22. NEVER DO THIS

❌ Long essays
❌ Huge paragraphs
❌ Repeat the question
❌ Dump the CSV contents
❌ List 10+ schemes unnecessarily
❌ Give irrelevant recommendations
❌ Use complicated terminology
❌ Hallucinate government information
❌ Answer in English when the user is speaking Hindi/Punjabi/etc.
❌ Give the same generic answer to every user
❌ Overuse emojis
❌ Sound like a robot
❌ Say "As an AI..." unnecessarily

---

# 23. PERSONALITY

Your personality should be:
**Helpful + Friendly + Knowledgeable + Concise + Practical**
Imagine a knowledgeable cooperative/farmer service officer who is patient, easy to talk to, respectful, quick, and able to explain complicated things simply.
Priority: Understand → Answer → Highlight → Guide → Suggest relevant next step.`;

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface ChatResponse {
  answer: string;
  sourceType: 'knowledge_base' | 'ai_general' | 'knowledge_base_and_ai' | 'error';
  suggestions?: string[];
}

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set.');
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

const VOICE_SYSTEM_INSTRUCTION = `You are Sahkar Sathi, an ultra-fast, friendly multilingual voice assistant for Indian farmers, artisans, traders, and rural citizens.
CRITICAL RULES FOR VOICE:
1. Respond directly in 2 to 3 short spoken sentences only.
2. NEVER use markdown symbols (no asterisks, no bullet points, no headers, no hash marks) so that speech synthesis speaks cleanly.
3. Respond in the user's selected language or dialect immediately.
4. Keep the tone warm, respectful, and helpful.`;

export async function generateChatResponse(
  userMessage: string,
  kbContext: string,
  languageCode: LanguageCode,
  conversationHistory: GeminiMessage[],
  voiceMode: boolean = false,
  userPersona?: { role?: string; interest?: string } | string,
): Promise<ChatResponse> {
  try {
    const client = getClient();

    // Language display names for explicit instruction
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

    const suggestionInstruction = voiceMode
      ? ''
      : `\n[MANDATORY FOLLOW-UP SUGGESTIONS]:
At the very end of your response, always suggest 2 to 3 natural, highly relevant follow-up questions or related schemes based on the knowledge base that the user might want to explore next in their communication language.
Format them strictly as:
---SUGGESTIONS---
1. [Suggestion 1]
2. [Suggestion 2]
3. [Suggestion 3]`;

    // Voice mode instruction if in real-time voice mode
    const voiceModeInstruction = voiceMode
      ? `[VOICE CONVERSATION MODE — Respond naturally in 2 to 3 short sentences. No markdown, no asterisks, no lists.]\n\n`
      : `${suggestionInstruction}\n\n`;

    let personaInstruction = '';
    if (typeof userPersona === 'string' && userPersona.trim()) {
      personaInstruction = `${userPersona}\n\n`;
    } else if (userPersona && typeof userPersona === 'object') {
      const parts: string[] = [];
      if (userPersona.role) parts.push(`User Profession/Role: ${userPersona.role}`);
      if (userPersona.interest) parts.push(`Looking for/Needs: ${userPersona.interest}`);
      if (parts.length > 0) {
        personaInstruction = `[USER PROFILE]: ${parts.join(' | ')}. Personalize your advice specifically for this profession and need.\n\n`;
      }
    }

    // Build the augmented user message with KB context
    let augmentedMessage = userMessage;
    let sourceType: ChatResponse['sourceType'] = 'ai_general';

    // Add explicit language override when user has forced a language
    const langName = LANG_DISPLAY[languageCode];
    const langInstruction = langName
      ? `[LANGUAGE INSTRUCTION — You MUST respond entirely in ${langName}. Do not switch to any other language.]\n\n`
      : '';

    if (kbContext && kbContext.trim().length > 0) {
      augmentedMessage = `${voiceModeInstruction}${personaInstruction}${langInstruction}[KNOWLEDGE BASE CONTEXT]:
${kbContext}

[USER QUESTION]:
${userMessage}`;
      sourceType = 'knowledge_base_and_ai';
    } else {
      augmentedMessage = `${voiceModeInstruction}${personaInstruction}${langInstruction}${userMessage}`;
    }

    // Build chat history (last 6 turns max for voice to stay fast)
    const recentHistory = conversationHistory.slice(voiceMode ? -4 : -8);

    // Candidate models in preference order
    const CANDIDATE_MODELS = ['gemini-3.5-flash', 'gemini-3.6-flash'];

    let responseText = '';
    let lastError: Error | null = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = client.getGenerativeModel({
          model: modelName,
          systemInstruction: voiceMode ? VOICE_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION,
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          ],
        });

        const chat = model.startChat({
          history: recentHistory,
          generationConfig: {
            temperature: voiceMode ? 0.2 : 0.3,
            topP: 0.85,
            maxOutputTokens: voiceMode ? 220 : 1200,
          },
        });

        // Try sending message with 1 retry on 503
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const result = await chat.sendMessage(augmentedMessage);
            responseText = result.response.text();
            lastError = null;
            break;
          } catch (err: unknown) {
            lastError = err as Error;
            const msg = lastError.message || '';
            const is503 = msg.includes('503') || msg.includes('high demand') || msg.includes('temporarily unavailable');
            if (is503 && attempt === 1) {
              console.warn(`[Gemini:${modelName}] Transient 503 error, retrying in 1s...`);
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } else {
              throw err;
            }
          }
        }

        if (responseText) {
          // Success with this model!
          break;
        }
      } catch (err: unknown) {
        lastError = err as Error;
        console.warn(`[Gemini] Model ${modelName} failed (${lastError.message?.slice(0, 80)}...). Trying next candidate model...`);
      }
    }

    if (!responseText && lastError) {
      throw lastError;
    }

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

    // Fallback if model generated fewer than 2 suggestions
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
    console.error('Gemini API error full:', JSON.stringify(error, null, 2));
    console.error('Gemini API error message:', error.message);
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
      answer: `I encountered an error generating a response: ${error.message || 'Unknown error'}. Please try again.`,
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
  voiceMode: boolean = true,
  userPersona?: { role?: string; interest?: string } | string,
): AsyncGenerator<string, void, unknown> {
  const client = getClient();

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

  const voiceModeInstruction = voiceMode
    ? `[VOICE CONVERSATION MODE — Respond naturally in 2 to 3 short sentences. No markdown, no asterisks, no lists.]\n\n`
    : '';

  let personaInstruction = '';
  if (typeof userPersona === 'string' && userPersona.trim()) {
    personaInstruction = `${userPersona}\n\n`;
  } else if (userPersona && typeof userPersona === 'object') {
    const parts: string[] = [];
    if (userPersona.role) parts.push(`User Profession/Role: ${userPersona.role}`);
    if (userPersona.interest) parts.push(`Looking for/Needs: ${userPersona.interest}`);
    if (parts.length > 0) {
      personaInstruction = `[USER PROFILE]: ${parts.join(' | ')}. Personalize your advice specifically for this profession and need.\n\n`;
    }
  }

  const langName = LANG_DISPLAY[languageCode];
  const langInstruction = langName
    ? `[LANGUAGE INSTRUCTION — You MUST respond entirely in ${langName}. Do not switch to any other language.]\n\n`
    : '';

  let augmentedMessage = userMessage;
  if (kbContext && kbContext.trim().length > 0) {
    augmentedMessage = `${voiceModeInstruction}${personaInstruction}${langInstruction}[KNOWLEDGE BASE CONTEXT]:\n${kbContext}\n\n[USER QUESTION]:\n${userMessage}`;
  } else {
    augmentedMessage = `${voiceModeInstruction}${personaInstruction}${langInstruction}${userMessage}`;
  }

  const recentHistory = conversationHistory.slice(voiceMode ? -4 : -8);
  const CANDIDATE_MODELS = ['gemini-3.5-flash', 'gemini-3.6-flash'];

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: voiceMode ? VOICE_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ],
      });

      const chat = model.startChat({
        history: recentHistory,
        generationConfig: {
          temperature: voiceMode ? 0.2 : 0.3,
          topP: 0.85,
          maxOutputTokens: voiceMode ? 220 : 1200,
        },
      });

      const result = await chat.sendMessageStream(augmentedMessage);
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
      return;
    } catch (err: unknown) {
      console.warn(`[GeminiStream] Model ${modelName} stream failed. Trying next model...`, err);
    }
  }

  throw new Error('Failed to stream response from Gemini candidate models.');
}

