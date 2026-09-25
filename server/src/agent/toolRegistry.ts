// ============================================================
// Tool Registry — All agent tools with permissions + validation
// Branch: agent-control
// ============================================================

import { PermissionLevel, type ToolRegistryEntry, type ActionType } from './agentTypes';

/**
 * Complete registry of all tools available to the Gram Sathi agent.
 * Each tool declares its permission level, confirmation requirement,
 * audit logging preference, and parameter schema.
 *
 * The LLM may ONLY call tools present in this registry.
 * Unknown tool names are rejected by the agent controller.
 */
export const TOOL_REGISTRY: Record<string, ToolRegistryEntry> = {
  // ── Navigation (SAFE) ─────────────────────────────────────
  navigate_to_route: {
    name: 'navigate_to_route',
    description: 'Navigate the user to a specific route/page within Gram Sathi.',
    descriptionHi: 'ग्राम साथी में एक विशिष्ट पृष्ठ पर जाएं।',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: true,
    paramSchema: {
      route: { type: 'string', required: true, description: 'Route path e.g. /schemes, /calendar, /chat' },
      reason: { type: 'string', required: false, description: 'Why navigating here' },
    },
  },
  open_page: {
    name: 'open_page',
    description: 'Open a named page: home, schemes, calendar, chat, agriculture, scholarships.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: false,
    paramSchema: {
      page: { type: 'string', required: true, description: 'Page name' },
    },
  },
  scroll_to_section: {
    name: 'scroll_to_section',
    description: 'Scroll to a named section of the current page.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: false,
    paramSchema: {
      sectionId: { type: 'string', required: true, description: 'Section element ID' },
    },
  },
  go_back: {
    name: 'go_back',
    description: 'Navigate back in browser history.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: false,
    paramSchema: {},
  },
  go_forward: {
    name: 'go_forward',
    description: 'Navigate forward in browser history.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: false,
    paramSchema: {},
  },

  // ── UI Awareness (SAFE) ────────────────────────────────────
  get_ui_state: {
    name: 'get_ui_state',
    description: 'Get current page route, visible components, and form state.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: false,
    paramSchema: {},
  },
  read_visible_content: {
    name: 'read_visible_content',
    description: 'Read the visible text content of the current page.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: false,
    paramSchema: {},
  },
  read_form_structure: {
    name: 'read_form_structure',
    description: 'Read the structure and fields of the currently visible form.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: false,
    paramSchema: {
      formId: { type: 'string', required: false, description: 'Optional form ID' },
    },
  },
  highlight_element: {
    name: 'highlight_element',
    description: 'Briefly highlight a UI element to draw user attention.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: false,
    paramSchema: {
      elementId: { type: 'string', required: true, description: 'Element ID to highlight' },
    },
  },
  show_source: {
    name: 'show_source',
    description: 'Show source attribution panel for retrieved information.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: false,
    paramSchema: {
      source: { type: 'string', required: true, description: 'Source name or URL' },
      retrievedAt: { type: 'string', required: false, description: 'ISO date when retrieved' },
    },
  },

  // ── Scheme & Search (SAFE) ─────────────────────────────────
  navigate_to_scheme: {
    name: 'navigate_to_scheme',
    description: 'Navigate to a specific government scheme detail page.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: true,
    paramSchema: {
      schemeId: { type: 'string', required: true, description: 'Scheme slug e.g. pm-kisan, nsp-scholarship' },
    },
  },
  search_scheme: {
    name: 'search_scheme',
    description: 'Search the local scheme database.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: false,
    paramSchema: {
      query: { type: 'string', required: true, description: 'Search query' },
      state: { type: 'string', required: false, description: 'Filter by state' },
    },
  },
  get_scheme_details: {
    name: 'get_scheme_details',
    description: 'Get detailed information about a specific scheme.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: false,
    paramSchema: {
      schemeId: { type: 'string', required: true, description: 'Scheme ID' },
    },
  },
  search_government: {
    name: 'search_government',
    description: 'Search trusted government websites for current information.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: true,
    paramSchema: {
      query: { type: 'string', required: true, description: 'Search query' },
      state: { type: 'string', required: false, description: 'State context' },
      category: { type: 'string', required: false, description: 'Category: scheme, news, certificate, agriculture, scholarship' },
    },
  },
  get_myscheme_results: {
    name: 'get_myscheme_results',
    description: 'Search MyScheme portal for relevant government schemes.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: true,
    paramSchema: {
      query: { type: 'string', required: true, description: 'What the user is looking for' },
      state: { type: 'string', required: false, description: 'State' },
      category: { type: 'string', required: false, description: 'Category e.g. agriculture, education, health' },
    },
  },
  get_agriculture_news: {
    name: 'get_agriculture_news',
    description: 'Get latest agriculture news and government announcements.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: false,
    paramSchema: {
      state: { type: 'string', required: false, description: 'State filter' },
      category: { type: 'string', required: false, description: 'Category: msp, crop, weather, scheme, subsidy' },
    },
  },
  get_crop_calendar: {
    name: 'get_crop_calendar',
    description: 'Get crop calendar for a state and month.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: false,
    paramSchema: {
      state: { type: 'string', required: true, description: 'Indian state' },
      month: { type: 'number', required: true, description: 'Month 1-12' },
      crop: { type: 'string', required: false, description: 'Specific crop name' },
      phase: { type: 'string', required: false, description: 'sowing, growing, harvesting, or all' },
    },
  },

  // ── Form Filling (USER_DATA) ───────────────────────────────
  fill_field: {
    name: 'fill_field',
    description: 'Fill a specific form field with the provided value.',
    descriptionHi: 'फ़ॉर्म का एक विशिष्ट फ़ील्ड भरें।',
    permissionLevel: PermissionLevel.USER_DATA,
    requiresConfirmation: true,
    auditLog: true,
    paramSchema: {
      fieldId: { type: 'string', required: true, description: 'Field element ID' },
      value: { type: 'string', required: true, description: 'Value to fill' },
      fieldLabel: { type: 'string', required: false, description: 'Human-readable field name' },
    },
  },
  clear_field: {
    name: 'clear_field',
    description: 'Clear a form field.',
    permissionLevel: PermissionLevel.USER_DATA,
    requiresConfirmation: false,
    auditLog: true,
    paramSchema: {
      fieldId: { type: 'string', required: true, description: 'Field element ID' },
    },
  },
  select_option: {
    name: 'select_option',
    description: 'Select an option in a dropdown/select field.',
    permissionLevel: PermissionLevel.USER_DATA,
    requiresConfirmation: false,
    auditLog: true,
    paramSchema: {
      fieldId: { type: 'string', required: true, description: 'Field element ID' },
      value: { type: 'string', required: true, description: 'Option value to select' },
    },
  },

  // ── External Navigation (USER_DATA) ───────────────────────
  open_external_service: {
    name: 'open_external_service',
    description: 'Open an official government website in a new tab, with boundary warning.',
    descriptionHi: 'एक सरकारी वेबसाइट नए टैब में खोलें।',
    permissionLevel: PermissionLevel.USER_DATA,
    requiresConfirmation: true,
    auditLog: true,
    paramSchema: {
      url: { type: 'string', required: true, description: 'Official government URL (must be .gov.in or .nic.in)' },
      siteName: { type: 'string', required: true, description: 'Human-readable name of the site' },
      reason: { type: 'string', required: false, description: 'Why opening this site' },
    },
  },

  // ── Confirmation (meta-tool, SAFE) ─────────────────────────
  request_confirmation: {
    name: 'request_confirmation',
    description: 'Show a confirmation dialog to the user before a consequential action.',
    permissionLevel: PermissionLevel.SAFE,
    requiresConfirmation: false,
    auditLog: true,
    paramSchema: {
      actionType: { type: 'string', required: true, description: 'The action needing confirmation' },
      message: { type: 'string', required: true, description: 'Message to show user' },
      reviewData: { type: 'object', required: false, description: 'Key-value pairs to display in review screen' },
    },
  },

  // ── Consequential (always confirm) ────────────────────────
  submit_form: {
    name: 'submit_form',
    description: 'Submit a completed application form. ALWAYS requires explicit user confirmation.',
    descriptionHi: 'भरा हुआ फ़ॉर्म जमा करें। हमेशा स्पष्ट पुष्टि आवश्यक है।',
    permissionLevel: PermissionLevel.CONSEQUENTIAL,
    requiresConfirmation: true,
    auditLog: true,
    paramSchema: {
      formId: { type: 'string', required: true, description: 'Form ID to submit' },
      reviewSummary: { type: 'object', required: false, description: 'Summary of data to be submitted' },
    },
  },
};

/**
 * Validate tool call against registry.
 * Returns null if valid, or an error message if not.
 */
export function validateToolCall(
  toolName: string,
  params: Record<string, unknown>
): string | null {
  const entry = TOOL_REGISTRY[toolName];
  if (!entry) {
    return `Tool "${toolName}" is not registered in the agent tool registry.`;
  }

  // Check required params
  for (const [paramName, schema] of Object.entries(entry.paramSchema)) {
    if (schema.required && (params[paramName] === undefined || params[paramName] === null || params[paramName] === '')) {
      return `Required parameter "${paramName}" is missing for tool "${toolName}".`;
    }
  }

  return null;
}

/**
 * Get tool entry from registry.
 */
export function getToolEntry(toolName: string): ToolRegistryEntry | null {
  return TOOL_REGISTRY[toolName] ?? null;
}
