import { GoogleGenAI } from '@google/genai';
import { getAllRecords, KBRecord } from './knowledgeBase';
import fs from 'fs';
import path from 'path';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  category?: string;
}

export interface SearchResponse {
  query: string;
  summary: string;
  results: SearchResultItem[];
  sources: string[];
}

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[InternetSearch] GEMINI_API_KEY is not configured');
      return null;
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

/**
 * Searches local knowledge base (CSV + curated JSON) for matching records.
 */
function searchLocalKnowledge(query: string, limit: number = 3): SearchResultItem[] {
  const q = query.toLowerCase().trim();
  const matched: SearchResultItem[] = [];

  // 1. Check curated popular services first (like nsp-scholarship, mudra, etc.)
  try {
    const curatedPaths = [
      path.resolve(process.cwd(), '../data/services_hi.json'),
      path.resolve(process.cwd(), 'data/services_hi.json'),
      path.resolve(__dirname, '../../../data/services_hi.json'),
    ];
    for (const p of curatedPaths) {
      if (fs.existsSync(p)) {
        const services = JSON.parse(fs.readFileSync(p, 'utf-8'));
        for (const s of services) {
          const text = `${s.title || ''} ${s.category || ''} ${s.forWhom || ''} ${s.helpsWith || ''} ${s.whatIsIt || ''}`.toLowerCase();
          if (text.includes(q) || (q.includes('student') && (s.id === 'nsp-scholarship' || text.includes('छात्र') || text.includes('scholarship')))) {
            matched.push({
              title: s.title,
              url: s.officialUrl || 'https://scholarships.gov.in',
              snippet: s.helpsWith || s.whatIsIt || '',
              source: s.source || 'भारत सरकार',
              category: s.category || 'Education',
            });
          }
        }
        break;
      }
    }
  } catch (err) {
    // Ignore curated load error
  }

  // 2. Check 870+ records in CSV knowledge base
  const allRecords = getAllRecords();
  for (const r of allRecords) {
    if (matched.length >= limit) break;
    const text = `${r.title || ''} ${r.topic || ''} ${r.keywords || ''} ${r.answer || ''} ${r.category || ''}`.toLowerCase();
    if (text.includes(q)) {
      matched.push({
        title: r.title || r.topic || 'Government Service',
        url: r.url || 'https://www.myscheme.gov.in',
        snippet: (r.answer || '').slice(0, 200),
        source: r.source || 'myScheme Portal',
        category: r.category || 'Government Scheme',
      });
    }
  }

  return matched.slice(0, limit);
}

/**
 * Searches the live internet using Gemini's Google Search Grounding.
 */
async function searchWithGoogleGrounding(query: string): Promise<{ summary: string; webResults: SearchResultItem[] } | null> {
  const client = getAiClient();
  if (!client) return null;

  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest',
  ];

  const prompt = `You are an internet search assistant for Indian government services, student scholarships, education, exams, and citizen welfare.
Search the internet and answer this query accurately, with up-to-date facts for India:
Query: "${query}"

Provide:
1. A concise, spoken-friendly summary (2 to 3 sentences) answering the user's question with specific scheme names, benefits, or procedures.
2. Official portal URLs or department names if found.`;

  for (const model of candidateModels) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} } as any],
          temperature: 0.3,
          maxOutputTokens: 600,
        },
      });

      const text = response.text || '';
      if (!text) continue;

      const webResults: SearchResultItem[] = [];

      // Extract grounding metadata if provided by Gemini
      const candidate = response.candidates?.[0];
      const grounding = (candidate as any)?.groundingMetadata;
      if (grounding) {
        const chunks = grounding.groundingChunks || [];
        for (const chunk of chunks) {
          if (chunk.web?.uri) {
            webResults.push({
              title: chunk.web.title || 'Official Web Portal',
              url: chunk.web.uri,
              snippet: text.slice(0, 150),
              source: 'Google Search Grounding',
            });
          }
        }
      }

      // If no grounding chunks returned, generate a fallback result from text
      if (webResults.length === 0) {
        const urlMatches = text.match(/https?:\/\/[^\s)]+/g);
        if (urlMatches && urlMatches.length > 0) {
          for (const u of urlMatches.slice(0, 3)) {
            webResults.push({
              title: query,
              url: u.replace(/[.,;]$/, ''),
              snippet: text.slice(0, 150),
              source: 'Web Grounding',
            });
          }
        }
      }

      return {
        summary: text,
        webResults,
      };
    } catch (err: any) {
      console.warn(`[InternetSearch] Google search grounding failed with ${model}:`, err?.message || err);
    }
  }

  return null;
}

/**
 * Fallback internet search using public search API (DuckDuckGo instant answer).
 */
async function searchDuckDuckGo(query: string): Promise<SearchResultItem[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' India government')}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data: any = await res.json();
    const results: SearchResultItem[] = [];

    if (data.AbstractText) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || 'https://www.myscheme.gov.in',
        snippet: data.AbstractText.slice(0, 200),
        source: data.AbstractSource || 'DuckDuckGo Web Search',
      });
    }

    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const t of data.RelatedTopics.slice(0, 3)) {
        if (t.Text && t.FirstURL) {
          results.push({
            title: t.Text.slice(0, 60),
            url: t.FirstURL,
            snippet: t.Text.slice(0, 180),
            source: 'Web Search',
          });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Comprehensive internet and knowledge base search.
 */
export async function searchWebAndKnowledge(query: string): Promise<SearchResponse> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return {
      query,
      summary: 'Please provide a valid search query.',
      results: [],
      sources: [],
    };
  }

  console.log(`[InternetSearch] Searching for: "${cleanQuery}"`);

  // Run local KB search and live Google Search grounding in parallel
  const [localResults, liveGrounding] = await Promise.all([
    Promise.resolve(searchLocalKnowledge(cleanQuery, 3)),
    searchWithGoogleGrounding(cleanQuery),
  ]);

  let summary = '';
  const combinedResults: SearchResultItem[] = [...localResults];
  const sourcesSet = new Set<string>();

  if (liveGrounding) {
    summary = liveGrounding.summary;
    for (const wr of liveGrounding.webResults) {
      if (!combinedResults.some((r) => r.url === wr.url)) {
        combinedResults.push(wr);
      }
    }
  }

  // If no grounding summary, fall back to DuckDuckGo and local results
  if (!summary) {
    const ddgResults = await searchDuckDuckGo(cleanQuery);
    for (const dr of ddgResults) {
      if (!combinedResults.some((r) => r.url === dr.url)) {
        combinedResults.push(dr);
      }
    }

    if (combinedResults.length > 0) {
      const topItems = combinedResults.slice(0, 3);
      summary = `Found ${combinedResults.length} relevant services and web results for "${cleanQuery}": ` +
        topItems.map((item) => `${item.title}: ${item.snippet}`).join(' | ');
    } else {
      summary = `Information for "${cleanQuery}" can be checked directly on the national government portal https://www.myscheme.gov.in or https://scholarships.gov.in for student services.`;
    }
  }

  // Populate sources list
  combinedResults.forEach((r) => {
    if (r.url) sourcesSet.add(r.url);
  });
  if (sourcesSet.size === 0) {
    sourcesSet.add('https://www.myscheme.gov.in');
    sourcesSet.add('https://scholarships.gov.in');
  }

  return {
    query: cleanQuery,
    summary,
    results: combinedResults.slice(0, 5),
    sources: Array.from(sourcesSet).slice(0, 5),
  };
}
