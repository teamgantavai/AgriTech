// ================================================================
// geminiKeys.ts — Multi-API-Key Failover Manager for Google Gemini
// Supports GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3
// or GEMINI_API_KEYS (comma-separated list)
// Automatically cycles to the next key when one fails or hits quota
// ================================================================

import { GoogleGenAI } from '@google/genai';

/**
 * Retrieve all configured Gemini API keys in priority order.
 * Deduplicates and removes empty strings.
 */
export function getAllGeminiApiKeys(): string[] {
  const keys: string[] = [];

  // Primary key
  if (process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY.trim());
  }

  // Numbered fallback keys (GEMINI_API_KEY_2, GEMINI_API_KEY_3, ...)
  for (let i = 2; i <= 5; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key && key.trim()) {
      keys.push(key.trim());
    }
  }

  // Comma-separated list fallback (GEMINI_API_KEYS=key1,key2,key3)
  if (process.env.GEMINI_API_KEYS) {
    const split = process.env.GEMINI_API_KEYS.split(',').map((k) => k.trim()).filter(Boolean);
    keys.push(...split);
  }

  // Deduplicate preserving order
  return Array.from(new Set(keys));
}

let activeKeyIndex = 0;

/**
 * Get current primary key index
 */
export function getActiveKeyIndex(): number {
  return activeKeyIndex;
}

/**
 * Execute an operation with automatic fallback across all available Gemini API keys.
 * If key N throws a quota (429), auth, or network error, it will immediately attempt key N+1.
 */
export async function withGeminiFailover<T>(
  operation: (apiKey: string, ai: GoogleGenAI, keyIndex: number) => Promise<T>,
  contextName = 'Gemini'
): Promise<T> {
  const keys = getAllGeminiApiKeys();

  if (keys.length === 0) {
    throw new Error('No Gemini API keys configured. Please set GEMINI_API_KEY in .env file.');
  }

  let lastError: any = null;
  const startIndex = activeKeyIndex % keys.length;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const currentIndex = (startIndex + attempt) % keys.length;
    const apiKey = keys[currentIndex];
    const masked = apiKey.length > 8 ? `${apiKey.substring(0, 4)}...${apiKey.slice(-4)}` : '***';

    try {
      const ai = new GoogleGenAI({ apiKey });
      const result = await operation(apiKey, ai, currentIndex);
      
      // Update preferred active key index upon success
      activeKeyIndex = currentIndex;
      return result;
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.statusCode || (err?.message?.includes('429') ? 429 : 500);
      const isQuotaOrAuth =
        status === 429 ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('quota') ||
        err?.message?.includes('API_KEY_INVALID') ||
        err?.message?.includes('PERMISSION_DENIED');

      console.warn(
        `[${contextName}] Key #${currentIndex + 1} (${masked}) failed (${err?.message || err}). ${
          attempt < keys.length - 1 ? 'Trying next available API key...' : 'All available keys exhausted.'
        }`
      );

      // If we have another key to try, advance and continue loop
      if (attempt < keys.length - 1) {
        continue;
      }
    }
  }

  throw lastError || new Error(`All ${keys.length} Gemini API keys failed.`);
}
