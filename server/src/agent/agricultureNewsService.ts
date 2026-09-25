// ============================================================
// Agriculture News Service — Official source news retrieval
// Branch: agent-control
// ============================================================

import { GoogleGenAI } from '@google/genai';
import { isTrustedGovDomain, sanitizeExternalContent } from './trustedDomainRegistry';
import type { SourceAttribution } from './agentTypes';

export interface AgricultureNewsItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  category: string;
  publishedDate?: string;
  retrievedAt: string;
  isOfficialGov: boolean;
}

export interface AgricultureNewsResponse {
  items: AgricultureNewsItem[];
  summary: string;
  sources: SourceAttribution[];
  retrievedAt: number;
  warning?: string;
}

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

const AGRICULTURE_CATEGORIES = {
  msp: 'Minimum Support Price (MSP)',
  crop: 'Crop Advisory & Calendar',
  weather: 'Weather & Climate',
  scheme: 'Government Schemes',
  subsidy: 'Subsidies & Grants',
  market: 'Market Prices (Mandi)',
  export: 'Export/Import Policy',
  disease: 'Crop Disease & Pest Alert',
  fertilizer: 'Fertilizer & Seeds',
  procurement: 'Procurement Policy',
};

/**
 * Retrieve current agriculture news and government announcements
 * from official sources via Gemini Google Search Grounding.
 * 
 * Grounding ensures information is current, not LLM hallucination.
 */
export async function getAgricultureNews(
  state?: string,
  category?: string,
  language: string = 'hi'
): Promise<AgricultureNewsResponse> {
  const now = Date.now();
  const retrievedAt = new Date(now).toISOString();

  const categoryLabel = category && AGRICULTURE_CATEGORIES[category as keyof typeof AGRICULTURE_CATEGORIES]
    ? AGRICULTURE_CATEGORIES[category as keyof typeof AGRICULTURE_CATEGORIES]
    : 'Agriculture Updates';

  const stateClause = state ? `in ${state} state` : 'across India';

  const query = `Latest official government agriculture news and announcements ${stateClause} 2025 2026 ${categoryLabel} from Ministry of Agriculture, ICAR, or state agriculture departments`;

  const client = getAiClient();
  if (!client) {
    return {
      items: [],
      summary: 'Agriculture news service is currently unavailable. Please check agricoop.gov.in for official updates.',
      sources: [],
      retrievedAt: now,
      warning: 'AI client not configured.',
    };
  }

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are retrieving official Indian government agriculture news.

Search for: "${query}"

Return a JSON response with this structure:
{
  "summary": "2-3 sentence summary of key updates",
  "items": [
    {
      "title": "...",
      "summary": "1-2 sentence description",
      "source": "Ministry name or portal name",
      "url": "official URL if found",
      "category": "msp|crop|scheme|subsidy|market|weather|fertilizer|procurement|disease|export",
      "publishedDate": "approximate date if known"
    }
  ]
}

IMPORTANT:
- Only include information from official government sources (gov.in, nic.in, ICAR, Ministry of Agriculture)
- If you cannot find current official information, return empty items with a note in summary
- Do NOT fabricate news items or make up announcements
- Mark items as unavailable if official sources are inaccessible`,
      config: {
        tools: [{ googleSearch: {} } as any],
        temperature: 0.1,
        maxOutputTokens: 1000,
      },
    });

    const rawText = response.text || '';
    const sanitized = sanitizeExternalContent(rawText);

    // Extract JSON from response
    const jsonMatch = sanitized.match(/\{[\s\S]*\}/);
    let parsed: any = null;
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        // JSON parse failed — use raw text as summary
      }
    }

    // Extract grounding sources
    const groundingSources: SourceAttribution[] = [];
    const candidate = response.candidates?.[0];
    const grounding = (candidate as any)?.groundingMetadata;
    if (grounding?.groundingChunks) {
      for (const chunk of grounding.groundingChunks) {
        if (chunk.web?.uri) {
          const { trusted, domain } = isTrustedGovDomain(chunk.web.uri);
          groundingSources.push({
            title: chunk.web.title || domain?.name || 'Government Source',
            url: chunk.web.uri,
            domain: new URL(chunk.web.uri).hostname,
            isOfficialGov: trusted,
            retrievedAt: now,
            retrievedAtDisplay: new Date(now).toLocaleString('en-IN'),
            confidence: trusted ? 'high' : 'medium',
            status: 'current',
          });
        }
      }
    }

    const items: AgricultureNewsItem[] = (parsed?.items || []).map((item: any) => ({
      title: String(item.title || ''),
      summary: String(item.summary || ''),
      source: String(item.source || 'Government of India'),
      url: String(item.url || 'https://agricoop.gov.in'),
      category: String(item.category || category || 'scheme'),
      publishedDate: item.publishedDate,
      retrievedAt,
      isOfficialGov: true,
    }));

    return {
      items,
      summary: parsed?.summary || sanitized.slice(0, 400),
      sources: groundingSources,
      retrievedAt: now,
    };
  } catch (err: any) {
    console.error('[AgricultureNews] Error:', err?.message);
    return {
      items: [],
      summary: 'सरकारी कृषि समाचार अभी उपलब्ध नहीं है। कृपया agricoop.gov.in देखें।',
      sources: [],
      retrievedAt: now,
      warning: 'Unable to retrieve current agriculture news from official sources.',
    };
  }
}
