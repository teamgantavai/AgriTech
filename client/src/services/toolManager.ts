// ============================================================
// Tool Manager — Maps Gemini tool calls to website actions
// ============================================================

import type { ToolCallRequest, ToolCallResponse } from '../types/voice';
import type { GeminiTool } from '../types/session';
import { callAgentAction, executeClientAction } from '../agent/agentBridge';
import { AgentStateMachine, AgentState } from '../agent/agentStateMachine';
import { loadProfile } from './sessionManager';

// Custom event name for tool-driven navigation
export const VOICE_TOOL_EVENT = 'voice:tool';

export interface VoiceToolEvent {
  tool: string;
  args: Record<string, unknown>;
}

const SEARCH_SPOKEN_ANNOUNCEMENTS: Record<string, string> = {
  hi: 'मैं इंटरनेट पर जानकारी देख रहा हूँ, एक क्षण रुकिए...',
  pa: 'ਮੈਂ ਇੰਟਰਨੈੱਟ \'ਤੇ ਜਾਣਕਾਰੀ ਲੱਭ ਰਿਹਾ ਹਾਂ, ਇੱਕ ਪਲ ਰੁਕੋ...',
  en: 'I am searching the internet for you, please wait a moment...',
  'hi-latn': 'Main internet par search kar raha hoon, ek second...',
  mr: 'मी इंटरनेटवर माहिती शोधत आहे, एक क्षण थांबा...',
  bn: 'আমি ইন্টারনেটে তথ্য খুঁজছি, অনুগ্রহ করে একটু অপেক্ষা করুন...',
  gu: 'હું ઇન્ટરનેટ પર માહિતી શોધી રહ્યો છું, એક ક્ષણ રાહ જુઓ...',
  ta: 'நான் இணையத்தில் தேடுகிறேன், சிறிது நேரம் காத்திருங்கள்...',
  te: 'నేను ఇంటర్నెట్‌లో వెతుకుతున్నాను, దయచేసి ఒక్క క్షణం వేచి ఉండండి...',
  kn: 'ನಾನು ಅಂತರ್ಜಾಲದಲ್ಲಿ ಹುಡುಕುತ್ತಿದ್ದೇನೆ, ದಯವಿಟ್ಟು ಒಂದು ಕ್ಷಣ ಕಾಯಿರಿ...',
  ml: 'ഞാൻ ഇൻ്റർനെറ്റിൽ തിരയുകയാണ്, ദയവായി ഒരു നിമിഷം കാത്തിരിക്കൂ...',
  or: 'ମୁଁ ଇଣ୍ଟରନେଟ୍ ରେ ତଥ୍ୟ ଖୋଜୁଛି, ଗୋଟିଏ ମୁହୂର୍ତ୍ତ ଅପେକ୍ଷା କରନ୍ତୁ...',
  ur: 'میں انٹرنیٹ پر تلاش کر رہا ہوں، ایک لمحہ انتظار کیجیے...',
};

/**
 * Speaks an immediate search announcement in the citizen's language
 * so they are immediately informed while web retrieval runs.
 */
export function speakSearchAnnouncement(customLang?: string) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      const p = loadProfile();
      const lang = (customLang || p.languageCode || 'hi').toLowerCase();
      const text = SEARCH_SPOKEN_ANNOUNCEMENTS[lang] || SEARCH_SPOKEN_ANNOUNCEMENTS['hi'];
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      if (lang === 'hi') utterance.lang = 'hi-IN';
      else if (lang === 'pa') utterance.lang = 'pa-IN';
      else if (lang === 'en') utterance.lang = 'en-IN';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      // SpeechSynthesis may fail in silent contexts, ignore
    }
  }
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
        const targetRoute = `/services/${schemeId}`;
        dispatchToolEvent('navigateToScheme', { schemeId });
        executeClientAction({ type: 'navigate', params: { route: targetRoute } });
        return { id, result: { success: true, schemeId, route: targetRoute } };
      }


      case 'searchInternet': {
        const query = String(args.query || '');
        dispatchToolEvent('searchInternet', { query });
        speakSearchAnnouncement();
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
        speakSearchAnnouncement();
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
        const page = String(args.page || '').toLowerCase();
        let targetRoute = '/';
        if (page === 'calendar' || page === 'crop-calendar' || page.includes('calendar')) targetRoute = '/calendar';
        else if (page === 'agriculture' || page === 'farming') targetRoute = '/schemes/agriculture';
        else if (page === 'scholarships' || page === 'scholarship') targetRoute = '/schemes/scholarships';
        else if (page === 'business' || page === 'loans') targetRoute = '/schemes/business';
        else if (page === 'health') targetRoute = '/schemes/health';
        else if (page === 'schemes' || page.includes('scheme')) targetRoute = '/schemes';
        else if (page === 'chat') targetRoute = '/chat';
        dispatchToolEvent('openPage', { page, route: targetRoute });
        executeClientAction({ type: 'navigate', params: { route: targetRoute } });
        return { id, result: { success: true, page, route: targetRoute } };
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

      // ── Agent-control Phase 1 tools ────────────────────────
      case 'navigateToRoute': {
        const route = String(args.route || '/');
        dispatchToolEvent('navigateToRoute', { route });
        AgentStateMachine.transition(AgentState.EXECUTING);
        const navResult = executeClientAction({ type: 'navigate', params: { route } });
        AgentStateMachine.forceTransition(AgentState.COMPLETED);
        return { id, result: { success: true, route, ...navResult } };
      }

      case 'getUIState': {
        const uiResult = await callAgentAction('get_ui_state', {});
        return { id, result: { success: true, uiState: uiResult } };
      }

      case 'getAgricultureNews': {
        const state = args.state ? String(args.state) : undefined;
        const category = args.category ? String(args.category) : undefined;
        dispatchToolEvent('getAgricultureNews', { state, category });
        const agriResult = await callAgentAction('get_agriculture_news', { state, category });
        return { id, result: { success: true, ...agriResult } };
      }

      case 'searchGovernment': {
        const query = String(args.query || '');
        const govState = args.state ? String(args.state) : undefined;
        dispatchToolEvent('searchGovernment', { query, state: govState });
        speakSearchAnnouncement();
        AgentStateMachine.transition(AgentState.EXECUTING);
        const govResult = await callAgentAction('search_government', { query, state: govState });

        return {
          id,
          result: {
            success: true,
            query,
            ...govResult,
            retrievedAt: new Date().toISOString(),
          },
        };
      }

      case 'fillField': {
        const fieldId = String(args.fieldId || '');
        const value = String(args.value || '');
        const fieldLabel = args.fieldLabel ? String(args.fieldLabel) : fieldId;
        dispatchToolEvent('fillField', { fieldId, value, fieldLabel });
        // Goes through agent bridge (permission layer handles L2 confirmation)
        const fillResult = await callAgentAction('fill_field', { fieldId, value, fieldLabel });
        return { id, result: { success: true, fieldId, value, ...fillResult } };
      }

      case 'requestConfirmation': {
        const message = String(args.message || '');
        const actionType = String(args.actionType || 'submit_form');
        const reviewData = args.reviewData as Record<string, string> | undefined;
        dispatchToolEvent('requestConfirmation', { message, actionType, reviewData });
        const confirmResult = await callAgentAction('request_confirmation', { actionType, message, reviewData });
        return { id, result: { success: true, ...confirmResult } };
      }

      case 'openExternalService': {
        const url = String(args.url || '');
        const siteName = String(args.siteName || 'Government Website');
        dispatchToolEvent('openExternalService', { url, siteName });
        AgentStateMachine.emitExternalNavigation(url, siteName);
        return { id, result: { success: true, url, siteName, requiresBoundaryWarning: true } };
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
      // ── Phase 1 Agent-Control Tool Declarations ─────────────
      {
        name: 'navigateToRoute',
        description: 'Navigate to a specific page route within Gram Sathi. Use when the user asks to open a specific section, page or service.',
        parameters: {
          type: 'object',
          properties: {
            route: { type: 'string', description: 'Route path e.g. /schemes, /calendar, /chat, /services/pm-kisan' },
            reason: { type: 'string', description: 'Why navigating' },
          },
          required: ['route'],
        },
      },
      {
        name: 'getAgricultureNews',
        description: 'Get latest official government agriculture news, MSP announcements, crop advisories and schemes. Use when user asks for latest agriculture updates, government announcements about crops, or farming news.',
        parameters: {
          type: 'object',
          properties: {
            state: { type: 'string', description: 'Filter by Indian state (optional)' },
            category: { type: 'string', description: 'Category: msp, crop, scheme, subsidy, market, weather, fertilizer, procurement' },
          },
        },
      },
      {
        name: 'searchGovernment',
        description: 'Search trusted Indian government websites (gov.in, nic.in) for official, current information. Use for queries about specific schemes, eligibility, application processes, or any government service where fresh official data is needed.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query, e.g. "Punjab farmer subsidy 2025" or "NSP scholarship last date"' },
            state: { type: 'string', description: 'Indian state for state-specific queries' },
          },
          required: ['query'],
        },
      },
      {
        name: 'fillField',
        description: 'Fill a specific form field on the current page. Use ONLY when the user explicitly provides information they want entered in a form. Requires user consent.',
        parameters: {
          type: 'object',
          properties: {
            fieldId: { type: 'string', description: 'HTML element ID of the field' },
            value: { type: 'string', description: 'Value to fill in' },
            fieldLabel: { type: 'string', description: 'Human-readable name of the field (e.g. "Full Name", "State")' },
          },
          required: ['fieldId', 'value'],
        },
      },
      {
        name: 'requestConfirmation',
        description: 'Show a confirmation dialog to the user before performing a consequential action (form submission, payment, official declaration). ALWAYS use this before submit_form.',
        parameters: {
          type: 'object',
          properties: {
            actionType: { type: 'string', description: 'The action requiring confirmation: submit_form, open_external, etc.' },
            message: { type: 'string', description: 'Clear message explaining what will happen' },
            reviewData: { type: 'object', description: 'Key-value pairs of data to display in review screen' },
          },
          required: ['actionType', 'message'],
        },
      },
      {
        name: 'openExternalService',
        description: 'Open an official government website. Shows a boundary warning to the user and only opens trusted .gov.in or .nic.in URLs.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Official government URL (must be .gov.in, .nic.in or approved portal)' },
            siteName: { type: 'string', description: 'Human-readable name e.g. "National Scholarship Portal" or "PM-KISAN Portal"' },
          },
          required: ['url', 'siteName'],
        },
      },
    ],
  },
];
