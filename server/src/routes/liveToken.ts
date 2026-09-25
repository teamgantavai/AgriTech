import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { withGeminiFailover, getAllGeminiApiKeys } from '../services/geminiKeys';

export const liveTokenRouter = Router();

// Recommended model for Gemini Live Native Audio
const GEMINI_LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-latest';

/**
 * Mint an ephemeral token with a specific GoogleGenAI client instance
 */
async function mintWithClient(ai: GoogleGenAI, maxRetries = 1): Promise<{ name: string }> {
  const now = Date.now();
  const expireTime = new Date(now + 30 * 60 * 1000).toISOString();
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

      return token as typeof token & { name: string };
    } catch (err: any) {
      lastError = err;
      if (attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
  }

  throw lastError;
}

async function handleGenerateToken(_req: Request, res: Response) {
  const keys = getAllGeminiApiKeys();

  if (keys.length === 0) {
    console.error('[LiveToken] No Gemini API keys configured on the server.');
    return res.status(500).json({
      error: 'Server configuration error: Gemini API key is missing on the server (GEMINI_API_KEY).'
    });
  }

  try {
    const token = await withGeminiFailover(async (_key, ai, keyIndex) => {
      console.log(`[LiveToken] Minting token using API Key #${keyIndex + 1}...`);
      return await mintWithClient(ai, 1);
    }, 'LiveToken');

    console.log(`[LiveToken] Successfully generated ephemeral token: ${token.name.substring(0, 20)}...`);

    return res.json({
      token: token.name,
      model: GEMINI_LIVE_MODEL,
      expiresInMinutes: 30,
    });
  } catch (err: any) {
    const cause = err?.cause?.code || err?.cause?.message || '';
    const errorDetails = cause ? `${err?.message || 'Network error'} (${cause})` : (err?.message || 'Unknown network error');
    console.error(`[LiveToken] Error creating ephemeral token across all keys: ${err?.message || err}${cause ? ` [cause: ${cause}]` : ''}`);

    return res.status(502).json({
      error: 'Failed to create ephemeral token for Gemini Live across available API keys.',
      details: errorDetails
    });
  }
}

liveTokenRouter.post('/token', handleGenerateToken);
liveTokenRouter.get('/token', handleGenerateToken);


