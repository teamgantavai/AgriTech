import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

export const liveTokenRouter = Router();

// Recommended model for Gemini Live Native Audio
const GEMINI_LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-latest';

/**
 * POST /api/live/token
 * GET /api/live/token
 * 
 * Secure server-side endpoint that generates a short-lived ephemeral token
 * for client-side Gemini Live API connections.
 * 
 * SECURITY: The permanent GEMINI_API_KEY is stored strictly in the server environment
 * and is NEVER exposed to the browser. Only the temporary, single-use/time-limited
 * token name (e.g. "auth_tokens/...") is sent to the client.
 */
async function mintEphemeralToken(apiKey: string, maxRetries = 2): Promise<{ name: string }> {
  const ai = new GoogleGenAI({ apiKey });
  const now = Date.now();
  const expireTime = new Date(now + 30 * 60 * 1000).toISOString();
  // Allow new sessions to be established anytime within the token's lifetime
  const newSessionExpireTime = new Date(now + 30 * 60 * 1000).toISOString();

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const token = await ai.authTokens.create({
        config: {
          expireTime,
          newSessionExpireTime,
          httpOptions: { apiVersion: 'v1alpha' },
        }
      });

      if (!token || !token.name) {
        throw new Error('Failed to obtain ephemeral token from Google AI (empty token name).');
      }

      return token;
    } catch (err: any) {
      lastError = err;
      const cause = err?.cause?.code || err?.cause?.message || '';
      console.warn(`[LiveToken] Mint attempt ${attempt}/${maxRetries + 1} failed: ${err?.message || err}${cause ? ` (cause: ${cause})` : ''}`);

      if (attempt <= maxRetries) {
        // Exponential backoff delay
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
  }

  throw lastError;
}

async function handleGenerateToken(_req: Request, res: Response) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('[LiveToken] GEMINI_API_KEY is not configured on the server.');
    return res.status(500).json({
      error: 'Server configuration error: Gemini API key is missing on the server.'
    });
  }

  try {
    const token = await mintEphemeralToken(apiKey, 2);

    console.log(`[LiveToken] Successfully generated ephemeral token: ${token.name.substring(0, 20)}...`);

    return res.json({
      token: token.name,
      model: GEMINI_LIVE_MODEL,
      expiresInMinutes: 30,
    });
  } catch (err: any) {
    const cause = err?.cause?.code || err?.cause?.message || '';
    const errorDetails = cause ? `${err?.message || 'Network error'} (${cause})` : (err?.message || 'Unknown network error');
    console.error(`[LiveToken] Error creating ephemeral token: ${err?.message || err}${cause ? ` [cause: ${cause}]` : ''}`);

    return res.status(502).json({
      error: 'Failed to create ephemeral token for Gemini Live.',
      details: errorDetails
    });
  }
}

liveTokenRouter.post('/token', handleGenerateToken);
liveTokenRouter.get('/token', handleGenerateToken);

