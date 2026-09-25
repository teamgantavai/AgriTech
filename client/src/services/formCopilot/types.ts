// ================================================================
// Form Copilot Types — Gram Sathi Government Website Form Copilot
// Data contracts for Supported Portals, Field Mappings, Form Sessions & Agents
// ================================================================

import type { CitizenProfile, UserDocument } from '../../types/profile';

export type PortalCapability =
  | 'form_detection'
  | 'field_filling'
  | 'document_upload'
  | 'multi_step'
  | 'guidance_only';

export type PortalStatus = 'supported' | 'guidance_mode' | 'unsupported';

export interface SupportedPortal {
  portalId: string;
  name: string;
  nameHi: string;
  officialUrl: string;
  domains: string[];
  capabilities: PortalCapability[];
  status: PortalStatus;
  description: string;
  descriptionHi: string;
  category: string;
}

export type FormFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'textarea'
  | 'file'
  | 'captcha'
  | 'otp';

export interface FormFieldOption {
  value: string;
  label: string;
  labelHi?: string;
}

export interface FormFieldDefinition {
  id: string;
  name: string;
  label: string;
  labelHi?: string;
  type: FormFieldType;
  required: boolean;
  section: string;
  sectionHi?: string;
  stepNumber: number;
  options?: FormFieldOption[];
  placeholder?: string;
  isSensitive?: boolean; // Aadhaar, PAN, Bank Details, Passwords
  explanation?: {
    questionTitle: string;
    en: string;
    hi: string;
    suggestedOptions?: Array<{ label: string; value: any }>;
  };
}

export interface PortalFormSchema {
  portalId: string;
  formId: string;
  title: string;
  titleHi: string;
  totalSteps: number;
  stepTitles: string[];
  fields: FormFieldDefinition[];
  requiresOtp?: boolean;
  requiresCaptcha?: boolean;
  requiresPayment?: boolean;
  paymentAmount?: number;
}

export type MappingSource = 'profile' | 'document' | 'user_input' | 'manual';
export type MappingConfidence = 'high' | 'medium' | 'low';
export type MappingStatus = 'ready' | 'needs_confirmation' | 'missing' | 'conflict' | 'filled';

export interface MappedFormField {
  fieldId: string;
  fieldLabel: string;
  fieldLabelHi?: string;
  stepNumber: number;
  section: string;
  required: boolean;
  type: FormFieldType;
  options?: FormFieldOption[];

  source: MappingSource;
  sourceKey?: keyof CitizenProfile;
  sourceLabel?: string;
  value: any;
  displayValue: string;
  confidence: MappingConfidence;
  status: MappingStatus;

  userConfirmed: boolean;
  documentId?: string;
  documentTitle?: string;
  documentType?: string;
  isSensitive?: boolean;
  maskedDisplayValue?: string;
  userOverridden?: boolean;

  explanation?: {
    questionTitle: string;
    en: string;
    hi: string;
    suggestedOptions?: Array<{ label: string; value: any }>;
  };
}

export enum FormSessionState {
  IDLE = 'IDLE',
  DISCOVERING = 'DISCOVERING',
  INSPECTING = 'INSPECTING',
  MAPPING = 'MAPPING',
  WAITING_FOR_REVIEW = 'WAITING_FOR_REVIEW', // Pre-fill review screen
  FILLING = 'FILLING',                      // Visible real-time step-by-step filling
  WAITING_FOR_USER = 'WAITING_FOR_USER',     // OTP, CAPTCHA, E-Sign, Payment, Confusing question
  VALIDATING = 'VALIDATING',
  READY_TO_SUBMIT = 'READY_TO_SUBMIT',       // Ready for final review before submission
  SUBMITTING = 'SUBMITTING',                 // Explicit submission confirmation requested
  COMPLETED = 'COMPLETED',                   // Successfully submitted with reference number
  FAILED = 'FAILED',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
}

export type UserActionRequiredType =
  | 'OTP'
  | 'CAPTCHA'
  | 'E_SIGN'
  | 'PAYMENT'
  | 'CONFUSING_QUESTION'
  | 'DOCUMENT_UPLOAD_CONFIRMATION'
  | 'MANUAL_CORRECTION'
  | 'FINAL_SUBMISSION_CONSENT';

export interface UserActionRequest {
  id: string;
  type: UserActionRequiredType;
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  fieldId?: string;
  fieldLabel?: string;
  options?: Array<{ label: string; value: any; isPrimary?: boolean }>;
  documentTitle?: string;
  amount?: number;
  suggestedAction?: string;
}

export interface FormFillProgressItem {
  fieldId: string;
  label: string;
  labelHi?: string;
  status: 'pending' | 'filling' | 'completed' | 'skipped' | 'failed' | 'needs_action';
  displayValue?: string;
  sourceBadge?: string;
}

export interface FormSubmissionReceipt {
  portalId: string;
  portalName: string;
  applicationNumber: string;
  submissionDate: string;
  submissionTime: string;
  applicantName: string;
  schemeTitle: string;
  referenceUrl: string;
  fieldsFilledCount: number;
  documentsAttachedCount: number;
}

export interface FormCopilotAuditEntry {
  id: string;
  timestamp: string;
  portalId: string;
  action: string;
  fieldId?: string;
  source?: string;
  result: 'success' | 'failure' | 'cancelled' | 'pending';
  details?: string;
}
