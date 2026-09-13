import { Router, Request, Response } from 'express';
import { detectLanguage, getLanguageDisplayName } from '../services/languageDetection';
import { retrieveContext, getKBStats } from '../services/knowledgeBase';
import { generateChatResponse, generateChatResponseStream, GeminiMessage } from '../services/gemini';

export const chatRouter = Router();

// POST /api/chat/stream (Low-latency SSE streaming for voice & chat)
chatRouter.post('/chat/stream', async (req: Request, res: Response) => {
  const { message, history = [], forceLanguage, voiceMode = true, role, interest } = req.body as {
    message: string;
    history?: GeminiMessage[];
    forceLanguage?: string;
    voiceMode?: boolean;
    role?: string;
    interest?: string;
  };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const trimmedMessage = message.trim();
  const detected = detectLanguage(trimmedMessage);
  const languageCode = (forceLanguage as typeof detected.code) || detected.code;
  const kbContext = retrieveContext(trimmedMessage, voiceMode ? 2 : 5, voiceMode);

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

  try {
    const stream = generateChatResponseStream(
      trimmedMessage,
      kbContext,
      languageCode,
      history,
      voiceMode,
      { role, interest }
    );

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

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
  const { message, history = [], forceLanguage, voiceMode = false, role, interest } = req.body as {
    message: string;
    history?: GeminiMessage[];
    forceLanguage?: string;
    voiceMode?: boolean;
    role?: string;
    interest?: string;
  };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const trimmedMessage = message.trim();

  // 1. Detect language
  const detected = detectLanguage(trimmedMessage);
  const languageCode = (forceLanguage as typeof detected.code) || detected.code;

  // 2. Retrieve relevant KB context (compact for voice mode to eliminate latency)
  const kbContext = retrieveContext(trimmedMessage, voiceMode ? 2 : 5, voiceMode);

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
    answer: chatResponse.answer,
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
