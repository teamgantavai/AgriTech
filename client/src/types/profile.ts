// ================================================================
// Profile Types — Gram Sathi Citizen Profile System
// Data models for Profile, Field Verifications, Documents & State Machine
// ================================================================

export type FieldStatus =
  | 'EMPTY'
  | 'DETECTED'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'CORRECTED'
  | 'REJECTED'
  | 'SKIPPED';

export type FieldSource =
  | 'manual'
  | 'voice'
  | 'document'
  | 'import'
  | 'government_service'
  | 'user_upload'
  | 'preset_avatar'
  | (string & {});

export type ProfileType = 'general' | 'student' | 'farmer' | 'all';

export interface CitizenProfile {
  id?: string;
  user_id: string;

  // Personal Information
  full_name: string | null;
  profile_photo_url?: string | null;
  date_of_birth: string | null; // Format: YYYY-MM-DD
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  mobile: string | null;
  email: string | null;

  // Address
  state: string | null;
  district: string | null;
  sub_district: string | null;
  village_city: string | null;
  pin_code: string | null;
  address: string | null;

  // Education
  highest_qualification: string | null;
  course: string | null;
  institution: string | null;
  passing_year: number | null;

  // Eligibility & Social
  occupation: string | null;
  category: 'General' | 'OBC' | 'SC' | 'ST' | 'EWS' | 'Other' | null;
  annual_family_income: number | null;

  // Optional Farmer Profile
  is_farmer: boolean;
  farmer_land_details: string | null;
  farmer_crops: string | null;
  farmer_irrigation: string | null;
  farmer_type: string | null;

  // Metadata
  profile_type: ProfileType;
  completion_percentage: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileFieldVerification {
  id?: string;
  user_id: string;
  field_name: string;
  value: string | null;
  source: FieldSource;
  status: FieldStatus;
  confidence: number;
  confirmed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type DocumentCategory =
  | 'aadhaar'
  | 'pan'
  | 'income_certificate'
  | 'caste_certificate'
  | 'residence_certificate'
  | 'domicile_certificate'
  | 'marksheet'
  | 'disability_certificate'
  | 'land_record'
  | 'bank_document'
  | 'other';

export interface UserDocument {
  id: string;
  user_id: string;
  document_type: DocumentCategory;
  document_title: string;
  storage_path?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  document_number_masked?: string;
  issue_date?: string;
  expiry_date?: string;
  verification_status: 'pending' | 'user_confirmed' | 'verified' | 'rejected';
  extracted_data?: Record<string, any>;
  created_at: string;
}

export interface DocumentConflict {
  fieldName: keyof CitizenProfile;
  fieldLabel: string;
  profileValue: any;
  documentValue: any;
  documentTitle: string;
}

export interface DocumentAiExtraction {
  documentId: string;
  documentTitle: string;
  documentType: DocumentCategory;
  extractedFields: Record<string, any>;
  conflicts: DocumentConflict[];
}

export interface ProfileAuditLog {
  id?: string;
  user_id: string;
  action: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  source: string;
  created_at: string;
}

export interface ProfileCompletionStats {
  percentage: number;
  completedFields: number;
  totalFields: number;
  missingFields: { key: string; label: string; section: string }[];
  completedList: { key: string; label: string; value: any; status: FieldStatus }[];
}

export type InterviewStep =
  | 'START'
  | 'INTRO'
  | 'ASKING'
  | 'LISTENING'
  | 'EXTRACTING'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'NEXT_FIELD'
  | 'PROFILE_REVIEW'
  | 'COMPLETED';

export interface InterviewFieldDefinition {
  key: keyof CitizenProfile;
  label: string;
  labelHi: string;
  labelPa: string;
  section: 'personal' | 'address' | 'education' | 'eligibility' | 'farmer';
  questionPromptHi: string;
  questionPromptPa: string;
  questionPromptEn: string;
  extractHint: string;
  type: 'text' | 'date' | 'select' | 'number';
  options?: string[];
  requiredFor?: ProfileType[];
}
