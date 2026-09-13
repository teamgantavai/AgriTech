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

/**
 * Execute a tool call from Gemini Live session
 */
export async function executeToolCall(
  request: ToolCallRequest
): Promise<ToolCallResponse> {
  const { id, name, args } = request;

  try {
    switch (name) {
      case 'navigateToScheme': {
        const schemeId = String(args.schemeId || '');
        dispatchToolEvent('navigateToScheme', { schemeId });
        return { id, result: { success: true, schemeId } };
      }

      case 'searchScheme': {
        const query = String(args.query || '');
        dispatchToolEvent('searchScheme', { query });
        // Also call backend for results
        const resp = await fetch(`/api/schemes/search?q=${encodeURIComponent(query)}&limit=3`);
        if (resp.ok) {
          const data = await resp.json();
          return { id, result: { success: true, results: data.results || [] } };
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
          const scheme = data.scheme;
          const summary = scheme
            ? `${scheme.title}: ${scheme.sections?.about?.slice(0, 300) || 'Details available.'}`
            : 'Scheme details not found.';
          dispatchToolEvent('getSchemeDetails', { schemeId });
          return { id, result: { success: true, summary, schemeId } };
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
          'Navigate the user to a specific government scheme page. Use when user asks to open, view, or apply for a scheme like PM-KISAN, PMFBY, KCC, etc.',
        parameters: {
          type: 'object',
          properties: {
            schemeId: {
              type: 'string',
              description:
                'The scheme slug/ID. Examples: pm-kisan, pmfby, kcc, tractor-subsidy, pm-kusum, pm-vishwakarma, mudra, svanidhi',
            },
          },
          required: ['schemeId'],
        },
      },
      {
        name: 'searchScheme',
        description:
          'Search for government schemes based on a query. Use when user wants to find schemes but is not specific about which one.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query, e.g. "crop insurance for wheat", "loan for small business"',
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
              description: 'Page name: home, schemes, about, contact',
            },
          },
          required: ['page'],
        },
      },
    ],
  },
];
