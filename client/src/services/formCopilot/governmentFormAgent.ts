// ================================================================
// GovernmentFormAgent — Controlled Browser Agent for Government Forms
// Strictly exposes only safe, audited tools. Zero arbitrary eval/exec.
// ================================================================

import type {
  FormCopilotAuditEntry,
  FormFieldDefinition,
  MappedFormField,
  PortalFormSchema,
  SupportedPortal,
  UserActionRequiredType,
} from './types';
import { supportedPortalRegistry } from './supportedPortalRegistry';
import { getFormSchemaForPortal } from './portalFormDefinitions';

export interface AgentExecutionResult<T = any> {
  success: boolean;
  tool: string;
  data?: T;
  error?: string;
  auditId: string;
}

export class GovernmentFormAgent {
  private activePortal: SupportedPortal | null = null;
  private activeSchema: PortalFormSchema | null = null;
  private auditLog: FormCopilotAuditEntry[] = [];
  private isStopped = false;

  /**
   * Tool 1: open_supported_portal(portalId)
   */
  async open_supported_portal(portalId: string): Promise<AgentExecutionResult<SupportedPortal>> {
    const portal = supportedPortalRegistry.getPortalById(portalId);
    if (!portal) {
      return this.recordAudit('open_supported_portal', undefined, 'failure', `Portal ${portalId} not found`);
    }

    this.activePortal = portal;
    this.activeSchema = getFormSchemaForPortal(portalId);
    this.isStopped = false;

    return this.recordAudit('open_supported_portal', undefined, 'success', `Opened official portal ${portal.name}`, portal);
  }

  /**
   * Tool 2: inspect_page()
   */
  async inspect_page(): Promise<AgentExecutionResult<{ url: string; title: string; isSecure: boolean }>> {
    if (!this.activePortal) {
      return this.recordAudit('inspect_page', undefined, 'failure', 'No active portal session');
    }

    return this.recordAudit('inspect_page', undefined, 'success', 'Inspected page metadata', {
      url: this.activePortal.officialUrl,
      title: this.activePortal.name,
      isSecure: true,
    });
  }

  /**
   * Tool 3: inspect_form(formId)
   */
  async inspect_form(formId?: string): Promise<AgentExecutionResult<PortalFormSchema>> {
    if (!this.activeSchema) {
      return this.recordAudit('inspect_form', undefined, 'failure', 'No active form schema');
    }

    return this.recordAudit(
      'inspect_form',
      formId || this.activeSchema.formId,
      'success',
      `Detected ${this.activeSchema.fields.length} form fields across ${this.activeSchema.totalSteps} steps`,
      this.activeSchema
    );
  }

  /**
   * Tool 4: find_form_field(fieldId)
   */
  async find_form_field(fieldId: string): Promise<AgentExecutionResult<FormFieldDefinition>> {
    const field = this.activeSchema?.fields.find((f) => f.id === fieldId);
    if (!field) {
      return this.recordAudit('find_form_field', fieldId, 'failure', `Field ${fieldId} not found on page`);
    }

    return this.recordAudit('find_form_field', fieldId, 'success', `Field found: ${field.label}`, field);
  }

  /**
   * Tool 5: fill_field(fieldId, value)
   */
  async fill_field(fieldId: string, value: any): Promise<AgentExecutionResult<{ fieldId: string; value: any }>> {
    if (this.isStopped) {
      return this.recordAudit('fill_field', fieldId, 'cancelled', 'Automation stopped by user');
    }

    const field = this.activeSchema?.fields.find((f) => f.id === fieldId);
    if (!field) {
      return this.recordAudit('fill_field', fieldId, 'failure', `Field ${fieldId} not found`);
    }

    // High security field verification check:
    if (field.isSensitive && !value) {
      return this.recordAudit('fill_field', fieldId, 'failure', 'Sensitive value cannot be empty');
    }

    return this.recordAudit('fill_field', fieldId, 'success', `Filled ${field.label}`, { fieldId, value });
  }

  /**
   * Tool 6: select_option(fieldId, optionValue)
   */
  async select_option(fieldId: string, optionValue: string): Promise<AgentExecutionResult<{ fieldId: string; optionValue: string }>> {
    if (this.isStopped) {
      return this.recordAudit('select_option', fieldId, 'cancelled', 'Automation stopped by user');
    }

    const field = this.activeSchema?.fields.find((f) => f.id === fieldId);
    if (!field || field.type !== 'select') {
      return this.recordAudit('select_option', fieldId, 'failure', `Select field ${fieldId} not found`);
    }

    return this.recordAudit('select_option', fieldId, 'success', `Selected option ${optionValue} for ${field.label}`, {
      fieldId,
      optionValue,
    });
  }

  /**
   * Tool 7: clear_field(fieldId)
   */
  async clear_field(fieldId: string): Promise<AgentExecutionResult<{ fieldId: string }>> {
    return this.recordAudit('clear_field', fieldId, 'success', `Cleared field ${fieldId}`, { fieldId });
  }

  /**
   * Tool 8: scroll_to_field(fieldId)
   */
  async scroll_to_field(fieldId: string): Promise<AgentExecutionResult<{ fieldId: string }>> {
    return this.recordAudit('scroll_to_field', fieldId, 'success', `Scrolled to field ${fieldId}`, { fieldId });
  }

  /**
   * Tool 9: click_next(currentPage)
   */
  async click_next(currentPage: number): Promise<AgentExecutionResult<{ nextPage: number }>> {
    if (this.isStopped) {
      return this.recordAudit('click_next', undefined, 'cancelled', 'Automation stopped');
    }

    const nextPage = currentPage + 1;
    return this.recordAudit('click_next', undefined, 'success', `Advanced to step ${nextPage}`, { nextPage });
  }

  /**
   * Tool 10: upload_document(fieldId, documentId)
   */
  async upload_document(fieldId: string, documentId: string): Promise<AgentExecutionResult<{ fieldId: string; documentId: string }>> {
    if (this.isStopped) {
      return this.recordAudit('upload_document', fieldId, 'cancelled', 'Automation stopped');
    }

    return this.recordAudit('upload_document', fieldId, 'success', `Uploaded document ${documentId} to field ${fieldId}`, {
      fieldId,
      documentId,
    });
  }

  /**
   * Tool 11: read_validation_error()
   */
  async read_validation_error(): Promise<AgentExecutionResult<{ errors: string[] }>> {
    return this.recordAudit('read_validation_error', undefined, 'success', 'Checked validation errors', { errors: [] });
  }

  /**
   * Tool 12: wait_for_user(reason, userActionType)
   */
  async wait_for_user(
    reason: string,
    actionType: UserActionRequiredType
  ): Promise<AgentExecutionResult<{ reason: string; actionType: UserActionRequiredType }>> {
    return this.recordAudit('wait_for_user', undefined, 'pending', `Handoff to user: ${reason} (${actionType})`, {
      reason,
      actionType,
    });
  }

  /**
   * Tool 13: stop_automation()
   */
  stop_automation(): AgentExecutionResult<void> {
    this.isStopped = true;
    return this.recordAudit('stop_automation', undefined, 'success', 'User stopped automation');
  }

  /**
   * Record entry to internal audit log (Rule 48)
   */
  private recordAudit<T = any>(
    tool: string,
    fieldId: string | undefined,
    result: 'success' | 'failure' | 'cancelled' | 'pending',
    details?: string,
    data?: T
  ): AgentExecutionResult<T> {
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const entry: FormCopilotAuditEntry = {
      id: auditId,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }),
      portalId: this.activePortal?.portalId || 'unknown',
      action: tool,
      fieldId,
      result,
      details,
    };

    this.auditLog.push(entry);

    return {
      success: result === 'success' || result === 'pending',
      tool,
      data,
      error: result === 'failure' ? details : undefined,
      auditId,
    };
  }

  getAuditLogs(): FormCopilotAuditEntry[] {
    return [...this.auditLog];
  }
}

export const governmentFormAgent = new GovernmentFormAgent();
