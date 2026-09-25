// ============================================================
// Tool Manager — Maps Gemini tool calls to website actions
// ============================================================
import type { ToolCallRequest, ToolCallResponse } from '../types/voice';
import type { GeminiTool } from '../types/session';
import { callAgentAction, executeClientAction } from '../agent/agentBridge';
import { AgentStateMachine, AgentState } from '../agent/agentStateMachine';
import { loadProfile } from './sessionManager';
import { semanticScroll } from './semanticScroll';
import {
  updateProfileField,
  confirmProfileField,
  rejectProfileField,
  skipProfileField,
  getProfile,
} from './profileService';

// Custom event name for tool-driven navigation
export const VOICE_TOOL_EVENT = 'voice:tool';

export interface VoiceToolEvent {
  tool: string;
  args: Record<string, unknown>;
}

/**
 * Announcement helper — dispatched as an event so UI can display status toast.
 * Native speechSynthesis is strictly disabled to prevent duplicate AI voices.
 * Voice is produced natively and exclusively by the Gemini Live Web Audio pipeline.
 */
export function speakSearchAnnouncement(_customLang?: string) {
  // Native speechSynthesis is intentionally disabled to strictly guarantee:
  // activeTTSStreams <= 1 and activeAudioElements <= 1.
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

      case 'scroll_to_section': {
        const section = String(args.section || 'overview');
        const behavior = (args.behavior as ScrollBehavior) || 'smooth';
        const reason = String(args.reason || 'Explaining scheme section');
        const scrollResult = semanticScroll.scrollToSection(section, { behavior, reason });
        dispatchToolEvent('scroll_to_section', { reason, ...scrollResult });
        return {
          id,
          result: {
            success: scrollResult.success,
            section: scrollResult.section,
            message: scrollResult.message,
          },
        };
      }

      case 'showDocuments': {
        const schemeId = String(args.schemeId || '');
        semanticScroll.scrollToSection('documents', { reason: 'Showing required documents' });
        dispatchToolEvent('showDocuments', { schemeId });
        return { id, result: { success: true, schemeId } };
      }

      case 'showEligibility': {
        const schemeId = String(args.schemeId || '');
        semanticScroll.scrollToSection('eligibility', { reason: 'Showing eligibility requirements' });
        dispatchToolEvent('showEligibility', { schemeId });
        return { id, result: { success: true, schemeId } };
      }

      case 'openApplication': {
        const schemeId = String(args.schemeId || '');
        semanticScroll.scrollToSection('application', { reason: 'Showing application process' });
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

      // ── Citizen Profile Collection Mode Tools ───────────────
      case 'profile_extract_field': {
        const fieldName = String(args.fieldName || '');
        const value = args.value;
        const confidence = typeof args.confidence === 'number' ? args.confidence : 0.95;
        const spokenConfirmation = String(args.spokenConfirmation || '');
        dispatchToolEvent('profile_extract_field', { fieldName, value, confidence, spokenConfirmation });
        await updateProfileField(fieldName as any, value, 'CONFIRMING', 'voice', confidence);
        return {
          id,
          result: {
            success: true,
            fieldName,
            value,
            status: 'CONFIRMING',
            confidence,
            confirmationPrompt: spokenConfirmation,
          },
        };
      }

      case 'profile_confirm_field': {
        const fieldName = String(args.fieldName || '');
        const value = args.value;
        dispatchToolEvent('profile_confirm_field', { fieldName, value });
        const updated = await confirmProfileField(fieldName as any, value, 'voice', 1.0);
        return {
          id,
          result: {
            success: true,
            fieldName,
            value,
            status: 'CONFIRMED',
            completionPercentage: updated.completion_percentage,
          },
        };
      }

      case 'profile_reject_field': {
        const fieldName = String(args.fieldName || '');
        const reason = String(args.reason || 'User rejected detected value');
        dispatchToolEvent('profile_reject_field', { fieldName, reason });
        await rejectProfileField(fieldName as any, reason);
        return {
          id,
          result: {
            success: true,
            fieldName,
            status: 'REJECTED',
            reason,
          },
        };
      }

      case 'profile_skip_field': {
        const fieldName = String(args.fieldName || '');
        dispatchToolEvent('profile_skip_field', { fieldName });
        await skipProfileField(fieldName as any);
        return {
          id,
          result: {
            success: true,
            fieldName,
            status: 'SKIPPED',
          },
        };
      }

      case 'profile_verify_summary': {
        dispatchToolEvent('profile_verify_summary', args);
        const profile = await getProfile();
        return {
          id,
          result: {
            success: true,
            profileSummary: {
              fullName: profile.full_name,
              dateOfBirth: profile.date_of_birth,
              state: profile.state,
              district: profile.district,
              occupation: profile.occupation,
              qualification: profile.highest_qualification,
              completion: profile.completion_percentage,
            },
          },
        };
      }

      case 'open_form_copilot': {
        const rawPortal = (args.portalId ? String(args.portalId).trim() : 'nsp').toLowerCase();
        const schemeQuery = args.schemeName ? String(args.schemeName).toLowerCase() : '';
        let portalId = 'nsp';
        if (rawPortal.includes('kisan') || schemeQuery.includes('kisan')) portalId = 'pm-kisan';
        else if (rawPortal.includes('kcc') || schemeQuery.includes('kcc') || schemeQuery.includes('credit')) portalId = 'kcc';
        else portalId = 'nsp';

        const targetRoute = `/copilot/${portalId}`;
        executeClientAction({
          type: 'navigate',
          params: { route: targetRoute },
        });
        dispatchToolEvent('openFormCopilot', { portalId, targetRoute, schemeName: args.schemeName });
        return {
          id,
          result: {
            success: true,
            portalId,
            route: targetRoute,
            message: `Opening the official government portal (${portalId === 'nsp' ? 'National Scholarship Portal' : portalId.toUpperCase()}). Gram Sathi is preparing your verified profile information and matching documents for review before filling.`,
          },
        };
      }

      case 'control_form_browser': {
        const action = String(args.action || 'scrollDown');
        window.dispatchEvent(new CustomEvent('gs_browser_command', { detail: { action } }));
        return {
          id,
          result: {
            success: true,
            action,
            message: `Executed browser command: ${action}`,
          },
        };
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
        name: 'scroll_to_section',
        description:
          'Smoothly scroll the webpage to a specific section while speaking/explaining it to the user. Call this tool immediately when explaining a topic that belongs to another section (such as overview, benefits, eligibility, documents, application, faq) so the citizen can see the relevant section on their screen in real-time while you speak.',
        parameters: {
          type: 'object',
          properties: {
            section: {
              type: 'string',
              description:
                'The semantic section name: "overview", "benefits", "eligibility", "documents", "application", or "faq".',
            },
            behavior: {
              type: 'string',
              description: 'Scroll behavior, set to "smooth".',
            },
            reason: {
              type: 'string',
              description:
                'Why you are scrolling to this section (e.g. "Explaining scheme benefits", "Explaining eligibility requirements").',
            },
          },
          required: ['section'],
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
      // ── Gram Sathi Citizen Profile Collection Tools ─────────
      {
        name: 'profile_extract_field',
        description: 'Extract a citizen profile field from natural speech. Marks state as CONFIRMING and prompts user for explicit confirmation before persisting. Use whenever user provides a field during profile creation.',
        parameters: {
          type: 'object',
          properties: {
            fieldName: {
              type: 'string',
              description: 'Profile field identifier: full_name, date_of_birth, gender, mobile, email, state, district, sub_district, village_city, pin_code, address, highest_qualification, course, institution, passing_year, occupation, category, annual_family_income, farmer_land_details, farmer_crops, farmer_irrigation, farmer_type',
            },
            value: {
              type: 'string',
              description: 'Extracted value. Preserve names and spelling exactly as provided.',
            },
            confidence: {
              type: 'number',
              description: 'Confidence score between 0.0 and 1.0 based on clarity of user speech.',
            },
            spokenConfirmation: {
              type: 'string',
              description: 'Natural spoken confirmation question in user language, e.g. "Aapne kaha ki aapka naam Dilkhush Jha hai. Kya ye sahi hai?"',
            },
          },
          required: ['fieldName', 'value'],
        },
      },
      {
        name: 'profile_confirm_field',
        description: 'Confirm and securely persist a profile field value into the database after explicit citizen agreement (e.g. citizen says yes, haan, sahi hai).',
        parameters: {
          type: 'object',
          properties: {
            fieldName: { type: 'string', description: 'The field name to confirm' },
            value: { type: 'string', description: 'The confirmed value to persist' },
          },
          required: ['fieldName', 'value'],
        },
      },
      {
        name: 'profile_reject_field',
        description: 'Reject a detected profile value when the user says no, nahi, or provides a correction, and re-ask the question.',
        parameters: {
          type: 'object',
          properties: {
            fieldName: { type: 'string', description: 'The field name rejected or being corrected' },
            reason: { type: 'string', description: 'Reason for rejection' },
          },
          required: ['fieldName'],
        },
      },
      {
        name: 'profile_skip_field',
        description: 'Skip an optional or unknown profile field when the citizen says skip, pata nahi, or I don\'t know. Never ask repeatedly.',
        parameters: {
          type: 'object',
          properties: {
            fieldName: { type: 'string', description: 'Field name to skip' },
          },
          required: ['fieldName'],
        },
      },
      {
        name: 'profile_verify_summary',
        description: 'Verify stored profile values by reading important stored fields in logical groups when citizen asks "mera profile verify karo".',
        parameters: {
          type: 'object',
          properties: {
            notes: { type: 'string', description: 'Optional verification notes' },
          },
        },
      },
      // ── Gram Sathi Government Form Copilot ──────────────────
      {
        name: 'open_form_copilot',
        description: 'Open the Gram Sathi Government Form Copilot to assist the citizen in filling an official government application form (e.g. National Scholarship Portal NSP, PM-KISAN, Kisan Credit Card KCC) using their verified profile and documents. Trigger whenever user says "Is scholarship ka form bhar do", "form bharna shuru karo", "apply for scholarship", "form copilot kholo", or "Gram Sathi is form ko meri profile se bhar do".',
        parameters: {
          type: 'object',
          properties: {
            portalId: {
              type: 'string',
              description: 'Target portal identifier: "nsp" (for National Scholarship Portal / छात्रवृत्ति), "pm-kisan" (for PM-KISAN), or "kcc" (for Kisan Credit Card). Default is "nsp" for scholarships.',
            },
            schemeName: {
              type: 'string',
              description: 'Optional name of the scheme/scholarship mentioned by the user.',
            },
          },
        },
      },
      {
        name: 'control_form_browser',
        description: 'Control the live government website browser session during Form Copilot. Trigger when user says "scroll down", "neeche scroll karo", "scroll up", "upar scroll karo", "go back", "peechhe jao", "refresh page", "stop", "ruk jao", "detect form", or "form detect karo".',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: 'The browser control action: "scrollDown", "scrollUp", "goBack", "reload", "stop", "inspect", or "startFilling".',
            },
          },
          required: ['action'],
        },
      },
    ],
  },
];
