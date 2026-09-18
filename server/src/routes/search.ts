import { Router, Request, Response } from 'express';
import { searchWebAndKnowledge } from '../services/internetSearch';

export const searchRouter = Router();

/**
 * GET /api/search?q=query
 * Live internet search endpoint with Google Grounding & Knowledge Base synthesis.
 * Called by Gemini Live voice agent or web clients when seeking live web information.
 */
searchRouter.get('/', async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || (req.query.query as string) || '').trim();

  if (!q) {
    return res.status(400).json({
      success: false,
      error: 'Query parameter "q" is required',
    });
  }

  try {
    const result = await searchWebAndKnowledge(q);
    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('[SearchRouter] Search failed:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: 'Search failed',
      details: err?.message || 'Unknown error',
    });
  }
});
