// ============================================================
// Tool Manager — Maps Gemini tool calls to website actions
// ============================================================

import type { ToolCallRequest, ToolCallResponse } from '../types/voice';
import type { GeminiTool } from '../types/session';

// Custom event name for tool-driven navigation
export const VOICE_TOOL_EVENT = 'voice:tool';

export interface VoiceToolEvent {
  tool: string;
  args: Record<string, unknown>;
}

/**
 * Dispatch a custom event so the UI can react to tool calls
 * without the audio path blocking.
 */
function dispatchToolEvent(tool: string, args: Record<string, unknown>) {
  const event = new CustomEvent<VoiceToolEvent>(VOICE_TOOL_EVENT, {
    detail: { tool, args },
    bubbles: true,
  });
  window.dispatchEvent(event);
}

export interface ActiveFarmerContext {
  state: string;
  month: number;
  currentCrop: string | null;
  language?: string;
}

let activeFarmerContext: ActiveFarmerContext = {
  state: 'Rajasthan',
  month: new Date().getMonth() + 1,
  currentCrop: null,
};

export function updateActiveFarmerContext(partial: Partial<ActiveFarmerContext>) {
  activeFarmerContext = { ...activeFarmerContext, ...partial };
}

export function getActiveFarmerContext(): ActiveFarmerContext {
  return activeFarmerContext;
}

/**
 * Execute a tool call from Gemini Live session
 */
export async function executeToolCall(
  request: ToolCallRequest
): Promise<ToolCallResponse> {
  const { id, name, args } = request;

  try {
    switch (name) {
      case 'getCropCalendar': {
        const state = args.state ? String(args.state).trim() : activeFarmerContext.state;
        const month = args.month ? Number(args.month) : activeFarmerContext.month;
        const crop = args.crop ? String(args.crop).trim() : activeFarmerContext.currentCrop;
        const phase = args.phase ? String(args.phase).trim() : 'all';

        dispatchToolEvent('cropCalendar', { state, month, crop, phase });

        const params = new URLSearchParams({
          state,
          month: String(month),
          phase,
        });
        if (crop) params.set('crop', crop);

        const resp = await fetch(`/api/crop-calendar?${params.toString()}`);
        if (resp.ok) {
          const data = await resp.json();
          return {
            id,
            result: {
              success: true,
              state: data.state,
              month: data.monthName,
              monthHi: data.monthNameHi,
              summary: data.aiVoiceSummary,
              sowingCrops: data.phases.sowing.map((c: any) => `${c.crop} (${c.localName}) ${c.timingDisplay || ''}`).slice(0, 5),
              growingCrops: data.phases.growing.map((c: any) => `${c.crop} (${c.localName})`).slice(0, 4),
              harvestingCrops: data.phases.harvesting.map((c: any) => `${c.crop} (${c.localName}) ${c.timingDisplay || ''}`).slice(0, 5),
              source: data.source,
              dataNote: data.dataNote,
            },
          };
        }
        return {
          id,
          result: {
            success: false,
            error: 'Crop calendar information is temporarily unavailable.',
          },
        };
      }

      case 'setCropCalendarState': {
        const state = String(args.state || '').trim();
        const month = args.month ? Number(args.month) : undefined;
        if (state) {
          activeFarmerContext.state = state;
          if (month) activeFarmerContext.month = month;
          dispatchToolEvent('setCropCalendarState', { state, month });
          return { id, result: { success: true, state, month } };
        }
        return { id, result: { success: false, error: 'State is required' } };
      }
      case 'navigateToScheme': {
        const schemeId = String(args.schemeId || '');
        dispatchToolEvent('navigateToScheme', { schemeId });
        return { id, result: { success: true, schemeId } };
      }

      case 'searchInternet': {
        const query = String(args.query || '');
        dispatchToolEvent('searchInternet', { query });
        const resp = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (resp.ok) {
          const data = await resp.json();
          return {
            id,
            result: {
              success: true,
              query: data.query || query,
              summary: data.summary,
              results: data.results || [],
              sources: data.sources || [],
            },
          };
        }
        return {
          id,
          result: {
            success: false,
            error: 'Internet search is temporarily unavailable. Please check scholarships.gov.in or myscheme.gov.in.',
          },
        };
      }

      case 'searchScheme': {
        const query = String(args.query || '');
        dispatchToolEvent('searchScheme', { query });
        // Call backend dedicated search endpoint
        const resp = await fetch(`/api/schemes/search?q=${encodeURIComponent(query)}&limit=4`);
        if (resp.ok) {
          const data = await resp.json();
          const list = data.results || [];
          if (list.length > 0) {
            const summary = list.map((s: any) => `${s.title}: ${s.description || ''}`).join(' | ');
            return { id, result: { success: true, summary, results: list } };
          }
        }
        // Fallback: search internet if local scheme database has no direct match
        const searchResp = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (searchResp.ok) {
          const searchData = await searchResp.json();
          return {
            id,
            result: {
              success: true,
              summary: searchData.summary,
              results: searchData.results || [],
              sources: searchData.sources || [],
              fromInternet: true,
            },
          };
        }
        return { id, result: { success: true, results: [] } };
      }

      case 'openPage': {
        const page = String(args.page || '');
        dispatchToolEvent('openPage', { page });
        return { id, result: { success: true, page } };
      }

      case 'getSchemeDetails': {
        const schemeId = String(args.schemeId || '');
        const resp = await fetch(`/api/schemes/${encodeURIComponent(schemeId)}`);
        if (resp.ok) {
          const data = await resp.json();
          // Return a concise summary for the AI to read aloud
          const scheme = data.scheme || data;
          const summary = scheme
            ? `${scheme.title}: ${scheme.sections?.about?.slice(0, 300) || scheme.answer || 'Details available.'}`
            : 'Scheme details not found.';
          dispatchToolEvent('getSchemeDetails', { schemeId });
          return { id, result: { success: true, summary, schemeId, scheme } };
        }
        return { id, result: { success: false, error: 'Scheme not found' } };
      }

      case 'showDocuments': {
        const schemeId = String(args.schemeId || '');
        dispatchToolEvent('showDocuments', { schemeId });
        return { id, result: { success: true, schemeId } };
      }

      case 'showEligibility': {
        const schemeId = String(args.schemeId || '');
        dispatchToolEvent('showEligibility', { schemeId });
        return { id, result: { success: true, schemeId } };
      }

      case 'openApplication': {
        const schemeId = String(args.schemeId || '');
        dispatchToolEvent('openApplication', { schemeId });
        return { id, result: { success: true, schemeId } };
      }

      default:
        return {
          id,
          result: null,
          error: `Unknown tool: ${name}`,
        };
    }
  } catch (err: any) {
    return {
      id,
      result: null,
      error: err?.message || 'Tool execution failed',
    };
  }
}

/**
 * Tool declarations for Gemini Live session configuration
 */
export const VOICE_TOOLS: GeminiTool[] = [
  {
    functionDeclarations: [
      {
        name: 'navigateToScheme',
        description:
          'Navigate the user to a specific government scheme page. Use when user asks to open, view, or apply for a scheme like PM-KISAN, PMFBY, KCC, NSP Scholarships, MUDRA, SVANidhi, PMAY, Ayushman Bharat, etc.',
        parameters: {
          type: 'object',
          properties: {
            schemeId: {
              type: 'string',
              description:
                'The scheme slug/ID. Examples: nsp-scholarship, scholarship, student, pm-kisan, pmfby, kcc, tractor-subsidy, pm-kusum, pm-vishwakarma, mudra, svanidhi, ayushman-bharat, pmay-housing',
            },
          },
          required: ['schemeId'],
        },
      },
      {
        name: 'searchScheme',
        description:
          'Search for government schemes, student scholarships, loans, education schemes, or citizen welfare programs based on a query. Use whenever the user asks to find schemes for students, farmers, youth, women, or businesses.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query, e.g. "student scholarships", "college education loan", "crop insurance for wheat", "loan for small business"',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'searchInternet',
        description:
          'Search the live internet in real-time for student scholarships, exams, college admission schemes, recent eligibility rules, official government portal links, or any question not in the local database. Always invoke this when the user asks about student services, exams, current dates, or asks to search the web.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to look up on the live internet, e.g. "scholarships for college students India 2025", "NSP scholarship eligibility", "PM Vidyalaxmi scheme education loan", "latest student welfare schemes"',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'getSchemeDetails',
        description:
          'Retrieve detailed information about a specific scheme to answer the user\'s question about benefits, eligibility, or documents.',
        parameters: {
          type: 'object',
          properties: {
            schemeId: {
              type: 'string',
              description: 'The scheme slug/ID.',
            },
          },
          required: ['schemeId'],
        },
      },
      {
        name: 'showDocuments',
        description: 'Show the list of documents required to apply for a specific scheme.',
        parameters: {
          type: 'object',
          properties: {
            schemeId: { type: 'string', description: 'The scheme slug/ID.' },
          },
          required: ['schemeId'],
        },
      },
      {
        name: 'showEligibility',
        description: 'Show eligibility criteria for a specific government scheme.',
        parameters: {
          type: 'object',
          properties: {
            schemeId: { type: 'string', description: 'The scheme slug/ID.' },
          },
          required: ['schemeId'],
        },
      },
      {
        name: 'openApplication',
        description: 'Open the application form or portal link for a specific scheme.',
        parameters: {
          type: 'object',
          properties: {
            schemeId: { type: 'string', description: 'The scheme slug/ID.' },
          },
          required: ['schemeId'],
        },
      },
      {
        name: 'openPage',
        description: 'Navigate to a named page of the website.',
        parameters: {
          type: 'object',
          properties: {
            page: {
              type: 'string',
              description: 'Page name: home, schemes, about, contact, calendar',
            },
          },
          required: ['page'],
        },
      },
      {
        name: 'getCropCalendar',
        description:
          'Retrieve government domestic crop calendar information (sowing, growing, harvesting timings) from UPAg for a given state, month, crop, and phase. Use when the user asks what to sow, grow, or harvest, or asks about crop timings.',
        parameters: {
          type: 'object',
          properties: {
            state: {
              type: 'string',
              description: 'Indian state, e.g. Rajasthan, Punjab, Haryana, Uttar Pradesh, etc.',
            },
            month: {
              type: 'number',
              description: 'Month number 1-12 (1 for Jan, 2 for Feb, ..., 9 for Sep, 10 for Oct).',
            },
            crop: {
              type: 'string',
              description: 'Specific crop name if mentioned (e.g. Wheat, Mustard, Bajra). If user asks about "this crop" or "इसके बारे में", pass the current crop.',
            },
            phase: {
              type: 'string',
              description: 'Crop cycle phase to query: sowing, growing, harvesting, or all.',
            },
          },
          required: ['state', 'month'],
        },
      },
      {
        name: 'setCropCalendarState',
        description:
          'Update the selected state or month in the crop calendar UI when the user requests a state change (e.g. "मेरा राज्य पंजाब कर दो", "राजस्थान दिखाओ").',
        parameters: {
          type: 'object',
          properties: {
            state: {
              type: 'string',
              description: 'Indian state name to switch to (e.g. Punjab, Rajasthan, Haryana).',
            },
            month: {
              type: 'number',
              description: 'Optional month number 1-12 to switch to.',
            },
          },
          required: ['state'],
        },
      },
    ],
  },
];
