import { Router, Request, Response } from 'express';
import { detectLanguage, getLanguageDisplayName } from '../services/languageDetection';
import { retrieveContext, getKBStats } from '../services/knowledgeBase';
import { generateChatResponse, generateChatResponseStream, GeminiMessage } from '../services/gemini';

export const chatRouter = Router();

interface ServiceContextPayload {
  id?: string;
  title?: string;
  category?: string;
  helpsWith?: string;
  source?: string;
  officialUrl?: string;
}

function buildServiceContextBlock(sc?: ServiceContextPayload): string {
  if (!sc || !sc.title) return '';
  return `[CURRENT ACTIVE SERVICE IN FOCUS]:
The user is currently viewing this government service on Gram Sathi:
- Scheme Title: ${sc.title}
- Category: ${sc.category || 'Government Scheme'}
- Description: ${sc.helpsWith || ''}
- Official Portal: ${sc.officialUrl || ''}
- Department / Source: ${sc.source || 'Government of India'}

IMPORTANT INSTRUCTION:
When the user asks questions such as "Can I get this?", "What documents do I need?", "How do I apply?", "What are the benefits?", "Tell me about this scheme", they are specifically referring to "${sc.title}". Provide accurate, clear information about this scheme directly without asking "Which service are you talking about?".

`;
}

/**
 * Replaces known broken/legacy government scheme URLs with verified 200 OK myScheme endpoints.
 */
function normalizeSchemeUrls(text: string): string {
  if (!text) return text;
  return text
    .replace(/https?:\/\/(?:www\.)?kviconline\.gov\.in[^\s)\]]*/gi, 'https://www.myscheme.gov.in/schemes/pmegp')
    .replace(/https?:\/\/(?:www\.)?pmkusum\.mnre\.gov\.in[^\s)\]]*/gi, 'https://www.myscheme.gov.in/schemes/pm-kusum')
    .replace(/https?:\/\/(?:www\.)?pmsvanidhi\.mohua\.gov\.in[^\s)\]]*/gi, 'https://www.myscheme.gov.in/schemes/pm-svanidhi')
    .replace(/https?:\/\/(?:www\.)?pmaymis\.gov\.in[^\s)\]]*/gi, 'https://www.myscheme.gov.in/schemes/pmay-g')
    .replace(/https?:\/\/(?:www\.)?mudra\.org\.in[^\s)\]]*/gi, 'https://www.myscheme.gov.in/schemes/pmmy');
}

// Request idempotency cache: tracks in-flight and recent responses (5-minute TTL)
interface CachedRequest {
  timestamp: number;
  chunks: string[];
  done: boolean;
  languageCode: string;
}
const requestCache = new Map<string, CachedRequest>();

setInterval(() => {
  const now = Date.now();
  for (const [id, item] of requestCache.entries()) {
    if (now - item.timestamp > 5 * 60 * 1000) {
      requestCache.delete(id);
    }
  }
}, 60 * 1000);

// POST /api/chat/stream (Low-latency SSE streaming for voice & chat)
chatRouter.post('/chat/stream', async (req: Request, res: Response) => {
  const { message, history = [], forceLanguage, voiceMode = false, role, interest, serviceContext, requestId } = req.body as {
    message: string;
    history?: GeminiMessage[];
    forceLanguage?: string;
    voiceMode?: boolean;
    role?: string;
    interest?: string;
    serviceContext?: ServiceContextPayload;
    requestId?: string;
  };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const trimmedMessage = message.trim();
  const detected = detectLanguage(trimmedMessage);
  const languageCode = (forceLanguage as typeof detected.code) || detected.code;
  const rawKbContext = retrieveContext(trimmedMessage, voiceMode ? 2 : 5, voiceMode);
  const serviceBlock = buildServiceContextBlock(serviceContext);
  const kbContext = serviceBlock ? `${serviceBlock}\n${rawKbContext}` : rawKbContext;

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  // Send initial meta packet with detected language
  res.write(
    `data: ${JSON.stringify({
      meta: {
        language: languageCode,
        displayName: forceLanguage
          ? getLanguageDisplayName(forceLanguage as typeof detected.code)
          : detected.displayName,
      },
    })}\n\n`
  );

  // If this exact request was already processed, return cached response
  if (requestId && requestCache.has(requestId)) {
    const cached = requestCache.get(requestId)!;
    console.log(`[ChatStream] Idempotent replay for requestId: ${requestId} (chunks: ${cached.chunks.length})`);
    for (const chunk of cached.chunks) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
    if (cached.done) {
      res.write(`data: ${JSON.stringify({ done: true, language: cached.languageCode })}\n\n`);
      return res.end();
    }
  }

  try {
    const stream = generateChatResponseStream(
      trimmedMessage,
      kbContext,
      languageCode,
      history,
      voiceMode,
      { role, interest }
    );

    const cacheEntry: CachedRequest = {
      timestamp: Date.now(),
      chunks: [],
      done: false,
      languageCode,
    };
    if (requestId) requestCache.set(requestId, cacheEntry);

    for await (const chunk of stream) {
      if (requestId) cacheEntry.chunks.push(chunk);
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    if (requestId) cacheEntry.done = true;
    res.write(`data: ${JSON.stringify({ done: true, language: languageCode })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error('[ChatStream] Streaming error:', err?.message || err);
    res.write(`data: ${JSON.stringify({ error: err?.message || 'Streaming error' })}\n\n`);
    res.end();
  }
});

// POST /api/chat
chatRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, history = [], forceLanguage, voiceMode = false, role, interest, serviceContext } = req.body as {
    message: string;
    history?: GeminiMessage[];
    forceLanguage?: string;
    voiceMode?: boolean;
    role?: string;
    interest?: string;
    serviceContext?: ServiceContextPayload;
  };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const trimmedMessage = message.trim();

  // 1. Detect language
  const detected = detectLanguage(trimmedMessage);
  const languageCode = (forceLanguage as typeof detected.code) || detected.code;

  // 2. Retrieve relevant KB context + service context
  const rawKbContext = retrieveContext(trimmedMessage, voiceMode ? 2 : 5, voiceMode);
  const serviceBlock = buildServiceContextBlock(serviceContext);
  const kbContext = serviceBlock ? `${serviceBlock}\n${rawKbContext}` : rawKbContext;

  // 3. Generate response from Gemini with user persona
  const chatResponse = await generateChatResponse(
    trimmedMessage,
    kbContext,
    languageCode,
    history,
    voiceMode,
    { role, interest },
  );

  return res.json({
    answer: normalizeSchemeUrls(chatResponse.answer),
    language: languageCode,
    sourceType: chatResponse.sourceType,
    suggestions: chatResponse.suggestions || [],
    detectedLanguage: {
      code: languageCode,
      displayName: forceLanguage
        ? getLanguageDisplayName(forceLanguage as typeof detected.code)
        : detected.displayName,
      confidence: forceLanguage ? 'high' : detected.confidence,
    },
    hasKBContext: kbContext.length > 0,
  });
});

// GET /api/stats
chatRouter.get('/stats', (_req: Request, res: Response) => {
  const stats = getKBStats();
  return res.json({
    totalRecords: stats.totalRecords,
    categories: stats.categories,
    languagesSupported: 14,
    domains: 6,
    aiModel: 'Google Gemini 2.0 Flash',
    voiceEnabled: true,
  });
});
